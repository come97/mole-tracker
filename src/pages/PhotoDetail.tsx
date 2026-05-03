import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type PhotoRow } from '../lib/supabase'
import { decryptPhotoNote, deletePhoto } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [photo, setPhoto] = useState<PhotoRow | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('photos').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) { setError(error.message); return }
      setPhoto((data as PhotoRow | null) ?? null)
      if (data) decryptPhotoNote(data as PhotoRow).then(setNote).catch(() => setNote(null))
    })
  }, [id])

  if (error) return <div className="px-4 py-4 text-rose-400">{error}</div>
  if (!photo) return <div className="px-4 py-4 text-slate-400">Chargement…</div>

  async function onDelete() {
    if (!photo) return
    if (!confirm('Supprimer cette photo définitivement ?')) return
    await deletePhoto(photo)
    nav(`/zone/${photo.body_zone}`, { replace: true })
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3">
        <Link to={`/zone/${photo.body_zone}`} className="text-sm text-slate-400">← {zoneLabel(photo.body_zone)}</Link>
      </div>
      <div className="bg-black">
        <PhotoThumb photo={photo} full className="mx-auto block max-h-[70vh] w-full object-contain" />
      </div>
      <div className="px-4 py-3 text-sm">
        <p className="text-slate-300">
          📅 {new Date(photo.taken_at).toLocaleString('fr-FR')}
        </p>
        {photo.width && photo.height && (
          <p className="text-slate-500 text-xs mt-1">{photo.width}×{photo.height}px</p>
        )}
        {note && <p className="mt-3 whitespace-pre-wrap text-slate-200">{note}</p>}
      </div>
      <div className="px-4 pb-6">
        <button
          onClick={onDelete}
          className="w-full rounded-xl border border-rose-700/50 px-4 py-2 text-sm text-rose-300 active:bg-rose-900/20"
        >
          Supprimer cette photo
        </button>
      </div>
    </div>
  )
}
