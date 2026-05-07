# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (listens on all interfaces)
npm run build      # Type-check (tsc -b) then Vite build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

No test framework is configured.

## Environment

Requires `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture

MoleTrack is a **zero-knowledge PWA** for tracking skin lesions. The server (Supabase) only ever stores encrypted blobs — the encryption key is derived client-side from the user's PIN and never transmitted.

**Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Supabase + vite-plugin-pwa

### Two-Layer Authentication

1. **Layer 1 — Supabase Auth**: Standard email/password session managed by Supabase.
2. **Layer 2 — PIN key derivation**: A 6-digit PIN + per-user salt → PBKDF2-SHA256 (250k iterations) → AES-GCM-256 key. This key is cached in `sessionStorage` (cleared on tab close). The PIN itself is never stored — only a verifier (encrypted known plaintext) in Postgres.

### App State Machine (`src/App.tsx`)

The app has five states: `loading → unauthed → setup-pin → locked → unlocked`. All routes are guarded behind `unlocked`. The bootstrap `useEffect` checks for a Supabase session and an AES key in `sessionStorage`.

### Encryption Pipeline (`src/lib/crypto.ts`, `src/lib/photos.ts`)

When saving a photo:
1. Image → canvas → scaled JPEG (2048px max, quality 0.88)
2. Thumbnail → JPEG (320px max, quality 0.78)
3. Both encrypted with AES-GCM + random 12-byte IV
4. Encrypted blobs uploaded to Supabase Storage: `mole-photos/<user-id>/<uuid>.bin` and `.thumb.bin`
5. Metadata (encrypted paths, IVs, body zone, dimensions, taken_at, encrypted note) inserted into `photos` Postgres table

When displaying: download blob → decrypt → `URL.createObjectURL()` → revoke on unmount.

### Database Tables

- `user_settings`: `user_id`, `salt`, `pin_verifier_iv`, `pin_verifier_ct`
- `photos`: `id`, `user_id`, `body_zone`, `encrypted_path`, `iv`, `thumbnail_path`, `thumbnail_iv`, `encrypted_size_bytes`, `width`, `height`, `note_ct`, `note_iv`, `taken_at`, `created_at`

Supabase Storage bucket `mole-photos` is private with RLS enforcing user-only access.

### Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Session management, PIN setup/unlock, `wipeAccount()` |
| `src/lib/crypto.ts` | PBKDF2 key derivation, AES-GCM encrypt/decrypt, base64 helpers |
| `src/lib/photos.ts` | Photo CRUD with encryption, thumbnail generation, Storage uploads |
| `src/lib/importQueue.ts` | In-memory singleton queue for batch import (observer pattern, not persisted) |
| `src/lib/bodyZones.ts` | Body zone taxonomy used across pages and the body diagram |
| `src/components/Layout.tsx` | App shell: header with account menu (lock/disconnect) + bottom nav |
| `src/components/BodyDiagram.tsx` | Visual body zone picker (SVG-based) |

### Router Structure

```
<App>
  ├─ <AuthScreen />          (unauthed state)
  ├─ <LockScreen />          (setup-pin / locked states)
  └─ <Layout>                (unlocked — header + bottom nav)
     ├─ /                    HomePage (zone overview with counts)
     ├─ /all                 AllPhotosPage
     ├─ /add                 AddPage (single capture or route to /import)
     ├─ /import              ImportPage (batch import with per-file zone assignment)
     ├─ /zone/:zone          ZonePage
     ├─ /photo/:id           PhotoDetailPage
     └─ /compare             ComparePage (side-by-side)
```

### PWA Configuration (`vite.config.ts`)

Workbox caches static assets and falls back to `index.html` for offline use. Icons at 192×192 and 512×512 (maskable). Dev server uses `host: true`.

## Security Notes

- **Lost PIN = permanent data loss**. Photos are unrecoverable without the PIN.
- AES key lives only in `sessionStorage`; closing the tab requires re-entering the PIN.
- `wipeAccount()` in `auth.ts` is destructive: deletes all Storage blobs, DB rows, and the Supabase auth user.
