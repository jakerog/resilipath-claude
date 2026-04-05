// ─────────────────────────────────────────────────────────────
// Enums — single source of truth for all status/type values
// ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'moderator' | 'user' | 'report'

export type ExerciseStatus =
  | 'planned'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled'

export type PhaseName = 'mock_1' | 'mock_2' | 'mock_3' | 'production'

export type PhaseStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type GoNoGoOutcome = 'go' | 'no_go'

export type EventType = 'failover' | 'failback'

export type StageName =
  | 'pre_failover'
  | 'failover'
  | 'post_failover'
  | 'failover_rollback'
  | 'pre_failback'
  | 'failback'
  | 'post_failback'
  | 'failback_rollback'

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'optional'
  | 'cancelled'

export type WorkflowType = 'sequential' | 'parallel'

export type ResourceAllocation = 'single' | 'multiple'

export type VendorType = 'internal' | 'external'

export type TeamType = 'internal' | 'vendor' | 'mixed'

export type EvidenceProcessingStatus = 'pending' | 'ready' | 'quarantined' | 'failed'

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending'

export type CheckInStatus = 'pending' | 'confirmed' | 'unavailable' | 'no_response'

export type EmailDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed'

export type LessonStatus = 'open' | 'in_progress' | 'resolved'
