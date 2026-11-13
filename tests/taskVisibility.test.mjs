import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { taskUnitIdFor } from '../src/lib/taskVisibility.ts';

/**
 * A personal task (created by and assigned to the same person) is saved with
 * no unit, so unit staff do not see it (08.11.2026). Who sees a task is
 * decided by RLS (002): creator, assignee, commanders, and the task's unit.
 */

test('a task I give to myself has no unit; every other task keeps its creator\'s unit', () => {
  assert.equal(taskUnitIdFor({ createdBy: 'a', assignedTo: 'a', creatorUnitId: 'company' }), null);
  assert.equal(taskUnitIdFor({ createdBy: 'a', assignedTo: 'b', creatorUnitId: 'company' }), 'company');
  assert.equal(taskUnitIdFor({ createdBy: 'a', assignedTo: null, creatorUnitId: 'company' }), 'company');
  assert.equal(taskUnitIdFor({ createdBy: 'a', assignedTo: undefined, creatorUnitId: undefined }), null);
  assert.equal(taskUnitIdFor({ createdBy: null, assignedTo: null, creatorUnitId: 'company' }), 'company');
});

test('every place that creates a task uses it', () => {
  const tasksPage = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
  const dashboard = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');
  const mcp = readFileSync('src/lib/mcp/writes.ts', 'utf8');
  assert.match(tasksPage, /const taskUnitId = taskUnitIdFor\(\{\s*createdBy: dbProfile\.id,\s*assignedTo: assignedTo === 'none' \? null : assignedTo,/);
  assert.match(dashboard, /unit_id: taskUnitIdFor\(\{ createdBy: profile\.id, assignedTo, creatorUnitId: profile\.unit_id \}\),/);
  assert.match(mcp, /unit_id: taskUnitIdFor\(\{ createdBy: c\.profile\.id, assignedTo, creatorUnitId: c\.profile\.unit_id \}\),\s*assigned_to: assignedTo,/);
  // No task insert still passes the raw unit.
  assert.doesNotMatch(mcp, /unit_id: c\.profile\.unit_id,\s*assigned_to: assignee\.id/);
  assert.doesNotMatch(dashboard, /unit_id: profile\.unit_id,\s*event_id: eventId,\s*due_at: dueAt,\s*completed_at: null/);
});
