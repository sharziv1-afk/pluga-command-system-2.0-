import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAuditLog } from '../src/lib/audit.ts';
import {
  getPermissionLevelForRole,
  hasAdminAccess,
  hasCompanyWideUiAccess,
  isActiveApprovedProfile,
  normalizeRole,
} from '../src/lib/permissions.ts';
import { getScheduleDisplayStatus } from '../src/lib/schedule.ts';

test('schedule derives completed display state without changing persisted state', () => {
  const now = Date.parse('2026-07-31T12:00:00Z');
  const past = { status: 'scheduled', starts_at: '2026-07-31T09:00:00Z', ends_at: null };
  const future = { status: 'scheduled', starts_at: '2026-07-31T13:00:00Z', ends_at: null };
  const ongoing = { status: 'in_progress', starts_at: '2026-07-31T09:00:00Z', ends_at: '2026-07-31T13:00:00Z' };
  const cancelled = { status: 'cancelled', starts_at: '2026-07-31T09:00:00Z', ends_at: null };

  assert.equal(getScheduleDisplayStatus(past, now), 'completed');
  assert.equal(getScheduleDisplayStatus(future, now), 'scheduled');
  assert.equal(getScheduleDisplayStatus(ongoing, now), 'in_progress');
  assert.equal(getScheduleDisplayStatus(cancelled, now), 'cancelled');
  assert.equal(past.status, 'scheduled');
});

test('schedule loading contains no write or audit side effect', () => {
  const source = readFileSync('src/app/(protected)/schedule/page.tsx', 'utf8');
  const loadEvents = source.slice(source.indexOf('const loadEvents'), source.indexOf('useEffect(() =>', source.indexOf('const loadEvents')));

  assert.doesNotMatch(loadEvents, /\.update\s*\(/);
  assert.doesNotMatch(loadEvents, /createAuditLog/);
});

test('role normalization and existing UI capability rules share one truth table', () => {
  assert.equal(normalizeRole(' מ״פ '), 'מ"פ');
  assert.equal(normalizeRole('סמ“פ'), 'סמ"פ');
  assert.equal(getPermissionLevelForRole('ע. מ״פ'), 85);
  assert.equal(hasAdminAccess('ע. מ״פ'), false);
  assert.equal(hasCompanyWideUiAccess('ע. מ״פ'), true);
  assert.equal(hasCompanyWideUiAccess('מ״מ 1', 90), true);
  assert.equal(hasCompanyWideUiAccess('מ״מ 1', 70), false);
  assert.equal(isActiveApprovedProfile('active', 'approved'), true);
  assert.equal(isActiveApprovedProfile('pending', 'approved'), false);
});

test('operational pages do not refetch the current profile', () => {
  for (const page of ['dashboard', 'requests', 'tasks', 'schedule', 'forum']) {
    const source = readFileSync(`src/app/(protected)/${page}/page.tsx`, 'utf8');
    assert.doesNotMatch(source, /select\('id,name,email,role,unit_id,permission_level'\)/, page);
    assert.doesNotMatch(source, /setDbProfile/, page);
  }
});

test('event consumers reuse the derived schedule status', () => {
  for (const page of ['dashboard', 'requests', 'tasks']) {
    const source = readFileSync(`src/app/(protected)/${page}/page.tsx`, 'utf8');
    assert.match(source, /getScheduleDisplayStatus/, page);
  }
  const tasks = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
  assert.match(tasks, /select\('id,title,starts_at,ends_at,status'\)/);
});

test('forum clears reports before loading a different date', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const loader = source.slice(source.indexOf('const loadDailyReports'), source.indexOf('const loadOwnerOptions'));

  assert.match(loader, /loadedDailyScope\.current !== loadScope/);
  assert.match(loader, /setDailyReports\(\[\]\)/);
  assert.match(loader, /loadedDailyScope\.current = loadScope/);
});

test('row status mutations use a global guard and finally cleanup', () => {
  const cases = [
    ['requests', /if \(isRequestWritePending\) return;/, /finally \{\s*setUpdatingStatusId\(null\)/],
    ['tasks', /if \(!dbProfile \|\| isTaskWritePending/, /finally \{\s*setUpdatingTaskId\(null\)/],
    ['schedule', /if \(!dbProfile \|\| isEventWritePending/, /finally \{\s*setUpdatingEventId\(null\)/],
  ];

  for (const [page, guard, cleanup] of cases) {
    const source = readFileSync(`src/app/(protected)/${page}/page.tsx`, 'utf8');
    assert.match(source, guard, page);
    assert.match(source, cleanup, page);
  }
});

test('other scalar busy states also use global guards', () => {
  const requests = readFileSync('src/app/(protected)/requests/page.tsx', 'utf8');
  const tasks = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');

  assert.match(requests, /if \(!dbProfile \|\| isRequestWritePending/);
  assert.match(requests, /if \(loadingCommentsId\) return;/);
  assert.match(requests, /if \(!currentUser \|\| !dbProfile \|\| isRequestWritePending\) return;/);
  assert.match(tasks, /if \(!dbProfile \|\| isTaskWritePending/);
});

test('audit logging remains best-effort when the client throws', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  const supabase = {
    from: () => ({ insert: async () => { throw new Error('offline'); } }),
  };

  try {
    await assert.doesNotReject(createAuditLog(supabase, {
      userId: 'user-1',
      userName: 'Test',
      userRole: 'מ״פ',
      actionType: 'event_updated',
      entityType: 'event',
      entityId: 'event-1',
    }));
  } finally {
    console.warn = originalWarn;
  }
});
