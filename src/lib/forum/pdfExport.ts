// Forum report → PDF, for writing on it in Notability (13.11.2026).
//
// Pure and import-free: the page lays the report out here, draws the pages on
// a canvas (pdfRender.ts, where the browser handles Hebrew and RTL), and packs
// the JPEG pages into a PDF here. No PDF library: a PDF of full-page images
// is a few objects and an xref table. The node tests load this file directly.
//
// Decided by the company commander: the whole company forum; each platoon
// on its own page; empty ruled lines after every section for the pen.

export type ForumPdfSection = { title: string; body: string };
export type ForumPdfPage = { heading: string; note?: string; sections: ForumPdfSection[] };
export type ForumPdfModel = { title: string; subtitle: string; pages: ForumPdfPage[] };

/** A4 in PDF points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

export const LAYOUT = {
  marginX: 40,
  marginTop: 44,
  marginBottom: 46,
  headerSize: 9,
  headingSize: 20,
  noteSize: 11,
  sectionTitleSize: 12,
  bodySize: 12,
  bodyLineHeight: 18,
  writingLines: 3,
  writingLineGap: 24,
  sectionGap: 14,
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
 * Lays the report out in A4 pages. Every model page starts a new PDF page;
 * a page that runs long continues on the next with "(המשך)". Coordinates are
 * points from the top-left; text x is the right edge (RTL).
 */
export function layoutForumPdf(model: ForumPdfModel, measure: Measure): LaidOutPage[] {
  const L = LAYOUT;
  const right = PAGE_WIDTH - L.marginX;
  const left = L.marginX;
  const width = right - left;
  const bottom = PAGE_HEIGHT - L.marginBottom;
  const pages: LaidOutPage[] = [];

  let ops: DrawOp[] = [];
  let y = 0;

  const text = (value: string, size: number, bold: boolean, color = '#111111') => {
    ops.push({ kind: 'text', text: value, x: right, y, size, bold, color });
  };

  const startPage = (heading: string, note?: string) => {
    ops = [];
    pages.push(ops);
    y = L.marginTop;
    text(model.title, L.headerSize, false, '#666666');
    y += L.headerSize + 18;
    text(heading, L.headingSize, true);
    y += 8;
    if (note) {
      y += L.noteSize + 4;
      text(note, L.noteSize, false, '#444444');
    }
    y += 10;
    ops.push({ kind: 'line', x1: left, y1: y, x2: right, y2: y, color: '#999999' });
    y += 18;
  };

  model.pages.forEach((page, pageIndex) => {
    startPage(page.heading, pageIndex === 0 ? model.subtitle : page.note);
    for (const section of page.sections) {
      const body = wrapText(section.body.trim() || '—', width, L.bodySize, false, measure);
      const writing = L.writingLines * L.writingLineGap;
      const needed = L.sectionTitleSize + 6 + body.length * L.bodyLineHeight + writing + L.sectionGap;
      // Keep a section on one page when it fits on a page at all.
      const fullPage = bottom - (L.marginTop + 80);
      if (y + needed > bottom && needed <= fullPage) startPage(`${page.heading} (המשך)`);

      y += L.sectionTitleSize;
      text(section.title, L.sectionTitleSize, true, '#333333');
      y += 6;
      for (const line of body) {
        if (y + L.bodyLineHeight > bottom) startPage(`${page.heading} (המשך)`);
        y += L.bodyLineHeight;
        if (line) text(line, L.bodySize, false);
      }
      // Ruled lines for handwriting.
      for (let i = 0; i < L.writingLines; i += 1) {
        if (y + L.writingLineGap > bottom) break;
        y += L.writingLineGap;
        ops.push({ kind: 'line', x1: left, y1: y, x2: right, y2: y, color: '#d4d4d4' });
      }
      y += L.sectionGap;
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
