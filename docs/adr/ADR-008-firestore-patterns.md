# ADR-008: Firestore Data Patterns
**Status:** ACCEPTED  
**Date:** 2026-03-29  
**Author:** AGENT-002 (Architect)  

---

## Context
Firestore is a NoSQL document database with fundamentally different query capabilities from PostgreSQL. Patterns that are trivial in SQL (JOINs, generated columns, ORDER BY across collections) require deliberate design in Firestore. This ADR documents the standard patterns all AI coding agents must follow when reading and writing Firestore data in ResiliPath.

Violating these patterns is the most common cause of unexpected Firestore free-tier quota exhaustion and data consistency bugs.

---

## Pattern 1: Tenant Namespace Isolation

**Rule:** Every collection is nested under `tenants/{tenantId}/`. No top-level collections hold tenant-specific data except `users/` (which maps to Firebase Auth UIDs).

```typescript
// CORRECT
const exercisesRef = db
  .collection('tenants').doc(tenantId)
  .collection('exercises')

// WRONG — no tenant scoping
const exercisesRef = db.collection('exercises')
```

**Why:** Firestore Security Rules enforce tenant isolation by checking `request.auth.token.tenantId == resource.data.tenantId`. The nested path makes this check declarative and impossible to accidentally omit.

---

## Pattern 2: Computed Fields at Read Time (No Generated Columns)

Firestore has no computed/generated columns. `actualDurationMinutes` and `varianceDurationMinutes` are computed in the service layer on every read, never stored.

```typescript
// service layer — always compute, never store
function computeTaskDurations(task: TaskDoc): TaskDoc & ComputedFields {
  const actualDurationMinutes = task.actualEnd && task.actualStart
    ? Math.round((task.actualEnd.toMillis() - task.actualStart.toMillis()) / 60000)
    : null

  const varianceDurationMinutes = actualDurationMinutes !== null && task.estimatedDurationMinutes
    ? actualDurationMinutes - task.estimatedDurationMinutes
    : null

  return { ...task, actualDurationMinutes, varianceDurationMinutes }
}

// WRONG — storing computed value
await taskRef.update({ actualDurationMinutes: 22 })  // Never do this

// CORRECT — compute on read
const task = computeTaskDurations(await taskRef.get().then(d => d.data()))
```

**Why:** Storing computed values creates drift risk — if source timestamps are corrected, the stored computed value becomes stale. Computing at read time guarantees consistency.

---

## Pattern 3: Batch Reads for Report Queries (Never N+1)

Firestore charges one read per document. An N+1 pattern (read exercise → loop and read each task) at 100 tasks = 101 reads per request, rapidly exhausting the 50K/day free limit.

```typescript
// WRONG — N+1 reads
const exercise = await exerciseRef.get()
const stages = []
for (const stageId of exercise.data().stageIds) {
  stages.push(await stageRef(stageId).get())  // 1 read per stage
}

// CORRECT — single collection query
const stages = await db
  .collection(`tenants/${tenantId}/stages`)
  .where('exerciseId', '==', exerciseId)
  .orderBy('stageOrder')
  .get()
// 1 read = all documents returned
```

**Rule:** Always use collection queries (`.where().get()`) instead of individual document fetches when reading multiple related documents.

---

## Pattern 4: Cursor-Based Pagination

Firestore does not support SQL-style OFFSET. Use document cursors for pagination.

```typescript
// First page
const firstPage = await db
  .collection(`tenants/${tenantId}/exercises`)
  .where('status', '==', 'completed')
  .orderBy('startDate', 'desc')
  .limit(50)
  .get()

const lastDoc = firstPage.docs[firstPage.docs.length - 1]

// Next page — use startAfter(lastDoc), not offset
const nextPage = await db
  .collection(`tenants/${tenantId}/exercises`)
  .where('status', '==', 'completed')
  .orderBy('startDate', 'desc')
  .startAfter(lastDoc)
  .limit(50)
  .get()
```

---

## Pattern 5: Transactions for State Machine Transitions

Task status transitions must be atomic — read current status, validate transition, write new status. A race condition (two users completing the same task simultaneously) must not produce inconsistent state.

```typescript
// CORRECT — use Firestore transaction
await db.runTransaction(async (tx) => {
  const taskSnap = await tx.get(taskRef)
  const task = taskSnap.data()

  const { allowed, reason } = TaskStateMachine.canTransition(
    task.status, 'completed', actor, context
  )

  if (!allowed) throw new Error(reason)

  tx.update(taskRef, {
    status: 'completed',
    actualEnd: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  })
})
```

**Rule:** All state machine transitions use Firestore transactions. Simple field updates (notes, timing) that are not state transitions do not need transactions.

---

## Pattern 6: Batch Writes for Multi-Document Updates

When a Go/No-Go decision must update a task, a stage, and trigger a rollback stage unlock simultaneously, use a batch write. Batch writes are atomic — all succeed or all fail.

```typescript
// CORRECT — atomic multi-document update
const batch = db.batch()

batch.update(taskRef, { status: 'failed', goNoGoOutcome: 'no_go', actualEnd: now })
batch.update(stageRef, { status: 'failed', failedAt: now })
batch.update(rollbackStageRef, { isLocked: false, activatedAt: now })

await batch.commit()
// All 3 writes are atomic
```

**Limit:** Batch writes are limited to 500 operations per batch. For bulk imports (100+ tasks), chunk into batches of 499.

---

## Pattern 7: Realtime Database Mirror (Dual Write)

Every task status write to Firestore is followed immediately by a lightweight write to Firebase Realtime Database. This is the dual-write pattern established in ADR-004.

```typescript
// After every Firestore task mutation in the service layer:
async function updateTaskStatus(tenantId: string, taskId: string, exerciseId: string, newStatus: TaskStatus) {
  // 1. Write to Firestore (source of truth)
  await db.runTransaction(async (tx) => { /* ... */ })

  // 2. Mirror to Realtime DB (live fan-out) — fire and forget
  await realtimeDb.ref(`exercises/${exerciseId}/tasks/${taskId}`).update({
    status: newStatus,
    lastUpdatedAt: Date.now(),
    lastUpdatedBy: actor.name
  })
  // Note: realtime DB write is NOT awaited in the transaction — it's a best-effort mirror
}
```

**Rule:** The Realtime DB mirror is eventually consistent. It is NOT the source of truth. If there is a discrepancy between Firestore and Realtime DB, Firestore wins. The client always reconciles from Firestore on page load.

---

## Pattern 8: Security Rules as the Last Line of Defence

Firestore Security Rules are NOT the primary enforcement mechanism for business rules. They are the last line of defence against client-side exploits.

The enforcement order is:
1. **API middleware** (`requireRole`, `requireTenant`, `requireOwnership`) — primary
2. **Service layer** (`TaskStateMachine.canTransition`) — business rules
3. **Firestore Security Rules** — safety net

Rules are written to be simple and fast — they check role and tenant, not complex business logic. Do not encode state machine logic in Firestore rules.

```javascript
// CORRECT security rule — simple role + tenant check
match /tenants/{tenantId}/tasks/{taskId} {
  allow update: if isInTenant(tenantId) && isAdminOrModerator()
                || (isInTenant(tenantId) && isRole('user') 
                    && request.auth.uid in resource.data.assignedUserIds);
}

// WRONG — do not encode state machine in rules
allow update: if resource.data.status == 'in_progress' 
              && request.resource.data.status == 'completed'
              // ... this is fragile, hard to maintain, and untestable
```

---

## Pattern 9: Soft Deletes

Firestore documents are never hard-deleted in production. Soft-delete by setting `deletedAt` to the current timestamp. All queries must filter out soft-deleted documents.

```typescript
// Service layer helper
function notDeleted() {
  return where('deletedAt', '==', null)
}

// Always apply when listing
const exercises = await db
  .collection(`tenants/${tenantId}/exercises`)
  .where('deletedAt', '==', null)
  .get()
```

**Exception:** Audit logs are never deleted, even soft-delete. Evidence files can be soft-deleted by Admin (sets `deletedAt`) but the underlying Storage file is retained.

---

## Pattern 10: Field Value Sentinels for Timestamps

Never use `new Date()` or `Date.now()` for Firestore timestamps. Always use server-side timestamps to avoid clock skew across client devices.

```typescript
// CORRECT
await taskRef.update({
  actualStart: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
})

// WRONG — client clock may be wrong
await taskRef.update({
  actualStart: new Date(),  // Don't do this
  updatedAt: Date.now()     // Don't do this
})
```

**Exception:** When computing duration client-side for display, `Date.now()` is acceptable for the running timer (not persisted).
