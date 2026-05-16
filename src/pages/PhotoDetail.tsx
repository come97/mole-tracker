import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, type PhotoRow } from '../lib/supabase'
import {
  decryptPhotoNote,
  deletePhoto,
  listPhotos,
  updatePhotoTakenAt,
  updatePhotoZone,
} from '../lib/photos'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'
import PhotoViewer from '../components/PhotoViewer'
import {
  Button,
  Icon,
  IconButton,
  MetaRow,
  TopBar,
  fmtDate,
  fmtDateShort,
  fmtRelative,
} from '../components/ui'

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [photo, setPhoto] = useState<PhotoRow | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [editingZone, setEditingZone] = useState(false)
  const [zoneDraft, setZoneDraft] = useState('')
  const [savingZone, setSavingZone] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [history, setHistory] = useState<PhotoRow[] | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('photos')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message)
          return
        }
        const row = (data as PhotoRow | null) ?? null
        setPhoto(row)
        if (row) {
          decryptPhotoNote(row).then(setNote).catch(() => setNote(null))
          listPhotos({ zone: row.body_zone })
            .then(ps => setHistory(ps))
            .catch(() => setHistory(null))
        }
      })
  }, [id])

  const sameZoneSorted = useMemo(() => {
    if (!history) return null
    return [...history].sort((a, b) => +new Date(b.taken_at) - +new Date(a.taken_at))
  }, [history])

  if (error) {
    return (
      <div style={{ padding: 18 }}>
        <ErrorBox>{error}</ErrorBox>
      </div>
    )
  }
  if (!photo) {
    return <div style={{ padding: 18, color: 'var(--muted)', fontSize: 14 }}>Chargement…</div>
  }

  async function onDelete() {
    if (!photo) return
    if (!confirm('Supprimer cette photo définitivement ?')) return
    await deletePhoto(photo)
    nav(`/zone/${photo.body_zone}`, { replace: true })
  }

  function startEditDate() {
    if (!photo) return
    const d = new Date(photo.taken_at)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDateDraft(`${yyyy}-${mm}-${dd}`)
    setEditingDate(true)
  }

  async function saveDate() {
    if (!photo || !dateDraft) return
    const [y, m, d] = dateDraft.split('-').map(Number)
    if (!y || !m || !d) return
    const next = new Date(y, m - 1, d, 12, 0, 0, 0)
    setSavingDate(true)
    setError(null)
    try {
      const updated = await updatePhotoTakenAt(photo.id, next)
      setPhoto(updated)
      setEditingDate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingDate(false)
    }
  }

  function startEditZone() {
    if (!photo) return
    setZoneDraft(photo.body_zone)
    setEditingZone(true)
    setError(null)
  }

  async function saveZone() {
    if (!photo || !zoneDraft || zoneDraft === photo.body_zone) {
      setEditingZone(false)
      return
    }
    setSavingZone(true)
    setError(null)
    try {
      const updated = await updatePhotoZone(photo.id, zoneDraft, zoneLabel(zoneDraft))
      setPhoto(updated)
      setEditingZone(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingZone(false)
    }
  }

  const dims = photo.width && photo.height ? `${photo.width} × ${photo.height}` : null

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar
        title="Photo"
        sub={`${zoneLabel(photo.body_zone)} · ${fmtDate(photo.taken_at)}`}
        left={<IconButton icon="back" label="Retour" to={`/zone/${photo.body_zone}`} />}
        right={<IconButton icon="more" label="Options" />}
      />

      {/* Photo hero */}
      <div
        style={{
          position: 'relative',
          margin: '10px 18px 0',
          borderRadius: 18,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          aria-label="Agrandir la photo"
          style={{
            display: 'block',
            width: '100%',
            background: '#000',
            border: 0,
            padding: 0,
          }}
        >
          <PhotoThumb
            photo={photo}
            full
            className="block w-full"
          />
        </button>
        {dims && (
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'rgba(11,20,36,0.55)',
              color: '#fff',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.01em',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            {dims}
          </span>
        )}
        <button
          onClick={() => setViewerOpen(true)}
          aria-label="Agrandir"
          className="focus-ring"
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'rgba(11,20,36,0.55)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: 0,
          }}
        >
          <Icon name="expand" size={18} stroke="#fff" />
        </button>
      </div>

      {/* Meta */}
      <div style={{ padding: '16px 18px 0' }}>
        <MetaRow
          icon="calendar"
          label="Date"
          value={editingDate ? null : fmtDate(photo.taken_at)}
          sub={editingDate ? null : `${fmtRelative(photo.taken_at)} · ${new Date(photo.taken_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
          action={
            !editingDate ? (
              <TextLink onClick={startEditDate}>Modifier</TextLink>
            ) : null
          }
        />
        {editingDate && (
          <InlineEditor
            inputType="date"
            value={dateDraft}
            onChange={setDateDraft}
            onCancel={() => setEditingDate(false)}
            onSave={() => void saveDate()}
            saving={savingDate}
          />
        )}

        <MetaRow
          icon="pin"
          label="Zone"
          value={editingZone ? null : zoneLabel(photo.body_zone)}
          sub={editingZone ? null : undefined}
          action={
            !editingZone ? <TextLink onClick={startEditZone}>Déplacer</TextLink> : null
          }
        />
        {editingZone && (
          <InlineSelect
            value={zoneDraft}
            onChange={setZoneDraft}
            options={BODY_ZONES.map(z => ({ value: z.id, label: z.label }))}
            onCancel={() => setEditingZone(false)}
            onSave={() => void saveZone()}
            saving={savingZone}
          />
        )}

        {note && (
          <MetaRow icon="lock" label="Note" value={note} multiline sub="Chiffrée — visible uniquement par toi" />
        )}
      </div>

      {/* History strip */}
      {sameZoneSorted && sameZoneSorted.length > 1 && (
        <div style={{ padding: '20px 18px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="history" size={16} stroke="var(--muted)" />
              Historique de cette zone
            </h3>
            <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 550 }}>
              {sameZoneSorted.length} photos
            </span>
          </div>

          <div
            className="no-scrollbar"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}
          >
            {sameZoneSorted.slice(0, 10).map(p => {
              const current = p.id === photo.id
              return (
                <button
                  key={p.id}
                  onClick={() => current ? null : nav(`/photo/${p.id}`)}
                  disabled={current}
                  className="focus-ring"
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    width: 72,
                    height: 72,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: current ? '2px solid var(--primary)' : '1px solid var(--hairline)',
                    padding: 0,
                    background: 'var(--surface-3)',
                    cursor: current ? 'default' : 'pointer',
                  }}
                >
                  <PhotoThumb photo={p} className="block h-full w-full object-cover" />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '10px 4px 3px',
                      background:
                        'linear-gradient(to top, rgba(11,20,36,0.7), transparent)',
                      color: '#fff',
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      textAlign: 'center',
                    }}
                  >
                    {fmtDateShort(p.taken_at)}
                  </div>
                </button>
              )
            })}
          </div>

          <Button
            variant="tonal"
            full
            icon="compare"
            style={{ marginTop: 14 }}
            onClick={() => nav(`/compare?zone=${photo.body_zone}&seed=${photo.id}`)}
          >
            Comparer avec une autre photo
          </Button>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px 18px 0' }}>
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      {/* Destructive */}
      <div style={{ padding: '20px 18px 0' }}>
        <button
          onClick={() => void onDelete()}
          className="focus-ring"
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--danger-50)',
            borderRadius: 12,
            color: 'var(--danger)',
            fontSize: 14,
            fontWeight: 550,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="trash" size={16} stroke="var(--danger)" />
          Supprimer cette photo
        </button>
      </div>

      {viewerOpen && (
        <PhotoViewer photos={[photo]} startIndex={0} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  )
}

function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring"
      style={{
        padding: '4px 8px',
        borderRadius: 8,
        background: 'transparent',
        border: 0,
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}

function InlineEditor({
  inputType,
  value,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  inputType: 'date'
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div style={{ padding: '0 0 12px 44px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        type={inputType}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
        className="focus-ring"
        style={{
          flex: 1,
          minWidth: 140,
          padding: '10px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 10,
          fontSize: 13,
          color: 'var(--ink)',
          fontFamily: 'inherit',
        }}
      />
      <Button variant="primary" size="sm" onClick={onSave} loading={saving} disabled={!value}>
        {saving ? '…' : 'Enregistrer'}
      </Button>
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
        Annuler
      </Button>
    </div>
  )
}

function InlineSelect({
  value,
  onChange,
  options,
  onCancel,
  onSave,
  saving,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div style={{ padding: '0 0 12px 44px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
        className="focus-ring"
        style={{
          flex: 1,
          minWidth: 160,
          padding: '10px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 10,
          fontSize: 13,
          color: 'var(--ink)',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button variant="primary" size="sm" onClick={onSave} loading={saving} disabled={!value}>
        {saving ? '…' : 'Déplacer'}
      </Button>
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
        Annuler
      </Button>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}
