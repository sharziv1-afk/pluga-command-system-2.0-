/**
 * Row ceilings for the unbounded list queries.
 *
 * Measured on the LIVE project (2026-09-06) before adding these: 4 requests, 7 tasks,
 * 13 events, 12 soldiers, 3 tracking items, 12 tracking records. Nothing is
 * slow today — these are a guard against growth, not a fix for a present
 * problem, and the commit message should not pretend otherwise.
 *
 * The ceiling is paired with `isTruncated` on purpose. A bare `.limit()` on a
 * commander's work queue trades "eventually slow" for "silently wrong": a
 * request past the cutoff would simply not exist as far as the screen is
 * concerned. Slow is recoverable, a missed requirement is not. So every call
 * site that applies the ceiling also has to say when it was hit.
 */
export const LIST_FETCH_LIMIT = 500;

/**
 * True when a result came back exactly at the ceiling, i.e. there are probably
 * more rows the query did not return. One row of slack is impossible to
 * distinguish here — a table holding exactly LIST_FETCH_LIMIT rows reports
 * truncated — and that false positive is the safe direction to err in.
 */
export function isTruncated(rows: readonly unknown[] | null | undefined) {
  return (rows?.length ?? 0) >= LIST_FETCH_LIMIT;
}

/** Shown wherever a list was cut off, so the number on screen is never a lie. */
export const TRUNCATION_NOTICE =
  `מוצגות ${LIST_FETCH_LIMIT} הרשומות האחרונות בלבד. ייתכן שיש רשומות ישנות יותר שאינן מופיעות כאן.`;
