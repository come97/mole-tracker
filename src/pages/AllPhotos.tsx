import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoRow } from '../lib/supabase'
import { listPhotos, updatePhotoTakenAt } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

export default function AllPhotosPage() {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  function reload() {
    return listPhotos().then(setPhotos)
  }
  useEffect(() => { void reload() }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
    setEditingDate(false)
    setDateDraft('')
    setError(null)
  }

  function selectAll() {
    if (!photos) return
    setSelected(new Set(photos.map(p => p.id)))
  }

  function openDateEditor() {
    if (!photos || selected.size === 0) return
    // Pre-fill with the most recent selected photo's date so the picker has
    // a sensible starting point.
    const picked = photos.filter(p => selected.has(p.id))
    const newest = picked.reduce((acc, p) =>
      !acc || new Date(p.taken_at) > new Date(acc.taken_at) ? p : acc, null as PhotoRow | null)
    const d = newest ? new Date(newest.taken_at) : new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDateDraft(`${yyyy}-${mm}-${dd}`)
    setEditingDate(true)
    setError(null)
  }

  async function applyDate() {
    if (!dateDraft || saving) return
    const [y, m, d] = dateDraft.split('-').map(Number)
    if (!y || !m || !d) return
    // Anchor to noon local so timezone shifts don't bump the day.
    const next = new Date(y, m - 1, d, 12, 0, 0, 0)
    const ids = [...selected]
    setSaving({ done: 0, total: ids.length })
    setError(null)
    try {
      for (let i = 0; i < ids.length; i++) {
        await updatePhotoTakenAt(ids[i], next)
        setSaving({ done: i + 1, total: ids.length })
      }
      await reload()
      exitSelection()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // Refresh anyway so successful updates are visible.
      void reload()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="px-4 py-4 pb-32">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold text-slate-100">Toutes mes photos</h2>
        {photos && photos.length > 0 && (
          <button
            onClick={() => (selecting ? exitSelection() : setSelecting(true))}
            className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200"
            disabled={!!saving}
          >
            {selecting ? 'Annuler' : 'Sélectionner'}
          </button>
        )}
      </div>

      {!photos ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune photo pour le moment.</p>
      ) : (
        <>
          {selecting && (
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{selected.size} / {photos.length} sélectionnée{selected.size > 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                  disabled={!!saving}
                >
                  Tout
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                  disabled={!!saving}
                >
                  Aucune
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1">
            {photos.map(p => {
              const isSel = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => (selecting ? toggle(p.id) : nav(`/photo/${p.id}`))}
                  disabled={!!saving}
                  className={`relative aspect-square overflow-hidden rounded-md ${
                    selecting && isSel ? 'ring-2 ring-indigo-400' : ''
                  }`}
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {zoneLabel(p.body_zone)}
                  </span>
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {new Date(p.taken_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  {selecting && isSel && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {selecting && photos && photos.length > 0 && (
        <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-screen-sm -translate-x-1/2 px-4">
          {error && (
            <p className="mb-2 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{error}</p>
          )}
          <div className="rounded-2xl bg-slate-900/95 p-3 shadow-lg ring-1 ring-slate-700/60 backdrop-blur">
            {!editingDate ? (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-slate-400">
                  {selected.size === 0
                    ? 'Sélectionne des photos pour les modifier.'
                    : `${selected.size} photo${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''}`}
                </p>
                <button
                  onClick={openDateEditor}
                  disabled={selected.size === 0}
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  📅 Modifier la date
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs text-slate-400">
                  Nouvelle date pour {selected.size} photo{selected.size > 1 ? 's' : ''}
                  {saving ? ` · ${saving.done}/${saving.total}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={dateDraft}
                    onChange={e => setDateDraft(e.target.value)}
                    className="flex-1 min-w-[140px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    disabled={!!saving}
                  />
                  <button
                    onClick={() => void applyDate()}
                    disabled={!dateDraft || !!saving}
                    className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {saving ? 'Enregistrement…' : 'Appliquer'}
                  </button>
                  <button
                    onClick={() => setEditingDate(false)}
                    disabled={!!saving}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
