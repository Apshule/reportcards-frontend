import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parentDashboard = readFileSync(new URL("../parent-dashboard.js", import.meta.url), "utf8");

test("parent Academics requests send the learner path and normalized report options", () => {
  assert.match(parentDashboard, /template:\s*"template_1"/u);
  assert.match(parentDashboard, /function normalizeReportTemplate\(value\)/u);
  assert.match(parentDashboard, /template:\s*normalizeReportTemplate\(state\.template\)/u);
  assert.match(
    parentDashboard,
    /\/api\/parents\/children\/\$\{encodeURIComponent\(state\.childId\)\}\/card-data\?\$\{query\}/u,
  );
  assert.match(parentDashboard, /new URLSearchParams\(\{[\s\S]*term: state\.term,[\s\S]*year: String\(state\.year\),[\s\S]*period: state\.period,[\s\S]*template:/u);
});

test("parent PDF download uses the template returned by card-data", () => {
  assert.match(parentDashboard, /normalizeReportTemplate\(state\.card\.template \|\| state\.template\)/u);
  assert.match(parentDashboard, /ReportCardPdf\.render\(report, state\.card\.class\?\.level, templateId, true\)/u);
});
