// Zero-knowledge crypto helpers built on the WebCrypto API.
// - PBKDF2-SHA256 (250k iterations) derives an AES-GCM-256 key from PIN + salt.
// - Each blob gets a fresh 12-byte random IV.
// - The server stores ONLY ciphertext; the PIN never leaves the device.

const PBKDF2_ITERATIONS = 250_000
const VERIFIER_PLAINTEXT = 'moletrack-pin-verifier-v1'

/* ----- base64 helpers ----- */

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ----- random ----- */

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

export function newSalt(): string {
  return bytesToBase64(randomBytes(16))
}

export function newIv(): Uint8Array {
  return randomBytes(12)
}

/* ----- key derivation ----- */

export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/* ----- encrypt / decrypt arbitrary bytes ----- */

export async function encryptBytes(
  key: CryptoKey,
  plaintext: ArrayBuffer | Uint8Array
): Promise<{ iv: string; ciphertext: Uint8Array }> {
  const iv = newIv()
  const buf =
    plaintext instanceof Uint8Array
      ? plaintext
      : new Uint8Array(plaintext)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, buf as BufferSource)
  return { iv: bytesToBase64(iv), ciphertext: new Uint8Array(ct) }
}

export async function decryptBytes(
  key: CryptoKey,
  ivB64: string,
  ciphertext: ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  const iv = base64ToBytes(ivB64)
  const buf =
    ciphertext instanceof Uint8Array
      ? ciphertext
      : new Uint8Array(ciphertext)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, buf as BufferSource)
  return new Uint8Array(pt)
}

/* ----- text helpers ----- */

export async function encryptText(key: CryptoKey, text: string) {
  const enc = new TextEncoder().encode(text)
  const { iv, ciphertext } = await encryptBytes(key, enc)
  return { iv, ct: bytesToBase64(ciphertext) }
}

export async function decryptText(key: CryptoKey, ivB64: string, ctB64: string) {
  const pt = await decryptBytes(key, ivB64, base64ToBytes(ctB64))
  return new TextDecoder().decode(pt)
}

/* ----- PIN verifier (proves a PIN is correct without storing it) ----- */

export async function buildVerifier(key: CryptoKey) {
  return encryptText(key, VERIFIER_PLAINTEXT)
}

export async function checkVerifier(
  key: CryptoKey,
  ivB64: string,
  ctB64: string
): Promise<boolean> {
  try {
    const txt = await decryptText(key, ivB64, ctB64)
    return txt === VERIFIER_PLAINTEXT
  } catch {
    return false
  }
}
