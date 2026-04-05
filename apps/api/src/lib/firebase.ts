import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getDatabase, type Database } from 'firebase-admin/database'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getStorage, type Storage } from 'firebase-admin/storage'

let app: App
let _db: Firestore
let _rtdb: Database
let _auth: Auth
let _storage: Storage

function initFirebase(): App {
  if (getApps().length > 0) return getApps()[0]!

  const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY']
  const rtdbUrl = process.env['FIREBASE_REALTIME_DB_URL']
  const storageBucket = process.env['STORAGE_BUCKET']

  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required')
  }

  const credential = cert(JSON.parse(serviceAccountKey))

  return initializeApp({
    credential,
    databaseURL: rtdbUrl,
    storageBucket,
  })
}

export function getDb(): Firestore {
  if (!_db) {
    app = initFirebase()
    _db = getFirestore(app)
  }
  return _db
}

export function getRtdb(): Database {
  if (!_rtdb) {
    app = initFirebase()
    _rtdb = getDatabase(app)
  }
  return _rtdb
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    app = initFirebase()
    _auth = getAuth(app)
  }
  return _auth
}

export function getFirebaseStorage(): Storage {
  if (!_storage) {
    app = initFirebase()
    _storage = getStorage(app)
  }
  return _storage
}

// Tenant-scoped collection helper
// All data lives under tenants/{tenantId}/{collection}
export function tenantCol(tenantId: string, collection: string) {
  return getDb()
    .collection('tenants')
    .doc(tenantId)
    .collection(collection)
}

// Generate a Firestore server timestamp
export function serverTimestamp() {
  return getFirestore().FieldValue.serverTimestamp() as FirebaseFirestore.FieldValue
}
