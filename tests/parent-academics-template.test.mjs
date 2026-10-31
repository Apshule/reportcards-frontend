import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parentDashboard = readFileSync(new URL("../parent-dashboard.js", import.meta.url), "utf8");

test("parent Academics requests send the learner path and normalized report options", () => {
  assert.match(parentDashboard, /template:\s*"template_1"/u);
  assert.match(parentDashboard, /function normalizeReportTemplate\(value\)/u);
  assert.match(parentDashboard, /const child = state\.children\.find\(\(item\) => String\(item\.id\) === String\(state\.childId\)\)/u);
  assert.match(parentDashboard, /state\.template = normalizeReportTemplate\(child\?\.default_template_id \|\| state\.template\)/u);
  assert.match(parentDashboard, /template:\s*state\.template/u);
  assert.match(
    parentDashboard,
    /\/api\/parents\/children\/\$\{encodeURIComponent\(state\.childId\)\}\/card-data\?\$\{query\}/u,
  );
  assert.match(parentDashboard, /new URLSearchParams\(\{[\s\S]*term: state\.term,[\s\S]*year: String\(state\.year\),[\s\S]*period: state\.period,[\s\S]*template:/u);
});

test("parent portal loads period tools before the PDF renderer", () => {
  const parentHtml = readFileSync(new URL("../parent-dashboard.html", import.meta.url), "utf8");
  assert.ok(parentHtml.indexOf("template-picker.js") < parentHtml.indexOf("pdf-templates.js"));
  assert.match(parentHtml, /parent-period-definition-v1/u);
});

test("class editor offers all five parent report-card templates", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /name="default_template_id"/u);
  assert.match(app, /Array\.from\(\{length:5\}/u);
  assert.match(app, /item\.default_template_id\|\|"template_1"/u);
  assert.ok(app.includes('name="stream" value="${esc(item.stream??"")}" maxlength="80">'));
  assert.ok(!app.includes('name="stream" value="${esc(item.stream||"")}" maxlength="80" placeholder="A"'));
});

test("parent PDF download uses the template returned by card-data", () => {
  assert.match(parentDashboard, /normalizeReportTemplate\(state\.card\.template \|\| state\.template\)/u);
  assert.match(parentDashboard, /ReportCardPdf\.render\(report, state\.card\.class\?\.level, templateId, true\)/u);
});
