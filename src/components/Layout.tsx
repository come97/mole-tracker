import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { lockSession } from '../lib/auth'

export default function Layout() {
  const nav = useNavigate()
  function lock() {
    lockSession()
    nav('/', { replace: true })
    // Trigger app-level re-check; simplest: reload.
    window.location.reload()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-screen-sm flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <Link to="/" className="text-base font-semibold text-slate-100">
          MoleTrack
        </Link>
        <button
          onClick={lock}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
          title="Verrouiller"
        >
          🔒 Verrouiller
        </button>
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
