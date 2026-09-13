import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Real bug, reported from an actual offline phone test: airplane mode, close
// the app, reopen it — every other list page (tasks, requests, schedule)
// fell back to its last IndexedDB snapshot; the dashboard reset to the empty
// state instead, showing zero tasks and zero requests even though the
// device had a perfectly good cached view from moments earlier. The
// dashboard was the one page with no cacheGet/cacheSet at all.

const SOURCE = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');

test('the dashboard reads from cache when navigator.onLine is false, before attempting network', () => {
  assert.match(SOURCE, /import\s*\{[^}]*cacheGet[^}]*cacheSet[^}]*\}\s*from\s*['"]@\/lib\/offline\/db['"]/s, 'must import the offline cache helpers');

  // The upfront check must come before the network Promise.all, not after.
  const onlineCheckIdx = SOURCE.indexOf('if (!navigator.onLine)');
  const promiseAllIdx = SOURCE.indexOf('await Promise.all([');
  assert.ok(onlineCheckIdx > -1, 'must check navigator.onLine before loading');
  assert.ok(promiseAllIdx > -1, 'the parallel fetch should still exist');
  assert.ok(onlineCheckIdx < promiseAllIdx, 'the offline check must short-circuit before the network calls, not after');
});

test('a failed network call falls back to cache too, not just the upfront onLine check', () => {
  // navigator.onLine can report true on a dead connection — the catch block
  // needs its own fallback, matching the pattern already proven on tasks.
  assert.match(
    SOURCE,
    /catch \(loadError\) \{[\s\S]*?cacheGet<DashboardData>\(DASHBOARD_CACHE_KEY\)/,
    'the catch block must also try the cache before giving up to the empty state',
  );
});

test('a successful load writes the cache, so there is something to fall back to next time', () => {
  assert.match(SOURCE, /setDashboardData\(nextData\);\s*\n\s*void cacheSet\(DASHBOARD_CACHE_KEY, nextData\)/, 'a successful load must persist nextData to cache');
});

test('the cache key is scoped per user, not shared across accounts on the same device', () => {
  assert.match(SOURCE, /DASHBOARD_CACHE_KEY\s*=\s*`dashboard:\$\{currentUser\?\.id[^}]*\}`/, 'cache key must include the current user id');
});

test('an offline banner is shown, telling the commander this is cached data, not silence', () => {
  assert.match(SOURCE, /isOffline &&[\s\S]{0,300}?WifiOff/, 'must render a visible offline indicator, matching the pattern used on tasks/requests/schedule');
});
