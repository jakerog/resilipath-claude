# Phase 0 Sprint Plan — Foundation & Infrastructure
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Duration:** 3 × 2-week sprints = 6 weeks  
**Status:** DRAFT  

---

## Sprint Overview

| Sprint | Focus | Key Deliverable |
|--------|-------|----------------|
| S0-1 | Repo + CI/CD + Auth + Infra | Working monorepo, CI passes, a developer can log in |
| S0-2 | Multi-tenancy + DB + Core API scaffold | Tenant provisioning works; schema isolation verified |
| S0-3 | Design system + Onboarding + Observability | New tenant can self-sign-up; monitoring active |

---

## SPRINT 0-1 — Monorepo, CI/CD, Auth, Base Infrastructure (Week 1–2)

### S0-1-1: Monorepo Setup (2 points)
- [ ] Create GitHub repository with branch protection (`main` requires PR + CI pass + 1 review)
- [ ] Initialize pnpm workspaces + Turborepo config
- [ ] Create workspace packages: `apps/api`, `apps/web`, `apps/worker`, `packages/shared-types`, `packages/db`, `packages/rbac`, `packages/config`
- [ ] Configure shared TypeScript config (`tsconfig.base.json`)
- [ ] Configure shared ESLint + Prettier
- [ ] `pnpm install` + `turbo build` succeeds from root in < 60 seconds

### S0-1-2: CI/CD Pipeline (3 points)
- [ ] GitHub Actions workflow: `lint` → `typecheck` → `unit-test` → `build` → `staging-deploy` on merge to main
- [ ] PR checks workflow: `lint` → `typecheck` → `unit-test` (runs on every PR)
- [ ] Semgrep SAST scan on every PR (blocks merge on critical findings)
- [ ] `pnpm audit --audit-level=high` on every PR (blocks merge on high CVEs)
- [ ] Build produces Docker images for `api`, `web`, `worker`
- [ ] Docker images pushed to container registry
- [ ] Staging deploy: `kubectl set image` rolling update with health check gate
- [ ] Smoke test job runs after staging deploy; marks deploy failed if smoke fails
- [ ] Slack notification on deploy success/failure

### S0-1-3: Cloud Infrastructure — Staging (3 points)
- [ ] Terraform workspace for staging environment (or Pulumi — ADR needed if not Terraform)
- [ ] VPC, subnets (public/private), NAT gateway
- [ ] Kubernetes cluster (EKS/AKS) with node auto-scaling
- [ ] PostgreSQL managed instance (16, Multi-AZ) with private endpoint
- [ ] Redis cluster (6 nodes) with private endpoint
- [ ] S3 bucket (or Azure Blob) with versioning + public access blocked
- [ ] Application Load Balancer with HTTPS termination + TLS 1.3
- [ ] DNS zone + wildcard certificate (ACM or Azure DNS)
- [ ] All infrastructure in code (IaC) — no manual console changes

### S0-1-4: Authentication Integration (4 points)
- [ ] Auth0 tenant created; applications configured (SPA + Machine-to-Machine)
- [ ] Fastify app with JWT validation middleware
- [ ] `POST /auth/login` → returns Auth0 access token (via Auth0 Management API)
- [ ] `POST /auth/refresh` → refreshes access token
- [ ] `GET /auth/me` → returns current user profile from JWT claims
- [ ] CORS configured (allow `*.resilienceos.com` + `localhost:3000`)
- [ ] Login page in React (email/password form → Auth0 redirect)
- [ ] Post-login redirect to dashboard
- [ ] Engineer can register, log in, and see "Hello, [name]" on screen

### S0-1-5: Secrets Management (1 point)
- [ ] AWS Secrets Manager (or Azure Key Vault) provisioned
- [ ] All secrets (DB password, Redis URL, Auth0 client secret) stored in secrets manager
- [ ] Application reads secrets from secrets manager at startup — no `.env` in production
- [ ] Local dev: `.env.local` with dev-only values (gitignored, documented in `.env.example`)

**Sprint 0-1 Total: ~13 points**

---

## SPRINT 0-2 — Multi-Tenancy, Database, API Scaffold (Week 3–4)

### S0-2-1: Multi-Tenancy Architecture (5 points)
- [ ] `tenants` and `users` tables in shared schema
- [ ] `TenantConnectionResolver` service: looks up tenant → returns schema name + connection
- [ ] `provisionTenantSchema(tenantId)` function: `CREATE SCHEMA tenant_{id}; RUN MIGRATIONS`
- [ ] ORM context: Drizzle `db.$withSchema(schema)` applied on every repository call
- [ ] Integration test: Tenant A data not visible to Tenant B (100% isolation verified)
- [ ] Integration test: Cross-tenant IDOR via API returns 404 (not 403 — don't leak existence)
- [ ] PgBouncer connection pooler configured (transaction mode)
- [ ] Redis tenant resolver cache: tenant ID → connection details (5-minute TTL)

### S0-2-2: Database Package (3 points)
- [ ] `packages/db` with Drizzle schema definitions for all platform tables
- [ ] Shared schema tables: tenants, users, audit_logs
- [ ] Migration runner: applies migrations to a specific schema
- [ ] Multi-tenant migration orchestrator: iterates all tenant schemas, applies pending migrations
- [ ] Seed fixtures: test tenant + sample users for all 4 roles
- [ ] `pnpm db:migrate` command works from root

### S0-2-3: Fastify API Scaffold (3 points)
- [ ] Fastify app with plugin architecture
- [ ] Plugins: `cors`, `jwt-auth`, `rbac`, `rate-limit`, `request-logger`, `error-handler`
- [ ] `X-Request-Id` header generated and propagated through all logs
- [ ] Health check: `GET /health` → `{ status: 'ok', version, uptime }`
- [ ] Ready check: `GET /ready` → verifies DB + Redis connectivity before 200
- [ ] OpenAPI spec auto-generated from route schemas (`@fastify/swagger`)
- [ ] Swagger UI at `/docs` (disabled in production)

### S0-2-4: Audit Log System (2 points)
- [ ] `audit_logs` table in shared schema (not tenant schema — global audit store)
- [ ] Audit middleware: every mutating API request logged automatically
- [ ] Audit log DB user: INSERT only — no UPDATE, DELETE, SELECT on audit table from app
- [ ] Integration test: attempting UPDATE on audit_logs from app DB user fails

### S0-2-5: Rate Limiting (1 point)
- [ ] Per-IP rate limiting on auth endpoints (20/minute)
- [ ] Per-tenant rate limiting on write endpoints (300/minute)
- [ ] Per-tenant rate limiting on read endpoints (1000/minute)
- [ ] 429 response includes `Retry-After` header
- [ ] Rate limit state stored in Redis (works across multiple API pods)

**Sprint 0-2 Total: ~14 points**

---

## SPRINT 0-3 — Design System, Tenant Onboarding, Observability (Week 5–6)

### S0-3-1: Design System Base (4 points)
- [ ] Tailwind config: custom colors (brand palette, status colors), typography scale, spacing
- [ ] Radix UI primitives installed and configured
- [ ] Base components implemented and documented in Storybook:
  - Button (primary, secondary, ghost, destructive) × (default, loading, disabled)
  - Input (text, email, password, search) with error state
  - Select (single, searchable)
  - Checkbox, Toggle
  - Badge/Status chip (all statuses, all sizes)
  - Card (with header, body, footer variants)
  - Modal (controlled, with animation)
  - Toast (success, error, warning — Sonner or Radix Toast)
  - Sidebar navigation
  - Top bar
  - Empty state
  - Loading skeleton
- [ ] Dark mode default confirmed via Tailwind class strategy
- [ ] Storybook deployed to staging (`storybook.staging.resilienceos.com`)

### S0-3-2: Tenant Onboarding Flow (4 points)
- [ ] Sign-up page: email, password, full name, company name, plan selection (Starter/Professional — Enterprise is sales-led)
- [ ] Email verification: Auth0 sends verification email; unverified users cannot access platform
- [ ] Workspace creation: on email verification → provision tenant schema → create Admin user record
- [ ] Subdomain assignment: `{company-slug}.resilienceos.com`
- [ ] Onboarding wizard:
  - Step 1: Organization name, logo upload, timezone selection
  - Step 2: Invite team members (email + role for each)
  - Step 3: "You're ready!" → link to create first exercise
- [ ] Auth0 post-registration Action creates RSOS user record

### S0-3-3: Observability Stack (3 points)
- [ ] Structured JSON logging (Pino) with log levels and request correlation IDs
- [ ] Application metrics: request rate, latency, error rate (Prometheus format)
- [ ] Health dashboards in Datadog/Grafana (auto-provisioned via IaC)
- [ ] Alerts configured: error rate > 1%, latency p95 > 1s, DB connections > 80%, Redis memory > 85%
- [ ] External uptime monitoring (checks every 60 seconds from 3 regions)
- [ ] PagerDuty integration: P1+ alerts page on-call engineer

### S0-3-4: Developer Experience (2 points)
- [ ] `README.md`: local setup in < 10 steps, takes < 30 minutes for a new engineer
- [ ] `docker-compose.yml` for local development (Postgres + Redis + MailHog for email testing)
- [ ] `pnpm dev` starts all services with hot reload
- [ ] `pnpm test` runs unit + integration tests
- [ ] `pnpm seed:dev` seeds development database
- [ ] `pnpm db:studio` opens Drizzle Studio for DB inspection
- [ ] Architecture diagram in docs (Mermaid embedded in README)

**Sprint 0-3 Total: ~13 points**

---

## Phase 0 Total: ~40 points across 3 sprints

## Phase 0 Exit Criteria

- [ ] A new developer can clone the repo and run `pnpm install && pnpm dev` to get a working local environment in under 30 minutes
- [ ] A new tenant can sign up, verify email, and see their workspace
- [ ] CI/CD pipeline deploys to staging on every merge to main in under 10 minutes
- [ ] Multi-tenancy isolation verified by automated integration tests
- [ ] All 10+ base design system components render in Storybook
- [ ] Observability: all 5 critical alerts are configured and have been triggered + resolved in test
- [ ] Secrets: zero secrets in repository (automated scan confirms)
- [ ] Security: zero high/critical SAST findings
