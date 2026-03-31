# Phase 1 Sprint Plan — DR Exercise Manager MVP
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Duration:** 5 × 2-week sprints = 10 weeks  
**Prerequisite:** Phase 0 complete (auth, multi-tenancy, CI/CD, design system base)  
**Status:** DRAFT — sprint assignments TBD pending team composition confirmation  

---

## Sprint Overview

| Sprint | Focus | Key Deliverable |
|--------|-------|----------------|
| S1 | Data model + Core API | All 6 entities: CRUD API + DB migrations |
| S2 | Exercise state machine + Real-time | Live exercise lifecycle + WebSocket |
| S3 | Admin back-end UI | Full management interface for all entities |
| S4 | Task board + RBAC | User-facing exercise interface + role enforcement |
| S5 | Reports + Evidence + Seed data | Report dashboard, file upload, demo data |

**Definition of Done (all sprints):**
- Feature is coded, code-reviewed (minimum 1 reviewer), and merged
- Unit tests pass at ≥ 90% coverage for new code
- Integration tests pass against real Postgres/Redis containers
- No new TypeScript errors (`tsc --noEmit` passes)
- No new SAST findings (Semgrep)
- Deployed to staging successfully
- Smoke tests pass on staging

---

## SPRINT 1 — Data Model & Core API
**Dates:** Weeks 1–2  
**Goal:** All six entities can be fully managed via the API. No UI yet — Postman/curl is the client.

### Stories

#### S1-1 — Database Schema (3 points)
**As a** backend engineer  
**I want** all Phase 1 tables created with correct columns, types, indexes, and constraints  
**So that** all application data can be persisted correctly  

Acceptance Criteria:
- [ ] All 6 entity tables created: exercises, exercise_phases, exercise_events, stages, tasks, resources, teams, vendors
- [ ] All join tables created: task_predecessors, task_resources, team_resources
- [ ] Supplementary tables: evidence_files, resource_checkins, email_lists, email_list_members, email_templates, email_schedules, email_deliveries
- [ ] Generated columns work: actual_duration_minutes, variance_duration_minutes (verified with INSERT test)
- [ ] Drizzle schema files match DB structure (drizzle-kit push verified against fresh DB)
- [ ] Migration files committed and tested on clean Postgres 16 instance
- [ ] Schema applies cleanly in < 30 seconds

#### S1-2 — Multi-Tenant Schema Provisioning (2 points)
**As a** platform  
**I want** a new tenant schema provisioned on demand  
**So that** each tenant gets an isolated database namespace  

Acceptance Criteria:
- [ ] `POST /admin/tenants/:id/provision` creates schema `tenant_{id}` with all tables
- [ ] `TenantConnectionResolver` returns correct connection + schema for each tenant ID
- [ ] Integration test: Tenant A queries return only Tenant A data (zero cross-tenant leakage)
- [ ] Provisioning completes in < 10 seconds

#### S1-3 — Exercise CRUD API (3 points)
- [ ] `POST /exercises` — creates exercise with all fields; validates owner_id is a resource in same tenant
- [ ] `GET /exercises` — paginated list with filters (status, date range)
- [ ] `GET /exercises/:id` — full detail including phase/stage summary counts
- [ ] `PUT /exercises/:id` — full update; Admin only
- [ ] `DELETE /exercises/:id` — soft delete; Admin only; validates exercise is not `in_progress`
- [ ] `PATCH /exercises/:id/status` — validates transition via state machine
- [ ] All endpoints return correct HTTP status codes and error envelopes
- [ ] All endpoints enforce tenant isolation

#### S1-4 — Stages, Tasks Core CRUD (5 points)
- [ ] Full CRUD for stages (`/exercises/:id/stages`, `/stages/:id`)
- [ ] Full CRUD for tasks (`/stages/:id/tasks`, `/tasks/:id`)
- [ ] Task create validates: stage_id belongs to same exercise; predecessor task IDs exist and belong to same exercise
- [ ] Task `GET /exercises/:id/tasks` returns tasks sorted by task_display_id ASC, grouped by stage_order ASC
- [ ] Task predecessor create/delete via `/tasks/:id/predecessors`

#### S1-5 — Resources, Teams, Vendors CRUD (3 points)
- [ ] Full CRUD for resources (`/resources`)
- [ ] Full CRUD for teams (`/teams`)
- [ ] Full CRUD for vendors (`/vendors`)
- [ ] Relationship management: add/remove resource from team; assign team to exercise
- [ ] Photo/logo upload: presigned URL endpoint for each entity type

#### S1-6 — RBAC Middleware (2 points)
- [ ] `AuthMiddleware` validates JWT on every request (signature, expiry, tenant claim)
- [ ] `RBACMiddleware` checks role + ownership for all mutating endpoints
- [ ] Role permission matrix enforced (see rules.md BL-004)
- [ ] 403 returned for insufficient role; 401 for missing/invalid JWT
- [ ] Unit tests: all 40+ role/action/resource combinations tested

**Sprint 1 Total: ~18 points**

---

## SPRINT 2 — Exercise State Machine & Real-Time Engine
**Dates:** Weeks 3–4  
**Goal:** The exercise lifecycle can be managed end-to-end. Two engineers can simultaneously update tasks and see each other's changes in real-time.

### Stories

#### S2-1 — Task State Machine (3 points)
- [ ] `TaskStateMachine` class in `packages/state-machines/`
- [ ] All valid and invalid transitions handled with descriptive error codes
- [ ] Predecessor enforcement: `TASK_PREDECESSOR_NOT_MET` error for sequential blocked tasks
- [ ] Ownership check: `TASK_NOT_ASSIGNED_TO_USER` error
- [ ] Status transition logging to audit_logs
- [ ] `PATCH /tasks/:id/status` integrated with state machine
- [ ] 100% unit test coverage on state machine

#### S2-2 — Timing & Duration Auto-Calculation (2 points)
- [ ] `PATCH /tasks/:id/timing` sets start and/or end timestamps
- [ ] `actual_duration_minutes` auto-calculated by DB generated column (verified)
- [ ] `variance_duration_minutes` auto-calculated (verified)
- [ ] If start time set and status is `not_started`: auto-transition to `in_progress`
- [ ] Duration displayed correctly in API responses (both raw minutes and formatted HH:MM)

#### S2-3 — Stage & Rollback State Machine (3 points)
- [ ] Stage auto-completes when all non-optional, non-cancelled tasks complete
- [ ] Rollback stage is locked by default; unlock requires Moderator/Admin
- [ ] `PATCH /stages/:id/activate-rollback` — validates pre-conditions, unlocks stage, creates audit entry
- [ ] Stage failure state: triggered when Go/No-Go task receives `no_go` decision
- [ ] All stage transitions logged to audit_logs

#### S2-4 — Go/No-Go Decision Handling (2 points)
- [ ] `PATCH /tasks/:id/go-no-go` — processes decision (go/no_go) with justification
- [ ] `go` outcome: task → completed; unblocks downstream tasks; emits event
- [ ] `no_go` outcome: task → failed; stage → failed; triggers rollback check; blocks downstream tasks
- [ ] Only Moderator and Admin can make Go/No-Go decisions
- [ ] Justification is required for `no_go` decisions

#### S2-5 — Exercise Phase Progression (2 points)
- [ ] `POST /exercises/:id/phases` creates next phase (enforces ordering, validates mock3_required logic)
- [ ] Mock 3 conditional creation rules enforced
- [ ] Production phase creation blocked unless all required mocks are complete
- [ ] Phase Go/No-Go outcome stored and used for mock3_required evaluation

#### S2-6 — WebSocket Server (5 points)
- [ ] WebSocket server on `/ws/exercises/:id`
- [ ] JWT authentication on upgrade request
- [ ] Exercise channel: subscribe all connections for same exercise
- [ ] Redis Pub/Sub for fan-out across API server instances
- [ ] Events emitted on: task status change, task timing change, task notes change, stage activation, rollback activation, Go/No-Go decision
- [ ] Reconnection: sequence number issued per event; client can request replay from sequence N
- [ ] Client keepalive: ping every 30 seconds; disconnect unresponsive clients after 90 seconds
- [ ] Performance test: 200 concurrent connections, broadcast latency < 500ms p95

#### S2-7 — Audit Log Integration (1 point)
- [ ] All state machine transitions create audit log entries
- [ ] Audit entries include: tenant_id, user_id, action, entity_type, entity_id, before_state, after_state, ip_address, request_id
- [ ] Audit log DB user has no UPDATE/DELETE permissions (verified by attempting in test)

**Sprint 2 Total: ~18 points**

---

## SPRINT 3 — Admin Back-End UI
**Dates:** Weeks 5–6  
**Goal:** Admins can fully manage all exercise data through a web interface.

### Stories

#### S3-1 — Design System Components for Back-End (3 points)
- [ ] Table component: sortable columns, pagination, row actions (edit, delete), bulk selection
- [ ] Form components: text input, textarea, date picker, time picker, select, multi-select, file upload
- [ ] Modal: create/edit forms in modal dialog
- [ ] Confirmation dialog: "Are you sure you want to delete X?" with undo option
- [ ] Status badge component (all statuses, all sizes)
- [ ] Toast notifications (success, error, warning)

#### S3-2 — Exercise Management UI (3 points)
- [ ] Exercise list page: table with name, application, status, start date, owner, phase count
- [ ] Exercise create/edit modal: all fields
- [ ] Exercise detail page: overview, phase list, stage list, task count per stage
- [ ] Exercise status change controls with confirmation
- [ ] Phase management: create phases, view phase summary, record Go/No-Go decisions

#### S3-3 — Task Management UI (5 points)
- [ ] Task list page (within exercise context): all tasks, sortable, filterable by stage/status/team
- [ ] Task create/edit: full form with all 20+ fields
- [ ] Predecessor selection: searchable multi-select showing task display IDs and names
- [ ] Resource assignment: multi-select from resources assigned to this exercise
- [ ] Bulk operations: bulk status change, bulk stage reassignment
- [ ] Drag-and-drop task reordering within a stage (updates task_display_id)
- [ ] Import wizard: upload XLSX/CSV → column mapping → preview → import

#### S3-4 — Resource/Team/Vendor Management UI (3 points)
- [ ] Resource list: table with photo, name, email, team, exercise assignments
- [ ] Resource create/edit: all fields + photo upload (drag-and-drop, camera on mobile)
- [ ] Team list: table with logo, name, vendor, resource count
- [ ] Team detail: resource roster management (add/remove with drag-and-drop ordering)
- [ ] Vendor list + create/edit with logo upload

#### S3-5 — User Management UI (2 points)
- [ ] User list: table with name, email, role, last login, status
- [ ] Invite user: send invitation email with role pre-assigned
- [ ] Edit user role: dropdown role selector (Admin, Moderator, User, Report)
- [ ] Deactivate/reactivate user with confirmation
- [ ] Audit log: paginated, searchable audit log viewer (Admin only)

**Sprint 3 Total: ~16 points**

---

## SPRINT 4 — Task Board UI & RBAC Enforcement
**Dates:** Weeks 7–8  
**Goal:** Any exercise participant can log in, see their tasks, and manage them during a live exercise. RBAC is visually and functionally enforced.

### Stories

#### S4-1 — Exercise Header Bar (2 points)
- [ ] Exercise name, status badge, current phase, direction (Failover/Failback)
- [ ] Live elapsed time timer (counts up from exercise start)
- [ ] Go/No-Go pending indicator (amber banner when gate task is actionable)
- [ ] Broadcast button (Moderator/Admin)
- [ ] Reports link, Settings link (role-conditional)

#### S4-2 — Stage Sections (2 points)
- [ ] Collapsible stage sections in correct order
- [ ] Stage header: name, task completion fraction, progress bar, elapsed time
- [ ] Rollback stage locked state with unlock control (Moderator/Admin only)
- [ ] Stage completion auto-detected and displayed (green checkmark)

#### S4-3 — Task Row Component (5 points)
- [ ] Task ID (monospace), status badge, name, team chip, resource chip(s)
- [ ] Expand/collapse (tap row → show detail panel)
- [ ] **Status update (< 2 taps):** tap status badge → status picker appears → tap new status → optimistic update
- [ ] Start/End time pickers: datetime-local, auto-records on in_progress transition
- [ ] Duration display: estimated, actual, variance (color-coded: green ahead, red behind)
- [ ] Notes field: inline edit, autosave (debounced 2s)
- [ ] Predecessor lock: locked tasks grayed with lock icon; tooltip shows blocking task IDs
- [ ] Optional task indicator: blue dashed border, OPTIONAL chip

#### S4-4 — RBAC Visual Enforcement (3 points)
- [ ] User role: edit controls visible only on tasks assigned to requesting user
- [ ] User role: other users' tasks are read-only (no edit button, no status picker)
- [ ] Moderator role: all tasks editable
- [ ] Report role: no task board access (redirect to reports page)
- [ ] Filter bar: filter tasks by team, status, assigned resource

#### S4-5 — Real-Time Task Board (3 points)
- [ ] WebSocket connection established on page load
- [ ] Task updates from other users animate in (subtle flash on changed row)
- [ ] Reconnection indicator (grey banner when offline, restores on reconnect)
- [ ] Missed events replayed on reconnect
- [ ] Broadcast message: full-width banner, visible for 30 seconds, dismissible

#### S4-6 — Go/No-Go Decision Modal (2 points)
- [ ] Full-screen modal triggered when Go/No-Go task becomes actionable
- [ ] Pre-conditions summary (all tasks complete?)
- [ ] Named approver requirement
- [ ] Justification field (required for No-Go)
- [ ] Go/No-Go buttons with distinct styling
- [ ] Outcome broadcast to all exercise participants via WebSocket

#### S4-7 — Progress Summary Bar (1 point)
- [ ] Sticky bottom bar: total tasks complete / total, current stage progress, overall exercise progress
- [ ] Updates in real-time

**Sprint 4 Total: ~18 points**

---

## SPRINT 5 — Reports, Evidence Upload & Demo Data
**Dates:** Weeks 9–10  
**Goal:** The exercise manager is complete. A full exercise can be run, reported on, and demonstrated to a prospective customer.

### Stories

#### S5-1 — Evidence Upload (4 points)
- [ ] Presigned URL generation endpoint
- [ ] Direct-to-S3 upload in front-end (progress ring)
- [ ] Upload confirmation endpoint + processing pipeline trigger
- [ ] Malware scan integration (ClamAV Lambda — mock in dev, real in staging/prod)
- [ ] Thumbnail generation and storage
- [ ] Evidence gallery on task row: grid of thumbnails, tap to view full size
- [ ] Delete evidence (Admin only, soft delete)

#### S5-2 — Report Dashboard (5 points)
- [ ] Exercise summary card: total duration, tasks complete, estimated vs. actual
- [ ] Actual Duration vs. Estimated chart (bar, per stage)
- [ ] Variance Duration chart (positive = ahead, negative = behind, waterfall)
- [ ] Stage completion timing (horizontal bar Gantt showing each stage's actual window)
- [ ] Team performance table (team, task count, avg actual, avg variance)
- [ ] Task drill-down table: all tasks with sortable columns
- [ ] Filter: by phase, stage, team, date range

#### S5-3 — Report Export (2 points)
- [ ] PDF export: styled report with logo, exercise name, all charts (rendered server-side via Playwright headless or Puppeteer)
- [ ] XLSX export: data dump — summary sheet + per-stage task sheet + team performance sheet
- [ ] Export links available in Report Dashboard; files generated async and download link emailed when ready

#### S5-4 — Sample Data Seeding (3 points)
- [ ] Seed script creates demo tenant with full data from real runbook:
  - 2 exercises (S4P/CFIN and HCM) with all stages and tasks
  - All teams from runbook (20+ teams)
  - All named resources from runbook (50+ resources)
  - Estimated durations from real runbook values
  - One exercise fully completed with real timing data (for demo reports)
- [ ] Seed runs in < 60 seconds on clean database
- [ ] Seed is idempotent (safe to re-run)
- [ ] Documentation: README section on running seed

#### S5-5 — Phase 1 Polish & Cross-Cutting (2 points)
- [ ] Loading states on all async operations (skeletons, not spinners)
- [ ] Empty states for all list views (helpful onboarding message + call-to-action)
- [ ] Error boundaries: unhandled errors show friendly message (not crash)
- [ ] 404 page with back navigation
- [ ] Accessibility pass: keyboard navigation, focus indicators, ARIA labels for task board

#### S5-6 — Phase 1 Performance Testing (2 points)
- [ ] k6 load test: 200 concurrent exercise participants, all ops < 500ms p95
- [ ] WebSocket load test: 200 concurrent connections, broadcast < 500ms p95
- [ ] DB query optimization: run EXPLAIN ANALYZE on top 10 most-used queries
- [ ] Add any missing indexes identified in query analysis

**Sprint 5 Total: ~18 points**

---

## Phase 1 Total: ~88 story points across 5 sprints

---

## Phase 1 Exit Criteria (Must ALL pass before Phase 2 begins)

- [ ] All 6 entity tables functional with full CRUD via Admin UI
- [ ] Full DR exercise lifecycle can be executed: create → assign → check-in → live execution → report
- [ ] 200 concurrent WebSocket users test passes (< 500ms p95 broadcast)
- [ ] RBAC: all role/permission tests pass in E2E suite
- [ ] Tenant isolation: automated cross-tenant access tests all pass
- [ ] Evidence upload works end-to-end (mobile camera → S3 → thumbnail visible)
- [ ] Report PDF/XLSX export generates correctly with real data
- [ ] Demo tenant seeded with real exercise data
- [ ] No open P0 or P1 security findings
- [ ] Accessibility: WCAG 2.1 AA violations = 0 (automated axe-core scan)
- [ ] Staging smoke test suite: 100% pass rate
- [ ] Product demo successfully completed with stakeholder sign-off
