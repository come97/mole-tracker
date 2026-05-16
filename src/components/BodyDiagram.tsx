import { useMemo, useState } from 'react'

type View = 'front' | 'back' | 'left' | 'right'

type Props = {
  counts: Record<string, number>
  onZoneClick: (zoneId: string) => void
  /** Constrain the diagram height (Home uses a compact card; Import wants more room). */
  compact?: boolean
  /** Default view shown on mount. */
  initialView?: View
}

/**
 * Stylised body silhouette. Each path is a clickable zone whose fill darkens
 * with the photo count for that zone (density heat). Zone IDs match the ones
 * in `src/lib/bodyZones.ts` so saved photos round-trip correctly.
 */
export default function BodyDiagram({ counts, onZoneClick, compact = false, initialView = 'front' }: Props) {
  const [view, setView] = useState<View>(initialView)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <svg
        viewBox="0 0 220 460"
        width="100%"
        style={{
          display: 'block',
          maxHeight: compact ? 300 : 520,
          touchAction: 'manipulation',
          margin: '0 auto',
        }}
        aria-label={`Schéma corporel — ${view === 'back' ? 'dos' : view === 'left' ? 'profil gauche' : view === 'right' ? 'profil droit' : 'face'}`}
      >
        {view === 'front' && <FrontBody counts={counts} onClick={onZoneClick} />}
        {view === 'back' && <BackBody counts={counts} onClick={onZoneClick} />}
        {view === 'left' && <SideBody counts={counts} onClick={onZoneClick} side="left" />}
        {view === 'right' && <SideBody counts={counts} onClick={onZoneClick} side="right" />}
      </svg>
    </div>
  )
}

/* ============================================================
   Segmented Face / Dos / Profil toggle
   ============================================================ */

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const items: { id: View; label: string }[] = [
    { id: 'front', label: 'Face' },
    { id: 'back', label: 'Dos' },
    { id: 'left', label: 'Profil G' },
    { id: 'right', label: 'Profil D' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Vue du corps"
      style={{
        display: 'inline-flex',
        background: 'var(--surface-3)',
        borderRadius: 999,
        padding: 3,
        gap: 0,
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
              transition: 'background var(--t-fast) var(--ease)',
            }}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   Density coloring helpers
   ============================================================ */

function densityFill(count: number, max: number): string {
  if (!count) return 'var(--surface)'
  const t = Math.min(count / Math.max(max, 1), 1)
  // Blend primary-50 (#ecf3fd) → primary-200 (#b6d2f7) → primary-600 (#005bc9 at 0.6 alpha mix)
  // Simpler: lerp from primary-50 to primary-200 for visual density.
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  const r = lerp(0xec, 0x9d)
  const g = lerp(0xf3, 0xc5)
  const b = lerp(0xfd, 0xf2)
  return `rgb(${r}, ${g}, ${b})`
}

function densityStroke(count: number): string {
  return count ? 'var(--primary-200)' : 'var(--hairline)'
}

/* ============================================================
   Zone primitive + count badge
   ============================================================ */

function Zone({
  id,
  label,
  count,
  max,
  onClick,
  children,
}: {
  id: string
  label: string
  count: number
  max: number
  onClick: (id: string) => void
  children: (style: { fill: string; stroke: string; strokeWidth: number }) => React.ReactNode
}) {
  const fill = densityFill(count, max)
  const stroke = densityStroke(count)
  return (
    <g onClick={() => onClick(id)} style={{ cursor: 'pointer' }}>
      <title>
        {label}
        {count > 0 ? ` — ${count} photo${count > 1 ? 's' : ''}` : ''}
      </title>
      {children({ fill, stroke, strokeWidth: 1 })}
    </g>
  )
}

function CountBadge({ x, y, count }: { x: number; y: number; count: number }) {
  if (!count) return null
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={10} fill="var(--primary)" />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize="11"
        fontFamily="var(--mono)"
        fontWeight="600"
        fill="#fff"
      >
        {count > 99 ? '99+' : count}
      </text>
    </g>
  )
}

/* ============================================================
   FRONT BODY
   ============================================================ */

function FrontBody({ counts, onClick }: { counts: Record<string, number>; onClick: (id: string) => void }) {
  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts])
  const c = (id: string) => counts[id] ?? 0

  return (
    <g>
      {/* Face */}
      <Zone id="face" label="Visage" count={c('face')} max={max} onClick={onClick}>
        {s => <circle cx={110} cy={36} r={22} {...s} />}
      </Zone>
      <CountBadge x={132} y={28} count={c('face')} />

      {/* Neck */}
      <Zone id="neck" label="Cou" count={c('neck')} max={max} onClick={onClick}>
        {s => <rect x={102} y={56} width={16} height={12} rx={3} {...s} />}
      </Zone>
      <CountBadge x={130} y={62} count={c('neck')} />

      {/* Chest */}
      <Zone id="chest" label="Torse" count={c('chest')} max={max} onClick={onClick}>
        {s => <path d="M70 70 Q110 60 150 70 L156 130 Q110 138 64 130 Z" {...s} />}
      </Zone>
      <CountBadge x={110} y={100} count={c('chest')} />

      {/* Abdomen */}
      <Zone id="abdomen" label="Ventre" count={c('abdomen')} max={max} onClick={onClick}>
        {s => <path d="M70 132 Q110 138 150 132 L150 184 Q110 190 70 184 Z" {...s} />}
      </Zone>
      <CountBadge x={110} y={160} count={c('abdomen')} />

      {/* Arms */}
      <Zone id="arm-left" label="Bras gauche" count={c('arm-left')} max={max} onClick={onClick}>
        {s => <path d="M64 78 Q52 80 50 100 L48 180 Q56 184 60 180 L62 132 Q66 110 70 100 Z" {...s} />}
      </Zone>
      <CountBadge x={42} y={140} count={c('arm-left')} />

      <Zone id="arm-right" label="Bras droit" count={c('arm-right')} max={max} onClick={onClick}>
        {s => <path d="M156 78 Q168 80 170 100 L172 180 Q164 184 160 180 L158 132 Q154 110 150 100 Z" {...s} />}
      </Zone>
      <CountBadge x={178} y={140} count={c('arm-right')} />

      {/* Hands */}
      <Zone id="hand-left" label="Main gauche" count={c('hand-left')} max={max} onClick={onClick}>
        {s => <ellipse cx={51} cy={196} rx={9} ry={12} {...s} />}
      </Zone>
      <CountBadge x={36} y={200} count={c('hand-left')} />

      <Zone id="hand-right" label="Main droite" count={c('hand-right')} max={max} onClick={onClick}>
        {s => <ellipse cx={169} cy={196} rx={9} ry={12} {...s} />}
      </Zone>
      <CountBadge x={184} y={200} count={c('hand-right')} />

      {/* Thighs */}
      <Zone id="thigh-left" label="Cuisse gauche" count={c('thigh-left')} max={max} onClick={onClick}>
        {s => <path d="M76 188 Q82 250 82 296 L102 296 Q104 250 104 188 Z" {...s} />}
      </Zone>
      <CountBadge x={70} y={240} count={c('thigh-left')} />

      <Zone id="thigh-right" label="Cuisse droite" count={c('thigh-right')} max={max} onClick={onClick}>
        {s => <path d="M144 188 Q138 250 138 296 L118 296 Q116 250 116 188 Z" {...s} />}
      </Zone>
      <CountBadge x={150} y={240} count={c('thigh-right')} />

      {/* Shins */}
      <Zone id="shin-left" label="Tibia gauche" count={c('shin-left')} max={max} onClick={onClick}>
        {s => <path d="M82 296 L102 296 L100 410 L86 410 Z" {...s} />}
      </Zone>
      <CountBadge x={70} y={350} count={c('shin-left')} />

      <Zone id="shin-right" label="Tibia droit" count={c('shin-right')} max={max} onClick={onClick}>
        {s => <path d="M138 296 L118 296 L120 410 L134 410 Z" {...s} />}
      </Zone>
      <CountBadge x={150} y={350} count={c('shin-right')} />

      {/* Feet — decorative, not zones */}
      <ellipse cx={93} cy={420} rx={11} ry={6} fill="var(--surface)" stroke="var(--hairline)" />
      <ellipse cx={127} cy={420} rx={11} ry={6} fill="var(--surface)" stroke="var(--hairline)" />
    </g>
  )
}

/* ============================================================
   BACK BODY
   ============================================================ */

function BackBody({ counts, onClick }: { counts: Record<string, number>; onClick: (id: string) => void }) {
  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts])
  const c = (id: string) => counts[id] ?? 0

  return (
    <g>
      <Zone id="scalp" label="Cuir chevelu" count={c('scalp')} max={max} onClick={onClick}>
        {s => <circle cx={110} cy={36} r={22} {...s} />}
      </Zone>
      <CountBadge x={132} y={28} count={c('scalp')} />

      {/* Neck (decorative) */}
      <rect x={102} y={56} width={16} height={12} rx={3} fill="var(--surface)" stroke="var(--hairline)" />

      <Zone id="back-upper" label="Haut du dos" count={c('back-upper')} max={max} onClick={onClick}>
        {s => <path d="M70 70 Q110 60 150 70 L156 130 Q110 138 64 130 Z" {...s} />}
      </Zone>
      <CountBadge x={110} y={100} count={c('back-upper')} />

      <Zone id="back-lower" label="Bas du dos" count={c('back-lower')} max={max} onClick={onClick}>
        {s => <path d="M70 132 Q110 138 150 132 L150 174 Q110 178 70 174 Z" {...s} />}
      </Zone>
      <CountBadge x={110} y={156} count={c('back-lower')} />

      <Zone id="glutes" label="Fessiers" count={c('glutes')} max={max} onClick={onClick}>
        {s => <path d="M70 174 Q110 184 150 174 L150 200 Q110 210 70 200 Z" {...s} />}
      </Zone>
      <CountBadge x={110} y={194} count={c('glutes')} />

      <Zone id="arm-left" label="Bras gauche" count={c('arm-left')} max={max} onClick={onClick}>
        {s => <path d="M64 78 Q52 80 50 100 L48 180 Q56 184 60 180 L62 132 Q66 110 70 100 Z" {...s} />}
      </Zone>
      <CountBadge x={42} y={140} count={c('arm-left')} />

      <Zone id="arm-right" label="Bras droit" count={c('arm-right')} max={max} onClick={onClick}>
        {s => <path d="M156 78 Q168 80 170 100 L172 180 Q164 184 160 180 L158 132 Q154 110 150 100 Z" {...s} />}
      </Zone>
      <CountBadge x={178} y={140} count={c('arm-right')} />

      <Zone id="thigh-left" label="Cuisse gauche" count={c('thigh-left')} max={max} onClick={onClick}>
        {s => <path d="M76 200 Q82 250 82 296 L102 296 Q104 250 104 200 Z" {...s} />}
      </Zone>
      <CountBadge x={70} y={244} count={c('thigh-left')} />

      <Zone id="thigh-right" label="Cuisse droite" count={c('thigh-right')} max={max} onClick={onClick}>
        {s => <path d="M144 200 Q138 250 138 296 L118 296 Q116 250 116 200 Z" {...s} />}
      </Zone>
      <CountBadge x={150} y={244} count={c('thigh-right')} />

      <Zone id="calf-left" label="Mollet gauche" count={c('calf-left')} max={max} onClick={onClick}>
        {s => <path d="M82 296 L102 296 L100 410 L86 410 Z" {...s} />}
      </Zone>
      <CountBadge x={70} y={350} count={c('calf-left')} />

      <Zone id="calf-right" label="Mollet droit" count={c('calf-right')} max={max} onClick={onClick}>
        {s => <path d="M138 296 L118 296 L120 410 L134 410 Z" {...s} />}
      </Zone>
      <CountBadge x={150} y={350} count={c('calf-right')} />

      <ellipse cx={93} cy={420} rx={11} ry={6} fill="var(--surface)" stroke="var(--hairline)" />
      <ellipse cx={127} cy={420} rx={11} ry={6} fill="var(--surface)" stroke="var(--hairline)" />
    </g>
  )
}

/* ============================================================
   SIDE BODY — for flank-left / flank-right zones
   ============================================================ */

function SideBody({
  counts,
  onClick,
  side,
}: {
  counts: Record<string, number>
  onClick: (id: string) => void
  side: 'left' | 'right'
}) {
  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts])
  const c = (id: string) => counts[id] ?? 0
  const flankId = side === 'left' ? 'flank-left' : 'flank-right'
  const flankLabel = side === 'left' ? 'Flanc gauche' : 'Flanc droit'
  const flip = side === 'left'
  return (
    <g transform={flip ? 'matrix(-1 0 0 1 220 0)' : undefined}>
      {/* Head (profile) */}
      <path
        d="M96 18 Q120 14 128 36 Q132 52 122 60 L116 60 L114 68 L102 68 Q92 60 92 44 Q92 26 96 18 Z"
        fill="var(--surface)"
        stroke="var(--hairline)"
        strokeWidth={1}
      />
      <rect x={104} y={66} width={14} height={10} rx={3} fill="var(--surface)" stroke="var(--hairline)" strokeWidth={1} />
      <path
        d="M96 76 Q108 72 124 78 L130 132 Q126 138 120 138 L96 138 Q90 130 90 110 Z"
        fill="var(--surface)"
        stroke="var(--hairline)"
        strokeWidth={1}
      />
      <Zone id={flankId} label={flankLabel} count={c(flankId)} max={max} onClick={onClick}>
        {s => <path d="M96 138 Q120 138 130 132 L132 188 Q120 196 96 192 Z" {...s} />}
      </Zone>
      <g transform={flip ? 'matrix(-1 0 0 1 220 0)' : undefined}>
        <CountBadge x={flip ? 220 - 150 : 150} y={164} count={c(flankId)} />
      </g>
      <path
        d="M118 80 Q132 88 134 110 L132 180 Q126 184 122 180 L120 132 Q116 110 114 100 Z"
        fill="var(--surface)"
        stroke="var(--hairline)"
        strokeWidth={1}
      />
      <path
        d="M94 192 Q120 196 132 192 L128 296 Q108 300 92 296 Z"
        fill="var(--surface)"
        stroke="var(--hairline)"
        strokeWidth={1}
      />
      <path
        d="M96 296 Q120 300 128 296 L122 410 L100 410 Z"
        fill="var(--surface)"
        stroke="var(--hairline)"
        strokeWidth={1}
      />
      <ellipse cx={114} cy={420} rx={18} ry={6} fill="var(--surface)" stroke="var(--hairline)" />
    </g>
  )
}

/* ============================================================
   Density legend — exported for screens that want to surface it
   ============================================================ */

export function DensityLegend() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 6px',
        background: 'var(--surface-3)',
        borderRadius: 999,
        fontSize: 10,
        color: 'var(--muted)',
        fontWeight: 550,
      }}
    >
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {['var(--primary-50)', 'var(--primary-100)', 'var(--primary-200)'].map((bg, i) => (
          <span
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: bg,
              border: '1px solid var(--hairline)',
            }}
          />
        ))}
      </span>
      <span style={{ letterSpacing: '0.01em' }}>Densité</span>
    </div>
  )
}
