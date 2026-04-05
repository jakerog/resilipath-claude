import type { TaskStatus, UserRole } from '@resilipath/shared-types'
import { AppError } from '../lib/errors.js'

interface TransitionContext {
  role: UserRole
  isOwner: boolean               // true if requesting user is assigned to this task
  predecessorsComplete: boolean  // true if all sequential predecessors are completed
  workflowType: 'sequential' | 'parallel'
}

interface TransitionResult {
  allowed: boolean
  reason?: string
}

// Valid transitions — [from, to, minRole, requiresOwnerOrModerator]
// See docs/adr/ADR-006-state-machines.md
const VALID_TRANSITIONS: Array<{
  from: TaskStatus | '*'
  to: TaskStatus
  allowedRoles: UserRole[]
  requiresOwnership: boolean
  requiresPredecessors: boolean
}> = [
  // User/Moderator/Admin: start a task
  {
    from: 'not_started', to: 'in_progress',
    allowedRoles: ['admin', 'moderator', 'user'],
    requiresOwnership: true,
    requiresPredecessors: true,
  },
  // User/Moderator/Admin: complete a task
  {
    from: 'in_progress', to: 'completed',
    allowedRoles: ['admin', 'moderator', 'user'],
    requiresOwnership: true,
    requiresPredecessors: false,
  },
  // Moderator/Admin only: mark as failed
  {
    from: 'in_progress', to: 'failed',
    allowedRoles: ['admin', 'moderator'],
    requiresOwnership: false,
    requiresPredecessors: false,
  },
  // Moderator/Admin only: revert in_progress back to not_started
  {
    from: 'in_progress', to: 'not_started',
    allowedRoles: ['admin', 'moderator'],
    requiresOwnership: false,
    requiresPredecessors: false,
  },
  // Moderator/Admin: re-open a failed task
  {
    from: 'failed', to: 'in_progress',
    allowedRoles: ['admin', 'moderator'],
    requiresOwnership: false,
    requiresPredecessors: false,
  },
  // Admin only: revert completed (emergency override)
  {
    from: 'completed', to: 'in_progress',
    allowedRoles: ['admin'],
    requiresOwnership: false,
    requiresPredecessors: false,
  },
  // Admin only: cancel any task
  {
    from: '*', to: 'cancelled',
    allowedRoles: ['admin'],
    requiresOwnership: false,
    requiresPredecessors: false,
  },
]

export const TaskStateMachine = {
  canTransition(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus,
    ctx: TransitionContext
  ): TransitionResult {
    // Same status — idempotent no-op
    if (currentStatus === targetStatus) {
      return { allowed: true }
    }

    const rule = VALID_TRANSITIONS.find(
      (t) =>
        (t.from === '*' || t.from === currentStatus) &&
        t.to === targetStatus
    )

    if (!rule) {
      return {
        allowed: false,
        reason: `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
      }
    }

    if (!rule.allowedRoles.includes(ctx.role)) {
      return {
        allowed: false,
        reason: `Role '${ctx.role}' cannot perform this transition`,
      }
    }

    // User role always requires ownership
    if (ctx.role === 'user' && rule.requiresOwnership && !ctx.isOwner) {
      return {
        allowed: false,
        reason: 'This task is not assigned to you',
      }
    }

    // Predecessor check only applies to sequential tasks starting
    if (
      rule.requiresPredecessors &&
      ctx.workflowType === 'sequential' &&
      !ctx.predecessorsComplete
    ) {
      return {
        allowed: false,
        reason: 'Predecessor tasks must be completed first',
      }
    }

    return { allowed: true }
  },

  assertCanTransition(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus,
    ctx: TransitionContext
  ): void {
    const result = this.canTransition(currentStatus, targetStatus, ctx)
    if (!result.allowed) {
      throw new AppError(
        currentStatus === targetStatus ? 'TASK_INVALID_STATUS_TRANSITION' :
        result.reason?.includes('assigned') ? 'AUTH_NOT_TASK_OWNER' :
        result.reason?.includes('Predecessor') ? 'TASK_PREDECESSOR_NOT_MET' :
        'TASK_INVALID_STATUS_TRANSITION',
        422,
        result.reason ?? 'Invalid status transition',
        { currentStatus, targetStatus }
      )
    }
  },

  getValidTransitions(currentStatus: TaskStatus, role: UserRole): TaskStatus[] {
    return VALID_TRANSITIONS
      .filter(
        (t) =>
          (t.from === '*' || t.from === currentStatus) &&
          t.allowedRoles.includes(role)
      )
      .map((t) => t.to)
  },
}
