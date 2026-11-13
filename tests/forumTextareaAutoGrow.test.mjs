import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitTextareaHeight, supportsFieldSizing, withScrollPreserved } from '../src/lib/ui/autoGrow.ts';

const forumPage = readFileSync(new URL('../src/app/(protected)/forum/page.tsx', import.meta.url), 'utf8');
const component = readFileSync(new URL('../src/components/ui/AutoGrowTextarea.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

// A fake textarea: scrollHeight is content + padding, 1px borders top and bottom.
function fakeTextarea(contentPlusPadding, { border = 2, parentElement = null } = {}) {
  const el = {
    style: { height: '' },
    get scrollHeight() { return contentPlusPadding; },
    get clientHeight() { return contentPlusPadding; },
    get offsetHeight() { return contentPlusPadding + border; },
    parentElement,
  };
  return el;
}

test('the box grows to the full text height plus borders — no inner scrollbar', () => {
  const el = fakeTextarea(412);
  assert.equal(fitTextareaHeight(el), 414);
  assert.equal(el.style.height, '414px');
});

test('it shrinks back when text is deleted (height is re-measured from auto)', () => {
  let content = 600;
  const el = {
    style: { height: '602px' },
    get scrollHeight() { return this.style.height === 'auto' ? content : Math.max(content, parseInt(this.style.height, 10) - 2); },
    get clientHeight() { return this.scrollHeight; },
    get offsetHeight() { return this.scrollHeight + 2; },
  };
  content = 120;
  assert.equal(fitTextareaHeight(el), 122);
});

test('a hidden box (closed <details>) keeps the CSS min-height instead of 0px', () => {
  const el = { style: { height: '300px' }, scrollHeight: 0, clientHeight: 0, offsetHeight: 0 };
  assert.equal(fitTextareaHeight(el), null);
  assert.equal(el.style.height, '');
});

test('field-sizing detection decides between CSS and the JS fallback', () => {
  assert.equal(supportsFieldSizing({ supports: (p, v) => p === 'field-sizing' && v === 'content' }), true);
  assert.equal(supportsFieldSizing({ supports: () => false }), false, 'older Safari/iOS → JS fallback');
  assert.equal(supportsFieldSizing(undefined), false);
  assert.equal(supportsFieldSizing({ supports: () => { throw new Error('x'); } }), false);
});

test('re-measuring never makes the page jump (scrolled ancestors are restored)', () => {
  const main = { scrollTop: 900, parentElement: null };
  const card = { scrollTop: 0, parentElement: main };
  const el = fakeTextarea(200, { parentElement: card });
  withScrollPreserved(el, () => { main.scrollTop = 350; });
  assert.equal(main.scrollTop, 900);
  assert.equal(card.scrollTop, 0);
});

test('every editable forum text box auto-grows; only read-only previews stay plain', () => {
  assert.match(forumPage, /import \{ AutoGrowTextarea \} from '@\/components\/ui\/AutoGrowTextarea';/);
  const plain = forumPage.split('\n').filter(line => /<textarea\b/.test(line));
  for (const line of plain) assert.match(line, /\breadOnly\b/, `editable plain <textarea> left behind: ${line.trim()}`);
  const grown = forumPage.match(/<AutoGrowTextarea\b/g) ?? [];
  // post body, post edit, 4 company summary fields, staff notes, platoon primary + secondary fields, מ״פ closing
  assert.ok(grown.length >= 7, `expected ≥7 auto-grow boxes, got ${grown.length}`);
  for (const line of forumPage.split('\n').filter(l => l.includes('<AutoGrowTextarea'))) {
    assert.match(line, /min-h-(2[4-9]|3\d)\b/, `needs a comfortable minimum height: ${line.trim()}`);
  }
});

test('the component re-measures on value change, width change and window resize', () => {
  assert.match(component, /useLayoutEffect\(\(\) => \{\s*resize\(\);\s*\}, \[value, resize\]\)/, 'value changes (typing, load, carry-over)');
  assert.match(component, /new ResizeObserver/);
  assert.match(component, /addEventListener\('resize', resize\)/);
  assert.match(component, /auto-grow-textarea/);
});

test('CSS uses field-sizing: content with no inner scrollbar', () => {
  const rule = css.match(/\.auto-grow-textarea\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /field-sizing:\s*content/);
  assert.match(rule, /overflow-y:\s*hidden/);
});
