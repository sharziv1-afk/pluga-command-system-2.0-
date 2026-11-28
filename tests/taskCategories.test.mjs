import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TASK_CATEGORIES,
  PERSONAL_TASK_CATEGORY,
  isTaskCategory,
  taskCategoryOptions,
  assigneeForCategoryChange,
  personalTaskAssignee,
} from '../src/lib/taskCategories.ts';

/**
 * A task's category is a dropdown (13.11.2026), no longer free text. The list
 * holds "אישי" for a personal task and "חניכה" for tasks the mentoring log
 * creates. An older free-text value stays as an extra option.
 */

test('the list is the one the commander approved, with no duplicates', () => {
  assert.deepEqual([...TASK_CATEGORIES], ['מבצעי', 'לוגיסטיקה', 'מנהלה', 'חניכה', 'אישי', 'אחר']);
  assert.equal(new Set(TASK_CATEGORIES).size, TASK_CATEGORIES.length);
  assert.equal(PERSONAL_TASK_CATEGORY, 'אישי');
  assert.ok(isTaskCategory('חניכה'));
  assert.ok(!isTaskCategory('כשירות'));
  assert.ok(!isTaskCategory(undefined));
});

test('an older free-text category is kept as an extra option; listed or empty values add nothing', () => {
  assert.deepEqual(taskCategoryOptions(), [...TASK_CATEGORIES]);
  assert.deepEqual(taskCategoryOptions(''), [...TASK_CATEGORIES]);
  assert.deepEqual(taskCategoryOptions(null), [...TASK_CATEGORIES]);
  assert.deepEqual(taskCategoryOptions('לוגיסטיקה'), [...TASK_CATEGORIES]);
  assert.deepEqual(taskCategoryOptions('כשירות'), [...TASK_CATEGORIES, 'כשירות']);
});

test('picking "אישי" in a create form assigns the task to its creator', () => {
  assert.equal(assigneeForCategoryChange({ category: 'אישי', assignedTo: 'none', creatorId: 'me' }), 'me');
  assert.equal(assigneeForCategoryChange({ category: 'אישי', assignedTo: 'other', creatorId: 'me' }), 'me');
  assert.equal(assigneeForCategoryChange({ category: 'מבצעי', assignedTo: 'other', creatorId: 'me' }), 'other');
  assert.equal(assigneeForCategoryChange({ category: 'אישי', assignedTo: 'none', creatorId: null }), 'none');
});

test('MCP: a personal task with no assignee goes to the caller; a named assignee is kept', () => {
  assert.equal(personalTaskAssignee({ category: 'אישי', assignedTo: null, creatorId: 'me' }), 'me');
  assert.equal(personalTaskAssignee({ category: 'אישי', assignedTo: 'other', creatorId: 'me' }), 'other');
  assert.equal(personalTaskAssignee({ category: 'מבצעי', assignedTo: null, creatorId: 'me' }), null);
  assert.equal(personalTaskAssignee({ category: undefined, assignedTo: null, creatorId: 'me' }), null);
});

test('every place that sets a task category uses the shared list', () => {
  const tasksPage = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
  const dashboard = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');
  const mcp = readFileSync('src/lib/mcp/writes.ts', 'utf8');
  const mentoring = readFileSync('src/components/mentoring/MentoringPanel.tsx', 'utf8');

  // Create and edit forms on /tasks are dropdowns, and the edit form keeps an old value.
  assert.match(tasksPage, /value=\{category\}[\s\S]{0,1200}taskCategoryOptions\(category\)/);
  assert.match(tasksPage, /value=\{editCategory\}[\s\S]{0,1200}taskCategoryOptions\(editCategory\)/);
  assert.doesNotMatch(tasksPage, /placeholder="לוגיסטיקה \/ כשירות \/ מנהלה"/);
  assert.match(tasksPage, /assigneeForCategoryChange\(/);

  // The dashboard quick-create saves the category and assigns "אישי" to me.
  assert.match(dashboard, /category: taskForm\.category \|\| undefined,/);
  assert.match(dashboard, /assigneeForCategoryChange\(/);

  // MCP create_task takes the list as an optional enum.
  assert.match(mcp, /category: z\.enum\(TASK_CATEGORIES\)\.optional\(\)/);
  assert.doesNotMatch(mcp, /category: z\.string\(\)\.max\(100\)/);
  assert.match(mcp, /personalTaskAssignee\(\{ category: args\.category, assignedTo: assignee\.id, creatorId: c\.profile\.id \}\)/);

  // The mentoring log's category is on the list.
  const mentoringCategory = mentoring.match(/metadata: \{ category: '([^']+)'/)?.[1];
  assert.ok(mentoringCategory && isTaskCategory(mentoringCategory), `mentoring category ${mentoringCategory} is not on the list`);
});
