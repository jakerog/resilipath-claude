# WebSocket Event Schema — ResilienceOS Exercise Board
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## Connection

```
Endpoint: wss://api.resilienceos.com/ws/exercises/:exerciseId
Auth: Authorization: Bearer {jwt} (sent in upgrade HTTP request headers)
Protocol: WebSocket (RFC 6455)
```

### Connection Lifecycle
```
1. Client opens WebSocket connection with JWT in header
2. Server validates JWT (signature, expiry, tenant, role)
3. Server adds connection to exercise channel in Redis Pub/Sub
4. Server sends `connection.established` with current exercise snapshot
5. [Steady state: bidirectional event streaming]
6. Server sends `ping` every 30 seconds
7. Client must respond with `pong` within 10 seconds or connection is closed
8. On disconnect: server removes from channel; client auto-reconnects
```

---

## Event Envelope (all events)

```typescript
interface WSEvent {
  id:          string       // Unique event ID (UUID)
  type:        string       // Event type (see below)
  sequence:    number       // Monotonically increasing sequence per exercise channel
  tenant_id:   string       // Tenant UUID
  exercise_id: string       // Exercise UUID
  actor?: {                 // Who triggered this event (null for system events)
    user_id:   string
    name:      string
    role:      'admin' | 'moderator' | 'user' | 'report'
  }
  payload:     object       // Event-specific data (see below)
  timestamp:   string       // ISO 8601 UTC
}
```

---

## Server → Client Events

### `connection.established`
Sent immediately after successful connection. Contains current state snapshot.
```typescript
payload: {
  exercise: {
    id:           string
    name:         string
    status:       string
    current_phase: string
    phases: Array<{
      id: string; phase_name: string; status: string
    }>
  }
  connected_users: Array<{
    user_id: string; name: string; role: string
  }>
  last_sequence: number  // Client should request replay from this sequence if reconnecting
}
```

### `task.status_updated`
```typescript
payload: {
  task_id:          string
  task_display_id:  number
  stage_id:         string
  old_status:       TaskStatus
  new_status:       TaskStatus
  actual_start:     string | null  // ISO 8601
  actual_end:       string | null
  actual_duration_minutes: number | null
  variance_duration_minutes: number | null
}
```

### `task.timing_updated`
```typescript
payload: {
  task_id:                    string
  task_display_id:            number
  actual_start:               string | null
  actual_end:                 string | null
  actual_duration_minutes:    number | null
  variance_duration_minutes:  number | null
  forecast_start:             string | null
  forecast_end:               string | null
  forecast_duration_minutes:  number | null
}
```

### `task.notes_updated`
```typescript
payload: {
  task_id:         string
  task_display_id: number
  notes:           string
}
```

### `task.evidence_added`
```typescript
payload: {
  task_id:         string
  task_display_id: number
  file: {
    id:            string
    file_name:     string
    file_type:     string
    file_size_bytes: number
    thumbnail_url: string | null  // null until processing completes
    status:        'processing' | 'ready' | 'failed'
  }
}
```

### `task.evidence_processed`
Sent after malware scan + thumbnail generation completes.
```typescript
payload: {
  task_id:      string
  file_id:      string
  status:       'ready' | 'quarantined'
  thumbnail_url: string | null
  error?:       string  // only if status = 'quarantined'
}
```

### `stage.activated`
```typescript
payload: {
  stage_id:   string
  stage_name: string
  stage_order: number
  activated_at: string
}
```

### `stage.completed`
```typescript
payload: {
  stage_id:     string
  stage_name:   string
  completed_at: string
  actual_start: string
  actual_end:   string
  duration_minutes: number
}
```

### `stage.failed`
```typescript
payload: {
  stage_id:        string
  stage_name:      string
  failed_at:       string
  failure_task_id: string
  failure_reason:  string
}
```

### `stage.rollback_activated`
```typescript
payload: {
  rollback_stage_id:    string
  rollback_stage_name:  string
  triggered_by_stage_id: string
  activated_at:         string
  justification:        string | null
}
```

### `go_no_go.decision`
```typescript
payload: {
  task_id:         string
  task_display_id: number
  stage_id:        string
  outcome:         'go' | 'no_go'
  justification:   string | null
  approver_ids:    string[]
  decided_at:      string
  // Downstream effects:
  unblocked_task_ids:  string[]  // For 'go' outcome
  blocked_task_ids:    string[]  // For 'no_go' outcome
}
```

### `exercise.status_changed`
```typescript
payload: {
  old_status: ExerciseStatus
  new_status: ExerciseStatus
  changed_at: string
  notes:      string | null
}
```

### `exercise.phase_changed`
```typescript
payload: {
  phase_id:   string
  phase_name: string
  status:     PhaseStatus
  changed_at: string
}
```

### `checkin.received`
```typescript
payload: {
  resource_id:   string
  resource_name: string
  phase_id:      string
  phase_name:    string
  status:        'confirmed' | 'unavailable'
  notes:         string | null
  responded_at:  string
}
```

### `checkin.escalation`
```typescript
payload: {
  phase_id:              string
  escalation_level:      1 | 2 | 3 | 4 | 5  // T-48h, T-24h, T-12h, T-4h, T-1h
  non_responders:        Array<{ resource_id: string; resource_name: string }>
  confirmed_count:       number
  unavailable_count:     number
  total_count:           number
}
```

### `announcement`
Moderator/Admin broadcast to all participants.
```typescript
payload: {
  message:      string
  display_for:  number  // seconds to display banner (default 30)
  priority:     'normal' | 'urgent'
}
```

### `user.joined`
```typescript
payload: {
  user_id:    string
  name:       string
  role:       string
  joined_at:  string
}
```

### `user.left`
```typescript
payload: {
  user_id:  string
  name:     string
  left_at:  string
}
```

### `ping`
Server keepalive. Client must respond with `pong` within 10 seconds.
```typescript
payload: {
  server_time: string
}
```

### `error`
Server-to-client error notification.
```typescript
payload: {
  code:     string
  message:  string
  details?: object
}
```

Common error codes:
- `AUTH_EXPIRED` — JWT expired; client should refresh token and reconnect
- `EXERCISE_ENDED` — Exercise is now complete; connection will close in 60 seconds
- `RATE_LIMITED` — Too many messages from client

---

## Client → Server Events

### `pong`
Response to server `ping`. No payload.

### `task.optimistic_update`
Client informs server of a pending update (before API confirmation). Used for conflict detection.
```typescript
payload: {
  task_id:    string
  field:      'status' | 'notes' | 'timing'
  value:      any
  client_id:  string  // UUID generated per client session
}
```
Server responds with `task.optimistic_ack` or `task.optimistic_reject` if conflict detected.

### `replay.request`
Client requests missed events after reconnection.
```typescript
payload: {
  from_sequence: number  // Client's last received sequence number
}
```
Server replays all events from `from_sequence + 1` to current. Maximum replay window: last 500 events or last 30 minutes, whichever is smaller.

---

## Error Handling Client-Side

```typescript
// Reconnection strategy
const connect = () => {
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
  
  ws.onclose = (event) => {
    if (event.code === 1000) return  // Normal close — don't reconnect
    
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000)  // 1s, 2s, 4s, ..., 30s max
    reconnectAttempt++
    setTimeout(connect, delay)
  }
  
  ws.onopen = () => {
    reconnectAttempt = 0
    // Request replay of missed events
    ws.send(JSON.stringify({
      type: 'replay.request',
      payload: { from_sequence: lastReceivedSequence }
    }))
  }
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    // Don't try to reconnect here — onclose will be called next
  }
}
```

---

## Sequence Number Guarantees

- Sequence numbers are monotonically increasing integers per exercise channel
- Gaps in sequence numbers indicate dropped events (Redis Pub/Sub is best-effort)
- If client detects a gap (receives sequence 100 then 103), it should request replay
- Server stores last 500 events per exercise in a Redis list for replay
- Events older than 30 minutes are not available for replay (client should refresh page)

---

## Connection Limits

| Limit | Value | Enforcement |
|-------|-------|------------|
| Max connections per exercise | 500 | Server rejects upgrade with 429 |
| Max connections per IP | 10 | Nginx/ALB rate limit |
| Max message size (client → server) | 4KB | Server closes connection with 1009 |
| Max reconnect rate | 5 per minute per client | Server returns 1008 Policy Violation |
