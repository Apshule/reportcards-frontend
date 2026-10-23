import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
const pageSizes = [];
const drawnText = [];
const drawnTextOptions = [];
let stampApplied = false;
let qrApplied = false;

const font = { widthOfTextAtSize: (text, size) => String(text).length * size * 0.46 };
const document = {
  setTitle() {},
  setAuthor() {},
  addPage(size) {
    pageSizes.push(size);
    return {
      drawRectangle() {},
      drawLine() {},
      drawImage() {},
      drawText(text, options = {}) {
        drawnText.push(String(text));
        drawnTextOptions.push({ text: String(text), ...options });
      },
      getWidth: () => size[0],
      getHeight: () => size[1],
      getSize: () => ({ width: size[0], height: size[1] }),
    };
  },
  async embedFont() { return font; },
  async save() { return new Uint8Array([pageSizes.length]); },
};

window.PDFLib = {
  PDFDocument: { async create() { pageSizes.length = 0; drawnText.length = 0; drawnTextOptions.length = 0; return document; } },
  StandardFonts: { Helvetica: "regular", HelveticaBold: "bold" },
  rgb: (red, green, blue) => ({ red, green, blue }),
};
window.ReportCardTemplatePicker = {
  periodDefinition(key) {
    if (key === "COMBINED_BM") return {
      key,
      title: "COMBINED (B.O.T + MIDTERM)",
      fields: [{ key: "bot", label: "B.O.T" }, { key: "mid_term", label: "MIDTERM" }],
      combined: true,
    };
    return { key: "EOT", title: "END OF TERM", fields: [{ key: "eot_period", label: "E.O.T" }], combined: false };
  },
  periodValue(mark, field) {
    const raw = mark?.period_marks?.[field] ?? mark?.[field];
    return raw === null || raw === undefined || raw === "" ? null : Number(raw);
  },
  periodScore(mark, key) {
    if (key !== "COMBINED_BM") return null;
    const bot = this.periodValue(mark, "bot");
    const midterm = this.periodValue(mark, "mid_term");
    return bot === null || midterm === null ? null : (bot + midterm) / 2;
  },
};
window.ReportCardThemeEngine = {
  getTheme: () => ({
    primary_color: "#4B2E9E",
    accent_color: "#D1C4E9",
    table_header_color: "#F6F2FC",
    table_header_text_color: "#4B2E9E",
  }),
};
window.ReportCardStampRenderer = {
  async apply(bytes) { stampApplied = true; return bytes; },
};
window.ReportCardQrRenderer = {
  async apply(bytes) { qrApplied = true; return bytes; },
};
new Function("window", readFileSync(new URL("../pdf-templates.js", import.meta.url), "utf8"))(window);

const report = {
  period: "COMBINED_BM",
  term: "TERM_1",
  year: 2026,
  class: { name: "P.7", level: "PRIMARY" },
  learner: { full_name: "A5 Test Learner", reg_no: "A5-1" },
  school: {
    name: "A5 Test School",
    school_subtitle: "Mixed Day & Boarding Primary School",
    street: "P.O. Box 123, Kampala",
    phone: "0750002345",
    email: "info@school.com",
    website: "www.school.com",
    motto: "Learning with ease",
    stamp_config: { line_1: "STAMP MUST NOT PRINT" },
    watermark_enabled: true,
  },
  authenticity_qr_data_url: "data:image/png;base64,QUJD",
  class_teacher_comment: "Excellent progress.",
  principal_comment: "Keep working hard.",
  grading_scale_preset_key: "primary_ple_upper",
  summary: { aggregate: 5, aggregate_division: "Division I", aggregate_interpretation: "Top Secondary" },
  subjects: [{
    name: "Literacy",
    mark: {
      bot: 60,
      mid_term: 72,
      eot_period: 91,
      grade: "B",
      tr: "Strong progress",
    },
  }],
};

test("condensed output is one A5 page with only B.O.T and Midterm data", async () => {
  stampApplied = false;
  qrApplied = false;
  const bytes = await window.ReportCardPdf.render(report, "PRIMARY", "1", true, "A5_CONDENSED");

  assert.deepEqual(pageSizes, [[419.53, 595.28]]);
  assert.equal(bytes[0], 1);
  for (const label of ["Subject", "B.O.T", "Midterm", "Average", "Grade", "Remarks"]) {
    assert.ok(drawnText.includes(label), `A5 PDF should include ${label}`);
  }
  assert.ok(drawnText.includes("66.0"), "Average must be the mean of B.O.T and Midterm");
  assert.ok(drawnText.includes("B"), "Ordinary grades should render without a blank overall grade");
  assert.equal(drawnText.includes("B/—"), false);
  assert.ok(drawnText.includes("Strong progress"));
  assert.ok(drawnText.some((text) => text.includes("Class Teacher: Excellent progress.")));
  assert.ok(drawnText.some((text) => text.includes("Principal: Keep working hard.")));
  assert.ok(drawnText.some((text) => text.includes("Grading key:")));
  assert.ok(drawnText.some((text) => text.includes("PLE aggregate: 5")));
  assert.ok(drawnText.includes("Class Teacher's signature"));
  for (const headerLine of [
    "A5 Test School",
    "Mixed Day & Boarding Primary School",
    "P.O. Box 123, Kampala",
    "Tel: 0750002345, Email: info@school.com",
    "Website: www.school.com",
    "Learning with ease",
  ]) {
    assert.ok(drawnText.some((text) => text.includes(headerLine)), `A5 header should include ${headerLine}`);
  }
  assert.equal(drawnText.some((text) => /E\.O\.T|FINAL|STAMP MUST NOT PRINT|QR/i.test(text)), false);
  assert.equal(stampApplied, false, "A5 must not pass through the digital stamp renderer");
  assert.equal(qrApplied, false, "A5 must not pass through the authenticity QR renderer");
});

test("A5 format refuses assessment periods other than B.O.T + Midterm", async () => {
  await assert.rejects(
    window.ReportCardPdf.render({ ...report, period: "EOT" }, "PRIMARY", "1", false, "A5_CONDENSED"),
    /requires Combined \(B\.O\.T \+ Midterm\)/,
  );
});

test("A5 header keeps the requested font hierarchy and full comments with term dates", async () => {
  const reportWithFullText = {
    ...report,
    term_dates: { term_ended_on: "2026-10-23", next_term_begins: "2027-02-01" },
    class_teacher_comment: `A detailed teacher comment that must remain complete without abbreviations. ${"Keep learning and keep trying. ".repeat(3)}A5-TEACHER-END`,
    principal_comment: `A detailed principal comment that must remain complete without abbreviations. ${"Work steadily and be kind. ".repeat(3)}A5-PRINCIPAL-END`,
  };
  const bytes = await window.ReportCardPdf.render(reportWithFullText, "PRIMARY", "1", true, "A5_CONDENSED");
  assert.deepEqual(pageSizes, [[419.53, 595.28]]);
  assert.equal(bytes[0], 1);
  for (const [label, size] of [
    ["A5 Test School", 15],
    ["P.O. Box 123, Kampala", 14],
    ["Tel: 0750002345, Email: info@school.com", 14],
    ["Website: www.school.com", 14],
    ["Mixed Day & Boarding Primary School", 12],
    ["Learning with ease", 12],
  ]) {
    assert.equal(drawnTextOptions.find((entry) => entry.text.includes(label))?.size, size, `${label} should be ${size}pt`);
  }
  assert.ok(drawnText.includes("Term Ends On: 23 Oct 2026"));
  assert.ok(drawnText.includes("Next Term Begins: 1 Feb 2027"));
  assert.ok(drawnText.some((text) => text.includes("A5-TEACHER-END")));
  assert.ok(drawnText.some((text) => text.includes("A5-PRINCIPAL-END")));
  assert.equal(drawnTextOptions.some((entry) => entry.text.includes("A5-") && entry.text.includes("...")), false);
});
