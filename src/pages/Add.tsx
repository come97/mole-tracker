import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CameraCapture from '../components/CameraCapture'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import { savePhoto } from '../lib/photos'
import { importQueue } from '../lib/importQueue'
import {
  Button,
  Field,
  Icon,
  IconButton,
  IconTile,
  TopBar,
  type IconName,
} from '../components/ui'

type Step = 'method' | 'review'

export default function AddPage() {
  const [params] = useSearchParams()
  const initialZone = params.get('zone') ?? ''
  const nav = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const bulkInputRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [zone, setZone] = useState(initialZone)
  const [note, setNote] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zonePickerOpen, setZonePickerOpen] = useState(false)

  const step: Step = file ? 'review' : 'method'

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  async function save() {
    if (!file || !zone) return
    setBusy(true)
    setError(null)
    try {
      await savePhoto({
        file,
        bodyZone: zone,
        bodyZoneLabel: zoneLabel(zone),
        note: note.trim() || undefined,
      })
      nav(`/zone/${zone}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function resetFile() {
    setFile(null)
    setNote('')
    setError(null)
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar
        title={step === 'method' ? 'Nouvelle photo' : 'Vérifie et range'}
        sub={`Étape ${step === 'method' ? '1' : '2'} sur 2`}
        left={
          step === 'method' ? (
            <IconButton icon="close" label="Annuler" to="/" />
          ) : (
            <IconButton icon="back" label="Retour" onClick={resetFile} />
          )
        }
      />

      <div style={{ padding: '10px 18px 0' }}>
        <ProgressBar step={step} />
        {step === 'method' ? (
          <MethodStep
            onCamera={() => setShowCamera(true)}
            onImportSingle={() => fileInputRef.current?.click()}
            onImportBulk={() => bulkInputRef.current?.click()}
          />
        ) : (
          <ReviewStep
            previewUrl={previewUrl}
            zone={zone}
            note={note}
            onNote={setNote}
            onOpenZone={() => setZonePickerOpen(true)}
            error={error}
          />
        )}
      </div>

      {step === 'review' && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 80,
            width: '100%',
            maxWidth: 640,
            padding: '12px 18px',
            background:
              'linear-gradient(to top, var(--bg) 60%, rgba(245,247,251,0))',
            display: 'flex',
            gap: 10,
            zIndex: 4,
          }}
        >
          <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={resetFile} disabled={busy}>
            Reprendre
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon="check"
            style={{ flex: 2 }}
            onClick={() => void save()}
            disabled={!zone}
            loading={busy}
          >
            {busy ? 'Chiffrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) setFile(f)
        }}
      />
      <input
        ref={bulkInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        style={{ display: 'none' }}
        onChange={async e => {
          const files = e.target.files
          if (!files || files.length === 0) return
          const list = files
          e.target.value = ''
          nav('/import')
          try {
            const { duplicatesAdded } = await importQueue.add(list)
            if (duplicatesAdded > 0) {
              nav('/import', { replace: true, state: { duplicatesAdded } })
            }
          } catch (err) {
            console.error('Failed to enqueue imports', err)
          }
        }}
      />

      {showCamera && (
        <CameraCapture
          onCancel={() => setShowCamera(false)}
          onCapture={f => {
            setFile(f)
            setShowCamera(false)
          }}
        />
      )}

      {zonePickerOpen && (
        <ZonePicker
          value={zone}
          onPick={z => {
            setZone(z)
            setZonePickerOpen(false)
          }}
          onClose={() => setZonePickerOpen(false)}
        />
      )}
    </div>
  )
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      <span style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--primary)' }} />
      <span
        style={{
          flex: 1,
          height: 4,
          borderRadius: 999,
          background: step === 'review' ? 'var(--primary)' : 'var(--hairline)',
        }}
      />
    </div>
  )
}

function MethodStep({
  onCamera,
  onImportSingle,
  onImportBulk,
}: {
  onCamera: () => void
  onImportSingle: () => void
  onImportBulk: () => void
}) {
  return (
    <>
      <h2
        style={{
          margin: '0 0 4px',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}
      >
        Comment ajouter cette photo&nbsp;?
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: '20px' }}>
        Toutes les photos sont{' '}
        <strong style={{ color: 'var(--ink-2)' }}>chiffrées sur ton appareil</strong> avant d'être stockées.
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
        <MethodCard
          icon="camera"
          title="Prendre une photo"
          sub="Recommandé · bon cadrage et éclairage"
          primary
          onClick={onCamera}
        />
        <MethodCard
          icon="upload"
          title="Importer une photo"
          sub="Une photo déjà prise"
          onClick={onImportSingle}
        />
        <MethodCard
          icon="layers"
          title="Import en masse"
          sub="Plusieurs photos, tu les ranges après"
          tone="ghost"
          onClick={onImportBulk}
        />
      </div>

      <div
        style={{
          marginTop: 22,
          padding: 14,
          background: 'var(--primary-50)',
          border: '1px solid var(--primary-100)',
          borderRadius: 14,
          display: 'flex',
          gap: 12,
        }}
      >
        <IconTile icon="sparkle" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-700)', marginBottom: 4 }}>
            3 conseils pour un suivi fiable
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              fontSize: 12,
              color: 'var(--ink-2)',
              lineHeight: '18px',
            }}
          >
            <Tip>Lumière naturelle, sans flash direct</Tip>
            <Tip>Cadrage à 10 cm, mise au point sur le grain</Tip>
            <Tip>Pose une pièce ou une règle à côté pour l'échelle</Tip>
          </ul>
        </div>
      </div>
    </>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={{ color: 'var(--primary)' }}>·</span>
      <span>{children}</span>
    </li>
  )
}

function MethodCard({
  icon,
  title,
  sub,
  primary,
  tone,
  onClick,
}: {
  icon: IconName
  title: string
  sub: string
  primary?: boolean
  tone?: 'ghost'
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 14px',
        background: primary ? 'var(--primary)' : tone === 'ghost' ? 'transparent' : 'var(--surface)',
        border: primary
          ? '0'
          : tone === 'ghost'
            ? '1px dashed var(--hairline)'
            : '1px solid var(--hairline)',
        borderRadius: 14,
        color: primary ? '#fff' : 'var(--ink)',
        boxShadow: primary ? '0 8px 20px -8px rgba(0, 102, 224, 0.5)' : 'none',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: primary ? 'rgba(255,255,255,0.18)' : 'var(--surface-3)',
          color: primary ? '#fff' : 'var(--ink-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</div>
        <div
          style={{
            fontSize: 12,
            marginTop: 2,
            opacity: primary ? 0.85 : 1,
            color: primary ? '#fff' : 'var(--muted)',
          }}
        >
          {sub}
        </div>
      </div>
      <Icon name="chevR" size={16} />
    </button>
  )
}

function ReviewStep({
  previewUrl,
  zone,
  note,
  onNote,
  onOpenZone,
  error,
}: {
  previewUrl: string | null
  zone: string
  note: string
  onNote: (v: string) => void
  onOpenZone: () => void
  error: string | null
}) {
  return (
    <div>
      {/* Photo preview */}
      {previewUrl && (
        <div
          style={{
            position: 'relative',
            marginBottom: 16,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '4 / 3',
          }}
        >
          <img
            src={previewUrl}
            alt="Aperçu de la photo à enregistrer"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      <Field label="Zone du corps" required>
        <button
          onClick={onOpenZone}
          className="focus-ring"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: zone ? '1px solid var(--hairline)' : '1px solid var(--primary-200)',
            borderRadius: 12,
            textAlign: 'left',
          }}
        >
          <Icon name="pin" size={18} stroke="var(--primary)" fill="var(--primary-50)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            {zone ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--ink)' }}>{zoneLabel(zone)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Touche pour changer</div>
              </>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--primary-700)' }}>
                Choisir une zone
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
            {zone ? 'Changer' : 'Choisir'}
          </span>
        </button>
      </Field>

      <Field
        label="Note"
        hint={
          <>
            <Icon name="lock" size={10} /> Chiffrée — visible uniquement par toi
          </>
        }
      >
        <textarea
          rows={3}
          placeholder="Ex : grain de beauté côté externe, contour foncé"
          value={note}
          onChange={e => onNote(e.target.value)}
          className="focus-ring"
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 12,
            resize: 'none',
            fontSize: 14,
            color: 'var(--ink)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </Field>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--danger-50)',
            color: 'var(--danger-700)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Zone picker bottom sheet
   ============================================================ */

function ZonePicker({
  value,
  onPick,
  onClose,
}: {
  value: string
  onPick: (zoneId: string) => void
  onClose: () => void
}) {
  const groups: { label: string; zones: typeof BODY_ZONES }[] = [
    { label: 'Face', zones: BODY_ZONES.filter(z => z.side === 'front') },
    { label: 'Dos', zones: BODY_ZONES.filter(z => z.side === 'back') },
    { label: 'Côtés', zones: BODY_ZONES.filter(z => z.side === 'left' || z.side === 'right') },
  ]
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(11,20,36,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--surface)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '14px 18px 24px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: 'var(--e3)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: 'var(--hairline)',
            margin: '0 auto 14px',
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          Choisir une zone
        </h3>
        <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--muted)' }}>
          Où se trouve ce grain de beauté&nbsp;?
        </p>

        {groups.map(g => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted-2)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {g.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {g.zones.map(z => {
                const active = value === z.id
                return (
                  <button
                    key={z.id}
                    onClick={() => onPick(z.id)}
                    className="focus-ring"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: active ? 'var(--primary-50)' : 'var(--surface)',
                      border: active ? '1px solid var(--primary-200)' : '1px solid var(--hairline)',
                      color: active ? 'var(--primary-700)' : 'var(--ink)',
                      fontSize: 13,
                      fontWeight: 550,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon
                      name={active ? 'check' : 'pin'}
                      size={14}
                      stroke={active ? 'var(--primary-700)' : 'var(--muted-2)'}
                    />
                    <span>{z.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
