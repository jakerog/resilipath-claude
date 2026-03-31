# AGENTS.md — ResilienceOS Platform

## Project Identity
**Platform Name:** ResilienceOS  
**Codename:** RSOS  
**Classification:** Multi-tenant, subscription-based Business Continuity & Disaster Recovery SaaS Platform  
**Initiated:** 2026-03-29  
**Authored by:** Senior BCM/DR Planner + L10 Software Architect role  

---

## Agent Roster

### AGENT-001: DISCOVERY
**Role:** Source Document Analyst  
**Scope:** Deep-reads all uploaded artifacts (Excel runbooks, BCP Word docs, user instructions), extracts structured intelligence, populates the discovery knowledge base.  
**Outputs:** Summary findings, data dictionaries, entity maps, gap analysis  
**Status:** COMPLETED — 2026-03-29

### AGENT-002: ARCHITECT
**Role:** Platform Systems Architect  
**Scope:** Defines the overall platform architecture, technology stack, data models, multi-tenancy strategy, integration patterns, security posture, and scalability blueprint.  
**Outputs:** Architecture Decision Records (ADRs), data model diagrams, API contracts, infrastructure topology  
**Status:** IN PROGRESS

### AGENT-003: PRD-AUTHOR
**Role:** Product Requirements Documentation Author  
**Scope:** Produces and maintains the entire docs/ PRD suite: mandates.md, rules.md, roadmap.md, phases/, journal/. Converts discovery intelligence and stakeholder answers into actionable, unambiguous requirements.  
**Outputs:** Complete PRD suite under docs/  
**Status:** IN PROGRESS

### AGENT-004: QUESTION-MASTER
**Role:** Requirements Elicitation Specialist  
**Scope:** Generates exhaustive, categorized question sets for stakeholder interviews. Leaves no assumption unchallenged. Converts answers into requirement deltas and PRD updates.  
**Outputs:** Question banks per domain, answered requirement maps, assumption register  
**Status:** ACTIVE — awaiting stakeholder responses

### AGENT-005: COMPLIANCE
**Role:** Regulatory & Standards Compliance Auditor  
**Scope:** Maps platform requirements against ISO 22301, NIST SP 800-34, DRII, BCI Good Practice Guidelines, SOC 2 Type II, GDPR/CCPA, HIPAA (where applicable), and industry-specific frameworks.  
**Outputs:** Compliance matrix, gap register, certification roadmap  
**Status:** PENDING

### AGENT-006: UX-DESIGNER
**Role:** UX/UI Experience Architect  
**Scope:** Defines the Skeuomorphic PWA design system, mobile-native interaction patterns, accessibility requirements (WCAG 2.1 AA), component library specifications, and front-end architecture guidelines.  
**Outputs:** Design tokens, component specs, UX wireframe descriptions, style guide  
**Status:** PENDING

### AGENT-007: QA-GUARDIAN
**Role:** Quality Assurance & Testing Strategist  
**Scope:** Defines test strategy across unit, integration, E2E, performance, security, accessibility, and disaster simulation test types. Owns the test plan and acceptance criteria library.  
**Outputs:** Test strategy document, acceptance criteria per feature, test data specifications  
**Status:** PENDING

---

## Communication Protocol

- All agents log work to `docs/journal/[TIMESTAMP].md`
- Architecture decisions are recorded as ADRs in `docs/adr/`
- Requirement changes trigger a journal entry and version bump in affected docs
- Stakeholder responses to questions (from AGENT-004) must be processed by AGENT-003 before any phase plans are finalized
- No phase plan is considered FINAL until AGENT-005 has reviewed for compliance gaps

---

## Versioning
- All docs follow semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: fundamental scope or architecture change
- MINOR: new requirements, features, or phases added
- PATCH: corrections, clarifications, or editorial updates

---

## Source Files Processed
| File | Agent | Date | Status |
|------|-------|------|--------|
| `Prod_Failover_-_Runbook_CFIN_DR.xlsx` | AGENT-001 | 2026-03-29 | COMPLETE |
| `GPI_Business_Continuity_Plan_v2_0_2025-12-10.docx` | AGENT-001 | 2026-03-29 | COMPLETE |
| User instruction document (inline) | AGENT-001 | 2026-03-29 | COMPLETE |
