import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { tenantCol } from '../lib/firebase.js'
import { requireRole, assertSameTenant } from '../middleware/authenticate.js'
import { AppError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import type { ResourceDoc, TeamDoc, VendorDoc } from '@resilipath/shared-types'

export const entityRoutes = new Hono()

// ─── RESOURCES ────────────────────────────────────────────────

entityRoutes.get('/resources', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'resources')
    .where('deletedAt', '==', null)
    .orderBy('fullName')
    .get()
  return ctx.json({ data: snap.docs.map((d) => d.data()), meta: { requestId: ctx.get('requestId') } })
})

entityRoutes.post('/resources', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const body = await ctx.req.json()
  if (!body.fullName?.trim()) throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'fullName is required')

  const id = uuidv4()
  const now = FieldValue.serverTimestamp()
  const resource: Record<string, unknown> = {
    id, tenantId: user.tenantId,
    userId: body.userId ?? null,
    fullName: body.fullName.trim(),
    email: body.email ?? null,
    phoneMobile: body.phoneMobile ?? null,
    phoneWork: body.phoneWork ?? null,
    photoUrl: null,
    title: body.title ?? null,
    department: body.department ?? null,
    notes: body.notes ?? null,
    isActive: true,
    createdAt: now, updatedAt: now, deletedAt: null,
  }

  await tenantCol(user.tenantId, 'resources').doc(id).set(resource)
  void writeAuditLog({ tenantId: user.tenantId, userId: user.uid, action: 'resource.created', entityType: 'resource', entityId: id })
  return ctx.json({ data: resource, meta: { requestId: ctx.get('requestId') } }, 201)
})

entityRoutes.get('/resources/:id', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'resources').doc(ctx.req.param('id')).get()
  if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource not found')
  const r = snap.data() as ResourceDoc
  assertSameTenant(r.tenantId, user.tenantId, 'Resource')
  return ctx.json({ data: r, meta: { requestId: ctx.get('requestId') } })
})

entityRoutes.put('/resources/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'resources').doc(id).get()
  if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource not found')
  assertSameTenant((snap.data() as ResourceDoc).tenantId, user.tenantId, 'Resource')

  const allowed = ['fullName', 'email', 'phoneMobile', 'phoneWork', 'title', 'department', 'notes', 'isActive', 'userId']
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const f of allowed) { if (f in body) updates[f] = body[f] }

  await tenantCol(user.tenantId, 'resources').doc(id).update(updates)
  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})

entityRoutes.delete('/resources/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const snap = await tenantCol(user.tenantId, 'resources').doc(id).get()
  if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource not found')
  assertSameTenant((snap.data() as ResourceDoc).tenantId, user.tenantId, 'Resource')
  await tenantCol(user.tenantId, 'resources').doc(id).update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return ctx.json({ data: { id, deleted: true }, meta: { requestId: ctx.get('requestId') } })
})

// ─── TEAMS ────────────────────────────────────────────────────

entityRoutes.get('/teams', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'teams').where('deletedAt', '==', null).orderBy('teamName').get()
  return ctx.json({ data: snap.docs.map((d) => d.data()), meta: { requestId: ctx.get('requestId') } })
})

entityRoutes.post('/teams', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const body = await ctx.req.json()
  if (!body.teamName?.trim()) throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'teamName is required')

  const id = uuidv4()
  const now = FieldValue.serverTimestamp()
  const team: Record<string, unknown> = {
    id, tenantId: user.tenantId,
    teamName: body.teamName.trim(),
    description: body.description ?? null,
    vendorId: body.vendorId ?? null,
    logoUrl: null,
    teamType: body.teamType ?? 'internal',
    isActive: true,
    createdAt: now, updatedAt: now, deletedAt: null,
  }

  await tenantCol(user.tenantId, 'teams').doc(id).set(team)
  return ctx.json({ data: team, meta: { requestId: ctx.get('requestId') } }, 201)
})

entityRoutes.put('/teams/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'teams').doc(id).get()
  if (!snap.exists) throw new AppError('TEAM_NOT_FOUND', 404, 'Team not found')
  assertSameTenant((snap.data() as TeamDoc).tenantId, user.tenantId, 'Team')

  const allowed = ['teamName', 'description', 'vendorId', 'teamType', 'isActive']
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const f of allowed) { if (f in body) updates[f] = body[f] }

  await tenantCol(user.tenantId, 'teams').doc(id).update(updates)
  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})

// Add resource to team
entityRoutes.post('/teams/:id/resources', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const teamId = ctx.req.param('id')
  const { resourceId, roleInTeam, isLead } = await ctx.req.json()

  // Verify both exist
  const [teamSnap, resSnap] = await Promise.all([
    tenantCol(user.tenantId, 'teams').doc(teamId).get(),
    tenantCol(user.tenantId, 'resources').doc(resourceId).get(),
  ])
  if (!teamSnap.exists) throw new AppError('TEAM_NOT_FOUND', 404, 'Team not found')
  if (!resSnap.exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource not found')

  // Check duplicate
  const existingSnap = await tenantCol(user.tenantId, 'team_resources')
    .where('teamId', '==', teamId).where('resourceId', '==', resourceId).limit(1).get()
  if (!existingSnap.empty) throw new AppError('RESOURCE_ALREADY_IN_TEAM', 409, 'Resource is already in this team')

  const id = uuidv4()
  await tenantCol(user.tenantId, 'team_resources').doc(id).set({
    id, tenantId: user.tenantId, teamId, resourceId,
    roleInTeam: roleInTeam ?? null,
    isLead: isLead ?? false,
    createdAt: FieldValue.serverTimestamp(),
  })

  return ctx.json({ data: { id, teamId, resourceId }, meta: { requestId: ctx.get('requestId') } }, 201)
})

// Remove resource from team
entityRoutes.delete('/teams/:id/resources/:resourceId', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const { id: teamId, resourceId } = ctx.req.param()

  const snap = await tenantCol(user.tenantId, 'team_resources')
    .where('teamId', '==', teamId).where('resourceId', '==', resourceId).limit(1).get()

  if (snap.empty) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Resource is not in this team')
  await snap.docs[0]!.ref.delete()

  return ctx.json({ data: { deleted: true }, meta: { requestId: ctx.get('requestId') } })
})

// ─── VENDORS ──────────────────────────────────────────────────

entityRoutes.get('/vendors', async (ctx) => {
  const user = ctx.get('user')
  const snap = await tenantCol(user.tenantId, 'vendors').where('deletedAt', '==', null).orderBy('vendorName').get()
  return ctx.json({ data: snap.docs.map((d) => d.data()), meta: { requestId: ctx.get('requestId') } })
})

entityRoutes.post('/vendors', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const body = await ctx.req.json()
  if (!body.vendorName?.trim()) throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'vendorName is required')

  const id = uuidv4()
  const now = FieldValue.serverTimestamp()
  const vendor: Record<string, unknown> = {
    id, tenantId: user.tenantId,
    vendorName: body.vendorName.trim(),
    vendorType: body.vendorType ?? 'external',
    contactEmail: body.contactEmail ?? null,
    contactPhone: body.contactPhone ?? null,
    logoUrl: null,
    website: body.website ?? null,
    notes: body.notes ?? null,
    isActive: true,
    createdAt: now, updatedAt: now, deletedAt: null,
  }

  await tenantCol(user.tenantId, 'vendors').doc(id).set(vendor)
  return ctx.json({ data: vendor, meta: { requestId: ctx.get('requestId') } }, 201)
})

entityRoutes.put('/vendors/:id', requireRole('admin'), async (ctx) => {
  const user = ctx.get('user')
  const id = ctx.req.param('id')
  const body = await ctx.req.json()

  const snap = await tenantCol(user.tenantId, 'vendors').doc(id).get()
  if (!snap.exists) throw new AppError('VENDOR_NOT_FOUND', 404, 'Vendor not found')
  assertSameTenant((snap.data() as VendorDoc).tenantId, user.tenantId, 'Vendor')

  const allowed = ['vendorName', 'vendorType', 'contactEmail', 'contactPhone', 'website', 'notes', 'isActive']
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const f of allowed) { if (f in body) updates[f] = body[f] }

  await tenantCol(user.tenantId, 'vendors').doc(id).update(updates)
  return ctx.json({ data: { id, ...updates }, meta: { requestId: ctx.get('requestId') } })
})
