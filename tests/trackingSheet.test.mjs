import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Tracking made easier to work with (מ״פ, 28.11.2026), every option kept:
 * one spreadsheet-like sheet on the phone and the computer, the add actions
 * behind one "+", a row's or a column's edit/remove behind a tap on its name,
 * and a new item is a name, a week and a kind — the rest folded away.
 */

const page = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');
const sheet = page.slice(page.indexOf('tracking-sheet'), page.indexOf('</table>') + 8);

test('one sheet for phone and computer: no separate card view, sticky names and titles', () => {
  assert.doesNotMatch(page, /md:hidden/, 'no phone-only card view');
  assert.doesNotMatch(page, /hidden max-w-full overflow-x-auto pb-2 md:block/, 'no computer-only table');
  assert.equal((page.match(/<table\b/g) ?? []).length, 1);
  assert.match(sheet, /max-h-\[70svh\] max-w-full overflow-auto/, 'scrolls both ways inside the card');
  assert.match(sheet, /sticky right-0 top-0 z-30/, 'the corner stays');
  assert.match(sheet, /sticky top-0 z-20/, 'item titles stay on top');
  assert.match(sheet, /sticky right-0 z-10/, 'names stay on the right');
});

test('a tap marks a cell; a long press or right-click opens its note; a hold never also marks', () => {
  assert.match(sheet, /\{\.\.\.cellPressHandlers\(\(\) => openCellNote\(soldier, item, record\)\)\}/);
  assert.match(sheet, /if \(consumeLongPress\(\)\) return;\s*if \(scoreConfig\) openScoreDialog\(soldier, item, record \?\? null\);\s*else void handleCycleCellStatus\(soldier, item, record\);/);
  const handlers = page.slice(page.indexOf('const cellPressHandlers'), page.indexOf('const openCellNote'));
  assert.match(handlers, /}, 450\);/);
  assert.match(handlers, /onPointerCancel: clearLongPress/, 'scrolling cancels the hold');
  assert.match(handlers, /onContextMenu: \(event: React\.MouseEvent\) => \{\s*event\.preventDefault\(\);/);
  assert.match(css, /\.tracking-cell \{[^}]*-webkit-touch-callout: none;[^}]*user-select: none;/, 'no iOS callout or text selection on a hold');
  assert.match(sheet, /record\?\.note && \(/, 'a dot marks a cell with a note');
});

test('every action is kept: edit and remove behind a tap on a name or a title', () => {
  assert.match(sheet, /onClick=\{\(\) => setSheetMenu\(\{ kind: 'item', item \}\)\}/);
  assert.match(sheet, /onClick=\{\(\) => setSheetMenu\(\{ kind: 'soldier', soldier \}\)\}/);
  assert.doesNotMatch(sheet, /<Trash2|<Pencil/, 'no icons on every row and column any more');
  const run = page.slice(page.indexOf('const runSheetMenu'), page.indexOf('const addActions'));
  for (const call of ['openEditSoldier(menu.soldier)', 'requestRemoveSoldier(menu.soldier)', 'openEditItem(menu.item)', 'requestRemoveItem(menu.item)']) {
    assert.ok(run.includes(call), call);
  }
});

test('the add actions sit behind one "+", each with its old toggle; export stays its own button', () => {
  const actions = page.slice(page.indexOf('const addActions'), page.indexOf('const headerActions'));
  assert.match(actions, /isItemFormOpen && !editingItem \? closeItemForm\(\) : openCreateItem\(\)/);
  assert.match(actions, /isSoldierFormOpen && !editingSoldier \? closeSoldierForm\(\) : openCreateSoldier\(\)/);
  assert.match(actions, /openWeekDialog\(null\)/);
  const header = page.slice(page.indexOf('const headerActions'), page.indexOf('const scoreDialogConfig'));
  assert.match(header, /aria-haspopup="menu"/);
  assert.match(header, /ייצוא לאקסל/);
});

test('a new item asks for a name, a week and a kind; category, subject, order and description are folded, not gone', () => {
  const form = page.slice(page.indexOf('onSubmit={handleSubmitItem}'), page.indexOf('{editingItem ? \'שמור שינויים\' : \'שמור מופע\'}'));
  const details = form.slice(form.indexOf('<details'), form.indexOf('</details>'));
  for (const label of ['קטגוריה', 'נושא', 'סדר תצוגה', 'תיאור']) assert.ok(details.includes(`>${label}</span>`), label);
  assert.ok(form.indexOf('שם מופע') < form.indexOf('<details'));
  assert.ok(form.indexOf('שבוע מעקב') < form.indexOf('<details'));
  assert.ok(form.indexOf('role="radiogroup"') < form.indexOf('<details'), 'the kind comes before the folded settings');
});

test('on a phone the add menu opens leftwards from the button, inside the screen', () => {
  // 28.11.2026: on a phone the button sits at the right edge (RTL) and the
  // menu, anchored left-0, opened rightwards off the screen.
  const header = page.slice(page.indexOf('const headerActions'), page.indexOf('const scoreDialogConfig'));
  assert.match(header, /role="menu"\s*className="absolute right-0 top-full z-50 mt-2 w-52 max-w-\[calc\(100vw-2rem\)\][^"]*sm:left-0 sm:right-auto"/);
});
