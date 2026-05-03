import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listPhotos, deletePhoto } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import type { PhotoRow } from '../lib/supabase'
import PhotoThumb from '../components/PhotoThumb'

export default function ZonePage() {
  const { zone } = useParams<{ zone: string }>()
  const nav = useNavigate()
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const reload = () => {
    if (!zone) return Promise.resolve()
    return listPhotos({ zone }).then(p => setPhotos(p))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [zone])

  if (!zone) return null

  function toggle(id: string) {
    setSelected(s =>
      s.includes(id) ? s.filter(x => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]
    )
  }

  async function onDelete(p: PhotoRow) {
    if (!confirm('Supprimer cette photo définitivement ?')) return
    await deletePhoto(p)
    void reload()
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/" className="text-sm text-slate-400">← Corps</Link>
        <h2 className="ml-1 flex-1 text-lg font-semibold text-slate-100">{zoneLabel(zone)}</h2>
        {photos && photos.length >= 2 && (
          <button
            onClick={() => { setSelecting(s => !s); setSelected([]) }}
            className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200"
          >
            {selecting ? 'Annuler' : 'Comparer'}
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
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {new Date(p.taken_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </button>
              )
            })}
          </div>

          {selecting && (
            <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-screen-sm -translate-x-1/2 px-4">
              <button
                onClick={() => nav(`/compare?a=${selected[0]}&b=${selected[1]}`)}
                disabled={selected.length !== 2}
                className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white disabled:opacity-40"
              >
                {selected.length === 2 ? 'Comparer ces 2 photos' : `Sélectionne 2 photos (${selected.length}/2)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
