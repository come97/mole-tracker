import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  deletePhoto,
  listDuplicateGroups,
  type DuplicateGroup,
} from '../lib/photos'
import type { PhotoRow } from '../lib/supabase'
import PhotoThumb from '../components/PhotoThumb'
import { zoneLabel } from '../lib/bodyZones'

/**
 * Duplicates manager.
 *
 * Groups every saved photo by `content_hash` and surfaces groups with ≥ 2
 * photos. The UX is intentionally focused on the one job the user has here:
 * pick which copy to keep, delete the rest. Per-group there are two paths:
 *
 *   - quick "Garder la 1ʳᵉ" button — keeps the oldest (group is pre-sorted
 *     oldest-first, which is usually the original) and deletes the rest;
 *   - manual selection — tap any photo to toggle "to delete" then confirm.
 *
 * No mock data, no localStorage — every action hits the live `photos` table
 * via deletePhoto(). After each batch we reload from the server so the page
 * always reflects the current truth.
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Photos the user has marked for deletion, keyed by group hash so a manual
  // selection in one group doesn't bleed into another.
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
        // Drop any "marked" state pointing at photos that no longer exist —
        // prevents zombie selections after a deletion succeeds.
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

  /** Mark every photo in the group except the oldest (= keep oldest). */
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
    // Safety: never let the user wipe an entire group with one click.
    if (ids.size === group.photos.length) {
      setError(
        'Tu as sélectionné toutes les copies du groupe. Garde-en au moins une.',
      )
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
        setWorking({
          groupHash: group.contentHash,
          done: i + 1,
          total: toDelete.length,
        })
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // Reload anyway so successful deletions show up.
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
        setWorking({
          groupHash: group.contentHash,
          done: i + 1,
          total: toDelete.length,
        })
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
    <div className="px-4 py-4 pb-24">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Doublons</h2>
        <p className="mt-1 text-sm text-slate-400">
          Photos avec exactement les mêmes octets, détectées automatiquement.
          Choisis quelles copies garder — les autres seront supprimées
          définitivement.
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {!groups ? (
        <p className="text-sm text-slate-400">Recherche des doublons…</p>
      ) : groups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-200">
              <strong className="text-amber-300">{groups.length}</strong>{' '}
              groupe{groups.length > 1 ? 's' : ''} ·{' '}
              <strong className="text-amber-300">{totalExtras}</strong>{' '}
              copie{totalExtras > 1 ? 's' : ''} en trop
            </span>
          </div>

          <div className="grid gap-3">
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
                  working && working.groupHash === group.contentHash
                    ? working
                    : null
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-8 text-center">
      <p className="text-3xl">✨</p>
      <p className="mt-2 text-sm font-medium text-slate-200">
        Aucun doublon détecté
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Toutes tes photos sont uniques. Importes-en de nouvelles depuis l'onglet
        Ajouter.
      </p>
      <Link
        to="/all"
        className="mt-4 inline-block rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
      >
        Voir toutes mes photos
      </Link>
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
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      {/* Group header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            {group.photos.length} copies identiques
          </p>
          <p className="truncate text-[11px] text-slate-500">
            Plus ancienne : {fmtDate(oldest.taken_at)} ·{' '}
            {zoneLabel(oldest.body_zone)}
          </p>
        </div>
        <button
          onClick={onQuickKeepFirst}
          disabled={disabled}
          className="shrink-0 rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          title="Garder la copie la plus ancienne et supprimer les autres"
        >
          ✓ Garder la 1ʳᵉ
        </button>
      </header>

      {/* Photo strip */}
      <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4">
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

      {/* Action bar */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          {working ? (
            <span className="text-rose-300">
              Suppression… {working.done}/{working.total}
            </span>
          ) : markedCount > 0 ? (
            <>
              <span>
                {markedCount}/{group.photos.length} à supprimer
              </span>
              <button
                onClick={onClearMarks}
                disabled={disabled}
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={onSelectAllButFirst}
              disabled={disabled || extras === 0}
              className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
            >
              Sélectionner toutes sauf la 1ʳᵉ
            </button>
          )}
        </div>
        <button
          onClick={onDeleteMarked}
          disabled={disabled || markedCount === 0}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {markedCount > 0
            ? `Supprimer (${markedCount})`
            : 'Supprimer'}
        </button>
      </footer>
    </section>
  )
}

type DupTileProps = {
  photo: PhotoRow
  isOldest: boolean
  isMarked: boolean
  disabled: boolean
  onToggle: () => void
  onOpen: () => void
}

function DupTile({
  photo,
  isOldest,
  isMarked,
  disabled,
  onToggle,
  onOpen,
}: DupTileProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative block w-full aspect-square overflow-hidden rounded-lg border-2 transition ${
          isMarked
            ? 'border-rose-500 ring-2 ring-rose-500/30'
            : isOldest
              ? 'border-emerald-500/70'
              : 'border-slate-700'
        }`}
      >
        <PhotoThumb
          photo={photo}
          className={`h-full w-full object-cover transition ${
            isMarked ? 'opacity-40 grayscale' : ''
          }`}
        />
        {isOldest && !isMarked && (
          <span className="absolute left-1 top-1 rounded-full bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Originale
          </span>
        )}
        {isMarked && (
          <span className="absolute inset-0 flex items-center justify-center bg-rose-950/60 text-2xl text-rose-300">
            🗑️
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[10px] text-white">
          <span>{fmtDate(photo.taken_at)}</span>
          <span className="opacity-70">{fmtTime(photo.created_at)}</span>
        </div>
      </button>
      {/* Secondary "open" affordance — tap-and-hold pattern would be more
          discoverable, but a tiny eye icon is the cheapest unambiguous option. */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onOpen()
        }}
        disabled={disabled}
        className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-[11px] text-slate-200 opacity-0 transition group-hover:opacity-100"
        title="Ouvrir cette photo"
      >
        👁
      </button>
    </div>
  )
}
