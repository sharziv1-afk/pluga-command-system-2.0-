import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * מ״פ, 24.11.2026:
 * 1. The forum report bar had too many buttons, and "אפס דוח" — wipe the
 *    report — sat right next to "הגש לדרג הבא". It is gone; one button per
 *    action, shown only when the report's status allows it.
 * 2. A מ״מ may add tracking items (any week, company-wide too) and edit or
 *    remove the ones they added (migration 049). Verified in the sandbox in
 *    one rolled-back transaction, 10/10: the מ״מ adds, edits and removes
 *    their own item; adding in another's name, editing another's item,
 *    handing their item to someone else and opening a week are refused
 *    (42501 / 0 rows); a מ״כ cannot add; the מ״פ still edits and adds.
 */

const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');

test('forum: "אפס דוח" and everything behind it are gone', () => {
  assert.doesNotMatch(forum, /אפס דוח/);
  assert.doesNotMatch(forum, /resetSelectedReport|confirmResetSelectedReport|reportPendingReset|canResetSelectedReport/);
  assert.doesNotMatch(forum, /היררכיית המחלקות המלאה תוצג כאן/, 'the stale placeholder line is gone');
  assert.match(forum, /מחק דוח/, 'deleting stays, apart, under פעולות מתקדמות');
});

test('forum: one close button, and buttons appear only when they apply', () => {
  const bar = forum.slice(forum.indexOf("{selectedReport?.status === 'closed' && ("), forum.indexOf('{canDeleteSelectedReport && ('));
  assert.equal((bar.match(/closeSelectedReport\(\)/g) ?? []).length, 1, '"סגור" and "אשר ושחרר" were the same action');
  assert.match(bar, /\{selectedReport\.status === 'submitted' \? 'אשר ושחרר' : 'סגור'\}/);
  assert.match(bar, /selectedReport\.status !== 'closed' && selectedReport\.status !== 'submitted' && \(\s*<GlossyButton variant="slate" onClick=\{\(\) => void submitSelectedReport\(\)\}/, 'no "הגש" on a report already submitted');
  assert.match(bar, /canSeeAll && selectedReport\.status === 'submitted' && \(\s*<GlossyButton variant="slate" onClick=\{\(\) => void returnSelectedReport\(\)\}/);
  assert.doesNotMatch(bar, /disabled=\{isDailySaving \|\| selectedReport\?\.status !== 'submitted'\}/, 'no greyed-out look-alikes');
});

test('migration 049: a מ״מ adds tracking items and edits only their own', () => {
  const sql = readFileSync('supabase/migrations/049_platoon_commanders_add_tracking_items.sql', 'utf8');
  assert.match(sql, /create or replace function public\.is_platoon_commander\(auth_id uuid\)/);
  assert.match(sql, /u\.status = 'active'\s+and u\.role_approval_status = 'approved'/);
  assert.match(sql, /like U&'\\05DE"\\05DE%'/, 'role מ"מ, any quote variant');
  assert.match(sql, /create policy "tracking_items: platoon commander insert"\s+on public\.tracking_items for insert to authenticated\s+with check \(\s+public\.is_platoon_commander\(\(select auth\.uid\(\)\)\)\s+and created_by = public\.current_app_user_id\(\)/);
  assert.match(sql, /create policy "tracking_items: platoon commander update own"[\s\S]*using \(\s+public\.is_platoon_commander[\s\S]*created_by = public\.current_app_user_id\(\)\s+\)\s+with check/);
  assert.doesNotMatch(sql, /tracking_weeks|tracking_records|soldiers|drop table|alter table/i, 'weeks, cells and soldiers are untouched');
  assert.match(sql, /revoke execute on function public\.is_platoon_commander\(uuid\) from anon;/);
});

test('the tracking page and the MCP tool say who may add items', () => {
  const page = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
  assert.match(page, /\.insert\(\{ \.\.\.fields, created_by: currentUserId \}\)/, 'the item insert records its creator, which 049 checks');
  assert.match(page, /מ״מ יכול לערוך רק מופע שהוא הוסיף/);
  const mcp = readFileSync('src/lib/mcp/writesMore.ts', 'utf8');
  assert.match(mcp, /platoon commanders \(מ״מ\)/);
  assert.match(mcp, /created_by: c\.profile\.id,/);
});
