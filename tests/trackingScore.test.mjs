import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIME_MAX_SECONDS,
  formatScore,
  formatTime,
  parseScoreInput,
  parseTimeInput,
  readRecordScore,
  readScoreConfig,
  scorePasses,
  scoreRuleLabel,
  statusForScore,
  summarizeScores,
  validateScore,
  validateScoreConfig,
  withRecordScore,
  withScoreConfig,
  withoutScoreConfig,
} from '../src/lib/trackingScore.ts';

/**
 * Score-mode tracking items (מעקב עם ציון): the item stores range, threshold,
 * direction and whether the threshold itself passes; each cell stores a score
 * and a status derived from it, so everything that reads status keeps working.
 */

const range = { min: 0, max: 100, pass: 80, lowerIsBetter: false, passInclusive: true };
const run = { min: 8, max: 25, pass: 14, lowerIsBetter: true, passInclusive: true };

test('higher is better: the threshold passes only when inclusive', () => {
  assert.equal(scorePasses(80, range), true);
  assert.equal(scorePasses(79.5, range), false);
  assert.equal(scorePasses(81, range), true);
  const strict = { ...range, passInclusive: false };
  assert.equal(scorePasses(80, strict), false);
  assert.equal(scorePasses(80.5, strict), true);
});

test('lower is better (a run time): at or under the threshold passes', () => {
  assert.equal(scorePasses(13.5, run), true);
  assert.equal(scorePasses(14, run), true);
  assert.equal(scorePasses(14.1, run), false);
  assert.equal(scorePasses(14, { ...run, passInclusive: false }), false);
});

test('status follows the score; no score is an empty cell', () => {
  assert.equal(statusForScore(null, range), 'empty');
  assert.equal(statusForScore(92, range), 'passed');
  assert.equal(statusForScore(40, range), 'failed');
  assert.equal(statusForScore(0, range), 'failed', 'a zero score is a real result, not empty');
});

test('the rule reads as the commander would say it', () => {
  assert.equal(scoreRuleLabel(range), 'עובר: 80 ומעלה');
  assert.equal(scoreRuleLabel({ ...range, passInclusive: false }), 'עובר: מעל 80');
  assert.equal(scoreRuleLabel(run), 'עובר: 14 ומטה');
  assert.equal(scoreRuleLabel({ ...run, passInclusive: false }), 'עובר: מתחת ל-14');
});

test('configuration must be a sane range with the threshold inside it', () => {
  assert.equal(validateScoreConfig(range), null);
  assert.match(validateScoreConfig({ ...range, min: 100, max: 100 }), /המקסימום חייב להיות גדול/);
  assert.match(validateScoreConfig({ ...range, pass: 120 }), /בתוך הטווח/);
  assert.match(validateScoreConfig({ ...range, pass: Number.NaN }), /כמספרים/);
});

test('typed scores: empty clears, comma decimals work, junk is rejected', () => {
  assert.equal(parseScoreInput(''), null);
  assert.equal(parseScoreInput('   '), null);
  assert.equal(parseScoreInput('86'), 86);
  assert.equal(parseScoreInput('13,5'), 13.5);
  assert.equal(parseScoreInput('-2'), -2);
  assert.equal(parseScoreInput('80a'), 'invalid');
  assert.equal(parseScoreInput('1e3'), 'invalid');
  assert.equal(validateScore(100, range), null);
  assert.match(validateScore(101, range), /בין 0 ל-100/);
});

test('config round-trips through item metadata and keeps unrelated keys', () => {
  const metadata = withScoreConfig({ legacy: 'keep' }, range);
  assert.deepEqual(readScoreConfig(metadata), range);
  assert.equal(metadata.legacy, 'keep');
  const regular = withoutScoreConfig(metadata);
  assert.equal(readScoreConfig(regular), null);
  assert.deepEqual(regular, { legacy: 'keep' });
  assert.equal(readScoreConfig({}), null);
  assert.equal(readScoreConfig(null), null);
  assert.equal(readScoreConfig({ kind: 'score', score_min: 0 }), null, 'an incomplete config is not a score item');
  // Older score items saved before pass_inclusive existed default to inclusive.
  assert.equal(readScoreConfig({ kind: 'score', score_min: 0, score_max: 100, pass_score: 80 }).passInclusive, true);
});

test('the score round-trips through record metadata and keeps the MCP markers', () => {
  const metadata = withRecordScore({ created_via: 'mcp' }, 86);
  assert.equal(readRecordScore(metadata), 86);
  assert.equal(metadata.created_via, 'mcp');
  const cleared = withRecordScore(metadata, null);
  assert.equal(readRecordScore(cleared), null);
  assert.deepEqual(cleared, { created_via: 'mcp' });
  assert.equal(readRecordScore({ score: '86' }), null, 'only numbers count as scores');
});

test('per-item summary: average and pass rate over scored cells only', () => {
  assert.deepEqual(summarizeScores([90, 70, null, 80], range), { count: 3, average: 80, passRate: 67 });
  assert.deepEqual(summarizeScores([null, null], range), { count: 0, average: null, passRate: null });
  assert.deepEqual(summarizeScores([13, 15], run), { count: 2, average: 14, passRate: 50 });
});

const page = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
const writes = readFileSync('src/lib/mcp/writes.ts', 'utf8');
const tools = readFileSync('src/lib/mcp/tools.ts', 'utf8');

test('the tracking page: score items are entered, never cycled', () => {
  assert.match(page, /if \(readScoreConfig\(item\.metadata\)\) return;/, 'handleCycleCellStatus ignores score items');
  // One sheet for phone and computer since 28.11.2026.
  assert.match(page, /if \(scoreConfig\) openScoreDialog\(soldier, item, record \?\? null\);\s*else void handleCycleCellStatus\(soldier, item, record\);/, 'the sheet cell routes score items to the score dialog');
  assert.match(page, /const cellStatus = scoreConfig \? statusForScore\(score, scoreConfig\) : status;/);
});

test('the tracking page: saving a score writes status and score together', () => {
  const handler = page.slice(page.indexOf('const handleSaveCellScore'), page.indexOf('const openNoteDialog'));
  assert.match(handler, /validateScore\(parsed, config\)/, 'out-of-range scores are rejected before any write');
  assert.match(handler, /\.update\(\{ status: nextStatus, metadata: nextMetadata, updated_by: currentUserId \}\)/);
  assert.match(handler, /status: nextStatus,\s*note: null,\s*metadata: nextMetadata,/);
  assert.match(handler, /actionType: 'tracking_record_updated'/, 'every score change is audited, which keeps a retest\'s previous score');
});

test('the tracking page: kind cannot flip once results exist, and a new rule re-derives statuses', () => {
  assert.match(page, /if \(editingItem && \(!!previousScoreConfig !== !!scoreConfig \|\| isTimeScore\(previousScoreConfig\) !== isTimeScore\(scoreConfig\)\)\) \{/);
  assert.match(page, /record\.status !== statusForScore\(readRecordScore\(record\.metadata\), config\)/);
});

test('MCP: score items take a score, regular items a status', () => {
  assert.match(writes, /score: z\.number\(\)\.optional\(\)/);
  assert.match(writes, /is a score item — give only a score/);
  assert.match(writes, /is not a score item — give a status/);
  assert.match(writes, /status = statusForScore\(score, scoreConfig\);/);
  assert.match(tools, /tracking_items'\)\.select\('id,title,category,subject,week_id,is_active,sort_order,metadata'\)/);
  assert.match(tools, /pass_rate_percent: summary\.passRate/);
});

// ── Time items (בוחן כושר: ריצה, 20.11.2026) ────────────────────────────────
const timeRun = { min: 0, max: TIME_MAX_SECONDS, pass: 14 * 60, lowerIsBetter: true, passInclusive: true, unit: 'time' };

test('a time is typed as minutes:seconds, and a phone dot or comma works as the colon', () => {
  assert.equal(parseTimeInput('13:45'), 13 * 60 + 45);
  assert.equal(parseTimeInput('13.45'), 13 * 60 + 45);
  assert.equal(parseTimeInput('13,45'), 13 * 60 + 45);
  assert.equal(parseTimeInput('14'), 14 * 60, 'whole minutes');
  assert.equal(parseTimeInput('1:02:30'), 3750);
  assert.equal(parseTimeInput(' '), null);
  for (const junk of ['13:5', '13:60', 'abc', '13:45:', '-1:00', '1:60:00']) assert.equal(parseTimeInput(junk), 'invalid', junk);
  assert.equal(parseScoreInput('13:45', timeRun), 825);
  assert.equal(parseScoreInput('13:45'), 'invalid', 'a plain score item still takes numbers only');
});

test('a time shows as minutes:seconds everywhere', () => {
  assert.equal(formatTime(825), '13:45');
  assert.equal(formatTime(840), '14:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3750), '62:30', 'past the hour, as a stopwatch reads');
  assert.equal(formatTime(TIME_MAX_SECONDS), '99:59');
  assert.equal(formatScore(825, timeRun), '13:45');
  assert.equal(formatScore(825), '825', 'without the time unit it is a number');
  assert.equal(scoreRuleLabel(timeRun), 'עובר: 14:00 ומטה');
  assert.equal(scoreRuleLabel({ ...timeRun, passInclusive: false }), 'עובר: מתחת ל-14:00');
});

test('under the pass time passes, over it fails, and the line itself follows the checkbox', () => {
  assert.equal(statusForScore(13 * 60 + 59, timeRun), 'passed');
  assert.equal(statusForScore(14 * 60, timeRun), 'passed');
  assert.equal(statusForScore(14 * 60 + 1, timeRun), 'failed');
  assert.equal(statusForScore(14 * 60, { ...timeRun, passInclusive: false }), 'failed');
  assert.equal(statusForScore(null, timeRun), 'empty');
});

test('a time item round-trips through metadata, and a plain score item is unchanged', () => {
  const metadata = withScoreConfig({ legacy: 'keep' }, timeRun);
  assert.equal(metadata.score_unit, 'time');
  assert.deepEqual(readScoreConfig(metadata), timeRun);
  assert.equal(readScoreConfig(withScoreConfig(metadata, range)).unit, undefined, 'turning back into a score drops the unit');
  assert.equal('score_unit' in withScoreConfig(metadata, range), false);
  assert.equal('score_unit' in withoutScoreConfig(metadata), false);
  assert.equal(validateScoreConfig(timeRun), null);
  assert.match(validateScoreConfig({ ...timeRun, pass: 0 }), /0:01/);
  assert.match(validateScore(TIME_MAX_SECONDS + 1, timeRun), /99:59/);
});

test('the tracking page offers a time kind that asks only for the pass time', () => {
  assert.match(page, /\{ scoreMode: true, timeMode: true, label: 'זמן \(ריצה\)' \}/);
  assert.match(page, /if \(form\.timeMode\) \{/);
  assert.match(page, /lowerIsBetter: true,\s*passInclusive: form\.passInclusive,\s*unit: 'time',/);
  assert.match(page, /const parsed = parseScoreInput\(scoreDraft, config\);/);
  assert.match(page, /placeholder=\{isTimeScore\(scoreDialogConfig\) \? '13:45' : '—'\}/);
  assert.equal((page.match(/formatScore\(score, scoreConfig\)/g) ?? []).length, 1, 'the sheet shows mm:ss (one sheet since 28.11.2026)');
});

test('MCP: a time item is created with pass_time and filled with a time', () => {
  const more = readFileSync('src/lib/mcp/writesMore.ts', 'utf8');
  assert.match(more, /type: z\.enum\(\['attendance', 'pass_fail', 'score', 'time'\]\)/);
  assert.match(more, /pass_time: z\.string\(\)/);
  assert.match(writes, /time: z\.string\(\)\.max\(12\)\.optional\(\)/);
  assert.match(writes, /const parsed = parseTimeInput\(args\.time\);/);
  assert.match(tools, /average: summary\.average !== null && isTimeScore\(config\) \? formatScore\(summary\.average, config\) : summary\.average,/);
});
