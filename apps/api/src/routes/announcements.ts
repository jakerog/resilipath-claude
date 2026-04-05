import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { requireRole } from '../middleware/authenticate.js'
import { AppError } from '../lib/errors.js'
import { syncAnnouncement } from '../services/realtime-sync.js'

export const announcementRoutes = new Hono()

announcementRoutes.post('/exercises/:id/announce', requireRole('admin', 'moderator'), async (ctx) => {
  const user = ctx.get('user')
  const exerciseId = ctx.req.param('id')
  const body = await ctx.req.json()

  if (!body.message?.trim()) {
    throw new AppError('VALIDATION_REQUIRED_FIELD', 400, 'message is required')
  }

  const displayForSeconds = body.displayForSeconds ?? 30
  const announcementId = uuidv4()
  const now = Date.now()

  await syncAnnouncement(exerciseId, announcementId, {
    message: body.message.trim(),
    sentBy: user.displayName ?? user.email,
    sentAt: now,
    displayUntil: now + displayForSeconds * 1000,
    priority: body.priority ?? 'normal',
  })

  return ctx.json({
    data: { announcementId, exerciseId, message: body.message },
    meta: { requestId: ctx.get('requestId') },
  })
})
