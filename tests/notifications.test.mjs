import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Notifications, stage 1 (docs/NOTIFICATIONS.md). The behavior was checked
 * live in the sandbox (26 checks, one rolled-back transaction, 05.11.2026);
 * these pin the rules that keep it safe so a later edit cannot drop them
 * quietly.
 */

const sw = readFileSync('public/sw.js', 'utf8');
const migration = readFileSync('supabase/migrations/038_notifications.sql', 'utf8');
const route = readFileSync('src/app/api/notifications/send-test/route.ts', 'utf8');

test('every push shows a notification (iOS revokes permission otherwise)', () => {
  const push = sw.slice(sw.indexOf("addEventListener('push'"), sw.indexOf("addEventListener('notificationclick'"));
  assert.match(push, /event\.waitUntil\(/);
  assert.match(push, /self\.registration\.showNotification\(/);
  // A payload that is not JSON still shows something rather than nothing.
  assert.match(push, /catch \{\s*data = \{ body:/);
});

test('a notification only ever opens a path inside the app', () => {
  assert.match(sw, /const safeAppPath = \(value\) =>\s*typeof value === 'string' && \/\^\\\/\[\^\/\\\\\]\/\.test\(value\)/);
  const click = sw.slice(sw.indexOf("addEventListener('notificationclick'"), sw.indexOf("addEventListener('fetch'"));
  assert.match(click, /safeAppPath\(/);
  assert.match(click, /new URL\(safeAppPath\([^)]*\), self\.location\.origin\)/);
  // The database refuses anything else too.
  assert.match(migration, /url ~ '\^\/\[\^\/\\\\\]'/);
});

test('clients read their own notifications and can only mark them read', () => {
  assert.match(migration, /alter table public\.notifications enable row level security;/);
  assert.match(migration, /revoke insert, update, delete on public\.notifications from anon, authenticated;/);
  assert.match(migration, /grant update \(read_at\) on public\.notifications to authenticated;/);
  for (const table of ['notifications', 'push_subscriptions', 'notification_preferences']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`create policy "oauth: no (update|delete|insert)" on public\\.${table}`), `${table} must block OAuth (MCP) writes`);
  }
});

test('devices register only through the RPC, which refuses MCP tokens and inactive users', () => {
  assert.match(migration, /revoke insert, update on public\.push_subscriptions from anon, authenticated;/);
  const register = migration.slice(migration.indexOf('function public.register_push_subscription'), migration.indexOf('notification_preferences\n'));
  assert.match(register, /security definer/);
  assert.match(register, /v_user is null or public\.is_oauth_client_request\(\)/);
  assert.match(register, /on conflict \(endpoint\) do update/);
  assert.match(register, /limit 10/);
});

test('the test send runs under the caller\'s own token, never a service key', () => {
  assert.doesNotMatch(route, /SERVICE_ROLE|service_role/i);
  assert.match(route, /Authorization: `Bearer \$\{token\}`/);
  assert.match(route, /rpc\('send_test_notification'\)/);
  // Dead endpoints are dropped so they are not retried forever.
  assert.match(route, /if \(result\.gone\) await supabase\.from\('push_subscriptions'\)\.delete\(\)/);
});

test('the VAPID private key is server-only', () => {
  const client = readFileSync('src/lib/push/client.ts', 'utf8');
  assert.doesNotMatch(client, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(readFileSync('src/components/layout/NotificationBell.tsx', 'utf8'), /VAPID/);
  assert.match(readFileSync('src/lib/push/vapid.ts', 'utf8'), /process\.env\.VAPID_PRIVATE_KEY/);
});
