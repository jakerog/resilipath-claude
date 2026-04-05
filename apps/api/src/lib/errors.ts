// All error codes — see docs/adr/ADR-009-error-handling.md
export type ErrorCode =
  // Auth
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_MALFORMED'
  | 'AUTH_INSUFFICIENT_ROLE'
  | 'AUTH_NOT_TASK_OWNER'
  | 'AUTH_TENANT_MISMATCH'
  // Validation
  | 'VALIDATION_REQUIRED_FIELD'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_INVALID_ENUM'
  | 'VALIDATION_OUT_OF_RANGE'
  | 'VALIDATION_PAYLOAD_TOO_LARGE'
  | 'VALIDATION_UNSUPPORTED_FILE_TYPE'
  | 'VALIDATION_FILE_TOO_LARGE'
  // Exercise & Phase
  | 'EXERCISE_NOT_FOUND'
  | 'EXERCISE_INVALID_STATUS_TRANSITION'
  | 'EXERCISE_CANNOT_DELETE_ACTIVE'
  | 'PHASE_NOT_FOUND'
  | 'PHASE_INVALID_ORDER'
  | 'PHASE_PRODUCTION_BLOCKED'
  | 'PHASE_MOCK3_NOT_REQUIRED'
  // Stage
  | 'STAGE_NOT_FOUND'
  | 'STAGE_LOCKED'
  | 'STAGE_ROLLBACK_ALREADY_ACTIVE'
  | 'STAGE_ROLLBACK_NO_FAILURE'
  // Task
  | 'TASK_NOT_FOUND'
  | 'TASK_INVALID_STATUS_TRANSITION'
  | 'TASK_PREDECESSOR_NOT_MET'
  | 'TASK_NOT_ASSIGNED_TO_USER'
  | 'TASK_CANNOT_DELETE_ACTIVE'
  | 'TASK_DUPLICATE_DISPLAY_ID'
  | 'TASK_PREDECESSOR_CIRCULAR'
  | 'TASK_PREDECESSOR_CROSS_EXERCISE'
  // Go/No-Go
  | 'GONOGO_NOT_APPLICABLE'
  | 'GONOGO_PREREQUISITES_INCOMPLETE'
  | 'GONOGO_ALREADY_DECIDED'
  | 'GONOGO_JUSTIFICATION_REQUIRED'
  // Entities
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_IN_TEAM'
  | 'TEAM_NOT_FOUND'
  | 'VENDOR_NOT_FOUND'
  // Upload
  | 'UPLOAD_PRESIGN_DENIED'
  | 'UPLOAD_FILE_QUARANTINED'
  | 'UPLOAD_PROCESSING_FAILED'
  | 'EVIDENCE_NOT_FOUND'
  // Import
  | 'IMPORT_INVALID_FILE_FORMAT'
  | 'IMPORT_FILE_TOO_LARGE'
  | 'IMPORT_TOO_MANY_ROWS'
  | 'IMPORT_NO_TASK_NAME_COLUMN'
  | 'IMPORT_CIRCULAR_PREDECESSORS'
  | 'IMPORT_JOB_NOT_FOUND'
  | 'IMPORT_JOB_ALREADY_CONFIRMED'
  // System
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'FIRESTORE_UNAVAILABLE'
  | 'REALTIME_DB_UNAVAILABLE'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Convenience factories
export const Errors = {
  notFound: (entity: string, id: string) =>
    new AppError('EXERCISE_NOT_FOUND' as ErrorCode, 404, `${entity} '${id}' not found`),

  unauthorized: () =>
    new AppError('AUTH_TOKEN_MISSING', 401, 'Authentication required'),

  forbidden: (reason?: string) =>
    new AppError('AUTH_INSUFFICIENT_ROLE', 403, reason ?? 'Insufficient permissions'),

  taskNotOwned: (taskId: string) =>
    new AppError('AUTH_NOT_TASK_OWNER', 403, `Task '${taskId}' is not assigned to you`, { taskId }),

  predecessorNotMet: (taskId: string, blockingIds: string[]) =>
    new AppError(
      'TASK_PREDECESSOR_NOT_MET', 422,
      `Task cannot be started: predecessor tasks are not yet completed`,
      { taskId, blockingPredecessorIds: blockingIds }
    ),

  invalidTransition: (from: string, to: string) =>
    new AppError(
      'TASK_INVALID_STATUS_TRANSITION', 422,
      `Cannot transition task from '${from}' to '${to}'`,
      { from, to }
    ),

  stageLocked: (stageId: string) =>
    new AppError('STAGE_LOCKED', 422, `Stage '${stageId}' is locked (rollback stage)`, { stageId }),

  validation: (field: string, message: string) =>
    new AppError('VALIDATION_REQUIRED_FIELD', 400, `${field}: ${message}`, { field }),
}
