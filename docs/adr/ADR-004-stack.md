# ADR-004: Technology Stack Selection (REVISED)
**Status:** ACCEPTED  
**Date:** 2026-03-29  
**Version:** 0.2.0  
**Supersedes:** ADR-004 v0.1.0  
**Trigger:** Stakeholder confirmed — GCP/Firebase free tier, no Kubernetes, Vercel for frontend, zero budget, AI-only build team  

---

## Revised Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend framework | **Hono.js** on GCP Cloud Run | Ultra-light, TypeScript-native, serverless-optimized, fast cold starts |
| Database | **Cloud Firestore** (Native mode) | Free tier, no server, offline persistence for PWA, native Firebase Auth integration |
| Authentication | **Firebase Authentication** | Free unlimited users, email/password + Google SSO, custom JWT claims |
| Real-time updates | **Firebase Realtime Database** | Free tier, sub-100ms updates, no per-read charge on listeners (unlike Firestore) |
| Frontend | **React 18 + Vite** on **Vercel** | Free hobby tier, fast builds, PWA-compatible |
| File storage | **Firebase Storage** | Free tier (5GB), same ecosystem, presigned URL upload pattern |
| Background jobs | **GCP Cloud Tasks** | Free tier (1M tasks/month), HTTP-based, no queue server needed |
| Email | **Resend** (free tier) | 100 emails/day free, excellent TypeScript SDK |
| IaC | **Terraform** + GCP provider | AI-maintained, all infra as code, reproducible |
| CI/CD | **GitHub Actions** | Free tier, auto-deploy on push |
| Monorepo | **pnpm workspaces** + **Turborepo** | Incremental builds, shared types between api/web/worker |

---

## Key Architecture: Dual-Write Pattern for Real-Time

All task mutations write to both Firestore (source of truth) and Firebase Realtime Database (live mirror). Clients load initial data from Firestore, then listen to Realtime DB for live updates. This avoids Firestore's per-read cost on listener-based live updates.

```
API receives task mutation
  → Write to Firestore (authoritative, persisted)
  → Write subset of fields to Realtime DB (fast fan-out to all connected clients)

Client:
  → Initial load: fetch from Firestore via API (one-time reads)
  → Live updates: Firebase Realtime DB SDK listener (free, low-latency)
```

---

## What Changed from ADR-004 v0.1.0

| Layer | Old | New |
|-------|-----|-----|
| Framework | Fastify | Hono.js |
| Database | PostgreSQL | Firestore |
| Cache | Redis | Built into Firestore + Realtime DB |
| Auth | Auth0 | Firebase Authentication |
| Real-time | WebSockets + Redis Pub/Sub | Firebase Realtime Database |
| File storage | AWS S3 | Firebase Storage |
| Job queue | BullMQ + Redis | GCP Cloud Tasks |
| Container orchestration | Kubernetes | Cloud Run (serverless) |
| ORM | Drizzle | Firebase Admin SDK (no ORM — document store) |

---

## Accepted Tradeoffs

1. **No generated columns** — duration calculations run in service layer on every read. Acceptable at MVP scale; TanStack Query caches on client.
2. **No complex joins** — report aggregation runs in Node.js service layer. Acceptable at MVP scale (<200 tasks per exercise).
3. **Dual-write complexity** — every task mutation writes to two places. `realtime-sync.ts` service handles this transparently; tested as a unit.
4. **Firestore free tier is the binding constraint** — 50K reads/day. Architecture is designed to minimize reads (batch loads, no per-field listeners). Free tier is sufficient for MVP with GPI as sole customer.

---

## Infrastructure as Code (Terraform)

All GCP resources are declared in `infrastructure/terraform/`:
```hcl
# Cloud Run API service
resource "google_cloud_run_service" "api" { ... }

# Cloud Run Worker service  
resource "google_cloud_run_service" "worker" { ... }

# Cloud Tasks queue
resource "google_cloud_tasks_queue" "jobs" { ... }

# Firebase project (Firestore, Auth, Storage, Realtime DB all enabled via Firebase project)
resource "google_firebase_project" "main" { ... }
resource "google_firebaserules_ruleset" "firestore" { ... }
resource "google_firebase_database_instance" "realtime" { ... }
```

The AI agent generates and applies all Terraform changes. No manual GCP Console configuration.
