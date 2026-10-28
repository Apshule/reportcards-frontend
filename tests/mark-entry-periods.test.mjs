import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const periodsStart = appSource.indexOf("const MARK_ENTRY_PERIODS = [");
const periodsEnd = appSource.indexOf("];", periodsStart);
const periodsSource = appSource.slice(periodsStart, periodsEnd);

test("marks entry offers exactly the six requested assessment periods", () => {
  const values = [...periodsSource.matchAll(/\{value:"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(values, [
    "BOT",
    "MID",
    "EOT",
    "COMBINED_BME",
    "COMBINED_BE",
    "COMBINED_ME",
  ]);
  assert.match(appSource, /data-mark-period aria-label="Assessment period"/);
});

test("the mark grid renders only the selected period score fields", () => {
  assert.match(appSource, /function markEntryTableHeaders\(period,level\)/);
  assert.match(appSource, /period\.fields\.map\(field=>`<th>\$\{esc\(field\.label\)\} \/ 100<\/th>`\)/);
  assert.match(appSource, /data-mark-period-score="\$\{field\.key\}"/);
  assert.doesNotMatch(appSource, /<th>A1 \/ 3<\/th>/);
  assert.doesNotMatch(appSource, /<th>Mid-Term \/ 100<\/th>/);
  assert.match(appSource, /Other assessment periods are left unchanged/);
  assert.match(stylesSource, /table#marks-table,.marks-mobile-wrap table#teacher-marks-table\{min-width:760px\}/);
});

test("admin and teacher saves include the selected period and its fields only", () => {
  assert.match(appSource, /period\.fields\.map\(\(\{key\}\)=>\[key,row\[key\]\?\?null\]\)/);
  assert.match(appSource, /assessment_period:period\.value,rows/);
  assert.match(appSource, /function collectMarkRows\(tableId\).*data-mark-period-score/s);
});

test("live grade calculation uses the visible period inputs immediately", () => {
  assert.match(appSource, /tr\.querySelectorAll\("\[data-mark-period-score\]"\)/);
  assert.match(appSource, /const gradeScore=periodInputs\.length\?periodScore:pct100/);
  assert.match(appSource, /\[data-score\],\[data-mark-period-score\]/);
  assert.match(appSource, /root\.addEventListener\("input",e=>\{updateLiveMarkInput\(e\.target\)/);
  assert.match(appSource, /function updateLiveMarkInput\(target\)/);
  assert.match(appSource, /root\.addEventListener\("change",e=>\{const t=e\.target;if\(t\.matches\("\[data-score\],\[data-mark-period-score\]"\)\)calculateMarks\(t\.closest\("tr"\)\)/);
});

test("a single live period mark and combined-period marks produce a grade score", () => {
  const body = appSource.match(/function periodScoreFromRow\(row\)\{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(body, "period score helper should be present");
  const periodScoreFromRow = new Function("markEntryPeriod", `return function(row){${body}}`)(
    () => ({ fields: [{ key: "bot" }, { key: "mid_term" }, { key: "eot_period" }] }),
  );
  assert.equal(periodScoreFromRow({ mid_term: 85 }), 85);
  assert.equal(periodScoreFromRow({ bot: 80, mid_term: 90, eot_period: 100 }), 90);
  assert.equal(periodScoreFromRow({ bot: null, mid_term: null, eot_period: null }), null);
});

test("typing a valid assessment mark updates the grade badge immediately", () => {
  const functionBody = (name) => {
    const functionIndex = appSource.indexOf(`function ${name}(`);
    assert.notEqual(functionIndex, -1, `${name} should be defined`);
    const lineStart = appSource.lastIndexOf("\n", functionIndex) + 1;
    const indentation = appSource.slice(lineStart, functionIndex).match(/^\s*/u)?.[0] || "";
    const match = appSource.match(new RegExp(`function ${name}\\(([^)]*)\\)\\{([\\s\\S]*?)\\n${indentation}\\}`));
    assert.ok(match, `${name} should be defined`);
    return { params: match[1], body: match[2] };
  };
  const state = {
    role: "school_admin",
    filter: { class_id: "class-1", subject_id: "english" },
    data: {
      classes: [{ id: "class-1", level: "O_LEVEL", name: "S.4" }],
      subjects: [{ id: "english", name: "English" }],
      grading: [
        { level: "O_LEVEL", min_score: 80, max_score: 100, grade_code: "A" },
        { level: "O_LEVEL", min_score: 70, max_score: 79.99, grade_code: "B" },
      ],
    },
    rm: {},
  };
  const helpers = {};
  for (const name of ["livePeriodScore", "uiGradeForScore", "subjectNameForUi", "subjectRemarkForUi"]) {
    const { params, body } = functionBody(name);
    helpers[name] = new Function("state", `return function(${params}){${body}}`)(state);
  }
  const { params, body } = functionBody("calculateMarks");
  const calculateMarks = new Function(
    "state",
    "livePeriodScore",
    "uiGradeForScore",
    "pointsForMark",
    "legacyALevel",
    "subjectNameForUi",
    "subjectRemarkForUi",
    `return function(${params}){${body}}`,
  )(state, helpers.livePeriodScore, helpers.uiGradeForScore, () => null, () => false, helpers.subjectNameForUi, helpers.subjectRemarkForUi);

  const scoreInput = { value: "75" };
  const gradeLabel = { textContent: "—" };
  const autoRemark = { textContent: "", hidden: false };
  const row = {
    querySelectorAll(selector) {
      if (selector === "[data-score]") return [];
      if (selector === "[data-mark-period-score]") return [scoreInput];
      return [];
    },
    querySelector(selector) {
      if (selector === '[data-score="raw_mark"]') return null;
      if (selector === '[data-result="grade"] [data-grade-label]') return gradeLabel;
      if (selector === '[data-overall-grade]' || selector === "[data-grade-point-type]") return null;
      if (selector === "[data-tr-mode]") return { value: "auto" };
      if (selector === '[data-tr-panel="auto"]') return autoRemark;
      return null;
    },
  };
  scoreInput.closest = (selector) => selector === "[data-score],[data-mark-period-score]" ? scoreInput : selector === "tr" ? row : null;
  const { params: inputParams, body: inputBody } = functionBody("updateLiveMarkInput");
  const updateLiveMarkInput = new Function("calculateMarks", `return function(${inputParams}){${inputBody}}`)(calculateMarks);

  calculateMarks(row);
  assert.equal(gradeLabel.textContent, "B");
  scoreInput.value = "81";
  updateLiveMarkInput(scoreInput);
  assert.equal(gradeLabel.textContent, "A");
  assert.equal(autoRemark.textContent, "Excellent performance in English.");
  scoreInput.value = "98";
  updateLiveMarkInput(scoreInput);
  assert.equal(gradeLabel.textContent, "A");
});

test("marks-entry level dropdown has exactly five categories and cascades class and subject options", () => {
  const groupStart = appSource.indexOf("const MARK_ENTRY_LEVEL_GROUPS = [");
  const groupEnd = appSource.indexOf("];", groupStart) + 2;
  const groups = new Function(`${appSource.slice(groupStart, groupEnd)};return MARK_ENTRY_LEVEL_GROUPS`)();
  assert.deepEqual(groups.map(({ label }) => label), [
    "Nursery( Baby - Top )",
    "Lower Primary (P.1 - P.3)",
    "Upper Primary (P.4 - P.7)",
    "O-Level (S.1 - S.4)",
    "A-Level (S.5 - S.6)",
  ]);
  assert.match(appSource, /<select id="marks-level" data-mark-entry-level>\$\{markEntryLevelOptions\(groupValue\)\}<\/select>/);
  assert.match(appSource, /<select id="rm-level" data-mark-entry-level>\$\{markEntryLevelOptions\(groupValue\)\}<\/select>/);
  assert.match(appSource, /state\.filter\.class_id="";\s*state\.filter\.subject_id="";/);

  const functionBody = (name) => {
    const functionIndex = appSource.indexOf(`function ${name}(`);
    assert.notEqual(functionIndex, -1, `${name} should be defined`);
    const lineStart = appSource.lastIndexOf("\n", functionIndex) + 1;
    const indentation = appSource.slice(lineStart, functionIndex).match(/^\s*/u)?.[0] || "";
    const match = appSource.match(new RegExp(`function ${name}\\(([^)]*)\\)\\{([\\s\\S]*?)\\n${indentation}\\}`));
    assert.ok(match, `${name} should be extractable`);
    return { params: match[1], body: match[2] };
  };
  const normalize = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/gu, "");
  const groupClass = functionBody("markClassGroup");
  const markClassGroup = new Function("normalizedMarkLevel", `return function(${groupClass.params}){${groupClass.body}}`)(normalize);
  const classFilter = functionBody("markClassesForLevel");
  const markClassesForLevel = new Function("markClassGroup", `return function(${classFilter.params}){${classFilter.body}}`)(markClassGroup);
  const subjectFilter = functionBody("markSubjectsForLevel");
  const markSubjectsForLevel = new Function("MARK_ENTRY_LEVEL_GROUPS", "normalizedMarkLevel", `return function(${subjectFilter.params}){${subjectFilter.body}}`)(groups, normalize);
  const classes = [
    { id: "p1", name: "P.1", level: "PRIMARY" },
    { id: "p1a", name: "P.1-A", level: "PRIMARY" },
    { id: "p3", name: "P.3", level: "PRIMARY" },
    { id: "p4", name: "P.4", level: "PRIMARY" },
    { id: "p7", name: "P.7", level: "PRIMARY" },
    { id: "top", name: "Top Class", level: "NURSERY" },
    { id: "s1", name: "S.1", level: "O_LEVEL" },
    { id: "s5", name: "S.5", level: "A_LEVEL" },
  ];
  assert.deepEqual(markClassesForLevel(classes, "LOWER_PRIMARY").map(({ id }) => id), ["p1", "p1a", "p3"]);
  assert.deepEqual(markClassesForLevel(classes, "UPPER_PRIMARY").map(({ id }) => id), ["p4", "p7"]);
  assert.equal(markClassGroup(classes[5]), "NURSERY");
  assert.equal(markClassGroup(classes[6]), "O_LEVEL");
  assert.equal(markClassGroup(classes[7]), "A_LEVEL");
  assert.deepEqual(markSubjectsForLevel([{ name: "English", level: "PRIMARY" }, { name: "Writing", level: "NURSERY" }], "LOWER_PRIMARY").map(({ name }) => name), ["English"]);
});

test("subject Auto mode generates a subject remark locally, not an overall class-teacher comment", () => {
  assert.match(appSource, /subjectRemarkForUi\(grade,subjectNameForUi\(teacher,subjectId\)\)/);
  assert.match(appSource, /if\(selected==="auto"&&row\)calculateMarks\(row\)/);
  const modeHandler = appSource.match(/root\.addEventListener\("change",e=>\{const target=e\.target,mode=target\.closest\("\[data-tr-mode\]"\);([\s\S]*?)if\(target\.matches\("\[data-ple-subject\]"\)\)/)?.[1];
  assert.ok(modeHandler, "subject remark mode handler should be present");
  assert.doesNotMatch(modeHandler, /saveAutoComment|class-teacher-comment|api\(/);
});
