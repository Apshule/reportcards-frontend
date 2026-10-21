import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
let pages = [];
const page = () => ({
  drawRectangle() {},
  drawLine() {},
  drawText() {},
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
