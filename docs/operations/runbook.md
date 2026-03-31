# Operations Runbook — ResilienceOS Platform
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## 1. Environments

| Environment | Purpose | Deploy Trigger | URL Pattern |
|------------|---------|---------------|------------|
| `local` | Developer local machine | Manual | localhost:3000 |
| `dev` | Shared dev integration | Auto — every push to `feature/*` | dev.resilienceos.com |
| `staging` | Pre-production validation | Auto — every merge to `main` | staging.resilienceos.com |
| `production` | Live customer environment | Manual gate — after staging sign-off | *.resilienceos.com |

### Environment Isolation
- Staging and production use separate cloud accounts/subscriptions
- No shared secrets, databases, or storage between staging and production
- Staging runs at 25% of production capacity (auto-scaled down)
- Production database is never accessible from staging

---

## 2. Deployment Process

### Standard Deployment (Zero-Downtime)
```
1. Engineer merges PR to main
2. CI pipeline runs: lint → typecheck → tests → build → SAST
3. On CI pass: staging is auto-deployed via Kubernetes rolling update
   - New pods start alongside existing pods
   - Load balancer health checks new pods before routing traffic
   - Old pods drained and terminated after new pods healthy
4. Staging smoke test suite runs (5 minutes)
5. Engineer reviews staging deployment
6. Engineer triggers production promotion via GitHub UI (approval gate)
7. Production rolling update (same pattern as staging)
8. Production smoke test suite runs
9. Alert if any smoke test fails → auto-rollback initiated
```

### Rollback Procedure
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/api-server -n production
kubectl rollout undo deployment/worker -n production
kubectl rollout undo deployment/web -n production

# Verify rollback
kubectl rollout status deployment/api-server -n production

# Alert all engineers of rollback
```

### Database Migrations
```bash
# Migrations are ALWAYS run before application deployment
# Migrations must be backward-compatible (old app + new schema must work)

# Run migration against all tenant schemas
pnpm migrate:run --env production

# Migration orchestrator runs with:
# - Concurrency: max 10 schemas at once
# - Rollback: if migration fails, abort (don't continue to other schemas)
# - Report: list of succeeded/failed schemas
```

### Feature Flag Deployment
All new features are deployed behind a feature flag. Default: OFF.
```typescript
// Feature flags stored in Redis, configurable per tenant
const enabled = await featureFlags.isEnabled('evidence-video-upload', tenantId)
if (enabled) { /* new code path */ }
```

Flag promotion to GA: toggle per-tenant in admin console → eventually toggle default to ON → remove flag code.

---

## 3. Infrastructure Overview

### Production Architecture
```
                    [Cloudflare / AWS CloudFront CDN]
                              │
                    [Application Load Balancer]
                    ┌─────────┴─────────┐
              [API Pods (k8s)]     [Web Pods (k8s)]
              3 replicas min        3 replicas min
              6 replicas max        6 replicas max
                    │                        │
        ┌───────────┼───────────┐           │
   [PostgreSQL]  [Redis]   [Worker Pods]   [S3/Blob]
   Primary+2     Cluster    3 replicas      (CDN-backed)
   Read Replicas  6 nodes   (BullMQ)
```

### Auto-Scaling Policy
```yaml
# API Server HPA
minReplicas: 3
maxReplicas: 20
metrics:
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 60 }
  - type: External   # Custom: WebSocket connections per pod
    external:
      metric: { name: websocket_connections_per_pod }
      target: { type: AverageValue, averageValue: 150 }
```

---

## 4. Monitoring & Alerting

### Metrics Collected

**API Server**
- Request rate (req/s per endpoint)
- Request latency (p50, p95, p99 per endpoint)
- Error rate (4xx, 5xx per endpoint)
- Active WebSocket connections
- WebSocket event broadcast latency
- Authentication failures per minute

**Database**
- Query latency (p50, p95, p99)
- Active connections (vs. max pool)
- Replication lag (primary → read replicas)
- Deadlocks per minute
- Slow queries (> 1 second)
- Disk usage (% full)

**Redis**
- Memory usage (% of max)
- Pub/Sub message rate
- Queue depth per BullMQ queue
- Expired keys rate
- Connected clients

**Worker (BullMQ)**
- Jobs processed/minute per queue
- Failed jobs count (and failure reason distribution)
- Job processing latency (time in queue + processing time)
- Retry count distribution

**Infrastructure**
- Pod CPU and memory (vs. limits)
- Node disk space
- Network I/O
- Load balancer 5xx rate

### Alert Thresholds

| Alert | Threshold | Severity | Action |
|-------|-----------|---------|--------|
| API error rate | > 1% sustained 5min | P1 | Page on-call |
| API p95 latency | > 1 second sustained 5min | P1 | Page on-call |
| API p95 latency | > 500ms sustained 5min | P2 | Slack alert |
| DB connection pool | > 80% used | P1 | Page on-call |
| DB replication lag | > 30 seconds | P1 | Page on-call |
| DB disk usage | > 80% | P1 | Page on-call |
| Redis memory | > 85% | P1 | Page on-call |
| BullMQ failed jobs | > 10 in 5min per queue | P2 | Slack alert |
| BullMQ queue depth | > 1000 jobs | P2 | Slack alert |
| Email delivery failure rate | > 5% | P2 | Slack alert |
| Uptime monitor failure | 2 consecutive checks | P1 | Page on-call + SMS |
| Auth failures | > 100/min (brute force indicator) | P0 | Page on-call + security slack |
| Cross-tenant query attempt | Any | P0 | Immediate page + security alert |

### On-Call Rotation
- Primary on-call: 24/7 rotation (weekly)
- Secondary on-call: backup for P0/P1 incidents
- P0 escalation: CTO notified immediately; CEO notified within 30 minutes
- Tooling: PagerDuty (or equivalent) for alert routing and escalation

---

## 5. SLA & Uptime

### SLA Commitments (by tier)

| Tier | Uptime SLA | Measurement | Credits |
|------|-----------|-------------|---------|
| Starter | 99.9% monthly | Synthetic monitoring (external) | 10% monthly credit per 0.1% below |
| Professional | 99.95% monthly | Synthetic monitoring (external) | 10% monthly credit per 0.05% below |
| Enterprise | 99.99% monthly | Synthetic monitoring + customer-side | 25% monthly credit per 0.01% below |

**SLA Exclusions:**
- Scheduled maintenance (announced 48h in advance)
- Force majeure events
- Customer-side network/infrastructure failures
- Attacks (DDoS, brute force)

### RTO / RPO
| Scenario | RTO | RPO |
|----------|-----|-----|
| Pod crash (auto-restart) | < 30 seconds | 0 (stateless) |
| Single AZ failure | < 5 minutes | 0 (multi-AZ standby) |
| Database primary failure | < 60 seconds | < 30 seconds |
| Full regional failure | < 4 hours | < 1 hour |
| Catastrophic data loss | < 24 hours | < 1 hour (PITR) |

### Planned Maintenance Windows
- Weekly maintenance window: Sunday 02:00–04:00 UTC
- Emergency patch: anytime with 15-minute notice to Enterprise customers
- Major upgrades: 30-day notice, with dry-run in staging

---

## 6. Backup & Recovery

### Database Backup Strategy
```
Continuous PITR (Point-In-Time Recovery):
  WAL archiving to S3/blob storage
  Recovery granularity: any point within last 7 days

Daily full backups:
  Retained: 30 days (standard), 90 days (enterprise)
  Stored in separate cloud region from production
  
Monthly snapshots:
  Retained: 12 months
  Stored in cold storage (Glacier / Cool tier)
  
Backup Testing:
  Monthly: restore daily backup to isolated environment, run integrity checks
  Quarterly: full restore drill (restore to point-in-time, verify data)
```

### Recovery Procedures
```
# Database recovery (PITR)
# 1. Identify target recovery time
# 2. Restore from daily backup closest to but before target
# 3. Apply WAL logs up to target time
# 4. Verify data integrity (row counts, sample records)
# 5. Update connection strings to point to restored DB
# 6. Verify application connectivity

# Tenant-specific recovery
# If only one tenant's data is corrupt (e.g., admin error):
# 1. Restore tenant schema to isolated DB from backup
# 2. Export specific tenant's data
# 3. Import corrected data to production (with careful review)
# Requires: database-per-tenant (Enterprise) or schema restoration tooling
```

---

## 7. Incident Communication Templates

### Customer-Facing Status Update (Investigating)
```
**Investigating — [Service Name] Degradation**
Date/Time: [UTC timestamp]
We are currently investigating reports of [issue description]. 
Our team has been notified and is actively investigating.
We will provide an update within 30 minutes.
Impact: [Affected features/users]
```

### Customer-Facing Status Update (Resolved)
```
**Resolved — [Service Name] Degradation**
Date/Time (Start): [UTC timestamp]
Date/Time (Resolved): [UTC timestamp]  
Duration: [X minutes/hours]
Root cause: [Brief, non-technical description]
Impact: [Who was affected and how]
Remediation: [What we did to fix it]
Prevention: [What we're doing to prevent recurrence]
```

---

## 8. Capacity Planning

### Storage Growth Model
```
Assumptions (per active tenant):
- 4 DR exercises per year
- 100 tasks per exercise
- 10 evidence files per task (avg 2MB each)
- 5 resources with photos (avg 500KB each)
- BCP documents: 5 plans × avg 10MB each

Storage per tenant per year:
  Evidence: 4 × 100 × 10 × 2MB = 8,000 MB = ~8 GB
  Photos: 5 × 500KB = 2.5 MB
  BCP docs: 50 MB
  Reports (cached): 4 × 10MB = 40 MB

Total: ~8 GB per active tenant per year

At 100 tenants: 800 GB/year → Lifecycle to Glacier after 2 years
At 1,000 tenants: 8 TB/year → Significant storage cost; lifecycle management critical
```

### Compute Scaling Triggers
```
API Pods: Scale at 60% avg CPU → max 20 pods
Worker Pods: Scale based on queue depth (1 worker per 50 pending jobs, max 20)
DB Read Replicas: Add replica when primary read query time > 200ms p95
Redis: Scale cluster when memory > 70% consistently
```
