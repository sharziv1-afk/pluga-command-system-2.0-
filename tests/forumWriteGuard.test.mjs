import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ClosedForumReportError, writeWithHierarchyResolution } from '../src/lib/concurrency/hierarchyWrite.ts';

// In-memory PostgREST double: no accounts, network, or production writes.
function clientFor(initial, afterRead) {
  let row = structuredClone(initial);
  let writes = 0;
  const client = {
    from() {
      let payload;
      const filters = [];
      const query = {
        update(value) { payload = value; return query; },
        eq(key, value) { filters.push(r => r[key] === value); return query; },
        neq(key, value) { filters.push(r => r[key] !== value); return query; },
        select() {
          if (!payload) return query;
          if (!filters.every(filter => filter(row))) return Promise.resolve({ data: [], error: null });
          row = { ...row, ...payload };
          writes += 1;
          return Promise.resolve({ data: [{ id: row.id }], error: null });
        },
        async maybeSingle() {
          const snapshot = structuredClone(row);
          if (afterRead) {
            row = afterRead(row);
            afterRead = null;
          }
          return { data: snapshot, error: null };
        },
      };
      return query;
    },
    async rpc() { return { data: false, error: null }; },
  };
  return { client, row: () => row, writes: () => writes };
}

const source = {
  id: 'synthetic-report', updated_at: 'v2', updated_by: 'mp',
  status: 'in_progress', content: { notes: 'server' },
};

function save(fake, overrides = {}) {
  return writeWithHierarchyResolution({
    supabase: fake.client, table: 'forum_daily_reports', id: source.id,
    baseUpdatedAt: 'v1', currentUserId: 'mm',
    changes: { notes: { base: 'server', next: 'local draft' } },
    // Offline replay currently does not request status; the guard must add it.
    selectColumns: 'content,updated_by', extractFields: row => row.content,
    buildPayload: fields => ({ content: fields }), ...overrides,
  });
}

test('a closed report cannot take the fast write path, even with a matching timestamp', async () => {
  const fake = clientFor({ ...source, status: 'closed' });
  await assert.rejects(save(fake, { baseUpdatedAt: 'v2' }), /closed|נסגר/);
  assert.equal(fake.writes(), 0);
  assert.equal(fake.row().content.notes, 'server');
});

test('a stale MM draft cannot change content after the MP closes the report', async () => {
  const fake = clientFor({ ...source, status: 'closed' });
  await assert.rejects(save(fake), /closed|נסגר/);
  assert.equal(fake.writes(), 0);
  assert.equal(fake.row().status, 'closed');
  assert.equal(fake.row().content.notes, 'server');
});

test('closing between the conflict read and merge also prevents a stale save', async () => {
  const fake = clientFor(source, row => ({ ...row, status: 'closed', updated_at: 'v3' }));
  await assert.rejects(save(fake), /closed|נסגר/);
  assert.equal(fake.writes(), 0);
  assert.equal(fake.row().content.notes, 'server');
});

test('an open MM report still saves through the existing conflict resolver', async () => {
  const fake = clientFor(source);
  assert.equal((await save(fake)).status, 'merged');
  assert.equal(fake.writes(), 1);
  assert.equal(fake.row().content.notes, 'local draft');
});

test('the MP retains a competing field edit on an open report', async () => {
  const fake = clientFor({ ...source, content: { notes: 'MP change' } });
  const result = await save(fake);
  assert.deepEqual(result.overriddenFields, ['notes']);
  assert.equal(fake.row().content.notes, 'MP change');
});

test('the forum lock does not restrict writes to unrelated tables', async () => {
  const fake = clientFor({ ...source, status: 'completed' });
  await save(fake, { table: 'tasks', baseUpdatedAt: 'v2' });
  assert.equal(fake.writes(), 1);
});

test('a lock failure is distinguishable from a terminal rejected offline write', async () => {
  const fake = clientFor({ ...source, status: 'closed' });
  await assert.rejects(save(fake), ClosedForumReportError);
});

test('offline replay keeps locked drafts without counting an attempt or removing them', () => {
  const source = readFileSync('src/lib/offline/syncEngine.ts', 'utf8');
  const start = source.indexOf('if (error instanceof ClosedForumReportError)');
  const end = source.indexOf('// Connectivity can drop', start);
  assert.ok(start > 0 && end > start);
  const lockedPath = source.slice(start, end);
  assert.match(lockedPath, /stillPending \+= 1;/);
  assert.match(lockedPath, /continue;/);
  assert.doesNotMatch(lockedPath, /queueRemove|attempts/);
});
