// "Carry over from yesterday" for the leading-forum daily report.
//
// The commander's request: when I open a new day's report, it should already
// hold the text of my previous report, so I only edit what changed. The rules
// the commander chose (2026-11-07):
//   - the form fills automatically when the day's report is still empty;
//     nothing is written until the user presses "שמור";
//   - every field is copied (text and the manpower numbers);
//   - the source is only a report that was submitted or closed — a draft
//     that never went up is not copied;
//   - the source is the latest such report in the 7 days before the date
//     (after Shabbat or a few days off, the last working day's report).
//
// Pure module (no React, no Supabase) so the rules are unit-testable. The
// read itself runs in forum/page.tsx under the user's own RLS: an owner reads
// their own rows, a commander reads all — no schema or policy change.

export const CARRY_OVER_MAX_DAYS = 7;

export const CARRY_OVER_SOURCE_STATUSES = ['submitted', 'closed'] as const;

export type CarryOverSourceRow = {
  id: string;
  report_date: string;
  status: string;
  content: Record<string, unknown> | null;
};

type CarryOverTargetRow = {
  status: string;
  content: Record<string, unknown> | null;
};

/** Shifts a YYYY-MM-DD date by whole days. Calendar math only — no time zone. */
export function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The dates a source may come from: `from` (inclusive) up to `before` (exclusive). */
export function carryOverWindow(date: string, maxDays = CARRY_OVER_MAX_DAYS) {
  return { from: shiftIsoDate(date, -maxDays), before: date };
}

/**
 * True when at least one of `keys` holds something worth copying: a
 * non-blank string or a number. Booleans (company_report_manually_edited)
 * and unknown keys never count, so a report that only carries flags or
 * metadata-like keys is still empty.
 */
export function hasCarryableContent(
  content: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): boolean {
  if (!content) return false;
  return keys.some(key => {
    const value = content[key];
    if (typeof value === 'string') return value.trim().length > 0;
    return typeof value === 'number' && Number.isFinite(value);
  });
}

/**
 * Whether a slot's report for the day may be filled from a previous one:
 * there is no report yet, or there is an open (draft / in_progress) one with
 * nothing written in it. A submitted or closed report is never refilled,
 * and neither is one that already holds text — including a draft the
 * close-time carry-forward already copied.
 */
export function isCarryOverTarget(
  report: CarryOverTargetRow | null | undefined,
  keys: readonly string[],
): boolean {
  if (!report) return true;
  if (report.status !== 'draft' && report.status !== 'in_progress') return false;
  return !hasCarryableContent(report.content, keys);
}

/**
 * Picks the report to copy from: the latest submitted/closed row strictly
 * before `date` and inside the window, that has something to copy. The
 * query already filters on these; this repeats the filter so the rule does
 * not depend on the query being right.
 */
export function pickCarryOverSource<T extends CarryOverSourceRow>(
  rows: readonly T[],
  date: string,
  keys: readonly string[],
  maxDays = CARRY_OVER_MAX_DAYS,
): T | null {
  const { from, before } = carryOverWindow(date, maxDays);
  const statuses: readonly string[] = CARRY_OVER_SOURCE_STATUSES;
  let best: T | null = null;
  for (const row of rows) {
    if (!(row.report_date >= from && row.report_date < before)) continue;
    if (!statuses.includes(row.status)) continue;
    if (!hasCarryableContent(row.content, keys)) continue;
    if (!best || row.report_date > best.report_date) best = row;
  }
  return best;
}
