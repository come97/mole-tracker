import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CameraCapture from '../components/CameraCapture'
import { BODY_ZONES, zoneLabel } from '../lib/bodyZones'
import { savePhoto } from '../lib/photos'
import { importQueue } from '../lib/importQueue'

export default function AddPage() {
  const [params] = useSearchParams()
  const initialZone = params.get('zone') ?? ''
  const nav = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [zone, setZone] = useState(initialZone)
  const [note, setNote] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-semibold text-slate-100">Nouvelle photo</h2>

      {!file ? (
        <div className="mt-6 grid gap-3">
          <button
            onClick={() => setShowCamera(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-4 text-white font-medium active:bg-indigo-600"
          >
            📷 Prendre une photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-slate-100 active:bg-slate-800"
          >
            🖼️ Importer depuis l'appareil
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async e => {
              const files = e.target.files
              if (!files || files.length === 0) return
              // Always go through the import queue for picker-imported files,
              // even a single one — the dispatch UI is more flexible than the
              // single-photo form (multi-select + body picker).
              // Reset the input synchronously so re-picking the same file later still fires onChange.
              const list = files
              e.target.value = ''
              // Navigate first so the user lands on /import while encryption is happening;
              // the queue's subscribers update the page as items appear.
              nav('/import')
              try {
                await importQueue.add(list)
              } catch (err) {
                console.error('Failed to enqueue imports', err)
              }
            }}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="overflow-hidden rounded-xl bg-black">
            {previewUrl && <img src={previewUrl} className="max-h-[50vh] w-full object-contain" />}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Zone du corps
            </label>
            <select
              value={zone}
              onChange={e => setZone(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="">— Choisir —</option>
              {BODY_ZONES.map(z => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Note (optionnelle, chiffrée)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Ex. : grain de beauté côté gauche, contour foncé"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setFile(null); setNote(''); }}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-200 active:bg-slate-800"
              disabled={busy}
            >
              Reprendre
            </button>
            <button
              onClick={save}
              disabled={!zone || busy}
              className="flex-[2] rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white active:bg-indigo-600 disabled:opacity-40"
            >
              {busy ? 'Chiffrement & envoi…' : 'Enregistrer (chiffré)'}
            </button>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onCancel={() => setShowCamera(false)}
          onCapture={f => { setFile(f); setShowCamera(false); }}
        />
      )}
    </div>
  )
}
