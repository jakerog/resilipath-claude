import type { Context, Next } from 'hono'
import { getFirebaseAuth } from '../lib/firebase.js'
import { AppError } from '../lib/errors.js'

export interface AuthUser {
  uid: string
  email: string
  tenantId: string
  role: string
  displayName?: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
    requestId: string
  }
}

/**
 * Validates Firebase ID token on every request.
 * Extracts uid, tenantId, role from custom claims.
 * Attaches to ctx.var.user.
 */
export async function authenticate(ctx: Context, next: Next): Promise<void> {
  const authHeader = ctx.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('AUTH_TOKEN_MISSING', 401, 'Authorization header is required')
  }

  const token = authHeader.slice(7)

  try {
    const auth = getFirebaseAuth()
    const decoded = await auth.verifyIdToken(token, true) // checkRevoked=true

    const tenantId = decoded['tenantId'] as string | undefined
    const role = decoded['role'] as string | undefined

    if (!tenantId || !role) {
      throw new AppError(
        'AUTH_TOKEN_MALFORMED',
        401,
        'Token missing required claims (tenantId, role). Ensure your account is fully set up.'
      )
    }

    ctx.set('user', {
      uid: decoded.uid,
      email: decoded.email ?? '',
      tenantId,
      role,
      displayName: decoded.name,
    })
  } catch (err) {
    if (err instanceof AppError) throw err

    const message = err instanceof Error ? err.message : 'Token validation failed'

    if (message.includes('expired')) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 401, 'Token has expired — please sign in again')
    }
    if (message.includes('revoked')) {
      throw new AppError('AUTH_TOKEN_INVALID', 401, 'Token has been revoked — please sign in again')
    }
    throw new AppError('AUTH_TOKEN_INVALID', 401, 'Invalid authentication token')
  }

  await next()
}

/**
 * Require a specific role (or higher) for a route.
 * Usage: app.use('/admin/*', requireRole('admin'))
 */
export function requireRole(...roles: string[]) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const user = ctx.get('user')
    if (!user) {
      throw new AppError('AUTH_TOKEN_MISSING', 401, 'Authentication required')
    }
    if (!roles.includes(user.role)) {
      throw new AppError(
        'AUTH_INSUFFICIENT_ROLE',
        403,
        `This action requires one of: ${roles.join(', ')}`
      )
    }
    await next()
  }
}

/**
 * Validates that a resource entity belongs to the requesting user's tenant.
 * Returns 404 (not 403) to avoid leaking existence of cross-tenant resources.
 */
export function assertSameTenant(
  entityTenantId: string,
  requestingTenantId: string,
  entityType = 'Resource'
): void {
  if (entityTenantId !== requestingTenantId) {
    throw new AppError(
      'AUTH_TENANT_MISMATCH',
      404,
      `${entityType} not found`
    )
  }
}
