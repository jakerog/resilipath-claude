import { tenantCol } from '../lib/firebase.js'
import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'

interface AuditEntry {
  tenantId: string
  userId?: string
  action: string
  entityType: string
  entityId: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  requestId?: string
}

/**
 * Append-only audit log writer.
 * Fire-and-forget — does not block the request.
 * See rules.md DR-003: audit logs are never updated or deleted.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await tenantCol(entry.tenantId, 'audit_logs')
      .doc(uuidv4())
      .set({
        id: uuidv4(),
        ...entry,
        createdAt: FieldValue.serverTimestamp(),
      })
  } catch (err) {
    // Audit log failure must never break the main request
    console.error('[AUDIT LOG WRITE FAILED]', err)
  }
}
