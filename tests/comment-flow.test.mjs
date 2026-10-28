import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("admin Save marks writes marks only while teacher save and submit retain their comment flow", () => {
  assert.match(app, /if\(a==="save-marks"\)\{await saveMarks\(\);return\}/u);
  assert.doesNotMatch(app, /openMarkCommentFlow\("admin-save"\)/u);
  assert.match(app, /const marksSavedInThisFlow=\["teacher-save","teacher-submit"\]\.includes\(modal\.pending\)/u);
  assert.match(app, /if\(a==="save-teacher-marks"\)\{openMarkCommentFlow\("teacher-save"\);return\}/u);
  assert.match(app, /if\(a==="submit-marks-review"\)\{openMarkCommentFlow\("teacher-submit"\);return\}/u);
  assert.match(app, /value="auto" checked/u);
  assert.match(app, /value="saved"[^>]*> Dropdown/u);
  assert.match(app, /value="custom"[^>]*> Custom/u);
});

test("the selected dropdown/custom field is enabled and submitted before review", () => {
  assert.match(app, /data-comment-mode-panel="saved"/u);
  assert.match(app, /data-comment-mode-panel="custom"/u);
  assert.match(app, /panel\.hidden=!active/u);
  assert.match(app, /comment_mode:mode/u);
  const commentSubmit = app.indexOf("async function applyMarkCommentChoice()");
  const submitReview = app.indexOf("/submit-for-review", commentSubmit);
  assert.notEqual(commentSubmit, -1);
  assert.notEqual(submitReview, -1);
  assert.ok(app.indexOf('comment_mode:mode', commentSubmit) < submitReview);
});

test("class-teacher auto comments use saved overall results rather than one unsaved subject mark", () => {
  assert.match(app, /function markRowHasUnsavedPeriodScore\(row\)/u);
  assert.match(app, /Please save marks first, then generate the overall class teacher comment\./u);
  assert.match(app, /comment_mode:"auto"/u);
  assert.doesNotMatch(app, /generatedCommentFromPeriodRow/u);
  assert.doesNotMatch(app, /comment_mode:"custom",comment:periodComment/u);
});
