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
import {
  canTransitionDraft,
  dailyDraftScopeKey,
  isDraftDirty,
  isLatestDailyLoad,
  nextDraftBaseline,
  shouldHydrateDraft,
} from '../src/lib/forum/draftProtection.ts';

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

test('profile refresh keeps protected pages mounted and reloads operational data once', () => {
  const context = readFileSync('src/lib/context/AppContext.tsx', 'utf8');
  assert.match(context, /const loadCurrentProfile = async \(preserveReadyState = false\)/);
  assert.match(context, /if \(!preserveReadyState\) \{\s*setCurrentUser\(null\);\s*setAuthStatus\('loading'\)/);
  assert.match(context, /refreshProfileRef\.current = \(\) => loadCurrentProfile\(true\)/);

  for (const page of ['schedule', 'requests', 'tasks', 'forum']) {
    const source = readFileSync(`src/app/(protected)/${page}/page.tsx`, 'utf8');
    assert.match(source, /onClick=\{\(\) => void refreshProfile\(\)\}/, page);
  }

  for (const page of ['schedule', 'requests', 'tasks']) {
    const source = readFileSync(`src/app/(protected)/${page}/page.tsx`, 'utf8');
    assert.match(source, /\[isContextLoading, currentUser\]/, page);
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

test('forum protects draft hydration and clears reports only after an approved scope change', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const loader = source.slice(source.indexOf('const loadDailyReports'), source.indexOf('const loadOwnerOptions'));

  assert.match(loader, /loadedDailyScope\.current = loadScope/);
  assert.doesNotMatch(loader, /setReportDraft/);
  assert.match(source, /if \(!requestDailyScopeTransition\(nextScope\)\) return false;/);
  assert.match(source, /setDailyReports\(\[\]\)/);
});

test('forum daily draft protection handles hydration, transitions, saves, and stale loads', () => {
  const fields = ['notes', 'summary'];
  const baseline = { notes: 'server', summary: '' };
  const dirtyDraft = { notes: 'local', summary: '' };
  const cleanDraft = { ...baseline };
  const scope = dailyDraftScopeKey({
    date: '2026-08-01',
    profileId: 'profile-1',
    nodeId: 'own-report',
    ownerId: 'profile-1',
    reportLevel: 'squad',
  });
  const nextScope = dailyDraftScopeKey({
    date: '2026-08-02',
    profileId: 'profile-1',
    nodeId: 'own-report',
    ownerId: 'profile-1',
    reportLevel: 'squad',
  });

  assert.equal(isDraftDirty(dirtyDraft, baseline, fields), true);
  assert.equal(shouldHydrateDraft(isDraftDirty(dirtyDraft, baseline, fields)), false);
  assert.equal(shouldHydrateDraft(isDraftDirty(cleanDraft, baseline, fields)), true);

  let confirmCalls = 0;
  assert.equal(canTransitionDraft(scope, nextScope, true, () => {
    confirmCalls += 1;
    return false;
  }), false);
  assert.equal(canTransitionDraft(scope, nextScope, true, () => {
    confirmCalls += 1;
    return true;
  }), true);
  assert.equal(confirmCalls, 2);

  const savedBaseline = nextDraftBaseline(baseline, dirtyDraft, true, fields);
  assert.equal(isDraftDirty(dirtyDraft, savedBaseline, fields), false);
  const failedBaseline = nextDraftBaseline(baseline, dirtyDraft, false, fields);
  assert.equal(isDraftDirty(dirtyDraft, failedBaseline, fields), true);

  assert.equal(isLatestDailyLoad(4, 5), false);
  assert.equal(isLatestDailyLoad(5, 5), true);

  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const saveFlow = source.slice(source.indexOf('const saveSelectedReport'), source.indexOf('const submitSelectedReport'));
  const submitFlow = source.slice(source.indexOf('const submitSelectedReport'), source.indexOf('const carryForwardClosedReport'));
  const transitionFlow = source.slice(source.indexOf('const requestDailyScopeTransition'), source.indexOf('const transitionDailyDate'));
  const hydrationFlow = source.slice(source.indexOf('useEffect(() => {\n    if (activeTab !== \'daily\''), source.indexOf('// Hydrate the company-report editor meta'));
  for (const flow of [saveFlow, submitFlow]) {
    const beforeFinally = flow.slice(0, flow.indexOf('} finally {'));
    assert.match(flow, /dailySaveInFlight\.current = true;\s*setIsDailySaving\(true\);[\s\S]*?try \{/);
    assert.match(flow, /catch \([^)]*Error\) \{[\s\S]*?logSupabaseError\([\s\S]*?recordDailyDraftSave\([^,]+, false\);/);
    assert.match(flow, /finally \{\s*dailySaveInFlight\.current = false;\s*setIsDailySaving\(false\);\s*\}/);
    assert.doesNotMatch(beforeFinally, /dailySaveInFlight\.current = false|setIsDailySaving\(false\)/);
  }
  assert.match(transitionFlow, /if \(dailySaveInFlight\.current\) return false;/);
  assert.match(hydrationFlow, /selectedReport\?\.content\.company_report_manually_edited === true/);
});

test('forum daily save lifecycle unlocks after success, returned errors, and exceptions', async () => {
  const fields = ['notes'];
  const baseline = { notes: 'server' };
  const draft = { notes: 'local' };

  const runMutation = async (mutation, refresh = async () => undefined) => {
    let locked = true;
    let loading = true;
    let savedBaseline = baseline;

    try {
      const { error } = await mutation();
      if (error) {
        savedBaseline = nextDraftBaseline(savedBaseline, draft, false, fields);
      } else {
        savedBaseline = nextDraftBaseline(savedBaseline, draft, true, fields);
        try {
          await refresh();
        } catch {
          // Persistence already succeeded, so a refresh failure must not dirty the baseline.
        }
      }
    } catch {
      savedBaseline = nextDraftBaseline(savedBaseline, draft, false, fields);
    } finally {
      locked = false;
      loading = false;
    }

    return {
      dirty: isDraftDirty(draft, savedBaseline, fields),
      loading,
      locked,
    };
  };

  const saved = await runMutation(async () => ({ error: null }));
  assert.deepEqual(saved, { dirty: false, loading: false, locked: false });

  const returnedError = await runMutation(async () => ({ error: new Error('denied') }));
  assert.deepEqual(returnedError, { dirty: true, loading: false, locked: false });

  const saveException = await runMutation(async () => { throw new Error('offline'); });
  assert.deepEqual(saveException, { dirty: true, loading: false, locked: false });

  const submitException = await runMutation(async () => { throw new Error('offline'); });
  assert.equal(submitException.locked, false);

  const refreshException = await runMutation(
    async () => ({ error: null }),
    async () => { throw new Error('refresh offline'); },
  );
  assert.deepEqual(refreshException, { dirty: false, loading: false, locked: false });

  let attempts = 0;
  await runMutation(async () => {
    attempts += 1;
    throw new Error('first attempt failed');
  });
  const retry = await runMutation(async () => {
    attempts += 1;
    return { error: null };
  });
  assert.equal(attempts, 2);
  assert.equal(retry.dirty, false);

  const scope = '2026-08-01|owner-1';
  const nextScope = '2026-08-02|owner-1';
  assert.equal(saveException.locked || !canTransitionDraft(scope, nextScope, saveException.dirty, () => true), false);
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
