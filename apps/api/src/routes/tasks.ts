import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { tenantCol } from '../lib/firebase.js'
import { requireRole, assertSameTenant } from '../middleware/authenticate.js'
import { AppError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { syncTaskUpdate, syncStageUpdate } from '../services/realtime-sync.js'
import { TaskStateMachine } from '../lib/state-machines/task.js'
import { StageStateMachine, GoNoGoMachine } from '../lib/state-machines/stage.js'
import { computeTaskDurations } from '../lib/duration.js'
import type { TaskDoc, StageDoc, TaskStatus, UserRole } from '@resilipath/shared-types'

export const taskRoutes = new Hono()

// ─────────────────────────────────────────────────────────────
// List all tasks for an exercise — grouped by stage order
// ─────────────────────────────────────────────────────────────
taskRoutes.get('/exercises/:exerciseId/tasks', async (ctx) => {
  const user = ctx.get('user')
  const { exerciseId } = ctx.req.param()

  const snap = await tenantCol(user.tenantId, 'tasks')
    .where('exerciseId', '==', exerciseId)
    .where('deletedAt', '==', null)
    .orderBy('taskDisplayId', 'asc')
    .get()

  const tasks = snap.docs
    .map((d) => computeTaskDurations(d.data() as TaskDoc))

  return ctx.json({
    data: tasks,
    meta: { requestId: ctx.get('requestId') },
  })
})

// Get single task
taskRoutes.get('/tasks/:id', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'tasks').doc(ctx.req.param('id')).get()

  if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = snap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  // Fetch evidence and predecessors in parallel
  const [evidenceSnap, predsSnap] = await Promise.all([
    tenantCol(user.tenantId, 'evidence_files').where('taskId', '==', task.id).get(),
    tenantCol(user.tenantId, 'task_predecessors').where('taskId', '==', task.id).get(),
  ])

  return ctx.json({
    data: {
      ...computeTaskDurations(task),
      evidence: evidenceSnap.docs.map((d) => d.data()),
      predecessors: predsSnap.docs.map((d) => d.data()),
    },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Create task (Admin only)
taskRoutes.post('/stages/:stageId/tasks', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const { stageId } = ctx.req.param()
  const body = await ctx.req.json()

  if (!body.taskName?.trim()) {
    throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'taskName is required')
  }
  if (!body.taskDisplayId) {
    throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'taskDisplayId is required')
  }

  // Verify stage exists and belongs to tenant
  const stageSnap = await tenantCol(user.tenantId, 'stages').doc(stageId).get()
  if (!stageSnap.exists) throw new AppError('STAGE_NOT_FOUND', 404, 'Stage not found')
  const stage = stageSnap.data() as StageDoc
  assertSameTenant(stage.tenantId, user.tenantId, 'Stage')

  // Check duplicate taskDisplayId within exercise
  const dupSnap = await tenantCol(user.tenantId, 'tasks')
    .where('exerciseId', '==', stage.exerciseId)
    .where('taskDisplayId', '==', body.taskDisplayId)
    .where('deletedAt', '==', null)
    .limit(1)
    .get()

  if (!dupSnap.empty) {
    throw new AppError('TASK_DUPLICATE_DISPLAY_ID', 409,
      `Task ID ${body.taskDisplayId} already exists in this exercise`)
  }

  const id = uuidv4()
  const now = FieldValue.serverTimestamp()

  const task: Record<string, unknown> = {
    id,
    tenantId: user.tenantId,
    exerciseId: stage.exerciseId,
    stageId,
    taskDisplayId: Number(body.taskDisplayId),
    taskName: body.taskName.trim(),
    description: body.description ?? null,
    workflowType: body.workflowType ?? 'sequential',
    resourceAllocation: body.resourceAllocation ?? 'single',
    status: 'not_started',
    isOptional: body.isOptional ?? false,
    isGoNoGo: body.isGoNoGo ?? false,
    goNoGoOutcome: null,
    goNoGoApprovedBy: null,
    goNoGoApprovedAt: null,
    direction: null,
    scheduledStart: null,
    estimatedDurationMinutes: body.estimatedDurationMinutes ?? null,
    actualStart: null,
    actualEnd: null,
    forecastDurationMinutes: null,
    forecastStart: null,
    forecastEnd: null,
    assignedUserIds: [],
    notes: body.notes ?? null,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  await tenantCol(user.tenantId, 'tasks').doc(id).set(task)

  // Create predecessor relationships
  if (Array.isArray(body.predecessorIds) && body.predecessorIds.length > 0) {
    const batch = tenantCol(user.tenantId, 'task_predecessors').firestore.batch()
    for (const predId of body.predecessorIds as string[]) {
      const predRef = tenantCol(user.tenantId, 'task_predecessors').doc(uuidv4())
      batch.set(predRef, {
        id: predRef.id, tenantId: user.tenantId,
        taskId: id, predecessorTaskId: predId, createdAt: now,
      })
    }
    await batch.commit()
  }

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'task.created', entityType: 'task', entityId: id,
    afterState: { taskName: task['taskName'], stageId, exerciseId: stage.exerciseId },
  })

  return ctx.json({ data: task, meta: { requestId: ctx.get('requestId') } }, 201)
})

// Update task status — the most important endpoint in the app
taskRoutes.patch('/tasks/:id/status', async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const { status, justification } = await ctx.req.json() as { status: TaskStatus; justification?: string }

  // Fetch task in transaction to prevent race conditions
  const taskRef = tenantCol(user.tenantId, 'tasks').doc(id)

  const result = await tenantCol(user.tenantId, 'tasks').firestore.runTransaction(async (tx) => {
    const snap = await tx.get(taskRef)
    if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')

    const task = snap.data() as TaskDoc
    assertSameTenant(task.tenantId, user.tenantId, 'Task')

    // Check predecessor completion for sequential tasks
    let predecessorsComplete = true
    if (task.workflowType === 'sequential' && status === 'in_progress') {
      const predsSnap = await tx.get(
        tenantCol(user.tenantId, 'task_predecessors').where('taskId', '==', id)
      )
      if (!predsSnap.empty) {
        const predIds = predsSnap.docs.map((d) => (d.data() as { predecessorTaskId: string }).predecessorTaskId)
        const predTasksSnap = await tx.get(
          tenantCol(user.tenantId, 'tasks').where('id', 'in', predIds.slice(0, 10))
        )
        const allDone = predTasksSnap.docs.every(
          (d) => (d.data() as TaskDoc).status === 'completed'
        )
        if (!allDone) predecessorsComplete = false
      }
    }

    TaskStateMachine.assertCanTransition(task.status, status, {
      role: user.role as UserRole,
      isOwner: task.assignedUserIds.includes(user.uid),
      predecessorsComplete,
      workflowType: task.workflowType,
    })

    const updates: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (status === 'in_progress' && !task.actualStart) {
      updates['actualStart'] = FieldValue.serverTimestamp()
    }
    if ((status === 'completed' || status === 'failed') && !task.actualEnd) {
      updates['actualEnd'] = FieldValue.serverTimestamp()
    }

    tx.update(taskRef, updates)
    return { before: task.status, updates, task }
  })

  // Realtime DB sync (fire-and-forget)
  void syncTaskUpdate(result.task.exerciseId, id, {
    status,
    lastUpdatedBy: user.displayName ?? user.email,
    lastUpdatedAt: Date.now(),
  })

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'task.status_updated', entityType: 'task', entityId: id,
    beforeState: { status: result.before },
    afterState: { status, justification },
  })

  return ctx.json({
    data: { id, status, ...result.updates },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Update task timing
taskRoutes.patch('/tasks/:id/timing', async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'tasks').doc(id).get()
  if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = snap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  // User can only update their own tasks
  if (user.role === 'user' && !task.assignedUserIds.includes(user.uid)) {
    throw new AppError('AUTH_NOT_TASK_OWNER', 403, 'This task is not assigned to you')
  }

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  const timeFields = ['actualStart', 'actualEnd', 'forecastStart', 'forecastEnd']

  for (const field of timeFields) {
    if (field in body && body[field]) {
      updates[field] = new Date(body[field] as string)
    }
  }
  if ('forecastDurationMinutes' in body) {
    updates['forecastDurationMinutes'] = body.forecastDurationMinutes
  }

  await tenantCol(user.tenantId, 'tasks').doc(id).update(updates)

  void syncTaskUpdate(task.exerciseId, id, {
    lastUpdatedBy: user.displayName ?? user.email,
    lastUpdatedAt: Date.now(),
  })

  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})

// Update task notes
taskRoutes.patch('/tasks/:id/notes', async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const { notes } = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'tasks').doc(id).get()
  if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = snap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  if (user.role === 'user' && !task.assignedUserIds.includes(user.uid)) {
    throw new AppError('AUTH_NOT_TASK_OWNER', 403, 'This task is not assigned to you')
  }

  await tenantCol(user.tenantId, 'tasks').doc(id).update({
    notes,
    updatedAt: FieldValue.serverTimestamp(),
  })

  void syncTaskUpdate(task.exerciseId, id, {
    notes,
    lastUpdatedBy: user.displayName ?? user.email,
    lastUpdatedAt: Date.now(),
  })

  return ctx.json({ data: { id, notes }, meta: { requestId: ctx.get('requestId') } })
})

// Go/No-Go decision
taskRoutes.patch('/tasks/:id/go-no-go', requireRole('admin', 'moderator'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const { outcome, justification } = await ctx.req.json()

  if (outcome === 'no_go' && !justification?.trim()) {
    throw new AppError('GONOGO_JUSTIFICATION_REQUIRED', 400, 'Justification is required for a no-go decision')
  }

  const taskSnap = await tenantCol(user.tenantId, 'tasks').doc(id).get()
  if (!taskSnap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = taskSnap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  // Fetch all tasks in same stage to validate prerequisites
  const stageTasksSnap = await tenantCol(user.tenantId, 'tasks')
    .where('stageId', '==', task.stageId)
    .where('deletedAt', '==', null)
    .get()

  GoNoGoMachine.assertCanDecide(task, stageTasksSnap.docs.map((d) => d.data() as TaskDoc))

  const batch = tenantCol(user.tenantId, 'tasks').firestore.batch()
  const now = FieldValue.serverTimestamp()

  // Update the Go/No-Go task
  batch.update(tenantCol(user.tenantId, 'tasks').doc(id), {
    status: outcome === 'go' ? 'completed' : 'failed',
    goNoGoOutcome: outcome,
    goNoGoApprovedBy: user.uid,
    goNoGoApprovedAt: now,
    actualEnd: now,
    updatedAt: now,
  })

  // If no_go — mark stage as failed
  if (outcome === 'no_go') {
    batch.update(tenantCol(user.tenantId, 'stages').doc(task.stageId), {
      status: 'failed',
      updatedAt: now,
    })
  }

  await batch.commit()

  void syncTaskUpdate(task.exerciseId, id, {
    status: outcome === 'go' ? 'completed' : 'failed',
    lastUpdatedBy: user.displayName ?? user.email,
    lastUpdatedAt: Date.now(),
  })

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'task.go_no_go_decision', entityType: 'task', entityId: id,
    afterState: { outcome, justification },
  })

  return ctx.json({
    data: { id, outcome, status: outcome === 'go' ? 'completed' : 'failed' },
    meta: { requestId: ctx.get('requestId') },
  })
})

// Full update (Admin back-end)
taskRoutes.put('/tasks/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'tasks').doc(id).get()
  if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = snap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  const allowed = ['taskName', 'description', 'workflowType', 'resourceAllocation',
    'isOptional', 'isGoNoGo', 'estimatedDurationMinutes', 'notes', 'stageId']

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const field of allowed) {
    if (field in body) updates[field] = body[field]
  }

  await tenantCol(user.tenantId, 'tasks').doc(id).update(updates)

  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})

// Soft delete (Admin only)
taskRoutes.delete('/tasks/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')

  const snap = await tenantCol(user.tenantId, 'tasks').doc(id).get()
  if (!snap.exists) throw new AppError('TASK_NOT_FOUND', 404, 'Task not found')
  const task = snap.data() as TaskDoc
  assertSameTenant(task.tenantId, user.tenantId, 'Task')

  if (task.status === 'in_progress') {
    throw new AppError('TASK_CANNOT_DELETE_ACTIVE', 422, 'Cannot delete a task that is in progress')
  }

  await tenantCol(user.tenantId, 'tasks').doc(id).update({
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  void writeAuditLog({
    tenantId: user.tenantId, userId: user.uid,
    action: 'task.deleted', entityType: 'task', entityId: id,
  })

  return ctx.json({ data: { id, deleted: true }, meta: { requestId: ctx.get('requestId') } })
})
