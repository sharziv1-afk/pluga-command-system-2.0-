import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignPlatoonReports,
  aggregateCompanyStructured,
} from '../src/lib/forum/companyReport.ts';

/**
 * companyReport.ts produces the daily WhatsApp summary the commander actually
 * sends. It had no tests, and the way it was verified all along was a human
 * opening /forum on a known date and reading the numbers. This file replaces
 * that check.
 *
 * The fixture mirrors the real 2026-09-08 data used as the manual regression
 * baseline: 128/138 present, from 34/36 + 31/34 + 30/33 + 33/35.
 *
 * The invariant that matters most (FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT §5):
 * a platoon report is bound to its platoon by owner_user_id, NEVER by its
 * position in the array. Getting that wrong once already swapped platoon 1's
 * content with platoon 2's in a live report.
 */

const PLATOONS = [
  { number: 1, label: 'מחלקה 1', ownerUserId: 'mm-1' },
  { number: 2, label: 'מחלקה 2', ownerUserId: 'mm-2' },
  { number: 3, label: 'מחלקה 3', ownerUserId: 'mm-3' },
  { number: 4, label: 'מחלקה 4', ownerUserId: 'mm-4' },
];

const STAFF = [
  { role: 'medic', label: 'חופ״ל' },
  { role: 'logistics', label: 'רס״פ' },
];

function platoonReport(id, owner, present, total, extra = {}) {
  return {
    id,
    report_level: 'platoon',
    staff_role: null,
    owner_user_id: owner,
    status: 'submitted',
    content: {
      present_count: String(present),
      total_count: String(total),
      ...extra,
    },
    metadata: {},
  };
}

const REPORTS = [
  platoonReport('r1', 'mm-1', 34, 36, { logistics: 'חוסר בכובעי גרב' }),
  platoonReport('r2', 'mm-2', 31, 34, { logistics: 'אין חוסרים' }),
  platoonReport('r3', 'mm-3', 30, 33, { logistics: 'אין חוסרים' }),
  platoonReport('r4', 'mm-4', 33, 35, { logistics: 'פער אפודים' }),
];

const INPUT = { reports: REPORTS, formattedDate: '08.09.2026', platoons: PLATOONS, staff: STAFF };

test('the company aggregate reproduces the 128/138 baseline', () => {
  const { fields, stats } = aggregateCompanyStructured(INPUT);
  assert.equal(fields.present_count, '128');
  assert.equal(fields.total_count, '138');
  assert.equal(stats.presentTotal, 128);
  assert.equal(stats.sdkTotal, 138);
  assert.equal(stats.platoonSubmitted, 4);
  assert.equal(stats.platoonTotal, 4);
  // 34+31+30+33 must equal the reported company total, always.
  assert.equal(34 + 31 + 30 + 33, stats.presentTotal);
  assert.equal(36 + 34 + 33 + 35, stats.sdkTotal);
});

test('platoons are bound by owner_user_id, not by array position', () => {
  // Reversed order: an index-based implementation returns platoon 1's content
  // for platoon 4 and passes every total-based check while doing it.
  const scrambled = { ...INPUT, reports: [...REPORTS].reverse() };
  const { byNumber } = assignPlatoonReports(scrambled.reports, PLATOONS);
  assert.equal(byNumber.get(1).id, 'r1');
  assert.equal(byNumber.get(4).id, 'r4');

  const { fields, stats } = aggregateCompanyStructured(scrambled);
  assert.equal(stats.presentTotal, 128, 'totals must not depend on report order');
  // The כובעי גרב item belongs to platoon 1 and must be attributed to it.
  assert.match(fields.logistics, /מחלקה 1 — חוסר בכובעי גרב/);
  assert.match(fields.logistics, /מחלקה 4 — פער אפודים/);
  assert.doesNotMatch(fields.logistics, /מחלקה 4 — חוסר בכובעי גרב/);
  assert.doesNotMatch(fields.logistics, /מחלקה 1 — פער אפודים/);
});

test('a report with no owner falls back to its label, and an unlabelled one is not guessed', () => {
  const byLabel = {
    ...platoonReport('r-label', null, 10, 10),
    metadata: { node_label: 'מחלקה 3' },
  };
  const orphan = platoonReport('r-orphan', null, 5, 5);

  const { byNumber, unidentified } = assignPlatoonReports([byLabel, orphan], PLATOONS);
  assert.equal(byNumber.get(3).id, 'r-label', 'label is the documented fallback');
  assert.equal(unidentified.length, 1);
  assert.equal(unidentified[0].id, 'r-orphan', 'an unidentifiable report must never be assigned a platoon');
});

test('a duplicate owner does not overwrite the platoon it already filled', () => {
  const dupe = platoonReport('r-dupe', 'mm-1', 99, 99);
  const { byNumber, unidentified } = assignPlatoonReports([...REPORTS, dupe], PLATOONS);
  assert.equal(byNumber.get(1).id, 'r1', 'first report wins');
  assert.ok(unidentified.some(r => r.id === 'r-dupe'), 'the duplicate is surfaced, not dropped');
});

test('a missing platoon is reported as missing rather than silently summed away', () => {
  const partial = { ...INPUT, reports: REPORTS.slice(0, 3) };
  const { stats, warnings, fields } = aggregateCompanyStructured(partial);
  assert.equal(stats.presentTotal, 34 + 31 + 30);
  assert.equal(stats.platoonSubmitted, 3);
  assert.ok(warnings.some(w => w.includes('מחלקה 4')), 'the commander must be told platoon 4 is absent');
  assert.match(fields.logistics, /מחלקה 4 — /, 'the gap is visible in the rolled-up text');
});

test('an unsubmitted platoon still counts its people but is flagged as in progress', () => {
  const draft = { ...platoonReport('r4d', 'mm-4', 33, 35, { logistics: 'עוד עובדים על זה' }), status: 'draft' };
  const input = { ...INPUT, reports: [...REPORTS.slice(0, 3), draft] };
  const { stats, warnings } = aggregateCompanyStructured(input);
  assert.equal(stats.presentTotal, 128, 'headcount is still real even before final submission');
  assert.equal(stats.platoonSubmitted, 3, 'but it does not count as submitted');
  assert.ok(warnings.some(w => w.includes('מחלקה 4') && w.includes('טרם הוגש')));
});

test('commander free text is never invented by the aggregation', () => {
  const { fields } = aggregateCompanyStructured(INPUT);
  assert.equal(fields.commander_closing, undefined, 'דגשי מ״פ stays manual');
});
