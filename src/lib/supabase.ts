import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in env.')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'moletrack.auth',
  },
})

export type PhotoRow = {
  id: string
  user_id: string
  body_zone: string
  body_zone_label: string | null
  encrypted_path: string
  iv: string
  thumbnail_path: string | null
  thumbnail_iv: string | null
  encrypted_size_bytes: number | null
  width: number | null
  height: number | null
  note_ct: string | null
  note_iv: string | null
  taken_at: string
  created_at: string
}

export type UserSettingsRow = {
  user_id: string
  salt: string
  pin_verifier_iv: string
  pin_verifier_ct: string
  created_at: string
  updated_at: string
}
