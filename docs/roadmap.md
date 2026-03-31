# roadmap.md — ResiliPath Platform
**Version:** 0.2.0  
**Date:** 2026-03-29  
**Status:** DRAFT — pending stakeholder Q&A completion  

---

## EXECUTIVE SUMMARY

ResiliPath is delivered in **5 phases** across approximately **10 weeks (MVP) + ongoing modules** from confirmed requirements to full platform GA. Each phase delivers shippable, production-capable value. The roadmap assumes an agile delivery model with 2-week sprints.

> ⚠️ **NOTE:** Timeline confirmed. MVP launch: **May 1, 2026**. Stack: GCP/Firebase/Vercel free tier. See `docs/journal/` for the full question bank.

---

## PHASE OVERVIEW

| Phase | Name | Duration | Key Deliverables | Modules |
|-------|------|----------|------------------|---------|
| 0 | Foundation & Infrastructure | 6 weeks | Platform skeleton, auth, multi-tenancy, CI/CD, design system | Core |
| 1 | DR Exercise Manager MVP | 10 weeks | All 6 data tables, RBAC, task board UI, basic reporting | Module 1 |
| 2 | DR Exercise Manager GA | 8 weeks | Resource check-in, email engine, advanced reporting, PWA, evidence | Module 1 |
| 3 | BCP Plan Manager MVP | 12 weeks | Facility BCP creation, BIA engine, tabletop exercise runner | Module 2 |
| 4 | Crisis Communications Manager | 10 weeks | Mass notification, contact trees, communication logs | Module 3 |
| 5 | Platform Maturation & Scale | Ongoing | BIA Engine, Vendor Resilience, Compliance Tracker, AI Plan Gen | Modules 4–10 |

---

## PHASE 0 — Foundation & Infrastructure
**Duration:** 6 weeks  
**Goal:** Build the platform skeleton that all modules will run on.

### Deliverables
- [ ] Infrastructure-as-code provisioning (cloud environment, networking, storage)
- [ ] Multi-tenant data architecture (tenant isolation, tenant provisioning API)
- [ ] Authentication & Authorization service (OIDC, JWT, RBAC framework)
- [ ] Core API gateway and BFF scaffolding
- [ ] CI/CD pipeline (lint → test → build → deploy → smoke test)
- [ ] Secrets management integration
- [ ] Logging, monitoring, alerting baseline (error tracking, APM)
- [ ] Design system foundations (color tokens, typography, Skeuomorphic component library baseline)
- [ ] Tenant onboarding flow (sign-up, workspace creation, initial admin setup)
- [ ] Developer environment documentation and local setup automation

### Milestone Gate
✅ A new tenant can register, log in with MFA, and access an empty workspace. CI/CD deploys to staging on every merge to main.

---

## PHASE 1 — DR Exercise Manager MVP
**Duration:** 10 weeks  
**Goal:** Replace the Excel runbook with a functional, data-accurate, RBAC-controlled DR exercise management application.

### Deliverables
- [ ] **Data Model:** All 6 tables implemented with full field set
  - Exercise, Stage, Task, Resource, Team, Vendor
- [ ] **Backend API:** Full CRUD for all entities with tenant scoping and RBAC enforcement
- [ ] **Sample Data:** Comprehensive seed data drawn from Excel runbook analysis (CFIN, HCM exercise data)
- [ ] **Backend UI (Admin):** Full management interface for all entities
- [ ] **Front-End Task Board:** Sequential task list, grouped by stage, sorted by Task ID
  - Real-time status updates (WebSocket)
  - Role-aware editing (User edits own tasks; Moderator edits all)
- [ ] **RBAC:** Admin, Moderator, User, Report roles fully enforced
- [ ] **Exercise Phases:** Mock 1, Mock 2, Mock 3 (conditional), Production phase structure
- [ ] **Stage Management:** Pre-Failover, Failover, Post-Failover, Failover-Rollback, Pre-Failback, Failback, Post-Failback, Failback-Rollback with proper activation rules
- [ ] **Duration Calculations:** Actual Duration (auto-calc), Variance Duration (auto-calc), Forecast Duration
- [ ] **Go/No-Go Gates:** Enforced at API level
- [ ] **Basic Report Dashboard:**
  - Exercise Actual vs. Estimated Duration
  - Per-stage duration breakdown
  - Variance analysis per task and stage
- [ ] **Export:** PDF and XLSX report export
- [ ] **Evidence Upload:** Photo/file attachment to tasks

### Milestone Gate
✅ A full Mock 1 DR exercise can be created, run, and reported on entirely within the platform. Excel is not needed.

---

## PHASE 2 — DR Exercise Manager GA
**Duration:** 8 weeks  
**Goal:** Complete the DR Exercise module with all production-grade features.

### Deliverables
- [ ] **Resource Availability Check-In:** Pre-exercise check-in flow for each phase, with automated notifications for missing check-ins
- [ ] **Email Engine:**
  - Email list management
  - Email template builder (with variable substitution)
  - Email list assignment to templates
  - Scheduled email delivery
  - Delivery log (sent, failed, retried)
- [ ] **PWA:** Install-as-app, offline read access to assigned tasks, push notifications
- [ ] **Advanced Reporting:**
  - Cross-exercise comparison (Mock 1 vs Mock 2 vs Prod)
  - Team performance analytics
  - Resource utilization views
  - Lessons Learned capture and tracking
- [ ] **Runbook Import:** CSV/XLSX import wizard to seed exercise tasks from existing spreadsheets
- [ ] **White-label:** Tenant-configurable branding (logo, color scheme, domain CNAME)
- [ ] **SSO Integration:** SAML 2.0 for Enterprise tier
- [ ] **Audit Log UI:** Admin view of all audit log entries
- [ ] **Performance:** Load testing at 200 concurrent exercise participants; all task board updates < 500ms p95

### Milestone Gate
✅ The DR Exercise Manager is feature-complete and production-ready. First paying customers onboarded.

---

## PHASE 3 — BCP Plan Manager MVP
**Duration:** 12 weeks  
**Goal:** Enable organizations to create, maintain, and rehearse Business Continuity Plans digitally, replacing Word documents.

### Deliverables
- [ ] **Facility Profile:** Facility data model (name, address, type, sector, regulatory context)
- [ ] **BCP Document Builder:**
  - Section-by-section interview workflow (guided prompts)
  - Rich-text section editor
  - Template library (manufacturing, healthcare, financial services, logistics, general)
  - Auto-generated BCP document export (PDF, DOCX)
  - Version control (BCP version history, change tracking)
- [ ] **BCM Team Management:** BCP team, Crisis Management team composition
- [ ] **BIA Engine (MVP):**
  - Risk inventory
  - Severity × Probability matrix
  - Criticality scoring
  - RTO/RPO target assignment per process
  - Contingency plan linkage
- [ ] **Contingency Plan Builder:** Per-risk scenario contingency plans with step-by-step procedures
- [ ] **Contact Directory:** Emergency contacts (internal, external, regulatory, community)
- [ ] **Tabletop Exercise Engine (MVP):**
  - Create scenario (fire, flood, cyber breach, etc.)
  - Inject scenario "injects" at timed intervals during exercise
  - Participant response capture
  - After-Action Report generation
- [ ] **Implementation Checklist:** Digital version of BCP implementation checklist with completion tracking
- [ ] **Annual Review Workflow:** Scheduled review reminders, review sign-off, change documentation

### Milestone Gate
✅ A manufacturing facility can create a complete BCP, run a tabletop exercise, and export a professional BCP document.

---

## PHASE 4 — Crisis Communications Manager
**Duration:** 10 weeks  
**Goal:** Enable real-time, multi-channel mass notifications during a declared crisis.

### Deliverables
- [ ] **Contact Group Management:** Employees, vendors, contractors, government bodies, regulatory agencies
- [ ] **Notification Channels:** Email, SMS, push notification, in-app alert, voice call (via Twilio or equivalent)
- [ ] **Message Templates:** Pre-authored crisis communication templates per scenario type
- [ ] **Cascade/Tree Notifications:** Notification trees (notify managers → they confirm → cascade to teams)
- [ ] **Acknowledgement Tracking:** Read receipts, confirmation responses, escalation for non-responses
- [ ] **Incident Declaration:** Formal incident declaration workflow with authority levels
- [ ] **Communication Log:** Full audit trail of all messages sent/received during incident
- [ ] **Two-Way Messaging:** Reply capture, safety check-in responses
- [ ] **Regulatory Notification Templates:** OSHA, EPA, FDA, SEC, and other agency-specific templates
- [ ] **Integration:** Slack/Teams webhook notifications

### Milestone Gate
✅ A crisis communication can be declared, stakeholders notified across 3 channels, and acknowledgements tracked in real-time.

---

## PHASE 5 — Platform Maturation & Scale (Ongoing)
**Duration:** Ongoing (quarterly releases)

### Module Backlog (Priority Order)
1. **Business Impact Analysis Engine (Full)** — Expanded BIA with automated criticality scoring, dependency mapping, financial impact modeling
2. **Vendor & Supply Chain Resilience** — Vendor risk registry, SLA tracking, alternate sourcing
3. **Regulatory & Compliance Tracker** — ISO 22301, NIST 800-34, DRII GPG maturity assessments
4. **Incident & Event Manager** — Structured incident lifecycle management
5. **Employee Wellness Check-In** — Crisis headcount and safety status
6. **Asset & Technology Inventory** — Application dependency mapping, CMDB-lite
7. **AI-Assisted Plan Generation** — LLM-driven BCP/DR plan drafting from interview data
8. **Marketplace** — Community templates, industry packs, partner integrations

---

## TECHNOLOGY DECISIONS (Provisional — Pending Stakeholder Confirmation)

| Layer | Candidate Options | Decision Status |
|-------|------------------|-----------------|
| Cloud Provider | AWS, Azure, GCP | ❓ TBD |
| Backend Language | Node.js (TypeScript), Go, Python | ❓ TBD |
| Frontend Framework | React + Vite, Next.js | ❓ TBD |
| Database (Primary) | PostgreSQL | Likely |
| Database (Cache) | Redis | Likely |
| Real-Time | WebSockets (via Socket.io or native) | Likely |
| Email Service | SendGrid, AWS SES, Postmark | ❓ TBD |
| File Storage | S3-compatible object storage | Likely |
| Auth Provider | Auth0, AWS Cognito, Supabase Auth | ❓ TBD |
| Observability | Datadog, New Relic, OpenTelemetry | ❓ TBD |
| CI/CD | GitHub Actions, GitLab CI | ❓ TBD |

---

## DEPENDENCY MAP

```
Phase 0 (Foundation)
    ↓
Phase 1 (DR MVP)
    ↓
Phase 2 (DR GA) ←→ Phase 3 (BCP MVP) [parallel development OK]
    ↓
Phase 4 (Crisis Comms) [depends on contact model from Phase 3]
    ↓
Phase 5 (Maturation) [continuous]
```
