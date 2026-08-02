import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isAmbiguousMutationFailure,
  runWithInFlightLock,
} from '../src/lib/inFlightLock.ts';

test('mutation responses without an HTTP status are treated as ambiguous', () => {
  assert.equal(isAmbiguousMutationFailure(0), true);
  assert.equal(isAmbiguousMutationFailure(undefined), true);
  assert.equal(isAmbiguousMutationFailure(403), false);
});

test('in-flight lock suppresses duplicate work and releases after success', async () => {
  const lock = { current: false };
  const busyStates = [];
  let finishFirst;

  const firstAttempt = runWithInFlightLock(lock, value => busyStates.push(value), () => new Promise(resolve => {
    finishFirst = resolve;
  }));

  assert.equal(lock.current, true);
  assert.equal(await runWithInFlightLock(lock, value => busyStates.push(value), async () => {}), false);

  finishFirst();
  assert.equal(await firstAttempt, true);
  assert.equal(lock.current, false);
  assert.deepEqual(busyStates, [true, false]);
});

test('in-flight lock releases after an exception and permits retry', async () => {
  const lock = { current: false };
  const busyStates = [];

  await assert.rejects(
    runWithInFlightLock(lock, value => busyStates.push(value), async () => {
      throw new Error('network unavailable');
    }),
    /network unavailable/,
  );

  assert.equal(lock.current, false);
  assert.equal(await runWithInFlightLock(lock, value => busyStates.push(value), async () => {}), true);
  assert.equal(lock.current, false);
  assert.deepEqual(busyStates, [true, false, true, false]);
});

test('dashboard quick-create flows use the tested shared lock lifecycle', () => {
  const dashboardSource = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');
  const flowMarkers = [
    ['handleQuickRequestSubmit', 'handleQuickTaskSubmit'],
    ['handleQuickTaskSubmit', 'handleQuickEventSubmit'],
    ['handleQuickEventSubmit', 'if (isContextLoading || isLoading)'],
  ];

  for (const [startMarker, endMarker] of flowMarkers) {
    const start = dashboardSource.indexOf(startMarker);
    const end = dashboardSource.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing ${startMarker} flow`);
    const flow = dashboardSource.slice(start, end);

    assert.match(flow, /runWithInFlightLock\(quickCreateInFlight, setIsQuickCreateSubmitting/);
    assert.match(flow, /isAmbiguousMutationFailure\(status\)/);
    assert.match(flow, /catch \(submitError\)/);
    assert.doesNotMatch(flow, /setIsQuickCreateSubmitting\(false\)/);
  }
});

test('tracking removes its redundant auth request and starts exactly four data reads', () => {
  const trackingSource = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
  const loadStart = trackingSource.indexOf('const loadTrackingData = useCallback');
  const loadEnd = trackingSource.indexOf('useEffect(() =>', loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart, 'missing tracking loader');
  const loader = trackingSource.slice(loadStart, loadEnd);

  assert.doesNotMatch(loader, /auth\.getUser\(/);
  assert.doesNotMatch(trackingSource, /useRouter/);
  assert.match(loader, /Promise\.all\(\[/);
  assert.equal([...loader.matchAll(/supabase\s*\.from\(/g)].length, 4);
});
