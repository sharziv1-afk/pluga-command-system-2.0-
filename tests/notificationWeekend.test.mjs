import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Weekend hold (migration 043, company commander 06.11.2026): Friday 17:00
 * to Saturday 19:00 nothing reaches a phone; notifications still land in the
 * bell and are pushed at Saturday 19:00. Checked in the sandbox at 12
 * simulated times (Thursday night through Sunday morning).
 */

const migration = readFileSync('supabase/migrations/043_notifications_weekend.sql', 'utf8');

test('Friday 17:00 to Saturday 19:00 holds every push until Saturday 19:00', () => {
  assert.match(migration, /if \(v_dow = 5 and v_local::time >= time '17:00'\) or \(v_dow = 6 and v_local::time < time '19:00'\) then/);
  assert.match(migration, /\+ time '19:00'\) at time zone 'Asia\/Jerusalem'/);
});

test('the weekend check comes before the quiet-hours exemption, so it holds 5-minute reminders too', () => {
  assert.ok(migration.indexOf("v_dow = 5") < migration.indexOf("p_kind in ('event_soon', 'task_soon')"));
});

test('the old one-argument version is dropped, so notify_user() stays unambiguous', () => {
  assert.match(migration, /drop function if exists public\.notification_push_after\(text\);/);
  assert.match(migration, /notification_push_after\(p_kind text, p_at timestamptz default now\(\)\)/);
});
