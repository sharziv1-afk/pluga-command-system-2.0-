import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasAdminAccess } from '../src/lib/permissions.ts';

// Real bug, confirmed against the live RLS policies: forum_daily_reports'
// "commander update all" policy is gated by is_commander (מ"פ, סמ"פ, or
// permission_level >= 90), but the UI offered "publish & close the whole
// forum" to anyone with hasCompanyWideUiAccess, which also includes מש"ד
// (permission_level 85). A מש"ד's bulk close silently narrows under RLS to
// the "owner update own" policy — it closes only their own report — and the
// old success check (`closed.length === 0`) couldn't tell that apart from
// closing everything, since a positive count looked like success either way.

test('hasAdminAccess matches the DB is_commander role check (מ"פ/סמ"פ), and excludes מש"ד', () => {
  assert.equal(hasAdminAccess('מ"פ'), true);
  assert.equal(hasAdminAccess('סמ"פ'), true);
  assert.equal(hasAdminAccess('מש"ד'), false, 'מש"ד must not pass the commander-only gate');
});

test('forum/page.tsx gates the publish button and the write itself on canPublishForum, not canSeeAll', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');

  assert.match(
    source,
    /canPublishForum\s*=\s*Boolean\(currentUser\)\s*&&\s*\(hasAdminAccess\([^)]*\)\s*\|\|\s*profilePermissionLevel\s*>=\s*90\)/,
    'canPublishForum should mirror is_commander: hasAdminAccess (מ"פ/סמ"פ) or permission_level >= 90',
  );

  assert.match(
    source,
    /canPublishForum\s*&&\s*selectedNode\.level === 'company'\s*&&\s*renderCompanyPublishBlock\(\)/,
    'the publish-and-close button must be gated by canPublishForum, not the broader canSeeAll',
  );

  assert.match(
    source,
    /const publishAndCloseForum = async \(\) => \{\s*\n\s*if \(!dbProfile \|\| !canPublishForum\) return;/,
    'publishAndCloseForum itself must refuse to run for anyone canPublishForum rejects, not just hide the button',
  );
});

test('a partial bulk-close is reported as partial, not as a completed publish', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');

  assert.match(
    source,
    /if \(closed\.length < openBefore\)/,
    'closed.length must be compared against openBefore, not just checked against zero',
  );

  // The success line must sit after that partial-check's early return, so a
  // partial close can never reach it.
  const partialIdx = source.indexOf('if (closed.length < openBefore)');
  const successIdx = source.indexOf("setDailySuccess(`הפורום הופץ ונסגר");
  assert.ok(partialIdx > -1 && successIdx > -1 && partialIdx < successIdx, 'the partial-close check must guard the success message');
});
