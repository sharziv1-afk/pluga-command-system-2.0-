import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getCommandBriefTitle,
  getPermissionLevelForRole,
  hasAdminAccess,
  hasCompanyWideUiAccess,
} from '../src/lib/permissions.ts';

/**
 * Roles added to the roster on 25.10.2026 (א.קוד, ע. חובש פלוגתי, סרס״פ א׳/ב׳),
 * as stored in public.roles with permission_level 60 / 60 / 70 / 70.
 */
const NEW_ROLES = [
  ['א.קוד', 60, 'תדריך א.קוד'],
  ['ע. חובש פלוגתי', 60, 'תדריך ע. חובש פלוגתי'],
  ['סרס״פ א׳', 70, 'תדריך סרס״פ א׳'],
  ['סרס״פ ב׳', 70, 'תדריך סרס״פ ב׳'],
];

test('the new roles get their own brief title, with the geresh kept as a geresh', () => {
  for (const [role, , title] of NEW_ROLES) {
    assert.equal(getCommandBriefTitle(role), title, role);
  }
  // Existing titles are unchanged.
  assert.equal(getCommandBriefTitle('רס"פ / לוגיסטיקה'), 'תדריך רס״פ / לוגיסטיקה');
  assert.equal(getCommandBriefTitle('סרס"פ'), 'תדריך סרס״פ');
});

test('the new roles match their stored level and get no company-wide or admin access', () => {
  for (const [role, level] of NEW_ROLES) {
    assert.equal(getPermissionLevelForRole(role), level, role);
    assert.equal(hasCompanyWideUiAccess(role, level), false, `${role} must not see the whole company`);
    assert.equal(hasAdminAccess(role), false, `${role} must not reach /admin`);
  }
});

test('in the forum, a deputy never owns the slot of the role inside its title', () => {
  const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const fn = forum.slice(forum.indexOf('function inferStaffRole'), forum.indexOf('function getJerusalemDateString'));
  assert.match(fn, /if \(normalizedRole\.startsWith\('סרס"פ'\) \|\| \/\^ע\\\.\\s\*חובש\/\.test\(normalizedRole\)\) return null;/);
  // Run the real function on the real hint table.
  const hints = forum.slice(forum.indexOf('const staffNodes'), forum.indexOf('];', forum.indexOf('const staffNodes')) + 2);
  const normalizeRole = (role) => (role ?? '').trim().replace(/[״׳"'´“”‘’]/g, '"');
  const staffNodes = new Function(`${hints.replace(/: Array<[^>]+>/, '')}; return staffNodes;`)();
  const inferStaffRole = new Function('normalizeRole', 'staffNodes', `${fn.replace(/\(role: string\): StaffRole \| null/, '(role)')}; return inferStaffRole;`)(normalizeRole, staffNodes);
  assert.equal(inferStaffRole('סרס״פ א׳'), null);
  assert.equal(inferStaffRole('סרס"פ'), null);
  assert.equal(inferStaffRole('ע. חובש פלוגתי'), null);
  assert.equal(inferStaffRole('רס״פ / לוגיסטיקה'), 'logistics_nco');
  assert.equal(inferStaffRole('חובש פלוגתי'), 'medic');
  assert.equal(inferStaffRole('מש"ד'), 'assistant_commander');
  assert.equal(inferStaffRole('סמ״פ'), 'deputy_commander');
});
