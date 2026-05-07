import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BodyDiagram from '../components/BodyDiagram'
import { importQueue, type ImportItem } from '../lib/importQueue'
import { savePhoto } from '../lib/photos'
import { zoneLabel } from '../lib/bodyZones'

/** Subscribes to the in-memory import queue. */
function useImportQueue(): ImportItem[] {
  return useSyncExternalStore(
    importQueue.subscribe,
    importQueue.list,
    importQueue.list,
  )
}

export default function ImportPage() {
  const queue = useImportQueue()
  const nav = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Selection: which queued items will the next zone-click dispatch.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Optional note applied to the whole batch on dispatch.
  const [note, setNote] = useState('')
  // Optional date (YYYY-MM-DD) applied to the whole batch on dispatch.
  // Empty = use the current time when savePhoto runs (per-photo).
  const [batchDate, setBatchDate] = useState('')
  // Upload progress while a dispatch is running.
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Last dispatch result, shown briefly so the user sees what happened.
  const [lastDispatch, setLastDispatch] = useState<{ count: number; zone: string } | null>(null)
  // Picker is async (encrypt + IDB write per file). Keep the UI honest.
  const [adding, setAdding] = useState(false)
  // Number of duplicate files ignored during the most recent picker batch.
  const [lastSkipped, setLastSkipped] = useState(0)
  // Number of files that failed to import (unreadable, IDB quota, etc).
  const [lastFailed, setLastFailed] = useState(0)

  // Pick up a skipped-duplicate count handed off by /add when imports happened
  // before this page mounted. Clear the location state so a refresh doesn't re-show it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const state = location.state as { skippedDuplicates?: number } | null
    if (state?.skippedDuplicates && state.skippedDuplicates > 0) {
      setLastSkipped(state.skippedDuplicates)
      nav(location.pathname, { replace: true, state: null })
    }
  }, [location, nav])

  // Auto-select newly added items so a second-batch import doesn't lose context.
  useEffect(() => {
    setSelected(prev => {
      const queueIds = new Set(queue.map(i => i.id))
      // Drop ids no longer in queue (already dispatched)
      const next = new Set([...prev].filter(id => queueIds.has(id)))
      // If there's nothing selected and items remain, select all by default.
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
    setLastSkipped(0)
    setLastFailed(0)
    try {
      const { skippedDuplicates, failed } = await importQueue.add(files)
      if (skippedDuplicates > 0) setLastSkipped(skippedDuplicates)
      if (failed > 0) setLastFailed(failed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  // Convert YYYY-MM-DD into a Date at noon local time so timezone shifts don't
  // accidentally bump the day backwards or forwards.
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
      // Always remove the photos that did upload, even if a later one failed —
      // the user can retry on the rest.
      if (succeededIds.length > 0) await importQueue.removeMany(succeededIds)
      setBusy(null)
    }
  }

  // Empty state — no photos in queue and no recent dispatch.
  if (queue.length === 0 && !lastDispatch) {
    return (
      <div className="px-4 py-6">
        <h2 className="text-lg font-semibold text-slate-100">Importer & dispatcher</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sélectionne plusieurs photos depuis ton appareil. Tu pourras les ranger plus tard, elles
          restent ici, chiffrées, en attendant.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={adding}
          className="mt-6 w-full rounded-xl bg-indigo-500 px-4 py-4 font-medium text-white active:bg-indigo-600 disabled:opacity-60"
        >
          {adding ? 'Chiffrement local…' : '🖼️ Choisir des photos'}
        </button>
        {error && (
          <p className="mt-3 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{error}</p>
        )}
        {lastSkipped > 0 && (
          <p className="mt-3 rounded-md bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
            {lastSkipped} doublon{lastSkipped > 1 ? 's' : ''} ignoré{lastSkipped > 1 ? 's' : ''} (déjà en file ou déjà rangée{lastSkipped > 1 ? 's' : ''}).
          </p>
        )}
        {lastFailed > 0 && (
          <p className="mt-3 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">
            {lastFailed} fichier{lastFailed > 1 ? 's' : ''} illisible{lastFailed > 1 ? 's' : ''} (format non supporté ou trop gros). Voir la console pour le détail.
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            void handlePick(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <div className="px-3 pt-3 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">
          Dispatcher{' '}
          <span className="text-slate-400 font-normal">
            · {queue.length} en attente
          </span>
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
          disabled={!!busy || adding}
        >
          {adding ? '…' : '+ Ajouter'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            void handlePick(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Thumbnail strip with selection */}
      {queue.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>{selected.size} / {queue.length} sélectionnée{selected.size > 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                disabled={!!busy}
              >
                Tout
              </button>
              <button
                onClick={selectNone}
                className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                disabled={!!busy}
              >
                Aucune
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {queue.map(item => {
              const isSel = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  disabled={!!busy}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    isSel ? 'border-indigo-400' : 'border-slate-700'
                  }`}
                >
                  <img
                    src={item.previewUrl}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                  {isSel && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Batch metadata */}
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Note pour le lot (optionnelle, chiffrée)
              </label>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex. : suivi mensuel"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={!!busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Date de prise (sinon : aujourd'hui)
              </label>
              <input
                type="date"
                value={batchDate}
                onChange={e => setBatchDate(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                disabled={!!busy}
              />
            </div>
          </div>
        </>
      )}

      {/* Body picker as destination */}
      <p className="mt-4 px-1 text-center text-sm text-slate-300">
        {busy
          ? `Chiffrement & envoi… ${busy.done}/${busy.total}`
          : 'Touche la zone du corps où ranger les photos sélectionnées.'}
      </p>

      {error && (
        <p className="mt-2 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{error}</p>
      )}
      {lastSkipped > 0 && (
        <p className="mt-2 rounded-md bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
          {lastSkipped} doublon{lastSkipped > 1 ? 's' : ''} ignoré{lastSkipped > 1 ? 's' : ''} (déjà en file ou déjà rangée{lastSkipped > 1 ? 's' : ''}).
        </p>
      )}
      {lastFailed > 0 && (
        <p className="mt-2 rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">
          {lastFailed} fichier{lastFailed > 1 ? 's' : ''} illisible{lastFailed > 1 ? 's' : ''} (format non supporté ou trop gros). Voir la console pour le détail.
        </p>
      )}
      {lastDispatch && !busy && (
        <p className="mt-2 rounded-md bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200 flex items-center justify-between gap-3">
          <span>
            ✅ {lastDispatch.count} photo{lastDispatch.count > 1 ? 's' : ''} rangée
            {lastDispatch.count > 1 ? 's' : ''} dans « {zoneLabel(lastDispatch.zone)} ».
            {queue.length > 0 ? ' Continue avec le reste.' : ''}
          </span>
          <button
            onClick={() => nav(`/zone/${lastDispatch.zone}`)}
            className="shrink-0 rounded bg-emerald-700/60 px-2 py-1 text-xs text-emerald-50"
          >
            Voir la zone
          </button>
        </p>
      )}

      {/* counts={} so we don't show existing photo counts here — keeps the picker focused on dispatch */}
      <BodyDiagram counts={{}} onZoneClick={dispatchTo} />
    </div>
  )
}
