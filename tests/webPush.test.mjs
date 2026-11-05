import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, createPublicKey, verify } from 'node:crypto';
import {
  deriveContentKeys,
  encryptPayload,
  fromBase64Url,
  toBase64Url,
  vapidAuthorization,
} from '../src/lib/push/webPush.ts';

/**
 * The push sender is hand-written over node:crypto (no `web-push` package),
 * so it is pinned to the published example: RFC 8291, section 5 and
 * appendix A. A wrong byte anywhere means Apple and Google drop the message
 * without telling anyone, so this is the only place the mistake would show.
 */

const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  ecdhSecret: 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs',
  cek: 'oIhVW04MRdy2XN9CiKLxTg',
  nonce: '4h_95klXJ5E_qnoN',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

test('key derivation matches RFC 8291 appendix A', () => {
  const { cek, nonce } = deriveContentKeys({
    ecdhSecret: fromBase64Url(RFC.ecdhSecret),
    authSecret: fromBase64Url(RFC.auth),
    uaPublic: fromBase64Url(RFC.uaPublic),
    asPublic: fromBase64Url(RFC.asPublic),
    salt: fromBase64Url(RFC.salt),
  });
  assert.equal(toBase64Url(cek), RFC.cek);
  assert.equal(toBase64Url(nonce), RFC.nonce);
});

test('the encrypted message is byte-for-byte the RFC 8291 example', () => {
  const body = encryptPayload(Buffer.from(RFC.plaintext), { p256dh: RFC.uaPublic, auth: RFC.auth }, {
    salt: fromBase64Url(RFC.salt),
    asPrivate: fromBase64Url(RFC.asPrivate),
  });
  assert.equal(toBase64Url(body), RFC.body);
});

test('a real send uses a fresh key and salt, and the browser side can decrypt it', () => {
  const browser = createECDH('prime256v1');
  browser.generateKeys();
  const target = { p256dh: toBase64Url(browser.getPublicKey()), auth: toBase64Url(Buffer.alloc(16, 7)) };
  const message = JSON.stringify({ title: 'משימה חדשה', body: 'בדיקה', url: '/tasks' });

  const first = encryptPayload(Buffer.from(message), target);
  const second = encryptPayload(Buffer.from(message), target);
  assert.notDeepEqual(first.subarray(0, 16), second.subarray(0, 16), 'salt must differ per message');

  // Decrypt as the browser would (RFC 8188 header, then RFC 8291 keys).
  const salt = first.subarray(0, 16);
  assert.equal(first.readUInt32BE(16), 4096);
  const idLength = first.readUInt8(20);
  const asPublic = first.subarray(21, 21 + idLength);
  const { cek, nonce } = deriveContentKeys({
    ecdhSecret: browser.computeSecret(asPublic),
    authSecret: fromBase64Url(target.auth),
    uaPublic: browser.getPublicKey(),
    asPublic,
    salt,
  });
  const record = first.subarray(21 + idLength);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(record.subarray(record.length - 16));
  const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  assert.equal(plain.subarray(0, -1).toString('utf8'), message);
});

test('bad subscription keys are refused before anything is sent', () => {
  assert.throws(() => encryptPayload(Buffer.from('x'), { p256dh: toBase64Url(Buffer.alloc(10)), auth: RFC.auth }), /p256dh/);
  assert.throws(() => encryptPayload(Buffer.from('x'), { p256dh: RFC.uaPublic, auth: toBase64Url(Buffer.alloc(8)) }), /auth/);
  assert.throws(() => encryptPayload(Buffer.alloc(5000), { p256dh: RFC.uaPublic, auth: RFC.auth }), /too large/);
});

test('VAPID header: an ES256 JWT for the push service origin, signed by our key', () => {
  const server = createECDH('prime256v1');
  server.generateKeys();
  const vapid = {
    publicKey: toBase64Url(server.getPublicKey()),
    privateKey: toBase64Url(server.getPrivateKey()),
    subject: 'https://pluga-command-system-2-0.vercel.app',
  };
  const now = 1_800_000_000;
  const header = vapidAuthorization('https://web.push.apple.com/QGx1y2z?x=1', vapid, now);

  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
  assert.ok(match, header);
  const [, head, claims, signature, k] = match;
  assert.equal(k, vapid.publicKey);
  assert.deepEqual(JSON.parse(fromBase64Url(head).toString()), { typ: 'JWT', alg: 'ES256' });
  const payload = JSON.parse(fromBase64Url(claims).toString());
  assert.equal(payload.aud, 'https://web.push.apple.com');
  assert.equal(payload.sub, vapid.subject);
  assert.ok(payload.exp > now && payload.exp <= now + 24 * 60 * 60, 'push services reject exp beyond 24h');

  const pub = server.getPublicKey();
  const key = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: toBase64Url(pub.subarray(1, 33)), y: toBase64Url(pub.subarray(33)) },
    format: 'jwk',
  });
  assert.ok(verify('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, fromBase64Url(signature)));
});
