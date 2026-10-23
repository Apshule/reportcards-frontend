import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../pdf-templates/theme-engine.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window });

test("school theme overrides template colors but leaves untouched colors alone", () => {
  const theme = window.ReportCardThemeEngine.getTemplateTheme(
    "PRIMARY",
    { colors: { primary_color: "#006699", header_color: "#006699", table_header_color: "#DDEEFF" } },
    { primary_color: "#1E5EB5", header_color: "#1E5EB5", table_header_color: "#BBDEFB" },
    {
      report_primary_color: "#8A1C1C",
      report_font_color: "#222222",
      report_background_color: "#FFF8E8",
    },
  );

  assert.equal(theme.primary_color, "#8A1C1C");
  assert.equal(theme.header_color, "#8A1C1C");
  assert.equal(theme.table_header_color, "#8A1C1C");
  assert.equal(theme.font_color, "#222222");
  assert.equal(theme.table_header_text_color, "#FFFFFF");
  assert.equal(theme.background_color, "#FFF8E8");
});

test("school defaults retain the selected template palette", () => {
  const theme = window.ReportCardThemeEngine.getTemplateTheme(
    "PRIMARY",
    { colors: { primary_color: "#006699", header_color: "#006699", table_header_color: "#DDEEFF" } },
    {},
    {},
  );

  assert.equal(theme.primary_color, "#006699");
  assert.equal(theme.table_header_color, "#DDEEFF");
  assert.equal(theme.background_color, "#F1F7FD");
});
