import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoRow } from '../lib/supabase'
import { listPhotos } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'

export default function AllPhotosPage() {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const nav = useNavigate()
  useEffect(() => { listPhotos().then(setPhotos) }, [])

  return (
    <div className="px-4 py-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Toutes mes photos</h2>
      {!photos ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune photo pour le moment.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {photos.map(p => (
            <button
              key={p.id}
              onClick={() => nav(`/photo/${p.id}`)}
              className="relative aspect-square overflow-hidden rounded-md"
            >
              <PhotoThumb photo={p} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {zoneLabel(p.body_zone)}
              </span>
              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {new Date(p.taken_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
