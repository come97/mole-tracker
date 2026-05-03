import { useEffect, useRef, useState } from 'react'

type Props = {
  onCapture: (file: File) => void
  onCancel: () => void
}

export default function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      setError(null)
      setReady(false)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
          setReady(true)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`Caméra indisponible : ${msg}`)
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [facing])

  async function shoot() {
    const v = videoRef.current
    if (!v || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(v, 0, 0)
    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(res, 'image/jpeg', 0.92),
    )
    if (!blob) return
    onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
            Démarrage de la caméra…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-rose-300">
            <p>{error}</p>
            <p className="mt-2 text-xs text-slate-400">
              Tu peux aussi importer une photo existante.
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between bg-black px-6 py-5">
        <button onClick={onCancel} className="text-slate-300">Annuler</button>
        <button
          onClick={shoot}
          disabled={!ready}
          aria-label="Prendre la photo"
          className="h-16 w-16 rounded-full border-4 border-white bg-white/90 active:scale-95 disabled:opacity-40"
        />
        <button
          onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}
          className="text-slate-300"
          aria-label="Changer de caméra"
          title="Changer de caméra"
        >
          ⟳
        </button>
      </div>
    </div>
  )
}
