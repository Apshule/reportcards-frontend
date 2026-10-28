import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = { PDFLib: {} };
new Function("window", readFileSync(new URL("../pdf-templates.js", import.meta.url), "utf8"))(window);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readStoredEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const checksum = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    const contents = bytes.slice(dataStart, dataStart + size);

    assert.equal(method, 0, "ZIP entries should use the supported store method");
    assert.equal(contents.length, size);
    assert.equal(crc32(contents), checksum, `CRC should match for ${name}`);
    entries.push({ name, contents });
    offset = dataStart + size;
  }

  assert.equal(view.getUint32(offset, true), 0x02014b50, "central directory should follow the file entries");
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50, "ZIP end record should be present");
  return entries;
}

test("class ZIP filenames replace spaces and remove punctuation", () => {
  assert.equal(window.ReportCardPdf.archiveNamePart("S.1 East / Blue", "Class"), "S1_East_Blue");
  assert.equal(window.ReportCardPdf.archiveNamePart("Mariam O'Neal", "Learner"), "Mariam_ONeal");
  assert.equal(window.ReportCardPdf.archiveTermPart("TERM_1"), "TERM1");
  assert.equal(window.ReportCardPdf.archiveTermPart("TERM 3"), "TERM3");
});

test("ZIP output contains correctly named PDF entries and valid contents", async () => {
  const encoder = new TextEncoder();
  const pdfA = encoder.encode("%PDF-1.4\nstudent-a");
  const pdfB = encoder.encode("%PDF-1.4\nstudent-b");
  const term = window.ReportCardPdf.archiveTermPart("TERM_1");
  const year = window.ReportCardPdf.archiveNamePart(2026, "Year");
  const files = [
    { name: `${window.ReportCardPdf.archiveNamePart("Mariam O'Neal", "Learner")}_${term}_${year}_ReportCard.pdf`, bytes: pdfA },
    { name: `${window.ReportCardPdf.archiveNamePart("Juscelino B. Kisule", "Learner")}_${term}_${year}_ReportCard.pdf`, bytes: pdfB },
  ];

  const blob = window.ReportCardPdf.createZip(files);
  assert.equal(blob.type, "application/zip");
  const entries = readStoredEntries(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(entries.map((entry) => entry.name), [
    "Mariam_ONeal_TERM1_2026_ReportCard.pdf",
    "Juscelino_B_Kisule_TERM1_2026_ReportCard.pdf",
  ]);
  assert.deepEqual([...entries[0].contents], [...pdfA]);
  assert.deepEqual([...entries[1].contents], [...pdfB]);
});

test("Report Cards page exposes class ZIP beside single PDF with progress feedback", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const actionsStart = app.indexOf('const actions=`<button class="btn btn-primary" data-action="download-class-zip"');
  const actionsEnd = app.indexOf("</button>", actionsStart);
  const zipButton = app.slice(actionsStart, actionsEnd);
  assert.ok(actionsStart >= 0, "class ZIP action should be rendered");
  assert.match(zipButton, /Download Class ZIP/);
  assert.match(zipButton, /!reportState\.classId\|\|!reportState\.term\|\|!reportState\.year/);
  assert.doesNotMatch(zipButton, /!reports\.length/, "loading preview data must not be required to enable the ZIP button");
  assert.match(app, /data-action="download-report-pdf"[\s\S]{0,200}Download PDF/);
  assert.match(app, /Generating ZIP\.\.\. This may take a minute/);
  assert.match(app, /const classId=reportState\.classId;/);
  assert.match(app, /Choose a class, term, and year first/);
  assert.match(app, /\/api\/class\/\$\{encodeURIComponent\(classId\)\}\/card-data\?\$\{query\}/);
  assert.match(app, /period:apiReportPeriod\(zipContext\.period\)/);
  assert.match(app, /zipContext\.layoutFormat\);/);
});
