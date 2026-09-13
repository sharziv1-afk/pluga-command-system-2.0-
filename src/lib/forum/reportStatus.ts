// forum_daily_reports.status is a strict forward lifecycle (migration 010's
// check constraint): draft -> in_progress -> submitted -> closed.
//
// Two write paths in forum/page.tsx (save, submit) used to derive the status
// they wrote from `selectedReport` — the copy loaded when the draft was
// opened. Correct on the fast path (nothing else changed, so that copy IS
// current); stale on the conflict/merge path, where a second tab can have
// since closed or submitted the very report this tab is about to
// "helpfully" set back to in_progress or submitted. One shared, general
// rule instead of a special case per call site: never move status backward.

export const REPORT_STATUS_RANK: Record<string, number> = {
  draft: 0,
  in_progress: 1,
  submitted: 2,
  closed: 3,
};

/**
 * Returns `intended` only if it is actually forward of `freshStatus` in the
 * lifecycle; otherwise returns `freshStatus` unchanged. `freshStatus` should
 * be the just-refetched server value on a conflict, or the value the draft
 * was loaded with when nothing else could have changed it (the fast path).
 * An unrecognized value defaults to `draft` — the earliest rank — so an
 * unexpected input can only ever be advanced, never used to regress.
 */
export function advanceReportStatus(freshStatus: unknown, intended: string): string {
  const fresh = typeof freshStatus === 'string' && freshStatus in REPORT_STATUS_RANK ? freshStatus : 'draft';
  return REPORT_STATUS_RANK[intended] > REPORT_STATUS_RANK[fresh] ? intended : fresh;
}
