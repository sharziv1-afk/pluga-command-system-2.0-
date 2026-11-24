// A minimal Excel (.xlsx) writer: one sheet, plain cells, a bold header row,
// a few fill colours, right-to-left. Enough for the tracking export, with no
// dependency — an .xlsx is a zip of a handful of XML files, written here
// uncompressed ("stored"), which Excel, Numbers and Google Sheets all open.
//
// Text goes in as inline strings, never as formulas, so a cell that starts
// with "=" stays text (the CSV formula-injection problem does not arise).
//
// Pure and import-free: the tracking page and the node tests load it.

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type XlsxStyle = 'passed' | 'failed' | 'makeup' | 'wrap';
export type XlsxValue = string | number | null;
export type XlsxCell = XlsxValue | { value: XlsxValue; style?: XlsxStyle };

export type XlsxSheet = {
  /** The tab name; trimmed to Excel's 31 characters and its forbidden characters removed. */
  name: string;
  /** The first row is the header: bold, shaded, wrapped and frozen. */
  rows: XlsxCell[][];
  /** Column widths in characters, by column index. */
  columnWidths?: number[];
  rightToLeft?: boolean;
  /** Columns kept in view when scrolling sideways (the names). */
  frozenColumns?: number;
};

const EXCEL_MAX_CELL_TEXT = 32767;

// cellXfs indexes in styles.xml below.
const STYLE_INDEX: Record<'header' | XlsxStyle, number> = { header: 1, passed: 2, failed: 3, makeup: 4, wrap: 5 };

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** Escapes XML and drops the control characters XML 1.0 cannot carry. */
export function xmlText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sheetName(name: string): string {
  const clean = name.replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31).trim();
  return clean || 'Sheet1';
}

function cellXml(cell: XlsxCell, ref: string, isHeader: boolean): string {
  const { value, style } = cell !== null && typeof cell === 'object' ? cell : { value: cell, style: undefined };
  const styleIndex = isHeader ? STYLE_INDEX.header : style ? STYLE_INDEX[style] : 0;
  const s = styleIndex ? ` s="${styleIndex}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  const text = typeof value === 'string' ? value.slice(0, EXCEL_MAX_CELL_TEXT) : '';
  if (!text) return styleIndex ? `<c r="${ref}"${s}/>` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
}

export function worksheetXml(sheet: XlsxSheet): string {
  const frozenColumns = sheet.frozenColumns ?? 0;
  const pane = sheet.rows.length > 1 || frozenColumns > 0
    ? `<pane${frozenColumns ? ` xSplit="${frozenColumns}"` : ''} ySplit="1" topLeftCell="${columnName(frozenColumns)}2" activePane="${frozenColumns ? 'bottomRight' : 'bottomLeft'}" state="frozen"/>`
    : '';
  const cols = (sheet.columnWidths ?? [])
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => cellXml(cell, `${columnName(colIndex)}${rowIndex + 1}`, rowIndex === 0)).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<sheetViews><sheetView${sheet.rightToLeft ? ' rightToLeft="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + (cols ? `<cols>${cols}</cols>` : '')
    + `<sheetData>${rows}</sheetData>`
    + '</worksheet>';
}

const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
const centered = '<alignment horizontal="center" vertical="center"/>';

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>'
  + '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + fill('FFE5E7EB') + fill('FFD1FAE5') + fill('FFFEE2E2') + fill('FFFEF3C7') + '</fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="6">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + `<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${centered}</xf>`
  + `<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${centered}</xf>`
  + `<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${centered}</xf>`
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

function packageFiles(sheet: XlsxSheet): Array<[string, string]> {
  return [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<sheets><sheet name="${xmlText(sheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets>`
      + '</workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>'],
    ['xl/styles.xml', STYLES_XML],
    ['xl/worksheets/sheet1.xml', worksheetXml(sheet)],
  ];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip with every entry stored (no compression). */
export function zipStored(files: Array<[string, Uint8Array]>): Uint8Array {
  const encoder = new TextEncoder();
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [path, data] of files) {
    const name = encoder.encode(path);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  const encoder = new TextEncoder();
  return zipStored(packageFiles(sheet).map(([path, xml]) => [path, encoder.encode(xml)]));
}
