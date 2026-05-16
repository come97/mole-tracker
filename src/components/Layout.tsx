import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getCurrentUserEmail, lockSession, signOut } from '../lib/auth'
import { countDuplicateExtras } from '../lib/photos'
import { Icon, IconButton, Logo, type IconName } from './ui'

export default function Layout() {
  const nav = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Count of *extra* duplicate copies. Drives the badge on the menu button so the
  // user discovers the cleanup tool when there's something to clean up.
  const [dupCount, setDupCount] = useState<number>(0)

  useEffect(() => {
    getCurrentUserEmail().then(setEmail).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    countDuplicateExtras()
      .then(n => {
        if (!cancelled) setDupCount(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  function lock() {
    lockSession()
    nav('/', { replace: true })
    window.location.reload()
  }

  async function disconnect() {
    if (!confirm('Te déconnecter ? Tu devras retaper email + mot de passe + PIN pour revenir.')) return
    await signOut()
    window.location.reload()
  }

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-screen-sm flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(245, 247, 251, 0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--hairline-2)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Logo />
        <div style={{ position: 'relative' }}>
          <IconButton
            icon="more"
            label="Menu compte"
            badge={dupCount}
            onClick={() => setMenuOpen(o => !o)}
          />

          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 20 }}
                aria-hidden="true"
              />
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 44,
                  zIndex: 30,
                  width: 240,
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 14,
                  boxShadow: 'var(--e3)',
                  overflow: 'hidden',
                }}
              >
                {email && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--hairline-2)',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    <span style={{ color: 'var(--muted-2)' }}>Connecté · </span>
                    <span style={{ color: 'var(--ink)', fontWeight: 550 }}>{email}</span>
                  </div>
                )}
                <MenuRow
                  icon="layers"
                  label="Doublons"
                  trailing={
                    dupCount > 0 ? (
                      <span
                        style={{
                          background: 'var(--warning-50)',
                          color: 'var(--warning-700)',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {dupCount}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>aucun</span>
                    )
                  }
                  onClick={() => {
                    setMenuOpen(false)
                    nav('/duplicates')
                  }}
                />
                <MenuRow
                  icon="lock"
                  label="Verrouiller"
                  onClick={() => {
                    setMenuOpen(false)
                    lock()
                  }}
                />
                <MenuRow
                  icon="logout"
                  label="Se déconnecter"
                  destructive
                  onClick={() => {
                    setMenuOpen(false)
                    void disconnect()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden" style={{ paddingBottom: 96 }}>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

function MenuRow({
  icon,
  label,
  trailing,
  destructive,
  onClick,
}: {
  icon: IconName
  label: string
  trailing?: React.ReactNode
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '11px 14px',
        background: 'transparent',
        border: 0,
        color: destructive ? 'var(--danger)' : 'var(--ink)',
        fontSize: 14,
        fontWeight: 550,
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={16} stroke={destructive ? 'var(--danger)' : 'var(--ink-2)'} />
      <span style={{ flex: 1 }}>{label}</span>
      {trailing}
    </button>
  )
}

/* ============================================================
   BOTTOM NAV — Corps / Photos / + / Comparer
   ============================================================ */

type Tab = { to: string; label: string; icon: IconName; end?: boolean; primary?: boolean }

const TABS: Tab[] = [
  { to: '/', label: 'Corps', icon: 'body', end: true },
  { to: '/all', label: 'Photos', icon: 'grid' },
  { to: '/add', label: 'Ajouter', icon: 'plus', primary: true },
  { to: '/compare', label: 'Comparer', icon: 'compare' },
]

function BottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 0,
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 640,
        zIndex: 10,
        background: 'rgba(245, 247, 251, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--hairline)',
        padding: '8px 8px calc(8px + env(safe-area-inset-bottom, 12px))',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
      }}
    >
      {TABS.map(t => (
        <TabLink key={t.to} {...t} />
      ))}
    </nav>
  )
}

function TabLink({ to, label, icon, end, primary }: Tab) {
  return (
    <NavLink
      to={to}
      end={end}
      className="focus-ring"
      style={({ isActive }) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '6px 0',
        color: primary ? 'var(--muted)' : isActive ? 'var(--primary)' : 'var(--muted-2)',
        textDecoration: 'none',
      })}
      aria-label={label}
    >
      {({ isActive }) =>
        primary ? (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--primary)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 14px -4px rgba(0, 102, 224, 0.45)',
              }}
            >
              <Icon name={icon} size={22} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</span>
          </>
        ) : (
          <>
            <Icon name={icon} size={22} strokeWidth={isActive ? 2 : 1.6} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</span>
          </>
        )
      }
    </NavLink>
  )
}
