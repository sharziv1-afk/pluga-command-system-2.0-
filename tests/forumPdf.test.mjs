import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LAYOUT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  buildImagePdf,
  forumPdfFileName,
  layoutForumPdf,
  wrapText,
} from '../src/lib/forum/pdfExport.ts';

/**
 * Forum report → PDF for Notability (13.11.2026). Decided by the company
 * commander: the whole company forum, each platoon on its own page, ruled
 * writing space after every section.
 */

// Every character is half its font size wide — enough to test the layout.
const measure = (text, size) => [...text].length * size * 0.5;

const section = (title, body) => ({ title, body });
const model = (pages) => ({ title: 'פורום מוביל פלוגתי — יום שישי', subtitle: 'מ״פ · מצבה 120/130', pages });

test('lines wrap to the width, keep the writer\'s line breaks, and cut an over-long word', () => {
  const lines = wrapText('אחת שתיים שלוש ארבע', 30, 10, false, measure); // 6 chars per line
  assert.deepEqual(lines, ['אחת', 'שתיים', 'שלוש', 'ארבע']);
  assert.deepEqual(wrapText('שורה א\nשורה ב', 1000, 10, false, measure), ['שורה א', 'שורה ב']);
  assert.deepEqual(wrapText('אבגדהוזחטי', 20, 10, false, measure), ['אבגד', 'הוזח', 'טי']);
  for (const line of wrapText('מילה '.repeat(80), 200, 12, false, measure)) {
    assert.ok(measure(line, 12) <= 200, line);
  }
});

test('each report page starts a PDF page, with writing lines in every section box', () => {
  const pages = layoutForumPdf(model([
    { heading: 'מחלקה 1 · הוגש', sections: [section('כוח אדם', 'תקין'), section('לוגיסטיקה', '')] },
    { heading: 'מחלקה 2 · טרם הוגש', sections: [section('כוח אדם', '')] },
  ]), measure);
  assert.equal(pages.length, 2);
  const texts = (page) => page.filter((op) => op.kind === 'text').map((op) => op.text);
  assert.ok(texts(pages[0]).includes('מחלקה 1 · הוגש'));
  assert.ok(texts(pages[1]).includes('מחלקה 2 · טרם הוגש'));
  assert.ok(texts(pages[0]).includes('מ״פ · מצבה 120/130'), 'the summary line is on the first page');
  assert.ok(texts(pages[0]).includes('—'), 'an empty section shows a dash, not nothing');
  // At least three writing lines in every box.
  const rules = (page) => page.filter((op) => op.kind === 'line' && op.color === '#d4d4d4').length;
  assert.ok(rules(pages[0]) >= 2 * LAYOUT.writingLines);
  assert.ok(rules(pages[1]) >= LAYOUT.writingLines);
  assert.deepEqual(texts(pages[1]).slice(-1), ['עמוד 2 מתוך 2']);
});

test('a platoon with short answers fits on one page, even the first page with the summary line', () => {
  // Found on the live site (13.11.2026): every platoon ran onto a second page.
  const titles = ['מצבה', 'כוח אדם', 'ת״ש', 'רפואה', 'לוגיסטיקה', 'כוננות', 'תכנון מול ביצוע', 'לקח יומי', 'פעולות להמשך'];
  const platoon = (heading) => ({ heading, sections: titles.map((title) => section(title, 'תקין, בלי חריגים')) });
  const pages = layoutForumPdf(model([platoon('מחלקה 1 · הוגש'), platoon('מחלקה 2 · הוגש')]), measure);
  assert.equal(pages.length, 2);
  assert.ok(!pages.some((page) => page.some((op) => op.kind === 'text' && op.text.includes('(המשך)'))));
  // Nine boxes, two side by side: four sides each, and both columns used.
  const boxSides = pages[0].filter((op) => op.kind === 'line' && op.color === '#bdbdbd');
  assert.equal(boxSides.length, 9 * 4);
  const titleXs = new Set(pages[0].filter((op) => op.kind === 'text' && titles.includes(op.text)).map((op) => Math.round(op.x)));
  assert.equal(titleXs.size, 2, 'two columns');
});

test('when a page fits, the boxes stretch to fill it with more writing lines', () => {
  // The staff page has four short boxes; they used to leave most of the page empty.
  const staff = ['חופ״ל', 'מש״ד', 'רס״פ', 'סמ״פ'].map((title) => section(title, 'טרם הוגש'));
  const [first, page] = layoutForumPdf(model([{ heading: 'מחלקה 1', sections: [section('מצבה', '')] }, { heading: 'מפל״ג', sections: staff }]), measure);
  assert.ok(first);
  const sides = page.filter((op) => op.kind === 'line' && op.color === '#bdbdbd');
  const lowest = Math.max(...sides.map((op) => Math.max(op.y1, op.y2)));
  assert.ok(Math.abs(lowest - (PAGE_HEIGHT - LAYOUT.marginBottom)) < 1, `boxes end at ${lowest}`);
  const writing = page.filter((op) => op.kind === 'line' && op.color === '#d4d4d4');
  assert.ok(writing.length >= 4 * 10, `${writing.length} writing lines`);
  // Never past the bottom margin.
  assert.ok(writing.every((op) => op.y1 <= PAGE_HEIGHT - LAYOUT.marginBottom));
});

test('a section longer than a page runs full width across pages instead of a box', () => {
  const huge = section('כוח אדם', 'מילה '.repeat(2000));
  const pages = layoutForumPdf(model([{ heading: 'מחלקה 4 · הוגש', sections: [huge, section('ת״ש', 'תקין')] }]), measure);
  assert.ok(pages.length > 2);
  for (const page of pages) {
    for (const op of page) {
      if (op.kind === 'text' && !op.text.startsWith('עמוד ')) assert.ok(op.y <= PAGE_HEIGHT - LAYOUT.marginBottom);
    }
  }
});

test('a long page continues on the next with "(המשך)", and nothing runs off the page', () => {
  const long = Array.from({ length: 12 }, (_, i) => section(`סעיף ${i + 1}`, 'טקסט '.repeat(60)));
  const pages = layoutForumPdf(model([{ heading: 'מחלקה 3 · הוגש', sections: long }]), measure);
  assert.ok(pages.length > 1);
  assert.ok(pages.slice(1).every((page) => page.some((op) => op.kind === 'text' && op.text === 'מחלקה 3 · הוגש (המשך)')));
  const right = PAGE_WIDTH - LAYOUT.marginX;
  const columnWidth = (PAGE_WIDTH - 2 * LAYOUT.marginX - LAYOUT.columnGap) / 2;
  // RTL: page text at the right margin, box text at its box's right edge.
  const anchors = [right, right - LAYOUT.boxPadding, right - columnWidth - LAYOUT.columnGap - LAYOUT.boxPadding];
  for (const page of pages) {
    for (const op of page) {
      if (op.kind !== 'text') continue;
      assert.ok(anchors.some((x) => Math.abs(x - op.x) < 0.001), `${op.text} at x=${op.x}`);
      if (!op.text.startsWith('עמוד ')) assert.ok(op.y <= PAGE_HEIGHT - LAYOUT.marginBottom, `${op.text} at ${op.y}`);
    }
  }
});

test('the PDF is well formed: header, one image per page, and a correct xref table', () => {
  const jpegs = [
    { jpeg: Uint8Array.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]), width: 1488, height: 2105 },
    { jpeg: Uint8Array.from([0xff, 0xd8, 4, 5, 0xff, 0xd9]), width: 1488, height: 2105 },
  ];
  const pdf = buildImagePdf(jpegs);
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Pages \/Kids \[3 0 R 6 0 R\] \/Count 2/);
  assert.equal((text.match(/\/Subtype \/Image/g) ?? []).length, 2);
  assert.match(text, /\/Width 1488 \/Height 2105 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length 7/);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  // The JPEG bytes are copied as they are.
  assert.ok(Buffer.from(pdf).includes(Buffer.from(jpegs[0].jpeg)));
  // startxref points at "xref", and every offset at its own object.
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

test('the forum page exports the whole company forum, and the phone gets the share sheet', () => {
  const page = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  const render = readFileSync('src/lib/forum/pdfRender.ts', 'utf8');
  for (const title of ['מצבה', 'כוח אדם', 'ת״ש', 'רפואה', 'לוגיסטיקה', 'כוננות', 'תכנון מול ביצוע', 'לקח יומי', 'פעולות להמשך']) {
    assert.ok(page.includes(`{ title: '${title}', body:`), title);
  }
  assert.match(page, /heading: 'מפל״ג'/);
  assert.match(page, /heading: 'דגשי מ״פ \/ סיכום פלוגתי'/);
  assert.match(page, /const \{ byNumber: platoonByNumber, unidentified \} = assignPlatoonReports\(dailyReports, platoons\);/);
  assert.equal((page.match(/\{pdfButtons\('slate'\)\}/g) ?? []).length, 2, 'next to both WhatsApp buttons');
  assert.match(page, /await import\('@\/lib\/forum\/pdfRender'\)/);
  assert.match(render, /await navigator\.share\(\{ files: \[file\], title \}\);/);
  assert.match(render, /if \(name === 'NotAllowedError'\) return 'needs_tap';/);
  assert.match(render, /await document\.fonts\.ready;/);
  assert.match(render, /ctx\.direction = 'rtl';/);
  // Exporting reads the report; it never writes one.
  const exportFn = page.slice(page.indexOf('const exportForumPdf = async'), page.indexOf('const sharePendingPdf = async'));
  assert.doesNotMatch(exportFn, /\.from\(|\.update\(|\.insert\(|\.upsert\(/);
});
