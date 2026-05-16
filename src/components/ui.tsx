// Nævus design system — shared primitives.
// All visual choices come from src/index.css tokens and DESIGN_SYSTEM.md.

import { type CSSProperties, type ReactNode, type ButtonHTMLAttributes, type SVGProps } from 'react'
import { Link } from 'react-router-dom'

/* ============================================================
   ICONS — minimalist line set, 24×24 grid, currentColor stroke
   ============================================================ */

export type IconName =
  | 'body'
  | 'grid'
  | 'plus'
  | 'compare'
  | 'camera'
  | 'upload'
  | 'back'
  | 'close'
  | 'more'
  | 'search'
  | 'filter'
  | 'calendar'
  | 'pin'
  | 'zoom'
  | 'expand'
  | 'check'
  | 'alert'
  | 'lock'
  | 'trash'
  | 'shield'
  | 'ruler'
  | 'layers'
  | 'arrowR'
  | 'arrowL'
  | 'chevR'
  | 'flip'
  | 'history'
  | 'sparkle'
  | 'cloud'
  | 'logout'

const ICON_PATHS: Record<IconName, ReactNode> = {
  body: <path d="M12 4a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 12 4Zm-5 8.5C7 11.4 7.9 10.5 9 10.5h6c1.1 0 2 .9 2 2v3.6l-1.4 4.4a1 1 0 0 1-1 .7h-.4a1 1 0 0 1-1-.9l-.5-3.8h-1.4l-.5 3.8a1 1 0 0 1-1 .9h-.4a1 1 0 0 1-1-.7L7 16.1V12.5Z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />,
  compare: (
    <>
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <rect x="13" y="5" width="8" height="14" rx="1.5" />
      <path d="M12 3v18" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2.2A1 1 0 0 1 9.3 5.4h5.4c.3 0 .6.2.8.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M8 8l4-4 4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  back: <path d="M15 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  close: <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v5l-4 2v-7L4 5Z" strokeLinejoin="round" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M12 3a6 6 0 0 1 6 6c0 4-6 12-6 12S6 13 6 9a6 6 0 0 1 6-6Z" />
      <circle cx="12" cy="9" r="2.2" />
    </>
  ),
  zoom: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3M8 11h6M11 8v6" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  expand: (
    <path
      d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  check: <path d="M5 12l5 5L20 7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  alert: (
    <>
      <path d="M12 3 22 20H2L12 3Z" />
      <path d="M12 10v5M12 17.5v.1" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeWidth="1.6" fill="none" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" fill="none" strokeWidth="1.6" />
    </>
  ),
  shield: <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />,
  ruler: <path d="M3 14 14 3l7 7L10 21l-7-7Zm3-1 1 1m1 1 1 1m1 1 1 1m1 1 1 1" strokeWidth="1.4" fill="none" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" fill="none" strokeWidth="1.6" />
    </>
  ),
  arrowR: <path d="M5 12h14m-5-6 6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  arrowL: <path d="M19 12H5m6 6-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  chevR: <path d="m9 6 6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  flip: (
    <path
      d="M4 12h16M8 8l-4 4 4 4M16 16l4-4-4-4"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  sparkle: (
    <path
      d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"
      strokeWidth="1.4"
      strokeLinecap="round"
      fill="none"
    />
  ),
  cloud: <path d="M7 18h11a4 4 0 0 0 .6-7.9 6 6 0 0 0-11.7-1A4 4 0 0 0 7 18Z" />,
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 8l4 4-4 4M10 12h9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
}

type IconProps = {
  name: IconName
  size?: number
  className?: string
  stroke?: string
  fill?: string
  strokeWidth?: number
  style?: CSSProperties
} & Omit<SVGProps<SVGSVGElement>, 'name'>

export function Icon({
  name,
  size = 20,
  className,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 1.6,
  style,
  ...rest
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/* ============================================================
   BUTTON
   ============================================================ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'tonal' | 'danger' | 'danger-solid' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  full?: boolean
  loading?: boolean
}

const BUTTON_SIZE: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 12px', fontSize: 13, borderRadius: 10, gap: 6 },
  md: { padding: '13px 18px', fontSize: 15, borderRadius: 12, gap: 8 },
  lg: { padding: '16px 22px', fontSize: 16, borderRadius: 14, gap: 8 },
}

const BUTTON_VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' },
  secondary: { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' },
  ghost: { background: 'transparent', color: 'var(--ink-2)', borderColor: 'transparent' },
  tonal: { background: 'var(--primary-50)', color: 'var(--primary-700)', borderColor: 'transparent' },
  danger: { background: 'var(--surface)', color: 'var(--danger)', borderColor: 'var(--danger-50)' },
  'danger-solid': { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' },
  success: { background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  full,
  style,
  className,
  disabled,
  loading,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : 18
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`focus-ring ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
        fontWeight: 550,
        lineHeight: '20px',
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        border: '1px solid transparent',
        transition: 'background var(--t-fast) var(--ease), transform var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease)',
        opacity: disabled || loading ? 0.55 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        ...BUTTON_SIZE[size],
        ...BUTTON_VARIANT[variant],
        width: full ? '100%' : undefined,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}

/* ============================================================
   PILL  / BADGE
   ============================================================ */

type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'solid'

const PILL_TONE: Record<PillTone, CSSProperties> = {
  neutral: { background: 'var(--surface-3)', color: 'var(--muted)' },
  primary: { background: 'var(--primary-50)', color: 'var(--primary-700)' },
  success: { background: 'var(--success-50)', color: 'var(--success-700)' },
  warning: { background: 'var(--warning-50)', color: 'var(--warning-700)' },
  danger: { background: 'var(--danger-50)', color: 'var(--danger-700)' },
  solid: { background: 'var(--ink)', color: '#fff' },
}

export function Pill({
  children,
  tone = 'neutral',
  style,
}: {
  children: ReactNode
  tone?: PillTone
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.01em',
        ...PILL_TONE[tone],
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/* ============================================================
   CARD
   ============================================================ */

export function Card({
  children,
  style,
  padding = 16,
  raised = false,
  className,
}: {
  children: ReactNode
  style?: CSSProperties
  padding?: number
  raised?: boolean
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--hairline)',
        boxShadow: raised ? 'var(--e2)' : 'none',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ============================================================
   ICON BUTTON  (with optional warning badge)
   ============================================================ */

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName
  label: string
  badge?: number | null
  to?: string
}

export function IconButton({ icon, label, badge, to, style, ...rest }: IconButtonProps) {
  const inner = (
    <>
      <Icon name={icon} size={18} />
      {badge != null && badge > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--warning)',
            color: '#fff',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--bg)',
          }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  )
  const sharedStyle: CSSProperties = {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ink-2)',
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    ...style,
  }
  if (to) {
    return (
      <Link to={to} aria-label={label} className="focus-ring" style={sharedStyle as CSSProperties}>
        {inner}
      </Link>
    )
  }
  return (
    <button {...rest} aria-label={label} className="focus-ring" style={sharedStyle}>
      {inner}
    </button>
  )
}

/* ============================================================
   TOP BAR
   ============================================================ */

export function TopBar({
  title,
  left,
  right,
  sub,
  transparent,
}: {
  title?: ReactNode
  left?: ReactNode
  right?: ReactNode
  sub?: ReactNode
  transparent?: boolean
}) {
  return (
    <div
      style={{
        padding: '10px 18px 6px',
        background: transparent ? 'transparent' : 'var(--bg)',
        borderBottom: transparent ? '0' : '1px solid var(--hairline-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 5,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ minWidth: 36, display: 'flex' }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        )}
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
        )}
      </div>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}

/* ============================================================
   LOGO
   ============================================================ */

export function Logo() {
  return (
    <Link
      to="/"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--ink)',
        textDecoration: 'none',
      }}
      aria-label="Nævus — accueil"
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          background: 'var(--primary)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px -4px rgba(0,102,224,0.5)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" fill="#fff" />
        </svg>
      </span>
      <span style={{ fontWeight: 650, fontSize: 16, letterSpacing: '-0.02em' }}>Nævus</span>
    </Link>
  )
}

/* ============================================================
   FILTER CHIP
   ============================================================ */

export function FilterChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring"
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 999,
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--ink-2)',
        border: active ? '1px solid var(--ink)' : '1px solid var(--hairline)',
        fontSize: 12,
        fontWeight: 550,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        transition: 'background var(--t-fast) var(--ease)',
      }}
    >
      {children}
    </button>
  )
}

/* ============================================================
   SECTION LABEL
   ============================================================ */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
      <div className="t-micro" style={{ color: 'var(--muted-2)' }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--hairline-2)' }} />
    </div>
  )
}

/* ============================================================
   FIELD (label + hint + control)
   ============================================================ */

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {label} {required && <span style={{ color: 'var(--primary)' }}>*</span>}
        </label>
        {hint && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--muted-2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ============================================================
   STAT BLOCK (small headline + value + sub)
   ============================================================ */

export function StatBlock({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'primary'
}) {
  const isPrimary = tone === 'primary'
  return (
    <div
      style={{
        background: isPrimary ? 'var(--primary-50)' : 'var(--surface)',
        color: isPrimary ? 'var(--primary-700)' : 'var(--ink)',
        border: isPrimary ? '1px solid var(--primary-100)' : '1px solid var(--hairline)',
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
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, letterSpacing: '-0.02em' }}>{value}</div>
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

/* ============================================================
   META ROW (icon + label/value pair, used in PhotoDetail)
   ============================================================ */

export function MetaRow({
  icon,
  label,
  value,
  sub,
  multiline,
  mono,
  action,
}: {
  icon: IconName
  label: string
  value: ReactNode
  sub?: ReactNode
  multiline?: boolean
  mono?: boolean
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--hairline-2)',
        alignItems: multiline ? 'flex-start' : 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'var(--primary-50)',
          color: 'var(--primary-700)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={16} stroke="var(--primary-700)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
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
            fontSize: 14,
            color: 'var(--ink)',
            marginTop: 2,
            fontWeight: multiline ? 450 : 550,
            fontFamily: mono ? 'var(--mono)' : 'inherit',
            lineHeight: '20px',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

/* ============================================================
   TONAL ICON TILE — small primary-tinted icon container
   used in tips cards, banners, meta headers
   ============================================================ */

export function IconTile({
  icon,
  size = 28,
  tone = 'primary',
}: {
  icon: IconName
  size?: number
  tone?: 'primary' | 'warning' | 'success' | 'danger' | 'neutral'
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    primary: { bg: 'var(--primary-100)', fg: 'var(--primary-700)' },
    warning: { bg: 'rgba(185,122,22,0.18)', fg: 'var(--warning-700)' },
    success: { bg: 'var(--success-50)', fg: 'var(--success-700)' },
    danger: { bg: 'var(--danger-50)', fg: 'var(--danger-700)' },
    neutral: { bg: 'var(--surface-3)', fg: 'var(--ink-2)' },
  }
  const t = tones[tone]
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size <= 28 ? 8 : 10,
        background: t.bg,
        color: t.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} stroke={t.fg} />
    </span>
  )
}

/* ============================================================
   RELATIVE DATE HELPERS
   ============================================================ */

const FR_MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Short calendar label e.g. "12 mars 2026" — current-year omits the year. */
export function fmtDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  const day = d.getDate()
  const m = FR_MONTHS_SHORT[d.getMonth()]
  const y = d.getFullYear()
  const currentYear = new Date().getFullYear()
  return y === currentYear ? `${day} ${m}` : `${day} ${m} ${y}`
}

/** Even shorter, used inside dense photo overlays — "12 mar" / "9 jan". */
export function fmtDateShort(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  return `${d.getDate()} ${FR_MONTHS_SHORT[d.getMonth()].replace('.', '').slice(0, 3)}`
}

/** Human relative tag e.g. "il y a 3 j", "il y a 2 mois". */
export function fmtRelative(iso: string | Date): string {
  const then = iso instanceof Date ? iso : new Date(iso)
  const days = Math.max(0, Math.round((Date.now() - then.getTime()) / 86_400_000))
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 21) return `il y a ${days} j`
  if (days < 60) return `il y a ${Math.round(days / 7)} sem.`
  if (days < 365) return `il y a ${Math.round(days / 30)} mois`
  const years = Math.max(1, Math.round(days / 365))
  return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`
}
