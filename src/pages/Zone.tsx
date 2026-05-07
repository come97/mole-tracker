import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listPhotos, deletePhoto, getPhotoBytes } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import { importQueue } from '../lib/importQueue'
import type { PhotoRow } from '../lib/supabase'
import PhotoThumb from '../components/PhotoThumb'

export default function ZonePage() {
  const { zone } = useParams<{ zone: string }>()
  const nav = useNavigate()
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [requeueing, setRequeueing] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    if (!zone) return Promise.resolve()
    return listPhotos({ zone }).then(p => setPhotos(p))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [zone])

  if (!zone) return null

  function toggle(id: string) {
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  }

  function exitSelection() {
    setSelecting(false)
    setSelected([])
    setError(null)
  }

  async function onDelete(p: PhotoRow) {
    if (!confirm('Supprimer cette photo définitivement ?')) return
    await deletePhoto(p)
    void reload()
  }

  async function requeueSelected() {
    if (!photos || selected.length === 0 || requeueing) return
    const targets = photos.filter(p => selected.includes(p.id))
    if (
      !confirm(
        `Renvoyer ${targets.length} photo${targets.length > 1 ? 's' : ''} en file d'attente ? ` +
        `Elles seront retirées de cette zone.`,
      )
    ) return
    setError(null)
    setRequeueing({ done: 0, total: targets.length })
    const succeeded: PhotoRow[] = []
    try {
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i]
        const bytes = await getPhotoBytes(p)
        await importQueue.requeueFromBytes({
          bytes,
          filename: `requeue-${p.id}.jpg`,
          mimeType: 'image/jpeg',
        })
        await deletePhoto(p)
        succeeded.push(p)
        setRequeueing({ done: i + 1, total: targets.length })
      }
      exitSelection()
      nav('/import')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // Refresh so already-moved photos disappear from the grid even on partial failure.
      void reload()
    } finally {
      setRequeueing(null)
    }
  }

  const canCompare = selected.length === 2
  const canRequeue = selected.length >= 1

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/" className="text-sm text-slate-400">← Corps</Link>
        <h2 className="ml-1 flex-1 text-lg font-semibold text-slate-100">{zoneLabel(zone)}</h2>
        {photos && photos.length >= 1 && (
          <button
            onClick={() => (selecting ? exitSelection() : setSelecting(true))}
            className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200"
            disabled={!!requeueing}
          >
            {selecting ? 'Annuler' : 'Sélectionner'}
          </button>
        )}
      </div>

      {!photos ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : photos.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-slate-400">Aucune photo dans cette zone.</p>
          <button
            onClick={() => nav(`/add?zone=${zone}`)}
            className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-white"
          >
            Ajouter
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1">
            {photos.map(p => {
              const isSel = selected.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (selecting) toggle(p.id)
                    else nav(`/photo/${p.id}`)
                  }}
                  onContextMenu={e => { e.preventDefault(); void onDelete(p) }}
                  className={`relative aspect-square overflow-hidden rounded-md ${isSel ? 'ring-2 ring-indigo-400' : ''}`}
                  disabled={!!requeueing}
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
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

          {selecting && (
            <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-screen-sm -translate-x-1/2 px-4">
              {error && (
                <p className="mb-2 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{error}</p>
              )}
              <div className="rounded-2xl bg-slate-900/95 p-2 shadow-lg ring-1 ring-slate-700/60 backdrop-blur">
                <p className="px-2 pb-2 pt-1 text-center text-xs text-slate-400">
                  {requeueing
                    ? `Déchiffrement & renvoi… ${requeueing.done}/${requeueing.total}`
                    : `${selected.length} sélectionnée${selected.length > 1 ? 's' : ''}`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => nav(`/compare?a=${selected[0]}&b=${selected[1]}`)}
                    disabled={!canCompare || !!requeueing}
                    className="flex-1 rounded-xl bg-slate-800 px-3 py-3 text-sm font-medium text-slate-100 disabled:opacity-40"
                  >
                    {canCompare ? 'Comparer (2)' : `Comparer (${selected.length}/2)`}
                  </button>
                  <button
                    onClick={() => void requeueSelected()}
                    disabled={!canRequeue || !!requeueing}
                    className="flex-[1.4] rounded-xl bg-indigo-500 px-3 py-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {requeueing ? '…' : `↺ Renvoyer en file (${selected.length})`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
