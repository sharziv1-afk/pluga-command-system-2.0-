import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  statusTones, toneClasses, accountStatusLabels, priorityTones, priorityClass,
  taskStatusLabels, requestStatusLabels, eventStatusLabels,
} from '../src/lib/statusLabels.ts';
import { toDbProfile } from '../src/lib/dbProfile.ts';
import { isTruncated, LIST_FETCH_LIMIT } from '../src/lib/queryLimits.ts';

/**
 * StatusBadge is handed a *label*, not a code, and an unknown label falls
 * through to neutral grey without erroring. That silence is how the original
 * bug survived: the feminine forms (הושלמה, בוטלה, תקועה) were absent from
 * the tone table, so every completed and cancelled row rendered identically.
 *
 * So the exhaustiveness has to be asserted, not assumed.
 */
test('every label the app can emit has a tone', () => {
  const emitted = [
    ...Object.values(taskStatusLabels),
    ...Object.values(requestStatusLabels),
    ...Object.values(eventStatusLabels),
    ...Object.values(accountStatusLabels),
  ];
  const missing = emitted.filter(label => !(label in statusTones));
  assert.deepEqual(missing, [], `these render as unstyled grey: ${missing.join(', ')}`);
});

test('every tone resolves to real classes', () => {
  const missing = [...new Set(Object.values(statusTones))].filter(t => !(t in toneClasses));
  assert.deepEqual(missing, []);
  for (const [scale, map] of Object.entries(priorityTones)) {
    for (const [value, tone] of Object.entries(map)) {
      assert.ok(tone in toneClasses, `${scale}/${value} -> unknown tone ${tone}`);
      assert.ok(priorityClass(scale, value).length > 0);
    }
  }
});

test('the three priority scales escalate, and none of them is silently flat', () => {
  // "דחופה" is the top of the request scale but only second on the task
  // scale — that difference is deliberate and worth keeping visible.
  assert.equal(priorityTones.request['דחופה'], 'danger');
  assert.equal(priorityTones.task['דחופה'], 'warning');
  assert.equal(priorityTones.task['קריטית'], 'danger');
  for (const scale of ['request', 'task', 'gap']) {
    const tones = Object.values(priorityTones[scale]);
    assert.equal(new Set(tones).size, tones.length, `${scale} reuses a tone, so its steps are indistinguishable`);
    assert.ok(tones.includes('danger'), `${scale} has no top step`);
  }
});

test('an unknown priority falls back instead of throwing', () => {
  assert.equal(priorityClass('task', 'לא קיים'), toneClasses.neutral);
  assert.equal(priorityClass('task', ''), toneClasses.neutral);
});

test('toDbProfile handles absent users and preserves the frame name', () => {
  assert.equal(toDbProfile(null), null);
  assert.equal(toDbProfile(undefined), null);
  const p = toDbProfile({
    id: 'a', full_name: 'שחר', role: 'מ"פ', unit_id: null,
    permission_level: 100, assigned_frame: 'פלוגה א',
  });
  assert.equal(p.name, 'שחר', 'full_name maps to name — the DB rows use `name`');
  assert.equal(p.units.name, 'פלוגה א');
  assert.equal(p.unit_id, null);
});

test('the list ceiling reports truncation only at the boundary', () => {
  assert.equal(isTruncated(new Array(LIST_FETCH_LIMIT - 1)), false);
  assert.equal(isTruncated(new Array(LIST_FETCH_LIMIT)), true);
  assert.equal(isTruncated([]), false);
  assert.equal(isTruncated(null), false);
  assert.equal(isTruncated(undefined), false);
});
