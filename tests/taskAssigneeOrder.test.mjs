import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyRoleRank, sortByCompanyHierarchy } from '../src/lib/roleOrder.ts';

const page = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');

/**
 * Requested by the מ״פ on 28.10.2026: the task assignee list follows the
 * company hierarchy — מ״פ, סמ״פ, מפל״ג, the rest of the company staff, then
 * each platoon in turn (מ״מ, סמל, מ״כ א-ג) — and linking a task to an event
 * fills the due date with the event's time, which can still be changed.
 */

test('assignees sort by company hierarchy, platoon by platoon', () => {
  // The LIVE roster as stored (mixed ״ and " quotes), shuffled.
  const roster = [
    'מ״כ 2א', 'סמל 1', 'מ"מ 2', 'ב.קוד / נהג', 'מ״כ 1ב', 'סמ"פ', 'מ״מ 1', 'סמל 2',
    'מ״כ 1א', 'מש"ד', 'מ"פ', 'מפל״ג', 'סרס״פ א׳', 'מ״כ 1ג', 'רס"פ / לוגיסטיקה', 'תפקיד לא מוכר',
  ].map((role, index) => ({ role, name: `שם ${index}` }));

  assert.deepEqual(sortByCompanyHierarchy(roster).map(person => person.role), [
    'מ"פ', 'סמ"פ', 'מפל״ג', 'מש"ד', 'רס"פ / לוגיסטיקה', 'סרס״פ א׳', 'ב.קוד / נהג',
    'מ״מ 1', 'סמל 1', 'מ״כ 1א', 'מ״כ 1ב', 'מ״כ 1ג',
    'מ"מ 2', 'סמל 2', 'מ״כ 2א',
    'תפקיד לא מוכר',
  ]);
});

test('role spelling variants rank the same', () => {
  assert.equal(companyRoleRank('מ"כ א1'), companyRoleRank('מ״כ 1א'));
  assert.equal(companyRoleRank('מ״כ  1א'), companyRoleRank('מ״כ 1א'));
  assert.equal(companyRoleRank('ב.קוד/נהג'), companyRoleRank('ב.קוד / נהג'));
  assert.equal(companyRoleRank('ע.חובש פלוגתי'), companyRoleRank('ע. חובש פלוגתי'));
  assert.ok(companyRoleRank('מ״כ 4ג') < companyRoleRank('לא ידוע'));
});

test('same role sorts by name, and the input is not mutated', () => {
  const people = [{ role: 'סמל 1', name: 'ת' }, { role: 'סמל 1', name: 'א' }];
  assert.deepEqual(sortByCompanyHierarchy(people).map(p => p.name), ['א', 'ת']);
  assert.equal(people[0].name, 'ת');
});

test('the tasks page sorts the assignee list it loads', () => {
  assert.match(page, /setAssignableUsers\(sortByCompanyHierarchy\(assignableUsersResult\.data \?\? \[\]\)\)/);
});

test('picking an event fills the due date in both the new and the edit form', () => {
  assert.match(page, /function dueAtForLinkedEvent\(eventId: string, events: Pick<EventOption, 'id' \| 'starts_at'>\[\], currentDueAt: string\)/);
  assert.match(page, /if \(eventId === 'none'\) return currentDueAt;/);
  assert.match(page, /return startsAt \? formatDateTimeLocalInput\(startsAt\) : currentDueAt;/);
  assert.match(page, /setDueAt\(current => dueAtForLinkedEvent\(eventId, eventOptions, current\)\)/);
  assert.match(page, /setEditDueAt\(current => dueAtForLinkedEvent\(eventId, editEventOptions, current\)\)/);
  // The date input stays editable.
  assert.match(page, /onChange=\{\(event\) => setDueAt\(event\.target\.value\)\}/);
  assert.match(page, /onChange=\{\(event\) => setEditDueAt\(event\.target\.value\)\}/);
  assert.equal((page.match(/בשיוך למופע התאריך מתעדכן לשעת המופע — אפשר לשנות/g) ?? []).length, 2);
});
