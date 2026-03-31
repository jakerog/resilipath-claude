# Security Architecture & Threat Model — ResilienceOS
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Author:** AGENT-005 (Compliance) + AGENT-002 (Architect)  
**Status:** DRAFT  

---

## 1. Security Design Principles

### Principle 1: Defense in Depth
No single security control is relied upon exclusively. Authentication is backed by authorization. Authorization is backed by database-level isolation. Database isolation is backed by network-level separation. Monitoring detects failures at every layer.

### Principle 2: Zero Trust
No request is trusted because of its origin. Every API request is authenticated and authorized regardless of whether it originates from the front-end, another internal service, or a webhook. "Internal" does not mean "trusted."

### Principle 3: Least Privilege
Every component — service accounts, IAM roles, database users, API keys — has the minimum permissions required to perform its function. The API server's database user can SELECT/INSERT/UPDATE/DELETE but cannot DROP, ALTER, or CREATE.

### Principle 4: Fail Secure
When a security check fails or an error occurs during authorization, the default is to deny access, not grant it. Auth errors return 401/403, never silently fall through to allow access.

### Principle 5: Immutable Audit Trail
All security-relevant events are logged to an append-only audit store. Audit records cannot be modified or deleted even by administrators.

---

## 2. Threat Model (STRIDE)

### Asset Inventory
| Asset | Sensitivity | Impact of Compromise |
|-------|------------|---------------------|
| DR exercise runbook data | High | Exposure of infrastructure details and failover procedures |
| Resource contact info (email, phone) | Medium | PII exposure, GDPR liability |
| BCP plans | High | Reveals organizational vulnerabilities to adversaries |
| Evidence files (screenshots) | High | May contain credentials, system configs in screenshots |
| Auth tokens | Critical | Full account takeover |
| Tenant connection strings | Critical | Multi-tenant data breach |
| Audit logs | High | Tampering would destroy forensic evidence |
| Email templates and lists | Medium | Could be used for phishing if accessed |

### Threats by Category (STRIDE)

#### Spoofing
| Threat | Mitigation |
|--------|-----------|
| Attacker forges JWT to impersonate another user | RS256 signing (asymmetric) — private key never leaves Auth0 |
| Attacker uses expired token | `exp` claim validated on every request; tokens have 15-minute lifetime |
| Attacker spoofs WebSocket identity | JWT validated during WebSocket upgrade (HTTP Upgrade request) |
| Check-in token reuse | Tokens are single-use; marked `used_at` after first submission |

#### Tampering
| Threat | Mitigation |
|--------|-----------|
| Attacker modifies evidence file after upload | SHA-256 checksum stored at upload; verified on access |
| Attacker modifies audit log | Append-only table; DB user has no UPDATE/DELETE on audit schema |
| Attacker modifies task status via direct API (bypassing UI RBAC) | All business rules enforced at API level, not UI level |
| CSRF: attacker tricks authenticated user into making state changes | JWT-based auth is CSRF-resistant (no cookies for auth — or httpOnly + SameSite=Strict) |

#### Repudiation
| Threat | Mitigation |
|--------|-----------|
| User claims they didn't make a change | Immutable audit log captures: user_id, action, before/after state, IP, timestamp, request_id |
| Moderator claims they didn't activate rollback | Audit log records every state machine transition with actor identity |

#### Information Disclosure
| Threat | Mitigation |
|--------|-----------|
| Tenant A reads Tenant B's exercises (IDOR) | TenantConnectionResolver enforces schema isolation; all queries include tenant_id; 404 (not 403) for cross-tenant resources |
| Attacker extracts data via verbose error messages | API errors never return stack traces or internal details in production |
| Attacker reads evidence files via guessed S3 keys | All files behind presigned URLs; bucket has no public access; keys use UUIDs (not guessable) |
| Attacker intercepts data in transit | TLS 1.3 minimum; HSTS with preload; no HTTP fallback |
| Attacker reads auth tokens from logs | Auth tokens are never logged; request logger strips Authorization header |

#### Denial of Service
| Threat | Mitigation |
|--------|-----------|
| Attacker floods API with requests | Rate limiting per IP, per tenant, per user at API gateway |
| Attacker opens thousands of WebSocket connections | Max 500 WebSocket connections per exercise; IP-based connection rate limiting |
| Attacker uploads huge files to exhaust storage | File size validation at presign step (50MB max); per-tenant storage quota |
| Attacker triggers thousands of email sends | Email rate limiting (10 sends/minute via API); scheduled emails go through job queue with concurrency limits |

#### Elevation of Privilege
| Threat | Mitigation |
|--------|-----------|
| User manipulates their JWT to claim admin role | RS256 signed by Auth0 — cannot be forged without private key |
| User exploits mass assignment to update their own role | Explicit field allowlist on all PATCH/PUT handlers; role updates require admin + specific endpoint |
| Vendor resource uses check-in token to access other platform features | Tokenized endpoints only expose check-in data; token has no other permissions |
| Attacker exploits SQL injection to bypass tenant filter | ORM (Drizzle) uses parameterized queries exclusively; SAST enforces no raw SQL interpolation |

---

## 3. Security Controls by Layer

### Network Layer
- **TLS 1.3** enforced; TLS 1.0/1.1 rejected
- **HSTS** header: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- **Content Security Policy:** Strict CSP preventing XSS via inline scripts and unauthorized origins
- **CORS:** Allowlist of known tenant origins; `Access-Control-Allow-Origin` is never `*`
- **DDoS Protection:** Cloud provider's DDoS mitigation (AWS Shield Standard or Azure DDoS Basic)
- **WAF:** AWS WAF or Azure Application Gateway with OWASP Core Rule Set

### Authentication Layer
- **JWT RS256** — asymmetric signing; public key is fetched from Auth0 JWKS endpoint and cached
- **Token Validation Order:** signature → expiry → tenant claim → role claim
- **MFA** required for Admin and Moderator roles (enforced via Auth0 policy)
- **Session Revocation:** Admin can invalidate all sessions for a user; stored in Redis revocation list (token `jti` checked on each request)
- **Brute Force Protection:** Auth0's attack protection (IP-based lockout after 10 failed attempts)

### Authorization Layer
- **RBAC** enforced in API service layer (not route handler)
- **Ownership Check** for user-scoped operations (task assigned to requesting user)
- **Tenant Check** for all entity operations (entity.tenant_id === request.tenant_id)
- **State Machine** enforced before any status transition is persisted

### Application Layer
- **Input Validation:** All inputs validated via JSON Schema (Fastify built-in ajv)
- **Output Sanitization:** All HTML output is escaped; no raw HTML from user inputs is rendered
- **SQL Injection:** ORM (Drizzle) with parameterized queries exclusively; SAST rule enforces no template literal SQL
- **File Upload Safety:** Magic byte validation, ClamAV scan, MIME type allowlist, path traversal prevention
- **Dependency Security:** Automated dependency audit in CI (`pnpm audit --audit-level=high`); Dependabot for automated PRs

### Data Layer
- **Encryption at Rest:** AES-256 via cloud provider managed encryption (EBS, RDS, S3 all encrypted)
- **Encryption in Transit:** TLS 1.3 for all connections; postgres `sslmode=require`
- **Tenant Isolation:** Schema-per-tenant for standard; database-per-tenant for enterprise (ADR-001)
- **Field-Level Encryption:** Phone numbers and mobile numbers encrypted at application layer (AES-256-GCM) before storage — even DB admins cannot read plaintext phone numbers

### Infrastructure Layer
- **Least Privilege IAM:** Each service has its own IAM role with minimal permissions
- **Secrets Management:** No secrets in environment variables or code; all via Vault/cloud secrets manager
- **Container Security:** Non-root container user; read-only filesystem where possible; no privileged mode
- **Network Segmentation:** Database and Redis only accessible from the API private subnet; not from internet
- **Security Groups:** Inbound to API: only 443 from load balancer; DB: only 5432 from API subnet

---

## 4. Security Incident Response

### Severity Classification
| Severity | Description | Response Time | Escalation |
|---------|-------------|--------------|-----------|
| P0 | Active data breach, auth bypass, cross-tenant data exposure | 15 minutes | CEO, Legal, all engineers |
| P1 | Potential data exposure, service degradation, account compromise | 1 hour | CTO, on-call engineer |
| P2 | Security vulnerability identified (not yet exploited) | 24 hours | Security lead |
| P3 | Low-severity finding, hardening opportunity | 1 week | Dev team backlog |

### P0 Incident Playbook
1. **Detect** (automated alerting or user report)
2. **Contain** (disable affected tenant, revoke all sessions if necessary, rate limit or block IP)
3. **Assess** (determine scope: which tenants affected, what data accessed)
4. **Notify** (internal: CEO, Legal within 15min; external: affected tenants within 1 hour; GDPR: supervisory authority within 72 hours if EU data involved)
5. **Eradicate** (fix root cause, deploy patch)
6. **Recover** (restore from clean backup if necessary, verify integrity)
7. **Review** (post-mortem within 48 hours, blameless)

### "Break Glass" Accounts
- Two break-glass admin accounts per environment (stored in physical safe + digital vault)
- Break-glass use requires two-person authorization (no single engineer can access alone)
- All break-glass sessions send immediate alerts to all engineers and security log

---

## 5. Data Classification

| Classification | Description | Examples | Controls |
|---------------|-------------|---------|---------|
| **CRITICAL** | If exposed, causes immediate customer harm or regulatory breach | Auth tokens, DB connection strings, private keys | Never logged; encrypted in transit and at rest; HSM or KMS protected |
| **CONFIDENTIAL** | Sensitive customer business data | DR runbook task data, BCP plans, evidence files, resource PII | Tenant-isolated; encrypted at rest; audit logged |
| **INTERNAL** | Operational platform data not customer-specific | Platform logs (scrubbed), deployment configs, error rates | Access limited to engineering; not exposed externally |
| **PUBLIC** | Data intentionally publicly accessible | Status page, marketing content | No special controls |

---

## 6. Vulnerability Management

### Automated (Every PR + CI)
- **Semgrep SAST**: Custom rules + OWASP rules + community rules
- **pnpm audit**: Known CVE detection in dependencies
- **Trivy**: Container image scanning for OS and package CVEs
- **CodeQL**: Deep semantic analysis for complex vulnerability patterns

### Scheduled (Weekly)
- **OWASP ZAP DAST**: Full scan against staging environment
- **Dependency diff review**: Human review of Dependabot PRs weekly

### Periodic
- **Third-party penetration test**: Quarterly during active development; semi-annually post-GA
- **Bug bounty program**: Consider after GA (HackerOne / Bugcrowd)

### SLA for Remediation
| Severity | Remediation SLA |
|---------|----------------|
| Critical (CVSS 9.0–10.0) | 24 hours |
| High (CVSS 7.0–8.9) | 72 hours |
| Medium (CVSS 4.0–6.9) | 2 weeks |
| Low (CVSS < 4.0) | Next sprint |

---

## 7. Compliance-Relevant Security Controls

| Control | Implementation | Evidence |
|---------|---------------|---------|
| Access control policy | RBAC defined in rules.md, enforced in code | Code review, SAST |
| MFA for privileged users | Auth0 policy enforcement | Auth0 audit logs |
| Audit logging | Append-only audit_logs table | DB schema, automated test |
| Encryption at rest | Cloud provider + field-level for PII | Infrastructure config |
| Encryption in transit | TLS 1.3, HSTS | SSL Labs scan report |
| Vulnerability management | Automated scanning + quarterly pen test | Scan reports, pen test reports |
| Incident response | Documented playbook, tested annually | Playbook document, drill records |
| Backup and recovery | Automated DB backups, PITR | Backup restore test records |
| Change management | Git + CI/CD + code review | GitHub history |
| Vendor management | Sub-processor agreements, SOC 2 review | Vendor register, agreements |
