import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from 'node:crypto';

// Web Push sender: VAPID (RFC 8292) and aes128gcm payload encryption
// (RFC 8291 over RFC 8188), written against node:crypto instead of the
// `web-push` package so the app keeps no extra dependency. Only node:crypto
// is imported here, so tests/webPush.test.mjs can load this file directly and
// check it against the RFC 8291 example message.

export interface PushTarget {
  endpoint: string;
  /** The browser's P-256 public key, base64url (65 bytes uncompressed). */
  p256dh: string;
  /** The browser's 16-byte auth secret, base64url. */
  auth: string;
}

export interface VapidKeys {
  /** Base64url, 65-byte uncompressed P-256 point (NEXT_PUBLIC_VAPID_PUBLIC_KEY). */
  publicKey: string;
  /** Base64url, 32-byte P-256 private scalar (VAPID_PRIVATE_KEY). */
  privateKey: string;
  /** mailto: or https: contact for the push services. */
  subject: string;
}

export interface SendOptions {
  /** Seconds the push service keeps an undelivered message. */
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** A newer message with the same topic replaces an undelivered older one. */
  topic?: string;
}

export interface SendResult {
  status: number;
  ok: boolean;
  /** 404/410: the subscription is dead and should be deleted. */
  gone: boolean;
}

const RECORD_SIZE = 4096;

export const fromBase64Url = (value: string): Buffer => Buffer.from(value, 'base64url');
export const toBase64Url = (value: Uint8Array): string => Buffer.from(value).toString('base64url');

const hmac = (key: Uint8Array, data: Uint8Array): Buffer => createHmac('sha256', key).update(data).digest();

/** RFC 8291 section 3.4: the content key and nonce for one message. */
export function deriveContentKeys(input: {
  ecdhSecret: Uint8Array;
  authSecret: Uint8Array;
  uaPublic: Uint8Array;
  asPublic: Uint8Array;
  salt: Uint8Array;
}): { cek: Buffer; nonce: Buffer } {
  const prkKey = hmac(input.authSecret, input.ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), input.uaPublic, input.asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(input.salt, ikm);
  return {
    cek: hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16),
    nonce: hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12),
  };
}

/**
 * Encrypts one push message as a single aes128gcm record. `salt` and
 * `asPrivate` exist for the RFC test vector only; real sends use fresh random
 * values for both, every time.
 */
export function encryptPayload(
  payload: Uint8Array,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  testing?: { salt: Uint8Array; asPrivate: Uint8Array },
): Buffer {
  const uaPublic = fromBase64Url(target.p256dh);
  const authSecret = fromBase64Url(target.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Invalid p256dh key');
  if (authSecret.length !== 16) throw new Error('Invalid auth secret');

  const ecdh = createECDH('prime256v1');
  if (testing) ecdh.setPrivateKey(testing.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = testing?.salt ?? randomBytes(16);

  const { cek, nonce } = deriveContentKeys({
    ecdhSecret: ecdh.computeSecret(uaPublic),
    authSecret,
    uaPublic,
    asPublic,
    salt,
  });

  // One record: the payload, then the 0x02 last-record delimiter, no padding.
  const plaintext = Buffer.concat([payload, Buffer.from([2])]);
  if (plaintext.length + 16 > RECORD_SIZE) throw new Error('Push payload too large');
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  Buffer.from(salt).copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ciphertext]);
}

/** RFC 8292: the Authorization header value for one push service origin. */
export function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const publicKey = fromBase64Url(vapid.publicKey);
  const rawPrivateKey = fromBase64Url(vapid.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4 || rawPrivateKey.length === 0 || rawPrivateKey.length > 32) {
    throw new Error('Invalid VAPID keys');
  }
  // Node's ECDH getPrivateKey() drops leading zero bytes, so about 1 key in
  // 256 is 31 bytes or shorter. It is the same scalar; JWK needs all 32 bytes.
  const privateKey = Buffer.concat([Buffer.alloc(32 - rawPrivateKey.length), rawPrivateKey]);

  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: toBase64Url(privateKey),
      x: toBase64Url(publicKey.subarray(1, 33)),
      y: toBase64Url(publicKey.subarray(33, 65)),
    },
    format: 'jwk',
  });

  const encode = (value: object) => toBase64Url(Buffer.from(JSON.stringify(value)));
  const signingInput = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
    aud: new URL(endpoint).origin,
    // Push services reject an expiry more than 24 hours out.
    exp: nowSeconds + 12 * 60 * 60,
    sub: vapid.subject,
  })}`;
  const signature = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${signingInput}.${toBase64Url(signature)}, k=${vapid.publicKey}`;
}

export async function sendWebPush(target: PushTarget, payload: string, vapid: VapidKeys, options: SendOptions = {}): Promise<SendResult> {
  const headers: Record<string, string> = {
    Authorization: vapidAuthorization(target.endpoint, vapid),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 24 * 60 * 60),
    Urgency: options.urgency ?? 'normal',
  };
  if (options.topic) headers.Topic = options.topic;

  const response = await fetch(target.endpoint, {
    method: 'POST',
    headers,
    body: new Uint8Array(encryptPayload(Buffer.from(payload, 'utf8'), target)),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, ok: response.ok, gone: response.status === 404 || response.status === 410 };
}
