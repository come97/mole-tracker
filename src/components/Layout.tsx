import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUserEmail, lockSession, signOut } from '../lib/auth'

export default function Layout() {
  const nav = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    getCurrentUserEmail().then(setEmail).catch(() => {})
  }, [])

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
    <div className="mx-auto flex min-h-full w-full max-w-screen-sm flex-col">
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <Link to="/" className="text-base font-semibold text-slate-100">
          MoleTrack
        </Link>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
          aria-label="Menu compte"
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-20"
            />
            <div className="absolute right-3 top-12 z-30 w-60 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              {email && (
                <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400 truncate">
                  Connecté · <span className="text-slate-200">{email}</span>
                </div>
              )}
              <button
                onClick={() => { setMenuOpen(false); lock() }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                🔒 Verrouiller
              </button>
              <button
                onClick={() => { setMenuOpen(false); void disconnect() }}
                className="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800"
              >
                ↗ Se déconnecter
              </button>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-x-hidden pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-screen-sm -translate-x-1/2 justify-around border-t border-slate-800 bg-[var(--color-bg)]/95 px-2 py-2 backdrop-blur">
        <TabLink to="/" label="Corps" icon="👤" end />
        <TabLink to="/all" label="Toutes" icon="🗂️" />
        <TabLink to="/add" label="Ajouter" icon="➕" />
        <TabLink to="/compare" label="Comparer" icon="🔍" />
      </nav>
    </div>
  )
}

function TabLink({
  to, label, icon, end,
}: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-xs ${
          isActive ? 'text-indigo-300' : 'text-slate-400'
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
