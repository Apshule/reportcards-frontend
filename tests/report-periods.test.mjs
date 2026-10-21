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
  };
  const html = window.ReportCardPreview.render(report, {
    template: "1",
    period: "COMBINED_BM",
    layoutFormat: "A5_CONDENSED",
    includeStamp: true,
  });
  const head = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "";
  assert.match(html, /rc-preview-a5-condensed/);
  for (const label of ["Subject", "B.O.T", "Midterm", "Average", "Grade", "Remarks"]) {
    assert.ok(head.includes(`>${label}<`), `A5 table should include ${label}`);
  }
  assert.doesNotMatch(head, /E\.O\.T|FINAL/);
  assert.match(html, /<td>66\.0<\/td>/);
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
  assert.match(html, /Next term will begin on:<\/b> 22 Mar 2027/);
  assert.ok(!html.includes(rawDate));
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
