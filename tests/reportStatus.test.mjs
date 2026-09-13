import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceReportStatus } from '../src/lib/forum/reportStatus.ts';

// Real bug, confirmed by an external review and reproduced by reading the
// code: a report open in two tabs, closed in one, could be reopened by a
// stale save from the other — the write derived status from the copy loaded
// when the draft was opened, not from what a conflict resolution had just
// refetched. Two separate call sites (save, submit) had this independently.

test('never moves status backward, regardless of what was intended', () => {
  assert.equal(advanceReportStatus('closed', 'in_progress'), 'closed', 'a stale save must not reopen a closed report');
  assert.equal(advanceReportStatus('closed', 'submitted'), 'closed', 'a stale submit must not reopen a closed report');
  assert.equal(advanceReportStatus('submitted', 'in_progress'), 'submitted', 'submitted must not regress to in_progress');
});

test('does advance status forward when the fresh value is actually earlier', () => {
  assert.equal(advanceReportStatus('draft', 'in_progress'), 'in_progress');
  assert.equal(advanceReportStatus('draft', 'submitted'), 'submitted');
  assert.equal(advanceReportStatus('in_progress', 'submitted'), 'submitted');
});

test('is idempotent at the same rank', () => {
  assert.equal(advanceReportStatus('in_progress', 'in_progress'), 'in_progress');
  assert.equal(advanceReportStatus('submitted', 'submitted'), 'submitted');
});

test('an unrecognized fresh value defaults to the earliest rank, never blocks an advance', () => {
  assert.equal(advanceReportStatus(null, 'in_progress'), 'in_progress');
  assert.equal(advanceReportStatus(undefined, 'submitted'), 'submitted');
  assert.equal(advanceReportStatus(42, 'in_progress'), 'in_progress');
});

test('the save and submit write paths pass the freshly-refetched row to buildPayload, not the stale closure', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');

  // Both call sites must route status through advanceReportStatus using
  // `currentRow` (the conflict-path refetch), with the closure value only as
  // the fast-path fallback — not `selectedReport.status` used unconditionally.
  const guardedCalls = source.match(/advanceReportStatus\(currentRow \? currentRow\.status : selectedReport\.status, '(in_progress|submitted)'\)/g) ?? [];
  assert.equal(guardedCalls.length, 2, 'expected exactly the save and submit call sites to use the guard');

  // buildPayload must accept currentRow to have anything fresh to read.
  const buildPayloadSignatures = source.match(/buildPayload: \(fields, currentRow\) => \(\{/g) ?? [];
  assert.equal(buildPayloadSignatures.length, 2, 'save and submit buildPayload must both accept currentRow');
});

test('hierarchyWrite passes the refetched row into buildPayload on the conflict path', () => {
  const source = readFileSync('src/lib/concurrency/hierarchyWrite.ts', 'utf8');
  assert.match(
    source,
    /buildPayload\(merged, current\)/,
    'the merge-path call must forward the refetched row, or callers have nothing fresh to read',
  );
});
