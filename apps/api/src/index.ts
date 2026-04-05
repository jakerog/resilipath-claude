import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requestId, errorHandler } from './middleware/request-id.js'
import { authenticate } from './middleware/authenticate.js'
import { exerciseRoutes } from './routes/exercises.js'
import { taskRoutes } from './routes/tasks.js'
import { stageRoutes } from './routes/stages.js'
import { entityRoutes } from './routes/entities.js'
import { authRoutes, reportRoutes } from './routes/auth.js'
import { announcementRoutes } from './routes/announcements.js'

const app = new Hono()

// ─── Global middleware ──────────────────────────────────────
app.use('*', requestId)
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://resilipath.app',
      'https://www.resilipath.app',
      /^https:\/\/.*\.resilipath\.app$/,
      'http://localhost:5173',
      'http://localhost:3000',
    ]
    return allowed.some((p) =>
      typeof p === 'string' ? p === origin : p.test(origin ?? '')
    ) ? origin ?? '' : ''
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 3600,
}))

// ─── Health check (no auth) ─────────────────────────────────
app.get('/health', (ctx) =>
  ctx.json({ status: 'ok', version: process.env['npm_package_version'] ?? '0.1.0' })
)
app.get('/ready', async (ctx) => {
  // Could ping Firestore here — for now just return ok
  return ctx.json({ status: 'ready' })
})

// ─── Auth middleware for all /v1 routes ─────────────────────
app.use('/v1/*', authenticate)

// ─── Route mounting ─────────────────────────────────────────
app.route('/v1/auth', authRoutes)
app.route('/v1/exercises', exerciseRoutes)
app.route('/v1', taskRoutes)        // /v1/exercises/:id/tasks, /v1/tasks/:id
app.route('/v1', stageRoutes)       // /v1/events/:id/stages, /v1/stages/:id
app.route('/v1', entityRoutes)      // /v1/resources, /v1/teams, /v1/vendors
app.route('/v1', reportRoutes)      // /v1/exercises/:id/report, /v1/exercises/:id/bridge-snapshot
app.route('/v1', announcementRoutes)// /v1/exercises/:id/announce

// ─── Global error handler ───────────────────────────────────
app.onError(errorHandler)

// ─── 404 fallthrough ────────────────────────────────────────
app.notFound((ctx) =>
  ctx.json({ error: { code: 'NOT_FOUND', message: `Route not found: ${ctx.req.method} ${ctx.req.path}`, requestId: ctx.get('requestId') } }, 404)
)

// ─── Server startup ─────────────────────────────────────────
const PORT = Number(process.env['PORT'] ?? 8080)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`ResiliPath API running on port ${info.port}`)
})

export default app
