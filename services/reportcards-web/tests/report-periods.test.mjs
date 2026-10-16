import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
new Function("window", readFileSync(new URL("../template-picker.js", import.meta.url), "utf8"))(window);
new Function("window", readFileSync(new URL("../report-card-preview.js", import.meta.url), "utf8"))(window);

const periods = ["BOT", "MID", "EOT", "COMBINED_BME", "COMBINED_BE", "COMBINED_ME"];
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

test("period definitions cover all six assessment selections", () => {
  const expectedFields = {
    BOT: ["B.O.T"],
    MID: ["MID-TERM"],
    EOT: ["E.O.T"],
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
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_BME"), 74);
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_BE"), 75);
  assert.equal(window.ReportCardTemplatePicker.periodScore(sourceMark, "COMBINED_ME"), 81);

  const html = window.ReportCardPreview.render(reportFor("COMBINED_BME"), {
    template: "5",
    period: "COMBINED_BME",
  });
  assert.match(html, /<td>74\.0<\/td>/);
});
