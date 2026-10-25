import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as permissions from '../src/lib/permissions.ts';

/**
 * The bug this guards: the dashboard brief said "תדריך מפקד" to everyone —
 * the medic and the driver included. The title now follows the signed-in
 * user's role, matched through normalizeRole so ״ and " compare equal.
 *
 * Recognition is an explicit list on purpose. getPermissionLevelForRole is
 * not a "known role" test: it returns 0 for סרס"פ, a real role in
 * public.roles.
 */
const COMMAND_AND_STAFF = ['מ״פ', 'סמ״פ', 'מש"ד', 'רס״פ / לוגיסטיקה', 'סרס"פ', 'חובש פלוגתי', 'קשר פלוגתי', 'ב.קוד / נהג'];
const PLATOON_COMMANDERS = [1, 2, 3, 4].map(n => `מ״מ ${n}`);
const SERGEANTS = [1, 2, 3, 4].map(n => `סמל ${n}`);
const SQUAD_COMMANDERS = [1, 2, 3, 4].flatMap(n => ['א', 'ב', 'ג'].map(squad => `מ״כ ${n}${squad}`));
const ALL_ROLES = [...COMMAND_AND_STAFF, ...PLATOON_COMMANDERS, ...SERGEANTS, ...SQUAD_COMMANDERS];

const asGershayim = (role) => role.replace(/"/g, '״');
const asStraight = (role) => role.replace(/״/g, '"');

test('there are exactly 28 real roles under test', () => {
  assert.equal(ALL_ROLES.length, 28);
  assert.equal(new Set(ALL_ROLES).size, 28);
});

test('every real role gets "תדריך <role>", whichever quote mark it was stored with', () => {
  assert.equal(typeof permissions.getCommandBriefTitle, 'function', 'getCommandBriefTitle must be exported');
  for (const role of ALL_ROLES) {
    const expected = `תדריך ${asGershayim(role)}`;
    assert.equal(permissions.getCommandBriefTitle(asStraight(role)), expected, `straight quotes: ${role}`);
    assert.equal(permissions.getCommandBriefTitle(asGershayim(role)), expected, `gershayim: ${role}`);
    assert.equal(permissions.getCommandBriefTitle(`  ${role} `), expected, `surrounding whitespace: ${role}`);
  }
});

test('spacing variants of a stored role resolve to the same title', () => {
  assert.equal(permissions.getCommandBriefTitle('רס"פ/לוגיסטיקה'), 'תדריך רס״פ / לוגיסטיקה');
  assert.equal(permissions.getCommandBriefTitle('ב.קוד/נהג'), 'תדריך ב.קוד / נהג');
  assert.equal(permissions.getCommandBriefTitle('מ"מ  2'), 'תדריך מ״מ 2');
});

test('only an empty or unknown role falls back to "תדריך יומי"', () => {
  assert.equal(typeof permissions.getCommandBriefTitle, 'function', 'getCommandBriefTitle must be exported');
  for (const role of [null, undefined, '', '   ', 'אורח', 'מפקד', 'מ"מ', 'admin', 'סמל אורח', 'מ"כ admin', 'מ"מ 9', 'מ"כ 1ד', 'מ"כ 5א']) {
    assert.equal(permissions.getCommandBriefTitle(role), 'תדריך יומי', `fallback for ${JSON.stringify(role)}`);
  }
});

test('the dashboard brief takes its title from the signed-in role, not a fixed "תדריך מפקד"', () => {
  const source = readFileSync(new URL('../src/app/(protected)/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /תדריך מפקד/, 'no hard-coded "תדריך מפקד" title may remain');
  assert.match(source, /import\s*\{[^}]*getCommandBriefTitle[^}]*\}\s*from\s*['"]@\/lib\/permissions['"]/s);
  assert.match(source, /const briefRole = profile\?\.role \?\? currentUser\?\.role;/, 'the role is the signed-in user\'s');
  assert.match(source, /buildCommandBrief\([^)]*,\s*briefRole\s*\)/, 'the call site passes the signed-in role');
  assert.match(source, /\[dashboardData, attentionItems, todayEvents, briefRole\]/, 'briefRole is a memo dependency, so the title updates when the profile loads');
});
