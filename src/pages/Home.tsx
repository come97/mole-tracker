import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyDiagram from '../components/BodyDiagram'
import { listZoneCounts } from '../lib/photos'

export default function HomePage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    listZoneCounts().then(c => { setCounts(c); setLoading(false) })
  }, [])

  return (
    <div>
      <BodyDiagram counts={counts} onZoneClick={zone => nav(`/zone/${zone}`)} />
      {loading && <p className="mt-2 text-center text-xs text-slate-500">Chargement…</p>}
    </div>
  )
}
