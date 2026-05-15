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

import { encryptBytes, decryptBytes, sha256Hex } from './crypto'
import { getKey } from './auth'
import { listAllContentHashes } from './photos'
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
  contentHash: string
  previewUrl: string
  createdAt: number
  /** True when this file's content hash matches one already saved server-side
   *  or already waiting in the queue. We still import it — the user manages
   *  duplicates from the dedicated "Doublons" page. */
  isDuplicate?: boolean
}

export type AddResult = {
  added: ImportItem[]
  /** Number of files that were detected as already-existing copies (same
   *  bytes), but imported anyway. Shown to the user as an info note linking
   *  to the Duplicates manager. */
  duplicatesAdded: number
  failed: number
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
    contentHash: rec.contentHash,
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

  /**
   * Encrypt + persist + show. Always imports the file — duplicates (same
   * content hash as another file in this batch, already in the queue, or
   * already saved server-side) are simply flagged so the UI can surface
   * "N doublons ajoutés, à gérer dans Doublons".
   *
   * Non-image files are ignored.
   */
  async add(files: File[] | FileList): Promise<AddResult> {
    const key = ensureKey()
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))

    // Snapshot of hashes we already know about. Used to *flag* duplicates,
    // not to skip them — the user wants to be the one deciding what to keep.
    const remoteHashes = await listAllContentHashes().catch(err => {
      console.warn('Could not load remote content hashes, dup flagging is local-only:', err)
      return new Set<string>()
    })
    const queueHashes = new Set(items.map(i => i.contentHash))
    const seenInBatch = new Set<string>()

    const added: ImportItem[] = []
    let duplicatesAdded = 0
    const failures: { name: string; error: unknown }[] = []

    for (const file of arr) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const contentHash = await sha256Hex(bytes)
        const isDuplicate =
          seenInBatch.has(contentHash) ||
          queueHashes.has(contentHash) ||
          remoteHashes.has(contentHash)
        if (isDuplicate) duplicatesAdded++
        seenInBatch.add(contentHash)

        const id = crypto.randomUUID()
        const { iv, ciphertext } = await encryptBytes(key, bytes)
        const rec: PendingRecord = {
          id,
          filename: file.name || 'photo.jpg',
          mimeType: file.type || 'image/jpeg',
          size: file.size,
          iv,
          ciphertext,
          contentHash,
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
          contentHash,
          previewUrl,
          createdAt: rec.createdAt,
          isDuplicate,
        }
        added.push(item)
        // Notify per-file so the UI shows thumbs trickling in for big batches.
        items = [...items, item]
        notify()
      } catch (err) {
        // Per-file isolation: a single bad file mustn't kill the whole batch.
        // Common culprits: HEIC the browser can't read, oversized files, IDB quota.
        console.error(`Failed to enqueue ${file.name}:`, err)
        failures.push({ name: file.name, error: err })
      }
    }
    if (failures.length > 0) {
      console.warn(`${failures.length} file(s) failed to import`, failures)
    }
    return { added, duplicatesAdded, failed: failures.length }
  },

  /**
   * Re-inject already-decrypted bytes (e.g. a photo pulled back from a zone
   * because the user mis-routed it). Skips dedup against remote/local since
   * the caller is about to delete the original from the server.
   */
  async requeueFromBytes(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<ImportItem> {
    const key = ensureKey()
    const contentHash = await sha256Hex(input.bytes)
    const id = crypto.randomUUID()
    const { iv, ciphertext } = await encryptBytes(key, input.bytes)
    const rec: PendingRecord = {
      id,
      filename: input.filename || 'photo.jpg',
      mimeType: input.mimeType || 'image/jpeg',
      size: input.bytes.byteLength,
      iv,
      ciphertext,
      contentHash,
      createdAt: Date.now(),
    }
    await putPending(rec)
    const previewUrl = URL.createObjectURL(new Blob([input.bytes as BlobPart], { type: rec.mimeType }))
    const item: ImportItem = {
      id,
      filename: rec.filename,
      mimeType: rec.mimeType,
      size: rec.size,
      contentHash,
      previewUrl,
      createdAt: rec.createdAt,
    }
    items = [...items, item]
    notify()
    return item
  },

  /** Recover the original file bytes (and known hash) from IDB at dispatch time. */
  async getDecryptedFile(id: string): Promise<{ file: File; contentHash: string }> {
    const key = ensureKey()
    const rec = await getPending(id)
    if (!rec) throw new Error(`Pending photo ${id} not found`)
    const pt = await decryptBytes(key, rec.iv, rec.ciphertext)
    return {
      file: new File([pt as BlobPart], rec.filename, { type: rec.mimeType }),
      contentHash: rec.contentHash,
    }
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
