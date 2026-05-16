import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, type PhotoRow } from '../lib/supabase'
import { listPhotos } from '../lib/photos'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'
import PhotoViewer from '../components/PhotoViewer'
import {
  Button,
  Icon,
  IconButton,
  Pill,
  TopBar,
  fmtDateShort,
  fmtRelative,
} from '../components/ui'

type Mode = 'wipe' | 'side' | 'overlay'

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a')
  const b = params.get('b')
  const zoneFilter = params.get('zone') ?? ''

  if (a && b) {
    return (
      <ComparePair
        aId={a}
        bId={b}
        onPickAgain={() => setParams(zoneFilter ? { zone: zoneFilter } : {})}
      />
    )
  }
  return (
    <ComparePicker
      initialZone={zoneFilter}
      onPick={(idA, idB) =>
        setParams(zoneFilter ? { a: idA, b: idB, zone: zoneFilter } : { a: idA, b: idB })
      }
    />
  )
}

/* ============================================================
   PAIR — wipe slider + delta metrics
   ============================================================ */

function ComparePair({
  aId,
  bId,
  onPickAgain,
}: {
  aId: string
  bId: string
  onPickAgain: () => void
}) {
  const [a, setA] = useState<PhotoRow | null>(null)
  const [b, setB] = useState<PhotoRow | null>(null)
  const [mode, setMode] = useState<Mode>('wipe')
  const [position, setPosition] = useState(52)
  const [viewerStart, setViewerStart] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('photos').select('*').in('id', [aId, bId]).then(({ data }) => {
      if (!data) return
      const ra = (data as PhotoRow[]).find(p => p.id === aId) ?? null
      const rb = (data as PhotoRow[]).find(p => p.id === bId) ?? null
      // Always show oldest first.
      if (ra && rb && new Date(ra.taken_at) > new Date(rb.taken_at)) {
        setA(rb)
        setB(ra)
      } else {
        setA(ra)
        setB(rb)
      }
    })
  }, [aId, bId])

  const deltaDays = useMemo(() => {
    if (!a || !b) return null
    const ms = new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
    return Math.round(ms / 86_400_000)
  }, [a, b])

  if (!a || !b) {
    return (
      <div style={{ padding: 18, fontSize: 14, color: 'var(--muted)' }}>Chargement…</div>
    )
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar
        title="Comparer"
        sub={zoneLabel(a.body_zone)}
        left={<IconButton icon="back" label="Choisir d'autres photos" onClick={onPickAgain} />}
        right={
          <IconButton
            icon="flip"
            label="Inverser"
            onClick={() => {
              setA(b)
              setB(a)
            }}
          />
        }
      />

      <div style={{ padding: '8px 18px 0' }}>
        <ModeToggle value={mode} onChange={setMode} />

        <div
          style={{
            position: 'relative',
            borderRadius: 18,
            overflow: 'hidden',
            background: '#000',
            border: '1px solid var(--hairline)',
            marginTop: 14,
          }}
        >
          {mode === 'wipe' && (
            <WipeCompare
              before={a}
              after={b}
              position={position}
              onChange={setPosition}
              onOpenBefore={() => setViewerStart(0)}
              onOpenAfter={() => setViewerStart(1)}
            />
          )}
          {mode === 'side' && (
            <SideBySide before={a} after={b} onOpenBefore={() => setViewerStart(0)} onOpenAfter={() => setViewerStart(1)} />
          )}
          {mode === 'overlay' && (
            <Overlay before={a} after={b} onOpen={() => setViewerStart(1)} />
          )}
        </div>

        <DeltaCard a={a} b={b} deltaDays={deltaDays} />
      </div>

      {viewerStart !== null && (
        <PhotoViewer
          photos={[a, b]}
          startIndex={viewerStart}
          onClose={() => setViewerStart(null)}
        />
      )}
    </div>
  )
}

function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const items: { id: Mode; label: string }[] = [
    { id: 'wipe', label: 'Curseur' },
    { id: 'side', label: 'Côte-à-côte' },
    { id: 'overlay', label: 'Superposé' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Mode de comparaison"
      style={{
        display: 'inline-flex',
        background: 'var(--surface-3)',
        borderRadius: 999,
        padding: 3,
      }}
    >
      {items.map(it => {
        const active = value === it.id
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className="focus-ring"
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: active ? 'var(--ink)' : 'var(--muted)',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--e1)' : 'none',
              border: 0,
            }}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function WipeCompare({
  before,
  after,
  position,
  onChange,
  onOpenBefore,
  onOpenAfter,
}: {
  before: PhotoRow
  after: PhotoRow
  position: number
  onChange: (n: number) => void
  onOpenBefore: () => void
  onOpenAfter: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const move = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      onChange(pct)
    },
    [onChange],
  )

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (e.buttons === 0) return
      move(e.clientX)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [move])

  return (
    <div
      ref={containerRef}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={e => {
        if (e.buttons > 0) move(e.clientX)
      }}
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        userSelect: 'none',
        cursor: 'ew-resize',
        touchAction: 'none',
      }}
      role="slider"
      aria-label="Curseur de comparaison avant / après"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
    >
      {/* Right = after (full) */}
      <PhotoThumb
        photo={after}
        full
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Left = before, clipped */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)`,
        }}
      >
        <PhotoThumb
          photo={before}
          full
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Date labels — labels become clickable to open viewer */}
      <button
        onClick={e => {
          e.stopPropagation()
          onOpenBefore()
        }}
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          padding: '5px 10px',
          borderRadius: 999,
          background: 'rgba(11,20,36,0.6)',
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 500,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: 0,
          cursor: 'pointer',
        }}
      >
        {fmtDateShort(before.taken_at).toUpperCase()} · J0
      </button>
      <button
        onClick={e => {
          e.stopPropagation()
          onOpenAfter()
        }}
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          padding: '5px 10px',
          borderRadius: 999,
          background: 'rgba(0,102,224,0.92)',
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 500,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: 0,
          cursor: 'pointer',
        }}
      >
        {fmtDateShort(after.taken_at).toUpperCase()} ·{' '}
        {`J${Math.round((+new Date(after.taken_at) - +new Date(before.taken_at)) / 86_400_000)}`}
      </button>

      {/* Divider line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${position}%`,
          width: 2,
          background: '#fff',
          boxShadow: '0 0 0 1px rgba(11,20,36,0.18)',
          transform: 'translateX(-1px)',
          pointerEvents: 'none',
        }}
      />
      {/* Draggable handle */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: `${position}%`,
          width: 44,
          height: 44,
          borderRadius: 999,
          background: '#fff',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(11,20,36,0.18), 0 0 0 1px rgba(11,20,36,0.06)',
          color: 'var(--ink)',
          pointerEvents: 'none',
        }}
      >
        <Icon name="arrowL" size={14} strokeWidth={2.2} />
        <Icon name="arrowR" size={14} strokeWidth={2.2} />
      </div>
    </div>
  )
}

function SideBySide({
  before,
  after,
  onOpenBefore,
  onOpenAfter,
}: {
  before: PhotoRow
  after: PhotoRow
  onOpenBefore: () => void
  onOpenAfter: () => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, aspectRatio: '3 / 2' }}>
      <Side photo={before} label="Avant" onOpen={onOpenBefore} primaryLabel={false} />
      <Side photo={after} label="Après" onOpen={onOpenAfter} primaryLabel />
    </div>
  )
}

function Side({
  photo,
  label,
  onOpen,
  primaryLabel,
}: {
  photo: PhotoRow
  label: string
  onOpen: () => void
  primaryLabel: boolean
}) {
  return (
    <button
      onClick={onOpen}
      className="focus-ring"
      style={{
        position: 'relative',
        background: '#000',
        border: 0,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <PhotoThumb photo={photo} full className="block h-full w-full object-cover" />
      <span
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          padding: '4px 8px',
          borderRadius: 999,
          background: primaryLabel ? 'rgba(0,102,224,0.92)' : 'rgba(11,20,36,0.6)',
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 600,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {label} · {fmtDateShort(photo.taken_at)}
      </span>
    </button>
  )
}

function Overlay({
  before,
  after,
  onOpen,
}: {
  before: PhotoRow
  after: PhotoRow
  onOpen: () => void
}) {
  const [opacity, setOpacity] = useState(0.5)
  return (
    <div>
      <div
        onClick={onOpen}
        style={{ position: 'relative', aspectRatio: '3 / 4', cursor: 'pointer' }}
      >
        <PhotoThumb
          photo={before}
          full
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div style={{ position: 'absolute', inset: 0, opacity }}>
          <PhotoThumb
            photo={after}
            full
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(11,20,36,0.85)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))}
          aria-label="Opacité de la photo récente"
          style={{ width: '100%', accentColor: 'var(--primary)' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: '#fff',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            marginTop: 4,
          }}
        >
          <span>{fmtDateShort(before.taken_at).toUpperCase()}</span>
          <span>{Math.round(opacity * 100)}%</span>
          <span>{fmtDateShort(after.taken_at).toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}

function DeltaCard({
  a,
  b,
  deltaDays,
}: {
  a: PhotoRow
  b: PhotoRow
  deltaDays: number | null
}) {
  // We don't analyse pixels — surface honest, conservative copy.
  const dimsBefore = a.width && a.height ? `${a.width}×${a.height}` : '—'
  const dimsAfter = b.width && b.height ? `${b.width}×${b.height}` : '—'
  return (
    <div
      style={{
        marginTop: 14,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 16,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="ruler" size={14} stroke="var(--primary-700)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Suivi visuel
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Toujours côte-à-côte · indicatif
            </div>
          </div>
        </div>
        {deltaDays !== null && (
          <Pill tone="neutral">
            {deltaDays === 0 ? 'Même jour' : `${deltaDays} j d'écart`}
          </Pill>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DeltaTile label="Photo avant" value={fmtDateShort(a.taken_at)} sub={fmtRelative(a.taken_at)} />
        <DeltaTile label="Photo après" value={fmtDateShort(b.taken_at)} sub={fmtRelative(b.taken_at)} tone="primary" />
        <DeltaTile label="Dimensions" value={dimsBefore} mono />
        <DeltaTile label="Dimensions" value={dimsAfter} mono tone="primary" />
      </div>

      <p
        style={{
          margin: '12px 0 0',
          fontSize: 11,
          color: 'var(--muted)',
          lineHeight: '16px',
        }}
      >
        Les comparaisons sont visuelles, jamais quantitatives — elles ne remplacent
        pas l'avis d'un dermatologue. En cas d'évolution rapide, prends rendez-vous.
      </p>
    </div>
  )
}

function DeltaTile({
  label,
  value,
  sub,
  tone = 'neutral',
  mono,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'neutral' | 'primary'
  mono?: boolean
}) {
  const isPrimary = tone === 'primary'
  return (
    <div
      style={{
        background: isPrimary ? 'var(--primary-50)' : 'var(--surface-2)',
        border: isPrimary ? '1px solid var(--primary-100)' : '1px solid var(--hairline-2)',
        borderRadius: 12,
        padding: '10px 10px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: isPrimary ? 'var(--primary-700)' : 'var(--muted-2)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isPrimary ? 'var(--primary-700)' : 'var(--ink)',
          marginTop: 4,
          fontFamily: mono ? 'var(--mono)' : 'inherit',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

/* ============================================================
   PICKER — grid of photos with 2-select limit
   ============================================================ */

function ComparePicker({
  initialZone,
  onPick,
}: {
  initialZone: string
  onPick: (a: string, b: string) => void
}) {
  const nav = useNavigate()
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [zone, setZone] = useState<string>(initialZone)
  const [picked, setPicked] = useState<string[]>([])

  useEffect(() => {
    listPhotos({ zone: zone || undefined }).then(setPhotos)
  }, [zone])

  const usableZones = useMemo(() => {
    const ids = new Set((photos ?? []).map(p => p.body_zone))
    return BODY_ZONES.filter(z => ids.has(z.id) || zone === z.id)
  }, [photos, zone])

  function toggle(id: string) {
    setPicked(s =>
      s.includes(id) ? s.filter(x => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id],
    )
  }

  const pickedRows = useMemo(() => {
    if (!photos) return []
    return picked.map(id => photos.find(p => p.id === id)).filter(Boolean) as PhotoRow[]
  }, [photos, picked])

  const deltaDays = useMemo(() => {
    if (pickedRows.length !== 2) return null
    const ms = Math.abs(
      +new Date(pickedRows[0].taken_at) - +new Date(pickedRows[1].taken_at),
    )
    return Math.round(ms / 86_400_000)
  }, [pickedRows])

  return (
    <div style={{ paddingBottom: 130 }}>
      <TopBar
        title="Comparer"
        sub="Choisis 2 photos"
        left={<IconButton icon="close" label="Annuler" onClick={() => nav('/')} />}
      />

      <div style={{ padding: '8px 18px 0' }}>
        {/* Zone filter */}
        <FilterBar zone={zone} onChange={setZone} usable={usableZones} />

        {/* Selection preview */}
        {picked.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              marginBottom: 14,
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-100)',
              borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {pickedRows.map(p => (
                <div
                  key={p.id}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--surface-3)',
                  }}
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700)' }}>
                {picked.length} / 2 photo{picked.length > 1 ? 's' : ''} sélectionnée
                {picked.length > 1 ? 's' : ''}
              </div>
              {pickedRows.length === 2 && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-2)',
                    marginTop: 1,
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {fmtDateShort(pickedRows[0].taken_at)} ↔ {fmtDateShort(pickedRows[1].taken_at)} ·{' '}
                  {deltaDays} j
                </div>
              )}
            </div>
          </div>
        )}

        {!photos ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Chargement…</p>
        ) : photos.length < 2 ? (
          <EmptyPicker hasZoneFilter={Boolean(zone)} onClearZone={() => setZone('')} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {photos.map(p => {
              const isSel = picked.includes(p.id)
              const order = isSel ? picked.indexOf(p.id) + 1 : null
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="focus-ring"
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: isSel ? '2.5px solid var(--primary)' : '1px solid var(--hairline)',
                    boxShadow: isSel ? '0 0 0 3px var(--primary-50)' : 'none',
                    padding: 0,
                    background: 'var(--surface-3)',
                  }}
                >
                  <PhotoThumb photo={p} className="h-full w-full object-cover" />
                  <span
                    style={{
                      position: 'absolute',
                      right: 4,
                      bottom: 4,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: 'rgba(11,20,36,0.55)',
                      color: '#fff',
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                    }}
                  >
                    {fmtDateShort(p.taken_at)}
                  </span>
                  {isSel && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 6,
                        top: 6,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: 'var(--primary)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {order}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 80,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 640,
          padding: '12px 18px',
          background: 'linear-gradient(to top, var(--bg) 60%, rgba(245,247,251,0))',
          zIndex: 4,
        }}
      >
        <Button
          variant="primary"
          size="lg"
          full
          icon="compare"
          disabled={picked.length !== 2}
          onClick={() => onPick(picked[0], picked[1])}
        >
          {picked.length === 2 ? 'Comparer ces 2 photos' : `Choisis 2 photos (${picked.length}/2)`}
        </Button>
      </div>
    </div>
  )
}

function FilterBar({
  zone,
  onChange,
  usable,
}: {
  zone: string
  onChange: (z: string) => void
  usable: typeof BODY_ZONES
}) {
  const wrapStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 12,
    marginBottom: 14,
  }
  return (
    <div style={wrapStyle}>
      <Icon name="filter" size={16} stroke="var(--muted)" />
      <select
        value={zone}
        onChange={e => onChange(e.target.value)}
        className="focus-ring"
        style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--ink-2)',
          background: 'transparent',
          border: 0,
          outline: 'none',
          appearance: 'none',
        }}
      >
        <option value="">Toutes les zones</option>
        {usable.map(z => (
          <option key={z.id} value={z.id}>
            {z.label}
          </option>
        ))}
      </select>
      <Icon name="chevR" size={14} stroke="var(--muted-2)" />
    </div>
  )
}

function EmptyPicker({
  hasZoneFilter,
  onClearZone,
}: {
  hasZoneFilter: boolean
  onClearZone: () => void
}) {
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--surface)',
        border: '1px dashed var(--hairline)',
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'var(--primary-50)',
          color: 'var(--primary-700)',
          margin: '0 auto 10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="compare" size={20} stroke="var(--primary-700)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
        Il faut au moins 2 photos pour comparer
      </div>
      <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--muted)' }}>
        {hasZoneFilter
          ? "Cette zone n'a pas encore deux photos. Ajoute-en une autre ou retire le filtre."
          : 'Ajoute deux photos pour commencer le suivi visuel.'}
      </p>
      {hasZoneFilter && (
        <Button variant="tonal" size="sm" onClick={onClearZone}>
          Voir toutes les zones
        </Button>
      )}
    </div>
  )
}
