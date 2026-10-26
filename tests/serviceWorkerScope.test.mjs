import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync('public/sw.js', 'utf8');

test('the service worker never caches API or OAuth metadata responses', () => {
  // Found live on 26.10.2026: a revoked calendar link kept returning the
  // calendar in the browser, served stale-while-revalidate from the shell
  // cache, while the server already answered 404.
  const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  const skip = fetchHandler.indexOf("if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.well-known/')) return;");
  assert.ok(skip > 0, 'API paths must be skipped');
  assert.ok(skip < fetchHandler.indexOf('event.respondWith('), 'the skip must come before respondWith');
});

test('page payloads (RSC) are never cached or served from cache', () => {
  // The 26.10.2026 navigation bug: 519 cached ?_rsc= payloads from older
  // builds were served on client navigation, so pages reloaded or errored.
  const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  const skip = fetchHandler.indexOf("if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return;");
  assert.ok(skip > 0 && skip < fetchHandler.indexOf('event.respondWith('));
});

test('a new worker takes over at once and purges all but hashed build assets', () => {
  assert.match(sw, /const CACHE_NAME = 'hamefaked-shell-v3';/);
  assert.match(sw, /self\.skipWaiting\(\);/, 'v2 sat in "waiting" for days behind open tabs');
  assert.match(sw, /const isStaticAsset = \(url\) => url\.pathname\.startsWith\('\/_next\/static\/'\);/);
  const activate = sw.slice(sw.indexOf("addEventListener('activate'"), sw.indexOf("addEventListener('fetch'"));
  assert.match(activate, /\.filter\(\(request\) => !isStaticAsset\(new URL\(request\.url\)\)\)/, 'stale payloads, documents and API responses go');
  assert.doesNotMatch(activate, /caches\.delete\(key\)/, 'whole caches stay, so an open older tab keeps its chunks');
  assert.match(activate, /self\.clients\.claim\(\)/);
});
