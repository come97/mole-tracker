import { useEffect, useRef, useState } from 'react'
import type { PhotoRow } from '../lib/supabase'
import { getPhotoBlobUrl } from '../lib/photos'

type Props = {
  photos: PhotoRow[]
  startIndex: number
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 5
const SWIPE_THRESHOLD_PX = 60
const SWIPE_VELOCITY_PX_MS = 0.4

type Transform = { scale: number; tx: number; ty: number }
const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 }

/**
 * Fullscreen image viewer with pinch/double-tap zoom, pan when zoomed,
 * and horizontal swipe between photos when at scale 1.
 */
export default function PhotoViewer({ photos, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Live drag/pinch state — stored in a ref so we don't trigger re-renders
  // on every pointermove. We commit to React state on pointer end.
  const gesture = useRef<GestureState | null>(null)
  // For double-tap detection.
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  // Reset zoom whenever the active photo changes.
  useEffect(() => { setTransform(IDENTITY) }, [index])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Esc to close, arrows to navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length])

  function goPrev() { if (index > 0) setIndex(i => i - 1) }
  function goNext() { if (index < photos.length - 1) setIndex(i => i + 1) }

  function clampPan(t: Transform): Transform {
    const el = containerRef.current
    if (!el) return t
    const w = el.clientWidth
    const h = el.clientHeight
    // The image element is sized to fit the viewport (object-contain). When
    // scaled by `s`, its overflow on each axis is (s-1)*size/2.
    const maxX = ((t.scale - 1) * w) / 2
    const maxY = ((t.scale - 1) * h) / 2
    return {
      scale: t.scale,
      tx: Math.max(-maxX, Math.min(maxX, t.tx)),
      ty: Math.max(-maxY, Math.min(maxY, t.ty)),
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = containerRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)

    const g = gesture.current ?? {
      pointers: new Map(),
      startTransform: transform,
      pinchStartDist: 0,
      pinchStartScale: 1,
      panStart: { x: 0, y: 0 },
      swipeStart: { x: 0, y: 0, t: 0 },
      swipeDx: 0,
      moved: false,
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (g.pointers.size === 2) {
      const [p1, p2] = [...g.pointers.values()]
      g.pinchStartDist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      g.pinchStartScale = transform.scale
      g.startTransform = transform
    } else if (g.pointers.size === 1) {
      g.startTransform = transform
      g.panStart = { x: e.clientX, y: e.clientY }
      g.swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() }
      g.swipeDx = 0
      g.moved = false
    }
    gesture.current = g
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (g.pointers.size === 2) {
      const [p1, p2] = [...g.pointers.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      if (g.pinchStartDist > 0) {
        const nextScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, g.pinchStartScale * (dist / g.pinchStartDist)),
        )
        setTransform(clampPan({ ...g.startTransform, scale: nextScale }))
      }
      g.moved = true
    } else if (g.pointers.size === 1) {
      const dx = e.clientX - g.panStart.x
      const dy = e.clientY - g.panStart.y
      if (Math.hypot(dx, dy) > 4) g.moved = true
      if (transform.scale > 1.01) {
        // Pan within the zoomed image.
        setTransform(clampPan({
          scale: g.startTransform.scale,
          tx: g.startTransform.tx + dx,
          ty: g.startTransform.ty + dy,
        }))
      } else {
        // At native scale: track horizontal drag for swipe-between-photos.
        g.swipeDx = dx
        if (containerRef.current) {
          containerRef.current.style.setProperty('--swipe-dx', `${dx}px`)
        }
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    g.pointers.delete(e.pointerId)

    // Single-pointer release at scale 1: settle swipe or detect double-tap.
    if (g.pointers.size === 0) {
      if (transform.scale <= 1.01) {
        const dt = performance.now() - g.swipeStart.t
        const v = Math.abs(g.swipeDx) / Math.max(1, dt)
        const passed = Math.abs(g.swipeDx) > SWIPE_THRESHOLD_PX || v > SWIPE_VELOCITY_PX_MS
        if (passed && g.swipeDx < 0 && index < photos.length - 1) {
          goNext()
        } else if (passed && g.swipeDx > 0 && index > 0) {
          goPrev()
        }
        if (containerRef.current) {
          containerRef.current.style.setProperty('--swipe-dx', '0px')
        }
        // Double-tap detection (only when no real movement happened).
        if (!g.moved) {
          const now = performance.now()
          const last = lastTap.current
          if (last && now - last.t < 280 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
            // Toggle between 1x and 2.5x, centered on the tap point.
            if (transform.scale > 1.01) {
              setTransform(IDENTITY)
            } else {
              const el = containerRef.current
              const rect = el?.getBoundingClientRect()
              const cx = rect ? e.clientX - (rect.left + rect.width / 2) : 0
              const cy = rect ? e.clientY - (rect.top + rect.height / 2) : 0
              const s = 2.5
              setTransform(clampPan({ scale: s, tx: -cx * (s - 1), ty: -cy * (s - 1) }))
            }
            lastTap.current = null
          } else {
            lastTap.current = { t: now, x: e.clientX, y: e.clientY }
          }
        } else {
          lastTap.current = null
        }
      }
      gesture.current = null
    } else if (g.pointers.size === 1) {
      // Coming out of pinch back to single-pointer pan: re-anchor.
      const [only] = [...g.pointers.values()]
      g.startTransform = transform
      g.panStart = { x: only.x, y: only.y }
      g.swipeStart = { x: only.x, y: only.y, t: performance.now() }
      g.swipeDx = 0
      g.moved = true
    }
  }

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black"
      style={{ touchAction: 'none' }}
    >
      <ViewerImage
        key={photo.id}
        photo={photo}
        transform={transform}
        animateSwipe={transform.scale <= 1.01}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between p-3">
        <div className="rounded bg-black/60 px-2 py-1 text-xs text-white">
          {index + 1} / {photos.length} · {new Date(photo.taken_at).toLocaleDateString('fr-FR')}
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-sm text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Side arrows (desktop / large screens) */}
      {index > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white sm:block"
          aria-label="Précédent"
        >
          ‹
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white sm:block"
          aria-label="Suivant"
        >
          ›
        </button>
      )}

      {/* Hint */}
      {photos.length > 1 && transform.scale <= 1.01 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/80">
          Balaie ← → · pince pour zoomer · double-tap
        </div>
      )}
    </div>
  )
}

function ViewerImage({
  photo, transform, animateSwipe,
}: { photo: PhotoRow; transform: Transform; animateSwipe: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    getPhotoBlobUrl(photo, 'full')
      .then(u => {
        if (cancelled) { URL.revokeObjectURL(u); return }
        setUrl(u)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [photo])

  if (error) {
    return <div className="text-sm text-rose-300">Impossible de charger : {error}</div>
  }
  if (!url) {
    return <div className="h-12 w-12 animate-pulse rounded-full bg-slate-800" />
  }

  return (
    <img
      src={url}
      alt="photo chiffrée"
      draggable={false}
      style={{
        transform: `translate(calc(var(--swipe-dx, 0px) + ${transform.tx}px), ${transform.ty}px) scale(${transform.scale})`,
        transformOrigin: 'center center',
        transition: animateSwipe ? 'transform 180ms ease-out' : 'none',
        maxWidth: '100vw',
        maxHeight: '100vh',
        objectFit: 'contain',
        willChange: 'transform',
      }}
    />
  )
}

type GestureState = {
  pointers: Map<number, { x: number; y: number }>
  startTransform: Transform
  pinchStartDist: number
  pinchStartScale: number
  panStart: { x: number; y: number }
  swipeStart: { x: number; y: number; t: number }
  swipeDx: number
  moved: boolean
}
