// Device-local biometric unlock (Face ID / Touch ID / Windows Hello) via the
// platform's WebAuthn authenticator. Same trust model as devicePin.ts — this
// re-opens an existing on-device session, it is not server auth. There is no
// backend verifying a signature: the platform authenticator itself is what
// refuses to produce an assertion when the biometric check fails, and that
// refusal is what verifyDeviceBiometric relies on.

const CREDENTIAL_ID_KEY = 'hamefaked_device_biometric_credential_id';

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator.credentials !== 'undefined';
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasDeviceBiometric(): boolean {
  try {
    return Boolean(window.localStorage.getItem(CREDENTIAL_ID_KEY));
  } catch {
    return false;
  }
}

export async function registerDeviceBiometric(userName: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge() as BufferSource,
        rp: { name: 'המפקד' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)) as BufferSource,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;
    window.localStorage.setItem(CREDENTIAL_ID_KEY, credential.id);
    return true;
  } catch {
    return false;
  }
}

export async function verifyDeviceBiometric(): Promise<boolean> {
  try {
    const credentialId = window.localStorage.getItem(CREDENTIAL_ID_KEY);
    if (!credentialId) return false;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge() as BufferSource,
        allowCredentials: [{ type: 'public-key', id: base64UrlToBytes(credentialId) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function clearDeviceBiometric(): void {
  try {
    window.localStorage.removeItem(CREDENTIAL_ID_KEY);
  } catch {
    /* ignore */
  }
}
