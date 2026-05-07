import { useState } from 'react'

type Props = {
  counts: Record<string, number>
  onZoneClick: (zoneId: string) => void
}

// Stylised front/back silhouette built from simple shapes.
// Each <g data-zone> is a clickable region. Hovering / focused = highlight.

export default function BodyDiagram({ counts, onZoneClick }: Props) {
  const [view, setView] = useState<'front' | 'back' | 'left' | 'right'>('front')

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <ToggleBtn active={view === 'front'} onClick={() => setView('front')}>Face</ToggleBtn>
        <ToggleBtn active={view === 'back'} onClick={() => setView('back')}>Dos</ToggleBtn>
        <ToggleBtn active={view === 'left'} onClick={() => setView('left')}>Profil G</ToggleBtn>
        <ToggleBtn active={view === 'right'} onClick={() => setView('right')}>Profil D</ToggleBtn>
      </div>

      <div className="rounded-2xl bg-slate-900/60 p-3">
        <svg
          viewBox="0 0 220 460"
          className="mx-auto h-[78vh] max-h-[760px] w-auto"
          style={{ touchAction: 'manipulation' }}
        >
          {view === 'front' && <FrontBody counts={counts} onClick={onZoneClick} />}
          {view === 'back' && <BackBody counts={counts} onClick={onZoneClick} />}
          {view === 'left' && <SideBody counts={counts} onClick={onZoneClick} side="left" />}
          {view === 'right' && <SideBody counts={counts} onClick={onZoneClick} side="right" />}
        </svg>
      </div>

      <p className="mt-3 px-2 text-center text-xs text-slate-500">
        Touche une zone pour voir tes photos. Le pastille indique le nombre de clichés.
      </p>
    </div>
  )
}

function ToggleBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition ${
        active ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

/* ---------- Shared shape primitives ---------- */

function Zone({
  id, label, count, onClick, children,
}: {
  id: string
  label: string
  count: number
  onClick: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <g
      onClick={() => onClick(id)}
      style={{ cursor: 'pointer' }}
      className="zone-group"
    >
      <title>{label}{count > 0 ? ` — ${count} photo${count > 1 ? 's' : ''}` : ''}</title>
      {children}
    </g>
  )
}

function CountBadge({ x, y, count }: { x: number; y: number; count: number }) {
  if (!count) return null
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={9} fill="#6366f1" />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#fff"
      >
        {count > 99 ? '99+' : count}
      </text>
    </g>
  )
}

const skinFill = '#1f2a44'
const skinStroke = '#475569'

/* ---------- Front body ---------- */

function FrontBody({ counts, onClick }: { counts: Record<string, number>; onClick: (id: string) => void }) {
  const c = (id: string) => counts[id] ?? 0
  return (
    <g fill={skinFill} stroke={skinStroke} strokeWidth={1.2}>
      {/* Head */}
      <Zone id="face" label="Visage" count={c('face')} onClick={onClick}>
        <circle cx={110} cy={36} r={22} />
        <CountBadge x={132} y={28} count={c('face')} />
      </Zone>
      {/* Neck */}
      <Zone id="neck" label="Cou" count={c('neck')} onClick={onClick}>
        <rect x={102} y={56} width={16} height={12} rx={3} />
        <CountBadge x={130} y={62} count={c('neck')} />
      </Zone>
      {/* Chest */}
      <Zone id="chest" label="Torse" count={c('chest')} onClick={onClick}>
        <path d="M70 70 Q110 60 150 70 L156 130 Q110 138 64 130 Z" />
        <CountBadge x={110} y={100} count={c('chest')} />
      </Zone>
      {/* Abdomen */}
      <Zone id="abdomen" label="Ventre" count={c('abdomen')} onClick={onClick}>
        <path d="M70 132 Q110 138 150 132 L150 184 Q110 190 70 184 Z" />
        <CountBadge x={110} y={160} count={c('abdomen')} />
      </Zone>
      {/* Arms */}
      <Zone id="arm-left" label="Bras gauche" count={c('arm-left')} onClick={onClick}>
        <path d="M64 78 Q52 80 50 100 L48 180 Q56 184 60 180 L62 132 Q66 110 70 100 Z" />
        <CountBadge x={42} y={140} count={c('arm-left')} />
      </Zone>
      <Zone id="arm-right" label="Bras droit" count={c('arm-right')} onClick={onClick}>
        <path d="M156 78 Q168 80 170 100 L172 180 Q164 184 160 180 L158 132 Q154 110 150 100 Z" />
        <CountBadge x={178} y={140} count={c('arm-right')} />
      </Zone>
      {/* Hands */}
      <Zone id="hand-left" label="Main gauche" count={c('hand-left')} onClick={onClick}>
        <ellipse cx={51} cy={196} rx={9} ry={12} />
        <CountBadge x={36} y={200} count={c('hand-left')} />
      </Zone>
      <Zone id="hand-right" label="Main droite" count={c('hand-right')} onClick={onClick}>
        <ellipse cx={169} cy={196} rx={9} ry={12} />
        <CountBadge x={184} y={200} count={c('hand-right')} />
      </Zone>
      {/* Thighs */}
      <Zone id="thigh-left" label="Cuisse gauche" count={c('thigh-left')} onClick={onClick}>
        <path d="M76 188 Q82 250 82 296 L102 296 Q104 250 104 188 Z" />
        <CountBadge x={70} y={240} count={c('thigh-left')} />
      </Zone>
      <Zone id="thigh-right" label="Cuisse droite" count={c('thigh-right')} onClick={onClick}>
        <path d="M144 188 Q138 250 138 296 L118 296 Q116 250 116 188 Z" />
        <CountBadge x={150} y={240} count={c('thigh-right')} />
      </Zone>
      {/* Shins */}
      <Zone id="shin-left" label="Tibia gauche" count={c('shin-left')} onClick={onClick}>
        <path d="M82 296 L102 296 L100 410 L86 410 Z" />
        <CountBadge x={70} y={350} count={c('shin-left')} />
      </Zone>
      <Zone id="shin-right" label="Tibia droit" count={c('shin-right')} onClick={onClick}>
        <path d="M138 296 L118 296 L120 410 L134 410 Z" />
        <CountBadge x={150} y={350} count={c('shin-right')} />
      </Zone>
      {/* Feet */}
      <ellipse cx={93} cy={420} rx={11} ry={6} fill={skinFill} stroke={skinStroke} />
      <ellipse cx={127} cy={420} rx={11} ry={6} fill={skinFill} stroke={skinStroke} />
    </g>
  )
}

/* ---------- Back body ---------- */

function BackBody({ counts, onClick }: { counts: Record<string, number>; onClick: (id: string) => void }) {
  const c = (id: string) => counts[id] ?? 0
  return (
    <g fill={skinFill} stroke={skinStroke} strokeWidth={1.2}>
      {/* Scalp / head */}
      <Zone id="scalp" label="Cuir chevelu" count={c('scalp')} onClick={onClick}>
        <circle cx={110} cy={36} r={22} />
        <CountBadge x={132} y={28} count={c('scalp')} />
      </Zone>
      <rect x={102} y={56} width={16} height={12} rx={3} />
      {/* Upper back */}
      <Zone id="back-upper" label="Haut du dos" count={c('back-upper')} onClick={onClick}>
        <path d="M70 70 Q110 60 150 70 L156 130 Q110 138 64 130 Z" />
        <CountBadge x={110} y={100} count={c('back-upper')} />
      </Zone>
      {/* Lower back */}
      <Zone id="back-lower" label="Bas du dos" count={c('back-lower')} onClick={onClick}>
        <path d="M70 132 Q110 138 150 132 L150 174 Q110 178 70 174 Z" />
        <CountBadge x={110} y={156} count={c('back-lower')} />
      </Zone>
      {/* Glutes */}
      <Zone id="glutes" label="Fessiers" count={c('glutes')} onClick={onClick}>
        <path d="M70 174 Q110 184 150 174 L150 200 Q110 210 70 200 Z" />
        <CountBadge x={110} y={194} count={c('glutes')} />
      </Zone>
      {/* Arms (back side) */}
      <Zone id="arm-left" label="Bras gauche" count={c('arm-left')} onClick={onClick}>
        <path d="M64 78 Q52 80 50 100 L48 180 Q56 184 60 180 L62 132 Q66 110 70 100 Z" />
        <CountBadge x={42} y={140} count={c('arm-left')} />
      </Zone>
      <Zone id="arm-right" label="Bras droit" count={c('arm-right')} onClick={onClick}>
        <path d="M156 78 Q168 80 170 100 L172 180 Q164 184 160 180 L158 132 Q154 110 150 100 Z" />
        <CountBadge x={178} y={140} count={c('arm-right')} />
      </Zone>
      {/* Thighs (back) — same zone ids as the front view */}
      <Zone id="thigh-left" label="Cuisse gauche" count={c('thigh-left')} onClick={onClick}>
        <path d="M76 200 Q82 250 82 296 L102 296 Q104 250 104 200 Z" />
        <CountBadge x={70} y={244} count={c('thigh-left')} />
      </Zone>
      <Zone id="thigh-right" label="Cuisse droite" count={c('thigh-right')} onClick={onClick}>
        <path d="M144 200 Q138 250 138 296 L118 296 Q116 250 116 200 Z" />
        <CountBadge x={150} y={244} count={c('thigh-right')} />
      </Zone>
      {/* Calves */}
      <Zone id="calf-left" label="Mollet gauche" count={c('calf-left')} onClick={onClick}>
        <path d="M82 296 L102 296 L100 410 L86 410 Z" />
        <CountBadge x={70} y={350} count={c('calf-left')} />
      </Zone>
      <Zone id="calf-right" label="Mollet droit" count={c('calf-right')} onClick={onClick}>
        <path d="M138 296 L118 296 L120 410 L134 410 Z" />
        <CountBadge x={150} y={350} count={c('calf-right')} />
      </Zone>
      <ellipse cx={93} cy={420} rx={11} ry={6} fill={skinFill} stroke={skinStroke} />
      <ellipse cx={127} cy={420} rx={11} ry={6} fill={skinFill} stroke={skinStroke} />
    </g>
  )
}

/* ---------- Side body (left / right profile) ---------- */

function SideBody({
  counts, onClick, side,
}: { counts: Record<string, number>; onClick: (id: string) => void; side: 'left' | 'right' }) {
  const c = (id: string) => counts[id] ?? 0
  const flankId = side === 'left' ? 'flank-left' : 'flank-right'
  const flankLabel = side === 'left' ? 'Flanc gauche' : 'Flanc droit'
  // Base silhouette faces right; mirror for the left-profile view.
  const flip = side === 'left'
  return (
    <g
      fill={skinFill}
      stroke={skinStroke}
      strokeWidth={1.2}
      transform={flip ? 'matrix(-1 0 0 1 220 0)' : undefined}
    >
      {/* Head (profile) */}
      <path d="M96 18 Q120 14 128 36 Q132 52 122 60 L116 60 L114 68 L102 68 Q92 60 92 44 Q92 26 96 18 Z" />
      {/* Neck */}
      <rect x={104} y={66} width={14} height={10} rx={3} />
      {/* Torso (profile) */}
      <path d="M96 76 Q108 72 124 78 L130 132 Q126 138 120 138 L96 138 Q90 130 90 110 Z" />
      {/* Flank — the side of the trunk between armpit and hip */}
      <Zone id={flankId} label={flankLabel} count={c(flankId)} onClick={onClick}>
        <path d="M96 138 Q120 138 130 132 L132 188 Q120 196 96 192 Z" />
        <g transform={flip ? 'matrix(-1 0 0 1 220 0)' : undefined}>
          <CountBadge x={flip ? 220 - 150 : 150} y={164} count={c(flankId)} />
        </g>
      </Zone>
      {/* Arm (profile, pinned along the side) */}
      <path d="M118 80 Q132 88 134 110 L132 180 Q126 184 122 180 L120 132 Q116 110 114 100 Z" />
      {/* Hip / thigh */}
      <path d="M94 192 Q120 196 132 192 L128 296 Q108 300 92 296 Z" />
      {/* Lower leg */}
      <path d="M96 296 Q120 300 128 296 L122 410 L100 410 Z" />
      {/* Foot */}
      <ellipse cx={114} cy={420} rx={18} ry={6} fill={skinFill} stroke={skinStroke} />
    </g>
  )
}
