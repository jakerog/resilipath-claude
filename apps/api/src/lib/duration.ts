import type { TaskDoc, TaskWithComputed } from '@resilipath/shared-types'

/**
 * Compute actualDurationMinutes and varianceDurationMinutes from timestamps.
 * Never stored in Firestore — always computed at read time.
 * See ADR-008 Pattern 2.
 */
export function computeTaskDurations(task: TaskDoc): TaskWithComputed {
  let actualDurationMinutes: number | null = null
  let varianceDurationMinutes: number | null = null

  if (task.actualStart && task.actualEnd) {
    const startMs = task.actualStart.toMillis()
    const endMs = task.actualEnd.toMillis()
    actualDurationMinutes = Math.round((endMs - startMs) / 60_000)
  }

  if (actualDurationMinutes !== null && task.estimatedDurationMinutes != null) {
    varianceDurationMinutes = actualDurationMinutes - task.estimatedDurationMinutes
  }

  return { ...task, actualDurationMinutes, varianceDurationMinutes }
}

/**
 * Format minutes as HH:MM string for display.
 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--:--'
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
