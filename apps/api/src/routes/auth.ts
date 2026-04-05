import { Hono } from 'hono'
import { getFirebaseAuth } from '../lib/firebase.js'
import { tenantCol } from '../lib/firebase.js'
import { AppError } from '../lib/errors.js'
import { computeTaskDurations } from '../lib/duration.js'
import type { TaskDoc, StageDoc, TeamDoc } from '@resilipath/shared-types'

// ─────────────────────────────────────────────────────────────
// Auth routes
// ─────────────────────────────────────────────────────────────
export const authRoutes = new Hono()

authRoutes.get('/me', async (ctx) => {
  const user = ctx.get('user')
  return ctx.json({
    data: {
      userId: user.uid,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
    },
    meta: { requestId: ctx.get('requestId') },
  })
})

authRoutes.post('/logout', async (ctx) => {
  const user = ctx.get('user')
  await getFirebaseAuth().revokeRefreshTokens(user.uid)
  return ctx.json({ data: { success: true }, meta: { requestId: ctx.get('requestId') } })
})

// ─────────────────────────────────────────────────────────────
// Report routes
// ─────────────────────────────────────────────────────────────
export const reportRoutes = new Hono()

reportRoutes.get('/exercises/:id/report', async (ctx) => {
  const user = ctx.get('user')
  const exerciseId = ctx.req.param('id')

  // Batch read — single query per collection (ADR-008 Pattern 3: no N+1)
  const [tasksSnap, stagesSnap, teamsSnap] = await Promise.all([
    tenantCol(user.tenantId, 'tasks')
      .where('exerciseId', '==', exerciseId)
      .where('deletedAt', '==', null)
      .get(),
    tenantCol(user.tenantId, 'stages')
      .where('exerciseId', '==', exerciseId)
      .orderBy('stageOrder')
      .get(),
    tenantCol(user.tenantId, 'teams')
      .where('tenantId', '==', user.tenantId)
      .where('deletedAt', '==', null)
      .get(),
  ])

  const tasks = tasksSnap.docs.map((d) => computeTaskDurations(d.data() as TaskDoc))
  const stages = stagesSnap.docs.map((d) => d.data() as StageDoc)
  const teamsMap = new Map(teamsSnap.docs.map((d) => {
    const t = d.data() as TeamDoc
    return [t.id, t.teamName]
  }))

  // Stage timings
  const stageTimings = stages.map((stage) => {
    const stageTasks = tasks.filter((t) => t.stageId === stage.id)
    const totalEstimated = stageTasks.reduce((sum, t) => sum + (t.estimatedDurationMinutes ?? 0), 0)
    const totalActual = stageTasks.every((t) => t.actualDurationMinutes !== null)
      ? stageTasks.reduce((sum, t) => sum + (t.actualDurationMinutes ?? 0), 0)
      : null

    return {
      stageId: stage.id,
      stageName: stage.stageName,
      estimatedDurationMinutes: totalEstimated,
      actualDurationMinutes: totalActual,
      varianceDurationMinutes: totalActual !== null ? totalActual - totalEstimated : null,
    }
  })

  // Team performance — group tasks by teamId from task_resources
  const taskResourcesSnap = await tenantCol(user.tenantId, 'task_resources')
    .where('tenantId', '==', user.tenantId)
    .get()

  const teamTaskMap = new Map<string, string[]>()
  for (const doc of taskResourcesSnap.docs) {
    const d = doc.data() as { taskId: string; resourceId: string }
    // We'll build team stats via team assignments — simplified for MVP
    void d
  }

  // Summary stats
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length
  const totalEstimated = tasks.reduce((s, t) => s + (t.estimatedDurationMinutes ?? 0), 0)
  const tasksWithActual = tasks.filter((t) => t.actualDurationMinutes !== null)
  const totalActual = tasksWithActual.length > 0
    ? tasksWithActual.reduce((s, t) => s + (t.actualDurationMinutes ?? 0), 0)
    : null

  return ctx.json({
    data: {
      exercise: { id: exerciseId },
      tasks,
      stages,
      summary: {
        totalEstimatedMinutes: totalEstimated,
        totalActualMinutes: totalActual,
        totalVarianceMinutes: totalActual !== null ? totalActual - totalEstimated : null,
        completedTaskCount: completedCount,
        totalTaskCount: tasks.length,
        failedTaskCount: failedCount,
        stageTimings,
        teamPerformance: [],
      },
    },
    meta: { requestId: ctx.get('requestId') },
  })
})

// DR Bridge snapshot
reportRoutes.get('/exercises/:id/bridge-snapshot', async (ctx) => {
  const user = ctx.get('user')
  const exerciseId = ctx.req.param('id')

  const [tasksSnap, stagesSnap] = await Promise.all([
    tenantCol(user.tenantId, 'tasks')
      .where('exerciseId', '==', exerciseId)
      .where('deletedAt', '==', null)
      .get(),
    tenantCol(user.tenantId, 'stages')
      .where('exerciseId', '==', exerciseId)
      .orderBy('stageOrder')
      .get(),
  ])

  const tasks = tasksSnap.docs.map((d) => d.data() as TaskDoc)
  const stages = stagesSnap.docs.map((d) => d.data() as StageDoc)

  // Per-stage summary for Bridge
  const stageSummaries = stages.map((stage) => {
    const stageTasks = tasks.filter((t) => t.stageId === stage.id && !t.isOptional && t.status !== 'cancelled')
    return {
      stageId: stage.id,
      stageName: stage.stageName,
      totalCount: stageTasks.length,
      completedCount: stageTasks.filter((t) => t.status === 'completed').length,
      inProgressCount: stageTasks.filter((t) => t.status === 'in_progress').length,
      failedCount: stageTasks.filter((t) => t.status === 'failed').length,
      isLocked: stage.isLocked,
    }
  })

  return ctx.json({
    data: { exerciseId, stageSummaries, totalTasks: tasks.length },
    meta: { requestId: ctx.get('requestId') },
  })
})
