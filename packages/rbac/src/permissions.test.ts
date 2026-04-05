import { describe, it, expect } from 'vitest'
import { canDo } from './permissions.js'

describe('canDo — Admin role', () => {
  it('can create exercise', () => expect(canDo('admin', 'create', 'exercise')).toBe(true))
  it('can delete task', () => expect(canDo('admin', 'delete', 'task')).toBe(true))
  it('can manage users', () => expect(canDo('admin', 'manage_users', 'user')).toBe(true))
  it('can activate rollback', () => expect(canDo('admin', 'activate_rollback', 'stage')).toBe(true))
  it('can read audit log', () => expect(canDo('admin', 'read', 'audit_log')).toBe(true))
  it('can read report', () => expect(canDo('admin', 'read_report', 'report')).toBe(true))
  it('can export report', () => expect(canDo('admin', 'export', 'report')).toBe(true))
})

describe('canDo — Moderator role', () => {
  it('can update any task', () => expect(canDo('moderator', 'update_any', 'task')).toBe(true))
  it('can update own task', () => expect(canDo('moderator', 'update_own', 'task')).toBe(true))
  it('can activate rollback', () => expect(canDo('moderator', 'activate_rollback', 'stage')).toBe(true))
  it('can go_no_go decision', () => expect(canDo('moderator', 'go_no_go_decision', 'task')).toBe(true))
  it('can announce', () => expect(canDo('moderator', 'announce', 'exercise')).toBe(true))
  it('can read report', () => expect(canDo('moderator', 'read_report', 'report')).toBe(true))
  it('CANNOT create exercise', () => expect(canDo('moderator', 'create', 'exercise')).toBe(false))
  it('CANNOT manage users', () => expect(canDo('moderator', 'manage_users', 'user')).toBe(false))
  it('CANNOT delete anything', () => expect(canDo('moderator', 'delete', 'task')).toBe(false))
  it('CANNOT read audit log', () => expect(canDo('moderator', 'read', 'audit_log')).toBe(false))
})

describe('canDo — User role', () => {
  it('can update own task', () => expect(canDo('user', 'update_own', 'task')).toBe(true))
  it('can read exercise', () => expect(canDo('user', 'read', 'exercise')).toBe(true))
  it('can upload evidence', () => expect(canDo('user', 'upload_evidence', 'evidence')).toBe(true))
  it('can add notes', () => expect(canDo('user', 'add_notes', 'task')).toBe(true))
  it('can check in', () => expect(canDo('user', 'check_in', 'exercise')).toBe(true))
  it('CANNOT update any task', () => expect(canDo('user', 'update_any', 'task')).toBe(false))
  it('CANNOT create exercise', () => expect(canDo('user', 'create', 'exercise')).toBe(false))
  it('CANNOT read report', () => expect(canDo('user', 'read_report', 'report')).toBe(false))
  it('CANNOT activate rollback', () => expect(canDo('user', 'activate_rollback', 'stage')).toBe(false))
  it('CANNOT go_no_go', () => expect(canDo('user', 'go_no_go_decision', 'task')).toBe(false))
  it('CANNOT delete', () => expect(canDo('user', 'delete', 'task')).toBe(false))
  it('CANNOT manage email', () => expect(canDo('user', 'manage_email', 'email_list')).toBe(false))
  it('CANNOT announce', () => expect(canDo('user', 'announce', 'exercise')).toBe(false))
  it('CANNOT export report', () => expect(canDo('user', 'export', 'report')).toBe(false))
})

describe('canDo — Report role', () => {
  it('can read report', () => expect(canDo('report', 'read_report', 'report')).toBe(true))
  it('can export report', () => expect(canDo('report', 'export', 'report')).toBe(true))
  it('can read exercise (list)', () => expect(canDo('report', 'read', 'exercise')).toBe(true))
  it('CANNOT update any task', () => expect(canDo('report', 'update_any', 'task')).toBe(false))
  it('CANNOT update own task', () => expect(canDo('report', 'update_own', 'task')).toBe(false))
  it('CANNOT upload evidence', () => expect(canDo('report', 'upload_evidence', 'evidence')).toBe(false))
  it('CANNOT create anything', () => expect(canDo('report', 'create', 'exercise')).toBe(false))
  it('CANNOT delete anything', () => expect(canDo('report', 'delete', 'task')).toBe(false))
  it('CANNOT announce', () => expect(canDo('report', 'announce', 'exercise')).toBe(false))
  it('CANNOT manage users', () => expect(canDo('report', 'manage_users', 'user')).toBe(false))
})

describe('canDo — Fail-secure (unknown inputs)', () => {
  it('unknown role returns false', () =>
    expect(canDo('unknown' as never, 'read', 'exercise')).toBe(false))
  it('unknown action returns false', () =>
    expect(canDo('admin', 'fly' as never, 'exercise')).toBe(false))
  it('unknown resource returns false', () =>
    expect(canDo('admin', 'read', 'spaceship' as never)).toBe(false))
})
