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

test('the cache name moved on, so the old cache with API responses is dropped', () => {
  assert.match(sw, /const CACHE_NAME = 'hamefaked-shell-v2';/);
  assert.match(sw, /keys\.filter\(\(key\) => key !== CACHE_NAME\)\.map\(\(key\) => caches\.delete\(key\)\)/);
});
