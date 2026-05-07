// Persistent encrypted "waiting room" queue.
//
// Photos picked from the device are encrypted with the user's AES key and
// stored in IndexedDB (see ./importStore). This singleton owns the in-memory
// view: a list of items with a decrypted preview URL, ready to render.
//
// Lifecycle:
// - hydrate(): called once after the app unlocks. Loads + decrypts every
//   pending record into a preview URL.
// - add(files): encrypts each file with the current AES key, persists it to
//   IDB, decrypts a preview URL for the UI, and notifies subscribers.
// - getDecryptedFile(id): used at dispatch time to recover the original
//   plaintext bytes before re-uploading via savePhoto().
// - removeMany(ids): drops from IDB + memory + revokes preview URLs.

import { encryptBytes, decryptBytes } from './crypto'
import { getKey } from './auth'
import {
  deletePending,
  listPending,
  putPending,
  getPending,
  type PendingRecord,
} from './importStore'

export type ImportItem = {
  id: string
  filename: string
  mimeType: string
  size: number
  previewUrl: string
  createdAt: number
}

let items: ImportItem[] = []
let hydrated = false
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function ensureKey(): CryptoKey {
  const k = getKey()
  if (!k) throw new Error('Session locked — PIN required')
  return k
}

async function recordToItem(rec: PendingRecord, key: CryptoKey): Promise<ImportItem> {
  const pt = await decryptBytes(key, rec.iv, rec.ciphertext)
  // Force the original mime type so <img> renders without sniffing.
  const blob = new Blob([pt as BlobPart], { type: rec.mimeType || 'image/jpeg' })
  return {
    id: rec.id,
    filename: rec.filename,
    mimeType: rec.mimeType,
    size: rec.size,
    previewUrl: URL.createObjectURL(blob),
    createdAt: rec.createdAt,
  }
}

export const importQueue = {
  /** Load + decrypt every pending record. Safe to call multiple times. */
  async hydrate(): Promise<void> {
    if (hydrated) return
    const key = getKey()
    if (!key) return
    const records = await listPending()
    const next: ImportItem[] = []
    for (const rec of records) {
      try {
        next.push(await recordToItem(rec, key))
      } catch (e) {
        console.warn('Skipping unreadable pending photo', rec.id, e)
      }
    }
    // Revoke any URLs from a previous (incomplete) hydration before replacing.
    for (const old of items) URL.revokeObjectURL(old.previewUrl)
    items = next
    hydrated = true
    notify()
  },

  /** Encrypt + persist + show. Ignores non-image files silently. */
  async add(files: File[] | FileList): Promise<ImportItem[]> {
    const key = ensureKey()
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const added: ImportItem[] = []
    for (const file of arr) {
      const id = crypto.randomUUID()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { iv, ciphertext } = await encryptBytes(key, bytes)
      const rec: PendingRecord = {
        id,
        filename: file.name || 'photo.jpg',
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        iv,
        ciphertext,
        createdAt: Date.now(),
      }
      await putPending(rec)
      // Build the preview from the plaintext we already have, no need to
      // round-trip through decrypt.
      const previewUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: rec.mimeType }))
      const item: ImportItem = {
        id,
        filename: rec.filename,
        mimeType: rec.mimeType,
        size: rec.size,
        previewUrl,
        createdAt: rec.createdAt,
      }
      added.push(item)
      // Notify per-file so the UI shows thumbs trickling in for big batches.
      items = [...items, item]
      notify()
    }
    return added
  },

  /** Recover the original file bytes from IDB at dispatch time. */
  async getDecryptedFile(id: string): Promise<File> {
    const key = ensureKey()
    const rec = await getPending(id)
    if (!rec) throw new Error(`Pending photo ${id} not found`)
    const pt = await decryptBytes(key, rec.iv, rec.ciphertext)
    return new File([pt as BlobPart], rec.filename, { type: rec.mimeType })
  },

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await deletePending(ids)
    const toRemove = new Set(ids)
    const dropped = items.filter(i => toRemove.has(i.id))
    for (const d of dropped) URL.revokeObjectURL(d.previewUrl)
    items = items.filter(i => !toRemove.has(i.id))
    notify()
  },

  async clear(): Promise<void> {
    await deletePending(items.map(i => i.id))
    for (const i of items) URL.revokeObjectURL(i.previewUrl)
    items = []
    notify()
  },

  /** Drop in-memory state without touching IDB. Used on lock. */
  reset(): void {
    for (const i of items) URL.revokeObjectURL(i.previewUrl)
    items = []
    hydrated = false
    notify()
  },

  list(): ImportItem[] {
    return items
  },

  size(): number {
    return items.length
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
