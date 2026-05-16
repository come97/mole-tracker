import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoRow } from '../lib/supabase'
import {
  countDuplicateExtras,
  listPhotos,
  updatePhotoTakenAt,
  updatePhotoZone,
} from '../lib/photos'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import PhotoThumb from '../components/PhotoThumb'
import {
  Button,
  FilterChip,
  Icon,
  IconButton,
  IconTile,
  SectionLabel,
  TopBar,
  fmtDateShort,
} from '../components/ui'

type Editing = 'none' | 'date' | 'zone'

const WEEK_MS = 7 * 86_400_000
const MONTH_MS = 30 * 86_400_000

export default function AllPhotosPage() {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Editing>('none')
  const [dateDraft, setDateDraft] = useState('')
  const [zoneDraft, setZoneDraft] = useState('')
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dupCount, setDupCount] = useState(0)
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const nav = useNavigate()

  function reload() {
    return Promise.all([
      listPhotos().then(setPhotos),
      countDuplicateExtras().then(setDupCount).catch(() => {}),
    ])
  }
  useEffect(() => {
    void reload()
  }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelection() {
    setSelecting(false)
    setSelected(new Set())
    setEditing('none')
    setDateDraft('')
    setZoneDraft('')
    setError(null)
  }

  function selectAll() {
    if (!photos) return
    setSelected(new Set(photos.map(p => p.id)))
  }

  function openDateEditor() {
    if (!photos || selected.size === 0) return
    const picked = photos.filter(p => selected.has(p.id))
    const newest = picked.reduce(
      (acc, p) =>
        !acc || new Date(p.taken_at) > new Date(acc.taken_at) ? p : acc,
      null as PhotoRow | null,
    )
    const d = newest ? new Date(newest.taken_at) : new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDateDraft(`${yyyy}-${mm}-${dd}`)
    setEditing('date')
    setError(null)
  }

  function openZoneEditor() {
    if (!photos || selected.size === 0) return
    const picked = photos.filter(p => selected.has(p.id))
    const zones = new Set(picked.map(p => p.body_zone))
    setZoneDraft(zones.size === 1 ? [...zones][0] : '')
    setEditing('zone')
    setError(null)
  }

  async function applyDate() {
    if (!dateDraft || saving) return
    const [y, m, d] = dateDraft.split('-').map(Number)
    if (!y || !m || !d) return
    const next = new Date(y, m - 1, d, 12, 0, 0, 0)
    const ids = [...selected]
    setSaving({ done: 0, total: ids.length })
    setError(null)
    try {
      for (let i = 0; i < ids.length; i++) {
        await updatePhotoTakenAt(ids[i], next)
        setSaving({ done: i + 1, total: ids.length })
      }
      await reload()
      exitSelection()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      void reload()
    } finally {
      setSaving(null)
    }
  }

  async function applyZone() {
    if (!zoneDraft || saving) return
    const ids = [...selected]
    const label = zoneLabel(zoneDraft)
    setSaving({ done: 0, total: ids.length })
    setError(null)
    try {
      for (let i = 0; i < ids.length; i++) {
        await updatePhotoZone(ids[i], zoneDraft, label)
        setSaving({ done: i + 1, total: ids.length })
      }
      await reload()
      exitSelection()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      void reload()
    } finally {
      setSaving(null)
    }
  }

  /* Group photos into "Cette semaine / Ce mois-ci / Plus ancien" buckets. */
  const grouped = useMemo(() => {
    if (!photos) return null
    const filtered = zoneFilter === 'all' ? photos : photos.filter(p => p.body_zone === zoneFilter)
    const now = Date.now()
    const week: PhotoRow[] = []
    const month: PhotoRow[] = []
    const older: PhotoRow[] = []
    for (const p of filtered) {
      const age = now - +new Date(p.taken_at)
      if (age <= WEEK_MS) week.push(p)
      else if (age <= MONTH_MS) month.push(p)
      else older.push(p)
    }
    return { week, month, older, total: filtered.length }
  }, [photos, zoneFilter])

  /* Top zones (by photo count) for the filter chips. */
  const topZones = useMemo(() => {
    if (!photos) return []
    const counts = new Map<string, number>()
    for (const p of photos) counts.set(p.body_zone, (counts.get(p.body_zone) ?? 0) + 1)
    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([id, n]) => ({ id, n }))
  }, [photos])

  return (
    <div style={{ paddingBottom: selecting ? 200 : 100 }}>
      <TopBar
        title="Toutes mes photos"
        sub={
          photos
            ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ${new Set(photos.map(p => p.body_zone)).size} zone${new Set(photos.map(p => p.body_zone)).size > 1 ? 's' : ''}`
            : ''
        }
        left={<IconButton icon="back" label="Retour" to="/" />}
        right={
          photos && photos.length > 0 ? (
            <button
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              disabled={!!saving}
              className="focus-ring"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: selecting ? 'var(--muted)' : 'var(--primary)',
                background: 'transparent',
                border: 0,
                padding: '6px 8px',
              }}
            >
              {selecting ? 'Annuler' : 'Sélectionner'}
            </button>
          ) : null
        }
      />

      <div style={{ padding: '8px 18px 0' }}>
        {dupCount > 0 && !selecting && (
          <button
            onClick={() => nav('/duplicates')}
            className="focus-ring"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 12,
              background: 'var(--warning-50)',
              border: '1px solid #f1dba0',
              borderRadius: 12,
              width: '100%',
              textAlign: 'left',
            }}
          >
            <IconTile icon="layers" tone="warning" size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-700)' }}>
                {dupCount} doublon{dupCount > 1 ? 's' : ''} à gérer
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                Photos en double détectées automatiquement
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--warning-700)', fontWeight: 600 }}>
              Nettoyer →
            </span>
          </button>
        )}

        {photos && photos.length > 0 && (
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 10,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            <FilterChip active={zoneFilter === 'all'} onClick={() => setZoneFilter('all')}>
              Toutes
            </FilterChip>
            {topZones.map(z => (
              <FilterChip
                key={z.id}
                active={zoneFilter === z.id}
                onClick={() => setZoneFilter(z.id)}
              >
                {zoneLabel(z.id)}{' '}
                <span style={{ color: zoneFilter === z.id ? 'rgba(255,255,255,0.7)' : 'var(--muted-2)' }}>
                  · {z.n}
                </span>
              </FilterChip>
            ))}
          </div>
        )}

        {selecting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{selected.size}</strong> /{' '}
              {photos?.length ?? 0} sélectionnée{selected.size > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              <SmallTextBtn onClick={selectAll} disabled={!!saving}>
                Tout
              </SmallTextBtn>
              <SmallTextBtn onClick={() => setSelected(new Set())} disabled={!!saving}>
                Aucune
              </SmallTextBtn>
            </div>
          </div>
        )}

        {!photos ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Chargement…</p>
        ) : photos.length === 0 ? (
          <EmptyAll onAdd={() => nav('/add')} />
        ) : grouped && grouped.total === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Aucune photo pour ce filtre.
          </p>
        ) : (
          <>
            {grouped!.week.length > 0 && (
              <>
                <SectionLabel>Cette semaine · {grouped!.week.length}</SectionLabel>
                <Grid
                  photos={grouped!.week}
                  selecting={selecting}
                  selected={selected}
                  onClick={p => (selecting ? toggle(p.id) : nav(`/photo/${p.id}`))}
                  disabled={!!saving}
                />
              </>
            )}
            {grouped!.month.length > 0 && (
              <>
                <SectionLabel>Ce mois-ci · {grouped!.month.length}</SectionLabel>
                <Grid
                  photos={grouped!.month}
                  selecting={selecting}
                  selected={selected}
                  onClick={p => (selecting ? toggle(p.id) : nav(`/photo/${p.id}`))}
                  disabled={!!saving}
                />
              </>
            )}
            {grouped!.older.length > 0 && (
              <>
                <SectionLabel>Plus ancien · {grouped!.older.length}</SectionLabel>
                <Grid
                  photos={grouped!.older}
                  selecting={selecting}
                  selected={selected}
                  onClick={p => (selecting ? toggle(p.id) : nav(`/photo/${p.id}`))}
                  disabled={!!saving}
                />
              </>
            )}
          </>
        )}
      </div>

      {selecting && photos && photos.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 80,
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 640,
            padding: '12px 18px',
            zIndex: 4,
            background: 'linear-gradient(to top, var(--bg) 60%, rgba(245,247,251,0))',
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 10,
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
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 16,
              padding: 12,
              boxShadow: 'var(--e2)',
            }}
          >
            {editing === 'none' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                  {selected.size === 0
                    ? 'Sélectionne des photos pour les modifier.'
                    : `${selected.size} photo${selected.size > 1 ? 's' : ''} prête${selected.size > 1 ? 's' : ''} à modifier`}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="secondary"
                    icon="calendar"
                    onClick={openDateEditor}
                    disabled={selected.size === 0}
                    style={{ flex: 1 }}
                  >
                    Date
                  </Button>
                  <Button
                    variant="primary"
                    icon="pin"
                    onClick={openZoneEditor}
                    disabled={selected.size === 0}
                    style={{ flex: 1 }}
                  >
                    Déplacer
                  </Button>
                </div>
              </div>
            )}

            {editing === 'date' && (
              <div>
                <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
                  Nouvelle date pour {selected.size} photo{selected.size > 1 ? 's' : ''}
                  {saving ? ` · ${saving.done}/${saving.total}` : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <input
                    type="date"
                    value={dateDraft}
                    onChange={e => setDateDraft(e.target.value)}
                    disabled={!!saving}
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
                    }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void applyDate()}
                    loading={!!saving}
                    disabled={!dateDraft}
                  >
                    {saving ? 'Enregistrement…' : 'Appliquer'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing('none')} disabled={!!saving}>
                    Retour
                  </Button>
                </div>
              </div>
            )}

            {editing === 'zone' && (
              <div>
                <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
                  Déplacer {selected.size} photo{selected.size > 1 ? 's' : ''} vers…
                  {saving ? ` · ${saving.done}/${saving.total}` : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <select
                    value={zoneDraft}
                    onChange={e => setZoneDraft(e.target.value)}
                    disabled={!!saving}
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
                    <option value="">— Choisir une zone —</option>
                    {BODY_ZONES.map(z => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void applyZone()}
                    loading={!!saving}
                    disabled={!zoneDraft}
                  >
                    {saving ? 'Déplacement…' : 'Déplacer'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing('none')} disabled={!!saving}>
                    Retour
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Grid({
  photos,
  selecting,
  selected,
  onClick,
  disabled,
}: {
  photos: PhotoRow[]
  selecting: boolean
  selected: Set<string>
  onClick: (p: PhotoRow) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
      {photos.map(p => {
        const isSel = selected.has(p.id)
        return (
          <button
            key={p.id}
            onClick={() => onClick(p)}
            disabled={disabled}
            className="focus-ring"
            style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              borderRadius: 8,
              overflow: 'hidden',
              padding: 0,
              border: selecting && isSel ? '2.5px solid var(--primary)' : '1px solid transparent',
              boxShadow: selecting && isSel ? '0 0 0 3px var(--primary-50)' : 'none',
              background: 'var(--surface-3)',
            }}
          >
            <PhotoThumb photo={p} className="h-full w-full object-cover" />
            <span
              style={{
                position: 'absolute',
                left: 4,
                bottom: 4,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(11,20,36,0.55)',
                color: '#fff',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                maxWidth: 'calc(100% - 36px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {zoneLabel(p.body_zone)}
            </span>
            <span
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(11,20,36,0.55)',
                color: '#fff',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              {fmtDateShort(p.taken_at)}
            </span>
            {selecting && isSel && (
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

function EmptyAll({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--surface)',
        border: '1px dashed var(--hairline)',
        borderRadius: 16,
        textAlign: 'center',
        marginTop: 12,
      }}
    >
      <IconTile icon="grid" size={40} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 10 }}>
        Aucune photo pour le moment
      </div>
      <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--muted)' }}>
        Ajoute ta première photo pour démarrer le suivi.
      </p>
      <Button variant="primary" icon="plus" onClick={onAdd}>
        Ajouter
      </Button>
    </div>
  )
}
