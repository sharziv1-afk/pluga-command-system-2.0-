// Score-mode tracking items (מעקב עם ציון).
//
// A score item keeps its configuration in tracking_items.metadata and each
// soldier's score in tracking_records.metadata.score, so no schema change is
// needed. The record's status column is still written — derived from the
// score — so summaries, the "only not passed" filter and the MCP tools keep
// working on status alone.
//
// A score item can also be a time (בוחן כושר: ריצה, 20.11.2026): the score is
// stored in seconds and typed and shown as minutes:seconds ("13:45"); lower
// is better, so "עובר: 14:00 ומטה".
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
  /** 'time': every value is seconds, typed and shown as mm:ss. Absent: a plain number. */
  unit?: 'time';
};

/** A time item's range when only the threshold is asked for: 0:00 to 99:59. */
export const TIME_MIN_SECONDS = 0;
export const TIME_MAX_SECONDS = 99 * 60 + 59;

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
    ...(m.score_unit === 'time' ? { unit: 'time' as const } : {}),
  };
}

export const isTimeScore = (config: Pick<ScoreConfig, 'unit'> | null | undefined): boolean => config?.unit === 'time';

/** Merges a score configuration into an item's existing metadata. */
export function withScoreConfig(metadata: unknown, config: ScoreConfig): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const next: Record<string, unknown> = {
    ...base,
    kind: SCORE_KIND,
    score_min: config.min,
    score_max: config.max,
    pass_score: config.pass,
    lower_is_better: config.lowerIsBetter,
    pass_inclusive: config.passInclusive,
    ...(config.unit === 'time' ? { score_unit: 'time' } : {}),
  };
  if (config.unit !== 'time') delete next.score_unit;
  return next;
}

/** Removes the score configuration, keeping any other metadata keys. */
export function withoutScoreConfig(metadata: unknown): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  for (const key of ['kind', 'score_min', 'score_max', 'pass_score', 'lower_is_better', 'pass_inclusive', 'score_unit']) delete base[key];
  return base;
}

/** Hebrew error for an invalid configuration, or null when it is valid. */
export function validateScoreConfig(config: ScoreConfig): string | null {
  if (isTimeScore(config)) {
    if (![config.min, config.max, config.pass].every(isFiniteNumber)) return 'יש להזין זמן מעבר בדקות:שניות, למשל 14:00.';
    if (config.pass <= config.min || config.pass > config.max) return 'זמן המעבר חייב להיות בין 0:01 ל-99:59.';
    return null;
  }
  if (![config.min, config.max, config.pass].every(isFiniteNumber)) return 'יש להזין מינימום, מקסימום ורף מעבר כמספרים.';
  if (config.min >= config.max) return 'המקסימום חייב להיות גדול מהמינימום.';
  if (config.pass < config.min || config.pass > config.max) return 'רף המעבר חייב להיות בתוך הטווח.';
  return null;
}

/**
 * A time as typed: "13:45" (minutes:seconds), "1:02:30" (hours too), or whole
 * minutes ("14" is 14:00). A dot or a comma may stand for the colon on a
 * phone keypad ("13.45"). Returns seconds, null for empty, or 'invalid'.
 */
export function parseTimeInput(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(/[.,]/g, ':');
  if (!trimmed) return null;
  if (/^\d{1,3}$/.test(trimmed)) return Number(trimmed) * 60;
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3 || !parts.every(part => /^\d+$/.test(part))) return 'invalid';
  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  if (parts[parts.length - 1].length !== 2 || seconds > 59) return 'invalid';
  if (parts.length === 3 && minutes > 59) return 'invalid';
  const hours = parts.length === 3 ? numbers[0] : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/** Seconds as "13:45" (or "1:02:30" from an hour up). */
export function formatTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
}

/**
 * Parses what a user typed. Empty means "no score" (null); a comma decimal
 * separator is accepted; anything else that is not a number is 'invalid'.
 * For a time item, minutes:seconds (parseTimeInput).
 */
export function parseScoreInput(text: string, config?: Pick<ScoreConfig, 'unit'> | null): number | null | 'invalid' {
  if (isTimeScore(config)) return parseTimeInput(text);
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return 'invalid';
  return Number(trimmed);
}

/** Hebrew error for a score outside the item's range, or null when it fits. */
export function validateScore(score: number, config: ScoreConfig): string | null {
  if (!isFiniteNumber(score)) return isTimeScore(config) ? 'יש להזין זמן בדקות:שניות, למשל 13:45.' : 'יש להזין ציון מספרי.';
  if (score < config.min || score > config.max) {
    return isTimeScore(config)
      ? `הזמן חייב להיות בין ${formatScore(config.min, config)} ל-${formatScore(config.max, config)}.`
      : `הציון חייב להיות בין ${formatScore(config.min)} ל-${formatScore(config.max)}.`;
  }
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

export function formatScore(score: number, config?: Pick<ScoreConfig, 'unit'> | null): string {
  if (isTimeScore(config)) return formatTime(score);
  return Number.isInteger(score) ? String(score) : String(Math.round(score * 100) / 100);
}

/** e.g. "עובר: 80 ומעלה", "עובר: מתחת ל-14". */
export function scoreRuleLabel(config: ScoreConfig): string {
  const pass = formatScore(config.pass, config);
  if (config.lowerIsBetter) return config.passInclusive ? `עובר: ${pass} ומטה` : `עובר: מתחת ל-${pass}`;
  return config.passInclusive ? `עובר: ${pass} ומעלה` : `עובר: מעל ${pass}`;
}

export function scoreRangeLabel(config: ScoreConfig): string {
  return `${formatScore(config.min, config)}–${formatScore(config.max, config)}`;
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
