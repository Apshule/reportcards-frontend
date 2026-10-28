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
    school: { name: "Sample School", show_report_position: false, primary_result_metric: "ple_aggregate" },
    class: { level: "PRIMARY", name: "P.7" },
    term: "TERM_1",
    year: 2026,
    summary: { position: 2, class_size: 25, overall_average: 82, overall_grade: "A", total_score: 82, aggregate: 5, aggregate_division: "Division 1", result_metric: "ple_aggregate" },
    subjects: [{
      name: "English",
      mark: { eot: 82, grade: "A", position: 2, class_size: 25, tr: "Excellent subject work" },
    }],
    grading_scale: [
      ["D1", 85, 100, 1], ["D2", 70, 84, 2], ["C3", 60, 69, 3],
      ["C4", 50, 59, 4], ["C5", 45, 49, 5], ["C6", 40, 44, 6],
      ["P7", 35, 39, 7], ["P8", 30, 34, 8], ["F9", 0, 29, 9],
    ].map(([grade_code, min_score, max_score, points]) => ({ grade_code, min_score, max_score, points })),
    ple_official_enabled: true,
    incomplete_marks: [],
    grading_scale_preset_key: "primary_ple_upper",
  };
  const preview = window.ReportCardPreview.render(report, { template: "1" });
  assert.doesNotMatch(preview, /POSITION/u);
  assert.match(preview, /PLE AGGREGATE/u);
  assert.match(preview, /GRADE/u);
  assert.match(preview, /PLE AGGREGATE:<\/b> 5 · Division 1/u);
  assert.match(preview, /Excellent subject work/u);
  assert.match(preview, /Head Teacher&#39;s Remarks/u);
  assert.doesNotMatch(preview, /Head of Infants Remarks/u);
  assert.match(preview, /GRADING SCALE:<\/b> UNEB PLE: D1 85–100 \(1 pt\) · D2 70–84 \(2 pts\)/u);

  const nursery = window.ReportCardPreview.render({
    ...report,
    school: { name: "Sample School" },
    class: { level: "NURSERY", name: "Baby Class" },
    subjects: [],
    summary: {},
  });
  assert.match(nursery, /Head of Infants Remarks/u);
});

test("Nursery preview renders populated and empty subject lists without a loading-state crash", () => {
  const common = {
    learner: { full_name: "Nursery Preview Learner", reg_no: "N-01" },
    school: { name: "Sample Nursery School" },
    class: { level: "NURSERY", name: "Top Class" },
    term: "TERM_1",
    year: 2026,
    summary: {},
    co_curricular_configured: false,
  };

  const populated = window.ReportCardPreview.render({
    ...common,
    subjects: [{
      name: "Taking care of myself for proper growth and development",
      mark: { eot: 85, tr: "Excellent progress" },
    }],
    other_subjects: [],
  }, { template: "1", period: "EOT" });

  assert.match(populated, /Achievement Scores/u);
  assert.match(populated, /Taking care of myself for proper growth and development/u);
  assert.match(populated, /Excellent progress/u);
  assert.match(populated, /Performance in the Learning Activities/u);
  assert.equal((populated.match(/class="rc-nursery-activity-card"/g) || []).length, 10);
  assert.doesNotMatch(populated, /loading-row|Loading records/u);

  const empty = window.ReportCardPreview.render({
    ...common,
    subjects: [],
    other_subjects: [],
  }, { template: "1", period: "EOT" });

  assert.match(empty, /No marks recorded for this term/u);
  assert.match(empty, /Performance in the Learning Activities/u);
  assert.equal((empty.match(/class="rc-nursery-activity-card"/g) || []).length, 10);
  assert.doesNotMatch(empty, /loading-row|Loading records/u);
});

test("HTML preview uses separate Old and New UCE tables and only their prescribed result metrics", () => {
  const common = {
    learner: { full_name: "UCE Learner", reg_no: "S4-01" },
    school: { name: "UCE School" },
    class: { level: "O_LEVEL", name: "S.4" },
    term: "TERM_1",
    year: 2026,
    subjects: [{
      id: "subject-1",
      name: "English",
      mark: {
        ca_score: 90,
        exam_score: 90,
        final_score: 90,
        pct100: 90,
        grade: "D1",
        points: 1,
        tr: "Strong subject work",
        teacher_initials: "AB",
      },
    }],
  };
  const oldPreview = window.ReportCardPreview.render({
    ...common,
    grading_scale_preset_key: "o_level_old_uce",
    grading_scale: [
      { grade_code: "D1", min_score: 85, max_score: 100, points: 1 },
      { grade_code: "F9", min_score: 0, max_score: 29, points: 9 },
    ],
    uce_result: { aggregate: 8, division_code: "DIVISION 1" },
  });
  assert.match(oldPreview, /ANNUAL UCE REPORT/u);
  assert.match(oldPreview, /ANNUAL UCE RESULTS — D1–F9 SYSTEM/u);
  assert.match(oldPreview, /FINAL SCORE/u);
  assert.match(oldPreview, /D1/u);
  assert.match(oldPreview, /Best-8 Aggregate:<\/b> 8/u);
  assert.match(oldPreview, /Division:<\/b> DIVISION 1/u);
  assert.doesNotMatch(oldPreview, /Average:<\/b>/u);

  const newPreview = window.ReportCardPreview.render({
    ...common,
    grading_scale_preset_key: "o_level_new_uce",
    grading_scale: [
      { grade_code: "A", min_score: 80, max_score: 100, descriptor: "Exceptional" },
      { grade_code: "E", min_score: 0, max_score: 49, descriptor: "Elementary" },
    ],
    subjects: [{
      ...common.subjects[0],
      mark: { ...common.subjects[0].mark, grade: "A", achievement_level: "Exceptional" },
    }],
    uce_result: {
      result_indicator: "Result 1",
      qualified_for_certificate: true,
      project_work_completed: true,
      completed_subject_count: 8,
    },
  });
  assert.match(newPreview, /ANNUAL UCE REPORT/u);
  assert.match(newPreview, /ANNUAL UCE RESULTS — COMPETENCY SYSTEM/u);
  assert.match(newPreview, /ACHIEVEMENT LEVEL/u);
  assert.match(newPreview, /Result:<\/b> Result 1/u);
  assert.match(newPreview, /Certificate:<\/b> Qualified/u);
  assert.doesNotMatch(newPreview, /Best-8 Aggregate/u);
  assert.doesNotMatch(newPreview, /Average:<\/b>/u);
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

test("HTML preview leaves missing House and Days Absent values blank", () => {
  const html = window.ReportCardPreview.render({
    learner: { full_name: "Sample learner", reg_no: "P7-01", house: null },
    school: { name: "Sample School" },
    class: { level: "PRIMARY", name: "P.7" },
    term: "TERM_1",
    year: 2026,
    subjects: [],
    summary: {},
  }, { template: "1" });

  assert.match(html, /<b>HOUSE<\/b><span><\/span>/u);
  assert.match(html, /<b>DAYS ABSENT<\/b><span><\/span>/u);
});
