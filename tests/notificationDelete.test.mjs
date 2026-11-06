import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Deleting from the bell (migration 041, 06.11.2026). Checked in the
 * sandbox: a user deletes only their own notifications; another user, an
 * OAuth (MCP) token and anon cannot; the task a notification pointed at stays.
 */

const migration = readFileSync('supabase/migrations/041_notifications_delete_own.sql', 'utf8');
const bell = readFileSync('src/components/layout/NotificationBell.tsx', 'utf8');

test('a user may delete only their own notifications, never through MCP', () => {
  assert.match(migration, /grant delete on public\.notifications to authenticated;/);
  assert.match(migration, /for delete to authenticated\s*using \( user_id = public\.current_app_user_id\(\) \)/);
  assert.match(migration, /as restrictive for delete to authenticated\s*using \(not public\.is_oauth_client_request\(\)\)/);
  assert.doesNotMatch(migration, /to anon/);
});

test('the bell deletes one notification, or all of them after a second tap', () => {
  assert.match(bell, /aria-label=\{`מחק התראה: \$\{item\.title\}`\}/);
  assert.match(bell, /\.eq\('user_id', currentUser\.id\)/);
  assert.match(bell, /if \(!confirmClear\) \{\s*setConfirmClear\(true\);\s*return;\s*\}/);
  // The notification table only — never the task, event or request behind it.
  const deleteFn = bell.slice(bell.indexOf('const deleteItems'), bell.indexOf('const closePanel'));
  assert.doesNotMatch(deleteFn, /from\('(tasks|events|requests|gaps)'\)/);
});
