// Photo CRUD with E2E encryption.
// - Encrypted blob (AES-GCM) goes to Supabase Storage under `<user_id>/<uuid>.bin`.
// - A small encrypted thumbnail goes alongside as `<user_id>/<uuid>.thumb.bin`.
// - All metadata that could leak content (note) is encrypted too.
//
// Reading flow: download blob → AES-GCM decrypt → blob URL → <img>.
// We always revoke object URLs the caller no longer needs (photo cards do this on unmount).

import { supabase, type PhotoRow } from './supabase'
import { encryptBytes, decryptBytes, encryptText, decryptText } from './crypto'
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
}

export async function savePhoto(input: SavePhotoInput): Promise<PhotoRow> {
  const key = ensureKey()
  const userId = await ensureUserId()

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

export async function listZoneCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('photos').select('body_zone')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of data ?? []) counts[r.body_zone] = (counts[r.body_zone] ?? 0) + 1
  return counts
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

export async function deletePhoto(photo: PhotoRow) {
  const paths = [photo.encrypted_path]
  if (photo.thumbnail_path) paths.push(photo.thumbnail_path)
  await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('photos').delete().eq('id', photo.id)
  if (error) throw error
}
