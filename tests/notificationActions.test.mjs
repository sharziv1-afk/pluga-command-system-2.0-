import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MUTE_GROUPS,
  QUICK_ACTION_LABELS,
  UNMUTABLE_KINDS,
  actionsForKind,
  isQuickAction,
  notificationHref,
} from '../src/lib/notifications/actions.ts';

/**
 * Notifications, stages 4 and 5 (docs/NOTIFICATIONS.md). The database side
 * was checked in the sandbox (38 checks in rolled-back transactions,
 * 07.11.2026). These pin the decisions so an edit cannot drop them quietly.
 */

const m044 = readFileSync('supabase/migrations/044_notifications_actions.sql', 'utf8');
const m045 = readFileSync('supabase/migrations/045_notifications_stage5.sql', 'utf8');
const sw = readFileSync('public/sw.js', 'utf8');
const actionRoute = readFileSync('src/app/api/notifications/action/route.ts', 'utf8');
const dispatch = readFileSync('src/app/api/notifications/dispatch/route.ts', 'utf8');
const bar = readFileSync('src/components/layout/NotificationActionBar.tsx', 'utf8');
const layout = readFileSync('src/app/(protected)/layout.tsx', 'utf8');
const bell = readFileSync('src/components/layout/NotificationBell.tsx', 'utf8');

const fnBody = (sql, name) => {
  const start = sql.indexOf(`function public.${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return sql.slice(start, sql.indexOf('$$;', start));
};

test('a notification link carries the item id, so a tap opens the item itself', () => {
  assert.match(fnBody(m044, 'notify_user'), /v_url := v_url \|\| case when position\('\?' in v_url\) > 0 then '&' else '\?' end \|\| 'item=' \|\| p_entity_id;/);
  assert.equal(notificationHref('/tasks?item=abc', 'n1'), '/tasks?item=abc&n=n1');
  assert.equal(notificationHref('/forum', 'n1'), '/forum?n=n1');
  // Never another site.
  assert.equal(notificationHref('//evil.example', 'n1'), null);
  assert.equal(notificationHref('https://evil.example', 'n1'), null);
});

test('quick actions run under the user\'s own permissions, never as the database owner', () => {
  const body = fnBody(m044, 'notification_quick_action');
  assert.match(body, /security invoker/);
  assert.doesNotMatch(body, /security definer/);
  // Signed in through the site only: no OAuth (MCP) token, no anon.
  assert.match(body, /if v_me is null or public\.is_oauth_client_request\(\) then/);
  assert.match(m044, /revoke execute on function public\.notification_quick_action\(uuid, text\) from public, anon;/);
  // Only the user's own notification, and only an action that fits its kind.
  assert.match(body, /where id = p_notification and user_id = v_me;/);
  assert.match(body, /if not \(p_action = any \(public\.notification_actions_for\(v_n\.kind\)\)\) then/);
  // Written to the activity log and marked read.
  assert.match(body, /insert into public\.audit_logs/);
  assert.match(body, /'via', 'notification'/);
  assert.match(body, /update public\.notifications set read_at = now\(\) where id = v_n\.id and read_at is null;/);
  // Small, reversible changes only: nothing is deleted, closed or approved.
  assert.doesNotMatch(body, /\bdelete from\b/i);
  assert.doesNotMatch(body, /'approved'|'cancelled'::task_status|status = 'closed'/);
});

test('the app shows exactly the actions the database allows', () => {
  const mapping = fnBody(m044, 'notification_actions_for');
  const fromSql = {};
  for (const [, kind, list] of mapping.matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g)) {
    fromSql[kind] = [...list.matchAll(/'([a-z_]+)'/g)].map(([, action]) => action);
  }
  assert.ok(Object.keys(fromSql).length >= 10);
  for (const [kind, actions] of Object.entries(fromSql)) {
    assert.deepEqual(actionsForKind(kind), actions, kind);
  }
  assert.deepEqual(actionsForKind('task_blocked'), []);
  assert.deepEqual(actionsForKind('toString'), [], 'no prototype lookups');
  assert.equal(isQuickAction('constructor'), false);
  assert.equal(isQuickAction('task_done'), true);
  // The service worker's own list matches too.
  const swList = /const QUICK_ACTIONS = \[([^\]]*)\];/.exec(sw)?.[1];
  assert.deepEqual([...swList.matchAll(/'([a-z_]+)'/g)].map(([, a]) => a).sort(), Object.keys(QUICK_ACTION_LABELS).sort());
});

test('a phone button posts with the site session, same origin only, and falls back to opening the item', () => {
  assert.match(actionRoute, /if \(!origin \|\| origin !== request\.nextUrl\.origin\)/);
  assert.match(actionRoute, /rpc\('notification_quick_action'/);
  assert.doesNotMatch(actionRoute, /SERVICE_ROLE|service_role|DISPATCH_KEY/i);
  const click = sw.slice(sw.indexOf("addEventListener('notificationclick'"), sw.indexOf("addEventListener('fetch'"));
  assert.match(click, /fetch\('\/api\/notifications\/action', \{\s*method: 'POST',\s*credentials: 'same-origin'/);
  assert.match(click, /\.then\(\(response\) => \(response\.ok \? notifyWindows\(\) : openApp\(target\)\)\)\s*\.catch\(\(\) => openApp\(target\)\)/);
  // At most two buttons, as Android shows.
  assert.match(dispatch, /actionsForKind\(item\.kind\)\.slice\(0, 2\)/);
  assert.match(sw, /\.slice\(0, 2\)/);
});

test('the action bar sits above every page and the bell opens the item', () => {
  assert.match(layout, /<NotificationActionBar \/>\s*<PageTransition>\{children\}<\/PageTransition>/);
  assert.match(bar, /rpc\('notification_quick_action'/);
  assert.match(bell, /const href = notificationHref\(item\.url, item\.id\);/);
  for (const [file, attr] of [
    ['src/app/(protected)/tasks/page.tsx', 'data-item-id={task.id}'],
    ['src/app/(protected)/requests/page.tsx', 'data-item-id={request.id}'],
    ['src/components/gaps/GapsPanel.tsx', 'data-item-id={gap.id}'],
    ['src/components/mentoring/MentoringPanel.tsx', 'data-item-id={entry.id}'],
    ['src/app/(protected)/admin/page.tsx', 'data-item-id={req.id}'],
  ]) {
    assert.ok(readFileSync(file, 'utf8').includes(attr), file);
  }
});

test('stage 5: the new reminders and who they reach', () => {
  const task = fnBody(m045, 'notify_on_task_change');
  assert.match(task, /'task_cancelled', 'משימה בוטלה'/);
  assert.match(task, /'task_changed', 'יעד המשימה שונה'/);
  // A hand-over is "קיבלת משימה", not a change; and never about my own edit.
  assert.match(task, /new\.assigned_to is not distinct from old\.assigned_to\s*and new\.assigned_to is distinct from v_actor/);
  assert.match(m045, /after insert or update of assigned_to, status, due_at on public\.tasks/);

  const gap = fnBody(m045, 'notify_on_gap_change');
  assert.match(gap, /v_url text := '\/requests\?view=gaps';/, 'gaps live under the requests page');
  assert.match(gap, /new\.urgency in \('דחוף', 'קריטי'\)/);
  assert.match(gap, /'gap_assigned', 'פער הועבר לטיפולך'/);
  assert.match(m045, /p_kind in \('event_soon', 'task_soon', 'gap_urgent'\)/);
  // The weekend hold still comes first, for every kind (06.11.2026).
  const pushAfter = fnBody(m045, 'notification_push_after');
  assert.ok(pushAfter.indexOf("time '17:00'") < pushAfter.indexOf("'gap_urgent'"));

  const tick = fnBody(m045, 'notifications_tick');
  assert.match(tick, /'request_event_soon', 'דרישה למופע עוד לא אושרה'/);
  assert.match(tick, /e\.starts_at - interval '48 hours' <= p_now/);
  assert.match(tick, /'mentoring_overdue', 'בדיקת חניכה לא עודכנה'/);
  assert.match(tick, /m\.next_check_at = v_today - 2/);
  assert.match(tick, /'\/mentoring\?mentee=' \|\| rec\.mentee_user_id, 'mentoring_entry', rec\.id/);
  // 042's rules are all still there.
  for (const kind of ['event_reminder', 'task_today', 'task_soon', 'task_overdue', 'forum_reminder', 'forum_missing', 'forum_complete', 'mentoring_check']) {
    assert.ok(tick.includes(`'${kind}'`), kind);
  }
  assert.match(tick, /delete from public\.notifications/);
});

test('the admin page learns only who has push on, and only for מ״פ and סמ״פ', () => {
  const body = fnBody(m045, 'notification_push_users');
  assert.match(body, /returns setof uuid/);
  assert.match(body, /where public\.is_commander\(auth\.uid\(\)\)/);
  assert.doesNotMatch(body, /endpoint|p256dh|auth,/);
  assert.match(m045, /revoke execute on function public\.notification_push_users\(\) from public, anon;/);
});

test('every kind can be muted, except a task given to me', () => {
  const kinds = new Set();
  for (const file of ['039_notifications_instant.sql', '042_notifications_reminders.sql', '044_notifications_actions.sql', '045_notifications_stage5.sql']) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    for (const [, kind] of sql.matchAll(/notify_user\([^,]+,\s*'([a-z_]+)'/g)) kinds.add(kind);
  }
  kinds.add('event_reminder');
  kinds.add('event_soon');
  const grouped = MUTE_GROUPS.flatMap(group => group.kinds);
  for (const kind of kinds) {
    if (UNMUTABLE_KINDS.includes(kind)) {
      assert.ok(!grouped.includes(kind), `${kind} must not be mutable`);
    } else {
      assert.ok(grouped.includes(kind), `${kind} has no mute switch`);
    }
  }
  assert.equal(new Set(grouped).size, grouped.length, 'each kind in one group');
});

test('the mute switch knob stays visible in dark mode', () => {
  const mute = readFileSync('src/components/profile/NotificationMuteSettings.tsx', 'utf8');
  // globals.css repaints any class containing bg-white as translucent in dark mode.
  assert.doesNotMatch(mute, /bg-white/);
  assert.match(mute, /bg-\[#ffffff\]/);
});
