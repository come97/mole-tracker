import { useEffect, useState } from 'react'
import type { PhotoRow } from '../lib/supabase'
import { getPhotoBlobUrl } from '../lib/photos'

type Props = {
  photo: PhotoRow
  className?: string
  full?: boolean
}

// Memoised cache per photo+variant (full vs thumb) so navigating in/out
// of the same gallery doesn't re-decrypt every blob.
const urlCache = new Map<string, string>()

export default function PhotoThumb({ photo, className, full }: Props) {
  const cacheKey = `${photo.id}:${full ? 'full' : 'thumb'}`
  const [url, setUrl] = useState<string | null>(() => urlCache.get(cacheKey) ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (urlCache.has(cacheKey)) return
    let cancelled = false
    getPhotoBlobUrl(photo, full ? 'full' : 'thumb')
      .then(u => {
        if (cancelled) {
          URL.revokeObjectURL(u)
          return
        }
        urlCache.set(cacheKey, u)
        setUrl(u)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [cacheKey, photo, full])

  if (error)
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-3)',
          color: 'var(--danger)',
          fontSize: 11,
          fontFamily: 'var(--mono)',
        }}
      >
        err
      </div>
    )
  if (!url)
    return (
      <div
        className={className}
        style={{
          background: 'var(--surface-3)',
          animation: 'pulse 1.6s var(--ease) infinite',
        }}
      />
    )
  return <img src={url} className={className} alt="photo chiffrée" />
}
