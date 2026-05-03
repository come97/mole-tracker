import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, type PhotoRow } from '../lib/supabase'
import { listPhotos } from '../lib/photos'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a')
  const b = params.get('b')

  if (a && b) return <ComparePair aId={a} bId={b} />
  return <ComparePicker onPick={(idA, idB) => setParams({ a: idA, b: idB })} />
}

function ComparePair({ aId, bId }: { aId: string; bId: string }) {
  const [a, setA] = useState<PhotoRow | null>(null)
  const [b, setB] = useState<PhotoRow | null>(null)

  useEffect(() => {
    supabase.from('photos').select('*').in('id', [aId, bId]).then(({ data }) => {
      if (!data) return
      const ra = (data as PhotoRow[]).find(p => p.id === aId) ?? null
      const rb = (data as PhotoRow[]).find(p => p.id === bId) ?? null
      // Always show oldest first.
      if (ra && rb && new Date(ra.taken_at) > new Date(rb.taken_at)) {
        setA(rb); setB(ra)
      } else {
        setA(ra); setB(rb)
      }
    })
  }, [aId, bId])

  const deltaDays = useMemo(() => {
    if (!a || !b) return null
    const ms = new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
    return Math.round(ms / 86_400_000)
  }, [a, b])

  if (!a || !b) return <div className="px-4 py-4 text-slate-400">Chargement…</div>
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3">
        <Link to="/compare" className="text-sm text-slate-400">← Choisir d'autres photos</Link>
      </div>
      <div className="px-4 pb-2 text-center">
        <p className="text-sm text-slate-300">{zoneLabel(a.body_zone)}</p>
        {deltaDays !== null && (
          <p className="text-xs text-slate-500">
            {deltaDays === 0 ? 'Même jour' : `${deltaDays} jour${deltaDays > 1 ? 's' : ''} d'écart`}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 bg-black">
        <Side photo={a} label="Avant" />
        <Side photo={b} label="Après" />
      </div>
      <p className="px-4 py-3 text-center text-xs text-slate-500">
        Ces images sont déchiffrées localement. Elles ne sont jamais lisibles côté serveur.
      </p>
    </div>
  )
}

function Side({ photo, label }: { photo: PhotoRow; label: string }) {
  return (
    <div className="relative">
      <PhotoThumb photo={photo} full className="block aspect-[3/4] w-full object-cover" />
      <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{label}</div>
      <div className="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {new Date(photo.taken_at).toLocaleDateString('fr-FR')}
      </div>
    </div>
  )
}

function ComparePicker({ onPick }: { onPick: (a: string, b: string) => void }) {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [zone, setZone] = useState<string>('')
  const [picked, setPicked] = useState<string[]>([])

  useEffect(() => { listPhotos({ zone: zone || undefined }).then(setPhotos) }, [zone])

  const usableZones = useMemo(() => {
    const ids = new Set((photos ?? []).map(p => p.body_zone))
    return BODY_ZONES.filter(z => ids.has(z.id) || zone === z.id)
  }, [photos, zone])

  function toggle(id: string) {
    setPicked(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id])
  }

  return (
    <div className="px-4 py-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Comparer 2 photos</h2>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-400">Filtrer par zone</label>
        <select
          value={zone}
          onChange={e => { setZone(e.target.value); setPicked([]) }}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        >
          <option value="">Toutes les zones</option>
          {usableZones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </div>

      {!photos ? <p className="text-sm text-slate-400">Chargement…</p>
        : photos.length < 2 ? <p className="text-sm text-slate-400">Il faut au moins 2 photos pour comparer.</p>
        : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map(p => {
              const sel = picked.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`relative aspect-square overflow-hidden rounded-md ${sel ? 'ring-2 ring-indigo-400' : ''}`}
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {new Date(p.taken_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>
              )
            })}
          </div>
        )}

      <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-screen-sm -translate-x-1/2 px-4">
        <button
          disabled={picked.length !== 2}
          onClick={() => onPick(picked[0], picked[1])}
          className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {picked.length === 2 ? 'Voir la comparaison' : `Choisis 2 photos (${picked.length}/2)`}
        </button>
      </div>
    </div>
  )
}
