# rules.md — ResiliPath Platform
**Version:** 0.2.0  
**Date:** 2026-03-29  
**Status:** UPDATED — GCP/Firebase stack; stakeholder answers incorporated  

---

## PURPOSE
This document defines the governing rules, engineering standards, data rules, and behavioral constraints that ALL contributors to the ResiliPath platform must follow. These rules are non-negotiable unless explicitly overridden by an Architecture Decision Record (ADR) approved by the Platform Architect.

---

## 1. DATA RULES

### DR-001: Tenant Isolation
Every Firestore document is nested under `tenants/{tenantId}/` collections. All service layer queries are scoped to the calling user's tenantId from their JWT claims. Cross-tenant access is additionally blocked by Firestore Security Rules. Failing either enforcement is a P0 security incident. Failing to enforce this rule is a P0 security incident.

### DR-002: Exercise Independence
Each DR Exercise is an independent data container. Resources, Teams, Vendors, and Tasks associated with Exercise A are copies, not shared references to Exercise B. This enables:
- Independent reporting per exercise
- Modification of resources/tasks for one exercise without affecting another
- Historical preservation of all exercise data

### DR-003: Audit Log Immutability
Audit log documents are append-only. No update or delete is ever issued against the audit_logs Firestore collection. Firestore Security Rules deny all writes except via the server-side Admin SDK. Denying delete on audit_logs is enforced at the rules level.

### DR-004: Time Storage
All datetime values are stored as UTC in the database. Timezone conversion happens at the presentation layer only. Exercise Start/End dates display in the configured timezone of the tenant.

### DR-005: Duration Calculations
`Actual Duration` = `End Time` - `Start Time` (calculated field, never stored as a raw input).  
`Variance Duration` = `Actual Duration` - `Estimated Time` (calculated field).  
These values MAY be cached for reporting performance, but the source of truth is always the start/end timestamps.

### DR-006: Status Transitions
Task status follows a defined state machine. Valid transitions:
- `Not-Started` → `In-Progress`
- `In-Progress` → `Completed`
- `In-Progress` → `Not-Started` (moderator/admin rollback only)
- Completed tasks cannot be moved backward by a User role — only Moderator or Admin

Exercise status state machine:
- `Planned` → `In-Progress`
- `In-Progress` → `On-Hold`
- `In-Progress` → `Completed`
- `In-Progress` → `Cancelled`
- `On-Hold` → `In-Progress`
- `Planned` → `Cancelled`

### DR-007: Rollback Stage Activation
Rollback stages (`Failover-Rollback`, `Failback-Rollback`) are LOCKED by default. A Rollback stage is only activatable when the preceding stage has at least one task marked as `Failed` or when a Moderator/Admin explicitly triggers rollback mode. This activation must create an audit log entry.

### DR-008: Phase Progression
A DR exercise progresses through phases (Mock 1 → Mock 2 → Mock 3 [conditional] → Production). Mock 3 is conditionally created based on Go/No-Go outcome of Mock 2. The system MUST enforce this — a Production phase CANNOT be created unless the preceding Mock phase(s) are in `Completed` status (or explicitly overridden by Admin with audit justification).

### DR-009: Evidence Integrity
Evidence uploads (photos, screenshots) are stored with a checksum (SHA-256) recorded at upload time. Evidence files are never deleted once associated with a completed task — they are soft-deleted or archived. Deletion requires Admin role and creates an audit record.

### DR-010: Email Delivery
Scheduled email delivery is idempotent. If a scheduled email fails to send, it is retried up to 3 times with exponential backoff. All send attempts (success or failure) are logged. Email template previews must render in a sandboxed environment and MUST NOT execute arbitrary scripts.

---

## 2. BUSINESS LOGIC RULES

### BL-001: Go/No-Go Gates
Go/No-Go decision tasks are special task types. They require explicit sign-off by a Moderator or Admin. Until a Go/No-Go task is marked `Completed` (approved), no subsequent Sequential tasks in the same stage can begin. This is enforced at the API level, not just the UI.

### BL-002: Resource Check-In
For each phase of a DR exercise, each assigned resource MUST complete a Resource Availability Check-In within a configurable window before the scheduled exercise start time. If a resource has not checked in within X hours of exercise start (configurable), the system automatically notifies the exercise owner and the resource's team lead.

### BL-003: Sequential vs. Parallel Tasks
- `Sequential` tasks MUST be completed in predecessor order. A sequential task MAY NOT be started until all its predecessors are `Completed`.
- `Parallel` tasks within a stage MAY be started concurrently, regardless of other parallel tasks' status, as long as their specific predecessors (if any) are satisfied.
- A parallel group's stage is considered complete only when ALL tasks in that stage are `Completed`.

### BL-004: Role Permissions Matrix

| Action | Admin | Moderator | User | Report |
|--------|-------|-----------|------|--------|
| Create/Edit Exercise | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Teams | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Resources | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Vendors | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Tasks (backend) | ✅ | ❌ | ❌ | ❌ |
| Edit ALL tasks (front-end, live) | ✅ | ✅ | ❌ | ❌ |
| Edit OWN tasks (front-end, live) | ✅ | ✅ | ✅ | ❌ |
| Upload Evidence | ✅ | ✅ | ✅ | ❌ |
| Add Notes | ✅ | ✅ | ✅ | ❌ |
| View Report Dashboard | ✅ | ✅ | ❌ | ✅ |
| Manage Email Lists/Templates | ✅ | ❌ | ❌ | ❌ |
| Activate Rollback Stage | ✅ | ✅ | ❌ | ❌ |
| Resource Check-In | ✅ | ✅ | ✅ | ❌ |
| Manage Users/Roles | ✅ | ❌ | ❌ | ❌ |
| Delete Records | ✅ | ❌ | ❌ | ❌ |

### BL-005: Task ID Ordering
The front-end task list MUST always display tasks sorted ascending by `Task ID`, grouped by stage in the order: Pre-Validations → [Event Direction] → Application Shutdown → Cutover → System Validations → Post Validations → Rollback (if activated).

### BL-006: Multi-Resource Task Assignment
When a task has `Resource Allocation = Multiple`, multiple resources can be assigned. Any one of the assigned resources may update the task status. The "last writer wins" model applies to Notes. Evidence is additive (all uploads retained).

### BL-007: Vendor Classification
Vendors are classified as `Internal` or `External`. Internal vendors are company business units/departments acting as service providers. External vendors are third-party organizations. This classification affects reporting and communication templates.

---

## 3. ENGINEERING RULES

### ENG-001: API-First Design
Every feature must be backed by a documented API endpoint before any UI is built for it. The API is the product; the UI is a client of the API.

### ENG-002: No Direct Database Access from Front-End
The front-end application NEVER directly queries the database. All data access goes through the API gateway or BFF (Backend For Frontend) layer.

### ENG-003: Input Validation
All user inputs are validated at both the front-end (UX feedback) and back-end (security enforcement). Back-end validation is authoritative. Front-end validation is courtesy.

### ENG-004: Idempotent APIs
Mutating API endpoints (POST, PUT, PATCH, DELETE) MUST be idempotent where possible. Use client-generated idempotency keys for critical operations (task status updates, exercise phase transitions).

### ENG-005: Pagination
All list endpoints MUST support cursor-based pagination. No list endpoint returns more than 500 records in a single response without explicit pagination parameters.

### ENG-006: Error Handling
All API errors return a structured JSON response: `{ "error": { "code": "ERR_CODE", "message": "Human-readable", "details": {...} } }`. HTTP status codes are used correctly (4xx for client errors, 5xx for server errors).

### ENG-007: Feature Flags
New features MUST be deployed behind feature flags. Features are enabled per-tenant, not platform-wide, until promoted to GA. This enables controlled rollout and emergency rollback.

### ENG-008: Database Migrations
All database schema changes MUST be applied via versioned migrations. Migrations MUST be backward-compatible (additive-only in production; destructive changes require a multi-step migration plan).

### ENG-009: Secrets Management
No secrets, credentials, API keys, or connection strings are ever committed to source control. All secrets are managed via a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager, or equivalent).

### ENG-010: Dependency Management
All third-party dependencies are pinned to exact versions in production builds. Dependency updates are automated (e.g., Dependabot) and reviewed before merge.

---

## 4. UX/DESIGN RULES

### UX-001: Skeuomorphic Design Language
The platform uses a skeuomorphic design language: tactile buttons, realistic depth/shadow, card-based task boards that feel like physical runbook pages, status indicators that resemble physical badge indicators. Reference: iOS pre-7 aesthetic adapted for professional operations tools.

### UX-002: Mobile-First, PWA-Capable
All UI components are designed for mobile-first viewports. The app installs as a PWA. Offline mode provides read-only access to the user's assigned tasks for the active exercise.

### UX-003: Color-Coded Status System
Task statuses have a consistent, accessible color system throughout the platform:
- `Not-Started`: Grey (#6B7280)
- `In-Progress`: Amber (#D97706)
- `Completed`: Green (#059669)
- `Failed`: Red (#DC2626)
- `Optional`: Blue (#2563EB)
- `Blocked` (predecessor not met): Purple (#7C3AED)

All colors must pass WCAG 2.1 AA contrast ratio requirements.

### UX-004: Real-Time Updates
During an active exercise, the front-end task board MUST update in real-time (WebSocket or SSE) without requiring page refresh. Optimistic UI updates are used for low-latency UX.

### UX-005: Evidence Upload UX
Evidence uploads from mobile MUST support direct camera capture (not just file picker). Accepted formats: JPEG, PNG, PDF, MP4 (for screen recordings). Max file size: 50MB per upload. Progress indicator required.

### UX-006: Accessibility
Platform MUST meet WCAG 2.1 Level AA. All interactive elements must be keyboard-navigable. Screen reader support is required for core task management flows.

---

## 5. SECURITY RULES

### SEC-001: Authentication
Authentication uses industry-standard protocols (OIDC/OAuth 2.0). Support for SSO via SAML 2.0 is required for Enterprise tier. MFA is required for Admin and Moderator roles.

### SEC-002: Authorization
Every API request validates the requesting user's role and tenant membership before executing any operation. Authorization checks happen at the service layer, not just the route/controller layer.

### SEC-003: Session Management
Sessions expire after 8 hours of inactivity (configurable by tenant admin, up to 24 hours max). Active exercise sessions may be configured to extend to 12 hours without interruption.

### SEC-004: File Upload Security
All uploaded files are scanned for malware before being stored or made accessible. File type validation uses magic bytes (not just extension). Uploaded files are stored in isolated tenant-scoped storage buckets.

### SEC-005: Rate Limiting
All public and authenticated API endpoints are rate-limited. Authentication endpoints have stricter limits. Rate limit responses return `429 Too Many Requests` with a `Retry-After` header.

### SEC-006: Penetration Testing
The platform undergoes a third-party penetration test before each major version release and at least annually post-GA.

---

## 6. DOCUMENTATION RULES

### DOC-001: Every feature requires a PR description, API documentation update, and user-facing help article before merge to main.

### DOC-002: Architecture decisions are captured as ADRs (Architecture Decision Records) in `docs/adr/`. Once accepted, an ADR is immutable (new ADRs supersede old ones, never edit in place).

### DOC-003: The journal (`docs/journal/`) is updated with a timestamped entry for every significant decision, discovery, or milestone.

### DOC-004: All PRD documents carry a version number and status (DRAFT, IN-REVIEW, APPROVED, SUPERSEDED).
