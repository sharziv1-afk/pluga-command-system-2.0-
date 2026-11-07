import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Notifications, stage 2 (docs/NOTIFICATIONS.md). The trigger behavior was
 * checked in the sandbox (25 checks in rolled-back transactions,
 * 06.11.2026). These pin the decisions so an edit cannot drop them quietly.
 */

const migration = readFileSync('supabase/migrations/039_notifications_instant.sql', 'utf8');
const dispatch = readFileSync('src/app/api/notifications/dispatch/route.ts', 'utf8');
const schedule = readFileSync('src/app/(protected)/schedule/page.tsx', 'utf8');
const mcpWrites = readFileSync('src/lib/mcp/writes.ts', 'utf8');

const producers = ['notify_on_task_change', 'notify_on_event_change', 'notify_on_request_change', 'notify_on_gap_change', 'notify_on_user_pending'];

const body = (name) => migration.slice(migration.indexOf(`function public.${name}()`), migration.indexOf('$$;', migration.indexOf(`function public.${name}()`)));

test('a write without a signed-in user (SQL import) notifies nobody', () => {
  for (const name of producers) {
    assert.match(body(name), /if auth\.uid\(\) is null/, `${name} must skip writes with no session`);
  }
});

test('nobody is notified about their own action, except a personal task', () => {
  const task = body('notify_on_task_change');
  // Decided by the company commander on 06.11.2026.
  assert.match(task, /and \(new\.assigned_to is distinct from v_actor or new\.created_by = v_actor\)/);
  assert.match(task, /when new\.assigned_to = new\.created_by then 'משימה אישית חדשה'/);
  assert.match(task, /new\.created_by is distinct from v_actor/);
  for (const name of ['notify_on_event_change', 'notify_on_request_change']) {
    assert.match(body(name), /is distinct from v_actor/);
  }
});

test('texts are one short sentence plus the item name, with no dates (06.11.2026)', () => {
  assert.doesNotMatch(migration, /notification_when|to_char\(new\.(starts_at|due_at)[^)]*'DD/);
  assert.match(migration, /else 'קיבלת משימה מ־' \|\| coalesce\(v_actor_name, 'המערכת'\) end,\s*new\.title,/);
  assert.match(migration, /'event_invite', 'נקבע מופע חדש', new\.title,/);
  assert.match(migration, /'request_assigned', 'קיבלת דרישה מ־' \|\| coalesce\(v_requester_name, 'המערכת'\),\s*new\.title,/);
});

test('events notify nobody unless someone chose an audience', () => {
  assert.match(migration, /add column if not exists notify_audience text not null default 'none'/);
  assert.match(migration, /check \(notify_audience in \('none', 'responsible', 'unit', 'forum', 'custom'\)\)/);
  assert.match(migration, /'מ"פ', 'סמ"פ', 'מ"מ 1', 'מ"מ 2', 'מ"מ 3', 'מ"מ 4', 'מש"ד', 'רס"פ \/ לוגיסטיקה', 'חובש פלוגתי'/);
});

test('only the dispatch key can read pending pushes, and clients cannot write notifications', () => {
  for (const fn of ['claim_pending_pushes', 'record_push_results']) {
    const fnBody = migration.slice(migration.indexOf(`function public.${fn}(`));
    assert.match(fnBody.slice(0, 400), /if not public\.notification_dispatch_key_ok\(p_key\) then/);
  }
  assert.match(migration, /key_hash = encode\(sha256\(convert_to\(p_key, 'UTF8'\)\), 'hex'\)/);
  assert.match(migration, /revoke all on public\.notification_dispatch_keys from anon, authenticated;/);
  assert.match(migration, /revoke execute on function public\.notify_user\(uuid, text, text, text, text, text, uuid, text\) from public, anon, authenticated;/);
  // Claimed and marked in one step: two pokes never send twice.
  assert.match(migration, /for update skip locked/);
});

test('the database pokes with an empty body and never fails the user\'s write over it', () => {
  const poke = body('notifications_poke_dispatch');
  assert.match(poke, /net\.http_post\(url := v_url, body := '\{\}'::jsonb/);
  assert.match(poke, /exception when others then/);
});

test('the dispatcher uses the dispatch key, never a service-role key', () => {
  assert.doesNotMatch(dispatch, /SERVICE_ROLE|service_role/i);
  assert.match(dispatch, /process\.env\.NOTIFICATIONS_DISPATCH_KEY/);
  assert.match(dispatch, /rpc\('claim_pending_pushes'/);
  assert.match(dispatch, /rpc\('record_push_results'/);
});

test('the schedule form saves who an event notifies, and a link opens the event\'s day', () => {
  assert.match(schedule, /notify_audience,notify_user_ids/);
  assert.equal(schedule.match(/<EventAudienceField/g)?.length, 2, 'create and edit forms');
  assert.match(schedule, /notifyAudience === 'custom' && notifyUserIds\.length === 0/);
  assert.match(schedule, /const dateParam = params\.get\('date'\);/);
  // Stage 4: the event itself opens, too.
  assert.match(schedule, /setFocusEventId\(uuidParam\(params, 'item'\)\)/);
});

test('Claude / ChatGPT create events with no notification unless asked', () => {
  assert.match(mcpWrites, /const notify = args\.notify \?\? 'none';/);
  assert.match(mcpWrites, /notify_audience: notify,/);
});
