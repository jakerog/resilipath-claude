import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { tenantCol } from '../lib/firebase.js'
import { requireRole, assertSameTenant } from '../middleware/authenticate.js'
import { AppError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { syncExerciseMeta } from '../services/realtime-sync.js'
import type { ExerciseDoc } from '@resilipath/shared-types'

const VALID_STATUSES = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const

export const exerciseRoutes = new Hono()

// List exercises
exerciseRoutes.get('/', async (ctx) => {
  const user = ctx.get('user')
  const { status, limit = '50', cursor } = ctx.req.query()

  let query = tenantCol(user.tenantId, 'exercises')
    .where('deletedAt', '==', null)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Number(limit), 200))

  if (status) query = query.where('status', '==', status) as typeof query
  if (cursor) query = query.startAfter(cursor) as typeof query

  const snap = await query.get()
  const exercises = snap.docs.map((d) => d.data() as ExerciseDoc)

  return ctx.json({
    data: exercises,
    pagination: {
      cursor: snap.docs[snap.docs.length - 1]?.id,
      hasNext: snap.docs.length === Number(limit),
    },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Get single exercise
exerciseRoutes.get('/:id', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'exercises').doc(ctx.req.param('id')).get()

  if (!snap.exists) {
    throw new AppError('EXERCISE_NOT_FOUND', 404, `Exercise not found`)
  }

  const exercise = snap.data() as ExerciseDoc
  assertSameTenant(exercise.tenantId, user.tenantId, 'Exercise')

  // Attach phase summary counts
  const phasesSnap = await tenantCol(user.tenantId, 'exercise_phases')
    .where('exerciseId', '==', exercise.id)
    .orderBy('phaseOrder')
    .get()

  return ctx.json({
    data: { ...exercise, phases: phasesSnap.docs.map((d) => d.data()) },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Create exercise (Admin only)
exerciseRoutes.post('/', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const body = await ctx.req.json()

  if (!body.exerciseName?.trim()) {
    throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'exerciseName is required')
  }

  const id = uuidv4()
  const now = FieldValue.serverTimestamp()

  const exercise: Omit<ExerciseDoc, 'createdAt' | 'updatedAt'> & Record<string, unknown> = {
    id,
    tenantId: user.tenantId,
    exerciseName: body.exerciseName.trim(),
    description: body.description ?? null,
    applicationName: body.applicationName ?? null,
    primaryRegion: body.primaryRegion ?? null,
    secondaryRegion: body.secondaryRegion ?? null,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    ownerId: body.ownerId ?? null,
    status: 'planned',
    photoUrl: null,
    notes: body.notes ?? null,
    currentPhase: null,
    mock3Required: false,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  await tenantCol(user.tenantId, 'exercises').doc(id).set(exercise)

  void writeAuditLog({
    tenantId: user.tenantId,
    userId: user.uid,
    action: 'exercise.created',
    entityType: 'exercise',
    entityId: id,
    afterState: { exerciseName: exercise.exerciseName, status: 'planned' },
  })

  return ctx.json({ data: { id, ...exercise }, meta: { requestId: ctx.get('requestId') } }, 201)
})

// Update exercise (Admin only)
exerciseRoutes.put('/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const ref = tenantCol(user.tenantId, 'exercises').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new AppError('EXERCISE_NOT_FOUND', 404, 'Exercise not found')

  const before = snap.data() as ExerciseDoc
  assertSameTenant(before.tenantId, user.tenantId, 'Exercise')

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  const allowed = ['exerciseName', 'description', 'applicationName', 'primaryRegion',
    'secondaryRegion', 'startDate', 'endDate', 'ownerId', 'notes', 'mock3Required']

  for (const field of allowed) {
    if (field in body) updates[field] = body[field]
  }

  await ref.update(updates)

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'exercise.updated', entityType: 'exercise', entityId: id,
    beforeState: before as unknown as Record<string, unknown>,
    afterState: updates,
  })

  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})

// Transition exercise status
exerciseRoutes.patch('/:id/status', requireRole('admin', 'moderator'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const { status } = await ctx.req.json()

  if (!VALID_STATUSES.includes(status)) {
    throw new AppError('VALIDATION_INVALID_ENUM', 400, `Invalid status: ${status}`)
  }

  const ref = tenantCol(user.tenantId, 'exercises').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new AppError('EXERCISE_NOT_FOUND', 404, 'Exercise not found')

  const before = snap.data() as ExerciseDoc
  assertSameTenant(before.tenantId, user.tenantId, 'Exercise')

  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })

  void syncExerciseMeta(id, { status })
  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'exercise.status_changed', entityType: 'exercise', entityId: id,
    beforeState: { status: before.status }, afterState: { status },
  })

  return ctx.json({ data: { id, status }, meta: { requestId: ctx.get('requestId') } })
})

// Soft delete exercise (Admin only)
exerciseRoutes.delete('/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')

  const ref = tenantCol(user.tenantId, 'exercises').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new AppError('EXERCISE_NOT_FOUND', 404, 'Exercise not found')

  const exercise = snap.data() as ExerciseDoc
  assertSameTenant(exercise.tenantId, user.tenantId, 'Exercise')

  if (exercise.status === 'in_progress') {
    throw new AppError('EXERCISE_CANNOT_DELETE_ACTIVE', 422, 'Cannot delete an in-progress exercise')
  }

  await ref.update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'exercise.deleted', entityType: 'exercise', entityId: id,
  })

  return ctx.json({ data: { id, deleted: true }, meta: { requestId: ctx.get('requestId') } })
})
