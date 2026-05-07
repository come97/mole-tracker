// Two-layer auth:
//
// 1. Email + password (Supabase managed) — identifies WHICH account is in use.
//    Lets the same account work across devices/browsers.
// 2. PIN (per-device) — derives the AES-GCM key used to decrypt photos.
//    Never sent to the server; only its salt + a verifier ciphertext are stored.
//
// On first signup: user picks email/password, then picks a PIN. Salt+verifier
// land in user_settings. On a NEW device: user logs in with email/password,
// retrieves the salt from user_settings, types the same PIN to derive the
// same key. Different PINs across devices are theoretically possible if you
// re-key, but in practice you'll use the same one.

import { supabase, type UserSettingsRow } from './supabase'
import {
  buildVerifier,
  checkVerifier,
  deriveKey,
  exportKeyRaw,
  importKeyRaw,
  newSalt,
} from './crypto'

let cachedKey: CryptoKey | null = null

// sessionStorage survives page refresh but is wiped when the tab/browser is
// closed — exactly the UX we want: refresh ≠ re-PIN, but full close = re-PIN.
const SESSION_KEY_STORAGE = 'moletrack:session-key:v1'

async function persistKey(key: CryptoKey): Promise<void> {
  try {
    const raw = await exportKeyRaw(key)
    sessionStorage.setItem(SESSION_KEY_STORAGE, raw)
  } catch (e) {
    // Persisting is a UX optimization, not a correctness requirement.
    console.warn('Failed to persist session key:', e)
  }
}

function clearPersistedKey(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}

/** Try to restore the AES key from sessionStorage. Returns true on success. */
export async function restoreSessionFromStorage(): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_STORAGE)
    if (!raw) return false
    cachedKey = await importKeyRaw(raw)
    return true
  } catch (e) {
    console.warn('Failed to restore session key, will ask for PIN:', e)
    clearPersistedKey()
    cachedKey = null
    return false
  }
}

export function getKey(): CryptoKey | null {
  return cachedKey
}

export function lockSession() {
  cachedKey = null
  clearPersistedKey()
}

/* ---- session helpers ---- */

export async function hasSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  return session !== null
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? null
}

/* ---- email / password ---- */

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  // If "Confirm email" is on in Supabase, no session is returned and the user
  // must click a link in their email before they can log in.
  return { session: data.session, needsEmailConfirm: data.session === null }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  cachedKey = null
  clearPersistedKey()
  await supabase.auth.signOut()
}

/* ---- PIN setup / unlock (unchanged) ---- */

export async function getUserSettings(): Promise<UserSettingsRow | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

/** True if this account has never set up a PIN yet. */
export async function isPinSetupNeeded(): Promise<boolean> {
  const settings = await getUserSettings()
  return settings === null
}

/** First-time PIN setup. Generates salt, derives key, stores verifier. */
export async function setupPin(pin: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

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
  await persistKey(key)
}

/** Returns true if PIN is correct, false otherwise. Caches the key on success. */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const settings = await getUserSettings()
  if (!settings) return false
  const key = await deriveKey(pin, settings.salt)
  const ok = await checkVerifier(key, settings.pin_verifier_iv, settings.pin_verifier_ct)
  if (ok) {
    cachedKey = key
    await persistKey(key)
  }
  return ok
}

/** Wipes everything for this account. Irreversible. */
export async function wipeAccount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('photos').delete().eq('user_id', user.id)
  await supabase.from('user_settings').delete().eq('user_id', user.id)
  await supabase.auth.signOut()
  cachedKey = null
  clearPersistedKey()
}
