import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { runWithInFlightLock } from '../src/lib/inFlightLock.ts';

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
    assert.match(flow, /catch \(submitError\)/);
    assert.doesNotMatch(flow, /setIsQuickCreateSubmitting\(false\)/);
  }
});
