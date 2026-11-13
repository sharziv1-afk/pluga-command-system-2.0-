// Forum report → PDF, for writing on it in Notability (13.11.2026).
//
// Pure and import-free: the page lays the report out here, draws the pages on
// a canvas (pdfRender.ts, where the browser handles Hebrew and RTL), and packs
// the JPEG pages into a PDF here. No PDF library: a PDF of full-page images
// is a few objects and an xref table. The node tests load this file directly.
//
// Decided by the company commander: the whole company forum; each platoon
// on its own page; sections as boxes, two side by side, with ruled lines
// in each box for the pen.

export type ForumPdfSection = { title: string; body: string };
export type ForumPdfPage = { heading: string; note?: string; sections: ForumPdfSection[] };
export type ForumPdfModel = { title: string; subtitle: string; pages: ForumPdfPage[] };

/** A4 in PDF points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

// Sections are boxes, two side by side ("קובייה ליד קובייה", company
// commander, 13.11.2026), so a platoon's nine sections fit on one page with
// room to write in each box. One under the other, they ran onto a second page.
export const LAYOUT = {
  marginX: 36,
  marginTop: 40,
  marginBottom: 40,
  headerSize: 9,
  headingSize: 18,
  noteSize: 10,
  columns: 2,
  columnGap: 10,
  rowGap: 10,
  boxPadding: 8,
  sectionTitleSize: 11,
  titleGap: 4,
  bodySize: 10.5,
  bodyLineHeight: 14,
  /** At least this many writing lines in every box; a shorter box in a row gets more. */
  writingLines: 3,
  writingLineGap: 17,
} as const;

export type DrawOp =
  | { kind: 'text'; text: string; x: number; y: number; size: number; bold: boolean; color: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string };

export type LaidOutPage = DrawOp[];

/** Width of `text` in points at `size`, bold or not (the canvas measures it). */
export type Measure = (text: string, size: number, bold: boolean) => number;

/** Splits text into lines no wider than `maxWidth`, keeping the writer's own line breaks. */
export function wrapText(text: string, maxWidth: number, size: number, bold: boolean, measure: Measure): string[] {
  const out: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size, bold) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the line is cut by characters.
      if (measure(word, size, bold) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (chunk && measure(chunk + char, size, bold) > maxWidth) {
            out.push(chunk);
            chunk = '';
          }
          chunk += char;
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    out.push(line);
  }
  // No trailing empty lines.
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/**
 * Lays the report out in A4 pages. Every model page starts a new PDF page,
 * its sections in a two-column grid of boxes (first column on the right).
 * A row that does not fit continues on the next page with "(המשך)"; a
 * section too long for any page runs full width, line by line. Coordinates
 * are points from the top-left; text x is the right edge (RTL).
 */
export function layoutForumPdf(model: ForumPdfModel, measure: Measure): LaidOutPage[] {
  const L = LAYOUT;
  const right = PAGE_WIDTH - L.marginX;
  const left = L.marginX;
  const width = right - left;
  const bottom = PAGE_HEIGHT - L.marginBottom;
  const columnWidth = (width - L.columnGap * (L.columns - 1)) / L.columns;
  const innerWidth = columnWidth - L.boxPadding * 2;
  const pages: LaidOutPage[] = [];

  let ops: DrawOp[] = [];
  let y = 0;
  let pageTop = 0;

  const textAt = (value: string, x: number, size: number, bold: boolean, color = '#111111') => {
    ops.push({ kind: 'text', text: value, x, y, size, bold, color });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    ops.push({ kind: 'line', x1, y1, x2, y2, color });
  };

  const startPage = (heading: string, note?: string) => {
    ops = [];
    pages.push(ops);
    y = L.marginTop;
    textAt(model.title, right, L.headerSize, false, '#666666');
    y += L.headerSize + 18;
    textAt(heading, right, L.headingSize, true);
    y += 8;
    if (note) {
      y += L.noteSize + 4;
      textAt(note, right, L.noteSize, false, '#444444');
    }
    y += 10;
    line(left, y, right, y, '#999999');
    y += 14;
    pageTop = y;
  };

  const boxContentHeight = (bodyLines: number) =>
    L.boxPadding + L.sectionTitleSize + L.titleGap + bodyLines * L.bodyLineHeight + L.boxPadding;

  // A section longer than a whole page: full width, line by line, across pages.
  const flowSection = (section: ForumPdfSection, heading: string) => {
    const body = wrapText(section.body.trim() || '—', width, L.bodySize, false, measure);
    y += L.sectionTitleSize;
    textAt(section.title, right, L.sectionTitleSize, true, '#333333');
    y += L.titleGap;
    for (const bodyLine of body) {
      if (y + L.bodyLineHeight > bottom) startPage(`${heading} (המשך)`);
      y += L.bodyLineHeight;
      if (bodyLine) textAt(bodyLine, right, L.bodySize, false);
    }
    for (let i = 0; i < L.writingLines && y + L.writingLineGap <= bottom; i += 1) {
      y += L.writingLineGap;
      line(left, y, right, y, '#d4d4d4');
    }
    y += L.rowGap;
  };

  model.pages.forEach((page, pageIndex) => {
    startPage(page.heading, pageIndex === 0 ? model.subtitle : page.note);
    const fullPage = bottom - pageTop;

    const rows: Array<{ items: Array<{ section: ForumPdfSection; body: string[] }>; height: number }> = [];
    for (let i = 0; i < page.sections.length; i += L.columns) {
      const items = page.sections.slice(i, i + L.columns).map((section) => ({
        section,
        body: wrapText(section.body.trim() || '—', innerWidth, L.bodySize, false, measure),
      }));
      rows.push({ items, height: Math.max(...items.map(({ body }) => boxContentHeight(body.length) + L.writingLines * L.writingLineGap)) });
    }
    // When the whole page fits, the boxes stretch to fill it: the room left
    // over becomes more writing lines (company commander, 13.11.2026).
    const naturalHeight = rows.reduce((sum, row) => sum + row.height, 0) + L.rowGap * Math.max(rows.length - 1, 0);
    const extra = rows.length > 0 && naturalHeight <= fullPage ? (fullPage - naturalHeight) / rows.length : 0;

    for (const { items: row, height } of rows) {
      const rowHeight = height + extra;

      if (rowHeight > fullPage) {
        row.forEach(({ section }) => flowSection(section, page.heading));
        continue;
      }
      // Half a point of slack: a stretched page ends exactly at the margin.
      if (y + rowHeight > bottom + 0.5) startPage(`${page.heading} (המשך)`);

      const top = y;
      row.forEach(({ section, body }, column) => {
        const boxRight = right - column * (columnWidth + L.columnGap);
        const boxLeft = boxRight - columnWidth;
        const textRight = boxRight - L.boxPadding;
        line(boxLeft, top, boxRight, top, '#bdbdbd');
        line(boxRight, top, boxRight, top + rowHeight, '#bdbdbd');
        line(boxRight, top + rowHeight, boxLeft, top + rowHeight, '#bdbdbd');
        line(boxLeft, top + rowHeight, boxLeft, top, '#bdbdbd');

        y = top + L.boxPadding + L.sectionTitleSize;
        textAt(section.title, textRight, L.sectionTitleSize, true, '#333333');
        y += L.titleGap;
        for (const bodyLine of body) {
          y += L.bodyLineHeight;
          if (bodyLine) textAt(bodyLine, textRight, L.bodySize, false);
        }
        // Fill the rest of the box with writing lines.
        while (y + L.writingLineGap <= top + rowHeight - L.boxPadding / 2) {
          y += L.writingLineGap;
          line(boxLeft + L.boxPadding, y, boxRight - L.boxPadding, y, '#d4d4d4');
        }
      });
      y = top + rowHeight + L.rowGap;
    }
  });

  // Page numbers.
  pages.forEach((page, index) => {
    page.push({
      kind: 'text',
      text: `עמוד ${index + 1} מתוך ${pages.length}`,
      x: right,
      y: PAGE_HEIGHT - 24,
      size: L.headerSize,
      bold: false,
      color: '#888888',
    });
  });
  return pages;
}

const encoder = new TextEncoder();

/**
 * A PDF whose every page is one full-page JPEG. Object layout:
 * 1 catalog, 2 page tree, then per page: page, content stream, image.
 */
export function buildImagePdf(images: Array<{ jpeg: Uint8Array; width: number; height: number }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const pageIds = images.map((_, i) => 3 + i * 3);

  startObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObject(2);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${images.length} >>\nendobj\n`);

  const w = PAGE_WIDTH.toFixed(2);
  const h = PAGE_HEIGHT.toFixed(2);
  images.forEach((image, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    startObject(pageId);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    startObject(contentId);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObject(imageId);
    push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpeg.length} >>\nstream\n`);
    push(image.jpeg);
    push('\nendstream\nendobj\n');
  });

  const objectCount = 2 + images.length * 3;
  const xrefStart = length;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objectCount; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** "forum-2026-11-13.pdf" */
export function forumPdfFileName(dateKey: string): string {
  return `forum-${/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : 'report'}.pdf`;
}
