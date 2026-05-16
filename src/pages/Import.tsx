import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BodyDiagram from '../components/BodyDiagram'
import { importQueue, type ImportItem } from '../lib/importQueue'
import { savePhoto } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'
import {
  Button,
  Field,
  Icon,
  IconButton,
  IconTile,
  TopBar,
} from '../components/ui'

function useImportQueue(): ImportItem[] {
  return useSyncExternalStore(importQueue.subscribe, importQueue.list, importQueue.list)
}

export default function ImportPage() {
  const queue = useImportQueue()
  const nav = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [batchDate, setBatchDate] = useState('')
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastDispatch, setLastDispatch] = useState<{ count: number; zone: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [lastDuplicates, setLastDuplicates] = useState(0)
  const [lastFailed, setLastFailed] = useState(0)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const state = location.state as { duplicatesAdded?: number } | null
    if (state?.duplicatesAdded && state.duplicatesAdded > 0) {
      setLastDuplicates(state.duplicatesAdded)
      nav(location.pathname, { replace: true, state: null })
    }
  }, [location, nav])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setSelected(prev => {
      const queueIds = new Set(queue.map(i => i.id))
      const next = new Set([...prev].filter(id => queueIds.has(id)))
      if (next.size === 0 && queue.length > 0) {
        for (const i of queue) next.add(i.id)
      }
      return next
    })
  }, [queue])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(queue.map(i => i.id)))
  }
  function selectNone() {
    setSelected(new Set())
  }

  async function handlePick(files: FileList | null) {
    if (!files || files.length === 0) return
    setAdding(true)
    setError(null)
    setLastDuplicates(0)
    setLastFailed(0)
    try {
      const { duplicatesAdded, failed } = await importQueue.add(files)
      if (duplicatesAdded > 0) setLastDuplicates(duplicatesAdded)
      if (failed > 0) setLastFailed(failed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  function parseBatchDate(value: string): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return undefined
    return new Date(y, m - 1, d, 12, 0, 0, 0)
  }

  async function dispatchTo(zoneId: string) {
    if (busy) return
    if (selected.size === 0) {
      setError('Sélectionne au moins une photo avant de choisir une zone.')
      return
    }
    setError(null)
    setLastDispatch(null)
    const ids = [...selected]
    const items = queue.filter(i => ids.includes(i.id))
    setBusy({ done: 0, total: items.length })
    const takenAt = parseBatchDate(batchDate)
    const succeededIds: string[] = []
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const { file, contentHash } = await importQueue.getDecryptedFile(item.id)
        await savePhoto({
          file,
          bodyZone: zoneId,
          bodyZoneLabel: zoneLabel(zoneId),
          note: note.trim() || undefined,
          takenAt,
          contentHash,
        })
        succeededIds.push(item.id)
        setBusy({ done: i + 1, total: items.length })
      }
      setLastDispatch({ count: items.length, zone: zoneId })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (succeededIds.length > 0) await importQueue.removeMany(succeededIds)
      setBusy(null)
    }
  }

  /* Empty state — no photos in queue and no recent dispatch. */
  if (queue.length === 0 && !lastDispatch) {
    return (
      <div style={{ paddingBottom: 100 }}>
        <TopBar
          title="Importer & ranger"
          left={<IconButton icon="back" label="Retour" to="/" />}
        />
        <div style={{ padding: '16px 18px 0' }}>
          <EmptyImport
            onPick={() => fileInputRef.current?.click()}
            adding={adding}
            error={error}
            duplicates={lastDuplicates}
            failed={lastFailed}
            onSeeDuplicates={() => nav('/duplicates')}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            void handlePick(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  const selectedCount = selected.size
  const totalProgress = busy ? Math.round((busy.done / Math.max(1, busy.total)) * 100) : 0

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar
        title="Importer & ranger"
        sub={`${queue.length} photo${queue.length > 1 ? 's' : ''} en attente`}
        left={<IconButton icon="back" label="Retour" to="/" />}
        right={
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!!busy || adding}
            className="focus-ring"
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              border: '1px solid var(--hairline)',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name="plus" size={14} />
            Ajouter
          </button>
        }
      />

      <div style={{ padding: '8px 18px 0' }}>
        {/* Encryption progress card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <IconTile icon="shield" size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {busy
                ? `Envoi chiffré · ${busy.done}/${busy.total}`
                : `Chiffrement local · ${queue.length} en attente`}
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                borderRadius: 999,
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: busy ? `${totalProgress}%` : '100%',
                  height: '100%',
                  background: 'var(--primary)',
                  borderRadius: 999,
                  transition: 'width var(--t-med) var(--ease)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Les fichiers ne quittent ton appareil qu'une fois chiffrés.
            </div>
          </div>
        </div>

        {/* Banners */}
        {error && <Banner tone="danger">{error}</Banner>}
        {lastDuplicates > 0 && (
          <Banner tone="warning" action="Gérer" onAction={() => nav('/duplicates')}>
            {lastDuplicates} doublon{lastDuplicates > 1 ? 's' : ''} potentiel
            {lastDuplicates > 1 ? 's' : ''} ajouté{lastDuplicates > 1 ? 's' : ''} (badge orange).
          </Banner>
        )}
        {lastFailed > 0 && (
          <Banner tone="danger">
            {lastFailed} fichier{lastFailed > 1 ? 's' : ''} illisible
            {lastFailed > 1 ? 's' : ''} (format non supporté ou trop gros).
          </Banner>
        )}
        {lastDispatch && !busy && (
          <Banner
            tone="success"
            action="Voir la zone"
            onAction={() => nav(`/zone/${lastDispatch.zone}`)}
          >
            {lastDispatch.count} photo{lastDispatch.count > 1 ? 's' : ''} rangée
            {lastDispatch.count > 1 ? 's' : ''} dans «&nbsp;{zoneLabel(lastDispatch.zone)}&nbsp;».
            {queue.length > 0 ? ' Continue avec le reste.' : ''}
          </Banner>
        )}

        {/* Selection bar */}
        {queue.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{selectedCount}</strong> /{' '}
              {queue.length} sélectionnée{selectedCount > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              <SmallTextBtn onClick={selectAll} disabled={!!busy}>
                Tout
              </SmallTextBtn>
              <SmallTextBtn onClick={selectNone} disabled={!!busy}>
                Aucune
              </SmallTextBtn>
            </div>
          </div>
        )}

        {/* Queue grid */}
        {queue.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginBottom: 14,
            }}
          >
            {queue.map(item => {
              const isSel = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  disabled={!!busy}
                  className="focus-ring"
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 10,
                    overflow: 'hidden',
                    padding: 0,
                    border: isSel ? '2.5px solid var(--primary)' : '1px solid var(--hairline)',
                    boxShadow: isSel ? '0 0 0 3px var(--primary-50)' : 'none',
                    background: 'var(--surface-3)',
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {item.isDuplicate && (
                    <span
                      title="Doublon potentiel (mêmes octets qu'une photo déjà connue)"
                      style={{
                        position: 'absolute',
                        left: 4,
                        top: 4,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'var(--warning)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Icon name="alert" size={8} stroke="#fff" fill="#fff" />
                      Dup
                    </span>
                  )}
                  {isSel && (
                    <span
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 4,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: 'var(--primary)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="check" size={12} stroke="#fff" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Batch metadata */}
        {queue.length > 0 && (
          <>
            <Field label="Note pour le lot (chiffrée)">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex : suivi mensuel"
                disabled={!!busy}
                className="focus-ring"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 12,
                  fontSize: 14,
                  color: 'var(--ink)',
                  fontFamily: 'inherit',
                }}
              />
            </Field>
            <Field label="Date de prise (sinon : aujourd'hui)">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 12,
                }}
              >
                <Icon name="calendar" size={16} stroke="var(--muted)" />
                <input
                  type="date"
                  value={batchDate}
                  onChange={e => setBatchDate(e.target.value)}
                  disabled={!!busy}
                  className="focus-ring"
                  style={{
                    flex: 1,
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                  }}
                />
              </div>
            </Field>
          </>
        )}

        {/* Atlas-as-dispatcher */}
        {queue.length > 0 && (
          <div
            style={{
              marginTop: 6,
              padding: 14,
              background: 'var(--primary-50)',
              border: '1px dashed var(--primary-200)',
              borderRadius: 14,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--primary-700)',
                letterSpacing: '-0.005em',
              }}
            >
              Choisis une zone du corps
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
              Touche une zone pour ranger les {selectedCount} photo
              {selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}.
            </div>
            <div style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 12, padding: 8 }}>
              <BodyDiagram counts={{}} onZoneClick={dispatchTo} />
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          void handlePick(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Banner({
  children,
  tone,
  action,
  onAction,
}: {
  children: React.ReactNode
  tone: 'success' | 'warning' | 'danger'
  action?: string
  onAction?: () => void
}) {
  const styles: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    success: { bg: 'var(--success-50)', fg: 'var(--success-700)', border: 'rgba(31,138,90,0.18)' },
    warning: { bg: 'var(--warning-50)', fg: 'var(--warning-700)', border: '#f1dba0' },
    danger: { bg: 'var(--danger-50)', fg: 'var(--danger-700)', border: 'rgba(196,74,74,0.2)' },
  }
  const s = styles[tone]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 12,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        color: s.fg,
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{children}</div>
      {action && (
        <button
          onClick={onAction}
          className="focus-ring"
          style={{
            padding: '5px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.6)',
            border: `1px solid ${s.border}`,
            color: s.fg,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

function SmallTextBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring"
      style={{
        padding: '4px 10px',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--ink-2)',
        fontWeight: 550,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}
    >
      {children}
    </button>
  )
}

function EmptyImport({
  onPick,
  adding,
  error,
  duplicates,
  failed,
  onSeeDuplicates,
}: {
  onPick: () => void
  adding: boolean
  error: string | null
  duplicates: number
  failed: number
  onSeeDuplicates: () => void
}) {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--surface)',
        border: '1px dashed var(--hairline)',
        borderRadius: 16,
        textAlign: 'center',
      }}
    >
      <IconTile icon="upload" size={44} />
      <h2
        style={{
          margin: '12px 0 4px',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}
      >
        Importer un lot de photos
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--muted)',
          lineHeight: '19px',
        }}
      >
        Choisis plusieurs photos depuis ton appareil. Tu pourras les ranger plus tard
        — elles restent ici, chiffrées, en attendant.
      </p>
      <div style={{ marginTop: 14 }}>
        <Button variant="primary" size="lg" icon="upload" onClick={onPick} loading={adding}>
          {adding ? 'Chiffrement local…' : 'Choisir des photos'}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--danger-50)',
            color: 'var(--danger-700)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {duplicates > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--warning-50)',
            color: 'var(--warning-700)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            {duplicates} doublon{duplicates > 1 ? 's' : ''} potentiel
            {duplicates > 1 ? 's' : ''} ajouté{duplicates > 1 ? 's' : ''}.
          </span>
          <Button variant="tonal" size="sm" onClick={onSeeDuplicates}>
            Gérer
          </Button>
        </div>
      )}
      {failed > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--danger-50)',
            color: 'var(--danger-700)',
            fontSize: 13,
          }}
        >
          {failed} fichier{failed > 1 ? 's' : ''} illisible{failed > 1 ? 's' : ''}.
        </div>
      )}
    </div>
  )
}
