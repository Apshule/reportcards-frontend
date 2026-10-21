import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("mark saves and teacher submissions open the three-way comment prompt", () => {
  assert.match(app, /if\(a==="save-marks"\)\{openMarkCommentFlow\("admin-save"\);return\}/u);
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
