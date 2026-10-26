import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Measured live on 26.10.2026 (database in ap-southeast-2, users in Israel):
 * every Supabase round trip costs 0.5–1.4 s. The proxy's getUser() added one
 * to every protected request (~0.85–1.5 s per un-prefetched navigation), and
 * the profile load chained three more before any page data could start.
 */

test('the proxy verifies the session locally, without a round trip to Supabase Auth', () => {
  const proxy = readFileSync('src/proxy.ts', 'utf8');
  assert.match(proxy, /await supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(proxy, /auth\.getUser\(/);
  assert.match(proxy, /if \(error \|\| !data\?\.claims\?\.sub\) \{/, 'no verified subject still redirects to /login');
});

test('the profile loads in one round trip: local session, unit embedded', () => {
  const profile = readFileSync('src/lib/supabase/profile.ts', 'utf8');
  assert.match(profile, /await supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(profile, /auth\.getUser\(/);
  assert.match(profile, /units!unit_id\(name\)/, 'users has two FKs to units; the embed must name unit_id');
  assert.doesNotMatch(profile, /\.from\('units'\)/, 'no second query for the unit');
  assert.match(profile, /throw new Error\('Current profile unit was not found'\)/, 'a missing unit still fails closed');
});

test('the forum loads role owners and their units in one query', () => {
  const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const loader = forum.slice(forum.indexOf('const loadOwnerOptions'), forum.indexOf('}, [canSeeAll, supabase]);', forum.indexOf('const loadOwnerOptions')));
  assert.match(loader, /select\('id,name,email,role,unit_id,units!unit_id\(name\)'\)/);
  assert.doesNotMatch(loader, /\.from\('units'\)/);
});

test('moving between pages shows a skeleton at once', () => {
  assert.ok(existsSync('src/app/(protected)/loading.tsx'));
  const loading = readFileSync('src/app/(protected)/loading.tsx', 'utf8');
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /'use client'/, 'a server component: no extra JS for the fallback');
});
