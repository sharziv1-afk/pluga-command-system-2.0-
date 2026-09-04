import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ambiguousMutationMessage,
  classifyMutationFailure,
  isAmbiguousMutationFailure,
  mutationFailureMessage,
  runQuickCreateMutation,
  runWithInFlightLock,
} from '../src/lib/inFlightLock.ts';

test('mutation failures distinguish ambiguous completion from definitive failure', () => {
  for (const status of [0, undefined, 408, 502, 503, 504]) {
    assert.equal(classifyMutationFailure(status), 'ambiguous_completion', String(status));
    assert.equal(isAmbiguousMutationFailure(status), true, String(status));
  }

  for (const status of [400, 403, 409, 422, 500]) {
    assert.equal(classifyMutationFailure(status), 'definitive_failure', String(status));
    assert.equal(isAmbiguousMutationFailure(status), false, String(status));
  }
});

test('ambiguous completion releases the lock without retrying automatically', async () => {
  const lock = { current: false };
  const busyStates = [];
  let attempts = 0;
  let classification = null;
  let message = null;

  await runWithInFlightLock(lock, value => busyStates.push(value), async () => {
    attempts += 1;
    classification = classifyMutationFailure(504);
    message = mutationFailureMessage(504, 'נסה שוב');
  });

  assert.equal(classification, 'ambiguous_completion');
  assert.equal(message, ambiguousMutationMessage);
  assert.equal(attempts, 1);
  assert.equal(lock.current, false);
  assert.deepEqual(busyStates, [true, false]);
});

test('quick-create ambiguous failures retain modal and form state', async () => {
  const lock = { current: false };
  const busyStates = [];
  const form = { title: 'preserve me' };
  let modalOpen = true;
  let attempts = 0;
  let message = null;
  let successCalls = 0;

  await runQuickCreateMutation(
    lock,
    value => busyStates.push(value),
    async () => {
      attempts += 1;
      return { data: null, error: new Error('gateway timeout'), status: 504 };
    },
    'נסה שוב',
    value => { message = value; },
    () => {
      successCalls += 1;
      form.title = '';
      modalOpen = false;
    },
  );

  assert.equal(attempts, 1);
  assert.equal(message, ambiguousMutationMessage);
  assert.equal(successCalls, 0);
  assert.deepEqual(form, { title: 'preserve me' });
  assert.equal(modalOpen, true);
  assert.equal(lock.current, false);
  assert.deepEqual(busyStates, [true, false]);
});

test('definitive failure releases the lock and permits a manual retry', async () => {
  const lock = { current: false };
  let attempts = 0;

  const attempt = () => runWithInFlightLock(lock, () => undefined, async () => {
    attempts += 1;
    assert.equal(classifyMutationFailure(403), 'definitive_failure');
    assert.equal(mutationFailureMessage(403, 'permission denied'), 'permission denied');
  });

  assert.equal(await attempt(), true);
  assert.equal(await attempt(), true);
  assert.equal(attempts, 2);
  assert.equal(lock.current, false);
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

    assert.match(flow, /runQuickCreateMutation\(\s*quickCreateInFlight,\s*setIsQuickCreateSubmitting/);
    assert.match(flow, /catch \(submitError\)/);
    assert.doesNotMatch(flow, /setIsQuickCreateSubmitting\(false\)/);
  }
});

test('tracking removes its redundant auth request and starts exactly five data reads', () => {
  const trackingSource = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
  const loadStart = trackingSource.indexOf('const loadTrackingData = useCallback');
  const loadEnd = trackingSource.indexOf('useEffect(() =>', loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart, 'missing tracking loader');
  const loader = trackingSource.slice(loadStart, loadEnd);

  assert.doesNotMatch(loader, /auth\.getUser\(/);
  assert.doesNotMatch(trackingSource, /useRouter/);
  assert.match(loader, /Promise\.all\(\[/);
  // 5, not 4: tracking_weeks joined the parallel batch alongside
  // soldiers/tracking_items/tracking_records/units.
  assert.equal([...loader.matchAll(/supabase\s*\.from\(/g)].length, 5);
});
