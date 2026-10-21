import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
let pages = [];
let drawnText = [];
const page = () => ({
  drawRectangle() {},
  drawLine() {},
  drawText(value) { drawnText.push(String(value)); },
  drawImage() {},
  drawEllipse() {},
  getWidth: () => 595.28,
  getHeight: () => 841.89,
  getSize: () => ({ width: 595.28, height: 841.89 }),
});
const document = {
  setTitle() {},
  setAuthor() {},
  addPage() {
    const next = page();
    pages.push(next);
    return next;
  },
  getPages: () => pages,
  async embedFont() {
    return { widthOfTextAtSize: (value, size) => String(value).length * size * 0.48 };
  },
  async save() {
    return new Uint8Array([pages.length]);
  },
};

window.PDFLib = {
  PDFDocument: {
    async create() {
      pages = [];
      drawnText = [];
      return document;
    },
  },
  StandardFonts: { Helvetica: "regular", HelveticaBold: "bold", HelveticaOblique: "italic" },
  rgb: (red, green, blue) => ({ red, green, blue }),
};
window.ReportCardTemplatePicker = {
  periodDefinition: () => ({ key: "EOT", title: "End of Term", fields: [{ key: "eot", label: "EOT" }] }),
  periodValue: (mark, key) => mark[key] === undefined ? null : Number(mark[key]),
  periodScore: (mark) => mark.eot === undefined ? null : Number(mark.eot),
};
window.ReportCardThemeEngine = {
  getTheme: () => ({
    primary_color: "#4B2E9E",
    accent_color: "#D1C4E9",
    background_color: "#F7F6FA",
    header_color: "#4B2E9E",
    header_text_color: "#FFFFFF",
    table_header_color: "#F6F2FC",
    table_header_text_color: "#4B2E9E",
  }),
};
new Function("window", readFileSync(new URL("../pdf-templates.js", import.meta.url), "utf8"))(window);

const baseReport = {
  learner: { full_name: "Test Learner", reg_no: "T-1" },
  school: { name: "Example School", motto: "Learning with ease" },
  term: "TERM_1",
  year: 2026,
  summary: { overall_average: 78, overall_grade: "B", position: 1, class_size: 30 },
  term_dates: { next_term_begins: "2026-11-01", next_term_ends: "2027-02-01" },
};
const subjects = (count) => Array.from({ length: count }, (_, index) => ({
  name: `Subject ${index + 1}`,
  code: `S${index + 1}`,
  mark: {
    eot: 70 + index,
    grade: "B",
    descriptor: "Exhibits a high level of competency",
    teacher_initials: "AB",
  },
}));

test("common Nursery, Primary, O-Level, and A-Level cards remain single-page", async () => {
  const cases = [
    ["Nursery", {
      ...baseReport,
      class: { level: "NURSERY", name: "Baby Class" },
      subjects: subjects(5),
      activities: Array.from({ length: 10 }, (_, index) => ({ name: `Activity ${index + 1}`, remark: "Good progress" })),
    }, (report) => window.ReportCardPdf.renderNursery(report)],
    ["Primary", {
      ...baseReport,
      class: { level: "PRIMARY", name: "P.7" },
      subjects: subjects(13),
    }, (report) => window.ReportCardPdf.renderPrimary(report)],
    ["O-Level", {
      ...baseReport,
      class: { level: "O_LEVEL", name: "S.4" },
      subjects: subjects(13),
    }, (report) => window.ReportCardPdf.renderOLevel(report)],
    ["A-Level", {
      ...baseReport,
      class: { level: "A_LEVEL", name: "S.6" },
      subjects: subjects(8),
      projects: Array.from({ length: 3 }, (_, index) => ({
        project_name: `Project ${index + 1}`,
        score: 8,
        remarks: "Good progress",
      })),
    }, (report) => window.ReportCardPdf.renderALevel(report)],
  ];

  for (const [level, report, render] of cases) {
    const pdf = await render(report);
    assert.equal(pdf[0], 1, `${level} report should stay on one page`);
  }
});

test("configured other subjects render in every PDF level without adding static defaults", async () => {
  const cases = [
    ["NURSERY", "Baby Class", (report) => window.ReportCardPdf.renderNursery(report)],
    ["PRIMARY", "P.7", (report) => window.ReportCardPdf.renderPrimary(report)],
    ["O_LEVEL", "S.4", (report) => window.ReportCardPdf.renderOLevel(report)],
    ["A_LEVEL", "S.6", (report) => window.ReportCardPdf.renderALevel(report)],
  ];
  for (const [level, className, render] of cases) {
    const report = {
      ...baseReport,
      class: { level, name: className },
      subjects: subjects(3),
      other_subjects: [{
        name: "Robotics",
        grade: "A",
        progress: "A",
        score: 88,
        remark: "Very good",
        teacher_initials: "ET",
      }],
      co_curricular_configured: true,
    };
    const pdf = await render(report);
    assert.equal(pdf[0], 1, `${level} should remain one page`);
    assert.equal(drawnText.some((text) => text.includes("Robotics")), true, `${level} should include the configured activity`);
    assert.equal(drawnText.some((text) => text.includes("Very good")), true, `${level} should include the activity remark`);
    assert.equal(drawnText.some((text) => text.includes("Handwriting")), false, `${level} should not append an unconfigured default row`);
  }
});

test("primary PDF respects the no-position setting and renders subject remarks and custom grading bands", async () => {
  const report = {
    ...baseReport,
    school: { ...baseReport.school, show_report_position: false },
    class: { level: "PRIMARY", name: "P.7" },
    subjects: [{
      name: "English",
      mark: { a1: 2, a2: 3, a3: 2, eot: 84, grade: "A", tr: "Excellent subject work" },
    }],
    grading_scale: [
      { grade_code: "A", min_score: 80, max_score: 100, descriptor: "Excellent" },
      { grade_code: "B", min_score: 70, max_score: 79, descriptor: "Very good" },
    ],
  };
  await window.ReportCardPdf.renderPrimary(report);
  assert.equal(drawnText.some((text) => /POSITION/i.test(text)), false);
  assert.equal(drawnText.some((text) => text.includes("Excellent subject work")), true);
  assert.equal(drawnText.some((text) => text.includes("GRADING SCALE:")), true);
  assert.equal(drawnText.some((text) => text.includes("A 80–100")), true);

  await window.ReportCardPdf.renderPrimary({
    ...report,
    school: { ...report.school, show_report_position: true },
  });
  assert.equal(drawnText.some((text) => /POSITION/i.test(text)), true);
});

test("A-Level PDF shows paper grades and separate overall-grade points with the active grading key", async () => {
  await window.ReportCardPdf.renderALevel({
    ...baseReport,
    class: { level: "A_LEVEL", name: "S.6" },
    subjects: [{
      name: "Biology",
      code: "P530",
      mark: {
        paper_number: 1,
        eot: 88,
        grade: "D1",
        overall_grade_code: "A",
        grade_point_type: "principal",
        points: 6,
        tr: "Excellent performance in this subject.",
      },
    }],
    grading_scale: [
      { grade_code: "D1", min_score: 85, max_score: 100, descriptor: "Distinction 1" },
      { grade_code: "F9", min_score: 0, max_score: 39, descriptor: "Fail 9" },
    ],
    grading_scale_preset_key: "a_level_legacy",
    grading_points_scheme: {
      principal: { A: 6, B: 5, C: 4, D: 3, E: 2, O: 1, F: 0 },
      subsidiary: { A: 1, B: 0.5, C: 0.5, D: 0.5, E: 0.5, O: 0, F: 0 },
    },
  });
  assert.equal(pages.length, 1);
  assert.equal(drawnText.some((text) => text.includes("D1/A (6)")), true);
  assert.equal(drawnText.some((text) => text.includes("Principal A6/B5/C4")), true);
  assert.equal(drawnText.some((text) => text.includes("Subsidiary A1/B0.5")), true);
});

test("Nursery PDF keeps the Head of Infants remarks section", async () => {
  await window.ReportCardPdf.renderNursery({
    ...baseReport,
    school: baseReport.school,
    class: { level: "NURSERY", name: "Baby Class" },
    subjects: subjects(3),
    head_teacher_comment: "Keep progressing",
  });
  assert.equal(drawnText.some((text) => text.includes("Head of Infants Remarks")), true);
});

test("generated teacher and principal remarks render without adding a PDF page", async () => {
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    learner: { full_name: "Juscelino Kisule", reg_no: "P7-01" },
    class: { level: "PRIMARY", name: "P.7" },
    class_teacher_comment: "Juscelino: Excellent work. Keep progressing.",
    principal_comment: "The school commends Juscelino for excellent achievement and encourages continued excellence.",
    subjects: subjects(12),
  });
  assert.equal(pages.length, 1);
  assert.equal(drawnText.some((text) => text.includes("Juscelino: Excellent work")), true);
  assert.equal(drawnText.some((text) => text.includes("commends Juscelino")), true);
});
