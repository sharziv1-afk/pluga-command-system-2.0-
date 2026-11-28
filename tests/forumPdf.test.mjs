import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  buildImagePdf,
  fitText,
  forumPdfFileName,
  layoutForumPdf,
  wrapText,
} from '../src/lib/forum/pdfExport.ts';

/**
 * Forum report → PDF for Notability, in the company's own landscape template
 * (מ״פ, 28.11.2026): a מפל״ג page and a platoons page, the framework table
 * with nine columns. A cell takes the report's text only when there is text;
 * an empty one is left with writing lines for the pen.
 */

// Every character is half its font size wide — enough to test the layout.
const measure = (text, size) => [...text].length * size * 0.5;

const COLUMNS = ['כוח אדם', 'כוננות', 'ת״ש', 'רפואה', 'בטיחות', 'משמעת', 'בקשות אישיות', 'תכנון מול ביצוע', 'לקח יומי'];
const empty = () => COLUMNS.map(() => '');
const model = (overrides = {}) => ({
  title: 'פורום מוביל — 28.11.2026',
  date: '28.11.2026',
  columns: COLUMNS,
  staffRow: { label: 'מפל״ג', cells: empty() },
  staffBoxes: ['חופ״ל', 'רס״פ', 'משה״ד', 'סמ״פ'].map((title) => ({ title, body: '' })),
  commanderBoxes: [{ title: 'משמעויות עולות', body: '' }, { title: 'דגשים שלי', body: '' }],
  platoonRows: [1, 2, 3, 4].map((n) => ({ label: `מחלקה ${n}`, cells: empty() })),
  extras: [],
  ...overrides,
});
const texts = (page) => page.filter((op) => op.kind === 'text').map((op) => op.text);
const rules = (page) => page.filter((op) => op.kind === 'line' && op.color === '#B9B293');

test('lines wrap to the width, keep the writer\'s line breaks, and cut an over-long word', () => {
  assert.deepEqual(wrapText('אחת שתיים שלוש ארבע', 30, 10, false, measure), ['אחת', 'שתיים', 'שלוש', 'ארבע']);
  assert.deepEqual(wrapText('שורה א\nשורה ב', 1000, 10, false, measure), ['שורה א', 'שורה ב']);
  assert.deepEqual(wrapText('אבגדהוזחטי', 20, 10, false, measure), ['אבגד', 'הוזח', 'טי']);
  for (const line of wrapText('מילה '.repeat(80), 200, 12, false, measure)) assert.ok(measure(line, 12) <= 200, line);
});

test('text shrinks to fit a cell, and is cut with "…" only below the smallest size', () => {
  const short = fitText('תקין', 60, 80, measure);
  assert.equal(short.size, 9);
  assert.equal(short.overflow, false);
  const medium = fitText('מילה '.repeat(30), 60, 80, measure);
  assert.ok(medium.size < 9 && !medium.overflow, `size ${medium.size}`);
  const huge = fitText('מילה '.repeat(400), 60, 80, measure);
  assert.equal(huge.overflow, true);
  assert.ok(huge.lines.at(-1).endsWith('…'));
  assert.ok(huge.lines.length * huge.lineHeight <= 80 + huge.lineHeight);
});

test('an empty forum: the two template pages, landscape, every cell and box left for the pen', () => {
  const pages = layoutForumPdf(model(), measure);
  assert.equal(pages.length, 2, 'no extra page when nothing else was written');
  assert.ok(PAGE_WIDTH > PAGE_HEIGHT, 'landscape');
  const [staff, platoons] = pages;
  for (const title of ['פורום מוביל', 'תאריך: 28.11.2026', 'מסגרת', 'מפל״ג', 'חופ״ל', 'רס״פ', 'משה״ד', 'סמ״פ', 'משמעויות עולות', 'דגשים שלי']) {
    assert.ok(texts(staff).includes(title), title);
  }
  for (const n of [1, 2, 3, 4]) assert.ok(texts(platoons).includes(`מחלקה ${n}`));
  // Headers wrap to two lines when needed ("תכנון מול" / "ביצוע").
  assert.ok(texts(platoons).includes('כוח אדם'));
  // 9 cells × 4 rows on the platoons page, each with writing lines.
  assert.ok(rules(platoons).length >= 36 * 3, `${rules(platoons).length} writing lines`);
  assert.ok(rules(staff).length >= 9 + 6 * 4);
  // Nothing outside the page.
  for (const page of pages) {
    for (const op of page) {
      if (op.kind === 'text') assert.ok(op.y > 0 && op.y < PAGE_HEIGHT && op.x > 0 && op.x < PAGE_WIDTH, op.text);
      if (op.kind === 'line') assert.ok(Math.max(op.y1, op.y2) < PAGE_HEIGHT - 16 && Math.min(op.x1, op.x2) > 16);
    }
  }
});

test('a written cell gets the text and no writing lines; an empty one keeps its lines', () => {
  const cells = empty();
  cells[0] = 'כולם נוכחים';
  const withText = layoutForumPdf(model({ platoonRows: [{ label: 'מחלקה 1', sublabel: '34/36', cells }, ...model().platoonRows.slice(1)] }), measure);
  const without = layoutForumPdf(model(), measure);
  assert.ok(texts(withText[1]).includes('כולם נוכחים'));
  assert.ok(texts(withText[1]).includes('34/36'), 'the platoon\'s manpower under its name');
  assert.ok(rules(withText[1]).length < rules(without[1]).length, 'the written cell has no lines');
  const boxes = layoutForumPdf(model({ commanderBoxes: [{ title: 'משמעויות עולות', body: 'לחזק משמעת' }, { title: 'דגשים שלי', body: '' }] }), measure);
  assert.ok(texts(boxes[0]).includes('לחזק משמעת'));
  assert.ok(rules(boxes[0]).length < rules(without[0]).length);
});

test('what the template has no place for goes on an extra page — only if written', () => {
  const pages = layoutForumPdf(model({ extras: [{ title: 'מחלקה 2 · לוגיסטיקה', body: 'חסרים 3 מימיות' }, { title: 'לו״ז מקביל', body: '   ' }] }), measure);
  assert.equal(pages.length, 3);
  assert.ok(texts(pages[2]).includes('נוסף מהפורום'));
  assert.ok(texts(pages[2]).includes('מחלקה 2 · לוגיסטיקה'));
  assert.ok(!texts(pages[2]).includes('לו״ז מקביל'), 'an empty extra is dropped');
});

test('a cell too long even at the smallest size is cut, and its full text continues on the extra page', () => {
  const cells = empty();
  cells[3] = 'חובש '.repeat(500);
  const pages = layoutForumPdf(model({ platoonRows: [{ label: 'מחלקה 3', cells }] }), measure);
  assert.equal(pages.length >= 3, true);
  assert.ok(texts(pages[1]).some((t) => t.endsWith('…')));
  assert.ok(texts(pages[2]).includes('מחלקה 3 · רפואה'));
});

test('the camouflage is the same every time, and the emblem is drawn only when asked', () => {
  const a = layoutForumPdf(model(), measure);
  const b = layoutForumPdf(model(), measure);
  assert.deepEqual(a[0].filter((op) => op.kind === 'ellipse'), b[0].filter((op) => op.kind === 'ellipse'));
  assert.equal(a[0].filter((op) => op.kind === 'image').length, 0);
  const withEmblem = layoutForumPdf(model({ emblem: true }), measure);
  assert.equal(withEmblem[0].filter((op) => op.kind === 'image').length, 1);
});

test('the PDF is well formed: landscape pages, one image each, and a correct xref table', () => {
  const jpegs = [
    { jpeg: Uint8Array.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]), width: 2105, height: 1488 },
    { jpeg: Uint8Array.from([0xff, 0xd8, 4, 5, 0xff, 0xd9]), width: 2105, height: 1488 },
  ];
  const pdf = buildImagePdf(jpegs);
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Pages \/Kids \[3 0 R 6 0 R\] \/Count 2/);
  assert.equal((text.match(/\/Subtype \/Image/g) ?? []).length, 2);
  assert.match(text, /\/MediaBox \[0 0 841\.89 595\.28\]/);
  assert.ok(Buffer.from(pdf).includes(Buffer.from(jpegs[0].jpeg)));
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');
  const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 8);
  offsets.forEach((offset, i) => assert.equal(text.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
});

test('the file is named by the forum date', () => {
  assert.equal(forumPdfFileName('2026-11-13'), 'forum-2026-11-13.pdf');
  assert.equal(forumPdfFileName('../x'), 'forum-report.pdf');
});

test('the forum page fills the template from the reports, and the phone gets the share sheet', () => {
  const page = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const render = readFileSync('src/lib/forum/pdfRender.ts', 'utf8');
  const handoff = readFileSync('src/lib/fileHandoff.ts', 'utf8');
  // The nine columns, including the three that never reached the old PDF.
  for (const [key, title] of [['personnel', 'כוח אדם'], ['readiness', 'כוננות'], ['welfare', 'ת״ש'], ['medical', 'רפואה'], ['safety', 'בטיחות'], ['discipline', 'משמעת'], ['personal_requests', 'בקשות אישיות'], ['plan_vs_actual', 'תכנון מול ביצוע'], ['daily_lessons', 'לקח יומי']]) {
    assert.ok(page.includes(`['${key}', '${title}'],`), title);
  }
  assert.match(page, /\{ title: 'משמעויות עולות', body: textOf\(companyContent\?\.company_summary\) \}/);
  assert.match(page, /\{ title: 'דגשים שלי', body: textOf\(companyContent\?\.commander_closing\) \}/);
  for (const title of ['חופ״ל', 'רס״פ', 'משה״ד', 'סמ״פ']) assert.ok(page.includes(`, '${title}'],`), title);
  assert.match(page, /if \(body\) extras\.push/, 'extras only when written');
  assert.match(page, /const \{ byNumber: platoonByNumber, unidentified \} = assignPlatoonReports\(dailyReports, platoons\);/);
  assert.equal((page.match(/\{pdfButtons\('slate'\)\}/g) ?? []).length, 2, 'next to both WhatsApp buttons');
  assert.match(page, /await import\('@\/lib\/forum\/pdfRender'\)/);
  assert.match(render, /return handOffFile\(blob, fileName, title, 'application\/pdf'\);/);
  assert.match(handoff, /await navigator\.share\(\{ files: \[file\], title \}\);/);
  assert.match(handoff, /if \(name === 'NotAllowedError'\) return 'needs_tap';/);
  assert.match(render, /await document\.fonts\.ready;/);
  assert.match(render, /ctx\.direction = 'rtl';/);
  assert.match(render, /ctx\.ellipse\(/);
  // Exporting reads the report; it never writes one.
  const exportFn = page.slice(page.indexOf('const exportForumPdf = async'), page.indexOf('const sharePendingPdf = async'));
  assert.doesNotMatch(exportFn, /\.from\(|\.update\(|\.insert\(|\.upsert\(/);
});
