import type {
  UserRole,
  UserStatus,
  ExerciseStatus,
  PhaseName,
  PhaseStatus,
  GoNoGoOutcome,
  EventType,
  StageName,
  TaskStatus,
  WorkflowType,
  ResourceAllocation,
  VendorType,
  TeamType,
  EvidenceProcessingStatus,
  CheckInStatus,
  EmailDeliveryStatus,
  LessonStatus,
} from './enums.js'

// Firestore Timestamp type (works with both admin and client SDK)
export type Timestamp = {
  toDate(): Date
  toMillis(): number
  seconds: number
  nanoseconds: number
}

// ─────────────────────────────────────────────────────────────
// Top-level collections (not tenant-scoped)
// ─────────────────────────────────────────────────────────────

export interface TenantDoc {
  id: string
  name: string
  slug: string
  planTier: 'starter' | 'professional' | 'enterprise'
  status: 'active' | 'suspended' | 'cancelled'
  logoUrl?: string
  primaryColor?: string
  appName?: string
  timezone: string
  industrySector?: string
  country?: string
  mfaRequired: boolean
  sessionTimeoutHours: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface UserDoc {
  id: string
  tenantId: string
  authProviderId: string
  email: string
  firstName?: string
  lastName?: string
  displayName?: string
  role: UserRole
  status: UserStatus
  phoneMobile?: string
  phoneWork?: string
  avatarUrl?: string
  fcmToken?: string
  lastLoginAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

// ─────────────────────────────────────────────────────────────
// Tenant-scoped collections
// Path: tenants/{tenantId}/{collection}/{docId}
// ─────────────────────────────────────────────────────────────

export interface ExerciseDoc {
  id: string
  tenantId: string
  exerciseName: string
  description?: string
  applicationName?: string
  primaryRegion?: string
  secondaryRegion?: string
  startDate?: string        // ISO date string YYYY-MM-DD
  endDate?: string
  ownerId?: string          // references ResourceDoc.id
  status: ExerciseStatus
  photoUrl?: string
  notes?: string
  currentPhase?: PhaseName
  mock3Required: boolean
  createdBy: string         // UserDoc.id
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export interface ExercisePhaseDoc {
  id: string
  tenantId: string
  exerciseId: string
  phaseName: PhaseName
  phaseOrder: number        // 1=mock_1, 2=mock_2, 3=mock_3, 4=production
  status: PhaseStatus
  goNoGoOutcome?: GoNoGoOutcome
  goNoGoNotes?: string
  goNoGoDecidedBy?: string  // UserDoc.id
  goNoGoDecidedAt?: Timestamp
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ExerciseEventDoc {
  id: string
  tenantId: string
  phaseId: string
  eventType: EventType
  direction: string         // e.g. 'Primary → Secondary'
  scheduledStart?: Timestamp
  scheduledEnd?: Timestamp
  actualStart?: Timestamp
  actualEnd?: Timestamp
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface StageDoc {
  id: string
  tenantId: string
  exerciseId: string
  eventId: string
  stageName: StageName
  stageOrder: number
  isRollbackStage: boolean
  isLocked: boolean
  lockReason?: string
  activatedAt?: Timestamp
  completedAt?: Timestamp
  scheduledStart?: Timestamp
  scheduledEnd?: Timestamp
  actualStart?: Timestamp
  actualEnd?: Timestamp
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TaskDoc {
  id: string
  tenantId: string
  exerciseId: string
  stageId: string
  taskDisplayId: number
  taskName: string
  description?: string
  workflowType: WorkflowType
  resourceAllocation: ResourceAllocation
  status: TaskStatus
  isOptional: boolean
  isGoNoGo: boolean
  goNoGoOutcome?: GoNoGoOutcome
  goNoGoApprovedBy?: string   // UserDoc.id
  goNoGoApprovedAt?: Timestamp
  direction?: EventType
  scheduledStart?: Timestamp
  estimatedDurationMinutes?: number
  actualStart?: Timestamp
  actualEnd?: Timestamp
  forecastDurationMinutes?: number
  forecastStart?: Timestamp
  forecastEnd?: Timestamp
  // assignedUserIds — denormalized list of Firebase Auth UIDs for Firestore rules
  assignedUserIds: string[]
  notes?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

// Computed — never stored, always derived at read time
export interface TaskComputed {
  actualDurationMinutes: number | null
  varianceDurationMinutes: number | null
}

export type TaskWithComputed = TaskDoc & TaskComputed

export interface TaskPredecessorDoc {
  id: string
  tenantId: string
  taskId: string
  predecessorTaskId: string
  createdAt: Timestamp
}

export interface TaskResourceDoc {
  id: string
  tenantId: string
  taskId: string
  resourceId: string
  isPrimary: boolean
  assignedBy: string          // UserDoc.id
  assignedAt: Timestamp
}

export interface ResourceDoc {
  id: string
  tenantId: string
  userId?: string             // UserDoc.id — nullable if resource has no login
  fullName: string
  email?: string
  phoneMobile?: string
  phoneWork?: string
  photoUrl?: string
  title?: string
  department?: string
  notes?: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export interface TeamDoc {
  id: string
  tenantId: string
  teamName: string
  description?: string
  vendorId?: string
  logoUrl?: string
  teamType: TeamType
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export interface TeamResourceDoc {
  id: string
  tenantId: string
  teamId: string
  resourceId: string
  roleInTeam?: string
  isLead: boolean
  createdAt: Timestamp
}

export interface VendorDoc {
  id: string
  tenantId: string
  vendorName: string
  vendorType: VendorType
  contactEmail?: string
  contactPhone?: string
  logoUrl?: string
  website?: string
  notes?: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export interface EvidenceFileDoc {
  id: string
  tenantId: string
  taskId?: string
  entityType: 'task' | 'team' | 'resource' | 'vendor' | 'exercise'
  entityId: string
  fileName: string
  fileType: string            // MIME type
  fileSizeBytes?: number
  storageKey: string          // GCS object path
  sha256Checksum?: string
  uploadedBy: string          // UserDoc.id
  processingStatus: EvidenceProcessingStatus
  thumbnailUrl?: string
  notes?: string
  createdAt: Timestamp
  deletedAt?: Timestamp
}

export interface AuditLogDoc {
  id: string
  tenantId: string
  userId?: string
  action: string              // e.g. 'task.status_updated'
  entityType: string
  entityId: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  createdAt: Timestamp
  // NOTE: No updatedAt, no deletedAt — append-only
}

export interface ResourceCheckInDoc {
  id: string
  tenantId: string
  exerciseId: string
  phaseId: string
  resourceId: string
  status: CheckInStatus
  confirmationToken: string
  invitedAt: Timestamp
  deadlineAt: Timestamp
  respondedAt?: Timestamp
  availabilityNotes?: string
  backupResourceId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EmailListDoc {
  id: string
  tenantId: string
  listName: string
  description?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EmailListMemberDoc {
  id: string
  listId: string
  email: string
  displayName?: string
  sourceType: 'resource' | 'manual' | 'import'
  sourceId?: string
}

export interface EmailTemplateDoc {
  id: string
  tenantId: string
  templateName: string
  subject: string
  htmlBody: string
  textBody?: string
  variables: string[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EmailScheduleDoc {
  id: string
  tenantId: string
  templateId: string
  listIds: string[]
  exerciseId?: string
  scheduleType: 'absolute' | 'relative'
  scheduledAt?: Timestamp
  relativeOffsetHours?: number
  relativeAnchor?: 'exercise_start' | 'exercise_end'
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sentAt?: Timestamp
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EmailDeliveryDoc {
  id: string
  tenantId: string
  scheduleId: string
  recipientEmail: string
  status: EmailDeliveryStatus
  providerMessageId?: string
  attempts: number
  lastAttemptedAt?: Timestamp
  sentAt?: Timestamp
  errorMessage?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
