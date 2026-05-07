// Encrypted IndexedDB store for the "waiting room" of pending imports.
//
// Photos picked from the device are encrypted with the user's AES-GCM key
// (the same one used for Supabase uploads) and persisted here, so they
// survive page refreshes, app lock, and tab close. They are decrypted only
// when the user dispatches them to a body zone.
//
// The DB lives entirely on-device. Without the PIN-derived key, the records
// are unreadable — same zero-knowledge guarantee as the rest of the app.

const DB_NAME = 'moletrack-import'
const DB_VERSION = 1
const STORE = 'pending-photos'

export type PendingRecord = {
  id: string
  filename: string
  mimeType: string
  size: number
  iv: string          // base64 — IV used for `ciphertext`
  ciphertext: Uint8Array
  contentHash: string // sha256 hex of the plaintext — used for dedup at import time
  createdAt: number   // ms epoch — when added to the queue
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putPending(rec: PendingRecord): Promise<void> {
  const db = await openDb()
  await awaitRequest(tx(db, 'readwrite').put(rec))
}

export async function deletePending(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  const store = tx(db, 'readwrite')
  await Promise.all(ids.map(id => awaitRequest(store.delete(id))))
}

export async function clearPending(): Promise<void> {
  const db = await openDb()
  await awaitRequest(tx(db, 'readwrite').clear())
}

export async function listPending(): Promise<PendingRecord[]> {
  const db = await openDb()
  const all = await awaitRequest(tx(db, 'readonly').getAll())
  return (all as PendingRecord[]).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getPending(id: string): Promise<PendingRecord | undefined> {
  const db = await openDb()
  return awaitRequest(tx(db, 'readonly').get(id)) as Promise<PendingRecord | undefined>
}
