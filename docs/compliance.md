# Compliance & Standards Mapping — ResilienceOS
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## 1. ISO 22301:2019 — Business Continuity Management Systems

ISO 22301 is the international standard for BCMS. ResilienceOS is designed to help organizations conform to this standard. The table below maps ISO 22301 clauses to platform features.

| ISO 22301 Clause | Requirement | ResilienceOS Feature |
|-----------------|-------------|---------------------|
| 4.1 | Understanding the organization and its context | Facility profile, industry sector, regulatory framework settings |
| 4.2 | Understanding needs of interested parties | Stakeholder contact groups (Module 3) |
| 4.3 | Scope of BCMS | BCP Plan scope definition |
| 5.2 | Policy | BCP document governance section |
| 5.3 | Roles, responsibilities, authorities | BCM Team management, RBAC |
| 6.1 | Actions to address risks | BIA risk registry, contingency plans |
| 6.2 | Business continuity objectives | RTO/RPO assignment per process |
| 7.4 | Communication | Crisis Communications Module (Module 3) |
| 7.5 | Documented information | BCP document generation, version control, audit log |
| 8.2 | Business impact analysis | BIA Engine (Module 2 + Phase 5) |
| 8.3 | Business continuity strategy | Recovery strategy documentation in BCP sections |
| 8.4 | Business continuity plans and procedures | BCP Plan builder, procedure documentation |
| 8.5 | Exercise programme | DR Exercise Manager (Module 1), Tabletop Engine (Module 2) |
| 9.1 | Monitoring, measurement, analysis | Report Dashboard, cross-exercise analytics |
| 9.3 | Management review | Annual review workflow, review sign-off |
| 10.2 | Nonconformity and corrective action | Lessons Learned capture, corrective action tracking |

---

## 2. NIST SP 800-34 — Contingency Planning Guide for Federal Information Systems

Relevant for US government and government-adjacent customers. The platform supports the 7-step NIST contingency planning process:

| NIST Step | Description | Platform Support |
|-----------|-------------|-----------------|
| 1 | Develop the Contingency Planning Policy | BCP governance documentation |
| 2 | Conduct the Business Impact Analysis | BIA Engine |
| 3 | Identify Preventive Controls | Risk controls documentation in BIA |
| 4 | Create Contingency Strategies | Contingency plan builder |
| 5 | Develop an IT Contingency Plan | DR Exercise runbook / task management |
| 6 | Ensure Plan Testing, Training, and Exercises | DR Exercise Manager, Tabletop Engine |
| 7 | Ensure Plan Maintenance | Version control, annual review workflow |

---

## 3. DRII Professional Practices

The Disaster Recovery Institute International (DRII) defines 10 professional practices for BCM. Platform coverage:

| DRII Practice | Coverage Status |
|--------------|----------------|
| 1. Program Initiation & Management | ✅ BCP governance, team management |
| 2. Risk Evaluation & Control | ✅ BIA risk registry |
| 3. Business Impact Analysis | ✅ BIA Engine |
| 4. Business Continuity Strategies | ✅ Contingency plan builder |
| 5. Emergency Response & Operations | ✅ Crisis Communications, Incident Manager (Module 4, Phase 4) |
| 6. Business Continuity Plans | ✅ BCP Plan builder + document generation |
| 7. Awareness & Training Programs | 🔄 Training schedule tracking (partial) |
| 8. Business Continuity Plan Exercise, Audit & Maintenance | ✅ DR Exercise Manager, Tabletop, review workflow |
| 9. Crisis Communications | ✅ Module 3 |
| 10. Coordination with External Agencies | ✅ Regulatory contact groups, regulatory notification intelligence |

---

## 4. SOC 2 Type II — Trust Service Criteria

Target: Achieve SOC 2 Type II certification within 18 months of GA launch.

### Security (CC Series)
| Criterion | Implementation |
|-----------|---------------|
| CC6.1 — Logical access | Auth0 OIDC/SAML, MFA, role-based access |
| CC6.2 — Pre-employment screening | HR/onboarding process (not platform) |
| CC6.3 — Role-based access | RBAC with least-privilege principle |
| CC6.6 — Logical access removal | User deactivation, session revocation |
| CC6.7 — Data transmission | TLS 1.3 enforced, HSTS, no HTTP |
| CC6.8 — Malware protection | Dependency scanning, SAST, file upload malware scanning |
| CC7.1 — Vulnerability management | Automated SAST/DAST in CI/CD, quarterly pen tests |
| CC7.2 — Monitoring | Centralized logging, anomaly alerting |
| CC8.1 — Change management | Git-based deployment, code review, CI/CD gates |
| CC9.1 — Risk mitigation | Vendor risk assessments, contract review |

### Availability (A Series)
| Criterion | Implementation |
|-----------|---------------|
| A1.1 — Performance monitoring | APM metrics, uptime monitoring, SLA reporting |
| A1.2 — Environmental protections | Cloud provider SLA, multi-AZ deployment |
| A1.3 — Backup and recovery | Daily DB backups, PITR, cross-region replication for Enterprise |

### Confidentiality (C Series)
| Criterion | Implementation |
|-----------|---------------|
| C1.1 — Identify confidential information | Data classification in policies |
| C1.2 — Dispose of confidential information | Data deletion workflows, GDPR compliance |

---

## 5. Privacy Regulations

### GDPR (EU General Data Protection Regulation)
| Requirement | Platform Implementation |
|-------------|------------------------|
| Lawful basis for processing | Contractual necessity (B2B platform) + consent where required |
| Data subject rights | Data export, data deletion endpoints, self-service profile updates |
| Data minimization | Collect only what's required for the stated purpose |
| Right to erasure | Tenant account deletion cascades to all personal data |
| Data portability | Full tenant data export in JSON format |
| 72-hour breach notification | Incident response procedure + regulatory notification template in Module 3 |
| Data residency (EU) | EU data region option (Phase 5 multi-region) |
| Sub-processor list | Published and maintained; DPA template available |

### CCPA (California Consumer Privacy Act)
| Requirement | Platform Implementation |
|-------------|------------------------|
| Right to know | Privacy policy + data inventory |
| Right to delete | Account deletion + data removal workflow |
| Right to opt out of sale | Platform does not sell user data |
| Non-discrimination | No service degradation for exercising rights |

---

## 6. Industry-Specific Compliance Notes

### Healthcare (HIPAA)
- The platform does NOT inherently process Protected Health Information (PHI)
- For healthcare customers using the platform for IT DR exercises and BCP:
  - Execute BAA (Business Associate Agreement) before onboarding
  - Ensure audit logs and evidence files are stored in HIPAA-eligible storage
  - Access logs satisfy HIPAA audit control requirements (§164.312(b))
  - Automatic session timeout satisfies workstation security requirements

### Financial Services (SOX, FFIEC)
- DR documentation and exercise results are audit evidence for SOX 404 controls
- Platform's report export and audit log satisfy evidence requirements for IT auditors
- FFIEC IT Examination Handbook BCP booklet: the platform directly addresses required BCP elements

### Energy Sector (NERC CIP)
- NERC CIP-009 (Recovery Plans for BES Cyber Systems): DR exercises documented in platform
- Evidence capture (screenshots, logs) supports NERC CIP audit requirements

### Food & Beverage (FDA, SQF)
- The GPI BCP document analyzed references SQF (Safe Quality Food) Practitioner roles
- Platform's BCP template for manufacturing includes food safety business transfer procedures
- FDA FSMA continuity planning requirements addressed in facility BCP template

---

## 7. Certification Roadmap

| Certification | Target Date | Pre-requisite |
|--------------|-------------|---------------|
| SOC 2 Type I | 6 months post GA | Security controls implemented |
| SOC 2 Type II | 18 months post GA | 12-month observation period |
| ISO 27001 | 24 months post GA | Information security management system |
| ISO 22301 | 30 months post GA | BCM program for ResilienceOS itself |
| FedRAMP (future) | Pending customer demand | Significant government pipeline |
