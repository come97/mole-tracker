import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyDiagram, { DensityLegend } from '../components/BodyDiagram'
import { listPhotos, listZoneCounts } from '../lib/photos'
import type { PhotoRow } from '../lib/supabase'
import { zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'
import { Card, Icon, fmtDate, fmtRelative } from '../components/ui'

export default function HomePage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [recent, setRecent] = useState<PhotoRow[] | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    let cancelled = false
    void Promise.all([listZoneCounts(), listPhotos()])
      .then(([c, photos]) => {
        if (cancelled) return
        setCounts(c)
        setRecent(photos.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) {
          setCounts({})
          setRecent([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const totalPhotos =
      counts === null ? null : Object.values(counts).reduce((a, b) => a + b, 0)
    const zonesTracked = counts ? Object.values(counts).filter(n => n > 0).length : 0
    const lastPhoto = recent && recent.length > 0 ? recent[0] : null
    return { totalPhotos, zonesTracked, lastPhoto }
  }, [counts, recent])

  return (
    <div style={{ padding: '8px 18px 12px' }}>
      <div style={{ marginTop: 6, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '-0.005em' }}>Bonjour</div>
        <h1
          style={{
            margin: '2px 0 0',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          Suivi de la peau
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
        <StatBlock label="Photos" value={stats.totalPhotos ?? '—'} sub="au total" />
        <StatBlock
          label="Zones suivies"
          value={stats.zonesTracked || '—'}
          sub={stats.zonesTracked ? 'sur 22' : 'aucune encore'}
        />
        <StatBlock
          label="Dernier"
          value={stats.lastPhoto ? fmtRelative(stats.lastPhoto.taken_at).replace('il y a ', '') : '—'}
          sub={stats.lastPhoto ? zoneLabel(stats.lastPhoto.body_zone).toLowerCase() : 'aucun encore'}
          tone={stats.lastPhoto ? 'primary' : 'neutral'}
        />
      </div>

      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            padding: '14px 16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Atlas corporel</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Touche une zone pour voir tes photos
            </div>
          </div>
        </div>
        <div style={{ padding: '8px 16px 14px' }}>
          <BodyDiagram counts={counts ?? {}} onZoneClick={z => nav(`/zone/${z}`)} compact />
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
            <DensityLegend />
          </div>
        </div>
      </Card>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            margin: 0,
            letterSpacing: '-0.005em',
          }}
        >
          Activité récente
        </h2>
        <button
          onClick={() => nav('/all')}
          className="focus-ring"
          style={{
            fontSize: 12,
            color: 'var(--primary)',
            fontWeight: 550,
            background: 'none',
            border: 0,
          }}
        >
          Tout voir
        </button>
      </div>

      {recent === null ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <ActivitySkeleton key={i} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyActivity onAdd={() => nav('/add')} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {recent.map(p => (
            <ActivityRow key={p.id} photo={p} onClick={() => nav(`/photo/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatBlock({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'neutral' | 'primary'
}) {
  const isPrimary = tone === 'primary'
  return (
    <div
      style={{
        background: isPrimary ? 'var(--primary-50)' : 'var(--surface)',
        border: isPrimary ? '1px solid var(--primary-100)' : '1px solid var(--hairline)',
        color: isPrimary ? 'var(--primary-700)' : 'var(--ink)',
        borderRadius: 14,
        padding: '12px 12px 10px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: isPrimary ? 'var(--primary-700)' : 'var(--muted)',
          fontWeight: 550,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          marginTop: 2,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: isPrimary ? 'var(--primary-700)' : 'var(--muted-2)',
            marginTop: 1,
            opacity: 0.85,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function ActivityRow({ photo, onClick }: { photo: PhotoRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 14,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        width: '100%',
        textAlign: 'left',
        transition: 'background var(--t-fast) var(--ease)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--surface-3)',
          flexShrink: 0,
        }}
      >
        <PhotoThumb photo={photo} className="h-full w-full object-cover" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 550,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {zoneLabel(photo.body_zone)}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="calendar" size={12} />
          <span>{fmtRelative(photo.taken_at)}</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            {fmtDate(photo.taken_at)}
          </span>
        </div>
      </div>
      <Icon name="chevR" size={16} stroke="var(--muted-2)" />
    </button>
  )
}

function ActivitySkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 14,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface-3)' }} />
      <div style={{ flex: 1, display: 'grid', gap: 6 }}>
        <div style={{ width: '60%', height: 12, borderRadius: 4, background: 'var(--surface-3)' }} />
        <div style={{ width: '40%', height: 10, borderRadius: 4, background: 'var(--surface-3)' }} />
      </div>
    </div>
  )
}

function EmptyActivity({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        padding: 20,
        border: '1px dashed var(--primary-200)',
        background: 'var(--primary-50)',
        borderRadius: 14,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'var(--primary-100)',
          color: 'var(--primary-700)',
          margin: '0 auto 10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={20} stroke="var(--primary-700)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary-700)' }}>
        Aucune photo pour le moment
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
        Ajoute ta première photo pour commencer le suivi.
      </div>
      <button
        onClick={onAdd}
        className="focus-ring"
        style={{
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: 12,
          background: 'var(--primary)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          border: 0,
        }}
      >
        Ajouter une photo
      </button>
    </div>
  )
}
