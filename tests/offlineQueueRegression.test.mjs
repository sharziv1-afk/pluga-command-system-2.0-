import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { ClosedForumReportError } from '../src/lib/concurrency/hierarchyWrite.ts';
import { TABLE_SYNC_CONFIG } from '../src/lib/offline/tableSyncConfig.ts';

// Execute the actual sync engine with isolated storage/network adapters. Its
// extensionless bundler imports cannot run in Node's native TS loader.
const compiled = ts.transpileModule(readFileSync('src/lib/offline/syncEngine.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(initial, resolveWrite = async () => {}, onLine = true) {
  const rows = new Map(initial.map(row => [row.id, structuredClone(row)]));
  const calls = [];
  const adapters = {
    '../concurrency/hierarchyWrite': {
      ClosedForumReportError,
      writeWithHierarchyResolution: async args => { calls.push(args); await resolveWrite(args); },
    },
    './db': {
      queueAdd: async row => rows.set(row.id, structuredClone(row)),
      queueGetAll: async () => [...rows.values()].map(row => structuredClone(row)),
      queueRemove: async id => rows.delete(id),
    },
    './tableSyncConfig': { TABLE_SYNC_CONFIG },
  };
  const exports = {};
  new Function('require', 'exports', 'navigator', compiled)(name => {
    assert.ok(name in adapters, `Unexpected dependency: ${name}`);
    return adapters[name];
  }, exports, { onLine });
  return { engine: exports, rows, calls };
}

const item = (id, authorUserId = 'mm-a', extra = {}) => ({
  id, authorUserId, table: 'forum_daily_reports', rowId: `report-${id}`,
  baseUpdatedAt: 'version-one', changes: { notes: { base: '', next: 'synthetic draft' } },
  baseSnapshot: { logistics: 'keep this' }, createdAt: 1, attempts: 0, ...extra,
});

test('offline replay never submits another account\'s queued edits', async () => {
  const h = harness([item('mine'), item('other', 'mm-b')]);
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 1, stillPending: 0, abandoned: 0 });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].currentUserId, 'mm-a');
  assert.deepEqual([...h.rows.keys()], ['other']);
});

test('being offline preserves every pending edit and its retry budget', async () => {
  const draft = item('mine', 'mm-a', { attempts: 4 });
  const h = harness([draft, item('other', 'mm-b')], async () => assert.fail('network attempted'), false);
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 0, stillPending: 1, abandoned: 0 });
  assert.deepEqual(h.rows.get('mine'), draft);
  assert.equal(h.calls.length, 0);
});

test('a closed forum draft survives repeated flushes and replays only after reopening', async () => {
  let closed = true;
  const h = harness([item('mine', 'mm-a', { attempts: 4 })], async () => {
    if (closed) throw new ClosedForumReportError();
  });
  for (let n = 0; n < 6; n += 1) {
    assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 0, stillPending: 1, abandoned: 0 });
    assert.equal(h.rows.get('mine').attempts, 4);
  }
  closed = false;
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 1, stillPending: 0, abandoned: 0 });
  assert.equal(h.rows.size, 0);
});

test('reconnect replays in creation order, keeps nested content, and does not replay twice', async () => {
  const h = harness([item('later', 'mm-a', { createdAt: 2 }), item('earlier')]);
  await h.engine.flushWriteQueue({}, 'mm-a');
  assert.deepEqual(h.calls.map(call => call.id), ['report-earlier', 'report-later']);
  assert.deepEqual(h.calls[0].buildPayload({ notes: 'edited' }), { content: { logistics: 'keep this', notes: 'edited' } });
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 0, stillPending: 0, abandoned: 0 });
  assert.equal(h.calls.length, 2);
});

test('a rejected online write remains queued until the documented retry limit', async () => {
  const h = harness([item('mine', 'mm-a', { attempts: 3 })], async () => { throw new Error('permission denied'); });
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 0, stillPending: 1, abandoned: 0 });
  assert.equal(h.rows.get('mine').attempts, 4);
  assert.deepEqual(await h.engine.flushWriteQueue({}, 'mm-a'), { applied: 0, stillPending: 0, abandoned: 1 });
});
