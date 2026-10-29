import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
new Function("window", readFileSync(new URL("../template-picker.js", import.meta.url), "utf8"))(window);
new Function("window", readFileSync(new URL("../report-card-preview.js", import.meta.url), "utf8"))(window);

const periods = ["BOT", "MID", "EOT", "COMBINED_BM", "COMBINED_BME", "COMBINED_BE", "COMBINED_ME"];
const sourceMark = {
  bot: 60,
  mid_term: 72,
  eot_period: 90,
  period_marks: { bot: 60, mid_term: 72, eot_period: 90 },
  grade: "B",
  position: 2,
  class_size: 14,
  descriptor: "Good progress",
  teacher_initials: "AB",
};
const officialPleScale = [
  ["D1", 85, 100, 1], ["D2", 70, 84, 2], ["C3", 60, 69, 3],
  ["C4", 50, 59, 4], ["C5", 45, 49, 5], ["C6", 40, 44, 6],
  ["P7", 35, 39, 7], ["P8", 30, 34, 8], ["F9", 0, 29, 9],
].map(([grade_code, min_score, max_score, points]) => ({ grade_code, min_score, max_score, points }));

function reportFor(period) {
  const final = window.ReportCardTemplatePicker.periodScore(sourceMark, period);
  return {
    term: "TERM_1",
    year: 2026,
    period,
    school: { name: "Period Layout Test School" },
    class: { name: "P.1 · A", level: "PRIMARY" },
    learner: { full_name: "Period Layout Test Learner", reg_no: "TEST-001" },
    subjects: [{ id: "subject-1", name: "Literacy", mark: { ...sourceMark, selected_period: period, period_score: final } }],
    summary: {
      total_score: final,
      overall_average: final,
      overall_grade: "B",
      position: 2,
      class_size: 14,
    },
  };
}

test("period definitions cover all seven assessment selections", () => {
  const expectedFields = {
    BOT: ["B.O.T"],
    MID: ["MID-TERM"],
    EOT: ["E.O.T"],
    COMBINED_BM: ["B.O.T", "MIDTERM"],
    COMBINED_BME: ["B.O.T", "MID-TERM", "E.O.T"],
    COMBINED_BE: ["B.O.T", "E.O.T"],
    COMBINED_ME: ["MID-TERM", "E.O.T"],
  };

  for (const period of periods) {
    assert.deepEqual(
      window.ReportCardTemplatePicker.periodDefinition(period).fields.map(({ label }) => label),
      expectedFields[period],
    );
  }
});

test("HTML preview uses only selected-period columns and labels the header", () => {
  for (const period of periods) {
    const definition = window.ReportCardTemplatePicker.periodDefinition(period);
    const html = window.ReportCardPreview.render(reportFor(period), { template: "5", period });
    const subjectTableHead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";

    assert.ok(
      html.includes(`TERM 1 PROGRESS REPORT — ${definition.title}`),
      `${period} should appear in the card header`,
    );
    for (const { label } of definition.fields) {
      assert.ok(subjectTableHead.includes(`>${label}<`), `${period} should include ${label}`);
    }
    for (const label of ["B.O.T", "MID-TERM", "E.O.T"]) {
      if (!definition.fields.some((field) => field.label === label)) {
        assert.ok(!subjectTableHead.includes(`>${label}<`), `${period} should not include ${label}`);
      }
    }
    assert.equal(subjectTableHead.includes(">FINAL<"), definition.combined);
    assert.ok(html.includes("<b>POSITION:</b>"), `${period} should show the overall position`);
    assert.ok(html.includes("<b>AVERAGE:</b>"), `${period} should show the overall average`);
    assert.ok(html.includes("<b>GRADE:</b>"), `${period} should show the overall grade`);
  }
});

test("O-Level report can use progressive term marks while an annual UCE preset remains configured", () => {
  const report = {
    ...reportFor("EOT"),
    class: { name: "S.2", level: "O_LEVEL" },
    grading_scale_preset_key: "o_level_old_uce",
    uce_report_mode: "progressive",
    subjects: [{
      id: "english",
      name: "English",
      mark: {
        eot_period: 85,
        pct100: 85,
        selected_period: "EOT",
        period_score: 85,
        grade: "D1",
        teacher_initials: "JK",
        tr: "Good progress.",
      },
    }],
  };
  const html = window.ReportCardPreview.render(report, { template: "1", period: "EOT" });
  const tableHead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";

  assert.ok(html.includes(`TERM 1 PROGRESS REPORT — ${window.ReportCardTemplatePicker.periodDefinition("EOT").title}`));
  assert.ok(tableHead.includes(">E.O.T<"));
  assert.ok(!tableHead.includes("CA 20%"));
  assert.ok(!html.includes("ANNUAL UCE RESULTS"));
  assert.ok(html.includes("JK"));
  assert.ok(html.includes("Good progress."));
});

test("Nursery preview uses period-specific assessment columns and school activity icons", () => {
  const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits"];
  const nursery = {
    ...reportFor("COMBINED_BM"),
    class: { name: "Top Class", level: "NURSERY" },
    subjects: [
      { name: "Taking care of myself for proper growth and development", mark: { bot: 70, mid_term: 80, tr: "Excellent." } },
      { name: "Interacting, exploring, knowing and using my environment", mark: { bot: 72, mid_term: 82, tr: "Excellent." } },
      { name: "Relating with others in an acceptable way", mark: { bot: 74, mid_term: 84, tr: "Good." } },
      { name: "Developing and using my Language appropriately", mark: { bot: 76, mid_term: 86, tr: "Good." } },
      { name: "Developing and using Mathematical Concepts in my day-to-day", mark: { bot: 78, mid_term: 88, tr: "Good." } },
    ],
    activities: activities.map((name) => ({ name, remark: "Excellent." })),
    layout_format: "A5_CONDENSED",
    school: {
      name: "Nursery Preview School",
      activity_icons: [{ activity_name: "Writing", icon_base64: "data:image/png;base64,c2Nob29sLWljb24=" }],
    },
    behaviors_comment: "",
  };

  const combinedHtml = window.ReportCardPreview.render(nursery, { template: "1", period: "COMBINED_BM", layoutFormat: "A5_CONDENSED" });
  const combinedHead = combinedHtml.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";
  for (const label of ["B.O.T", "MIDTERM", "AVERAGE", "GRADE"]) assert.ok(combinedHead.includes(label));
  assert.equal(combinedHead.includes("E.O.T"), false);
  assert.equal((combinedHtml.match(/class="rc-a5-nursery-activity"/g) || []).length, 10);
  assert.ok(combinedHtml.includes("data:image/png;base64,c2Nob29sLWljb24="), "custom school icon should be used");
  assert.ok(combinedHtml.includes("Good behavior and maintains cleanliness."));

  const eotHtml = window.ReportCardPreview.render({ ...nursery, layout_format: "A4" }, { template: "1", period: "EOT" });
  const eotHead = eotHtml.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";
  assert.ok(eotHead.includes("E.O.T"));
  assert.equal(eotHead.includes("B.O.T"), false);
  assert.equal(eotHead.includes("MIDTERM"), false);
  assert.equal(eotHead.includes("AVERAGE"), false);
  assert.equal(eotHead.includes("GRADE"), false);
});

test("HTML preview renders the clean school header with centered contact details and both images", () => {
  const html = window.ReportCardPreview.render({
    ...reportFor("EOT"),
    school: {
      name: "Example School",
      school_subtitle: "Mixed Day & Boarding Primary School",
      street: "P.O. Box 123, Kampala",
      phone: "0750002345",
      email: "info@school.com",
      website: "www.school.com",
      motto: "Learning with ease",
      logo_base64: "school-logo",
    },
    learner: { full_name: "Preview Learner", photo_base64: "learner-photo" },
  });
  const header = html.match(/<header class="rc-head">[\s\S]*?<\/header>/)?.[0] ?? "";

  assert.match(header, /school_subtitle|Mixed Day &amp; Boarding Primary School/u);
  assert.match(header, /#800000|Example School/u);
  assert.match(header, /Tel: 0750002345, Email: info@school\.com/u);
  assert.match(header, /Website: www\.school\.com/u);
  assert.match(header, /Learning with ease/u);
  assert.match(header, /alt="School logo"/u);
  assert.match(header, /alt="Preview Learner"/u);
});

test("combined FINAL is the arithmetic mean of its selected period marks", () => {
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_BM"), 66);
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_BME"), 74);
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_BE"), 75);
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_ME"), 81);

  const html = window.ReportCardPreview.render(reportFor("COMBINED_BME"), {
    template: "5",
    period: "COMBINED_BME",
  });
  assert.match(html, /<td>74\.0<\/td>/);
});

test("Mid-Term-only data renders the score, grade, subject remark, and overall summary", () => {
  const report = {
    ...reportFor("MID"),
    subjects: [{
      id: "subject-english",
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
      },
    }],
    summary: {
      total_score: 85,
      overall_average: 85,
      overall_grade: "A",
      position: 1,
      class_size: 4,
    },
    class_teacher_comment: "Ssantamu Yusuf has shown good progress.",
  };
  const html = window.ReportCardPreview.render(report, { template: "1", period: "MID" });

  assert.match(html, /<td>85\.0<\/td>/);
  assert.match(html, /<td>A<\/td>/);
  assert.match(html, /Excellent performance in this subject/);
  assert.match(html, /85\.0/);
  assert.match(html, /Ssantamu Yusuf has shown good progress/);
});

test("A5 preview uses the B.O.T and Midterm columns only and hides stamp and QR", () => {
  const report = {
    ...reportFor("COMBINED_BM"),
    school: {
      name: "Condensed Layout School",
      stamp_config: { line_1: "OFFICIAL SCHOOL STAMP" },
    },
    authenticity_qr_data_url: "data:image/png;base64,QUJD",
    class_teacher_comment: "Encouraging progress.",
    principal_comment: "Continue the good work.",
    grading_scale_preset_key: "primary_ple_upper",
    primary_result_metric: "ple_aggregate",
    summary: { aggregate: 5, aggregate_division: "Division 1", result_metric: "ple_aggregate", overall_average: 85 },
    ple_official_enabled: true,
    incomplete_marks: [],
    grading_scale: officialPleScale,
  };
  const html = window.ReportCardPreview.render(report, {
    template: "1",
    period: "COMBINED_BM",
    layoutFormat: "A5_CONDENSED",
    includeStamp: true,
  });
  const head = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";
  assert.match(html, /rc-preview-a5-condensed/);
  for (const label of ["Subject", "B.O.T", "Midterm", "Average", "Grade", "Points", "Remarks"]) {
    assert.ok(head.includes(`>${label}<`), `A5 table should include ${label}`);
  }
  assert.doesNotMatch(head, /E\.O\.T|FINAL/);
  assert.match(html, /<td>66\.0<\/td>/);
  assert.match(html, /PLE Aggregate:<\/b> 5 · Division 1/u);
  assert.doesNotMatch(html, /OFFICIAL SCHOOL STAMP|rc-authenticity-qr|data:image\/png;base64,QUJD/);
  assert.match(html, /Class Teacher's signature/);
});

test("HTML preview shows an authenticity QR and label when one is issued", () => {
  const report = {
    ...reportFor("EOT"),
    authenticity_qr_data_url: "data:image/png;base64,QUJD",
  };
  const html = window.ReportCardPreview.render(report, { template: "1", period: "EOT" });
  assert.match(html, /class="rc-authenticity-qr"/);
  assert.match(html, /Scan to Verify Authenticity/);
  assert.match(html, /data:image\/png;base64,QUJD/);
});

test("PDF footer formats ISO dates as readable UTC dates", () => {
  const rawDate = "2027-03-22T00:00:00.000Z";
  const formatted = window.ReportCardPreview.formatReportDate(rawDate);
  assert.equal(formatted, "22 Mar 2027");

  const report = {
    ...reportFor("EOT"),
    term_dates: { next_term_begins: rawDate },
  };
  const html = window.ReportCardPreview.render(report, { template: "5", period: "EOT" });
  assert.match(html, /Next Term Begins:<\/b> 22 Mar 2027/);
  assert.match(html, /Term Ends On:<\/b>/);
  assert.ok(!html.includes(rawDate));
});

test("primary preview omits the obsolete PLE aggregate legend and keeps the active grade key", () => {
  const html = window.ReportCardPreview.render({
    ...reportFor("EOT"),
    class: { name: "P.7", level: "PRIMARY" },
    ple_official_enabled: true,
    incomplete_marks: [],
    grading_scale: officialPleScale,
    grading_scale_preset_key: "primary_ple_upper",
    term_dates: { term_ended_on: "2026-10-23", next_term_begins: "2027-02-01" },
  }, { template: "5", period: "EOT" });
  assert.ok(!html.includes("4–12 Top Secondary"));
  assert.match(html, /UNEB PLE: D1 85–100 \(1 pt\) · D2 70–84 \(2 pts\)/u);
  assert.match(html, /Term Ends On:<\/b> 23 Oct 2026/u);
  assert.match(html, /Next Term Begins:<\/b> 1 Feb 2027/u);
});

test("PLE preview shows a blocking Incomplete marks notice when a required score is absent", () => {
  const html = window.ReportCardPreview.render({
    ...reportFor("EOT"),
    class: { name: "P.7", level: "PRIMARY" },
    ple_official_enabled: true,
    incomplete_marks: ["Science", "SST"],
    grading_scale: officialPleScale,
  }, { template: "1", period: "EOT" });
  assert.match(html, /Incomplete marks/u);
  assert.match(html, /Science, SST/u);
});

test("A5 preview displays both term dates and wraps complete teacher and principal remarks", () => {
  const html = window.ReportCardPreview.render({
    ...reportFor("COMBINED_BM"),
    class: { name: "P.7", level: "PRIMARY" },
    layout_format: "A5_CONDENSED",
    term_dates: { term_ended_on: "2026-10-23", next_term_begins: "2027-02-01" },
    class_teacher_comment: "A complete class teacher comment ending with A5-TEACHER-END",
    principal_comment: "A complete principal comment ending with A5-PRINCIPAL-END",
  }, { template: "5", period: "COMBINED_BM", layoutFormat: "A5_CONDENSED" });
  assert.match(html, /Term Ends On:<\/b> 23 Oct 2026/u);
  assert.match(html, /Next Term Begins:<\/b> 1 Feb 2027/u);
  assert.match(html, /A5-TEACHER-END/u);
  assert.match(html, /A5-PRINCIPAL-END/u);
  assert.match(html, /Class Teacher:<\/b>/u);
  assert.match(html, /Principal:<\/b>/u);
});

test("HTML preview shows the configured stamp and school logo settings", () => {
  const report = {
    ...reportFor("EOT"),
    school: {
      name: "Stamp Preview School",
      logo_base64: "data:image/png;base64,c2Nob29sLWxvZ28=",
      stamp_logo_size: 30,
      stamp_logo_offset_x: 10,
      stamp_logo_offset_y: -2,
      stamp_logo_rotation: 90,
      stamp_logo_opacity: 50,
      stamp_logo_position: "inside_center",
      stamp_config: {
        shape: "circle",
        position: "Bottom Right",
        primary_color: "#4B2E9E",
        secondary_color: "#FF8C42",
        transparency: 80,
        line_1: "OFFICIAL SCHOOL STAMP",
      },
    },
  };

  const html = window.ReportCardPreview.render(report, { template: "5", period: "EOT" });
  assert.match(html, /Configured school stamp/);
  assert.match(html, /OFFICIAL SCHOOL STAMP/);
  assert.match(html, /rc-stamp-circle rc-stamp-bottom-right/);
  assert.match(html, /class="rc-stamp-logo rc-stamp-logo-inside_center"/);
  assert.match(html, /data:image\/png;base64,c2Nob29sLWxvZ28=/);
  const logoSize = Number(html.match(/--rc-stamp-logo-size:([\d.]+)mm/u)?.[1]);
  const logoX = Number(html.match(/--rc-stamp-logo-x:([-\d.]+)px/u)?.[1]);
  const logoY = Number(html.match(/--rc-stamp-logo-y:([-\d.]+)px/u)?.[1]);
  assert.ok(logoSize > 0 && logoSize < 30);
  assert.ok(Math.hypot(logoX, logoY) <= 8.1);
  assert.match(html, /--rc-stamp-logo-rotation:90deg/);
  assert.match(html, /--rc-stamp-logo-opacity:0\.5/);
  assert.match(html, /--rc-stamp-text:rgba\(75,46,158,0\.8\)/);

  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /width:var\(--rc-stamp-logo-size,20mm\);height:var\(--rc-stamp-logo-size,20mm\)/);
  assert.match(css, /translate\(var\(--rc-stamp-logo-x,0px\),var\(--rc-stamp-logo-y,0px\)\) rotate\(var\(--rc-stamp-logo-rotation,0deg\)\)/);
  assert.match(css, /opacity:var\(--rc-stamp-logo-opacity,1\)/);
});
