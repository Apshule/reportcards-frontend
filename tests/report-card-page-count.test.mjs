import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
globalThis.fetch = async (input) => {
  const filename = String(input).split("/").pop();
  const bytes = readFileSync(new URL(`../pdf-templates/nursery-icons/${filename}`, import.meta.url));
  return {
    ok: true,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};
let pages = [];
let drawnText = [];
let drawnTextOptions = [];
let drawnImages = [];
const page = () => ({
  drawRectangle() {},
  drawLine() {},
  drawText(value, options = {}) {
    drawnText.push(String(value));
    drawnTextOptions.push({ text: String(value), ...options });
  },
  drawImage(_image, options) { drawnImages.push(options); },
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
  async embedPng() { return { width: 300, height: 200 }; },
  async save() {
    return new Uint8Array([pages.length]);
  },
};

window.PDFLib = {
  PDFDocument: {
    async create() {
      pages = [];
      drawnText = [];
      drawnTextOptions = [];
      drawnImages = [];
      return document;
    },
  },
  StandardFonts: { Helvetica: "regular", HelveticaBold: "bold", HelveticaOblique: "italic" },
  rgb: (red, green, blue) => ({ red, green, blue }),
};
window.ReportCardTemplatePicker = {
  periodDefinition(value = "EOT") {
    const key = String(value || "EOT").toUpperCase();
    const definitions = {
      BOT: { key, title: "BEGINNING OF TERM", fields: [{ key: "bot", label: "B.O.T" }], combined: false },
      MID: { key, title: "MID-TERM", fields: [{ key: "mid_term", label: "MID-TERM" }], combined: false },
      EOT: { key: "EOT", title: "END OF TERM", fields: [{ key: "eot_period", label: "EOT" }], combined: false },
      COMBINED_BM: { key, title: "COMBINED (B.O.T + MIDTERM)", fields: [{ key: "bot", label: "B.O.T" }, { key: "mid_term", label: "MIDTERM" }], combined: true },
    };
    return definitions[key] || definitions.EOT;
  },
  periodValue(mark, key) {
    const value = mark?.period_marks?.[key] ?? mark?.[key];
    return value === null || value === undefined || value === "" ? null : Number(value);
  },
  periodScore(mark, period = "EOT") {
    const fields = this.periodDefinition(period).fields;
    const values = fields.map(({ key }) => this.periodValue(mark, key, period));
    return values.length && values.every((value) => value !== null && Number.isFinite(value))
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  },
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
  school: {
    name: "Example School",
    school_subtitle: "Mixed Day & Boarding Primary School",
    street: "P.O. Box 123, Kampala",
    phone: "0750002345",
    email: "info@school.com",
    website: "www.school.com",
    motto: "Learning with ease",
  },
  term: "TERM_1",
  year: 2026,
  summary: { overall_average: 78, overall_grade: "B", position: 1, class_size: 30 },
  term_dates: { next_term_begins: "2026-11-01", next_term_ends: "2027-02-01" },
};
const officialPleScale = [
  ["D1", 85, 100, 1], ["D2", 70, 84, 2], ["C3", 60, 69, 3],
  ["C4", 50, 59, 4], ["C5", 45, 49, 5], ["C6", 40, 44, 6],
  ["P7", 35, 39, 7], ["P8", 30, 34, 8], ["F9", 0, 29, 9],
].map(([grade_code, min_score, max_score, points]) => ({ grade_code, min_score, max_score, points }));
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
      for (const headerLine of [
        "Example School",
        "Mixed Day & Boarding Primary School",
        "P.O. Box 123, Kampala",
        "Tel: 0750002345, Email: info@school.com",
        "Website: www.school.com",
        "Learning with ease",
      ]) {
        assert.equal(drawnText.some((text) => text.includes(headerLine)), true, `${level} header should include ${headerLine}`);
      }
  }
});

test("Nursery PDF renders all ten activity icons and wraps full text in its one-page layout", async () => {
  const areaNames = [
    "Taking care of myself for proper growth and development",
    "Interacting, exploring, knowing and using my environment",
    "Relating with others in an acceptable way",
    "Developing and using my Language appropriately",
    "Developing and using Mathematical Concepts in my day-to-day",
  ];
  const activityNames = [
    "Writing", "Listening", "Reading", "Speaking", "Drawing", "Games",
    "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits",
  ];
  const report = {
    ...baseReport,
    learner: { full_name: "Mumbejja Sharuwah", reg_no: "N-104", schoolpay_code: "SP-104" },
    class: { level: "NURSERY", name: "Baby Class", class_teacher_name: "Peter Mukisa" },
    term: "TERM_3",
    year: 2024,
    days_attended: 55,
    days_absent: 5,
    total_days: 60,
    summary: { total_score: 457, overall_average: 91.4, position: 1, class_size: 31 },
    subjects: areaNames.map((name, index) => ({
      name,
      learning_area_description: `Learners practice ${name.toLowerCase()} through everyday classroom activities and guided play.`,
      mark: { eot: [94, 88, 89, 96, 90][index], tr: "Excellent progress with confident participation." },
    })),
    activities: activityNames.map((name) => ({
      name,
      remark: "Excellent progress and confidence.",
    })),
    class_teacher_comment: "Mumbejja has shown excellent progress and participates confidently in every learning activity.",
    behaviors_comment: "Mumbejja demonstrates good personal hygiene and care for classroom materials.",
    head_of_infants_comment: "Keep encouraging her curiosity, kindness, and joyful learning.",
    school: {
      ...baseReport.school,
      name: "KIKAJU SDA PRIMARY SCHOOL",
      motto: "Jesus Never Fails",
      head_of_infants_name: "Mary Nabbosa",
    },
  };

  const pdf = await window.ReportCardPdf.renderNursery(report);
  assert.equal(pdf[0], 1, "Nursery layout should fit on one page");
  assert.equal(drawnImages.length, 10, "all ten activities should contain an embedded icon");
  const pageText = drawnText.join(" ");
  assert.ok(pageText.includes("TERM 3 PROGRESS REPORT"), "Nursery term title should format the term number correctly");
  assert.equal(pageText.includes("TERM 1II"), false, "Nursery term title must not misformat Roman numerals");
  for (const name of activityNames) assert.ok(pageText.includes(name.toUpperCase()), `missing activity label: ${name}`);
  for (const name of areaNames) assert.ok(pageText.includes(name), `missing learning area: ${name}`);
  for (const phrase of [
    "TOTAL: 500",
    "SCORED: 457",
    "POSITION: 1st OUT OF 31",
    "Class Teacher's Report",
    "Behaviors / Cleanliness",
    "Head Teacher's Comment",
    "Mumbejja has shown excellent progress",
    "Mary Nabbosa",
  ]) assert.ok(pageText.includes(phrase), `missing Nursery report content: ${phrase}`);
  assert.equal(drawnText.some((text) => text.includes("...")), false, `text must wrap rather than truncate: ${JSON.stringify(drawnText.filter((text) => text.includes("...")))}`);
});

test("Nursery report columns follow the selected period and A5 Combined renders one page", async () => {
  const learningAreas = [
    "Taking care of myself for proper growth and development",
    "Interacting, exploring, knowing and using my environment",
    "Relating with others in an acceptable way",
    "Developing and using my Language appropriately",
    "Developing and using Mathematical Concepts in my day-to-day",
  ];
  const combined = {
    ...baseReport,
    learner: { full_name: "Mariam Test", reg_no: "N-200" },
    class: { level: "NURSERY", name: "Top Class" },
    term: "TERM_2",
    period: "COMBINED_BM",
    subjects: learningAreas.map((name, index) => ({
      name,
      mark: { bot: 70 + index, mid_term: 80 + index, tr: "Progressing well." },
    })),
    activities: ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits"]
      .map((name) => ({ name, remark: "Excellent." })),
    summary: { position: 1, class_size: 1 },
    school: { ...baseReport.school, activity_icons: [{ activity_name: "Writing", icon_base64: "data:image/png;base64,iVBORw0KGgo=" }] },
  };

  await window.ReportCardPdf.renderNursery(combined);
  const combinedText = drawnText.join(" ");
  for (const label of ["B.O.T", "Midterm", "Average", "Grade", "Teacher's Remark", "COMBINED (B.O.T + MIDTERM)"]) {
    assert.ok(combinedText.includes(label), `combined Nursery report should show ${label}`);
  }
  assert.ok(combinedText.includes("Progressing well."));
  assert.equal(combinedText.includes("Good behavior and maintains cleanliness."), true);

  const a5 = await window.ReportCardPdf.render(combined, "NURSERY", "1", false, "A5_CONDENSED");
  assert.equal(a5[0], 1, "Nursery A5 Combined output must remain a single page");
  const a5Text = drawnText.join(" ");
  for (const label of ["B.O.T", "MIDTERM", "Average", "Grade", "PERFORMANCE IN LEARNING ACTIVITIES"]) {
    assert.ok(a5Text.includes(label), `Nursery A5 output should show ${label}`);
  }
  assert.equal(drawnImages.length, 10, "all ten A5 activities must include contained icons");
});

test("Old and New UCE PDF templates show their distinct result metrics on one page", async () => {
  const oldScale = [
    ["D1", 85, 100, 1], ["D2", 70, 84, 2], ["C3", 60, 69, 3],
    ["C4", 50, 59, 4], ["C5", 45, 49, 5], ["C6", 40, 44, 6],
    ["P7", 35, 39, 7], ["P8", 30, 34, 8], ["F9", 0, 29, 9],
  ].map(([grade_code, min_score, max_score, points]) => ({ grade_code, min_score, max_score, points }));
  const newScale = [
    ["A", 80, 100, "Exceptional"], ["B", 70, 79, "Outstanding"],
    ["C", 60, 69, "Satisfactory"], ["D", 50, 59, "Basic"], ["E", 0, 49, "Emerging"],
  ].map(([grade_code, min_score, max_score, descriptor]) => ({
    grade_code, min_score, max_score, descriptor,
  }));
  const oldReport = {
    ...baseReport,
    class: { level: "O_LEVEL", name: "S.4" },
    grading_scale_preset_key: "o_level_old_uce",
    grading_scale: oldScale,
    subjects: Array.from({ length: 13 }, (_, index) => ({
      id: `old-${index}`,
      name: `Old Subject ${index + 1}`,
      mark: {
        ca_score: 90, exam_score: 90, final_score: 90, pct100: 90,
        grade: "D1", points: 1, tr: "Strong work", teacher_initials: "AB",
      },
    })),
    uce_result: { aggregate: 8, division_code: "DIVISION 1" },
  };
  const oldPdf = await window.ReportCardPdf.renderOLevel(oldReport);
  assert.equal(oldPdf[0], 1);
  assert.ok(drawnText.some((text) => text.includes("ANNUAL UCE REPORT")));
  assert.ok(drawnText.some((text) => text.includes("ANNUAL UCE RESULTS")));
  assert.ok(drawnText.some((text) => text.includes("D1")));
  assert.ok(drawnText.some((text) => text.includes("Best-8 Aggregate")));
  assert.ok(drawnText.some((text) => text.includes("DIVISION 1")));
  assert.ok(drawnText.some((text) => text.includes("Strong work")));

  const newReport = {
    ...baseReport,
    class: { level: "O_LEVEL", name: "S.4" },
    grading_scale_preset_key: "o_level_new_uce",
    grading_scale: newScale,
    subjects: Array.from({ length: 13 }, (_, index) => ({
      id: `new-${index}`,
      name: `New Subject ${index + 1}`,
      mark: {
        ca_score: 90, exam_score: 90, final_score: 90, pct100: 90,
        grade: "A", achievement_level: "Exceptional", descriptor: "Exceptional",
        tr: "Excellent progress", teacher_initials: "CD",
      },
    })),
    uce_result: {
      result_indicator: "Result 1",
      qualified_for_certificate: true,
      project_work_completed: true,
      completed_subject_count: 13,
    },
  };
  const newPdf = await window.ReportCardPdf.renderOLevel(newReport);
  assert.equal(newPdf[0], 1);
  assert.ok(drawnText.some((text) => text.includes("ANNUAL UCE REPORT")));
  assert.ok(drawnText.some((text) => text.includes("Result Indicator")));
  assert.ok(drawnText.some((text) => text.includes("Result 1")));
  assert.ok(drawnText.join(" ").includes("ACHIEVEMEN"));
  assert.ok(drawnText.some((text) => text.includes("Excellent progress")));
  assert.ok(!drawnText.some((text) => text.includes("Best-8 Aggregate")));
  assert.ok(!drawnText.some((text) => text.includes("AVERAGE SCORES")));
});

test("Upper Primary PLE PDF shows the four-subject aggregate and stays on one page", async () => {
  const pdf = await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    class: { level: "PRIMARY", name: "P.7" },
    grading_scale_preset_key: "primary_ple_upper",
    ple_official_enabled: true,
    incomplete_marks: [],
    grading_scale: officialPleScale,
    primary_result_metric: "ple_aggregate",
    summary: { overall_average: 86.25, overall_grade: "D1", aggregate: 5, aggregate_division: "Division 1", result_metric: "ple_aggregate", position: 1, class_size: 30 },
    subjects: [
      { name: "English", mark: { eot: 85, grade: "D1", points: 1 } },
      { name: "Mathematics", mark: { eot: 85, grade: "D1", points: 1 } },
      { name: "SST", mark: { eot: 85, grade: "D1", points: 1 } },
      { name: "Science", mark: { eot: 85, grade: "D2", points: 2 } },
    ],
  });
  assert.equal(pdf[0], 1);
  assert.equal(drawnText.some((text) => text.includes("PLE Aggregate")), true);
  assert.ok(drawnText.some((text) => text.includes("5.0 · Div 1")), JSON.stringify(drawnText));
  assert.ok(drawnText.some((text) => text.includes("POINT")), `the subject table must include the Points column: ${JSON.stringify(drawnText)}`);
  assert.ok(drawnText.some((text) => text.includes("D1 85–100=1")), JSON.stringify(drawnText));
  assert.ok(drawnText.some((text) => text.includes("F9 0–29=9")), "the complete dynamic PLE key should include F9");
  assert.equal(drawnText.some((text) => text.includes("Subject-specific")), false);
});

test("A4 header uses the requested exact hierarchy and complete remarks fit without ellipses", async () => {
  const report = {
    ...baseReport,
    term_dates: {
      term_ended_on: "2026-10-23",
      next_term_begins: "2027-02-01",
    },
    class_teacher_comment: `A detailed class teacher report that must remain complete, not shortened, even when it is longer than the available space in the remarks box. ${"Careful progress and consistent effort. ".repeat(4)}TEACHER-REMARK-END`,
    principal_comment: `A detailed principal report that must remain complete, not shortened, even when it is longer than the available space in the remarks box. ${"Continue building confidence and curiosity. ".repeat(4)}PRINCIPAL-REMARK-END`,
  };
  const pdf = await window.ReportCardPdf.renderPrimary(report);
  assert.equal(pdf[0], 1, "the comments must remain on one page");

  for (const [label, size] of [
    ["Example School", 15],
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
  assert.ok(drawnText.some((text) => text.includes("TEACHER-REMARK-END")));
  assert.ok(drawnText.some((text) => text.includes("PRINCIPAL-REMARK-END")));
  assert.equal(drawnTextOptions.some((entry) => entry.text.includes("REMARK-END") && entry.text.includes("...")), false);
});

test("PDF maps top-level class rank, singleton class size, subject remarks, and active PLE scale", async () => {
  const pdf = await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    class: { level: "PRIMARY", name: "P.7" },
    active_grading_scale: { preset_key: "primary_ple_upper" },
    ple_official_enabled: true,
    incomplete_marks: [],
    grading_scale: officialPleScale,
    summary_position: null,
    summary_out_of: 1,
    summary: {
      overall_average: 85,
      overall_grade: "D1",
      aggregate: 4,
      aggregate_division: "Division 1",
      result_metric: "ple_aggregate",
      position: null,
      class_size: null,
    },
    subjects: [
      { name: "English", mark: { eot: 85, grade: "D1", points: 1, tr: "Teacher's English remark" } },
      { name: "Mathematics", mark: { eot: 85, grade: "D1", points: 1, tr: "—" } },
    ],
  });

  assert.equal(pdf[0], 1);
  assert.equal(drawnText.some((text) => text.includes("1st of 1")), true, "rank and roster denominator should render in the table and summary");
  assert.equal(drawnText.some((text) => text.includes("Teacher's English remark")), true, `marks.tr should print in the subject remarks column: ${JSON.stringify(drawnText)}`);
  assert.equal(drawnText.some((text) => text.includes("Excellent achievement")), true, "blank remarks should use the generated subject remark");
  assert.equal(drawnText.some((text) => text.includes("UNEB PLE: D1 85–100=1")), true, "the active PLE preset should print its DB-backed uniform grading key");
  assert.equal(drawnText.some((text) => text.includes("A 80–100")), false, "the PLE preset should not fall back to the generic A-E scale");
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
    assert.equal(drawnText.some((text) => text.toLowerCase().includes("robotics")), true, `${level} should include the configured activity`);
    assert.equal(drawnText.some((text) => text.includes("Very good")), true, `${level} should include the activity remark`);
    assert.equal(drawnText.some((text) => text.includes("Handwriting")), false, `${level} should not append an unconfigured default row`);
  }
});

test("primary PDF hides only overall position while preserving subject rank and complete remarks", async () => {
  const longRemark = "Excellent progress with careful work in every lesson. The learner contributes thoughtfully and supports classmates. REMARKTAILVISIBLE";
  const schoolPayCode = "SPTEST0987654321";
  const report = {
    ...baseReport,
    school: { ...baseReport.school, show_report_position: false },
    learner: { ...baseReport.learner, schoolpay_code: schoolPayCode },
    class: { level: "PRIMARY", name: "P.7" },
    subjects: [{
      name: "English",
      mark: { a1: 2, a2: 3, a3: 2, eot: 84, grade: "A", tr: longRemark, position: 2, class_size: 30 },
    }],
    grading_scale: [
      { grade_code: "A", min_score: 80, max_score: 100, descriptor: "Excellent" },
      { grade_code: "B", min_score: 70, max_score: 79, descriptor: "Very good" },
    ],
  };
  await window.ReportCardPdf.renderPrimary(report);
  assert.equal(drawnText.includes("POS."), true, "subject rank column remains visible");
  assert.equal(drawnText.some((text) => text.includes("2nd of 30")), true, "subject rank remains visible");
  assert.equal(drawnText.some((text) => /Overall position|POSITION:/iu.test(text)), false, "overall position stays hidden");
  assert.equal(drawnText.join("").includes(schoolPayCode), true, "full SchoolPay code is printed");
  assert.equal(drawnText.join("").includes("REMARKTAILVISIBLE"), true, "the final words of the subject remark are printed");
  assert.equal(drawnText.some((text) => text.includes("...")), false, "subject remarks and SchoolPay code are not ellipsized");
  assert.equal(drawnText.some((text) => text.includes("GRADING SCALE:")), true);
  assert.equal(drawnText.some((text) => text.includes("A 80–100")), true);

  await window.ReportCardPdf.renderPrimary({
    ...report,
    school: { ...report.school, show_report_position: true },
  });
  assert.equal(drawnText.some((text) => /POSITION/i.test(text)), true);
});

test("lower-primary P.1–P.3 cards display the active A–E letter grade instead of a CBC identifier", async () => {
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    class: { level: "PRIMARY", name: "P.2" },
    subjects: [{
      name: "English",
      mark: { eot_period: 85, period_marks: { eot_period: 85 }, grade: "3", identifier: 3, position: 1, class_size: 12 },
    }],
    grading_scale: [
      { grade_code: "A", min_score: 80, max_score: 100 },
      { grade_code: "B", min_score: 70, max_score: 79 },
      { grade_code: "C", min_score: 60, max_score: 69 },
      { grade_code: "D", min_score: 50, max_score: 59 },
      { grade_code: "E", min_score: 0, max_score: 49 },
    ],
  });
  assert.equal(drawnText.includes("A"), true);
  assert.equal(drawnText.includes("3"), false, "the CBC identifier should not be printed as the letter-grade display");
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
        tr: "Excellent",
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

test("Nursery PDF renders the Head Teacher's Comment section", async () => {
  await window.ReportCardPdf.renderNursery({
    ...baseReport,
    school: baseReport.school,
    class: { level: "NURSERY", name: "Baby Class" },
    subjects: subjects(3),
    head_teacher_comment: "Keep progressing",
  });
  assert.equal(drawnText.some((text) => text.includes("Head Teacher's Comment")), true);
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

test("missing House and Days Absent values render blank, not as dashes", async () => {
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    learner: { full_name: "Test Learner", reg_no: "P7-01", house: null },
    class: { level: "PRIMARY", name: "P.7" },
    subjects: subjects(1),
    summary: {},
  });
  const houseIndex = drawnText.indexOf("HOUSE:");
  const absentIndex = drawnText.indexOf("DAYS ABSENT:");
  assert.ok(houseIndex >= 0);
  assert.ok(absentIndex >= 0);
  assert.equal(drawnText[houseIndex + 1], "DAYS ABSENT:");
  assert.equal(drawnText[absentIndex + 1], "TERM:");
});

test("an EOT-only primary card renders its computed average, grade, and class rank", async () => {
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    period: "EOT",
    learner: { full_name: "Test Learner", reg_no: "P7-01" },
    class: { level: "PRIMARY", name: "P.7" },
    class_teacher_comment: "Sample: strong effort and focus this term. Keep it up.",
    head_teacher_comment: "Sample: average 85.0; excellent academic standing.",
    principal_comment: "The school commends Sample for excellent results. Keep it up.",
    subjects: [{
      name: "English",
      mark: {
        eot: null,
        eot_period: "85.00",
        a1: null,
        a2: null,
        a3: null,
        avg: null,
        pct100: 85,
        period_marks: { bot: null, mid_term: null, eot_period: "85.00" },
        selected_period: "EOT",
        period_score: 85,
        grade: "A",
        descriptor: "Excellent",
        position: 1,
        class_size: 24,
        tr: "Excellent work in English.",
      },
    }],
    summary: {
      total_score: 85,
      overall_average: 85,
      overall_grade: "A",
      position: 1,
      class_size: 24,
    },
  });

  assert.equal(pages.length, 1);
  assert.ok(drawnText.some((text) => text.includes("85.0")));
  assert.ok(drawnText.includes("A"));
  assert.ok(drawnText.some((text) => text.includes("1st")));
  assert.ok(drawnText.some((text) => text.includes("24")));
  assert.ok(drawnText.some((text) => text.includes("Excellent work in English")));
  assert.ok(drawnText.some((text) => text.includes("average 85.0")));
  assert.ok(drawnText.some((text) => text.includes("commends Sample")));
});

test("a Mid-Term-only primary card renders its mark, grade, rank, subject remark, and teacher comment", async () => {
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    period: "MID",
    learner: { full_name: "Ssantamu Yusuf", reg_no: "P5-TEST" },
    class: { level: "PRIMARY", name: "P.5" },
    class_teacher_comment: "Ssantamu Yusuf has shown good progress.",
    subjects: [{
      name: "English",
      mark: {
        mid_term: 85,
        period_marks: { mid_term: 85 },
        selected_period: "MID",
        period_score: 85,
        grade: "A",
        position: 1,
        class_size: 4,
        tr: "Excellent performance in this subject.",
        teacher_initials: "SY",
      },
    }],
    summary: {
      total_score: 85,
      overall_average: 85,
      overall_grade: "A",
      position: 1,
      class_size: 4,
    },
  });

  assert.equal(pages.length, 1);
  for (const expected of [
    "MID-TERM",
    "85.0",
    "A",
    "1st of 4",
    "Excellent",
    "Average",
    "Grade",
    "Ssantamu Yusuf has shown good",
    "progress.",
  ]) {
    assert.ok(
      drawnText.some((text) => text.includes(expected)),
      `PDF should draw ${expected}; rendered text: ${drawnText.join(" | ")}`,
    );
  }
});

test("watermark uses the lighter 5% default while preserving an explicit school setting", async () => {
  const logo = "data:image/png;base64,iVBORw0KGgo=";
  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    school: { ...baseReport.school, logo_base64: logo, watermark_enabled: true },
    class: { level: "PRIMARY", name: "P.7" },
    subjects: subjects(1),
  });
  assert.equal(drawnImages[0]?.opacity, 0.05);
  assert.equal(pages.length, 1);

  await window.ReportCardPdf.renderPrimary({
    ...baseReport,
    school: {
      ...baseReport.school,
      logo_base64: logo,
      watermark_enabled: true,
      watermark_opacity: 20,
    },
    class: { level: "PRIMARY", name: "P.7" },
    subjects: subjects(1),
  });
  assert.equal(drawnImages[0]?.opacity, 0.2);
  assert.equal(pages.length, 1);
});
