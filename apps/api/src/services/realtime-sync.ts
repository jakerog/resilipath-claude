import { getRtdb } from '../lib/firebase.js'
import type { TaskDoc, StageDoc } from '@resilipath/shared-types'

/**
 * Mirror task mutation to Firebase Realtime Database for live exercise board.
 * Fire-and-forget — does not block the API response.
 * See ADR-004 dual-write pattern and ADR-008 Pattern 7.
 */
export async function syncTaskUpdate(
  exerciseId: string,
  taskId: string,
  fields: Partial<{
    status: string
    actualStart: number | null
    actualEnd: number | null
    actualDurationMinutes: number | null
    varianceDurationMinutes: number | null
    notes: string
    lastUpdatedBy: string
    lastUpdatedAt: number
  }>
): Promise<void> {
  try {
    await getRtdb()
      .ref(`exercises/${exerciseId}/tasks/${taskId}`)
      .update({ ...fields, lastUpdatedAt: Date.now() })
  } catch (err) {
    console.error('[RTDB SYNC FAILED] task', taskId, err)
  }
}

export async function syncStageUpdate(
  exerciseId: string,
  stageId: string,
  fields: Partial<{
    status: string
    completedCount: number
    totalCount: number
    isLocked: boolean
  }>
): Promise<void> {
  try {
    await getRtdb()
      .ref(`exercises/${exerciseId}/stages/${stageId}`)
      .update(fields)
  } catch (err) {
    console.error('[RTDB SYNC FAILED] stage', stageId, err)
  }
}

export async function syncExerciseMeta(
  exerciseId: string,
  meta: Partial<{
    name: string
    status: string
    currentPhase: string
    startedAt: number
  }>
): Promise<void> {
  try {
    await getRtdb()
      .ref(`exercises/${exerciseId}/meta`)
      .update(meta)
  } catch (err) {
    console.error('[RTDB SYNC FAILED] exercise meta', exerciseId, err)
  }
}

export async function syncAnnouncement(
  exerciseId: string,
  announcementId: string,
  payload: {
    message: string
    sentBy: string
    sentAt: number
    displayUntil: number
    priority: 'normal' | 'urgent'
  }
): Promise<void> {
  try {
    await getRtdb()
      .ref(`exercises/${exerciseId}/announcements/${announcementId}`)
      .set(payload)
  } catch (err) {
    console.error('[RTDB SYNC FAILED] announcement', announcementId, err)
  }
}

export async function setParticipantPresence(
  exerciseId: string,
  userId: string,
  data: { name: string; role: string; connectedAt: number } | null
): Promise<void> {
  try {
    const ref = getRtdb().ref(`exercises/${exerciseId}/participants/${userId}`)
    if (data === null) {
      await ref.remove()
    } else {
      await ref.set({ ...data, lastSeenAt: Date.now() })
    }
  } catch (err) {
    console.error('[RTDB SYNC FAILED] presence', userId, err)
  }
}
