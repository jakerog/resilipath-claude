# API Contract Specification — ResilienceOS
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Base URL:** `https://api.resilienceos.com/api/v1`  
**Auth:** Bearer JWT in `Authorization` header for all endpoints  
**Format:** JSON request/response bodies  

---

## Conventions

### HTTP Verbs
- `GET` — Read (idempotent, never mutates)
- `POST` — Create new resource
- `PUT` — Replace resource (full update)
- `PATCH` — Partial update
- `DELETE` — Soft delete (sets `deleted_at`)

### Response Envelope
```json
// Success (single resource)
{
  "data": { ... },
  "meta": { "request_id": "req_..." }
}

// Success (collection)
{
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJ...",
    "has_next": true,
    "total_count": 247
  },
  "meta": { "request_id": "req_..." }
}

// Error
{
  "error": {
    "code": "TASK_PREDECESSOR_NOT_MET",
    "message": "Task 43 cannot be started: predecessor task 42 is not yet completed.",
    "details": {
      "task_id": "tsk_...",
      "blocking_predecessor_ids": ["tsk_..."]
    }
  },
  "meta": { "request_id": "req_..." }
}
```

### Pagination
All list endpoints accept:
- `?cursor=` — opaque cursor for next page
- `?limit=` — page size (default 50, max 200)

### Filtering
List endpoints support filter query params, e.g.:
- `?status=in_progress`
- `?team_id=...`
- `?assigned_to_me=true` (tasks filtered to requesting user's assignments)

---

## Module 1 API — DR Exercise Manager

### Exercises

```
GET    /exercises                     List exercises (paginated)
POST   /exercises                     Create exercise
GET    /exercises/:id                 Get exercise detail (includes phases, stages summary)
PUT    /exercises/:id                 Update exercise
DELETE /exercises/:id                 Soft-delete exercise [Admin]
PATCH  /exercises/:id/status          Transition exercise status
POST   /exercises/:id/duplicate       Clone exercise (all tasks, teams, resources) [Admin]
```

### Exercise Phases
```
GET    /exercises/:id/phases          List phases for exercise
POST   /exercises/:id/phases          Create phase (mock_1 | mock_2 | mock_3 | production) [Admin]
PUT    /phases/:id                    Update phase
PATCH  /phases/:id/go-no-go           Record Go/No-Go decision [Moderator, Admin]
```

### Exercise Events
```
GET    /phases/:id/events             List events (failover + failback) for phase
POST   /phases/:id/events             Create event [Admin]
PUT    /events/:id                    Update event (schedule times, etc.)
PATCH  /events/:id/start              Record actual start time
PATCH  /events/:id/end                Record actual end time
```

### Stages
```
GET    /events/:id/stages             List stages for event (ordered)
GET    /stages/:id                    Get stage detail
PUT    /stages/:id                    Update stage [Admin]
PATCH  /stages/:id/activate-rollback  Unlock rollback stage [Moderator, Admin]
PATCH  /stages/:id/timing             Update actual start/end times
```

### Tasks
```
GET    /exercises/:id/tasks           List all tasks (grouped by stage, sorted by task_display_id)
GET    /stages/:id/tasks              List tasks for a specific stage
POST   /stages/:id/tasks              Create task [Admin]
GET    /tasks/:id                     Get task detail (with evidence, predecessors, resources)
PUT    /tasks/:id                     Full update [Admin — back-end management]
PATCH  /tasks/:id/status              Update status [User (own), Moderator/Admin (any)]
PATCH  /tasks/:id/timing              Set start/end time (triggers duration recalc)
PATCH  /tasks/:id/notes               Update notes [User (own), Moderator/Admin (any)]
DELETE /tasks/:id                     Soft-delete [Admin]
POST   /tasks/:id/evidence            Upload evidence file (multipart/form-data)
GET    /tasks/:id/evidence            List evidence files for task
DELETE /tasks/:id/evidence/:file_id   Soft-delete evidence [Admin]
POST   /exercises/:id/tasks/import    Import tasks from XLSX/CSV [Admin]
```

### Resources
```
GET    /resources                     List resources
POST   /resources                     Create resource [Admin]
GET    /resources/:id                 Get resource detail
PUT    /resources/:id                 Update resource [Admin]
DELETE /resources/:id                 Soft-delete [Admin]
POST   /resources/:id/photo           Upload resource photo
GET    /resources/:id/tasks           List tasks assigned to resource (for current user's exercise)
```

### Teams
```
GET    /teams                         List teams
POST   /teams                         Create team [Admin]
GET    /teams/:id                     Get team detail (with resources)
PUT    /teams/:id                     Update team [Admin]
DELETE /teams/:id                     Soft-delete [Admin]
POST   /teams/:id/logo                Upload team logo
POST   /teams/:id/resources           Add resource to team [Admin]
DELETE /teams/:id/resources/:res_id   Remove resource from team [Admin]
```

### Vendors
```
GET    /vendors                       List vendors
POST   /vendors                       Create vendor [Admin]
GET    /vendors/:id                   Get vendor detail
PUT    /vendors/:id                   Update vendor [Admin]
DELETE /vendors/:id                   Soft-delete [Admin]
POST   /vendors/:id/logo              Upload vendor logo
```

### Resource Check-In
```
GET    /exercises/:id/checkins        List check-in status for all resources, all phases
POST   /exercises/:id/checkins/invite Send check-in invitations for a phase [Moderator, Admin]
GET    /checkins/:token               Get check-in form (no auth required — tokenized)
PATCH  /checkins/:token               Submit check-in response (no auth required — tokenized)
GET    /exercises/:id/checkins/summary Summary: % confirmed per phase
```

### Email Engine
```
GET    /email/lists                   List email lists
POST   /email/lists                   Create email list [Admin]
PUT    /email/lists/:id               Update email list [Admin]
DELETE /email/lists/:id               Delete email list [Admin]
POST   /email/lists/:id/members       Add member to list
DELETE /email/lists/:id/members/:email Remove member
POST   /email/lists/:id/import        Import members from CSV

GET    /email/templates               List templates
POST   /email/templates               Create template [Admin]
PUT    /email/templates/:id           Update template [Admin]
DELETE /email/templates/:id           Delete template [Admin]
POST   /email/templates/:id/preview   Render preview with sample data

GET    /email/schedules               List schedules
POST   /email/schedules               Create schedule (assign template + lists + timing)
PUT    /email/schedules/:id           Update schedule (before it sends)
DELETE /email/schedules/:id           Cancel schedule
POST   /email/schedules/:id/send-now  Send immediately [Admin]
GET    /email/schedules/:id/log       Delivery log for a schedule
```

### Reporting
```
GET    /exercises/:id/report          Full exercise report data (all durations, variances)
GET    /exercises/:id/report/pdf      Generate and return PDF report
GET    /exercises/:id/report/xlsx     Generate and return XLSX report
GET    /exercises/compare             Compare 2+ exercises (query: ?ids=ex1,ex2,ex3)
GET    /exercises/:id/timeline        Gantt data (actual start/end per task)
GET    /exercises/:id/lessons-learned List lessons learned for exercise
POST   /exercises/:id/lessons-learned Create lesson [User, Moderator, Admin]
PUT    /lessons-learned/:id           Update lesson
```

### Real-Time (WebSocket)
```
WS /ws/exercises/:id   Exercise event stream
  Events emitted by server:
    exercise.started
    exercise.paused
    task.status_updated   { task_id, old_status, new_status, updated_by }
    task.timing_updated   { task_id, start, end, actual_duration }
    task.notes_updated    { task_id, notes, updated_by }
    task.evidence_added   { task_id, file_id, uploaded_by }
    stage.activated       { stage_id, stage_name }
    stage.rollback_activated { stage_id }
    go_no_go.decision     { task_id, outcome, decided_by }
    checkin.received      { resource_id, phase_id, status }
    announcement          { message, sent_by }   -- Moderator broadcast
    
  Events sent by client:
    ping                  (keepalive)
```

---

## Authentication Endpoints
```
POST   /auth/login               Email + password login → returns access + refresh tokens
POST   /auth/refresh             Refresh token → new access token
POST   /auth/logout              Invalidate refresh token
GET    /auth/me                  Get current user profile
POST   /auth/mfa/enroll          Begin TOTP enrollment
POST   /auth/mfa/verify          Verify TOTP code
DELETE /auth/mfa                 Remove MFA [requires re-auth]
GET    /auth/sso/:tenant-slug    Initiate SAML SSO for tenant
POST   /auth/sso/callback        SAML assertion consumer service endpoint
```

---

## Admin / Tenant Management
```
GET    /admin/users              List users in tenant
POST   /admin/users              Create user [Admin]
PUT    /admin/users/:id          Update user (role, status) [Admin]
DELETE /admin/users/:id          Deactivate user [Admin]
POST   /admin/users/:id/sessions/revoke  Revoke all sessions for user [Admin]

GET    /admin/audit-log          Search audit log [Admin]
GET    /admin/settings           Get tenant settings
PUT    /admin/settings           Update tenant settings (logo, timezone, colors) [Admin]
POST   /admin/settings/domain    Configure custom domain [Admin, Enterprise only]
POST   /admin/settings/sso       Configure SSO/SAML [Admin, Professional+]
GET    /admin/export/data        Export all tenant data (GDPR) [Admin]
DELETE /admin/account            Initiate tenant account deletion [Admin]
```

---

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| Auth (login, refresh) | 20/minute per IP |
| Write operations (POST, PUT, PATCH, DELETE) | 300/minute per tenant |
| Read operations (GET) | 1000/minute per tenant |
| File upload | 60/minute per user |
| Email send | 10/minute per tenant (scheduled sends bypass this) |
| Report generation | 10/minute per tenant |
| WebSocket connections | 500 per exercise |

All rate limit responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.
