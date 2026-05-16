import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listPhotos, deletePhoto, getPhotoBytes } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import { importQueue } from '../lib/importQueue'
import type { PhotoRow } from '../lib/supabase'
import PhotoThumb from '../components/PhotoThumb'
import {
  Button,
  Icon,
  IconButton,
  Pill,
  TopBar,
  fmtDate,
  fmtRelative,
} from '../components/ui'

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
  useEffect(() => {
    void reload()
  }, [zone])

  const stats = useMemo(() => {
    if (!photos || photos.length === 0) return null
    const sorted = [...photos].sort((a, b) => +new Date(a.taken_at) - +new Date(b.taken_at))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const monthsCovered = Math.max(
      1,
      Math.round((+new Date(last.taken_at) - +new Date(first.taken_at)) / (30 * 86_400_000)),
    )
    const cadenceDays =
      sorted.length > 1
        ? Math.round((+new Date(last.taken_at) - +new Date(first.taken_at)) / 86_400_000 / (sorted.length - 1))
        : null
    return { first, last, monthsCovered, cadenceDays }
  }, [photos])

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
    )
      return
    setError(null)
    setRequeueing({ done: 0, total: targets.length })
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
        setRequeueing({ done: i + 1, total: targets.length })
      }
      exitSelection()
      nav('/import')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      void reload()
    } finally {
      setRequeueing(null)
    }
  }

  const canCompare = selected.length === 2
  const canRequeue = selected.length >= 1
  const label = zoneLabel(zone)

  return (
    <div style={{ paddingBottom: 180 }}>
      <TopBar
        title={label}
        sub={photos ? `${photos.length} photo${photos.length > 1 ? 's' : ''}${stats ? ` · ${stats.monthsCovered} mois de suivi` : ''}` : ''}
        left={<IconButton icon="back" label="Retour" to="/" />}
        right={
          photos && photos.length >= 1 ? (
            <button
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              disabled={!!requeueing}
              className="focus-ring"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: selecting ? 'var(--muted)' : 'var(--primary)',
                background: 'transparent',
                border: 0,
                padding: '6px 8px',
              }}
            >
              {selecting ? 'Annuler' : 'Sélectionner'}
            </button>
          ) : null
        }
      />

      <div style={{ padding: '12px 18px 0' }}>
        {!photos ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Chargement…</p>
        ) : photos.length === 0 ? (
          <EmptyZone zoneId={zone} />
        ) : (
          <>
            {stats && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 14,
                  padding: '12px 0',
                  marginBottom: 14,
                }}
              >
                <ZoneStat label="Premier" value={fmtDate(stats.first.taken_at)} />
                <span style={{ width: 1, background: 'var(--hairline-2)' }} />
                <ZoneStat label="Dernier" value={fmtDate(stats.last.taken_at)} />
                <span style={{ width: 1, background: 'var(--hairline-2)' }} />
                <ZoneStat
                  label="Cadence"
                  value={stats.cadenceDays ? `~ ${stats.cadenceDays} j` : '—'}
                />
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="history" size={16} stroke="var(--muted)" />
                <h2
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  Chronologie
                </h2>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                {photos.length} photo{photos.length > 1 ? 's' : ''}
              </span>
            </div>

            <Timeline
              photos={photos}
              selecting={selecting}
              selected={selected}
              onToggle={toggle}
              onOpen={id => nav(`/photo/${id}`)}
              onDelete={onDelete}
              disabled={!!requeueing}
            />
          </>
        )}
      </div>

      {photos && photos.length >= 2 && !selecting && (
        <FloatingFooter>
          <Button
            variant="secondary"
            icon="compare"
            full
            onClick={() => nav(`/compare?zone=${zone}`)}
          >
            Comparer deux photos
          </Button>
        </FloatingFooter>
      )}

      {selecting && (
        <FloatingFooter>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--danger-50)',
                color: 'var(--danger-700)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 16,
              padding: 10,
              boxShadow: 'var(--e2)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                padding: '4px 6px',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              {requeueing
                ? `Déchiffrement & renvoi… ${requeueing.done}/${requeueing.total}`
                : `${selected.length} sélectionnée${selected.length > 1 ? 's' : ''}`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => nav(`/compare?a=${selected[0]}&b=${selected[1]}`)}
                disabled={!canCompare || !!requeueing}
                style={{ flex: 1 }}
              >
                {canCompare ? 'Comparer (2)' : `Comparer (${selected.length}/2)`}
              </Button>
              <Button
                variant="primary"
                onClick={() => void requeueSelected()}
                disabled={!canRequeue}
                loading={!!requeueing}
                style={{ flex: 1.4 }}
              >
                {requeueing ? '…' : `Renvoyer (${selected.length})`}
              </Button>
            </div>
          </div>
        </FloatingFooter>
      )}
    </div>
  )
}

function FloatingFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 80,
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 640,
        padding: '12px 18px',
        zIndex: 4,
        background: 'linear-gradient(to top, var(--bg) 60%, rgba(245,247,251,0))',
      }}
    >
      {children}
    </div>
  )
}

function ZoneStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: 1, padding: '0 12px', minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted-2)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--ink)',
          marginTop: 2,
          letterSpacing: '-0.005em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Timeline({
  photos,
  selecting,
  selected,
  onToggle,
  onOpen,
  onDelete,
  disabled,
}: {
  photos: PhotoRow[]
  selecting: boolean
  selected: string[]
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onDelete: (p: PhotoRow) => void
  disabled: boolean
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: 22 }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 9,
          top: 14,
          bottom: 14,
          width: 2,
          background:
            'linear-gradient(to bottom, var(--primary-100), var(--hairline) 60%, transparent)',
        }}
      />
      {photos.map((p, i) => {
        const isSel = selected.includes(p.id)
        const isLatest = i === 0
        return (
          <div key={p.id} style={{ position: 'relative', marginBottom: 12 }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: -22,
                top: 18,
                width: 10,
                height: 10,
                borderRadius: 999,
                background: isLatest ? 'var(--primary)' : 'var(--surface)',
                border: `2px solid ${isLatest ? 'var(--primary)' : 'var(--primary-200)'}`,
                boxShadow: isLatest ? '0 0 0 4px var(--primary-50)' : 'none',
              }}
            />
            <button
              onClick={() => (selecting ? onToggle(p.id) : onOpen(p.id))}
              onContextMenu={e => {
                e.preventDefault()
                void onDelete(p)
              }}
              disabled={disabled}
              className="focus-ring"
              style={{
                display: 'flex',
                gap: 12,
                width: '100%',
                background: 'var(--surface)',
                border:
                  selecting && isSel
                    ? '2px solid var(--primary)'
                    : '1px solid var(--hairline)',
                boxShadow: selecting && isSel ? '0 0 0 3px var(--primary-50)' : 'none',
                borderRadius: 14,
                padding: 10,
                textAlign: 'left',
                transition: 'background var(--t-fast) var(--ease)',
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--surface-3)',
                  flexShrink: 0,
                }}
              >
                <PhotoThumb photo={p} className="h-full w-full object-cover" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--ink)' }}>
                    {fmtDate(p.taken_at)}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted-2)' }}>
                    {fmtRelative(p.taken_at)}
                  </div>
                </div>
                {isLatest && (
                  <div style={{ marginTop: 6 }}>
                    <Pill tone="primary">Dernière</Pill>
                  </div>
                )}
              </div>
              {selecting && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: isSel ? 'var(--primary)' : 'var(--surface-3)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isSel ? '0' : '1px solid var(--hairline)',
                    alignSelf: 'center',
                  }}
                >
                  {isSel && <Icon name="check" size={14} stroke="#fff" strokeWidth={2.5} />}
                </span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function EmptyZone({ zoneId }: { zoneId: string }) {
  const nav = useNavigate()
  return (
    <div
      style={{
        marginTop: 28,
        padding: 24,
        background: 'var(--surface)',
        border: '1px dashed var(--hairline)',
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--primary-50)',
          color: 'var(--primary-700)',
          margin: '0 auto 10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={20} stroke="var(--primary-700)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
        Aucune photo dans cette zone
      </div>
      <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--muted)' }}>
        Ajoute ta première photo pour commencer le suivi de cette zone.
      </p>
      <Button variant="primary" icon="plus" onClick={() => nav(`/add?zone=${zoneId}`)}>
        Ajouter une photo
      </Button>
    </div>
  )
}
