import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LockScreen from './components/LockScreen'
import AuthScreen from './components/AuthScreen'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import AddPage from './pages/Add'
import ZonePage from './pages/Zone'
import AllPhotosPage from './pages/AllPhotos'
import ComparePage from './pages/Compare'
import PhotoDetailPage from './pages/PhotoDetail'
import {
  hasSession,
  isPinSetupNeeded,
  setupPin,
  unlockWithPin,
} from './lib/auth'

type AppState =
  | { kind: 'loading' }
  | { kind: 'unauthed' }
  | { kind: 'setup-pin' }
  | { kind: 'locked'; error?: string | null }
  | { kind: 'unlocked' }

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  // Bootstrap: do we have a Supabase session? has the user set a PIN already?
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const authed = await hasSession()
        if (cancelled) return
        if (!authed) {
          setState({ kind: 'unauthed' })
          return
        }
        const needSetup = await isPinSetupNeeded()
        if (cancelled) return
        setState(needSetup ? { kind: 'setup-pin' } : { kind: 'locked' })
      } catch (e) {
        if (cancelled) return
        console.error('Bootstrap failed', e)
        setState({ kind: 'unauthed' })
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  if (state.kind === 'loading') {
    return <FullCenter>Chargement…</FullCenter>
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
          <Route path="zone/:zone" element={<ZonePage />} />
          <Route path="photo/:id" element={<PhotoDetailPage />} />
          <Route path="compare" element={<ComparePage />} />
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
