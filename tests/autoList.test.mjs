import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAutoList } from '../src/lib/ui/autoList.ts';

/** Types one character at the caret, the way the textarea would, then applies the rule. */
function type(value, caret, char) {
  const next = value.slice(0, caret) + char + value.slice(caret);
  return applyAutoList(value, next, caret + 1) ?? { value: next, caret: caret + 1 };
}

test('Enter after a numbered item starts the next number', () => {
  const v = '1. לבדוק ציוד';
  assert.deepEqual(type(v, v.length, '\n'), { value: '1. לבדוק ציוד\n2. ', caret: v.length + 4 });
  const w = '9) תדריך';
  assert.equal(type(w, w.length, '\n').value, '9) תדריך\n10) ');
  const indented = 'כותרת\n  3. שורה';
  assert.equal(type(indented, indented.length, '\n').value, 'כותרת\n  3. שורה\n  4. ');
});

test('"* " becomes a bullet, and Enter continues it', () => {
  const afterStar = type('*', 1, ' ');
  assert.deepEqual(afterStar, { value: '• ', caret: 2 });
  const line = '• מטווח';
  assert.equal(type(line, line.length, '\n').value, '• מטווח\n• ');
  const dash = '- שמירה';
  assert.equal(type(dash, dash.length, '\n').value, '- שמירה\n- ');
  assert.equal(type('a*', 2, ' ').value, 'a* ', 'only a star alone at the start of a line');
  assert.equal(type('שורה\n*', 6, ' ').value, 'שורה\n• ');
});

test('Enter on an empty item ends the list', () => {
  const v = '1. א\n2. ';
  assert.deepEqual(type(v, v.length, '\n'), { value: '1. א\n', caret: 5 });
  const b = '• א\n• ';
  assert.deepEqual(type(b, b.length, '\n'), { value: '• א\n', caret: 4 });
});

test('plain text, pastes and deletions are left alone', () => {
  assert.equal(applyAutoList('שלום', 'שלום\n', 5), null);
  assert.equal(applyAutoList('1. א', '1. א\nב\n', 7), null, 'a paste of several characters');
  assert.equal(applyAutoList('1. אב', '1. א', 4), null, 'a deletion');
  assert.equal(applyAutoList('2024. שנה', '2024. שנה\n', 10), null, 'not a list number');
  assert.equal(applyAutoList('1.5 ק״ג', '1.5 ק״ג\n', 8), null, 'a decimal is not a list');
});

test('the forum report fields use it', () => {
  const textarea = readFileSync('src/components/ui/AutoGrowTextarea.tsx', 'utf8');
  assert.match(textarea, /applyAutoList\(previousValue\.current, el\.value, el\.selectionStart \?\? el\.value\.length\)/);
  const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const fields = forum.match(/<AutoGrowTextarea\b/g) ?? [];
  const withList = forum.match(/<AutoGrowTextarea autoList\b/g) ?? [];
  assert.ok(fields.length > 0);
  assert.equal(withList.length, fields.length, 'every forum report field');
});
