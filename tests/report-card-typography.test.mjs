import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
window.ReportCardTemplatePicker = {
  periodDefinition: () => ({ key: "EOT", title: "End of Term", fields: [{ key: "eot", label: "EOT" }] }),
  periodValue: (mark, key) => mark[key] === undefined ? null : Number(mark[key]),
  periodScore: (mark) => mark.eot === undefined ? null : Number(mark.eot),
};
new Function("window", readFileSync(new URL("../report-card-preview.js", import.meta.url), "utf8"))(window);
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("preview formats ISO dates as readable UTC dates without changing non-date labels", () => {
  assert.equal(window.ReportCardPreview.formatReportDate("2026-10-19T23:48:40.931Z"), "19 Oct 2026");
  assert.equal(window.ReportCardPreview.formatReportDate("2026-10-19"), "19 Oct 2026");
  assert.equal(window.ReportCardPreview.formatReportDate("TERM 1"), "TERM 1");
});

test("inside stamp logos are capped and preview CSS clips logos to the stamp frame", () => {
  const markup = window.ReportCardPreview.renderStamp({
    school: {
      logo_base64: "data:image/png;base64,AA==",
      stamp_logo_position: "inside_center",
      stamp_config: {
        shape: "circle",
        line_1: "SCHOOL",
        stamp_logo_size: 100,
        stamp_logo_offset_x: 100,
        stamp_logo_offset_y: -100,
      },
    },
  });
  const size = Number(markup.match(/--rc-stamp-logo-size:([\d.]+)mm/u)?.[1]);
  assert.ok(size > 0 && size <= 9);
  assert.match(styles, /html \.rc-preview \.rc-stamp-preview\{overflow:hidden\}/u);
  assert.match(styles, /html \.rc-preview \.rc-stamp-logo\{max-width:50%;max-height:50%\}/u);
});

test("preview typography preserves the one-page hierarchy and descriptor exception", () => {
  assert.match(styles, /rc-school h2[\s\S]*?font-size:15pt/u);
  assert.match(styles, /rc-nursery-panel-title[\s\S]*?font-size:14pt/u);
  assert.match(styles, /rc-preview \.rc-table td\{font-size:11pt\}/u);
  assert.match(styles, /rc-preview\.rc-preview-level-o_level[\s\S]*?font-size:10pt/u);
  assert.match(styles, /rc-preview \.rc-info-row>div[\s\S]*?font-size:5pt/u);
});

test("HTML preview omits position when disabled and uses subject remarks and custom grading bands", () => {
  const report = {
    learner: { full_name: "Sample learner", reg_no: "P7-01" },
    school: { name: "Sample School", show_report_position: false },
    class: { level: "PRIMARY", name: "P.7" },
    term: "TERM_1",
    year: 2026,
    summary: { position: 2, class_size: 25, overall_average: 82, overall_grade: "A", total_score: 82 },
    subjects: [{
      name: "English",
      mark: { eot: 82, grade: "A", position: 2, class_size: 25, tr: "Excellent subject work" },
    }],
    grading_scale: [{ grade_code: "A", min_score: 80, max_score: 100, descriptor: "Excellent" }],
  };
  const preview = window.ReportCardPreview.render(report, { template: "1" });
  assert.doesNotMatch(preview, /POSITION/u);
  assert.match(preview, /AVERAGE/u);
  assert.match(preview, /GRADE/u);
  assert.match(preview, /Excellent subject work/u);
  assert.match(preview, /Head Teacher&#39;s Remarks/u);
  assert.doesNotMatch(preview, /Head of Infants Remarks/u);
  assert.match(preview, /GRADING SCALE:<\/b> A 80/u);

  const nursery = window.ReportCardPreview.render({
    ...report,
    school: { name: "Sample School" },
    class: { level: "NURSERY", name: "Baby Class" },
    subjects: [],
    summary: {},
  });
  assert.match(nursery, /Head of Infants Remarks/u);
});

test("HTML preview renders admin-configured co-curricular subjects without static defaults", () => {
  const preview = window.ReportCardPreview.render({
    learner: { full_name: "Sample learner", reg_no: "P7-01" },
    school: { name: "Sample School" },
    class: { level: "PRIMARY", name: "P.7" },
    term: "TERM_1",
    year: 2026,
    subjects: [],
    other_subjects: [{
      name: "School Garden",
      grade: "B",
      progress: "B",
      remark: "Excellent care",
      teacher_initials: "AB",
    }],
    co_curricular_configured: true,
    summary: {},
  }, { template: "1" });
  assert.match(preview, /School Garden/u);
  assert.match(preview, /Excellent care/u);
  assert.doesNotMatch(preview, /Handwriting/u);
});

test("HTML preview renders the generated class-teacher and principal remarks", () => {
  const preview = window.ReportCardPreview.render({
    learner: { full_name: "Juscelino Kisule", reg_no: "P7-01" },
    school: { name: "Sample School", principal_name: "A. Principal" },
    class: { level: "PRIMARY", name: "P.7", class_teacher_name: "C. Teacher" },
    term: "TERM_1",
    year: 2026,
    subjects: [],
    class_teacher_comment: "Juscelino: Excellent work. Keep progressing.",
    principal_comment: "The school commends Juscelino for excellent achievement and encourages continued excellence.",
    summary: {},
  }, { template: "1" });
  assert.match(preview, /Juscelino: Excellent work/u);
  assert.match(preview, /commends Juscelino/u);
});

test("HTML preview shows learner house and omits the digital stamp when disabled", () => {
  const html = window.ReportCardPreview.render({
    learner: { full_name: "Sample learner", reg_no: "P7-01", house: "Eagle" },
    school: {
      name: "Sample School",
      show_stamp: false,
      stamp_config: { line_1: "OFFICIAL SCHOOL STAMP" },
    },
    class: { level: "PRIMARY", name: "P.7" },
    term: "TERM_1",
    year: 2026,
    subjects: [],
    summary: {},
  }, { template: "1" });

  assert.match(html, /<b>HOUSE<\/b><span>Eagle<\/span>/u);
  assert.doesNotMatch(html, /OFFICIAL SCHOOL STAMP|rc-stamp-preview/u);
});
