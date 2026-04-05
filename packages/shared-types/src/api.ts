import type { TaskStatus, GoNoGoOutcome, StageName } from './enums.js'

// ─────────────────────────────────────────────────────────────
// Standard API response envelopes
// ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  meta: { requestId: string }
}

export interface ApiList<T> {
  data: T[]
  pagination: {
    cursor?: string
    hasNext: boolean
    totalCount?: number
  }
  meta: { requestId: string }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    requestId: string
  }
}

// ─────────────────────────────────────────────────────────────
// Exercise API types
// ─────────────────────────────────────────────────────────────

export interface CreateExerciseBody {
  exerciseName: string
  description?: string
  applicationName?: string
  primaryRegion?: string
  secondaryRegion?: string
  startDate?: string
  endDate?: string
  ownerId?: string
  notes?: string
}

export interface UpdateExerciseStatusBody {
  status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
}

// ─────────────────────────────────────────────────────────────
// Task API types
// ─────────────────────────────────────────────────────────────

export interface CreateTaskBody {
  taskDisplayId: number
  taskName: string
  description?: string
  workflowType: 'sequential' | 'parallel'
  resourceAllocation: 'single' | 'multiple'
  isOptional?: boolean
  isGoNoGo?: boolean
  estimatedDurationMinutes?: number
  predecessorIds?: string[]
  resourceIds?: string[]
  teamId?: string
  notes?: string
}

export interface UpdateTaskStatusBody {
  status: TaskStatus
  justification?: string      // required for some transitions
}

export interface UpdateTaskTimingBody {
  actualStart?: string        // ISO datetime string
  actualEnd?: string
  forecastStart?: string
  forecastEnd?: string
  forecastDurationMinutes?: number
}

export interface GoNoGoDecisionBody {
  outcome: GoNoGoOutcome
  justification?: string      // required for 'no_go'
  approverIds?: string[]
}

// ─────────────────────────────────────────────────────────────
// Stage API types
// ─────────────────────────────────────────────────────────────

export interface ActivateRollbackBody {
  justification: string
}

export interface CreateStageBody {
  stageName: StageName
  stageOrder: number
  eventId: string
  scheduledStart?: string
  scheduledEnd?: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────
// Resource / Team / Vendor API types
// ─────────────────────────────────────────────────────────────

export interface CreateResourceBody {
  fullName: string
  email?: string
  phoneMobile?: string
  phoneWork?: string
  title?: string
  department?: string
  notes?: string
  userId?: string
}

export interface CreateTeamBody {
  teamName: string
  description?: string
  vendorId?: string
  teamType: 'internal' | 'vendor' | 'mixed'
}

export interface CreateVendorBody {
  vendorName: string
  vendorType: 'internal' | 'external'
  contactEmail?: string
  contactPhone?: string
  website?: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────
// Auth API types
// ─────────────────────────────────────────────────────────────

export interface MeResponse {
  userId: string
  tenantId: string
  role: string
  email: string
  displayName?: string
  avatarUrl?: string
}

// ─────────────────────────────────────────────────────────────
// Upload API types
// ─────────────────────────────────────────────────────────────

export interface PresignUploadBody {
  entityType: 'task' | 'team' | 'resource' | 'vendor' | 'exercise'
  entityId: string
  fileName: string
  fileType: string
  fileSizeBytes: number
}

export interface PresignUploadResponse {
  fileId: string
  uploadUrl: string
  expiresAt: string
}

export interface ConfirmUploadBody {
  fileId: string
}

// ─────────────────────────────────────────────────────────────
// Announcement API types
// ─────────────────────────────────────────────────────────────

export interface AnnounceBody {
  message: string
  displayForSeconds?: number
  priority?: 'normal' | 'urgent'
}

// ─────────────────────────────────────────────────────────────
// Report API types
// ─────────────────────────────────────────────────────────────

export interface StageTimingSummary {
  stageId: string
  stageName: string
  estimatedDurationMinutes: number
  actualDurationMinutes: number | null
  varianceDurationMinutes: number | null
}

export interface TeamPerformanceSummary {
  teamId: string
  teamName: string
  taskCount: number
  completedCount: number
  failedCount: number
  avgActualDurationMinutes: number | null
  avgVarianceDurationMinutes: number | null
}

export interface ExerciseReportSummary {
  totalEstimatedMinutes: number
  totalActualMinutes: number | null
  totalVarianceMinutes: number | null
  completedTaskCount: number
  totalTaskCount: number
  failedTaskCount: number
  stageTimings: StageTimingSummary[]
  teamPerformance: TeamPerformanceSummary[]
}
