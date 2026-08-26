import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateCompanyStructured,
  assignPlatoonReports,
  buildCompanyReport,
  parsePlatoonUnitSnapshot,
  snapshotFromPlatoons,
} from '../src/lib/forum/companyReport.ts';

// Stable unit ids — deliberately NOT in "1,2,3,4" textual order, so nothing in these tests can
// accidentally pass because of array/list position.
const UNIT_MM1 = 'unit-cc11';
const UNIT_MM2 = 'unit-aa22';
const UNIT_MM3 = 'unit-bb33';
const UNIT_MM4 = 'unit-dd44';

const USER_MM1 = 'user-mm1-alice';
const USER_MM2 = 'user-mm2-bob';
const USER_MM3 = 'user-mm3-carl';
const USER_MM4 = 'user-mm4-dana';

function platoon(number, label, ownerUserId, unitId) {
  return { number, label, ownerUserId, unitId };
}

function platoonReport(id, ownerUserId, platoonUnitId, overrides = {}) {
  return {
    id,
    report_level: 'platoon',
    staff_role: null,
    owner_user_id: ownerUserId,
    status: 'submitted',
    content: { readiness: `readiness-${id}`, plan_vs_actual: `pva-${id}` },
    metadata: null,
    platoon_unit_id: platoonUnitId,
    ...overrides,
  };
}

// The forum was opened while these were the live owners/units — this is what gets frozen.
const platoonsAtForumOpen = [
  platoon(1, 'מחלקה 1', USER_MM1, UNIT_MM1),
  platoon(2, 'מחלקה 2', USER_MM2, UNIT_MM2),
  platoon(3, 'מחלקה 3', USER_MM3, UNIT_MM3),
  platoon(4, 'מחלקה 4', USER_MM4, UNIT_MM4),
];

test('opening a new forum with four platoons freezes an explicit number -> unitId snapshot', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  assert.deepEqual(snapshot, {
    1: UNIT_MM1,
    2: UNIT_MM2,
    3: UNIT_MM3,
    4: UNIT_MM4,
  });
});

test('reassigning/renaming platoons after the forum opened does not move existing reports', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);

  const reports = [
    platoonReport('r1', USER_MM1, UNIT_MM1),
    platoonReport('r2', USER_MM2, UNIT_MM2),
    platoonReport('r3', USER_MM3, UNIT_MM3),
    platoonReport('r4', USER_MM4, UNIT_MM4),
  ];

  // Simulate the live picture changing after the forum was opened: מ״מ 2's commander was
  // swapped for a brand new user, and (for good measure) the live platoon list order/labels
  // no longer line up 1:1 with how they were at open time.
  const liveePlatoonsAfterChurn = [
    platoon(1, 'מחלקה 1', USER_MM1, UNIT_MM1),
    platoon(2, 'מחלקה 2', 'user-mm2-new-commander', UNIT_MM2),
    platoon(3, 'מחלקה 3', USER_MM3, UNIT_MM3),
    platoon(4, 'מחלקה 4', USER_MM4, UNIT_MM4),
  ];

  const { byNumber, unidentified } = assignPlatoonReports(reports, liveePlatoonsAfterChurn, snapshot);

  assert.equal(unidentified.length, 0);
  assert.equal(byNumber.get(1)?.id, 'r1');
  assert.equal(byNumber.get(2)?.id, 'r2');
  assert.equal(byNumber.get(3)?.id, 'r3');
  assert.equal(byNumber.get(4)?.id, 'r4');
});

test('adding a staff/hq slot never touches the platoon mapping', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  const reports = [
    platoonReport('r1', USER_MM1, UNIT_MM1),
    platoonReport('r2', USER_MM2, UNIT_MM2),
    platoonReport('r3', USER_MM3, UNIT_MM3),
    platoonReport('r4', USER_MM4, UNIT_MM4),
    {
      id: 'hq-1',
      report_level: 'staff',
      staff_role: 'medic',
      owner_user_id: 'user-hq-medic',
      status: 'submitted',
      content: { notes: 'hq note' },
      metadata: null,
      platoon_unit_id: null,
    },
  ];

  const before = assignPlatoonReports(reports.filter(r => r.report_level === 'platoon'), platoonsAtForumOpen, snapshot);
  const after = assignPlatoonReports(reports, platoonsAtForumOpen, snapshot);

  assert.deepEqual([...before.byNumber.entries()].map(([n, r]) => [n, r.id]).sort(), [...after.byNumber.entries()].map(([n, r]) => [n, r.id]).sort());
  assert.equal(after.unidentified.length, 0);
});

test('an old report with no platoon_unit_id and no snapshot still resolves via the legacy fallback', () => {
  const legacyReport = {
    id: 'legacy-1',
    report_level: 'platoon',
    staff_role: null,
    owner_user_id: USER_MM3,
    status: 'closed',
    content: { readiness: 'legacy readiness' },
    metadata: { node_label: 'מחלקה 3' },
    // No platoon_unit_id at all — as if written before that column/behavior existed.
  };

  // No snapshot available (forum predates this feature) — falls back to owner_user_id match.
  const byOwner = assignPlatoonReports([legacyReport], platoonsAtForumOpen, undefined);
  assert.equal(byOwner.byNumber.get(3)?.id, 'legacy-1');

  // Even without an owner match, the metadata.node_label fallback still works.
  const ownerlessLegacy = { ...legacyReport, owner_user_id: null };
  const byLabel = assignPlatoonReports([ownerlessLegacy], platoonsAtForumOpen, undefined);
  assert.equal(byLabel.byNumber.get(3)?.id, 'legacy-1');
});

test('parsePlatoonUnitSnapshot rejects missing/legacy/corrupted metadata without throwing', () => {
  assert.equal(parsePlatoonUnitSnapshot(undefined), undefined);
  assert.equal(parsePlatoonUnitSnapshot(null), undefined);
  assert.equal(parsePlatoonUnitSnapshot({}), undefined);
  assert.equal(parsePlatoonUnitSnapshot({ node_label: 'מחלקה 3' }), undefined);
  assert.equal(parsePlatoonUnitSnapshot('not-an-object'), undefined);
  assert.equal(parsePlatoonUnitSnapshot({ 5: UNIT_MM1, 0: UNIT_MM2 }), undefined);
});

test('a new-backup export/import round trip (JSON serialize) preserves the mapping', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  const roundTripped = JSON.parse(JSON.stringify({ platoon_unit_map: snapshot })).platoon_unit_map;
  const parsedBack = parsePlatoonUnitSnapshot(roundTripped);

  assert.deepEqual(parsedBack, snapshot);

  const reports = [platoonReport('r2', USER_MM2, UNIT_MM2)];
  const { byNumber } = assignPlatoonReports(reports, platoonsAtForumOpen, parsedBack);
  assert.equal(byNumber.get(2)?.id, 'r2');
});

test('an old backup without a platoon_unit_map import stays compatible (read-only fallback, nothing rewritten)', () => {
  const oldBackupCompanyMetadata = { node_id: 'company-summary', node_label: 'סיכום פלוגתי', company_report: true };
  const snapshot = parsePlatoonUnitSnapshot(oldBackupCompanyMetadata.platoon_unit_map);
  assert.equal(snapshot, undefined);

  const reports = [platoonReport('r1', USER_MM1, UNIT_MM1)];
  const { byNumber } = assignPlatoonReports(reports, platoonsAtForumOpen, snapshot);
  assert.equal(byNumber.get(1)?.id, 'r1');
});

test('the מ״פ structured summary rolls each field up under the correct מחלקה using the snapshot', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  const reports = [
    platoonReport('r1', USER_MM1, UNIT_MM1, { content: { readiness: 'MM1-READY', present_count: '30', total_count: '32' } }),
    platoonReport('r2', USER_MM2, UNIT_MM2, { content: { readiness: 'MM2-READY', present_count: '28', total_count: '30' } }),
  ];

  // Live picture has churned since the forum opened (מ״מ 1 and 2 commanders swapped units),
  // which would misassign these reports if resolution trusted the live picture over the frozen
  // snapshot.
  const churnedLivePlatoons = [
    platoon(1, 'מחלקה 1', USER_MM2, UNIT_MM2),
    platoon(2, 'מחלקה 2', USER_MM1, UNIT_MM1),
    platoon(3, 'מחלקה 3', USER_MM3, UNIT_MM3),
    platoon(4, 'מחלקה 4', USER_MM4, UNIT_MM4),
  ];

  const result = aggregateCompanyStructured({
    reports,
    formattedDate: '01/01/2026',
    platoons: churnedLivePlatoons,
    staff: [],
    platoonUnitSnapshot: snapshot,
  });

  assert.match(result.fields.readiness, /מחלקה 1 — MM1-READY/);
  assert.match(result.fields.readiness, /מחלקה 2 — MM2-READY/);
  assert.equal(result.stats.presentTotal, 58);
  assert.equal(result.stats.sdkTotal, 62);
});

test('the WhatsApp preview path (assignPlatoonReports) and the aggregation path never diverge', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  const reports = [
    platoonReport('r1', USER_MM1, UNIT_MM1, { content: { plan_vs_actual: 'MM1-PVA' } }),
    platoonReport('r2', USER_MM2, UNIT_MM2, { content: { plan_vs_actual: 'MM2-PVA' } }),
    platoonReport('r3', USER_MM3, UNIT_MM3, { content: { plan_vs_actual: 'MM3-PVA' } }),
    platoonReport('r4', USER_MM4, UNIT_MM4, { content: { plan_vs_actual: 'MM4-PVA' } }),
  ];

  const forWhatsapp = assignPlatoonReports(reports, platoonsAtForumOpen, snapshot);
  const report = buildCompanyReport({
    reports,
    formattedDate: '01/01/2026',
    platoons: platoonsAtForumOpen,
    staff: [],
    platoonUnitSnapshot: snapshot,
  });

  for (const [number, r] of forWhatsapp.byNumber.entries()) {
    const label = platoonsAtForumOpen.find(p => p.number === number).label;
    assert.ok(report.text.includes(`${label}`), `report text should mention ${label}`);
    assert.ok(report.text.includes(r.content.plan_vs_actual), `report text should include ${r.content.plan_vs_actual}`);
  }
});

test('no report is duplicated or lost across platoon numbers when a snapshot is present', () => {
  const snapshot = snapshotFromPlatoons(platoonsAtForumOpen);
  const reports = [
    platoonReport('r1', USER_MM1, UNIT_MM1),
    platoonReport('r2', USER_MM2, UNIT_MM2),
    platoonReport('r3', USER_MM3, UNIT_MM3),
    platoonReport('r4', USER_MM4, UNIT_MM4),
  ];

  const { byNumber, unidentified } = assignPlatoonReports(reports, platoonsAtForumOpen, snapshot);
  const seenIds = [...byNumber.values()].map(r => r.id).concat(unidentified.map(r => r.id));
  assert.deepEqual(seenIds.sort(), ['r1', 'r2', 'r3', 'r4']);
  assert.equal(new Set(seenIds).size, 4);
});
