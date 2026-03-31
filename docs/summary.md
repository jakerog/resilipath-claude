# summary.md — ResiliPath Platform PRD Suite
**Version:** 0.2.0  
**Date:** 2026-03-29  
**Status:** DRAFT — Awaiting stakeholder responses to Question Bank  

---

## What This Document Is

This is the master summary and navigation guide for the ResiliPath PRD (Product Requirements Documentation) suite. It provides a quick-reference overview of all documents, key decisions, and current status.

---

## Platform in One Paragraph

**ResiliPath** is a multi-tenant, subscription-based SaaS platform that digitizes, automates, and continuously improves Business Continuity Management and Disaster Recovery programs for enterprises across all industries. It replaces Excel runbooks, Word documents, and disconnected tools with a purpose-built, real-time, role-aware, evidence-capturing operational environment. The platform ships as a suite of independently licensable modules — starting with a **DR Exercise Manager** (replace the Excel runbook process) and followed by a **BCP Plan Manager** (replace Word document BCPs and manual tabletop exercises).

---

## Document Index

**Core Documents**

| Document | Purpose | Status |
|----------|---------|--------|
| `AGENTS.md` | Agent roster, communication protocol | DRAFT |
| `docs/mandates.md` | Non-negotiable platform constraints and requirements | DRAFT |
| `docs/rules.md` | Data, business logic, engineering, UX, security rules | DRAFT |
| `docs/roadmap.md` | 5-phase platform delivery roadmap | DRAFT |
| `docs/compliance.md` | ISO 22301, NIST, SOC 2, GDPR, CCPA mapping | DRAFT |
| `docs/competitive-analysis.md` | Competitive landscape, ICP, pricing model | DRAFT |

**Architecture Decision Records**

| Document | Decision | Status |
|----------|---------|--------|
| `docs/adr/ADR-001-multitenancy.md` | Hybrid schema+database isolation model | PROPOSED |
| `docs/adr/ADR-002-realtime.md` | WebSocket (exercise) + SSE (dashboards) | PROPOSED |
| `docs/adr/ADR-003-auth.md` | Auth0 + custom RBAC layer | PROPOSED |

**Technical Specifications**

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/data-model/schema.md` | Complete database schema — 30+ tables | DRAFT |
| `docs/api/contracts.md` | ~85 API endpoints, request/response formats | DRAFT |
| `docs/ux/design-spec.md` | Color system, typography, components, PWA | DRAFT |

**Phase Plans**

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/phases/0.summary.md` | Phase 0: Foundation & Infrastructure — overview | DRAFT |
| `docs/phases/0.tasklist.md` | Phase 0: Foundation — 65+ tasks | DRAFT |
| `docs/phases/1.summary.md` | Phase 1: DR Exercise Manager MVP — overview | DRAFT |
| `docs/phases/1.tasklist.md` | Phase 1: DR Exercise Manager — 90+ tasks | DRAFT |
| `docs/phases/2.summary.md` | Phase 2: DR Exercise Manager GA — overview | DRAFT |
| `docs/phases/2.tasklist.md` | Phase 2: DR GA — 50+ tasks | DRAFT |
| `docs/phases/3.summary.md` | Phase 3: BCP Plan Manager — overview | DRAFT |
| `docs/phases/3.tasklist.md` | Phase 3: BCP Plan Manager — 65+ tasks | DRAFT |
| `docs/phases/4.summary.md` | Phase 4: Crisis Communications Manager | DRAFT |
| `docs/phases/4.tasklist.md` | Phase 4: Crisis Comms — 50+ tasks | DRAFT |
| `docs/phases/5.summary.md` | Phase 5: Platform Maturation (quarterly) | DRAFT |
| `docs/phases/5.tasklist.md` | Phase 5: Reference stub | DRAFT |

**Journal**

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/journal/2026-03-29T000000Z.md` | Session 1: discovery, PRD creation, 90-question bank | COMPLETE |
| `docs/journal/2026-03-29T060000Z.md` | Session 2: phases 4-5, ADRs, schema, API, UX, compliance | COMPLETE |

---

## Source Material Processed

| File | Type | Key Insights |
|------|------|-------------|
| `Prod_Failover_-_Runbook_CFIN_DR.xlsx` | Excel runbook | 7 sheets, 4 exercises, 86–104 tasks/exercise, 20+ teams, 50+ named resources, 21 column data model |
| `GPI_Business_Continuity_Plan_v2_0_2025-12-10.docx` | BCP Template | 11 sections, 10 emergency scenarios, manufacturing facility model, ISO 22301 aligned |

---

## Current Platform Scope

### Module 1: DR Exercise Manager
- Replaces: Excel runbook + email chains + phone bridges
- Core entities: Exercise, Stage, Task, Resource, Team, Vendor
- Key workflows: Exercise creation → Resource assignment → Phase scheduling → Resource check-in → Live task execution → Reporting
- Key differentiators: Real-time task board, predecessor enforcement, rollback activation, Go/No-Go gates, evidence capture, cross-exercise analytics

### Module 2: BCP Plan Manager & Tabletop Engine
- Replaces: Word documents + SharePoint folders + manual tabletop facilitation
- Core entities: Facility, BCP Plan, BCP Section, BIA Assessment, Risk, Contingency Plan, Tabletop Exercise
- Key workflows: Interview-driven BCP creation → Document generation → Annual review cycle → Tabletop exercise → After-Action Report

### Module 3: Crisis Communications Manager (Planned)
- Replaces: Email blasts, phone trees, manual stakeholder notification
- Core entities: Contact Groups, Message Templates, Notification Events, Acknowledgement Records
- Key workflows: Incident declaration → Multi-channel notification → Acknowledgement tracking → Communication log

### Modules 4–10: Platform Maturation (Planned)
BIA Engine, Vendor Resilience, Compliance Tracker, Incident Manager, Employee Wellness, Asset Inventory, AI Plan Generation

---

## Critical Open Questions Summary (from Question Bank)

The full question bank is in `docs/journal/2026-03-29T000000Z.md`. High-priority items:

1. **Who is the first customer / design partner?** (drives timeline and feature priority)
2. **What is the development budget?** (determines team size and timeline realism)
3. **Cloud provider preference?** (GPI is Azure-heavy — Azure likely preferred)
4. **Is Resource Check-In MVP or Phase 2?** (described as the "biggest issue")
5. **Task status: add "Failed" and "Delayed"?** (present in Excel but not in spec)
6. **Gantt/forecast scheduler needed in Phase 1?** (Excel already had forecast columns)
7. **Should Optional tasks be activatable by Moderator during exercise?**
8. **"Observer" role needed?** (executive stakeholder monitoring without editing)
9. **SMS notifications needed?** (for resource check-in / exercise alerts)
10. **Module 3 urgency?** (Crisis Communications is operationally critical)

---

## Assumptions Explicitly NOT Made

The following are common assumptions that have been DELIBERATELY left open for stakeholder confirmation:

- No technology stack assumed
- No cloud provider assumed
- No pricing tier structure assumed
- No launch date assumed
- No specific regulatory compliance requirement assumed (HIPAA, FedRAMP)
- No integration priority assumed (ServiceNow, Jira, PagerDuty, etc.)
- No minimum viable feature set finalized without stakeholder confirmation

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0-DRAFT | 2026-03-29 | AGENT-001/003/004 | Initial creation from source document discovery |

---

## Session 4 Additions (Stack Revision + Phase 1 Refactor)

**New Phase 1 Sub-Phase Documents (7 files):**
| File | Purpose |
|------|---------|
| `docs/phases/phase-1/1.0-environment-setup.md` | GCP/Firebase/Vercel setup checklist |
| `docs/phases/phase-1/1.1-data-layer.md` | Firestore schema, security rules, seed — 32 tasks |
| `docs/phases/phase-1/1.2-auth-rbac.md` | Firebase Auth, JWT claims, RBAC middleware — 28 tasks |
| `docs/phases/phase-1/1.3-core-api.md` | REST endpoints, state machines, import — 56 tasks |
| `docs/phases/phase-1/1.4-realtime.md` | Firebase Realtime DB, DR Bridge, presence — 24 tasks |
| `docs/phases/phase-1/1.5-admin-ui.md` | Design system + admin screens — 42 tasks |
| `docs/phases/phase-1/1.6-task-board.md` | Live exercise board, PWA, Go/No-Go — 46 tasks |
| `docs/phases/phase-1/1.7-reports.md` | Report dashboard, PDF/XLSX, GPI demo — 32 tasks |

**New ADRs:**
| File | Decision |
|------|---------|
| `docs/adr/ADR-008-firestore-patterns.md` | 10 Firestore coding patterns (batch reads, transactions, dual-write, etc.) |
| `docs/adr/ADR-009-error-handling.md` | Unified error code registry (60+ codes) + Hono.js implementation |

**New Sprint Plan:**
| File | Purpose |
|------|---------|
| `docs/sprints/phase2-sprint-plan.md` | Phase 2: Resource Check-In, Email Engine, Advanced PWA, Cross-Exercise Analytics |

**Updated Documents:**
- `docs/mandates.md` v0.2.0 — ResiliPath, GCP/Firebase free tier, May 1 launch target
- `docs/phases/1.summary.md` — New 7 sub-phase overview
- `docs/adr/ADR-004-stack.md` v0.2.0 — Hono + Firestore + Firebase Auth + Realtime DB
- `docs/roadmap.md` — May 1 date, ResiliPath name
- `docs/rules.md` — ResiliPath name, Firestore terminology

**Cumulative PRD Metrics:**
- Total files: 49
- Total lines: ~9,000+
- Atomic tasks defined (Phase 1): 260 across 7 sub-phases
- ADRs: 9
- Error codes registered: 60+
