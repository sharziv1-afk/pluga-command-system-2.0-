// A device-local unlock code — NOT a server auth mechanism. It never talks to
// Supabase and never replaces the real OTP login: it only re-opens a session
// that already exists on THIS device (localStorage) when there's no network
// to re-verify it. Think "PIN to unlock the Gmail app," not "password."
//
// Storage: PBKDF2-SHA256 hash + a random per-device salt, both in
// localStorage. Never the raw PIN. 150k iterations is deliberately modest —
// this only needs to resist someone guessing a 4-6 digit PIN by hand, not a
// GPU cracking rig; the real secret (the Supabase session) never leaves the
// device either way.
//
// Extension point for later: a WebAuthn (FaceID/fingerprint) unlock would
// live alongside this as a second `hasX()/verifyX()` pair — same shape,
// doesn't require touching this file.

const PIN_HASH_KEY = 'hamefaked_device_pin_hash';
const PIN_SALT_KEY = 'hamefaked_device_pin_salt';
const PBKDF2_ITERATIONS = 150_000;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

export function hasDevicePin(): boolean {
  try {
    return Boolean(window.localStorage.getItem(PIN_HASH_KEY));
  } catch {
    return false;
  }
}

export async function setDevicePin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  window.localStorage.setItem(PIN_SALT_KEY, toHex(salt.buffer as ArrayBuffer));
  window.localStorage.setItem(PIN_HASH_KEY, hash);
}

export async function verifyDevicePin(pin: string): Promise<boolean> {
  try {
    const storedHash = window.localStorage.getItem(PIN_HASH_KEY);
    const storedSalt = window.localStorage.getItem(PIN_SALT_KEY);
    if (!storedHash || !storedSalt) return false;
    const candidateHash = await derivePinHash(pin, fromHex(storedSalt));
    return candidateHash === storedHash;
  } catch {
    return false;
  }
}

export function clearDevicePin(): void {
  try {
    window.localStorage.removeItem(PIN_HASH_KEY);
    window.localStorage.removeItem(PIN_SALT_KEY);
  } catch {
    /* ignore */
  }
}
