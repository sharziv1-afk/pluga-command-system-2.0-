import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jerusalemLocalToIso, matchByName, trackingCodeFromLabel, MCP_ORIGIN } from '../src/lib/mcp/shape.ts';

test('Israel wall-clock times convert to UTC across the IDT/IST switch', () => {
  // October 21, 2026 is still summer time (UTC+3); December is winter (UTC+2).
  assert.equal(jerusalemLocalToIso('2026-10-21 08:00'), '2026-10-21T05:00:00.000Z');
  assert.equal(jerusalemLocalToIso('2026-12-01T08:00'), '2026-12-01T06:00:00.000Z');
  assert.equal(jerusalemLocalToIso('2026-12-01'), '2026-12-01T07:00:00.000Z'); // date only = 09:00
  assert.equal(jerusalemLocalToIso('2026-10-21T05:00:00Z'), '2026-10-21T05:00:00.000Z');
  assert.throws(() => jerusalemLocalToIso('tomorrow at 8'));
});

test('names resolve exactly, then uniquely by substring, and never by guess', () => {
  const people = [{ n: 'סג"ם נועה שגיא (מ"מ 2)' }, { n: 'סג"ם תומר אדרי (מ"מ 3)' }, { n: 'סג״ם דניאל אשכנזי (מ״מ 1)' }];
  assert.equal(matchByName(people, 'נועה', (p) => p.n).match?.n, people[0].n);
  assert.equal(matchByName(people, 'מ״מ 3', (p) => p.n).match?.n, people[1].n); // gershayim-insensitive
  const amb = matchByName(people, 'סג"ם', (p) => p.n);
  assert.equal(amb.match, null);
  assert.equal(amb.candidates.length, 3);
  assert.equal(matchByName(people, 'אין כזה', (p) => p.n).match, null);
});

test('tracking labels map to the stored codes', () => {
  assert.equal(trackingCodeFromLabel('עבר'), 'passed');
  assert.equal(trackingCodeFromLabel('לא עבר'), 'failed');
  assert.equal(trackingCodeFromLabel('השלמה'), 'makeup');
  assert.equal(trackingCodeFromLabel('ריק'), 'empty');
  assert.throws(() => trackingCodeFromLabel('מצוין'));
  assert.equal(MCP_ORIGIN, 'mcp');
});

const writes = readFileSync('src/lib/mcp/writes.ts', 'utf8');
const migration = readFileSync('supabase/migrations/035_mcp_oauth_write_limits.sql', 'utf8');
const route = readFileSync('src/app/api/mcp/route.ts', 'utf8');

test('write tools touch only the tables migration 035 allows', () => {
  const tables = [...writes.matchAll(/\.from\('([a-z_]+)'\)\s*\.(insert|update|delete|upsert)\(/g)].map((m) => m[1]);
  const dynamic = [...writes.matchAll(/\.from\(table\)\s*\.(update|delete)\(/g)];
  assert.ok(tables.length >= 6);
  for (const t of tables) assert.ok(['tasks', 'requests', 'events', 'tracking_records', 'mentoring_entries'].includes(t), `unexpected write to ${t}`);
  assert.ok(dynamic.length >= 2, 'delete tool writes via the tasks/requests/events table variable');
  assert.match(writes, /const table = type === 'task' \? 'tasks' : type === 'request' \? 'requests' : 'events';/);
  assert.doesNotMatch(writes, /\.upsert\(/);
});

test('every update/delete is checked for a real row, and every insert carries the origin marker', () => {
  const mutations = writes.match(/\.(update|delete)\([^)]*\)[\s\S]{0,400}?\.select\('id'\)/g) ?? [];
  const rawMutations = writes.match(/\.(update|delete)\(/g) ?? [];
  assert.equal(mutations.length, rawMutations.length, 'each .update/.delete is followed by .select(\'id\')');
  assert.ok((writes.match(/didRowsUpdate\(/g) ?? []).length >= rawMutations.length);
  const inserts = writes.match(/\.insert\(\{[\s\S]*?\}\)\s*\.select/g) ?? [];
  assert.equal(inserts.length, 5, 'tasks, requests, events, tracking_records, mentoring_entries');
  for (const ins of inserts) assert.match(ins, /created_via: MCP_ORIGIN|creatorMeta\(c, ctx\)|metadata,/, ins.slice(0, 80));
  assert.match(writes, /created_via: MCP_ORIGIN,\n\s+mcp_client_id/);
});

test('delete is limited to MCP-created rows, follows the closed-only rule, and is marked destructive', () => {
  assert.match(writes, /if \(meta\.created_via !== MCP_ORIGIN\) return fail/);
  assert.match(writes, /if \(row\.created_via !== MCP_ORIGIN\) return fail/);
  assert.match(writes, /update\(\{ status: 'cancelled' \}\)/);
  const destructive = writes.match(/annotations: DESTRUCTIVE/g) ?? [];
  assert.equal(destructive.length, 1);
  assert.match(writes, /'delete_mcp_item'[\s\S]*annotations: DESTRUCTIVE/);
  assert.match(writes, /readOnlyHint: false, destructiveHint: true/);
});

test('mentoring writes are gated to the מ״פ and every write is audited', () => {
  assert.match(writes, /if \(!isCompanyCommander\(c\.profile\.role\)\) return fail/);
  const audits = writes.match(/await audit\(c, ctx,/g) ?? [];
  assert.ok(audits.length >= 9);
  assert.match(writes, /via: MCP_ORIGIN, mcp_client_id: clientIdOf\(ctx\)/);
});

test('migration 035 restricts OAuth tokens without touching first-party sessions', () => {
  assert.match(migration, /coalesce\(auth\.jwt\(\) ->> 'client_id', ''\) <> ''/);
  for (const t of ['tasks', 'requests', 'events']) {
    assert.match(migration, new RegExp(`create policy "oauth: delete only mcp-created" on public\\.${t}\\s+as restrictive for delete`));
  }
  assert.match(migration, /on public\.mentoring_entries\s+as restrictive for delete to authenticated\s+using \(not public\.is_oauth_client_request\(\) or coalesce\(created_via, ''\) = 'mcp'\)/);
  for (const t of ['users', 'units', 'roles', 'forum_daily_reports', 'soldiers', 'tracking_items', 'gaps']) {
    assert.match(migration, new RegExp(`'${t}'`));
  }
  assert.match(migration, /as restrictive for insert to authenticated with check \(not public\.is_oauth_client_request\(\)\)/);
  assert.match(migration, /raise exception 'created_via cannot be changed by an OAuth client'/);
  for (const t of ['tasks', 'requests', 'events', 'mentoring_entries']) {
    assert.match(migration, new RegExp(`before update on public\\.${t}\\s+for each row execute function public\\.guard_mcp_origin_marker\\(\\)`));
  }
  assert.doesNotMatch(migration, /as permissive|for all to authenticated using \(true\)/i);
});

test('the endpoint registers write tools behind the same auth', () => {
  assert.match(route, /registerWriteTools\(server\)/);
  assert.match(route, /withMcpAuth\(handler, verifyMcpToken, \{\s*required: true/);
});
