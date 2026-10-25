import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseScoreInput,
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
  const cellClicks = page.match(/onClick=\{\(\) => \(scoreConfig \? openScoreDialog\(soldier, item, record \?\? null\) : void handleCycleCellStatus\(soldier, item, record\)\)\}/g) ?? [];
  assert.equal(cellClicks.length, 2, 'both the mobile and the desktop cell route score items to the score dialog');
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
  assert.match(page, /if \(editingItem && !!previousScoreConfig !== !!scoreConfig\) \{/);
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
