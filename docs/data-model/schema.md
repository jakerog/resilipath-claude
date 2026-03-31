# Data Model Specification — ResilienceOS Platform
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  
**Scope:** Module 1 (DR Exercise Manager) complete; Module 2 (BCP) partial; Module 3 (Crisis Comms) partial  

---

## Naming Conventions
- Table names: `snake_case`, plural nouns
- Column names: `snake_case`
- Primary keys: `id` (UUID v4)
- Foreign keys: `{referenced_table_singular}_id`
- Timestamps: `created_at`, `updated_at` (auto-managed), `deleted_at` (soft delete)
- Boolean fields: prefixed with `is_` or `has_`
- Status enums: stored as lowercase strings with underscores

---

## Core Platform Tables (All Modules)

### `tenants`
```sql
id                  UUID        PK
name                VARCHAR(255) NOT NULL
subdomain           VARCHAR(100) UNIQUE NOT NULL    -- acmecorp.resilienceos.com
custom_domain       VARCHAR(255) UNIQUE             -- dr.acmecorp.com
plan_tier           VARCHAR(50)  NOT NULL           -- starter | professional | enterprise
isolation_mode      VARCHAR(20)  NOT NULL           -- schema | database
status              VARCHAR(50)  NOT NULL           -- active | suspended | cancelled
logo_url            TEXT
primary_color       VARCHAR(7)                      -- hex color e.g. #2563EB
app_name            VARCHAR(100)                    -- white-label app name
timezone            VARCHAR(50)  DEFAULT 'UTC'
industry_sector     VARCHAR(100)
country             VARCHAR(2)                      -- ISO 3166-1 alpha-2
data_region         VARCHAR(50)  DEFAULT 'us-east-1'
mfa_required        BOOLEAN      DEFAULT false
session_timeout_hours INT        DEFAULT 8
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `users`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
auth_provider_id    VARCHAR(255) UNIQUE NOT NULL    -- Auth0 user_id
email               VARCHAR(255) NOT NULL
first_name          VARCHAR(100)
last_name           VARCHAR(100)
display_name        VARCHAR(200)
role                VARCHAR(50)  NOT NULL           -- admin | moderator | user | report
status              VARCHAR(50)  NOT NULL DEFAULT 'active'  -- active | inactive | suspended
phone_mobile        VARCHAR(50)
phone_work          VARCHAR(50)
avatar_url          TEXT
last_login_at       TIMESTAMPTZ
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ                     -- soft delete
```

### `audit_logs`
```sql
id                  UUID        PK
tenant_id           UUID        NOT NULL            -- denormalized for partitioning
user_id             UUID                            -- nullable (system actions)
action              VARCHAR(100) NOT NULL           -- entity.verb e.g. task.status_updated
entity_type         VARCHAR(100) NOT NULL
entity_id           UUID        NOT NULL
before_state        JSONB
after_state         JSONB
ip_address          INET
user_agent          TEXT
request_id          UUID                            -- correlation ID from HTTP request
created_at          TIMESTAMPTZ NOT NULL
-- Partitioned by created_at (monthly partitions)
-- No updated_at, no deleted_at — immutable
```

---

## Module 1: DR Exercise Manager

### `exercises`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
exercise_name       VARCHAR(255) NOT NULL
description         TEXT
application_name    VARCHAR(255)                    -- e.g. SAP S4/CFIN, SAP HCM
primary_region      VARCHAR(100)                    -- e.g. East US2
secondary_region    VARCHAR(100)                    -- e.g. Central US
start_date          DATE
end_date            DATE
owner_id            UUID        FK → resources.id
status              VARCHAR(50)  NOT NULL DEFAULT 'planned'
                                -- planned | in_progress | on_hold | completed | cancelled
photo_url           TEXT
notes               TEXT
current_phase       VARCHAR(50)                     -- mock_1 | mock_2 | mock_3 | production
mock3_required      BOOLEAN      DEFAULT false
created_by          UUID        FK → users.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ
```

### `exercise_phases`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
exercise_id         UUID        FK → exercises.id
phase_name          VARCHAR(50)  NOT NULL           -- mock_1 | mock_2 | mock_3 | production
phase_order         INT          NOT NULL           -- 1, 2, 3, 4
status              VARCHAR(50)  NOT NULL DEFAULT 'planned'
                                -- planned | in_progress | completed | cancelled
go_no_go_outcome    VARCHAR(20)                     -- go | no_go | null (pending)
go_no_go_notes      TEXT
go_no_go_decided_by UUID        FK → users.id
go_no_go_decided_at TIMESTAMPTZ
notes               TEXT
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `exercise_events`
-- Each phase has two events: Failover and Failback
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
phase_id            UUID        FK → exercise_phases.id
event_type          VARCHAR(20)  NOT NULL           -- failover | failback
direction           VARCHAR(50)  NOT NULL           -- Primary → Secondary | Secondary → Primary
scheduled_start     TIMESTAMPTZ
scheduled_end       TIMESTAMPTZ
actual_start        TIMESTAMPTZ
actual_end          TIMESTAMPTZ
status              VARCHAR(50)  NOT NULL DEFAULT 'planned'
notes               TEXT
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `stages`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
exercise_id         UUID        FK → exercises.id
event_id            UUID        FK → exercise_events.id
stage_name          VARCHAR(50)  NOT NULL
                    -- pre_failover | failover | post_failover | failover_rollback
                    -- pre_failback | failback | post_failback | failback_rollback
stage_order         INT          NOT NULL
is_rollback_stage   BOOLEAN      DEFAULT false
is_locked           BOOLEAN      DEFAULT false      -- rollback stages start locked
lock_reason         VARCHAR(255)
activated_at        TIMESTAMPTZ                     -- when stage became active
completed_at        TIMESTAMPTZ
scheduled_start     TIMESTAMPTZ
scheduled_end       TIMESTAMPTZ
actual_start        TIMESTAMPTZ
actual_end          TIMESTAMPTZ
notes               TEXT
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `tasks`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
exercise_id         UUID        FK → exercises.id
stage_id            UUID        FK → stages.id
task_display_id     INT          NOT NULL           -- user-visible sequential number (1, 2, 3...)
task_name           VARCHAR(500) NOT NULL
description         TEXT                            -- detailed instructions
workflow_type       VARCHAR(20)  NOT NULL           -- sequential | parallel
resource_allocation VARCHAR(20)  NOT NULL           -- single | multiple
status              VARCHAR(50)  NOT NULL DEFAULT 'not_started'
                    -- not_started | in_progress | completed | failed | delayed | optional | cancelled
is_optional         BOOLEAN      DEFAULT false
is_go_no_go         BOOLEAN      DEFAULT false
go_no_go_outcome    VARCHAR(10)                     -- go | no_go
go_no_go_approved_by UUID       FK → users.id
go_no_go_approved_at TIMESTAMPTZ
direction           VARCHAR(50)                     -- failover | failback (inherited from event)
scheduled_start     TIMESTAMPTZ
estimated_duration_minutes INT                      -- stored in minutes for calculation
actual_start        TIMESTAMPTZ
actual_end          TIMESTAMPTZ
actual_duration_minutes INT GENERATED ALWAYS AS   -- auto-calculated
    (CASE WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL 
     THEN EXTRACT(EPOCH FROM (actual_end - actual_start))::INT / 60
     ELSE NULL END) STORED
variance_duration_minutes INT GENERATED ALWAYS AS  -- auto-calculated
    (CASE WHEN actual_duration_minutes IS NOT NULL AND estimated_duration_minutes IS NOT NULL
     THEN actual_duration_minutes - estimated_duration_minutes
     ELSE NULL END) STORED
forecast_duration_minutes INT
forecast_start      TIMESTAMPTZ
forecast_end        TIMESTAMPTZ
notes               TEXT
created_by          UUID        FK → users.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ
```

### `task_predecessors`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
task_id             UUID        FK → tasks.id
predecessor_task_id UUID        FK → tasks.id
UNIQUE(task_id, predecessor_task_id)
```

### `task_resources`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
task_id             UUID        FK → tasks.id
resource_id         UUID        FK → resources.id
is_primary          BOOLEAN      DEFAULT true
assigned_by         UUID        FK → users.id
assigned_at         TIMESTAMPTZ NOT NULL
```

### `resources`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
user_id             UUID        FK → users.id    -- nullable: resource may not have platform login
full_name           VARCHAR(255) NOT NULL
email               VARCHAR(255)
phone_mobile        VARCHAR(50)
phone_work          VARCHAR(50)
photo_url           TEXT
title               VARCHAR(200)
department          VARCHAR(200)
notes               TEXT
is_active           BOOLEAN      DEFAULT true
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ
```

### `teams`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
team_name           VARCHAR(255) NOT NULL
description         TEXT
vendor_id           UUID        FK → vendors.id    -- nullable
logo_url            TEXT
team_type           VARCHAR(50)                    -- internal | vendor | mixed
is_active           BOOLEAN      DEFAULT true
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ
```

### `team_resources`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
team_id             UUID        FK → teams.id
resource_id         UUID        FK → resources.id
role_in_team        VARCHAR(200)
is_lead             BOOLEAN      DEFAULT false
UNIQUE(team_id, resource_id)
```

### `vendors`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
vendor_name         VARCHAR(255) NOT NULL
vendor_type         VARCHAR(20)  NOT NULL           -- internal | external
contact_email       VARCHAR(255)
contact_phone       VARCHAR(50)
logo_url            TEXT
website             VARCHAR(500)
notes               TEXT
is_active           BOOLEAN      DEFAULT true
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ
```

### `evidence_files`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
task_id             UUID        FK → tasks.id      -- nullable
entity_type         VARCHAR(50)                    -- task | team | resource | vendor | exercise
entity_id           UUID        NOT NULL
file_name           VARCHAR(500) NOT NULL
file_type           VARCHAR(100) NOT NULL           -- MIME type
file_size_bytes     INT
storage_key         TEXT         NOT NULL           -- S3 object key
sha256_checksum     CHAR(64)     NOT NULL
upload_url          TEXT                            -- presigned URL (cached, TTL 1h)
uploaded_by         UUID        FK → users.id
notes               TEXT
created_at          TIMESTAMPTZ NOT NULL
deleted_at          TIMESTAMPTZ                    -- evidence can be soft-deleted by admin
```

### `resource_checkins`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
exercise_id         UUID        FK → exercises.id
phase_id            UUID        FK → exercise_phases.id
resource_id         UUID        FK → resources.id
status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    -- pending | confirmed | unavailable | no_response
confirmation_token  UUID        UNIQUE NOT NULL     -- for tokenized links (no login required)
invited_at          TIMESTAMPTZ NOT NULL
deadline_at         TIMESTAMPTZ NOT NULL
responded_at        TIMESTAMPTZ
availability_notes  TEXT
backup_resource_id  UUID        FK → resources.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `email_lists`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
list_name           VARCHAR(255) NOT NULL
description         TEXT
created_by          UUID        FK → users.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `email_list_members`
```sql
id                  UUID        PK
list_id             UUID        FK → email_lists.id
email               VARCHAR(255) NOT NULL
display_name        VARCHAR(255)
source_type         VARCHAR(50)  NOT NULL           -- resource | manual | import
source_id           UUID                            -- resource.id if source=resource
UNIQUE(list_id, email)
```

### `email_templates`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
template_name       VARCHAR(255) NOT NULL
subject             VARCHAR(500) NOT NULL
html_body           TEXT         NOT NULL
text_body           TEXT
variables           TEXT[]                          -- e.g. ['exercise_name', 'start_time']
created_by          UUID        FK → users.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `email_schedules`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
template_id         UUID        FK → email_templates.id
list_ids            UUID[]       NOT NULL
exercise_id         UUID        FK → exercises.id  -- nullable
schedule_type       VARCHAR(20)  NOT NULL           -- absolute | relative
scheduled_at        TIMESTAMPTZ                    -- for absolute
relative_offset_hours INT                          -- for relative (negative = before exercise start)
relative_anchor     VARCHAR(50)                    -- exercise_start | exercise_end
status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    -- pending | sent | failed | cancelled
sent_at             TIMESTAMPTZ
created_by          UUID        FK → users.id
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `email_deliveries`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
schedule_id         UUID        FK → email_schedules.id
recipient_email     VARCHAR(255) NOT NULL
status              VARCHAR(20)  NOT NULL           -- queued | sent | delivered | bounced | failed
provider_message_id VARCHAR(500)                   -- SendGrid/SES message ID
attempts            INT          NOT NULL DEFAULT 0
last_attempted_at   TIMESTAMPTZ
sent_at             TIMESTAMPTZ
error_message       TEXT
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

---

## Module 2: BCP Plan Manager (Partial)

### `facilities`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
facility_name       VARCHAR(255) NOT NULL
facility_type       VARCHAR(100)                    -- manufacturing | office | warehouse | datacenter
industry_sector     VARCHAR(100)
street_address      TEXT
city                VARCHAR(100)
state_province      VARCHAR(100)
postal_code         VARCHAR(20)
country             VARCHAR(2)
headcount           INT
square_footage      INT
annual_revenue      DECIMAL(15,2)
timezone            VARCHAR(50)
regulatory_frameworks TEXT[]                        -- e.g. ['ISO 22301', 'OSHA', 'FDA']
is_active           BOOLEAN      DEFAULT true
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `bcp_plans`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
facility_id         UUID        FK → facilities.id
plan_name           VARCHAR(255) NOT NULL
version             VARCHAR(20)  NOT NULL DEFAULT '1.0'
template_type       VARCHAR(50)  NOT NULL           -- manufacturing | healthcare | financial | logistics | general
status              VARCHAR(50)  NOT NULL DEFAULT 'draft'
                    -- draft | in_review | approved | superseded | archived
effective_date      DATE
next_review_date    DATE
created_by          UUID        FK → users.id
approved_by         UUID        FK → users.id
approved_at         TIMESTAMPTZ
document_url        TEXT                            -- most recent generated document URL
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

### `bcp_sections`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
plan_id             UUID        FK → bcp_plans.id
section_key         VARCHAR(100) NOT NULL
                    -- governance | overview | bcm_teams | bia | contingency_plans
                    -- crisis_management | resuming_operations | training | it_workarounds
                    -- skills_matrix | appendices
section_title       VARCHAR(255) NOT NULL
section_order       INT          NOT NULL
content_json        JSONB                           -- structured section data
completion_pct      INT          NOT NULL DEFAULT 0
last_updated_by     UUID        FK → users.id
last_updated_at     TIMESTAMPTZ
UNIQUE(plan_id, section_key)
```

---

## Module 3: Crisis Communications (Partial)

### `incidents`
```sql
id                  UUID        PK
tenant_id           UUID        FK → tenants.id
facility_id         UUID        FK → facilities.id -- nullable
title               VARCHAR(500) NOT NULL
description         TEXT
incident_type       VARCHAR(100) NOT NULL
severity            VARCHAR(10)  NOT NULL           -- p1 | p2 | p3 | p4
status              VARCHAR(50)  NOT NULL DEFAULT 'active'
                    -- active | monitoring | resolved | closed
declared_by         UUID        FK → users.id
declared_at         TIMESTAMPTZ NOT NULL
resolved_at         TIMESTAMPTZ
resolution_summary  TEXT
created_at          TIMESTAMPTZ NOT NULL
updated_at          TIMESTAMPTZ NOT NULL
```

---

## Indexes (Critical Performance Indexes)

```sql
-- Tenant isolation (every table has this)
CREATE INDEX idx_{table}_tenant_id ON {table}(tenant_id);

-- Exercise queries
CREATE INDEX idx_tasks_exercise_id ON tasks(exercise_id);
CREATE INDEX idx_tasks_stage_id ON tasks(stage_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_resources_resource_id ON task_resources(resource_id);

-- Audit log (partitioned by month, indexed by tenant + entity)
CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Resource check-in token lookup
CREATE UNIQUE INDEX idx_checkins_token ON resource_checkins(confirmation_token);

-- Email delivery status (for retry worker)
CREATE INDEX idx_email_deliveries_status ON email_deliveries(status, last_attempted_at)
  WHERE status IN ('queued', 'failed');
```

---

## Notes on Generated Columns
Postgres 12+ supports `GENERATED ALWAYS AS ... STORED` computed columns. `actual_duration_minutes` and `variance_duration_minutes` use this feature. If the target database does not support this, implement as trigger-based computed values or calculate at query time.
