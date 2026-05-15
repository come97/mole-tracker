/**
 * Daily keep-alive ping for the Supabase project.
 *
 * Supabase free-tier projects auto-pause after ~7 days of inactivity. When
 * that happens every REST call returns "Failed to fetch" and the front-end
 * bootstrap can't even decide between authed/unauthed — users get stuck on
 * the loading screen. Incident reference: 2026-05-15.
 *
 * Vercel triggers this endpoint once a day (see vercel.json `crons`). We
 * make one tiny PostgREST request — that's enough activity to reset the
 * Supabase inactivity timer. RLS returns an empty array since we have no
 * session; we don't care about the body, only that the request hits the
 * database.
 *
 * No auth header needed: the only thing this endpoint does is hit Supabase
 * with the anon key (which the frontend ships publicly anyway). The blast
 * radius if someone calls it manually is "one cheap PostgREST request" —
 * not worth a CRON_SECRET env var.
 */

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  // Reuse the same env vars the front-end already needs — no extra setup
  // required on Vercel.
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return Response.json(
      { error: 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' },
      { status: 500 },
    )
  }

  const pingedAt = new Date().toISOString()
  try {
    const res = await fetch(`${url}/rest/v1/photos?select=id&limit=1`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[cron][keep-alive] PostgREST', res.status, text)
      return Response.json(
        { ok: false, status: res.status, pinged_at: pingedAt },
        { status: 502 },
      )
    }
    return Response.json({ ok: true, pinged_at: pingedAt })
  } catch (e) {
    console.error('[cron][keep-alive] fetch failed', e)
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), pinged_at: pingedAt },
      { status: 502 },
    )
  }
}
