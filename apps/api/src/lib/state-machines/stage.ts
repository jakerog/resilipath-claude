import type { StageDoc, TaskDoc } from '@resilipath/shared-types'
import { AppError } from '../errors.js'

// ─────────────────────────────────────────────────────────────
// Stage State Machine
// ─────────────────────────────────────────────────────────────
export const StageStateMachine = {
  /**
   * A stage is complete when ALL non-optional, non-cancelled tasks are completed.
   */
  isComplete(tasks: TaskDoc[]): boolean {
    const countable = tasks.filter(
      (t) => !t.isOptional && t.status !== 'cancelled'
    )
    if (countable.length === 0) return false
    return countable.every((t) => t.status === 'completed')
  },

  /**
   * Check whether a rollback stage can be activated.
   * Requires: preceding stage has at least one failed task OR admin override.
   */
  canActivateRollback(
    stage: StageDoc,
    precedingTasks: TaskDoc[],
    isAdminOverride: boolean
  ): { allowed: boolean; reason?: string } {
    if (!stage.isRollbackStage) {
      return { allowed: false, reason: 'This stage is not a rollback stage' }
    }
    if (!stage.isLocked) {
      return { allowed: false, reason: 'Rollback stage is already unlocked' }
    }
    if (isAdminOverride) {
      return { allowed: true }
    }
    const hasFailed = precedingTasks.some((t) => t.status === 'failed')
    if (!hasFailed) {
      return {
        allowed: false,
        reason: 'Rollback can only be activated when a preceding task has failed',
      }
    }
    return { allowed: true }
  },

  assertCanActivateRollback(
    stage: StageDoc,
    precedingTasks: TaskDoc[],
    isAdminOverride: boolean
  ): void {
    const result = this.canActivateRollback(stage, precedingTasks, isAdminOverride)
    if (!result.allowed) {
      throw new AppError(
        stage.isLocked && !stage.isRollbackStage
          ? 'STAGE_ROLLBACK_ALREADY_ACTIVE'
          : 'STAGE_ROLLBACK_NO_FAILURE',
        422,
        result.reason ?? 'Cannot activate rollback stage',
        { stageId: stage.id }
      )
    }
  },
}

// ─────────────────────────────────────────────────────────────
// Go/No-Go Machine
// ─────────────────────────────────────────────────────────────
export const GoNoGoMachine = {
  /**
   * Validate that prerequisites are met before allowing a Go/No-Go decision.
   * All non-optional, non-cancelled, non-go-no-go tasks in the stage must be completed.
   */
  canDecide(
    goNoGoTask: TaskDoc,
    stageTasks: TaskDoc[]
  ): { allowed: boolean; reason?: string } {
    if (!goNoGoTask.isGoNoGo) {
      return { allowed: false, reason: 'Task is not a Go/No-Go task' }
    }
    if (goNoGoTask.goNoGoOutcome) {
      return { allowed: false, reason: 'Go/No-Go decision has already been made' }
    }

    const prereqs = stageTasks.filter(
      (t) =>
        t.id !== goNoGoTask.id &&
        !t.isGoNoGo &&
        !t.isOptional &&
        t.status !== 'cancelled'
    )
    const incomplete = prereqs.filter((t) => t.status !== 'completed')

    if (incomplete.length > 0) {
      return {
        allowed: false,
        reason: `${incomplete.length} prerequisite task(s) are not yet completed`,
      }
    }
    return { allowed: true }
  },

  assertCanDecide(goNoGoTask: TaskDoc, stageTasks: TaskDoc[]): void {
    const result = this.canDecide(goNoGoTask, stageTasks)
    if (!result.allowed) {
      const code = goNoGoTask.goNoGoOutcome
        ? 'GONOGO_ALREADY_DECIDED'
        : !goNoGoTask.isGoNoGo
        ? 'GONOGO_NOT_APPLICABLE'
        : 'GONOGO_PREREQUISITES_INCOMPLETE'
      throw new AppError(code, 422, result.reason ?? 'Cannot make Go/No-Go decision', {
        taskId: goNoGoTask.id,
      })
    }
  },
}

// ─────────────────────────────────────────────────────────────
// Exercise Phase Machine
// ─────────────────────────────────────────────────────────────
import type { ExercisePhaseDoc, PhaseName } from '@resilipath/shared-types'

const PHASE_ORDER: PhaseName[] = ['mock_1', 'mock_2', 'mock_3', 'production']

export const ExercisePhaseMachine = {
  nextPhaseName(
    existingPhases: ExercisePhaseDoc[],
    mock3Required: boolean
  ): { phaseName: PhaseName | null; reason?: string } {
    const completed = existingPhases
      .filter((p) => p.status === 'completed')
      .map((p) => p.phaseName)

    if (!completed.includes('mock_1')) return { phaseName: 'mock_1' }
    if (!completed.includes('mock_2')) return { phaseName: 'mock_2' }
    if (mock3Required && !completed.includes('mock_3')) return { phaseName: 'mock_3' }

    // All required mocks done — ready for production
    if (!completed.includes('production')) {
      const needsMock3 = mock3Required && !completed.includes('mock_3')
      if (needsMock3) {
        return { phaseName: null, reason: 'Mock 3 is required but not yet completed' }
      }
      return { phaseName: 'production' }
    }

    return { phaseName: null, reason: 'All phases already exist' }
  },

  canCreateProduction(
    existingPhases: ExercisePhaseDoc[],
    mock3Required: boolean
  ): boolean {
    const completed = existingPhases
      .filter((p) => p.status === 'completed')
      .map((p) => p.phaseName)

    if (!completed.includes('mock_1') || !completed.includes('mock_2')) return false
    if (mock3Required && !completed.includes('mock_3')) return false
    return true
  },
}
