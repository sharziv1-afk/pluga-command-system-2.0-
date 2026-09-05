import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPermissionLevelForRole,
  normalizeRole,
  hasCompanyWideUiAccess,
  hasAdminAccess,
  isCompanyCommander,
} from '../src/lib/permissions.ts';

/**
 * These values are not invented: they are what public.users.permission_level
 * actually holds in Staging (checked 2026-09-06). getPermissionLevelForRole is
 * the second source of truth for the same numbers, so if the two drift, the UI
 * grants or withholds access that the stored level does not agree with.
 *
 * Note public.roles.permission_level is a THIRD copy and does NOT agree —
 * it has מש"ד at 70 where users and this function say 85. That column is only
 * used to order the role dropdown on /admin (no RLS policy references the
 * roles table at all), so it is a cosmetic discrepancy, not an authorization
 * one. It is deliberately not asserted here; fixing it is a manual SQL update.
 */
const LIVE_LEVELS = [
  ['מ"פ', 100],
  ['סמ"פ', 90],
  ['מש"ד', 85],
  ['רס"פ / לוגיסטיקה', 75],
  ['חובש פלוגתי', 70],
  ['מ"מ 1', 70],
  ['מ"מ 2', 70],
  ['מ"מ 3', 70],
  ['מ"מ 4', 70],
  ['מ"כ 1א', 50],
  ['מ"כ 2ב', 50],
  ['מ"כ 4ג', 50],
];

test('role levels match what users.permission_level holds in the database', () => {
  for (const [role, expected] of LIVE_LEVELS) {
    assert.equal(
      getPermissionLevelForRole(role), expected,
      `${role} should be ${expected} to match the stored permission_level`,
    );
  }
});

test('the geresh and the ASCII quote are the same role', () => {
  // Both spellings genuinely exist in the users table: "מ״מ 1" is stored with
  // U+05F4 and "מ\"מ 2" with an ASCII quote. A role that normalises wrong
  // falls through to 0 and silently loses every permission.
  assert.equal(normalizeRole('מ״מ 1'), normalizeRole('מ"מ 1'));
  assert.equal(getPermissionLevelForRole('מ״מ 1'), 70);
  assert.equal(getPermissionLevelForRole('מ״פ'), 100);
  assert.equal(getPermissionLevelForRole('סמ״פ'), 90);
  assert.equal(getPermissionLevelForRole('מש״ד'), 85);
  assert.equal(getPermissionLevelForRole('מ״כ 1א'), 50);
  // Curly quotes and stray whitespace turn up in pasted data too.
  assert.equal(getPermissionLevelForRole('  מ”פ  '), 100);
});

test('an unknown role gets nothing, never a default level', () => {
  for (const role of ['', null, undefined, 'לא קיים', 'admin', 'מפ']) {
    assert.equal(getPermissionLevelForRole(role), 0, `${role} must not receive a level`);
  }
  assert.equal(hasAdminAccess('לא קיים'), false);
  assert.equal(hasCompanyWideUiAccess('לא קיים', 0), false);
});

test('company-wide access is granted to exactly the roles that should have it', () => {
  for (const role of ['מ"פ', 'מ״פ', 'סמ"פ', 'מש"ד', 'מש״ד']) {
    assert.equal(hasCompanyWideUiAccess(role, 0), true, `${role} needs company-wide access`);
  }
  for (const role of ['מ"מ 1', 'מ"כ 1א', 'חובש פלוגתי', 'רס"פ / לוגיסטיקה', 'סמל 1']) {
    assert.equal(hasCompanyWideUiAccess(role, 0), false, `${role} must not see the whole company`);
  }
});

test('a stored level can grant company-wide access even if the role string is unknown', () => {
  // This is the escape hatch the UI relies on when a role is renamed in the DB
  // before the TS list catches up.
  assert.equal(hasCompanyWideUiAccess('תפקיד חדש', 90), true);
  assert.equal(hasCompanyWideUiAccess('תפקיד חדש', 89), false);
});

test('the deputy is an admin but is not the commander', () => {
  assert.equal(hasAdminAccess('סמ"פ'), true);
  assert.equal(isCompanyCommander('סמ"פ'), false, 'mentoring notes must stay commander-only');
  assert.equal(isCompanyCommander('מ"פ'), true);
  assert.equal(isCompanyCommander('מ״פ'), true);
});
