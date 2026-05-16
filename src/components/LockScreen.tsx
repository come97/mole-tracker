import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui'

type Props = {
  mode: 'setup' | 'unlock'
  onSubmit: (pin: string) => Promise<void> | void
  error?: string | null
  busy?: boolean
}

const PIN_LENGTH = 6

export default function LockScreen({ mode, onSubmit, error, busy }: Props) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [stage, setStage] = useState<'first' | 'confirm'>('first')
  const [localError, setLocalError] = useState<string | null>(null)
  const prevErrorRef = useRef<string | null | undefined>(error)

  useEffect(() => {
    if (error && error !== prevErrorRef.current && mode === 'unlock') {
      void Promise.resolve().then(() => setPin(''))
    }
    prevErrorRef.current = error
  }, [error, mode])

  const displayError = localError ?? error ?? null

  function handle(d: string | 'back') {
    if (busy) return
    setLocalError(null)

    const isBack = d === 'back'
    const target = stage === 'first' ? pin : confirm
    const next = isBack
      ? target.slice(0, -1)
      : target.length >= PIN_LENGTH
        ? target
        : target + d
    if (next === target) return

    if (stage === 'first') {
      setPin(next)
      if (next.length === PIN_LENGTH) {
        if (mode === 'setup') {
          setStage('confirm')
        } else {
          void Promise.resolve(onSubmit(next))
        }
      }
    } else {
      setConfirm(next)
      if (next.length === PIN_LENGTH) {
        if (next === pin) {
          void Promise.resolve(onSubmit(next))
        } else {
          setLocalError('Les codes ne correspondent pas. Recommence.')
          setPin('')
          setConfirm('')
          setStage('first')
        }
      }
    }
  }

  const value = stage === 'first' ? pin : confirm

  const title =
    mode === 'setup'
      ? stage === 'first'
        ? 'Choisis un code à 6 chiffres'
        : 'Confirme ton code'
      : 'Entre ton code'

  const subtitle =
    mode === 'setup'
      ? 'Ce code chiffre tes photos. Sans lui, personne (toi inclus) ne peut les déchiffrer. Note-le quelque part de sûr.'
      : 'Ton code déchiffre les photos localement.'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '40px 24px',
        userSelect: 'none',
        background: 'var(--bg)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: 'var(--primary-50)',
            color: 'var(--primary-700)',
            margin: '0 auto 14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--primary-100)',
          }}
        >
          <Icon name="lock" size={22} stroke="var(--primary-700)" />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: '6px auto 0',
            maxWidth: 280,
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: '19px',
          }}
        >
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: i < value.length ? 'var(--primary)' : 'var(--surface-3)',
              border: '1px solid var(--hairline)',
              transition: 'background var(--t-fast) var(--ease)',
            }}
          />
        ))}
      </div>

      {displayError && (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--danger-50)',
            color: 'var(--danger-700)',
            fontSize: 13,
          }}
        >
          {displayError}
        </p>
      )}
      {busy && (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>Vérification…</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <KeyButton key={d} onPress={() => handle(d)} disabled={busy}>
            {d}
          </KeyButton>
        ))}
        <span />
        <KeyButton onPress={() => handle('0')} disabled={busy}>
          0
        </KeyButton>
        <KeyButton onPress={() => handle('back')} disabled={busy} aria-label="Effacer">
          ⌫
        </KeyButton>
      </div>
    </div>
  )
}

function KeyButton({
  children,
  onPress,
  disabled,
  ...rest
}: {
  children: React.ReactNode
  onPress: () => void
  disabled?: boolean
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="focus-ring"
      style={{
        width: 64,
        height: 64,
        borderRadius: 999,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        color: 'var(--ink)',
        fontSize: 22,
        fontWeight: 500,
        boxShadow: 'var(--e1)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--t-fast) var(--ease), transform var(--t-fast) var(--ease)',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
