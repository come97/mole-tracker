import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PhotoRow } from '../lib/supabase'
import {
  countDuplicateExtras,
  listPhotos,
  updatePhotoTakenAt,
  updatePhotoZone,
} from '../lib/photos'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

type Editing = 'none' | 'date' | 'zone'

export default function AllPhotosPage() {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Editing>('none')
  const [dateDraft, setDateDraft] = useState('')
  const [zoneDraft, setZoneDraft] = useState('')
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Discreet banner that surfaces the duplicate cleanup tool when there's
  // something to clean up. We re-fetch alongside the photo list so the count
  // stays in sync after the user deletes duplicates from /duplicates.
  const [dupCount, setDupCount] = useState(0)
  const nav = useNavigate()

  function reload() {
    return Promise.all([
      listPhotos().then(setPhotos),
      countDuplicateExtras().then(setDupCount).catch(() => {}),
    ])
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
    setEditing('none')
    setDateDraft('')
    setZoneDraft('')
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
    setEditing('date')
    setError(null)
  }

  function openZoneEditor() {
    if (!photos || selected.size === 0) return
    // Pre-fill with the common zone if all selected share one, else empty.
    const picked = photos.filter(p => selected.has(p.id))
    const zones = new Set(picked.map(p => p.body_zone))
    setZoneDraft(zones.size === 1 ? [...zones][0] : '')
    setEditing('zone')
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

  async function applyZone() {
    if (!zoneDraft || saving) return
    const ids = [...selected]
    const label = zoneLabel(zoneDraft)
    setSaving({ done: 0, total: ids.length })
    setError(null)
    try {
      for (let i = 0; i < ids.length; i++) {
        await updatePhotoZone(ids[i], zoneDraft, label)
        setSaving({ done: i + 1, total: ids.length })
      }
      await reload()
      exitSelection()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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

      {dupCount > 0 && !selecting && (
        <Link
          to="/duplicates"
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-100 hover:bg-amber-900/30"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🗂️</span>
            <span>
              <strong>{dupCount}</strong> doublon{dupCount > 1 ? 's' : ''} à
              gérer
            </span>
          </span>
          <span className="text-xs text-amber-300/80">Nettoyer →</span>
        </Link>
      )}

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
            {editing === 'none' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="flex-1 text-xs text-slate-400">
                  {selected.size === 0
                    ? 'Sélectionne des photos pour les modifier.'
                    : `${selected.size} photo${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''}`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={openDateEditor}
                    disabled={selected.size === 0}
                    className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 disabled:opacity-40 sm:flex-none"
                  >
                    📅 Date
                  </button>
                  <button
                    onClick={openZoneEditor}
                    disabled={selected.size === 0}
                    className="flex-1 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 sm:flex-none"
                  >
                    📍 Déplacer
                  </button>
                </div>
              </div>
            )}

            {editing === 'date' && (
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
                    onClick={() => setEditing('none')}
                    disabled={!!saving}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
                  >
                    Retour
                  </button>
                </div>
              </div>
            )}

            {editing === 'zone' && (
              <div>
                <p className="mb-2 text-xs text-slate-400">
                  Déplacer {selected.size} photo{selected.size > 1 ? 's' : ''} vers…
                  {saving ? ` · ${saving.done}/${saving.total}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={zoneDraft}
                    onChange={e => setZoneDraft(e.target.value)}
                    className="flex-1 min-w-[160px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    disabled={!!saving}
                  >
                    <option value="">— Choisir une zone —</option>
                    {BODY_ZONES.map(z => (
                      <option key={z.id} value={z.id}>{z.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void applyZone()}
                    disabled={!zoneDraft || !!saving}
                    className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {saving ? 'Déplacement…' : 'Déplacer'}
                  </button>
                  <button
                    onClick={() => setEditing('none')}
                    disabled={!!saving}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
                  >
                    Retour
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
