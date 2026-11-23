import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { buildXlsx, columnName, crc32, sheetName, worksheetXml, xmlText } from '../src/lib/xlsx.ts';

/**
 * Tracking export to Excel (מ״פ, 23.11.2026): the "ייצוא CSV" button was a
 * disabled placeholder since the tracking skeleton. It now downloads an .xlsx
 * of what the table shows, built without a dependency (src/lib/xlsx.ts).
 */

/** Reads a stored (uncompressed) zip into { path: text }, checking every CRC. */
function unzipStored(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    assert.equal(view.getUint16(at + 8, true), 0, 'stored, not compressed');
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const data = bytes.subarray(at + 30 + nameLength + extraLength, at + 30 + nameLength + extraLength + size);
    assert.equal(nodeCrc32(data), crc, `crc of ${name}`);
    files[name] = new TextDecoder().decode(data);
    at += 30 + nameLength + extraLength + size;
  }
  // The end-of-central-directory record counts every entry.
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), Object.keys(files).length);
  assert.equal(view.getUint32(end + 16, true), at, 'central directory starts right after the entries');
  return files;
}

test('crc32 matches zlib', () => {
  const data = new TextEncoder().encode('מעקב כשירות 13:45');
  assert.equal(crc32(data), nodeCrc32(data));
  assert.equal(crc32(new Uint8Array()), 0);
});

test('column names run A…Z, AA…', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
});

test('text is escaped, control characters dropped, and the sheet name is legal', () => {
  assert.equal(xmlText('a & <b> "c"\u0001'), 'a &amp; &lt;b&gt; &quot;c&quot;');
  assert.equal(sheetName('שבוע 3/4: [מטווח]'), 'שבוע 3 4   מטווח');
  assert.equal(sheetName('א'.repeat(40)).length, 31);
  assert.equal(sheetName(' '), 'Sheet1');
});

test('a workbook opens: every part is there, right-to-left, header frozen and styled', () => {
  const bytes = buildXlsx({
    name: 'שבוע 1',
    rows: [
      ['שם', 'מחלקה', 'ריצה 3 ק״מ\nעובר: 14:00 ומטה', 'הערות'],
      ['עמית חביב', 'מחלקה 1', { value: '13:45', style: 'passed' }, { value: 'ריצה: כאב ברך', style: 'wrap' }],
      ['רון דקל', 'מחלקה 1', { value: 85, style: 'failed' }, null],
      ['=HYPERLINK("x")', '', null, null],
    ],
    columnWidths: [22, 12, 14, 40],
    rightToLeft: true,
    frozenColumns: 1,
  });
  const files = unzipStored(bytes);
  assert.deepEqual(Object.keys(files).sort(), [
    '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
  ]);
  assert.match(files['xl/workbook.xml'], /<sheet name="שבוע 1" sheetId="1" r:id="rId1"\/>/);
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /<sheetView rightToLeft="1" workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"\/>/);
  assert.match(sheet, /<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">שם<\/t><\/is><\/c>/, 'the header is styled');
  assert.match(sheet, /<c r="C2" s="2" t="inlineStr"><is><t xml:space="preserve">13:45<\/t><\/is><\/c>/, 'a time stays text, green');
  assert.match(sheet, /<c r="C3" s="3"><v>85<\/v><\/c>/, 'a score is a number, red');
  assert.match(sheet, /<c r="D2" s="5" t="inlineStr">/, 'notes wrap');
  assert.match(sheet, /<c r="A4" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\)<\/t>/, 'never a formula');
  assert.doesNotMatch(sheet, /<f>/);
  assert.match(sheet, /<col min="4" max="4" width="40" customWidth="1"\/>/);
  // Every style index used exists in styles.xml.
  const styleCount = Number(files['xl/styles.xml'].match(/<cellXfs count="(\d+)">/)[1]);
  assert.equal((files['xl/styles.xml'].match(/<xf [^>]*xfId="0"/g) ?? []).length, styleCount);
  for (const [, index] of sheet.matchAll(/ s="(\d+)"/g)) assert.ok(Number(index) < styleCount);
});

test('an empty cell writes nothing (an empty header cell keeps its shading), and no columns freeze unless asked', () => {
  const xml = worksheetXml({ name: 'x', rows: [['א', null, 'ב'], [null, '', 0]] });
  assert.match(xml, /<c r="B1" s="1"\/>/);
  assert.doesNotMatch(xml, /r="A2"|r="B2"/);
  assert.match(xml, /<c r="C2"><v>0<\/v><\/c>/, 'zero is a value');
  assert.match(xml, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
});

test('the tracking page exports what the table shows, and only reads', () => {
  const page = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');
  assert.match(page, /ייצוא לאקסל/);
  assert.doesNotMatch(page, /title="בשלב הבא"/, 'the placeholder is gone');
  assert.match(page, /onClick=\{\(\) => void exportTrackingExcel\(\)\}/);
  const exportFn = page.slice(page.indexOf('const exportTrackingExcel = async'), page.indexOf('const headerActions = ('));
  assert.match(exportFn, /visibleSoldiers\.map/, 'the filtered soldiers, in the table order');
  assert.match(exportFn, /visibleItems\.map/, 'the filtered items');
  assert.match(exportFn, /isTimeScore\(config\) \? formatScore\(score, config\) : score/);
  assert.match(exportFn, /rightToLeft: true/);
  assert.match(exportFn, /if \(result === 'needs_tap'\) downloadBlob\(blob, fileName\);/);
  assert.match(exportFn, /actionType: 'tracking_exported'/);
  assert.doesNotMatch(exportFn, /\.from\(|\.update\(|\.insert\(|\.upsert\(|\.delete\(/, 'export never writes tracking data');
});
