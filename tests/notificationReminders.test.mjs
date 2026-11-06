import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Notifications, stage 3 (migration 042, decided 06.11.2026). The tick was
 * run in the sandbox at simulated times — events, tasks, forum, mentoring,
 * cleanup, pause, one poke per tick — all as expected. These pin the
 * decisions.
 */

const migration = readFileSync('supabase/migrations/042_notifications_reminders.sql', 'utf8');
const bar = readFileSync('src/components/forum/ForumDeadlineBar.tsx', 'utf8');
const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
const tick = migration.slice(migration.indexOf('function public.notifications_tick('));

test('runs every minute, and can be paused', () => {
  assert.match(migration, /cron\.schedule\('notifications-tick', '\* \* \* \* \*', 'select public\.notifications_tick\(\)'\)/);
  assert.match(tick, /key = 'reminders_paused' and value = 'true'/);
});

test('events: 24 hours, 1 hour and 5 minutes before; nothing for audience none without a responsible', () => {
  assert.match(tick, /\(interval '24 hours', '24h', 'event_reminder'\)/);
  assert.match(tick, /\(interval '1 hour', '1h', 'event_soon'\)/);
  assert.match(tick, /\(interval '5 minutes', '5m', 'event_soon'\)/);
  assert.match(tick, /and \(e\.notify_audience <> 'none' or e\.responsible_user_id is not null\)/);
});

test('tasks: 07:00 digest, 5 minutes before, once when overdue — no morning brief', () => {
  assert.match(tick, /v_local >= time '07:00' and v_local < time '07:10'/);
  assert.match(tick, /'יש לך ' \|\| rec\.n \|\| ' משימות להיום'/);
  assert.match(tick, /'task_soon', 'עוד 5 דקות ליעד המשימה'/);
  assert.match(tick, /'task_overdue', 'משימה באיחור'/);
  assert.doesNotMatch(migration, /morning_brief|תדריך הבוקר/);
});

test('forum: an hour before the day\'s deadline (default 20:00), missing list at it, complete note', () => {
  assert.match(tick, /coalesce\(\(select deadline from public\.forum_deadlines where report_date = v_today\), time '20:00'\)/);
  assert.match(tick, /p_now >= v_deadline - interval '1 hour' and p_now < v_deadline/);
  assert.match(tick, /'forum_missing', 'חסרים דוחות בפורום המוביל', 'חסרים: ' \|\| v_missing/);
  assert.match(migration, /r\.status in \('submitted', 'closed'\)/);
});

test('cleanup: read after 7 days, anything after 30', () => {
  assert.match(tick, /\(read_at is not null and read_at < p_now - interval '7 days'\)\s*or created_at < p_now - interval '30 days'/);
});

test('the 1-hour and 5-minute reminders skip quiet hours; the rest keep them', () => {
  assert.match(migration, /if v_hour between 6 and 22 or p_kind in \('event_soon', 'task_soon'\) then/);
});

test('one poke per tick, not one per notification', () => {
  assert.match(migration, /if current_setting\('app\.notifications_tick', true\) = 'on' then\s*return null;/);
  assert.match(tick, /perform set_config\('app\.notifications_tick', 'on', true\);/);
});

test('only מ״פ and סמ״פ set the deadline, never through MCP', () => {
  assert.match(migration, /public\.notification_role_key\(u\.role\) in \('מ"פ', 'סמ"פ'\)/);
  assert.match(migration, /create policy "oauth: no insert" on public\.forum_deadlines/);
  assert.match(forum, /<ForumDeadlineBar date=\{selectedDate\} canEdit=\{hasAdminAccess\(dbProfile\?\.role \?\? currentUser\?\.role\)\} \/>/);
  assert.match(bar, /export const DEFAULT_FORUM_DEADLINE = '20:00';/);
});
