# ADR-006: Task & Exercise State Machines — Formal Specification
**Status:** PROPOSED  
**Date:** 2026-03-29  
**Author:** AGENT-002 (Architect)  
**Supersedes:** None  

---

## Context
The DR Exercise domain has several complex state machines: Task status, Stage activation, Exercise phase progression, and Rollback triggering. These state machines encode critical business rules that govern what users can do during a live exercise. They must be formally specified, centrally implemented, and tested exhaustively. **A state machine bug during a live Production DR exercise is a P0 incident.**

All state machines are implemented in a dedicated `packages/rbac` → `packages/state-machines` package that is imported by the API. Never re-implemented inline in route handlers.

---

## 1. Task State Machine

### States
```
not_started → in_progress → completed
                ↓                ↑
             failed ──────────── (moderator/admin only rollback to in_progress)
                ↓
          (triggers rollback check)
             
delayed    (sub-state of in_progress — variance > threshold)
cancelled  (terminal — requires admin)
optional   (overlay flag, not a state — task exists in all states but is flagged optional)
```

### Transitions

| From | To | Actor | Pre-condition | Side Effect |
|------|-----|-------|--------------|-------------|
| `not_started` | `in_progress` | User (own), Moderator, Admin | All predecessor tasks are `completed` (for sequential) OR no predecessors (for parallel) | Record `actual_start = NOW()`. Emit `task.started` event. |
| `in_progress` | `completed` | User (own), Moderator, Admin | None | Record `actual_end = NOW()`. Calculate `actual_duration`. Emit `task.completed` event. Check if this unblocks any sequential successors. |
| `in_progress` | `failed` | Moderator, Admin | None | Emit `task.failed` event. If task is a gate task: trigger `stage.failure_check`. |
| `in_progress` | `not_started` | Moderator, Admin | Manual override with justification | Clear `actual_start`. Log audit entry with justification. |
| `failed` | `in_progress` | Moderator, Admin | Manual override with justification | Clear `actual_end`. Log audit entry. |
| `completed` | `in_progress` | Admin only | Emergency override with justification | Clear `actual_end`. Log audit entry with EMERGENCY flag. |
| `any` | `cancelled` | Admin | Must provide cancellation reason | Emit `task.cancelled` event. Does not block successors. |
| `not_started` | `optional` | Moderator, Admin | `is_optional = true` on task | Task is excluded from stage completion calculation. |

### Auto-Delay Detection
A background job runs every 5 minutes during an active exercise:
```
IF task.status = 'in_progress'
AND task.actual_start IS NOT NULL
AND NOW() > task.actual_start + task.estimated_duration_minutes * 1.5
THEN emit 'task.delayed' warning event (does NOT change status)
```
Delay warnings appear on the task row UI and in the moderator view. Status remains `in_progress`.

---

## 2. Stage State Machine

### States
```
pending → active → completed
                ↓
           failed (if any gate task fails)
                ↓
    [rollback_stage] locked → unlocked → active → completed
```

### Transitions

| From | To | Trigger | Pre-condition |
|------|-----|---------|--------------|
| `pending` | `active` | Previous stage `completed` OR Moderator/Admin manual activation | Stage order is correct |
| `active` | `completed` | All non-optional, non-cancelled tasks in stage are `completed` | Automatic — triggered when last task completes |
| `active` | `failed` | Any gate task (`is_go_no_go = true`) receives `no_go` decision | Emit `stage.failed`. Notify exercise owner. |
| `rollback.locked` | `rollback.unlocked` | Moderator/Admin activates rollback | Preceding stage is `failed` OR explicit override with justification |
| `rollback.unlocked` | `rollback.active` | Moderator/Admin begins rollback execution | None |
| `rollback.active` | `rollback.completed` | All rollback tasks completed | Automatic |

### Stage Ordering
Enforced by `stage_order` column. Stages activate in order. An Admin can force-activate a stage out of order (creates audit entry marked `OVERRIDE`).

---

## 3. Exercise Phase State Machine

### States
```
mock_1.planned → mock_1.in_progress → mock_1.completed
                                            ↓
                                [Go/No-Go evaluation]
                                   go → mock_2.planned
                                   no_go → review (exercise paused)
                                   
mock_2.completed → [Go/No-Go evaluation]
                      go (passed mock_1 AND mock_2) → production.planned
                      go (failed mock_1 OR mock_2 but approved) → mock_3.planned
                      
mock_3 (if needed) → mock_3.completed → production.planned
production.planned → production.in_progress → production.completed
```

### Mock 3 Trigger Logic
```
mock3_required = TRUE when:
  mock_1.go_no_go_outcome = 'no_go'
  OR mock_2.go_no_go_outcome = 'no_go'
  OR Admin manually sets mock3_required = true
```

### Production Phase Guard
Production phase CANNOT be created until:
1. Mock 1 is `completed`
2. Mock 2 is `completed`
3. If `mock3_required`: Mock 3 is `completed`
4. Admin explicitly creates the production phase with sign-off

---

## 4. Rollback Activation State Machine

### Rollback is NOT automatic. It is always a deliberate human decision.

```
Condition triggers (any):
  - A gate task receives `no_go` decision
  - A stage is marked `failed`
  - Moderator/Admin manually requests rollback

→ System emits `rollback.available` event
→ Exercise owner and moderators receive alert: "Stage X failed. Rollback available."
→ Full-screen decision prompt appears for Moderators/Admins:
    [Confirm Rollback] [Override — Continue Without Rollback (requires justification)]

→ If [Confirm Rollback]:
    - Rollback stage unlocks
    - Rollback stage activates
    - All in-progress tasks in the failed stage are set to `cancelled`
    - Rollback tasks begin

→ If [Override — Continue]:
    - Justification logged to audit
    - Failed stage marked `completed_with_override`
    - Exercise continues to next stage
```

---

## 5. Go/No-Go Decision Machine

Go/No-Go tasks are special task records with `is_go_no_go = true`. They behave differently:

### Pre-conditions for Go/No-Go task to become actionable
- All preceding tasks in the stage (except other `is_go_no_go` tasks) are `completed` or `cancelled`
- At least one user with `moderator` or `admin` role is in the exercise session

### Decision Recording
```
POST /api/v1/tasks/:id/go-no-go
Body: { outcome: 'go' | 'no_go', justification: string, approver_ids: uuid[] }
```

### Effects of `go`
- Go/No-Go task status → `completed`
- All sequential tasks with this task as predecessor become actionable
- Emit `go_no_go.approved` event
- Notify all exercise participants

### Effects of `no_go`
- Go/No-Go task status → `failed`
- Stage status → `failed`
- Emit `go_no_go.rejected` event with justification
- Trigger rollback evaluation (see section 4)
- All subsequent tasks in the stage → `blocked` (cannot start)

---

## 6. Resource Check-In State Machine

```
invited → pending (default)
pending → confirmed (resource responds: available)
pending → unavailable (resource responds: not available)
pending → no_response (deadline passes without response)
unavailable → backup_assigned (coordinator assigns backup resource)
```

### Escalation Triggers
```
T-48h from exercise start: Send first check-in invitation
T-24h: Send reminder to non-responders
T-12h: Send escalation to team lead if resource is still pending
T-4h:  Send escalation to exercise owner with full non-responder list
T-1h:  Final notification; exercise owner must manually decide on backup
```

---

## Implementation Notes

### Central State Machine Package
```typescript
// packages/state-machines/task.ts
export class TaskStateMachine {
  static canTransition(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus,
    actor: { role: UserRole; isOwner: boolean },
    context: { predecessorsComplete: boolean; taskIsOptional: boolean }
  ): { allowed: boolean; reason?: string }
  
  static getValidTransitions(
    currentStatus: TaskStatus,
    actor: { role: UserRole; isOwner: boolean }
  ): TaskStatus[]
}
```

### Enforcement Points
1. **API route handler**: Calls `StateMachine.canTransition()` before processing any status change request
2. **Database trigger**: Postgres CHECK constraint on valid status values; trigger logs invalid transition attempts
3. **WebSocket handler**: Validates state before broadcasting — prevents client-side spoofing
4. **Unit tests**: Every valid AND invalid transition is tested

### Optimistic UI Consideration
The frontend performs optimistic status updates for User role on their own tasks. If the server rejects the transition, the UI reverts and shows a toast notification: "Status update was rejected: [reason]". This means state machine responses must be fast (< 100ms) and descriptive.
