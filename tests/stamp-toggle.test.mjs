import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rendererWindow = {};
new Function(
  "window",
  "atob",
  readFileSync(new URL("../pdf-templates/stamp-renderer.js", import.meta.url), "utf8"),
)(rendererWindow, globalThis.atob);

test("PDF stamp renderer skips the stamp when the school setting is disabled", async () => {
  const originalBytes = new Uint8Array([1, 2, 3]);
  const result = await rendererWindow.ReportCardStampRenderer.apply(
    originalBytes,
    { school: { show_stamp: false } },
    { line_1: "OFFICIAL SCHOOL STAMP" },
  );

  assert.equal(result, originalBytes);
});
