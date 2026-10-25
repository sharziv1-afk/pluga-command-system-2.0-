// Score-mode tracking items (מעקב עם ציון).
//
// A score item keeps its configuration in tracking_items.metadata and each
// soldier's score in tracking_records.metadata.score, so no schema change is
// needed. The record's status column is still written — derived from the
// score — so summaries, the "only not passed" filter and the MCP tools keep
// working on status alone.
//
// Pure and import-free: the tracking page, the MCP tools and the node tests
// all load it directly.

export type ScoreConfig = {
  min: number;
  max: number;
  /** The threshold (רף מעבר). */
  pass: number;
  /** Lower is better, e.g. a run time: passing means at or under the threshold. */
  lowerIsBetter: boolean;
  /** Whether a score exactly on the threshold passes. */
  passInclusive: boolean;
};

export type ScoreStatus = 'empty' | 'passed' | 'failed';

export const SCORE_KIND = 'score';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The item's score configuration, or null for a regular (עבר / לא עבר) item. */
export function readScoreConfig(metadata: unknown): ScoreConfig | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (m.kind !== SCORE_KIND) return null;
  if (!isFiniteNumber(m.score_min) || !isFiniteNumber(m.score_max) || !isFiniteNumber(m.pass_score)) return null;
  return {
    min: m.score_min,
    max: m.score_max,
    pass: m.pass_score,
    lowerIsBetter: m.lower_is_better === true,
    passInclusive: m.pass_inclusive !== false,
  };
}

/** Merges a score configuration into an item's existing metadata. */
export function withScoreConfig(metadata: unknown, config: ScoreConfig): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  return {
    ...base,
    kind: SCORE_KIND,
    score_min: config.min,
    score_max: config.max,
    pass_score: config.pass,
    lower_is_better: config.lowerIsBetter,
    pass_inclusive: config.passInclusive,
  };
}

/** Removes the score configuration, keeping any other metadata keys. */
export function withoutScoreConfig(metadata: unknown): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  for (const key of ['kind', 'score_min', 'score_max', 'pass_score', 'lower_is_better', 'pass_inclusive']) delete base[key];
  return base;
}

/** Hebrew error for an invalid configuration, or null when it is valid. */
export function validateScoreConfig(config: ScoreConfig): string | null {
  if (![config.min, config.max, config.pass].every(isFiniteNumber)) return 'יש להזין מינימום, מקסימום ורף מעבר כמספרים.';
  if (config.min >= config.max) return 'המקסימום חייב להיות גדול מהמינימום.';
  if (config.pass < config.min || config.pass > config.max) return 'רף המעבר חייב להיות בתוך הטווח.';
  return null;
}

/**
 * Parses what a user typed. Empty means "no score" (null); a comma decimal
 * separator is accepted; anything else that is not a number is 'invalid'.
 */
export function parseScoreInput(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return 'invalid';
  return Number(trimmed);
}

/** Hebrew error for a score outside the item's range, or null when it fits. */
export function validateScore(score: number, config: ScoreConfig): string | null {
  if (!isFiniteNumber(score)) return 'יש להזין ציון מספרי.';
  if (score < config.min || score > config.max) return `הציון חייב להיות בין ${formatScore(config.min)} ל-${formatScore(config.max)}.`;
  return null;
}

export function scorePasses(score: number, config: ScoreConfig): boolean {
  if (score === config.pass) return config.passInclusive;
  return config.lowerIsBetter ? score < config.pass : score > config.pass;
}

export function statusForScore(score: number | null, config: ScoreConfig): ScoreStatus {
  if (score === null) return 'empty';
  return scorePasses(score, config) ? 'passed' : 'failed';
}

/** The soldier's score from tracking_records.metadata, or null. */
export function readRecordScore(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const score = (metadata as Record<string, unknown>).score;
  return isFiniteNumber(score) ? score : null;
}

/** Merges a score (or its removal, for null) into a record's existing metadata. */
export function withRecordScore(metadata: unknown, score: number | null): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  if (score === null) delete base.score;
  else base.score = score;
  return base;
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : String(Math.round(score * 100) / 100);
}

/** e.g. "עובר: 80 ומעלה", "עובר: מתחת ל-14". */
export function scoreRuleLabel(config: ScoreConfig): string {
  const pass = formatScore(config.pass);
  if (config.lowerIsBetter) return config.passInclusive ? `עובר: ${pass} ומטה` : `עובר: מתחת ל-${pass}`;
  return config.passInclusive ? `עובר: ${pass} ומעלה` : `עובר: מעל ${pass}`;
}

export function scoreRangeLabel(config: ScoreConfig): string {
  return `${formatScore(config.min)}–${formatScore(config.max)}`;
}

/** Per-item summary: how many scored, the average, and the share that passed. */
export function summarizeScores(scores: Array<number | null>, config: ScoreConfig) {
  const values = scores.filter(isFiniteNumber);
  if (values.length === 0) return { count: 0, average: null, passRate: null } as const;
  const passed = values.filter(score => scorePasses(score, config)).length;
  return {
    count: values.length,
    average: Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 10) / 10,
    passRate: Math.round((passed / values.length) * 100),
  };
}
