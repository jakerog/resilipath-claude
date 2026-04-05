import type { Context, Next } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '../lib/errors.js'

export async function requestId(ctx: Context, next: Next): Promise<void> {
  const id = (ctx.req.header('X-Request-Id') ?? uuidv4())
  ctx.set('requestId', id)
  ctx.header('X-Request-Id', id)
  await next()
}

export function errorHandler(err: Error, ctx: Context) {
  const requestId = ctx.get('requestId') ?? 'unknown'

  if (err instanceof AppError) {
    return ctx.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId,
        },
      },
      err.httpStatus as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503
    )
  }

  // Unhandled error — log full details, return generic response
  console.error('[UNHANDLED ERROR]', {
    requestId,
    message: err.message,
    stack: err.stack,
    url: ctx.req.url,
  })

  return ctx.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
    },
    500
  )
}
