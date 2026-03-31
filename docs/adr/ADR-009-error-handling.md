# ADR-009: Error Handling & Error Code Registry
**Status:** ACCEPTED  
**Date:** 2026-03-29  
**Author:** AGENT-002 (Architect)  

---

## Context
ResiliPath is built entirely by AI agents. Consistent, machine-readable error codes are critical because:
1. The frontend must map error codes to user-friendly messages without guesswork
2. Tests assert specific error codes, not message strings (which change)
3. Monitoring alerts on specific error codes to distinguish business rule violations from system errors
4. When an AI agent is asked to "handle the TASK_PREDECESSOR_NOT_MET error," it must find one canonical definition

---

## Error Response Format

All API errors return a structured JSON body with HTTP status code:

```typescript
interface ErrorResponse {
  error: {
    code: ErrorCode        // Machine-readable string — never changes
    message: string        // Human-readable — may change
    details?: object       // Optional structured context
    requestId: string      // X-Request-Id for log correlation
  }
}
```

### Example
```json
{
  "error": {
    "code": "TASK_PREDECESSOR_NOT_MET",
    "message": "Task #43 cannot be started: predecessor task #42 is not yet completed.",
    "details": {
      "taskId": "tsk_abc123",
      "taskDisplayId": 43,
      "blockingPredecessors": [
        { "taskId": "tsk_xyz789", "taskDisplayId": 42, "status": "in_progress" }
      ]
    },
    "requestId": "req_01J7..."
  }
}
```

---

## HTTP Status Code Usage

| Status | When to use |
|--------|------------|
| `400 Bad Request` | Input validation failure (missing field, invalid format) |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Authenticated but insufficient role/ownership |
| `404 Not Found` | Resource does not exist OR cross-tenant access attempt |
| `409 Conflict` | State conflict (e.g., duplicate taskDisplayId within exercise) |
| `422 Unprocessable Entity` | Business rule violation (state machine rejection, predecessor blocked) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unhandled exception (should be rare; always logged) |
| `503 Service Unavailable` | Firestore or Realtime DB unreachable |

**Rule:** Use `404` for cross-tenant resource access, never `403`. `403` confirms the resource exists — `404` reveals nothing.

---

## Complete Error Code Registry

### Authentication & Authorization

| Code | HTTP | Trigger |
|------|------|---------|
| `AUTH_TOKEN_MISSING` | 401 | Authorization header absent |
| `AUTH_TOKEN_INVALID` | 401 | JWT signature invalid |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT `exp` claim has passed |
| `AUTH_TOKEN_MALFORMED` | 401 | JWT cannot be parsed |
| `AUTH_INSUFFICIENT_ROLE` | 403 | User role cannot perform this action |
| `AUTH_NOT_TASK_OWNER` | 403 | User role is `user` and task not assigned to them |
| `AUTH_TENANT_MISMATCH` | 404 | Entity belongs to different tenant |
| `AUTH_MFA_REQUIRED` | 403 | Action requires MFA; user has not enrolled |

### Validation

| Code | HTTP | Trigger |
|------|------|---------|
| `VALIDATION_REQUIRED_FIELD` | 400 | Required field is null/undefined |
| `VALIDATION_INVALID_FORMAT` | 400 | Field format is wrong (e.g., invalid date, bad email) |
| `VALIDATION_INVALID_ENUM` | 400 | Value not in allowed enum set |
| `VALIDATION_OUT_OF_RANGE` | 400 | Numeric value outside allowed range |
| `VALIDATION_PAYLOAD_TOO_LARGE` | 400 | Request body exceeds size limit |
| `VALIDATION_UNSUPPORTED_FILE_TYPE` | 400 | Uploaded file MIME type not allowed |
| `VALIDATION_FILE_TOO_LARGE` | 400 | Uploaded file exceeds 50MB |

### Exercise & Phase

| Code | HTTP | Trigger |
|------|------|---------|
| `EXERCISE_NOT_FOUND` | 404 | Exercise ID does not exist in tenant |
| `EXERCISE_INVALID_STATUS_TRANSITION` | 422 | Exercise status change violates state machine |
| `EXERCISE_CANNOT_DELETE_ACTIVE` | 422 | Cannot delete exercise with status `in_progress` |
| `PHASE_NOT_FOUND` | 404 | Phase ID does not exist |
| `PHASE_INVALID_ORDER` | 422 | Attempting to create phase out of sequence |
| `PHASE_PRODUCTION_BLOCKED` | 422 | Production phase creation blocked — required mocks not complete |
| `PHASE_MOCK3_NOT_REQUIRED` | 422 | Attempting to create Mock 3 when not flagged as required |

### Stage

| Code | HTTP | Trigger |
|------|------|---------|
| `STAGE_NOT_FOUND` | 404 | Stage ID does not exist |
| `STAGE_LOCKED` | 422 | Stage is a locked rollback stage |
| `STAGE_ROLLBACK_ALREADY_ACTIVE` | 409 | Rollback stage is already unlocked |
| `STAGE_ROLLBACK_NO_FAILURE` | 422 | Rollback activation attempted without a preceding stage failure |

### Task

| Code | HTTP | Trigger |
|------|------|---------|
| `TASK_NOT_FOUND` | 404 | Task ID does not exist in tenant |
| `TASK_INVALID_STATUS_TRANSITION` | 422 | Status change not allowed by TaskStateMachine |
| `TASK_PREDECESSOR_NOT_MET` | 422 | Sequential task blocked by incomplete predecessor |
| `TASK_NOT_ASSIGNED_TO_USER` | 403 | User role attempting to update unassigned task |
| `TASK_CANNOT_DELETE_ACTIVE` | 422 | Cannot delete task with status `in_progress` |
| `TASK_DUPLICATE_DISPLAY_ID` | 409 | taskDisplayId already exists in this exercise |
| `TASK_PREDECESSOR_CIRCULAR` | 422 | Adding predecessor would create circular dependency |
| `TASK_PREDECESSOR_CROSS_EXERCISE` | 422 | Predecessor task belongs to different exercise |

### Go/No-Go

| Code | HTTP | Trigger |
|------|------|---------|
| `GONOGO_NOT_APPLICABLE` | 422 | Task is not marked `isGoNoGo` |
| `GONOGO_PREREQUISITES_INCOMPLETE` | 422 | Preceding non-optional tasks are not all complete |
| `GONOGO_ALREADY_DECIDED` | 409 | Go/No-Go decision already recorded for this task |
| `GONOGO_JUSTIFICATION_REQUIRED` | 400 | `no_go` outcome submitted without justification |

### Resource, Team, Vendor

| Code | HTTP | Trigger |
|------|------|---------|
| `RESOURCE_NOT_FOUND` | 404 | Resource ID does not exist |
| `RESOURCE_ALREADY_IN_TEAM` | 409 | Resource already assigned to this team |
| `TEAM_NOT_FOUND` | 404 | Team ID does not exist |
| `VENDOR_NOT_FOUND` | 404 | Vendor ID does not exist |

### File Upload & Evidence

| Code | HTTP | Trigger |
|------|------|---------|
| `UPLOAD_PRESIGN_DENIED` | 403 | Storage key path violates tenant isolation |
| `UPLOAD_FILE_QUARANTINED` | 422 | Malware scan failed; file rejected |
| `UPLOAD_PROCESSING_FAILED` | 500 | Thumbnail generation or checksum computation failed |
| `EVIDENCE_NOT_FOUND` | 404 | Evidence file ID does not exist |

### Import

| Code | HTTP | Trigger |
|------|------|---------|
| `IMPORT_INVALID_FILE_FORMAT` | 400 | File is not XLSX or CSV |
| `IMPORT_FILE_TOO_LARGE` | 400 | Import file exceeds 10MB |
| `IMPORT_TOO_MANY_ROWS` | 400 | File contains more than 5,000 rows |
| `IMPORT_NO_TASK_NAME_COLUMN` | 422 | Column mapping missing required Task Name column |
| `IMPORT_CIRCULAR_PREDECESSORS` | 422 | Predecessor relationships form a cycle |
| `IMPORT_JOB_NOT_FOUND` | 404 | Import job ID does not exist |
| `IMPORT_JOB_ALREADY_CONFIRMED` | 409 | Import job has already been confirmed |

### Rate Limiting

| Code | HTTP | Trigger |
|------|------|---------|
| `RATE_LIMIT_EXCEEDED` | 429 | Per-tenant or per-IP rate limit hit |

### System

| Code | HTTP | Trigger |
|------|------|---------|
| `INTERNAL_ERROR` | 500 | Unhandled exception (details omitted from response; full error in Cloud Logging) |
| `FIRESTORE_UNAVAILABLE` | 503 | Cannot reach Firestore |
| `REALTIME_DB_UNAVAILABLE` | 503 | Cannot reach Firebase Realtime Database |

---

## Implementation in Hono.js

```typescript
// packages/shared-types/errors.ts
export type ErrorCode = 
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_INSUFFICIENT_ROLE'
  | 'TASK_PREDECESSOR_NOT_MET'
  // ... all codes above

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: object
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Usage in service layer
throw new AppError(
  'TASK_PREDECESSOR_NOT_MET',
  422,
  `Task #${task.taskDisplayId} cannot be started: predecessor task #${pred.taskDisplayId} is not yet completed.`,
  { taskId: task.id, blockingPredecessors: [{ taskId: pred.id, status: pred.status }] }
)
```

```typescript
// apps/api/src/middleware/error-handler.ts
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: c.get('requestId')
      }
    }, err.httpStatus)
  }

  // Unhandled error — log full details, return generic response
  console.error('Unhandled error:', err)
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: c.get('requestId')
    }
  }, 500)
})
```

---

## Frontend Error Handling

The frontend maps error codes to user-friendly Toast messages. The mapping lives in one file:

```typescript
// apps/web/src/lib/error-messages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  TASK_PREDECESSOR_NOT_MET: 'This task cannot be started until its preceding tasks are complete.',
  TASK_NOT_ASSIGNED_TO_USER: 'You can only update tasks assigned to you.',
  AUTH_INSUFFICIENT_ROLE: 'You do not have permission to perform this action.',
  GONOGO_PREREQUISITES_INCOMPLETE: 'All preceding tasks must be completed before a Go/No-Go decision can be made.',
  // ... all user-visible codes
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}
```
