# ADR-007: Caching Strategy
**Status:** PROPOSED  
**Date:** 2026-03-29  
**Author:** AGENT-002 (Architect)  

---

## Context
ResilienceOS has several expensive or frequently-accessed data paths that benefit from caching. We must define what is cached, at what layer, with what TTL, and critically — how cache invalidation is handled. Stale data during a live DR exercise is a P0 incident.

---

## Cache Layers

### Layer 1: CDN (Cloudflare / CloudFront) — Static Assets Only
- **What:** JavaScript bundles, CSS, images, fonts
- **TTL:** 1 year (content-hashed filenames ensure cache busting on deploy)
- **Invalidation:** New deploy produces new content hash → new URL → automatic cache miss
- **What NOT cached:** Any API response (authentication required; dynamic data)

### Layer 2: Redis — Server-Side Application Cache

#### 2a: Tenant Connection Resolver Cache
```
Key: cache:tenant:{tenant_id}:connection
Value: { schema: "tenant_abc123", connectionString: "..." }
TTL: 5 minutes
Invalidation: On tenant suspension/deletion
```
**Why:** DB query to resolve tenant connection happens on every request. Redis lookup is < 1ms vs DB query at 5ms.

#### 2b: Feature Flag Cache
```
Key: cache:flags:{tenant_id}
Value: { featureName: boolean, ... }
TTL: 60 seconds
Invalidation: On flag change → delete key
```
**Why:** Feature flags are checked on many requests. DB query unnecessary.

#### 2c: Report Data Cache
```
Key: cache:report:{exercise_id}:{report_type}
Value: Serialized report JSON
TTL: 5 minutes during active exercise; 24 hours after exercise completed
Invalidation: On any task completion event → delete key
```
**Why:** Report generation aggregates data across all tasks. Expensive query. Acceptable 5-minute staleness during exercise.
**Critical:** Cache is INVALIDATED on every task update during a live exercise — report data is never more than 5 minutes stale, and invalidated immediately when tasks change.

#### 2d: Generated Report Files (PDF/XLSX)
```
Key: cache:export:{exercise_id}:{format}:{version_hash}
Value: S3 key of generated file
TTL: 24 hours
Invalidation: On exercise data change → delete key; user re-requests → regenerate
```

#### 2e: JWT Revocation List
```
Key: revoked:jti:{jwt_id}
Value: 1 (exists = revoked)
TTL: JWT expiry time (auto-expires when token would have expired anyway)
Set: On admin revocation of user sessions
```

#### 2f: Rate Limit Counters
```
Key: ratelimit:{type}:{identifier}:{window}
Value: Integer counter
TTL: Window duration (60 seconds for per-minute limits)
Implementation: Redis INCR + EXPIRE (atomic)
```

### Layer 3: HTTP Response Cache Headers — API Responses
Most API responses are NOT cached (require fresh data). Exceptions:

| Endpoint | Cache-Control |
|----------|--------------|
| `GET /exercises` (completed exercises list) | `Cache-Control: private, max-age=60` |
| `GET /resources` (never changes during exercise) | `Cache-Control: private, max-age=300` |
| `GET /teams` (never changes during exercise) | `Cache-Control: private, max-age=300` |
| `GET /exercises/:id/tasks` (during active exercise) | `Cache-Control: no-cache` (always fresh) |
| `GET /exercises/:id/report` (completed) | `Cache-Control: private, max-age=3600` |

### Layer 4: Frontend (TanStack Query) — Client-Side Cache
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds before refetch
      gcTime: 5 * 60_000,       // 5 minutes before garbage collected
      refetchOnWindowFocus: true,
      retry: 3,
    }
  }
})

// OVERRIDE for live exercise data — never stale
const exerciseTasksQuery = useQuery({
  queryKey: ['exercises', exerciseId, 'tasks'],
  queryFn: fetchExerciseTasks,
  staleTime: 0,              // Always refetch
  refetchInterval: false,    // Rely on WebSocket for updates instead
})
```

**Critical pattern for live exercise:** Task data is updated via WebSocket events (push), NOT polling. When a WebSocket event arrives, the TanStack Query cache is updated directly:
```typescript
// On WebSocket task.status_updated event
queryClient.setQueryData(['tasks', taskId], (old) => ({
  ...old,
  status: event.payload.new_status,
  actualStart: event.payload.actual_start,
}))
```
This gives optimistic-like feel (instant update) while maintaining server state accuracy.

---

## Cache Invalidation Rules

**Rule 1: Task mutation → invalidate report cache**
On any PATCH to task status, timing, or notes:
```typescript
await redis.del(`cache:report:${exerciseId}:*`) // glob delete via SCAN
```

**Rule 2: Exercise completion → extend report cache TTL**
When exercise status changes to `completed`:
```typescript
await redis.expire(`cache:report:${exerciseId}:*`, 24 * 3600)
```

**Rule 3: Tenant deletion → invalidate all tenant caches**
```typescript
await redis.del(`cache:tenant:${tenantId}:*`)
await redis.del(`cache:flags:${tenantId}`)
await redis.del(`cache:report:*`) // tenant-scoped by exercise_id lookup
```

---

## Anti-Patterns (Explicitly Prohibited)

❌ **Never cache task status during an active exercise in any server-side cache with TTL > 0.** Task status must always reflect the current DB state.

❌ **Never cache user permissions in Redis.** RBAC checks must always use the current user's role from JWT (which is validated per-request). A role change must take effect on the next request.

❌ **Never cache audit log entries.** Audit log reads always go to the primary DB (never a replica that might have replication lag).

---

## Cache Failure Handling

If Redis is unavailable:
- Tenant connection resolver: fall back to DB lookup (slower, but safe)
- Feature flags: fall back to default values (flags default to OFF = safe, not OFF = dangerous)
- Report cache: fall back to generating fresh report on every request (performance degradation, not data issue)
- Rate limiting: fail open (do not rate limit if Redis is unavailable — log and alert)
- JWT revocation: fail closed (treat all JWTs as potentially valid — alert security team immediately)
