import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  approvedEditIsValid,
  canEditEmail,
  canManageUser,
  canToggleBlock,
  isPlausibleEmail,
  nextBlockStatus,
  normalizeEmail,
} from '../src/lib/adminUserEdits.ts';

const commander = { id: 'mp', permission_level: 100, isCompanyCommander: true };
const deputy = { id: 'smp', permission_level: 90, isCompanyCommander: false };

test('the מ"פ manages everyone except their own row', () => {
  assert.equal(canManageUser(commander, { id: 'mm2', permission_level: 70 }), true);
  assert.equal(canManageUser(commander, { id: 'smp', permission_level: 90 }), true);
  assert.equal(canManageUser(commander, { id: 'mp', permission_level: 100 }), false);
});

test('the סמ"פ cannot touch the מ"פ, a peer, or their own row', () => {
  assert.equal(canManageUser(deputy, { id: 'mm2', permission_level: 70 }), true);
  assert.equal(canManageUser(deputy, { id: 'mp', permission_level: 100 }), false);
  assert.equal(canManageUser(deputy, { id: 'other-90', permission_level: 90 }), false);
  assert.equal(canManageUser(deputy, { id: 'smp', permission_level: 90 }), false);
});

test('email is editable only while no Auth account is linked', () => {
  assert.equal(canEditEmail({ auth_user_id: null }), true);
  assert.equal(canEditEmail({ auth_user_id: '5588ba9b-1ee2-475a-8e00-87bd5cebab6d' }), false);
  assert.equal(normalizeEmail('  MM2.Real@Example.COM '), 'mm2.real@example.com');
  assert.equal(isPlausibleEmail('mm2@example.com'), true);
  assert.equal(isPlausibleEmail('mm2@'), false);
  assert.equal(isPlausibleEmail('not an email'), false);
});

test('only approved accounts toggle between active and blocked', () => {
  assert.equal(canToggleBlock({ role_approval_status: 'approved', status: 'active' }), true);
  assert.equal(canToggleBlock({ role_approval_status: 'approved', status: 'blocked' }), true);
  assert.equal(canToggleBlock({ role_approval_status: 'pending', status: 'pending' }), false);
  assert.equal(canToggleBlock({ role_approval_status: 'rejected', status: 'inactive' }), false);
  assert.equal(nextBlockStatus('active'), 'blocked');
  assert.equal(nextBlockStatus('blocked'), 'active');
});

test('an approved user cannot be saved without a unit or with level 0', () => {
  const approved = { role_approval_status: 'approved' };
  assert.equal(approvedEditIsValid(approved, 'unit-2', 70), true);
  assert.equal(approvedEditIsValid(approved, null, 70), false);
  assert.equal(approvedEditIsValid(approved, 'unit-2', 0), false);
  assert.equal(approvedEditIsValid({ role_approval_status: 'pending' }, null, 0), true);
});

const admin = readFileSync('src/app/(protected)/admin/page.tsx', 'utf8');

test('/admin offers edit and block on approved users, gated by canManageUser', () => {
  const pastList = admin.slice(admin.indexOf('pastRequests.map((req) => {'));
  assert.match(pastList, /const manageable = canManageUser\(adminActor, req\)/);
  assert.match(pastList, /\{manageable && \(/);
  assert.match(pastList, /onClick=\{\(\) => startEditing\(req\)\}/);
  assert.match(pastList, /onClick=\{\(\) => setBlockTarget\(req\)\}/);
  assert.match(pastList, /renderEditor\(req\)/);
});

test('/admin writes email only for unlinked profiles and checks every write', () => {
  assert.match(admin, /const emailChanged = canEditEmail\(target\) && cleanEmail !== target\.email/);
  assert.match(admin, /\.\.\.\(emailChanged \? \{ email: cleanEmail \} : \{\}\)/);
  assert.match(admin, /error\.code === '23505'/);
  // Blocking flips users.status only; role_approval_status and the profile stay.
  assert.match(admin, /\.update\(\{ status: nextStatus, updated_at: new Date\(\)\.toISOString\(\) \}\)/);
  // PostgREST reports an RLS-filtered write as success with no rows.
  const writes = admin.match(/\.from\('users'\)\s*\.update\(/g) ?? [];
  const checked = admin.match(/didRowsUpdate\(updatedRows\)/g) ?? [];
  assert.ok(writes.length >= 4, 'approve, reject, edit, block');
  assert.equal(checked.length, writes.length);
});

test('/admin audits edits and block changes', () => {
  assert.match(admin, /actionType: 'user_updated'/);
  assert.match(admin, /actionType: nextStatus === 'blocked' \? 'user_blocked' : 'user_unblocked'/);
});
