import type { UserRole } from '@resilipath/shared-types'

// ─────────────────────────────────────────────────────────────
// Permission matrix — implements rules.md BL-004 exactly
// canDo(role, action, resource) → boolean
//
// Fail-secure: any undefined combination returns false.
// Never returns undefined or throws — always boolean.
// ─────────────────────────────────────────────────────────────

type Action =
  | 'create'
  | 'read'
  | 'update_any'
  | 'update_own'
  | 'delete'
  | 'read_report'
  | 'activate_rollback'
  | 'go_no_go_decision'
  | 'announce'
  | 'manage_users'
  | 'manage_email'
  | 'upload_evidence'
  | 'add_notes'
  | 'check_in'
  | 'export'

type Resource =
  | 'exercise'
  | 'phase'
  | 'event'
  | 'stage'
  | 'task'
  | 'resource'
  | 'team'
  | 'vendor'
  | 'evidence'
  | 'report'
  | 'audit_log'
  | 'email_list'
  | 'email_template'
  | 'email_schedule'
  | 'user'

// true = allowed, false/undefined = denied
type PermissionMatrix = Partial<Record<Action, Partial<Record<Resource, boolean>>>>

const PERMISSIONS: Record<UserRole, PermissionMatrix> = {
  admin: {
    create:           { exercise: true, phase: true, event: true, stage: true, task: true, resource: true, team: true, vendor: true, email_list: true, email_template: true, email_schedule: true, user: true },
    read:             { exercise: true, phase: true, event: true, stage: true, task: true, resource: true, team: true, vendor: true, evidence: true, report: true, audit_log: true, email_list: true, email_template: true, email_schedule: true, user: true },
    update_any:       { exercise: true, phase: true, event: true, stage: true, task: true, resource: true, team: true, vendor: true, email_list: true, email_template: true, email_schedule: true, user: true },
    update_own:       { task: true },
    delete:           { exercise: true, stage: true, task: true, resource: true, team: true, vendor: true, evidence: true, email_list: true, email_template: true, email_schedule: true, user: true },
    read_report:      { report: true },
    activate_rollback:{ stage: true },
    go_no_go_decision:{ task: true },
    announce:         { exercise: true },
    manage_users:     { user: true },
    manage_email:     { email_list: true, email_template: true, email_schedule: true },
    upload_evidence:  { evidence: true },
    add_notes:        { task: true },
    check_in:         { exercise: true },
    export:           { report: true },
  },

  moderator: {
    create:           {},
    read:             { exercise: true, phase: true, event: true, stage: true, task: true, resource: true, team: true, vendor: true, evidence: true, report: true, email_list: true, email_template: true },
    update_any:       { task: true, stage: true },
    update_own:       { task: true },
    delete:           {},
    read_report:      { report: true },
    activate_rollback:{ stage: true },
    go_no_go_decision:{ task: true },
    announce:         { exercise: true },
    manage_users:     {},
    manage_email:     {},
    upload_evidence:  { evidence: true },
    add_notes:        { task: true },
    check_in:         { exercise: true },
    export:           { report: true },
  },

  user: {
    create:           {},
    read:             { exercise: true, phase: true, event: true, stage: true, task: true, resource: true, team: true },
    update_any:       {},
    update_own:       { task: true },  // enforced with ownership check
    delete:           {},
    read_report:      {},
    activate_rollback:{},
    go_no_go_decision:{},
    announce:         {},
    manage_users:     {},
    manage_email:     {},
    upload_evidence:  { evidence: true },  // own tasks only — enforced in service
    add_notes:        { task: true },      // own tasks only — enforced in service
    check_in:         { exercise: true },
    export:           {},
  },

  report: {
    create:           {},
    read:             { exercise: true, report: true },
    update_any:       {},
    update_own:       {},
    delete:           {},
    read_report:      { report: true },
    activate_rollback:{},
    go_no_go_decision:{},
    announce:         {},
    manage_users:     {},
    manage_email:     {},
    upload_evidence:  {},
    add_notes:        {},
    check_in:         {},
    export:           { report: true },
  },
}

/**
 * Check whether a role is permitted to perform an action on a resource.
 * Always returns boolean — never throws, never returns undefined.
 * Fail-secure: unknown roles/actions/resources return false.
 */
export function canDo(
  role: UserRole,
  action: Action,
  resource: Resource
): boolean {
  return PERMISSIONS[role]?.[action]?.[resource] === true
}

/**
 * Get all actions a role is permitted to perform on a resource.
 */
export function getPermittedActions(
  role: UserRole,
  resource: Resource
): Action[] {
  const matrix = PERMISSIONS[role]
  return (Object.keys(matrix) as Action[]).filter(
    (action) => matrix[action]?.[resource] === true
  )
}

export type { Action, Resource }
