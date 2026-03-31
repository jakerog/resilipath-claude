# Test Strategy — ResilienceOS Platform
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Author:** AGENT-007 (QA Guardian)  
**Status:** DRAFT  

---

## 1. Testing Philosophy

### Core Principle: Test What Could Kill an Exercise
ResilienceOS runs during live disaster recovery exercises. A bug that corrupts task status, allows a User to update another user's task, shows wrong duration data, or drops a WebSocket message during an exercise is not a minor inconvenience — it can cause a real business incident. Testing priorities reflect this.

**Testing pyramid:**
```
         /\
        /E2E\           Few — full user journeys through real browser
       /──────\
      /  Integ  \       Moderate — API contract tests, DB integration
     /────────────\
    /  Unit/State  \    Many — state machines, business logic, calculations
   /────────────────\
```

### The "Live Exercise" Test Scenario
Every significant feature must have a "live exercise simulation" integration test that:
1. Creates an exercise with 20+ tasks across 3 stages
2. Simulates 10 concurrent users with different roles
3. Progresses tasks through the full state machine
4. Validates real-time event delivery to all connected users
5. Asserts final state is consistent and reports are correct

---

## 2. Test Tooling

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit tests | **Vitest** | Native TypeScript, ESM-compatible, 10× faster than Jest |
| Integration tests | **Vitest** + **testcontainers** | Run tests against real Postgres + Redis in Docker |
| API contract tests | **Vitest** + **supertest** | HTTP client against running Fastify instance |
| E2E tests | **Playwright** | Cross-browser, mobile viewport support, built-in tracing |
| Performance/load | **k6** | Scripted load scenarios; WebSocket load testing |
| Accessibility | **axe-core** + **@axe-core/playwright** | Automated WCAG 2.1 AA scanning in E2E suite |
| Security | **OWASP ZAP** (DAST) + **Semgrep** (SAST) | SAST in CI; DAST against staging weekly |
| Visual regression | **Playwright** screenshots + **Percy** | Catch unintended UI regressions |

---

## 3. Unit Tests

### Scope
- All state machine logic (`packages/state-machines/`)
- All permission checks (`packages/rbac/`)
- Duration calculations (actual_duration, variance_duration)
- Email schedule resolvers (relative offset → absolute datetime)
- Tenant connection resolver logic
- RBAC `canDo(role, action, resource)` function

### State Machine Unit Tests — Exhaustive Matrix

For `TaskStateMachine`, every combination is tested:

```typescript
describe('TaskStateMachine', () => {
  // Valid transitions
  it.each([
    ['not_started', 'in_progress', 'user', true /* isOwner */, true /* predecessorsOk */],
    ['in_progress', 'completed', 'user', true, null],
    ['in_progress', 'failed', 'moderator', false, null],
    ['in_progress', 'not_started', 'moderator', false, null],
    ['failed', 'in_progress', 'moderator', false, null],
    ['completed', 'in_progress', 'admin', false, null],
    ['any', 'cancelled', 'admin', false, null],
  ])('allows %s → %s for %s', ...)
  
  // Invalid transitions (every invalid combination)
  it.each([
    ['not_started', 'completed', 'user', true, true, 'Cannot skip in_progress'],
    ['not_started', 'in_progress', 'user', false, true, 'User cannot update task they are not assigned to'],
    ['not_started', 'in_progress', 'user', true, false, 'Predecessor tasks not completed'],
    ['completed', 'in_progress', 'moderator', false, null, 'Only admin can revert completed tasks'],
    ['completed', 'not_started', 'admin', false, null, 'Cannot revert completed to not_started'],
  ])('rejects %s → %s for %s: %s', ...)
})
```

### RBAC Unit Tests — Permission Matrix
```typescript
describe('RBAC canDo()', () => {
  const ROLE_PERMISSION_MATRIX = [
    // [role, action, resource, expected]
    ['admin', 'write', 'exercise', true],
    ['admin', 'delete', 'task', true],
    ['moderator', 'update_any', 'task', true],
    ['moderator', 'write', 'exercise', false],
    ['user', 'update_own', 'task', true],
    ['user', 'update_any', 'task', false],
    ['user', 'read', 'task', true],
    ['user', 'delete', 'anything', false],
    ['report', 'read', 'report', true],
    ['report', 'write', 'task', false],
    ['report', 'read', 'task', false], // Report role sees reports, not raw task data
  ]
  
  it.each(ROLE_PERMISSION_MATRIX)(
    '%s can %s %s: %s',
    (role, action, resource, expected) => {
      expect(canDo(role, action, resource)).toBe(expected)
    }
  )
})
```

### Coverage Targets
- State machine package: 100%
- RBAC package: 100%
- Duration calculations: 100%
- Service layer business logic: ≥ 90%
- Utility functions: ≥ 85%

---

## 4. Integration Tests

### Database Integration (using testcontainers)
```typescript
// Each test suite gets a fresh Postgres container with migrations applied
// and a test tenant schema provisioned

describe('TaskRepository', () => {
  let db: DrizzleDB
  let tenantId: string
  
  beforeAll(async () => {
    db = await createTestDatabase() // spins up Postgres container
    tenantId = await provisionTestTenant(db)
  })
  
  afterAll(() => db.$client.end())
  
  it('enforces predecessor constraint for sequential tasks', async () => {
    const exercise = await createTestExercise(db, tenantId)
    const [task1, task2] = await createTestTasks(db, {
      exerciseId: exercise.id,
      predecessors: { task2: [task1.id] },
      workflow: 'sequential'
    })
    
    await expect(
      TaskRepository.updateStatus(db, tenantId, task2.id, 'in_progress', {
        userId: 'user1', role: 'user', ownsTasks: [task2.id]
      })
    ).rejects.toThrow('TASK_PREDECESSOR_NOT_MET')
    
    await TaskRepository.updateStatus(db, tenantId, task1.id, 'completed', ...)
    
    // Now task2 can start
    await expect(
      TaskRepository.updateStatus(db, tenantId, task2.id, 'in_progress', ...)
    ).resolves.toMatchObject({ status: 'in_progress' })
  })
  
  it('auto-calculates actual_duration when end time is set', async () => {
    const task = await createTestTask(db, { estimatedDurationMinutes: 30 })
    const start = new Date('2026-03-29T06:00:00Z')
    const end = new Date('2026-03-29T06:22:00Z')
    
    await TaskRepository.setTiming(db, tenantId, task.id, { start, end })
    const updated = await TaskRepository.findById(db, tenantId, task.id)
    
    expect(updated.actualDurationMinutes).toBe(22)
    expect(updated.varianceDurationMinutes).toBe(-8) // 22 - 30 = -8
  })
})
```

### Tenant Isolation Integration Tests — CRITICAL
```typescript
describe('Tenant Isolation', () => {
  let tenantA: TestTenant
  let tenantB: TestTenant
  
  beforeAll(async () => {
    tenantA = await provisionTestTenant(db, 'schema')
    tenantB = await provisionTestTenant(db, 'schema')
    await seedTestExercise(tenantA)
    await seedTestExercise(tenantB)
  })
  
  it('user from tenantA cannot read tenantB exercises via API', async () => {
    const tokenA = await loginAsAdmin(tenantA)
    const tenantBExerciseId = tenantB.exercises[0].id
    
    const response = await api.get(`/exercises/${tenantBExerciseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    
    expect(response.status).toBe(404) // NOT 403 — don't leak existence
  })
  
  it('task repository with tenantA context cannot return tenantB tasks', async () => {
    const tenantBTaskId = tenantB.tasks[0].id
    const result = await TaskRepository.findById(db, tenantA.id, tenantBTaskId)
    expect(result).toBeNull()
  })
  
  it('evidence upload presign cannot access cross-tenant storage keys', async () => {
    const tokenA = await loginAsAdmin(tenantA)
    const tenantBStorageKey = `tenants/${tenantB.id}/evidence/...`
    
    const response = await api.post('/upload/presign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ storageKey: tenantBStorageKey }) // attempt injection
    
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_STORAGE_KEY')
  })
})
```

---

## 5. API Contract Tests

### Pattern: Test Every Endpoint
Every API endpoint defined in `docs/api/contracts.md` has a corresponding test file. Tests cover:
- Happy path (201/200 with correct response shape)
- Auth failure (401 when no token)
- Role rejection (403 when insufficient role)
- Validation failure (422 with field errors)
- Not found (404 for unknown IDs)
- Conflict/business rule violation (409 or 422 with specific error code)

```typescript
describe('PATCH /tasks/:id/status', () => {
  it('200: user updates their own task from not_started to in_progress', ...)
  it('200: moderator updates any task', ...)
  it('200: admin updates any task', ...)
  it('403: user cannot update a task they are not assigned to', ...)
  it('403: report role cannot update any task', ...)
  it('422 TASK_PREDECESSOR_NOT_MET: sequential task blocked by incomplete predecessor', ...)
  it('422 INVALID_STATUS_TRANSITION: user cannot skip to completed from not_started', ...)
  it('422 STAGE_LOCKED: task in a locked rollback stage cannot be updated', ...)
  it('401: unauthenticated request rejected', ...)
  it('404: task not found in tenant', ...)
  it('idempotent: updating to same status is a no-op (returns 200, no audit entry)', ...)
})
```

---

## 6. End-to-End Tests (Playwright)

### Critical User Journeys (Must Never Break)

#### Journey 1: Full Exercise Execution
```
1. Admin creates exercise with 15 tasks across 3 stages
2. Admin assigns resources to tasks
3. Moderator sends check-in invitations
4. Resource completes check-in via tokenized link (no login)
5. Admin starts exercise
6. User logs in, sees their task board
7. User sets task to In-Progress (start time auto-recorded)
8. User uploads photo evidence (camera capture simulated)
9. User sets task to Completed
10. Moderator approves Go/No-Go gate
11. Exercise proceeds to next stage
12. Admin views Report Dashboard
13. Admin exports PDF report
14. Assert: all durations correct, all status transitions reflected, PDF contains correct data
```

#### Journey 2: Rollback Activation
```
1. Create exercise, start exercise
2. Set a gate task to 'failed'
3. Assert: rollback stage appears as available
4. Moderator activates rollback
5. Assert: rollback stage unlocks, rollback tasks are actionable
6. Assert: original stage tasks after the gate are blocked
7. Complete rollback tasks
8. Assert: exercise state is consistent
```

#### Journey 3: Multi-User Concurrent Updates (Real-Time)
```
[Uses Playwright multi-page (separate browser contexts for User A, User B, Moderator)]

1. User A and User B both viewing same exercise task board (WebSocket connected)
2. User A updates task 5 to In-Progress
3. Assert: User B sees task 5 update within 500ms (real-time)
4. Moderator broadcasts message "Stand by — 5 minute delay"
5. Assert: both User A and User B see broadcast banner within 500ms
```

#### Journey 4: RBAC Enforcement in UI
```
1. Login as 'report' role user
2. Assert: task board edit controls are not visible
3. Assert: Report Dashboard is accessible
4. Assert: Admin/Back-end sections are not accessible (redirect to 403 page)
5. Login as 'user' role
6. Navigate to task assigned to a DIFFERENT user
7. Assert: edit controls are disabled on other user's tasks
```

#### Journey 5: PWA Offline Mode
```
1. Login, navigate to task board
2. Simulate offline (Playwright network interception: block all requests)
3. Assert: offline banner appears
4. Assert: assigned tasks are still visible (from service worker cache)
5. Update a task status while offline
6. Assert: offline queue indicator shows 1 pending update
7. Restore network
8. Assert: offline update is synced to server
9. Assert: conflict resolution UI appears if server state changed during offline period
```

---

## 7. Performance Tests (k6)

### Baseline Load Test
```javascript
// k6 script: baseline_exercise.js
import { WebSocket } from 'k6/experimental/websockets'
import http from 'k6/http'

export const options = {
  scenarios: {
    exercise_participants: {
      executor: 'constant-vus',
      vus: 200,          // 200 concurrent exercise participants
      duration: '10m',
    }
  },
  thresholds: {
    http_req_duration: ['p95<500'],         // 95th percentile API response < 500ms
    'ws_session_duration': ['p95<600'],     // WebSocket event delivery < 600ms
    http_req_failed: ['rate<0.01'],         // < 1% error rate
  }
}

export default function() {
  // 1. Authenticate
  const token = loginAndGetToken()
  
  // 2. Connect to exercise WebSocket
  const ws = new WebSocket(`wss://api.resilienceos.com/ws/exercises/${EXERCISE_ID}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  
  // 3. Simulate realistic user behavior (update tasks every 30-120s)
  sleep(randomBetween(30, 120))
  
  // 4. POST status update
  const res = http.patch(
    `/api/v1/tasks/${randomTask()}/status`,
    JSON.stringify({ status: 'in_progress' }),
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  )
  
  check(res, { 'status update accepted': (r) => r.status === 200 })
}
```

### Stress Test: 1,000 Concurrent Users
```
Ramp from 0 → 1,000 users over 5 minutes
Hold 1,000 users for 10 minutes
Ramp down over 5 minutes
Assert: no errors, p99 < 2s during peak
```

### Spike Test: Exercise Start Surge
```
Simulate 200 users authenticating and connecting within 30 seconds (exercise start scenario)
Assert: all connections established within 10 seconds
Assert: first WebSocket event received by all clients within 2 seconds of server send
```

---

## 8. Security Tests

### SAST (Semgrep — runs in CI on every PR)
Rules enforced:
- No SQL string concatenation (all queries must use parameterized queries / ORM)
- No `eval()` or dynamic code execution
- No hardcoded secrets (regex patterns for common secret formats)
- No JWT decoded without signature verification
- No file uploads served without authentication
- XSS: no dangerous innerHTML usage
- CSRF: all state-mutating requests require valid JWT (stateless CSRF protection)

### DAST (OWASP ZAP — runs weekly against staging)
Scans for:
- OWASP Top 10 (SQLi, XSS, IDOR, broken auth, sensitive data exposure, etc.)
- Mass assignment vulnerabilities (ensure API doesn't accept arbitrary fields)
- Rate limit bypass attempts
- JWT algorithm confusion (ensure `alg: none` is rejected)

### Manual Penetration Test (Quarterly)
Focus areas:
1. Tenant isolation bypass attempts (IDOR across tenant_id)
2. Privilege escalation (user → moderator role)
3. File upload malicious content bypass
4. WebSocket authentication bypass
5. Evidence file access without authorization

---

## 9. Accessibility Tests

### Automated (every E2E run)
```typescript
// Playwright + axe-core
import { checkA11y } from 'axe-playwright'

test('Exercise task board meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/exercises/123/board')
  await checkA11y(page, null, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    violationThreshold: 0  // Zero tolerance for AA violations
  })
})
```

### Manual Accessibility Review (per release)
- Keyboard navigation: Tab through all interactive elements in task board
- Screen reader test: NVDA (Windows) + VoiceOver (macOS/iOS) + TalkBack (Android)
- Color blindness simulation: Deuteranopia, Protanopia, Tritanopia (via browser DevTools)
- Text zoom: verify layout at 200% zoom in all major browsers

---

## 10. Test Data Strategy

### Test Fixtures
All integration and E2E tests use deterministic fixtures, not random data:
```typescript
// packages/test-fixtures/exercises.ts
export const FIXTURE_EXERCISE_CFIN_MOCK1 = {
  exerciseName: 'S4P/CFIN — Mock 1 [TEST]',
  stages: [
    {
      stageName: 'pre_failover',
      tasks: [
        { taskDisplayId: 1, taskName: 'Open DR Bridge...', estimatedDurationMinutes: 10, ... },
        { taskDisplayId: 2, taskName: 'Review Runbook Steps', estimatedDurationMinutes: 0, ... },
        // ... all 18 pre-validation tasks from real runbook
      ]
    }
  ]
}
```

### Seed Script for Development
```bash
pnpm seed:dev
# Creates:
# - 3 test tenants (admin/moderator/user/report role users in each)
# - 2 exercises per tenant (CFIN + HCM, from real runbook data)
# - Full task/stage/resource structure
# - Sample completed exercise with real timing data for report testing
```

---

## 11. CI/CD Test Pipeline

```yaml
# Every PR:
lint → typecheck → unit-tests → integration-tests → build → e2e-smoke

# Every merge to main (staging deploy):
full-test-suite → performance-baseline → accessibility-scan → SAST → staging-deploy → smoke-tests

# Weekly (scheduled):
DAST-scan → full-load-test → visual-regression-check

# Pre-production deploy:
full-e2e → performance-full → manual-sign-off-gate → production-deploy → smoke-tests
```

### Test Duration Targets
| Stage | Target Duration | Blocking? |
|-------|----------------|-----------|
| Lint + typecheck | < 30s | Yes |
| Unit tests | < 60s | Yes |
| Integration tests | < 3 min | Yes |
| E2E smoke (5 critical journeys) | < 5 min | Yes |
| Full E2E suite | < 20 min | Staging only |
| Load test (baseline) | 15 min | Staging only |

---

## 12. Acceptance Criteria Library

Every feature in the tasklists references acceptance criteria (AC) defined here. Partial list:

### AC-TASK-001: Status Update
- AC-TASK-001a: User can update own task from `not_started` to `in_progress` when all predecessors are complete
- AC-TASK-001b: User cannot update task assigned to another user (API returns 403)
- AC-TASK-001c: Sequential task blocked by incomplete predecessor returns error code `TASK_PREDECESSOR_NOT_MET`
- AC-TASK-001d: `actual_start` is recorded when status changes to `in_progress`
- AC-TASK-001e: `actual_end` is recorded when status changes to `completed`
- AC-TASK-001f: `actual_duration_minutes` is correct within 1 minute of actual elapsed time
- AC-TASK-001g: All connected WebSocket clients receive `task.status_updated` event within 500ms

### AC-EVIDENCE-001: File Upload
- AC-EVIDENCE-001a: Presigned URL is generated in < 200ms
- AC-EVIDENCE-001b: File uploads up to 50MB succeed
- AC-EVIDENCE-001c: Files > 50MB are rejected at presign step (before upload)
- AC-EVIDENCE-001d: Malware-infected files are rejected and file_id is marked `quarantined`
- AC-EVIDENCE-001e: SHA-256 checksum stored and matches file content on verification
- AC-EVIDENCE-001f: Thumbnail visible in task evidence gallery within 60 seconds of upload
- AC-EVIDENCE-001g: Evidence file is accessible via presigned URL for 1 hour after request
- AC-EVIDENCE-001h: Evidence file cannot be accessed without a valid presigned URL

### AC-REALTIME-001: WebSocket Exercise Board
- AC-REALTIME-001a: Task status update visible to all connected clients within 500ms p95
- AC-REALTIME-001b: Disconnected client reconnects within 5 seconds on network restore
- AC-REALTIME-001c: Missed events during disconnection are replayed on reconnect (via sequence number)
- AC-REALTIME-001d: 200 concurrent WebSocket connections per exercise sustained for 30 minutes
- AC-REALTIME-001e: WebSocket connection rejected if JWT is expired (returns 401 during handshake)

### AC-RBAC-001: Role Enforcement
- AC-RBAC-001a: `user` role sees only tasks assigned to them in edit mode; all tasks in read mode
- AC-RBAC-001b: `moderator` role can edit all tasks in the exercise task board
- AC-RBAC-001c: `report` role cannot access the exercise task board
- AC-RBAC-001d: `report` role can access the Report Dashboard
- AC-RBAC-001e: `admin` role can access all platform features
- AC-RBAC-001f: Role checks are enforced at the API layer — UI-level bypasses do not work

### AC-CHECKIN-001: Resource Availability
- AC-CHECKIN-001a: Resource receives check-in invitation email within 5 minutes of invite trigger
- AC-CHECKIN-001b: Tokenized check-in link works without platform login
- AC-CHECKIN-001c: Check-in token is single-use; second confirmation attempt returns 410 Gone
- AC-CHECKIN-001d: Non-responding resources trigger escalation at configured threshold
- AC-CHECKIN-001e: Check-in status is visible to Admin/Moderator in real-time on exercise dashboard
