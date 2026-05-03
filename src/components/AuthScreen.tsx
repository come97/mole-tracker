import { useState } from 'react'
import { signInWithEmail, signUpWithEmail } from '../lib/auth'

type Props = {
  onAuthed: () => void
}

type Mode = 'login' | 'signup'

export default function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password)
        onAuthed()
      } else {
        const { needsEmailConfirm } = await signUpWithEmail(email.trim(), password)
        if (needsEmailConfirm) {
          setInfo("Compte créé. Confirme ton email puis reviens te connecter.")
          setMode('login')
        } else {
          onAuthed()
        }
      }
    } catch (e) {
      setError(humanize(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300 text-2xl">
            🩺
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">MoleTrack</h1>
          <p className="mt-1 text-sm text-slate-400">
            Suivi de grains de beauté, chiffré bout-en-bout.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-800 p-1 text-sm">
          <button
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
            className={`rounded-md py-2 transition ${mode === 'login' ? 'bg-indigo-500 text-white' : 'text-slate-300'}`}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
            className={`rounded-md py-2 transition ${mode === 'signup' ? 'bg-indigo-500 text-white' : 'text-slate-300'}`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="toi@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Mot de passe</label>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder={mode === 'signup' ? '8 caractères minimum' : '••••••••'}
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {info && <p className="text-sm text-emerald-300">{info}</p>}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="mt-2 rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white active:bg-indigo-600 disabled:opacity-40"
          >
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Le mot de passe protège ton compte côté Supabase. Le PIN à 6 chiffres
          (étape suivante) chiffre tes photos localement et n'est jamais envoyé.
        </p>
      </div>
    </div>
  )
}

function humanize(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (msg.toLowerCase().includes('password')) return msg
  if (msg.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  return msg
}
