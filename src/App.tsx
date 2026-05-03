import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LockScreen from './components/LockScreen'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import AddPage from './pages/Add'
import ZonePage from './pages/Zone'
import AllPhotosPage from './pages/AllPhotos'
import ComparePage from './pages/Compare'
import PhotoDetailPage from './pages/PhotoDetail'
import {
  ensureAnonSession,
  isFirstLaunch,
  setupPin,
  unlockWithPin,
} from './lib/auth'

type AppState =
  | { kind: 'loading' }
  | { kind: 'setup' }
  | { kind: 'locked'; error?: string | null }
  | { kind: 'unlocked' }

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  // Bootstrap: anonymous session + first-launch detection.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await ensureAnonSession()
        if (cancelled) return
        const first = await isFirstLaunch()
        if (cancelled) return
        setState(first ? { kind: 'setup' } : { kind: 'locked' })
      } catch (e) {
        if (cancelled) return
        console.error('Bootstrap failed', e)
        setState({ kind: 'locked', error: e instanceof Error ? e.message : 'Erreur inconnue' })
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])


  if (state.kind === 'loading') {
    return <FullCenter>Chargement…</FullCenter>
  }
  if (state.kind === 'setup') {
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
            setState({ kind: 'setup' })
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
