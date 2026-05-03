// Session helpers: anonymous Supabase auth + PIN unlock.
//
// Flow on first launch:
//   1. signInAnonymously() — gives the client a stable user_id under RLS.
//   2. user picks a PIN (>= 4 digits).
//   3. we generate a salt, derive a key from PIN+salt, encrypt a known
//      plaintext as a "verifier", and persist {salt, verifier} on Supabase
//      (table user_settings).
//
// Flow on subsequent launches:
//   1. session is restored from localStorage by supabase-js.
//   2. lock screen asks for PIN.
//   3. we re-derive the key from PIN + the stored salt and check the verifier.
//      If it matches, we keep the CryptoKey in memory for the session.

import { supabase, type UserSettingsRow } from './supabase'
import {
  buildVerifier,
  checkVerifier,
  deriveKey,
  newSalt,
} from './crypto'

let cachedKey: CryptoKey | null = null

export function getKey(): CryptoKey | null {
  return cachedKey
}

export function lockSession() {
  cachedKey = null
}

export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}

export async function getUserSettings(): Promise<UserSettingsRow | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

/** Returns true on first launch (no PIN set yet). */
export async function isFirstLaunch(): Promise<boolean> {
  const settings = await getUserSettings()
  return settings === null
}

/** First-time PIN setup. Generates salt, derives key, stores verifier. */
export async function setupPin(pin: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No authenticated user')

  const salt = newSalt()
  const key = await deriveKey(pin, salt)
  const v = await buildVerifier(key)

  const { error } = await supabase.from('user_settings').insert({
    user_id: user.id,
    salt,
    pin_verifier_iv: v.iv,
    pin_verifier_ct: v.ct,
  })
  if (error) throw error
  cachedKey = key
}

/** Returns true if PIN is correct, false otherwise. Caches the key on success. */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const settings = await getUserSettings()
  if (!settings) return false
  const key = await deriveKey(pin, settings.salt)
  const ok = await checkVerifier(key, settings.pin_verifier_iv, settings.pin_verifier_ct)
  if (ok) cachedKey = key
  return ok
}

/** Wipes everything for this account. Irreversible. */
export async function wipeAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // Photos rows cascade-delete files only if you remove storage objects too —
  // we let the photos.ts deletePhoto helper handle storage cleanup individually.
  await supabase.from('photos').delete().eq('user_id', user.id)
  await supabase.from('user_settings').delete().eq('user_id', user.id)
  await supabase.auth.signOut()
  cachedKey = null
}
