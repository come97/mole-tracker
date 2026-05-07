import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type PhotoRow } from '../lib/supabase'
import { decryptPhotoNote, deletePhoto, updatePhotoTakenAt } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [photo, setPhoto] = useState<PhotoRow | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [savingDate, setSavingDate] = useState(false)

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

  function startEditDate() {
    if (!photo) return
    // <input type="date"> wants YYYY-MM-DD in local time.
    const d = new Date(photo.taken_at)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDateDraft(`${yyyy}-${mm}-${dd}`)
    setEditingDate(true)
  }

  async function saveDate() {
    if (!photo || !dateDraft) return
    const [y, m, d] = dateDraft.split('-').map(Number)
    if (!y || !m || !d) return
    // Anchor to noon local time so timezone shifts don't bump the day.
    const next = new Date(y, m - 1, d, 12, 0, 0, 0)
    setSavingDate(true)
    setError(null)
    try {
      const updated = await updatePhotoTakenAt(photo.id, next)
      setPhoto(updated)
      setEditingDate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingDate(false)
    }
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
        {!editingDate ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-slate-300">
              📅 {new Date(photo.taken_at).toLocaleString('fr-FR')}
            </p>
            <button
              onClick={startEditDate}
              className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200"
            >
              Modifier
            </button>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Date de la photo
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateDraft}
                onChange={e => setDateDraft(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={savingDate}
              />
              <button
                onClick={() => void saveDate()}
                disabled={!dateDraft || savingDate}
                className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {savingDate ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditingDate(false)}
                disabled={savingDate}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
        {photo.width && photo.height && (
          <p className="text-slate-500 text-xs mt-2">{photo.width}×{photo.height}px</p>
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
