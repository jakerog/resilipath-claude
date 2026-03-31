# Runbook Import Specification — XLSX/CSV Import Wizard
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## Overview
The Import Wizard allows customers to upload their existing Excel runbooks and automatically populate an exercise with tasks, teams, and resources. This directly addresses the migration path from the Excel-based process (as observed in `Prod_Failover_-_Runbook_CFIN_DR.xlsx`).

---

## Supported Formats
- `.xlsx` (Excel 2007+) — primary format
- `.xlsm` (Excel with macros — macros are ignored; data extracted)
- `.csv` — UTF-8 encoded

## File Constraints
- Max file size: 10MB
- Max rows: 5,000
- Max columns: 50

---

## Import Flow (5 Steps)

### Step 1: Upload
- Drag-and-drop or file picker
- File immediately validated (format, size, row count)
- Progress bar during upload
- On success: advance to Step 2

### Step 2: Sheet Selection (XLSX only)
- If file has multiple sheets, display sheet list with row counts
- User selects which sheet contains the runbook tasks
- Preview first 5 rows of selected sheet
- Auto-detect: if a sheet named "Runbook" or "Tasks" exists, pre-select it

### Step 3: Column Mapping
Display a two-column mapping UI:
- Left column: ResilienceOS field names
- Right column: dropdown of file's column headers (auto-mapped where names match)

**Auto-mapping rules (fuzzy match):**
| Platform Field | Auto-matches if column header contains... |
|---------------|------------------------------------------|
| Task Display ID | "task id", "task #", "id", "#" |
| Task Name | "task", "description", "name", "step" |
| Predecessor(s) | "pred", "predecessor", "depends", "after" |
| Direction | "direction", "type", "failover", "failback" |
| Workflow | "workflow", "sequential", "parallel" |
| Resource Allocation | "allocation", "resource alloc", "single", "multiple" |
| Assigned Resource | "resource", "assigned", "owner", "assignee" |
| Team | "team", "group" |
| Status | "status" |
| Estimated Duration | "estimated", "est. time", "est duration", "planned" |
| Notes | "notes", "comments", "remarks" |

**Required fields:** Task Name (import fails without this)  
**Optional fields:** All others (missing data is accepted; fields left blank)

### Step 4: Row Filtering
- Show row count after filtering out:
  - Header rows (first row already identified)
  - Empty rows
  - Section header rows (detected heuristically: rows where the task ID column is non-numeric and task name column is also non-numeric — e.g., "Pre-Validations", "Application Shutdown")
- Let user review which rows are being treated as section headers vs. tasks
- User can override: mark a row as task or header

**Section header detection heuristic:**
A row is flagged as a section header (not a task) if:
- The task ID column contains a non-numeric, non-empty value AND
- The task name is also non-numeric AND
- The row has fewer than 3 other filled columns

This matches the pattern observed in the Excel runbook where rows like "Pre-Validations", "Application Shutdown", "Cutover" appear as section dividers.

### Step 5: Preview & Import
- Table showing first 20 tasks that will be imported (with pagination to see all)
- Validation warnings highlighted in amber:
  - "Task ID 5 references predecessor ID 99 which does not exist in the import set"
  - "Resource 'James Barrett/Deepthi/Govardhan' contains multiple names separated by '/'"
  - "Estimated duration 'N/A' in row 15 is not a valid time format — will be set to null"
- Validation errors highlighted in red (blocking):
  - "Task name is empty in row 23"
  - "Circular dependency detected: Task 5 → Task 3 → Task 5"
- Import option settings:
  - [ ] Create teams from imported team names (creates new Team records if not found)
  - [ ] Create resources from assigned resource names (creates new Resource records)
  - [ ] Auto-detect stage from section headers (maps headers to stages)
  - [ ] Overwrite existing tasks (if exercise already has tasks)
- "Import [N] tasks" button — triggers import job

---

## Data Transformation Rules

### Task ID
- Numeric values: imported as `task_display_id` directly
- Non-numeric: skipped (treated as section header)
- Gaps in sequence: accepted (display IDs don't need to be contiguous)
- If duplicate task IDs: later row overwrites earlier row (with warning)

### Predecessor Parsing
Input formats supported (all observed in the real Excel):
```
"1"          → [1]
"1,2,3"      → [1, 2, 3]
"1, 2, 3"    → [1, 2, 3]  (spaces after commas)
"0"          → []  (predecessor 0 = no predecessor)
"All"        → all tasks with lower display IDs in same stage
"1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18"  → parsed correctly
```

After parsing: validate each referenced ID exists in the import set; warn if not.

### Direction Parsing
| Raw value | Mapped to |
|-----------|----------|
| "Failover (Primary → Secondary)" | `failover` |
| "Failback (Secondary → Primary)" | `failback` |
| "Failover" | `failover` |
| "Failback" | `failback` |
| Empty | `null` (inherited from stage/event) |

### Duration Parsing
Formats accepted (all observed in real Excel):
```
"00:10:00"   → 10 minutes
"00:10"      → 10 minutes
"10"         → 10 minutes (numeric = minutes)
"1:00:00"    → 60 minutes
"01:00:00"   → 60 minutes
"N/A"        → null
"0"          → 0 minutes
""           → null
```

### Resource Name Parsing
The Excel runbook uses multiple naming conventions for resources:
```
"Jake Rog"                             → single resource
"James Barrett/Deepthi/Govardhan"      → 3 resources (split on /)
"Santosh Chitta/ Srujan Mitta/ Venkata Sai Avinash"  → 3 resources (split on /, trim spaces)
"Srujan/Phanindra Dasika"              → 2 resources
"Not Applicable"                        → no resource assignment
"Mike Nolan/ Jake Rog"                 → 2 resources
```

Parsing rules:
1. Split on `/`
2. Trim whitespace from each segment
3. Filter out: "Not Applicable", "N/A", "TBD", empty strings
4. Each segment becomes a candidate resource name

Resource matching:
1. Exact match against existing resource names in tenant → link to existing resource
2. No match → create new Resource record with `full_name` = parsed name (if "Create resources" option enabled)
3. If "Create resources" disabled → leave task unassigned, add warning

### Status Parsing
| Raw value | Mapped to |
|-----------|----------|
| "Completed" | `completed` |
| "In Progress" | `in_progress` |
| "Not Started", "" | `not_started` |
| "Optional" | `not_started` + `is_optional = true` |
| "Failed" | `failed` |
| "Delayed" | `in_progress` (delay is a sub-state) |
| "Cancelled" | `cancelled` |

### Stage Auto-Detection (from Section Headers)
When "Auto-detect stage from section headers" is enabled:
```
Section header "Pre-Validations"     → Stage: pre_failover
Section header "Failover (Primary → Secondary)"  → Event type: failover
Section header "Application Shutdown"→ Stage: failover (sub-phase, tasks grouped here)
Section header "Cutover"             → Stage: failover (continued)
Section header "System Validations"  → Stage: post_failover
Section header "Post Validations"    → Stage: post_failover (continued)
Section header "Failback (Secondary → Primary)"  → Event type: failback
```

Note: The Excel uses a flat structure with section headers. The platform uses a hierarchical Stage model. The import wizard creates stages and maps tasks to them.

---

## Import API

### Upload + Validate (Async)
```
POST /api/v1/exercises/:id/import/upload
Content-Type: multipart/form-data
Body: file (binary)

Response 202:
{
  "data": {
    "import_job_id": "imp_...",
    "status": "processing",
    "status_url": "/api/v1/import-jobs/imp_..."
  }
}
```

### Get Import Job Status
```
GET /api/v1/import-jobs/:id

Response:
{
  "data": {
    "id": "imp_...",
    "status": "ready_to_preview" | "processing" | "importing" | "completed" | "failed",
    "sheets": [{ "name": "Runbook", "row_count": 127, "suggested": true }],
    "detected_columns": ["Task ID", "Task", "Pred.", "Direction", ...],
    "column_mappings": { "task_display_id": "Task ID", "task_name": "Task", ... },
    "preview_rows": [...],
    "warnings": [...],
    "errors": [...],
    "import_count": 86
  }
}
```

### Confirm Import
```
POST /api/v1/import-jobs/:id/confirm
Body: {
  "sheet_name": "Runbook",
  "column_mappings": { ... },
  "options": {
    "create_teams": true,
    "create_resources": true,
    "auto_detect_stages": true,
    "overwrite_existing": false
  }
}

Response 202: { "data": { "import_job_id": "imp_...", "status": "importing" } }
```

### Import Result
```
GET /api/v1/import-jobs/:id/result

Response:
{
  "data": {
    "tasks_created": 86,
    "tasks_skipped": 3,
    "teams_created": 12,
    "resources_created": 28,
    "stages_created": 4,
    "warnings": ["Row 15: duration 'N/A' set to null", ...],
    "errors": []
  }
}
```

---

## Template Export
A downloadable blank template is available for customers who want to prepare data in the expected format:
```
GET /api/v1/exercises/import/template.xlsx

Headers in template:
Task ID | Task Name | Predecessors | Direction | Workflow | Resource Allocation |
Assigned Resource | Team | Status | Estimated Duration (HH:MM) | Notes
```

First row: column headers  
Second row: example data  
Third row: validation rules as comments (e.g., "Sequential or Parallel")
