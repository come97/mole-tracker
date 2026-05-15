// Photo CRUD with E2E encryption.
// - Encrypted blob (AES-GCM) goes to Supabase Storage under `<user_id>/<uuid>.bin`.
// - A small encrypted thumbnail goes alongside as `<user_id>/<uuid>.thumb.bin`.
// - All metadata that could leak content (note) is encrypted too.
//
// Reading flow: download blob → AES-GCM decrypt → blob URL → <img>.
// We always revoke object URLs the caller no longer needs (photo cards do this on unmount).

import { supabase, type PhotoRow } from './supabase'
import { encryptBytes, decryptBytes, encryptText, decryptText, sha256Hex } from './crypto'
import { getKey } from './auth'

const BUCKET = 'mole-photos'

function ensureKey(): CryptoKey {
  const k = getKey()
  if (!k) throw new Error('Session locked — PIN required')
  return k
}

async function ensureUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

/* ----- compression / thumbnailing ----- */

async function fileToBitmap(file: Blob | File): Promise<ImageBitmap> {
  return await createImageBitmap(file)
}

function drawScaled(bitmap: ImageBitmap, maxDim: number): { canvas: HTMLCanvasElement, w: number, h: number } {
  const ratio = bitmap.width / bitmap.height
  let w = bitmap.width
  let h = bitmap.height
  if (Math.max(w, h) > maxDim) {
    if (ratio > 1) {
      w = maxDim
      h = Math.round(maxDim / ratio)
    } else {
      h = maxDim
      w = Math.round(maxDim * ratio)
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return { canvas, w, h }
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.85): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  )
  return new Uint8Array(await blob.arrayBuffer())
}

/* ----- public API ----- */

export type SavePhotoInput = {
  file: Blob | File
  bodyZone: string
  bodyZoneLabel?: string
  takenAt?: Date
  note?: string
  /** Pre-computed sha256 of the original file (skips a re-hash). */
  contentHash?: string
}

export async function savePhoto(input: SavePhotoInput): Promise<PhotoRow> {
  const key = ensureKey()
  const userId = await ensureUserId()

  // Hash the original bytes for server-side dedup. If the caller already has
  // it (the import queue does), skip the work.
  const contentHash =
    input.contentHash ?? (await sha256Hex(new Uint8Array(await input.file.arrayBuffer())))

  const bitmap = await fileToBitmap(input.file)
  // Full image — capped at 2048 px largest side.
  const { canvas: fullCv, w, h } = drawScaled(bitmap, 2048)
  const fullJpeg = await canvasToJpegBytes(fullCv, 0.88)
  // Thumbnail — 320 px largest side.
  const { canvas: thumbCv } = drawScaled(bitmap, 320)
  const thumbJpeg = await canvasToJpegBytes(thumbCv, 0.78)
  bitmap.close()

  const { iv: fullIv, ciphertext: fullCt } = await encryptBytes(key, fullJpeg)
  const { iv: thumbIv, ciphertext: thumbCt } = await encryptBytes(key, thumbJpeg)

  const id = crypto.randomUUID()
  const fullPath = `${userId}/${id}.bin`
  const thumbPath = `${userId}/${id}.thumb.bin`

  const up1 = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, new Blob([fullCt as BlobPart], { type: 'application/octet-stream' }), {
      upsert: false,
      contentType: 'application/octet-stream',
    })
  if (up1.error) throw up1.error

  const up2 = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, new Blob([thumbCt as BlobPart], { type: 'application/octet-stream' }), {
      upsert: false,
      contentType: 'application/octet-stream',
    })
  if (up2.error) {
    await supabase.storage.from(BUCKET).remove([fullPath])
    throw up2.error
  }

  let note_iv: string | null = null
  let note_ct: string | null = null
  if (input.note && input.note.trim().length > 0) {
    const enc = await encryptText(key, input.note)
    note_iv = enc.iv
    note_ct = enc.ct
  }

  const { data, error } = await supabase
    .from('photos')
    .insert({
      id,
      user_id: userId,
      body_zone: input.bodyZone,
      body_zone_label: input.bodyZoneLabel ?? null,
      encrypted_path: fullPath,
      iv: fullIv,
      thumbnail_path: thumbPath,
      thumbnail_iv: thumbIv,
      encrypted_size_bytes: fullCt.byteLength,
      width: w,
      height: h,
      content_hash: contentHash,
      taken_at: (input.takenAt ?? new Date()).toISOString(),
      note_iv,
      note_ct,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([fullPath, thumbPath])
    throw error
  }
  return data as PhotoRow
}

export async function listPhotos(opts: { zone?: string } = {}): Promise<PhotoRow[]> {
  let q = supabase.from('photos').select('*').order('taken_at', { ascending: false })
  if (opts.zone) q = q.eq('body_zone', opts.zone)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as PhotoRow[]
}

/** Pulls every dispatched photo's content hash so the import flow can dedup. */
export async function listAllContentHashes(): Promise<Set<string>> {
  const { data, error } = await supabase.from('photos').select('content_hash')
  if (error) throw error
  const out = new Set<string>()
  for (const r of data ?? []) {
    const h = (r as { content_hash: string | null }).content_hash
    if (h) out.add(h)
  }
  return out
}

/** A group of photos sharing the same content hash (bit-for-bit identical). */
export type DuplicateGroup = {
  contentHash: string
  photos: PhotoRow[]
}

/**
 * Returns groups of photos with the same `content_hash`. Each group has at
 * least 2 entries. Inside a group, photos are ordered oldest-first so the UI
 * can default to "keep the oldest, delete the rest".
 *
 * Photos without a content_hash (legacy rows from before the dedup column
 * existed) are excluded — we can't determine equality.
 */
export async function listDuplicateGroups(): Promise<DuplicateGroup[]> {
  const all = await listPhotos()
  const byHash = new Map<string, PhotoRow[]>()
  for (const p of all) {
    if (!p.content_hash) continue
    const arr = byHash.get(p.content_hash) ?? []
    arr.push(p)
    byHash.set(p.content_hash, arr)
  }
  const groups: DuplicateGroup[] = []
  for (const [contentHash, photos] of byHash) {
    if (photos.length < 2) continue
    photos.sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime())
    groups.push({ contentHash, photos })
  }
  // Most recent duplicate activity first.
  groups.sort((a, b) => {
    const aMax = Math.max(...a.photos.map(p => new Date(p.created_at).getTime()))
    const bMax = Math.max(...b.photos.map(p => new Date(p.created_at).getTime()))
    return bMax - aMax
  })
  return groups
}

/** Total number of *extra* copies across all duplicate groups (group size − 1).
 *  Useful for a badge that reflects "how many photos you could delete". */
export async function countDuplicateExtras(): Promise<number> {
  const groups = await listDuplicateGroups()
  let n = 0
  for (const g of groups) n += g.photos.length - 1
  return n
}

export async function listZoneCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('photos').select('body_zone')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of data ?? []) counts[r.body_zone] = (counts[r.body_zone] ?? 0) + 1
  return counts
}

/** Download + decrypt the full image. Returned as raw bytes (not a blob URL). */
export async function getPhotoBytes(photo: PhotoRow): Promise<Uint8Array> {
  const key = ensureKey()
  if (!photo.encrypted_path || !photo.iv) throw new Error('Missing path/iv on photo')
  const dl = await supabase.storage.from(BUCKET).download(photo.encrypted_path)
  if (dl.error) throw dl.error
  const ct = new Uint8Array(await dl.data.arrayBuffer())
  const pt = await decryptBytes(key, photo.iv, ct)
  return new Uint8Array(pt)
}

export async function getPhotoBlobUrl(photo: PhotoRow, which: 'full' | 'thumb' = 'full'): Promise<string> {
  const key = ensureKey()
  const path = which === 'thumb' ? photo.thumbnail_path : photo.encrypted_path
  const iv = which === 'thumb' ? photo.thumbnail_iv : photo.iv
  if (!path || !iv) throw new Error('Missing path/iv on photo')

  const dl = await supabase.storage.from(BUCKET).download(path)
  if (dl.error) throw dl.error
  const ct = new Uint8Array(await dl.data.arrayBuffer())
  const pt = await decryptBytes(key, iv, ct)
  return URL.createObjectURL(new Blob([pt as BlobPart], { type: 'image/jpeg' }))
}

export async function decryptPhotoNote(photo: PhotoRow): Promise<string | null> {
  if (!photo.note_ct || !photo.note_iv) return null
  const key = ensureKey()
  return decryptText(key, photo.note_iv, photo.note_ct)
}

export async function updatePhotoTakenAt(photoId: string, takenAt: Date): Promise<PhotoRow> {
  const { data, error } = await supabase
    .from('photos')
    .update({ taken_at: takenAt.toISOString() })
    .eq('id', photoId)
    .select()
    .single()
  if (error) throw error
  return data as PhotoRow
}

export async function updatePhotoZone(
  photoId: string,
  bodyZone: string,
  bodyZoneLabel?: string,
): Promise<PhotoRow> {
  const { data, error } = await supabase
    .from('photos')
    .update({ body_zone: bodyZone, body_zone_label: bodyZoneLabel ?? null })
    .eq('id', photoId)
    .select()
    .single()
  if (error) throw error
  return data as PhotoRow
}

export async function deletePhoto(photo: PhotoRow) {
  const paths = [photo.encrypted_path]
  if (photo.thumbnail_path) paths.push(photo.thumbnail_path)
  await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('photos').delete().eq('id', photo.id)
  if (error) throw error
}
