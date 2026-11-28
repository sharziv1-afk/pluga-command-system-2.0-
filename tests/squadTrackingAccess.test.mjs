import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * מ״פ, 28.11.2026: the squad commanders run tracking for their platoon.
 * Migration 050 lets a מ״כ mark cells for their own platoon's soldiers, as a
 * מ״מ already could. Verified in the sandbox in one rolled-back transaction,
 * 9/9: the מ״כ inserts and updates a cell in their platoon; another
 * platoon's cell, adding a soldier and adding an item are refused; the מ״מ
 * is unchanged; a pending מ״כ and a medic are refused.
 */

const sql = readFileSync('supabase/migrations/050_squad_commanders_edit_tracking.sql', 'utf8');

test('050: a מ״כ edits tracking for their own platoon only', () => {
  assert.match(sql, /create or replace function public\.can_edit_tracking_unit\(target_unit_id uuid\)/);
  assert.match(sql, /\(v_normalized_role like U&'\\05DE"\\05DE%' or v_normalized_role like U&'\\05DE"\\05DB%'\)\s+and coalesce\(v_commanded_unit_id, v_unit_id\) = target_unit_id;/);
  assert.match(sql, /if v_status <> 'active' or v_approval <> 'approved' then\s+return false;/);
  assert.match(sql, /security definer\s+set search_path = public/);
  assert.match(sql, /revoke execute on function public\.can_edit_tracking_unit\(uuid\) from anon;/);
  assert.doesNotMatch(sql, /create policy|drop policy|alter table/i, 'no policy or table change: soldiers, items and weeks stay as they were');
});
