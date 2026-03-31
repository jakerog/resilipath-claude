# Phase 2 Sprint Plan — DR Exercise Manager GA
**Version:** 0.2.0  
**Date:** 2026-03-29  
**Duration:** 8 weeks post-MVP  
**Target Start:** May 2, 2026 (day after MVP launch)  
**Status:** PLANNED  

---

## Phase 2 Objective

Elevate the MVP to a production-grade, full-featured DR Exercise platform by adding the three capabilities deferred from Phase 1: Resource Availability Check-In, the Email Engine, and advanced PWA features. Additionally adds cross-exercise analytics and the XLSX runbook import wizard refinements based on GPI feedback.

---

## Sub-Phase Map

```
2.1  Resource Check-In    ← New feature; depends on Phase 1 resources + exercises
2.2  Email Engine         ← New feature; uses Resend; depends on Phase 1 email list schema
2.3  Advanced PWA         ← Enhancement to Phase 1 task board
2.4  Cross-Exercise Reports ← Enhancement to Phase 1 report dashboard
```

---

## SPRINT 2-1 (Weeks 1–2): Resource Availability Check-In

**Sub-Phase:** 2.1  
**Primary Concern:** Allow exercise owners to send availability confirmation requests to all assigned resources before each exercise phase, track responses, and escalate non-responders automatically.

### Atomic Task List

#### 2.1.A — Data Layer
- [ ] **2.1.A.1:** Add `resource_checkins` Firestore collection schema under `tenants/{tenantId}/`
  ```
  Fields: id, tenantId, exerciseId, phaseId, resourceId, status,
  confirmationToken, invitedAt, deadlineAt, respondedAt, availabilityNotes,
  backupResourceId, createdAt, updatedAt
  Status enum: pending | confirmed | unavailable | no_response
  ```
- [ ] **2.1.A.2:** Write Firestore security rules for `resource_checkins` (read: admin/moderator; write: service account only; public token-based write via Cloud Function)
- [ ] **2.1.A.3:** Add Firestore index: `(tenantId, exerciseId, phaseId, status)`

#### 2.1.B — Backend API
- [ ] **2.1.B.1:** `POST /v1/exercises/:id/checkins/invite` — create check-in records and send invitation emails to all assigned resources for a phase (Moderator/Admin)
- [ ] **2.1.B.2:** `GET /v1/exercises/:id/checkins` — list check-in status for all resources across all phases
- [ ] **2.1.B.3:** `GET /v1/exercises/:id/checkins/summary` — aggregate: % confirmed per phase, non-responder list
- [ ] **2.1.B.4:** `GET /v1/checkins/:token` — fetch check-in form data (no auth, tokenized)
- [ ] **2.1.B.5:** `PATCH /v1/checkins/:token` — submit check-in response (no auth, tokenized); mark token as used after first submission (return 410 Gone on reuse)
- [ ] **2.1.B.6:** `PATCH /v1/checkins/:checkinId/backup` — assign backup resource when primary is unavailable (Moderator/Admin)

#### 2.1.C — Escalation Engine
- [ ] **2.1.C.1:** Create Cloud Tasks queue: `checkin-escalations`
- [ ] **2.1.C.2:** Schedule Cloud Tasks at invite time: T-24h, T-12h, T-4h, T-1h relative to exercise phase start
- [ ] **2.1.C.3:** Implement escalation worker: query non-responders, send reminder email via Resend, log escalation to audit
- [ ] **2.1.C.4:** Implement final escalation: T-1h generates summary email to exercise owner listing all unconfirmed resources

#### 2.1.D — Check-In UI (Mobile-Optimized)
- [ ] **2.1.D.1:** Build tokenized check-in page (`/checkin/:token`) — no login required; shows: resource name, exercise name, phase, date/time window; two large buttons: "✓ I'll be available" / "✗ I'm unavailable"; optional notes field; Submit button
- [ ] **2.1.D.2:** Build confirmation page: "Thank you, [name]. Your response has been recorded." with exercise details
- [ ] **2.1.D.3:** Build check-in status dashboard (Admin/Moderator): per-phase table showing each resource, status badge, response time, notes; non-responder list highlighted; send reminder button per resource

#### 2.1.E — Tests
- [ ] **2.1.E.1:** Integration test: tokenized check-in link works without auth
- [ ] **2.1.E.2:** Integration test: second confirmation attempt returns 410
- [ ] **2.1.E.3:** Integration test: escalation Cloud Task fires at correct time (mock Cloud Tasks)
- [ ] **2.1.E.4:** E2E test: resource receives email → clicks link → confirms availability → admin sees confirmed status

---

## SPRINT 2-2 (Weeks 2–4): Email Engine

**Sub-Phase:** 2.2  
**Primary Concern:** Full email communication system — contact lists, templates with variable substitution, scheduling, and delivery tracking.

### Atomic Task List

#### 2.2.A — Data Layer
- [ ] **2.2.A.1:** Finalize `email_lists`, `email_list_members`, `email_templates`, `email_schedules`, `email_deliveries` Firestore schema (stubs existed in Phase 1; now fully implement)
- [ ] **2.2.A.2:** Add Firestore indexes for email queries: `(tenantId, templateId, status)`, `(tenantId, scheduleId)`

#### 2.2.B — Email Delivery Worker
- [ ] **2.2.B.1:** Create Cloud Tasks queue: `email-delivery`
- [ ] **2.2.B.2:** Implement email delivery worker (`apps/worker/email-handler.ts`): dequeue task → fetch template → resolve recipient list → substitute variables → send via Resend SDK → write delivery record to Firestore
- [ ] **2.2.B.3:** Implement retry logic: on send failure, re-enqueue with 2× delay; max 3 attempts; mark failed after 3rd
- [ ] **2.2.B.4:** Implement `POST /v1/email/schedules/:id/send-now` — immediate send bypassing schedule (Admin)
- [ ] **2.2.B.5:** Implement Resend webhook handler at `POST /webhooks/resend` — update `email_deliveries` status on delivery/bounce events; validate `Resend-Signature` header

#### 2.2.C — Template Engine
- [ ] **2.2.C.1:** Implement variable substitution engine: replace `{{variable_name}}` in template HTML with values from exercise context (`exerciseName`, `startTime`, `recipientName`, `exerciseUrl`, `phase`, `direction`)
- [ ] **2.2.C.2:** Implement `POST /v1/email/templates/:id/preview` — render template with sample data, return HTML string for preview
- [ ] **2.2.C.3:** Implement relative schedule resolution: convert `{ relativeOffsetHours: -24, relativeAnchor: 'exercise_start' }` to absolute UTC datetime

#### 2.2.D — Email Management UI (Admin)
- [ ] **2.2.D.1:** Build `EmailListsPage`: table of lists, member count, create/edit/delete
- [ ] **2.2.D.2:** Build `EmailListDetailPage`: member table, add member form, CSV import, sync from exercise resources button
- [ ] **2.2.D.3:** Build `EmailTemplateEditor`: subject line input, HTML body textarea (with syntax highlighting), variable picker (insert `{{variable}}` chips), live preview panel (renders template HTML in iframe)
- [ ] **2.2.D.4:** Build `EmailSchedulePage`: list all schedules with status badges; create schedule modal (template, list(s), timing); cancel button for pending schedules
- [ ] **2.2.D.5:** Build `EmailDeliveryLog`: per-schedule delivery table (recipient, channel, status, timestamp, error if any)

#### 2.2.E — Tests
- [ ] **2.2.E.1:** Unit test: variable substitution handles missing variables gracefully (leaves placeholder vs. throws)
- [ ] **2.2.E.2:** Unit test: relative schedule time resolves correctly to absolute UTC
- [ ] **2.2.E.3:** Integration test: send email via Resend (use Resend test mode); verify delivery record created in Firestore
- [ ] **2.2.E.4:** Integration test: Resend bounce webhook updates delivery status to `bounced`
- [ ] **2.2.E.5:** Integration test: send to non-existent email → retry 3× → marked `failed`

---

## SPRINT 2-3 (Weeks 4–6): Advanced PWA Features

**Sub-Phase:** 2.3  
**Primary Concern:** Elevate the PWA to production quality — push notifications, background sync for offline task updates, and Lighthouse score ≥ 90.

### Atomic Task List

#### 2.3.A — Push Notifications
- [ ] **2.3.A.1:** Configure Firebase Cloud Messaging (FCM) in Firebase project (free, unlimited)
- [ ] **2.3.A.2:** Implement push subscription: on task board load, request notification permission; store FCM token in Firestore `users/{uid}.fcmToken`
- [ ] **2.3.A.3:** Implement push triggers in API: send FCM notification when user's task status is changed by someone else; when Go/No-Go is pending; when exercise starts
- [ ] **2.3.A.4:** Implement service worker `notificationclick` handler: clicking notification opens the relevant exercise board

#### 2.3.B — Background Sync (Offline Actions)
- [ ] **2.3.B.1:** Implement service worker Background Sync for offline task updates: queue status changes in IndexedDB when offline; sync when connection restores
- [ ] **2.3.B.2:** Implement conflict detection on sync: if server-side status differs from queued update, surface conflict UI (show "Server has: X. Your queued update: Y. Which to keep?")
- [ ] **2.3.B.3:** Implement offline notes queue: notes typed offline are queued and synced on reconnect

#### 2.3.C — PWA Quality
- [ ] **2.3.C.1:** Run Lighthouse audit on task board; achieve score ≥ 90 on PWA and Performance categories
- [ ] **2.3.C.2:** Implement `beforeinstallprompt` handler: capture prompt event, show custom "Add to Home Screen" banner on 3rd visit
- [ ] **2.3.C.3:** Add all Apple PWA meta tags: `apple-touch-icon` (all sizes), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
- [ ] **2.3.C.4:** Test and fix safe-area insets on iPhone notch models (use `env(safe-area-inset-*)` CSS)
- [ ] **2.3.C.5:** Implement `updateSW()` prompt: when a new service worker is waiting, show toast "Update available — tap to refresh"

---

## SPRINT 2-4 (Weeks 6–8): Cross-Exercise Analytics

**Sub-Phase:** 2.4  
**Primary Concern:** Add cross-exercise comparison reports, Lessons Learned capture, and team performance trend charts.

### Atomic Task List

#### 2.4.A — Data Layer
- [ ] **2.4.A.1:** Add `lessons_learned` Firestore collection: `{ id, tenantId, exerciseId, stageId, taskId, description, category, actionRequired, owner, dueDate, status }`
- [ ] **2.4.A.2:** Add Firestore index: `(tenantId, exerciseId, status)` for lessons learned

#### 2.4.B — Cross-Exercise Comparison API
- [ ] **2.4.B.1:** Implement `GET /v1/exercises/compare?ids=ex1,ex2,ex3` — returns side-by-side report data for up to 5 exercises
- [ ] **2.4.B.2:** Implement `GET /v1/exercises/trends` — returns team performance over time across all completed exercises for the tenant

#### 2.4.C — Lessons Learned
- [ ] **2.4.C.1:** `POST /v1/exercises/:id/lessons-learned` — create lesson (any authenticated user)
- [ ] **2.4.C.2:** `GET /v1/exercises/:id/lessons-learned` — list lessons for exercise
- [ ] **2.4.C.3:** `PUT /v1/lessons-learned/:id` — update lesson (owner or Admin/Moderator)

#### 2.4.D — UI Components
- [ ] **2.4.D.1:** Build `CrossExerciseComparisonPage`: exercise multi-selector (up to 5); side-by-side bar charts for duration and variance; summary comparison table
- [ ] **2.4.D.2:** Build `LessonsLearnedPanel` on report page: list of lessons with category tags, action items, status; add lesson form
- [ ] **2.4.D.3:** Build `TeamPerformanceTrends` chart: line chart showing avg variance per team across exercises over time

---

## Phase 2 Exit Criteria

- [ ] Resource check-in invitations sent and tokenized links work without login
- [ ] Escalation emails fire at T-24h, T-12h, T-4h, T-1h from exercise phase start
- [ ] Email templates render variable substitution correctly
- [ ] Scheduled emails deliver via Resend; delivery status tracked in Firestore
- [ ] Push notifications received on iOS and Android for task assignment + Go/No-Go alerts
- [ ] Offline task status update syncs to server on reconnect
- [ ] PWA Lighthouse score ≥ 90 on Performance and PWA categories
- [ ] Cross-exercise comparison report renders side-by-side for 2+ exercises
- [ ] Lessons Learned can be captured and tracked through to resolution
