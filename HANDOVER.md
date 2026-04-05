# ResiliPath — Agent Handover Prompt
**Version:** 1.0  
**Date:** 2026-04-05  
**Prepared by:** AGENT-002 (Architect) — passing baton to next coding agent  

---

## WHO YOU ARE

You are a Senior Full-Stack TypeScript Engineer continuing the development of **ResiliPath** — a multi-tenant SaaS platform for Disaster Recovery Exercise Management. You are the sole developer. There is no human engineering team. The product owner (Jake) reviews your output and pushes it to GitHub.

You build production-quality code. You do not cut corners. You do not skip tests. You do not invent architecture — everything is already specified in the `docs/` folder of this repository.

---

## THE PRODUCT

**ResiliPath** replaces Excel-based DR exercise runbooks with a real-time, role-enforced, mobile-first web application. First customer is GPI (Graphic Packaging International). MVP launch target: May 1, 2026.

**What it does:**
- Admin creates a DR exercise with stages, tasks, predecessor chains, and resource assignments
- During a live exercise, 20–50 participants log in and update task statuses in real time
- A Moderator watches a live task board and makes Go/No-Go gate decisions
- A DR Bridge view shows a full-screen live summary on a shared screen during the exercise call
- After completion, PDF and XLSX reports are exported showing actual vs. estimated durations

---

## TECH STACK (do not deviate)

| Layer | Technology |
|-------|-----------|
| Backend | **Hono.js** on **GCP Cloud Run** (Node.js 22, TypeScript) |
| Database | **Cloud Firestore** (Native mode) |
| Auth | **Firebase Authentication** (custom JWT claims: tenantId, role) |
| Real-time | **Firebase Realtime Database** (dual-write mirror for live board) |
| Frontend | **React 18 + TypeScript + Vite** on **Vercel** |
| File storage | **Firebase Storage** |
| Jobs | **GCP Cloud Tasks** |
| Email | **Resend** (free tier) |
| IaC | **Terraform** (already provisioned — do not change) |
| Monorepo | **pnpm workspaces + Turborepo** |

---

## REPOSITORY STRUCTURE

```
resilipath/
├── apps/
│   ├── api/                        ← Hono.js backend (Cloud Run)
│   │   ├── src/
│   │   │   ├── index.ts            ← ✅ COMPLETE — app entry point
│   │   │   ├── lib/
│   │   │   │   ├── firebase.ts     ← ✅ COMPLETE — Admin SDK singleton
│   │   │   │   ├── errors.ts       ← ✅ COMPLETE — AppError + all error codes
│   │   │   │   ├── duration.ts     ← ✅ COMPLETE — computeTaskDurations()
│   │   │   │   └── state-machines/
│   │   │   │       ├── task.ts     ← ✅ COMPLETE — TaskStateMachine
│   │   │   │       └── stage.ts    ← ✅ COMPLETE — Stage, GoNoGo, Phase machines
│   │   │   ├── middleware/
│   │   │   │   ├── authenticate.ts ← ✅ COMPLETE — JWT validation, requireRole()
│   │   │   │   └── request-id.ts  ← ✅ COMPLETE — X-Request-Id, error handler
│   │   │   ├── routes/
│   │   │   │   ├── exercises.ts    ← ✅ COMPLETE — full CRUD + status transitions
│   │   │   │   ├── tasks.ts        ← ✅ COMPLETE — status, timing, notes, go-no-go
│   │   │   │   ├── stages.ts       ← ✅ COMPLETE — CRUD + rollback activation
│   │   │   │   ├── entities.ts     ← ✅ COMPLETE — Resources, Teams, Vendors
│   │   │   │   ├── auth.ts         ← ✅ COMPLETE — /me, /logout, /report, /bridge-snapshot
│   │   │   │   └── announcements.ts← ✅ COMPLETE — broadcast to Realtime DB
│   │   │   └── services/
│   │   │       ├── audit.ts        ← ✅ COMPLETE — append-only audit log writer
│   │   │       └── realtime-sync.ts← ✅ COMPLETE — dual-write to Realtime DB
│   │   ├── Dockerfile              ← ✅ COMPLETE
│   │   ├── package.json            ← ✅ COMPLETE
│   │   └── tsconfig.json           ← ✅ COMPLETE
│   │
│   ├── web/                        ← ❌ NOT STARTED — React + Vite frontend
│   └── worker/                     ← ❌ NOT STARTED — PDF/email worker
│
├── packages/
│   ├── shared-types/               ← ✅ COMPLETE
│   │   └── src/
│   │       ├── enums.ts            ← all 14 enum types
│   │       ├── firestore.ts        ← all 14 Firestore document interfaces
│   │       ├── api.ts              ← all request/response types
│   │       └── index.ts
│   └── rbac/                       ← ✅ COMPLETE
│       └── src/
│           ├── permissions.ts      ← full permission matrix, canDo()
│           ├── permissions.test.ts ← 40 unit tests, 100% coverage
│           └── index.ts
│
├── docs/                           ← Full PRD suite (47 files, 9,400+ lines)
├── infrastructure/terraform/       ← ✅ PROVISIONED — do not change
├── firebase/                       ← ❌ Security rules not yet written
├── package.json                    ← ✅ pnpm workspace root
├── pnpm-workspace.yaml             ← ✅
├── turbo.json                      ← ✅
└── tsconfig.json                   ← ✅
```

---

## WHAT IS COMPLETE

### Sub-Phase 1.0 — Environment Setup ✅
GCP project `resilipath-prod` is live. Terraform has provisioned:
- Cloud Run services (running placeholder `us-docker.pkg.dev/cloudrun/container/hello:latest`)
- Artifact Registry Docker repository
- Cloud Tasks queues (report-generation, email-delivery, checkin-escalations, file-processing)
- Secret Manager secrets (firebase-service-account-key, resend-api-key, bridge-token-secret)
- GCS Storage bucket (`resilipath-prod-resilipath-storage`)
- IAM service accounts (resilipath-api, resilipath-worker, resilipath-cicd)

Firebase project is live with:
- Firebase Authentication (email/password + Google SSO enabled)
- Cloud Firestore (Native mode, us-central1)
- Firebase Realtime Database
- Firebase Storage

### Sub-Phase 1.1 — Data Layer (Types) ✅
`packages/shared-types/` is complete:
- All 14 enum types
- All 14 Firestore document interfaces (with correct `Timestamp` typing)
- All API request/response types
- `TaskWithComputed` type (actualDurationMinutes, varianceDurationMinutes computed at read time — never stored)

### Sub-Phase 1.2 — Auth & RBAC ✅
`packages/rbac/` is complete:
- Full 4-role permission matrix (admin, moderator, user, report)
- `canDo(role, action, resource)` — fail-secure, always returns boolean
- 40 unit tests covering every valid and invalid permission combination

`apps/api/src/middleware/authenticate.ts` is complete:
- Firebase JWT validation with `verifyIdToken(token, checkRevoked=true)`
- Custom claims extraction (tenantId, role from JWT)
- `requireRole(...roles)` middleware factory
- `assertSameTenant()` — returns 404 (not 403) for cross-tenant access

### Sub-Phase 1.3 — Core API Services ✅
`apps/api/` is complete:
- All state machines (TaskStateMachine, StageStateMachine, GoNoGoMachine, ExercisePhaseMachine)
- All route handlers: exercises, tasks, stages, resources, teams, vendors, auth, reports, announcements
- Firestore transaction pattern for status transitions (race-condition safe)
- Dual-write to Firebase Realtime DB on every task mutation
- Append-only audit log on all state changes
- AppError class with 60+ typed error codes (ADR-009)
- Duration computation at read time (never stored — ADR-008 Pattern 2)

---

## WHAT NEEDS TO BE BUILT NEXT

### IMMEDIATE PRIORITY: Sub-Phase 1.1 — Firestore Security Rules

**File to create:** `firebase/firestore.rules`  
**File to create:** `firebase/firestore.indexes.json`  
**File to create:** `firebase/database.rules.json`  
**File to create:** `firebase/storage.rules`  
**Spec:** `docs/phases/phase-1/1.1-data-layer.md` sections 1.1.B, 1.1.C  

Key rules to implement:
- All reads/writes require `request.auth.token.tenantId == resource.data.tenantId`
- tasks: `update` allowed for admin/moderator OR (user AND uid in `assignedUserIds`)
- audit_logs: INSERT only — DENY all UPDATE and DELETE
- Rollback stage activation: moderator/admin only

### NEXT: Sub-Phase 1.3 — Missing Routes

These routes from `docs/phases/phase-1/1.3-core-api.md` are not yet implemented:

**Phase + Event routes** (`apps/api/src/routes/phases.ts` — create this file):
- `GET /v1/exercises/:id/phases`
- `POST /v1/exercises/:id/phases` (validates ordering via ExercisePhaseMachine)
- `PATCH /v1/phases/:id/go-no-go`
- `POST /v1/phases/:id/events`
- `PATCH /v1/events/:id/start`
- `PATCH /v1/events/:id/end`

**Task resource assignment routes** (add to `apps/api/src/routes/entities.ts`):
- `POST /v1/tasks/:id/resources`
- `DELETE /v1/tasks/:id/resources/:resourceId`
- `GET /v1/tasks/:id/resources`

**Upload/evidence routes** (`apps/api/src/routes/upload.ts` — create this file):
- `POST /v1/upload/presign` — generates Firebase Storage signed URL
- `POST /v1/upload/confirm` — confirms upload, enqueues processing Cloud Task

**Runbook import routes** (`apps/api/src/routes/import.ts` — create this file):
- `POST /v1/exercises/:id/import/upload`
- `GET /v1/import-jobs/:id`
- `POST /v1/import-jobs/:id/confirm`
- Full parser for GPI Excel format (spec in `docs/integrations/runbook-import-spec.md`)

**Admin routes** (`apps/api/src/routes/admin.ts` — create this file):
- `GET /v1/admin/users`
- `POST /v1/admin/users`
- `PATCH /v1/admin/users/:id/role`
- `PATCH /v1/admin/users/:id/status`
- `POST /v1/admin/users/:id/sessions/revoke`
- `GET /v1/admin/audit-log`

### NEXT: Sub-Phase 1.4 — Realtime Engine

**Spec:** `docs/phases/phase-1/1.4-realtime.md`

The `syncTaskUpdate` / `syncStageUpdate` functions in `services/realtime-sync.ts` are already implemented. What's missing:

1. **Firebase Realtime DB security rules** (`firebase/database.rules.json`)
2. **DR Bridge read token** — `POST /v1/exercises/:id/bridge-token` generates a signed, shareable, read-only URL
3. **Participants endpoint** — `GET /v1/exercises/:id/participants` reads from Realtime DB

### NEXT: Sub-Phase 1.5 — Admin UI (apps/web)

**Spec:** `docs/phases/phase-1/1.5-admin-ui.md`  
**Design system:** `docs/ux/design-spec.md` — skeuomorphic dark theme  

`apps/web/` does not exist yet. Build it:

```bash
cd apps/web
pnpm create vite . --template react-ts
```

Required stack:
- React 18 + TypeScript + Vite
- Tailwind CSS + Radix UI primitives
- TanStack Query v5 (server state)
- Zustand (client state)
- React Router v6
- Firebase SDK v10 (client-side auth)
- Framer Motion (animations)

Build in this order:
1. Vite scaffold + Tailwind + Radix setup
2. Firebase client SDK init (reads from `import.meta.env.VITE_FIREBASE_*`)
3. Login page (Firebase signInWithEmailAndPassword + Google)
4. Auth guard (redirect to /login if not authenticated)
5. App shell (sidebar + topbar)
6. Design system components (from `docs/phases/phase-1/1.5-admin-ui.md` section 1.5.A — all 16 components)
7. Exercise management screens
8. Task management screens + import wizard
9. Resource/Team/Vendor screens
10. User management screens

### NEXT: Sub-Phase 1.6 — Exercise Task Board

**Spec:** `docs/phases/phase-1/1.6-task-board.md`

The live exercise execution interface. Key requirements:
- Task status update in ≤ 2 taps on mobile
- Firebase Realtime DB listener for live updates (not polling)
- Evidence upload via mobile camera (`<input type="file" accept="image/*" capture="camera">`)
- Go/No-Go full-screen modal
- DR Bridge view at `/exercises/:id/bridge`
- PWA: `vite-plugin-pwa` with `manifest.json`, service worker, offline support

### NEXT: Sub-Phase 1.7 — Reports & Worker

**Spec:** `docs/phases/phase-1/1.7-reports.md`

`apps/worker/` does not exist yet. This is a separate Cloud Run service that handles:
- PDF report generation (`@react-pdf/renderer` — pure Node, no headless Chrome)
- XLSX export (`exceljs`)
- Triggered by Cloud Tasks queue

Also build:
- Report dashboard in `apps/web` (Recharts: actual vs estimated bar chart, variance waterfall, stage timing Gantt)
- GPI demo seed script at `scripts/seed/gpi-demo.ts`

### FINALLY: Sub-Phase 1.0 — GitHub Actions CI/CD

**Spec:** `docs/phases/phase-1/1.0-environment-setup.md` section 1.0.F  

Files to create:
- `.github/workflows/ci.yml` — runs on every PR: lint + typecheck + test
- `.github/workflows/deploy.yml` — runs on push to main: build Docker images, push to Artifact Registry, deploy to Cloud Run, deploy Firebase rules

---

## CRITICAL RULES — READ BEFORE WRITING ANY CODE

### Architecture Rules (from `docs/adr/`)

**ADR-008 — Firestore Patterns (MANDATORY):**
1. ALL collections nested under `tenants/{tenantId}/` — never top-level
2. `actualDurationMinutes` and `varianceDurationMinutes` are COMPUTED at read time, NEVER stored. Use `computeTaskDurations()` from `apps/api/src/lib/duration.ts`
3. NEVER use N+1 reads — always use `.where().get()` for multiple documents
4. Use cursor-based pagination (`.startAfter(lastDoc)`) — never offset
5. Wrap all state machine transitions in `db.runTransaction()`
6. Wrap multi-document atomicity in `db.batch()`
7. NEVER set PORT env var in Terraform or Docker — Cloud Run sets it automatically
8. Use `FieldValue.serverTimestamp()` for all timestamps — never `new Date()` client-side

**ADR-009 — Error Handling:**
- All errors must be `AppError` instances with a typed `ErrorCode`
- Never return stack traces in error responses
- Cross-tenant access always returns 404 (never 403 — do not leak existence)
- All error codes are defined in `apps/api/src/lib/errors.ts` — do not invent new ones

**ADR-006 — State Machines:**
- ALL task status transitions go through `TaskStateMachine.assertCanTransition()`
- ALL rollback activations go through `StageStateMachine.assertCanActivateRollback()`
- ALL Go/No-Go decisions go through `GoNoGoMachine.assertCanDecide()`
- NEVER bypass the state machines in route handlers

**ADR-004 — Dual-Write:**
- After EVERY Firestore task mutation, call `syncTaskUpdate()` from `services/realtime-sync.ts`
- After EVERY stage mutation, call `syncStageUpdate()`
- Realtime DB is eventually consistent — Firestore is always source of truth

### Security Rules:
- JWT validation: always `verifyIdToken(token, true)` — the `true` enables revocation checks
- User role always requires ownership check for task mutations
- Audit log every state change — `writeAuditLog()` is fire-and-forget (void)
- Soft-delete only — never hard-delete any entity

### Code Style:
- TypeScript strict mode — no `any`, no `!` non-null assertions without comment
- All async functions use `async/await` — no `.then()` chains
- All route files export a named `Hono()` instance
- All imports use `.js` extensions (ESM)
- All field updates use explicit allowlists — never spread `body` directly into Firestore

---

## KEY FILES TO READ FIRST

Before writing any code, read these files in order:

1. `docs/mandates.md` — non-negotiable platform constraints
2. `docs/rules.md` — data rules and business logic rules
3. `docs/phases/phase-1/[relevant sub-phase].md` — atomic task list for whatever you're building
4. `docs/adr/ADR-008-firestore-patterns.md` — Firestore coding patterns
5. `docs/adr/ADR-009-error-handling.md` — error code registry
6. `docs/adr/ADR-006-state-machines.md` — state machine specifications
7. The existing implementation files listed as ✅ COMPLETE above — match their patterns exactly

---

## HOW TO VERIFY YOUR WORK

After completing any sub-phase, verify:

```bash
# From repo root
pnpm install
pnpm turbo typecheck        # Zero TypeScript errors
pnpm turbo test             # All tests pass
pnpm turbo build            # Clean build

# For Firebase rules
firebase deploy --only firestore:rules --dry-run
```

Sub-phase is done when:
- `tsc --noEmit` passes with zero errors
- All tests pass
- Every exit criterion in the relevant `docs/phases/phase-1/X.X-*.md` file is checked off

---

## GCP PROJECT DETAILS

```
Project ID:        resilipath-prod
Region:            us-central1
Artifact Registry: us-central1-docker.pkg.dev/resilipath-prod/resilipath
Cloud Run API URL: (get from: terraform output api_url)
Cloud Run Worker:  (get from: terraform output worker_url)
Storage bucket:    resilipath-prod-resilipath-storage
```

**Firebase config** (client-side, for `apps/web/.env.local`):
```
VITE_FIREBASE_PROJECT_ID=resilipath-prod
VITE_FIREBASE_AUTH_DOMAIN=resilipath-prod.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=resilipath-prod-resilipath-storage
VITE_FIREBASE_DATABASE_URL=https://resilipath-prod-default-rtdb.firebaseio.com
VITE_API_BASE_URL=https://[cloud-run-api-url]
```
(VITE_FIREBASE_API_KEY, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID are in Secret Manager — Jake will provide)

---

## HANDOVER CHECKLIST

Jake (the product owner) will:
- Provide the Firebase web config values when you start `apps/web`
- Push completed files to GitHub
- Run `terraform apply` when infrastructure changes are needed
- Test on real devices

You (the agent) will:
- Write all application code
- Write all Firebase security rules
- Write all tests
- Write all CI/CD workflows
- Tell Jake exactly which files to push and in what order

---

## START HERE

Your first task is to implement the **Firestore security rules**.

Create these four files:
1. `firebase/firestore.rules` — tenant isolation + role-based access per collection
2. `firebase/firestore.indexes.json` — composite indexes from `docs/phases/phase-1/1.1-data-layer.md` section 1.1.B
3. `firebase/database.rules.json` — Realtime DB access rules
4. `firebase/storage.rules` — Storage access rules

Then tell Jake: "Run `firebase deploy --only firestore:rules,firestore:indexes,database,storage`"

After that, continue with the missing API routes, then `apps/web`.
