import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LockScreen from './components/LockScreen'
import AuthScreen from './components/AuthScreen'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import AddPage from './pages/Add'
import ImportPage from './pages/Import'
import ZonePage from './pages/Zone'
import AllPhotosPage from './pages/AllPhotos'
import ComparePage from './pages/Compare'
import PhotoDetailPage from './pages/PhotoDetail'
import DuplicatesPage from './pages/Duplicates'
import {
  hasSession,
  isPinSetupNeeded,
  restoreSessionFromStorage,
  setupPin,
  unlockWithPin,
} from './lib/auth'
import { importQueue } from './lib/importQueue'

type AppState =
  | { kind: 'loading' }
  | { kind: 'unauthed' }
  | { kind: 'setup-pin' }
  | { kind: 'locked'; error?: string | null }
  | { kind: 'unlocked' }
  // Surfaced when bootstrap can't reach the backend (Supabase paused, DNS
  // failure, offline, …) so the user sees something actionable instead of
  // an infinite spinner.
  | { kind: 'backend-down'; detail: string }

/** Wrap an async call so it rejects after `ms` instead of hanging forever.
 *  Supabase's auth client can stall for tens of seconds when its endpoint is
 *  unreachable — this keeps the UI honest. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ])
}

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  // Bootstrap: do we have a Supabase session? has the user set a PIN already?
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        // 8s is plenty for a healthy network round-trip; anything longer
        // means the backend is unreachable — show an error, don't spin.
        const authed = await withTimeout(hasSession(), 8000, 'hasSession')
        if (cancelled) return
        if (!authed) {
          setState({ kind: 'unauthed' })
          return
        }
        const needSetup = await withTimeout(isPinSetupNeeded(), 8000, 'isPinSetupNeeded')
        if (cancelled) return
        if (needSetup) {
          setState({ kind: 'setup-pin' })
          return
        }
        // Try to restore the AES key from sessionStorage (persists across page
        // refreshes within the same tab; cleared when the tab/browser closes).
        const restored = await restoreSessionFromStorage()
        if (cancelled) return
        setState(restored ? { kind: 'unlocked' } : { kind: 'locked' })
      } catch (e) {
        if (cancelled) return
        console.error('Bootstrap failed', e)
        const msg = e instanceof Error ? e.message : String(e)
        // Network/timeout errors → dedicated "backend down" screen with a
        // retry button. Auth-shaped failures fall back to the login screen
        // as before.
        if (/timeout|fetch|network/i.test(msg)) {
          setState({ kind: 'backend-down', detail: msg })
        } else {
          setState({ kind: 'unauthed' })
        }
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  // Hydrate the persistent import queue once the AES key is available.
  // Resetting on lock prevents leftover preview URLs across sessions.
  useEffect(() => {
    if (state.kind === 'unlocked') {
      void importQueue.hydrate()
    } else if (state.kind === 'locked' || state.kind === 'unauthed') {
      importQueue.reset()
    }
  }, [state.kind])

  if (state.kind === 'loading') {
    return <FullCenter>Chargement…</FullCenter>
  }

  if (state.kind === 'backend-down') {
    return (
      <div className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-3xl">⚠️</p>
          <h1 className="mt-2 text-base font-semibold text-slate-100">
            Serveur injoignable
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Le backend (Supabase) ne répond pas. Si le projet a été mis en
            pause par inactivité, attends une minute et réessaie.
          </p>
          <p className="mt-3 break-words text-[11px] text-slate-500">
            {state.detail}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white active:bg-indigo-600"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  if (state.kind === 'unauthed') {
    return (
      <AuthScreen
        onAuthed={async () => {
          setState({ kind: 'loading' })
          const needSetup = await isPinSetupNeeded()
          setState(needSetup ? { kind: 'setup-pin' } : { kind: 'locked' })
        }}
      />
    )
  }

  if (state.kind === 'setup-pin') {
    return (
      <LockScreen
        mode="setup"
        busy={busy}
        onSubmit={async pin => {
          setBusy(true)
          try {
            await setupPin(pin)
            setState({ kind: 'unlocked' })
          } catch (e) {
            alert(`Erreur création du code : ${e instanceof Error ? e.message : e}`)
          } finally {
            setBusy(false)
          }
        }}
      />
    )
  }

  if (state.kind === 'locked') {
    return (
      <LockScreen
        mode="unlock"
        busy={busy}
        error={state.error ?? null}
        onSubmit={async pin => {
          setBusy(true)
          try {
            const ok = await unlockWithPin(pin)
            if (ok) setState({ kind: 'unlocked' })
            else setState({ kind: 'locked', error: 'Code incorrect.' })
          } catch (e) {
            setState({ kind: 'locked', error: e instanceof Error ? e.message : 'Erreur' })
          } finally {
            setBusy(false)
          }
        }}
      />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="all" element={<AllPhotosPage />} />
          <Route path="add" element={<AddPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="zone/:zone" element={<ZonePage />} />
          <Route path="photo/:id" element={<PhotoDetailPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="duplicates" element={<DuplicatesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center text-slate-300">{children}</div>
  )
}
