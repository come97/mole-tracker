import { useEffect, useRef, useState } from 'react'

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

  // Reset the PIN field when a fresh parent error arrives (failed unlock).
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
    const next = isBack ? target.slice(0, -1) : target.length >= PIN_LENGTH ? target : target + d
    if (next === target) return

    if (stage === 'first') {
      setPin(next)
      // First slot full: in setup, advance to confirm; in unlock, submit.
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
      ? "Ce code chiffre tes photos. Sans lui, personne (toi inclus) ne peut les déchiffrer. Note-le quelque part de sûr."
      : 'Ton code déchiffre les photos localement.'

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 select-none">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="mb-6 flex gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < value.length ? 'bg-indigo-400' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {displayError && <p className="mb-4 text-sm text-rose-400">{displayError}</p>}
      {busy && <p className="mb-4 text-sm text-slate-400">Vérification…</p>}

      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <KeyButton key={d} onPress={() => handle(d)} disabled={busy}>{d}</KeyButton>
        ))}
        <span />
        <KeyButton onPress={() => handle('0')} disabled={busy}>0</KeyButton>
        <KeyButton onPress={() => handle('back')} disabled={busy} aria-label="Effacer">⌫</KeyButton>
      </div>
    </div>
  )
}

function KeyButton({
  children, onPress, disabled, ...rest
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
      className="h-16 w-16 rounded-full bg-slate-800 text-2xl text-slate-100 active:bg-slate-700 disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  )
}
