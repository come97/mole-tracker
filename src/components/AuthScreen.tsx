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
          setInfo('Compte créé. Confirme ton email puis reviens te connecter.')
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '40px 24px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--primary)',
              color: '#fff',
              margin: '0 auto 14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px -8px rgba(0, 102, 224, 0.5)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="2" />
              <circle cx="12" cy="12" r="2.5" fill="#fff" />
            </svg>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Nævus
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            Suivi de grains de beauté, chiffré bout-en-bout.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Mode d'authentification"
          style={{
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--surface-3)',
            borderRadius: 12,
            padding: 3,
            fontSize: 13,
          }}
        >
          {(['login', 'signup'] as Mode[]).map(m => {
            const active = mode === m
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setInfo(null)
                }}
                className="focus-ring"
                style={{
                  padding: '8px',
                  borderRadius: 9,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: 600,
                  boxShadow: active ? 'var(--e1)' : 'none',
                  border: 0,
                }}
              >
                {m === 'login' ? 'Connexion' : 'Créer un compte'}
              </button>
            )
          })}
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <FieldGroup label="Email">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="toi@example.com"
              className="focus-ring"
              style={inputStyle}
            />
          </FieldGroup>
          <FieldGroup label="Mot de passe">
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? '8 caractères minimum' : '••••••••'}
              className="focus-ring"
              style={inputStyle}
            />
          </FieldGroup>

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--danger-50)',
                color: 'var(--danger-700)',
                fontSize: 13,
              }}
            >
              {error}
            </p>
          )}
          {info && (
            <p
              role="status"
              style={{
                margin: 0,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--success-50)',
                color: 'var(--success-700)',
                fontSize: 13,
              }}
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="focus-ring"
            style={{
              marginTop: 6,
              padding: '14px 16px',
              borderRadius: 14,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              border: 0,
              opacity: busy || !email || !password ? 0.55 : 1,
              cursor: busy || !email || !password ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 20px -8px rgba(0, 102, 224, 0.5)',
            }}
          >
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p
          style={{
            marginTop: 22,
            fontSize: 12,
            color: 'var(--muted)',
            textAlign: 'center',
            lineHeight: '18px',
          }}
        >
          Le mot de passe protège ton compte côté Supabase. Le PIN à 6 chiffres
          (étape suivante) chiffre tes photos localement et n'est jamais envoyé.
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  fontSize: 14,
  color: 'var(--ink)',
  fontFamily: 'inherit',
  outline: 'none',
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          marginBottom: 6,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function humanize(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (msg.includes("n'est pas autorisée") || msg.includes('Database error saving new user')) {
    return "Cette adresse email n'est pas autorisée à créer un compte. Contacte l'administrateur pour être ajouté."
  }
  if (msg.toLowerCase().includes('password')) return msg
  if (msg.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  return msg
}
