// Forum report → PDF, for writing on it in Notability on the iPad.
//
// The layout is the company's own landscape template (מ״פ, 28.11.2026), the
// one the commanders already write on in Notability:
//   1. מפל״ג — the framework table's מפל״ג row, a box each for חופ״ל, רס״פ,
//      משה״ד and סמ״פ, then "משמעויות עולות" and "דגשים שלי";
//   2. מחלקות — the same table, a row for each platoon.
// Columns: מסגרת · כוח אדם · כוננות · ת״ש · רפואה · בטיחות · משמעת ·
// בקשות אישיות · תכנון מול ביצוע · לקח יומי.
//
// Rule (מ״פ): a cell or box takes the report's text only when there is text;
// then it gets no writing lines. An empty one is left for the pen, with lines.
// Whatever has no place in the template (logistics, next actions, the
// schedules…) goes on a last page — only if there is any text at all — and so
// does the full text of a cell too long to fit even at the smallest size.
//
// Pure and import-free: the page builds the model, this lays it out, the
// browser draws it on a canvas (pdfRender.ts: Hebrew shaping and RTL) and
// the JPEG pages are packed into a PDF here, with no PDF library.

export type ForumPdfRow = { label: string; sublabel?: string; cells: string[] };
export type ForumPdfBox = { title: string; body: string };
export type ForumPdfModel = {
  /** For the share sheet and the file, e.g. "פורום מוביל — 28.11.2026". */
  title: string;
  /** Printed in the date box, e.g. "28.11.2026". */
  date: string;
  /** The nine field columns, after "מסגרת". */
  columns: string[];
  staffRow: ForumPdfRow;
  staffBoxes: ForumPdfBox[];
  commanderBoxes: ForumPdfBox[];
  platoonRows: ForumPdfRow[];
  /** Forum text the template has no place for. Empty bodies are dropped. */
  extras: ForumPdfBox[];
  /** Draw the battalion emblem (pdfRender passes the image). */
  emblem?: boolean;
};

/** A4 landscape in PDF points. */
export const PAGE_WIDTH = 841.89;
export const PAGE_HEIGHT = 595.28;

export const COLORS = {
  paper: '#ECE7CF',
  ink: '#1F2618',
  frame: '#2F3A22',
  banner: '#5F6E3D',
  bannerText: '#F4F0DC',
  header: '#DCD6B5',
  rule: '#B9B293',
  muted: '#5B5A48',
  camo: ['#4B5A30', '#6F7B45', '#98A06A', '#39442A', '#828B57'],
} as const;

export const LAYOUT = {
  panelInset: 16,
  contentInset: 30,
  tableTop: 84,
  headerHeight: 40,
  labelWidth: 74,
  cellPadding: 4,
  /** Body text shrinks from the first size to the last before it is cut. */
  bodySizes: [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5],
  lineHeightRatio: 1.28,
  writingGap: 15,
  boxTitleSize: 12,
  sectionGap: 10,
} as const;

export type DrawOp =
  | { kind: 'text'; text: string; x: number; y: number; size: number; bold: boolean; color: string; align?: 'right' | 'center' }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lineWidth?: number; radius?: number }
  | { kind: 'poly'; points: Array<[number, number]>; fill: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotation: number; fill: string }
  | { kind: 'image'; name: 'emblem'; x: number; y: number; w: number; h: number };

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
  // No leading or trailing empty lines.
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  while (out.length > 1 && out[0] === '') out.shift();
  return out;
}

export type FittedText = { lines: string[]; size: number; lineHeight: number; overflow: boolean };

/**
 * The largest body size at which `text` fits the box. Too long even at the
 * smallest size: as many lines as fit, the last ending in "…", overflow set.
 */
export function fitText(text: string, maxWidth: number, maxHeight: number, measure: Measure): FittedText {
  const sizes = LAYOUT.bodySizes;
  for (const size of sizes) {
    const lineHeight = size * LAYOUT.lineHeightRatio;
    const lines = wrapText(text, maxWidth, size, false, measure);
    if (lines.length * lineHeight <= maxHeight) return { lines, size, lineHeight, overflow: false };
  }
  const size = sizes[sizes.length - 1];
  const lineHeight = size * LAYOUT.lineHeightRatio;
  const lines = wrapText(text, maxWidth, size, false, measure);
  const room = Math.max(1, Math.floor(maxHeight / lineHeight));
  const kept = lines.slice(0, room);
  let last = kept[kept.length - 1] ?? '';
  while (last && measure(`${last}…`, size, false) > maxWidth) last = [...last].slice(0, -1).join('');
  kept[kept.length - 1] = `${last}…`;
  return { lines: kept, size, lineHeight, overflow: true };
}

/** A small deterministic random sequence, so the camouflage is the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasText = (text: string | undefined | null) => Boolean(text && text.trim());

/**
 * Lays the model out on landscape pages: the מפל״ג page, the platoons page,
 * then — only if there is text for them — the extra pages.
 * Coordinates are points from the top-left; text x is its right edge (RTL)
 * or its centre.
 */
export function layoutForumPdf(model: ForumPdfModel, measure: Measure): LaidOutPage[] {
  const L = LAYOUT;
  const panelLeft = L.panelInset;
  const panelRight = PAGE_WIDTH - L.panelInset;
  const panelTop = L.panelInset;
  const panelBottom = PAGE_HEIGHT - L.panelInset;
  const left = panelLeft + L.contentInset;
  const right = panelRight - L.contentInset;
  const bottom = panelBottom - 22;
  const width = right - left;
  const columnCount = model.columns.length;
  const fieldWidth = (width - L.labelWidth) / Math.max(columnCount, 1);

  const pages: LaidOutPage[] = [];
  const overflow: ForumPdfBox[] = [];
  let ops: DrawOp[] = [];

  const text = (value: string, x: number, y: number, size: number, bold = false, color: string = COLORS.ink, align: 'right' | 'center' = 'right') => {
    ops.push({ kind: 'text', text: value, x, y, size, bold, color, align });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color: string = COLORS.frame, lineWidth = 1) => {
    ops.push({ kind: 'line', x1, y1, x2, y2, color, width: lineWidth });
  };

  const startPage = (sheetTitle: string) => {
    ops = [];
    pages.push(ops);
    // Camouflage behind the panel: blobs over the whole page, then the paper on top.
    ops.push({ kind: 'rect', x: 0, y: 0, w: PAGE_WIDTH, h: PAGE_HEIGHT, fill: COLORS.camo[4] });
    const random = seeded(601 + pages.length);
    for (let i = 0; i < 220; i += 1) {
      ops.push({
        kind: 'ellipse',
        cx: random() * PAGE_WIDTH,
        cy: random() * PAGE_HEIGHT,
        rx: 10 + random() * 34,
        ry: 6 + random() * 18,
        rotation: random() * Math.PI,
        fill: COLORS.camo[Math.floor(random() * 4)],
      });
    }
    ops.push({ kind: 'rect', x: panelLeft, y: panelTop, w: panelRight - panelLeft, h: panelBottom - panelTop, fill: COLORS.paper, stroke: COLORS.frame, lineWidth: 1.4, radius: 4 });
    // Dark corner triangles, as on the template.
    const c = 30;
    ops.push({ kind: 'poly', points: [[panelLeft, panelTop], [panelLeft + c, panelTop], [panelLeft, panelTop + c]], fill: COLORS.frame });
    ops.push({ kind: 'poly', points: [[panelRight, panelTop], [panelRight - c, panelTop], [panelRight, panelTop + c]], fill: COLORS.frame });
    ops.push({ kind: 'poly', points: [[panelLeft, panelBottom], [panelLeft + c, panelBottom], [panelLeft, panelBottom - c]], fill: COLORS.frame });
    ops.push({ kind: 'poly', points: [[panelRight, panelBottom], [panelRight - c, panelBottom], [panelRight, panelBottom - c]], fill: COLORS.frame });

    // The banner, centred.
    const bannerWidth = 200;
    const bannerX = PAGE_WIDTH / 2 - bannerWidth / 2;
    ops.push({ kind: 'rect', x: bannerX, y: 30, w: bannerWidth, h: 38, fill: COLORS.banner, stroke: COLORS.frame, lineWidth: 1.6, radius: 8 });
    text(sheetTitle, PAGE_WIDTH / 2, 57, 22, true, COLORS.bannerText, 'center');
    if (model.emblem) ops.push({ kind: 'image', name: 'emblem', x: left, y: 24, w: 50, h: 50 });

    // The date box, top right.
    ops.push({ kind: 'rect', x: right - 160, y: 36, w: 160, h: 28, stroke: COLORS.frame, lineWidth: 1 });
    text(`תאריך: ${model.date}`, right - 8, 55, 12, false, COLORS.ink);
  };

  // Ruled writing lines from y down to the bottom of the box.
  const writingLines = (x1: number, x2: number, top: number, boxBottom: number) => {
    for (let y = top + L.writingGap; y <= boxBottom - 4; y += L.writingGap) line(x1, y, x2, y, COLORS.rule, 0.6);
  };

  // A cell or box body: its text when there is any, writing lines when not.
  const body = (value: string, boxLeft: number, boxRight: number, top: number, boxBottom: number, overflowTitle: string) => {
    const innerLeft = boxLeft + L.cellPadding;
    const innerRight = boxRight - L.cellPadding;
    if (!hasText(value)) {
      writingLines(innerLeft, innerRight, top, boxBottom);
      return;
    }
    const fitted = fitText(value.trim(), innerRight - innerLeft, boxBottom - top - L.cellPadding, measure);
    let y = top;
    for (const textLine of fitted.lines) {
      y += fitted.lineHeight;
      if (textLine) text(textLine, innerRight, y - fitted.lineHeight * 0.22, fitted.size);
    }
    if (fitted.overflow) overflow.push({ title: overflowTitle, body: value.trim() });
  };

  // The framework table: a header row and the given rows, from `top` to `tableBottom`.
  const table = (rows: ForumPdfRow[], top: number, tableBottom: number) => {
    const rowHeight = (tableBottom - top - L.headerHeight) / Math.max(rows.length, 1);
    const columnRight = (index: number) => right - L.labelWidth - index * fieldWidth;

    ops.push({ kind: 'rect', x: left, y: top, w: width, h: L.headerHeight, fill: COLORS.header });
    ops.push({ kind: 'rect', x: left, y: top, w: width, h: tableBottom - top, stroke: COLORS.frame, lineWidth: 1.6 });
    line(left, top + L.headerHeight, right, top + L.headerHeight, COLORS.frame, 1.4);
    rows.forEach((_, index) => {
      if (index > 0) line(left, top + L.headerHeight + index * rowHeight, right, top + L.headerHeight + index * rowHeight, COLORS.frame, 1.2);
    });
    line(right - L.labelWidth, top, right - L.labelWidth, tableBottom, COLORS.frame, 1.2);
    for (let i = 1; i < columnCount; i += 1) line(columnRight(i), top, columnRight(i), tableBottom, COLORS.frame, 1);

    // Headers: bold, centred, wrapped to two lines when needed.
    const headerCell = (label: string, cellRight: number, cellWidth: number) => {
      const lines = wrapText(label, cellWidth - 6, 11.5, true, measure).slice(0, 2);
      const centre = cellRight - cellWidth / 2;
      const firstY = top + L.headerHeight / 2 + (lines.length === 1 ? 4 : -2);
      lines.forEach((headerLine, i) => text(headerLine, centre, firstY + i * 13, 11.5, true, COLORS.ink, 'center'));
    };
    headerCell('מסגרת', right, L.labelWidth);
    model.columns.forEach((column, index) => headerCell(column, columnRight(index), fieldWidth));

    rows.forEach((row, rowIndex) => {
      const rowTop = top + L.headerHeight + rowIndex * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const centre = right - L.labelWidth / 2;
      const labelY = rowTop + rowHeight / 2 + (row.sublabel ? 0 : 5);
      text(row.label, centre, labelY, 13, false, COLORS.ink, 'center');
      if (row.sublabel) text(row.sublabel, centre, labelY + 14, 9, false, COLORS.muted, 'center');
      row.cells.forEach((cell, columnIndex) => {
        const cellRight = columnRight(columnIndex);
        body(cell ?? '', cellRight - fieldWidth, cellRight, rowTop + 2, rowBottom, `${row.label} · ${model.columns[columnIndex]}`);
      });
    });
  };

  // A row of boxes side by side (first on the right), each titled.
  const boxes = (items: ForumPdfBox[], top: number, boxesBottom: number) => {
    const boxWidth = width / Math.max(items.length, 1);
    ops.push({ kind: 'rect', x: left, y: top, w: width, h: boxesBottom - top, stroke: COLORS.frame, lineWidth: 1.6 });
    items.forEach((item, index) => {
      const boxRight = right - index * boxWidth;
      const boxLeft = boxRight - boxWidth;
      if (index > 0) line(boxRight, top, boxRight, boxesBottom, COLORS.frame, 1.2);
      text(item.title, boxRight - 10, top + 20, L.boxTitleSize, true);
      body(item.body, boxLeft + 6, boxRight - 6, top + 26, boxesBottom, item.title);
    });
  };

  // 1. מפל״ג.
  startPage('פורום מוביל');
  const staffTableBottom = L.tableTop + L.headerHeight + 76;
  table([model.staffRow], L.tableTop, staffTableBottom);
  const staffBoxesTop = staffTableBottom + L.sectionGap + 6;
  const staffBoxesBottom = staffBoxesTop + 128;
  boxes(model.staffBoxes, staffBoxesTop, staffBoxesBottom);
  boxes(model.commanderBoxes, staffBoxesBottom + L.sectionGap + 6, bottom);

  // 2. The platoons.
  startPage('פורום מוביל');
  table(model.platoonRows, L.tableTop, bottom);

  // 3. Everything else with text, full width, as many pages as it takes.
  const extras = [...overflow, ...model.extras.filter((extra) => hasText(extra.body))];
  if (extras.length > 0) {
    const size = 10;
    const lineHeight = size * 1.4;
    let y = 0;
    const startExtras = () => {
      startPage('נוסף מהפורום');
      y = L.tableTop;
    };
    startExtras();
    for (const extra of extras) {
      const lines = wrapText(extra.body.trim(), width - 16, size, false, measure);
      if (y + 40 > bottom) startExtras();
      y += 16;
      text(extra.title, right, y, L.boxTitleSize, true);
      line(left, y + 5, right, y + 5, COLORS.rule, 0.8);
      y += 6;
      for (const textLine of lines) {
        if (y + lineHeight > bottom) startExtras();
        y += lineHeight;
        if (textLine) text(textLine, right - 8, y, size);
      }
      y += 10;
    }
  }

  return pages;
}

const encoder = new TextEncoder();

/**
 * A PDF whose every page is one full-page JPEG (A4 landscape). Object
 * layout: 1 catalog, 2 page tree, then per page: page, content stream, image.
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
