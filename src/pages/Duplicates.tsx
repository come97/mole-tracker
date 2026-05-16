import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deletePhoto,
  listDuplicateGroups,
  type DuplicateGroup,
} from '../lib/photos'
import type { PhotoRow } from '../lib/supabase'
import PhotoThumb from '../components/PhotoThumb'
import { zoneLabel } from '../lib/bodyZones'
import {
  Button,
  Icon,
  IconButton,
  IconTile,
  TopBar,
  fmtDate,
} from '../components/ui'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Marks photos for deletion, keyed by group content hash.
  const [marked, setMarked] = useState<Map<string, Set<string>>>(new Map())
  const [working, setWorking] = useState<{
    groupHash: string
    done: number
    total: number
  } | null>(null)
  const nav = useNavigate()

  function reload() {
    setError(null)
    return listDuplicateGroups()
      .then(g => {
        setGroups(g)
        setMarked(prev => {
          const next = new Map<string, Set<string>>()
          for (const grp of g) {
            const ids = new Set(grp.photos.map(p => p.id))
            const existing = prev.get(grp.contentHash)
            if (!existing) continue
            const cleaned = new Set([...existing].filter(id => ids.has(id)))
            if (cleaned.size > 0) next.set(grp.contentHash, cleaned)
          }
          return next
        })
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }

  useEffect(() => {
    void reload()
  }, [])

  const totalExtras = useMemo(() => {
    if (!groups) return 0
    return groups.reduce((acc, g) => acc + g.photos.length - 1, 0)
  }, [groups])

  function toggleMark(groupHash: string, photoId: string) {
    setMarked(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(groupHash) ?? [])
      if (set.has(photoId)) set.delete(photoId)
      else set.add(photoId)
      if (set.size === 0) next.delete(groupHash)
      else next.set(groupHash, set)
      return next
    })
  }

  function markAllButFirst(group: DuplicateGroup) {
    setMarked(prev => {
      const next = new Map(prev)
      const ids = new Set(group.photos.slice(1).map(p => p.id))
      next.set(group.contentHash, ids)
      return next
    })
  }

  function clearMarks(groupHash: string) {
    setMarked(prev => {
      const next = new Map(prev)
      next.delete(groupHash)
      return next
    })
  }

  async function deleteMarked(group: DuplicateGroup) {
    const ids = marked.get(group.contentHash)
    if (!ids || ids.size === 0) return
    if (ids.size === group.photos.length) {
      setError('Tu as sélectionné toutes les copies du groupe. Garde-en au moins une.')
      return
    }
    const toDelete = group.photos.filter(p => ids.has(p.id))
    const ok = confirm(
      `Supprimer ${toDelete.length} copie${toDelete.length > 1 ? 's' : ''} ? Cette action est définitive.`,
    )
    if (!ok) return
    setError(null)
    setWorking({ groupHash: group.contentHash, done: 0, total: toDelete.length })
    try {
      for (let i = 0; i < toDelete.length; i++) {
        await deletePhoto(toDelete[i])
        setWorking({ groupHash: group.contentHash, done: i + 1, total: toDelete.length })
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      void reload()
    } finally {
      setWorking(null)
    }
  }

  async function quickKeepFirst(group: DuplicateGroup) {
    const toDelete = group.photos.slice(1)
    const ok = confirm(
      `Garder la copie la plus ancienne et supprimer ${toDelete.length} autre${toDelete.length > 1 ? 's' : ''} ?`,
    )
    if (!ok) return
    setError(null)
    setWorking({ groupHash: group.contentHash, done: 0, total: toDelete.length })
    try {
      for (let i = 0; i < toDelete.length; i++) {
        await deletePhoto(toDelete[i])
        setWorking({ groupHash: group.contentHash, done: i + 1, total: toDelete.length })
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      void reload()
    } finally {
      setWorking(null)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar
        title="Doublons"
        sub={
          groups
            ? `${groups.length} groupe${groups.length > 1 ? 's' : ''} · ${totalExtras} copie${totalExtras > 1 ? 's' : ''} en trop`
            : ''
        }
        left={<IconButton icon="back" label="Retour" to="/all" />}
      />

      <div style={{ padding: '8px 18px 0' }}>
        <p
          style={{
            margin: '4px 0 16px',
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: '19px',
          }}
        >
          Photos avec exactement les mêmes octets, détectées automatiquement. Choisis
          quelles copies garder — les autres seront supprimées définitivement.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 12,
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

        {!groups ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Recherche des doublons…</p>
        ) : groups.length === 0 ? (
          <EmptyState onSeeAll={() => nav('/all')} />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 14,
                padding: '12px 0',
                marginBottom: 16,
              }}
            >
              <Counter value={groups.length} label="Groupes" />
              <span style={{ width: 1, background: 'var(--hairline-2)' }} />
              <Counter value={totalExtras} label="À supprimer" tone="warning" />
              <span style={{ width: 1, background: 'var(--hairline-2)' }} />
              <Counter value="—" label="Espace libéré" sub={`≈ ${Math.max(1, totalExtras)} fichier${totalExtras > 1 ? 's' : ''}`} />
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {groups.map(group => (
                <GroupCard
                  key={group.contentHash}
                  group={group}
                  marked={marked.get(group.contentHash) ?? new Set()}
                  onToggle={id => toggleMark(group.contentHash, id)}
                  onSelectAllButFirst={() => markAllButFirst(group)}
                  onClearMarks={() => clearMarks(group.contentHash)}
                  onDeleteMarked={() => void deleteMarked(group)}
                  onQuickKeepFirst={() => void quickKeepFirst(group)}
                  onPhotoOpen={id => nav(`/photo/${id}`)}
                  working={
                    working && working.groupHash === group.contentHash ? working : null
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Counter({
  value,
  label,
  sub,
  tone,
}: {
  value: React.ReactNode
  label: string
  sub?: React.ReactNode
  tone?: 'warning'
}) {
  return (
    <div style={{ flex: 1, padding: '0 12px', textAlign: 'center', minWidth: 0 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: tone === 'warning' ? 'var(--warning-700)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, fontWeight: 550 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--muted-2)', fontFamily: 'var(--mono)', marginTop: 1 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onSeeAll }: { onSeeAll: () => void }) {
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
      <IconTile icon="sparkle" tone="success" size={40} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 10 }}>
        Aucun doublon détecté
      </div>
      <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--muted)' }}>
        Toutes tes photos sont uniques. Importes-en de nouvelles depuis l'onglet Ajouter.
      </p>
      <Button variant="tonal" size="sm" onClick={onSeeAll}>
        Voir toutes mes photos
      </Button>
    </div>
  )
}

type GroupCardProps = {
  group: DuplicateGroup
  marked: Set<string>
  onToggle: (photoId: string) => void
  onSelectAllButFirst: () => void
  onClearMarks: () => void
  onDeleteMarked: () => void
  onQuickKeepFirst: () => void
  onPhotoOpen: (photoId: string) => void
  working: { done: number; total: number } | null
}

function GroupCard({
  group,
  marked,
  onToggle,
  onSelectAllButFirst,
  onClearMarks,
  onDeleteMarked,
  onQuickKeepFirst,
  onPhotoOpen,
  working,
}: GroupCardProps) {
  const oldest = group.photos[0]
  const extras = group.photos.length - 1
  const disabled = !!working
  const markedCount = marked.size

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--hairline-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {group.photos.length} copies identiques
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Plus ancienne ·{' '}
            <span style={{ fontFamily: 'var(--mono)' }}>{fmtDate(oldest.taken_at)}</span> ·{' '}
            {zoneLabel(oldest.body_zone)}
          </div>
        </div>
        <Button
          variant="success"
          size="sm"
          icon="check"
          onClick={onQuickKeepFirst}
          disabled={disabled || extras === 0}
        >
          Garder la 1ʳᵉ
        </Button>
      </header>

      {/* Photo strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: 10,
        }}
      >
        {group.photos.map((photo, index) => (
          <DupTile
            key={photo.id}
            photo={photo}
            isOldest={index === 0}
            isMarked={marked.has(photo.id)}
            disabled={disabled}
            onToggle={() => onToggle(photo.id)}
            onOpen={() => onPhotoOpen(photo.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 14px',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--hairline-2)',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        {working ? (
          <span style={{ color: 'var(--danger-700)' }}>
            Suppression… {working.done}/{working.total}
          </span>
        ) : markedCount > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{markedCount}</span>/
            {group.photos.length} à supprimer
            <button
              onClick={onClearMarks}
              disabled={disabled}
              className="focus-ring"
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--muted-2)',
                fontSize: 12,
                fontWeight: 550,
                padding: '2px 4px',
              }}
            >
              Annuler
            </button>
          </span>
        ) : (
          <button
            onClick={onSelectAllButFirst}
            disabled={disabled || extras === 0}
            className="focus-ring"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ink-2)',
              fontSize: 12,
              fontWeight: 550,
              padding: '2px 4px',
            }}
          >
            Sélectionner toutes sauf la 1ʳᵉ
          </button>
        )}
        <button
          onClick={onDeleteMarked}
          disabled={disabled || markedCount === 0}
          className="focus-ring"
          style={{
            padding: '7px 14px',
            borderRadius: 10,
            background: disabled || markedCount === 0 ? 'var(--surface-3)' : 'var(--danger)',
            color: disabled || markedCount === 0 ? 'var(--muted-2)' : '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: disabled || markedCount === 0 ? '1px solid var(--hairline)' : 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon
            name="trash"
            size={14}
            stroke={disabled || markedCount === 0 ? 'var(--muted-2)' : '#fff'}
          />
          Supprimer{markedCount > 0 ? ` (${markedCount})` : ''}
        </button>
      </footer>
    </section>
  )
}

function DupTile({
  photo,
  isOldest,
  isMarked,
  disabled,
  onToggle,
  onOpen,
}: {
  photo: PhotoRow
  isOldest: boolean
  isMarked: boolean
  disabled: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="focus-ring"
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 10,
          overflow: 'hidden',
          padding: 0,
          background: 'var(--surface-3)',
          border: isMarked
            ? '2px solid var(--danger)'
            : isOldest
              ? '2px solid var(--success)'
              : '1px solid var(--hairline)',
          boxShadow: isMarked
            ? '0 0 0 3px var(--danger-50)'
            : isOldest
              ? '0 0 0 3px var(--success-50)'
              : 'none',
        }}
      >
        <PhotoThumb
          photo={photo}
          className="h-full w-full object-cover"
        />
        {isOldest && !isMarked && (
          <span
            style={{
              position: 'absolute',
              left: 6,
              top: 6,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--success)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Originale
          </span>
        )}
        {isMarked && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(196,74,74,0.18)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--danger)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="trash" size={14} stroke="#fff" />
            </span>
          </span>
        )}
      </button>
      <div
        style={{
          marginTop: 4,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--muted)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {fmtDate(photo.taken_at)} · {fmtTime(photo.created_at)}
      </div>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onOpen()
        }}
        disabled={disabled}
        aria-label="Ouvrir la photo"
        className="focus-ring"
        style={{
          position: 'absolute',
          right: 6,
          top: 6,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.9)',
          color: 'var(--ink-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--hairline)',
          padding: 0,
        }}
      >
        <Icon name="zoom" size={12} stroke="var(--ink-2)" />
      </button>
    </div>
  )
}
