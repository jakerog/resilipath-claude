import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { tenantCol } from '../lib/firebase.js'
import { requireRole, assertSameTenant } from '../middleware/authenticate.js'
import { AppError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { syncStageUpdate } from '../services/realtime-sync.js'
import { StageStateMachine } from '../lib/state-machines/stage.js'
import type { StageDoc, TaskDoc } from '@resilipath/shared-types'

export const stageRoutes = new Hono()

// List stages for an event
stageRoutes.get('/events/:eventId/stages', async (ctx) => {
  const user = ctx.get('user')
  const { eventId } = ctx.req.param()

  const snap = await tenantCol(user.tenantId, 'stages')
    .where('eventId', '==', eventId)
    .orderBy('stageOrder', 'asc')
    .get()

  return ctx.json({
    data: snap.docs.map((d) => d.data()),
    meta: { requestId: ctx.get('requestId') },
  })
})

// Create stage (Admin only)
stageRoutes.post('/events/:eventId/stages', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const { eventId } = ctx.req.param()
  const body = await ctx.req.json()

  if (!body.stageName) throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'stageName is required')
  if (body.stageOrder == null) throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'stageOrder is required')

  const ROLLBACK_STAGES = ['failover_rollback', 'failback_rollback']
  const id = uuidv4()
  const now = FieldValue.serverTimestamp()

  const stage: Record<string, unknown> = {
    id,
    tenantId: user.tenantId,
    exerciseId: body.exerciseId,
    eventId,
    stageName: body.stageName,
    stageOrder: Number(body.stageOrder),
    isRollbackStage: ROLLBACK_STAGES.includes(body.stageName),
    isLocked: ROLLBACK_STAGES.includes(body.stageName), // rollback stages start locked
    lockReason: ROLLBACK_STAGES.includes(body.stageName)
      ? 'Rollback stage — locked until a preceding stage fails' : null,
    activatedAt: null,
    completedAt: null,
    scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
    scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
    actualStart: null,
    actualEnd: null,
    notes: body.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await tenantCol(user.tenantId, 'stages').doc(id).set(stage)

  return ctx.json({ data: stage, meta: { requestId: ctx.get('requestId') } }, 201)
})

// Activate rollback stage (Moderator / Admin)
stageRoutes.patch('/stages/:id/activate-rollback', requireRole('admin', 'moderator'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const { justification } = await ctx.req.json()

  const stageSnap = await tenantCol(user.tenantId, 'stages').doc(id).get()
  if (!stageSnap.exists) throw new AppError('STAGE_NOT_FOUND', 404, 'Stage not found')
  const stage = stageSnap.data() as StageDoc
  assertSameTenant(stage.tenantId, user.tenantId, 'Stage')

  // Get preceding stage tasks to check for failure
  const precedingTasksSnap = await tenantCol(user.tenantId, 'tasks')
    .where('exerciseId', '==', stage.exerciseId)
    .where('deletedAt', '==', null)
    .get()

  const isAdminOverride = user.role === 'admin' && !!justification

  StageStateMachine.assertCanActivateRollback(
    stage,
    precedingTasksSnap.docs.map((d) => d.data() as TaskDoc),
    isAdminOverride
  )

  const now = FieldValue.serverTimestamp()
  await tenantCol(user.tenantId, 'stages').doc(id).update({
    isLocked: false,
    activatedAt: now,
    updatedAt: now,
  })

  void syncStageUpdate(stage.exerciseId, id, { isLocked: false })

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'stage.rollback_activated', entityType: 'stage', entityId: id,
    afterState: { justification, isAdminOverride },
  })

  return ctx.json({
    data: { id, isLocked: false, activated: true },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Update stage timing
stageRoutes.patch('/stages/:id/timing', requireRole('admin', 'moderator'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'stages').doc(id).get()
  if (!snap.exists) throw new AppError('STAGE_NOT_FOUND', 404, 'Stage not found')
  const stage = snap.data() as StageDoc
  assertSameTenant(stage.tenantId, user.tenantId, 'Stage')

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const field of ['actualStart', 'actualEnd', 'scheduledStart', 'scheduledEnd']) {
    if (field in body && body[field]) updates[field] = new Date(body[field] as string)
  }

  await tenantCol(user.tenantId, 'stages').doc(id).update(updates)
  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})
