import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const images = [];
const labels = [];
const page = {
  getWidth: () => 595.28,
  drawImage(_image, options) { images.push(options); },
  drawText(text, options) { labels.push({ text, ...options }); },
};
const document = {
  getPages: () => [page],
  async embedPng() { return { width: 120, height: 120 }; },
  async embedFont() {
    return { widthOfTextAtSize: (text, size) => String(text).length * size * 0.5 };
  },
  async save() { return new Uint8Array([1]); },
};
const window = {
  PDFLib: {
    PDFDocument: { async load() { return document; } },
    StandardFonts: { Helvetica: "regular" },
    degrees: (angle) => angle,
    rgb: (red, green, blue) => ({ red, green, blue }),
  },
};
new Function("window", readFileSync(
  new URL("../pdf-templates/authenticity-qr-renderer.js", import.meta.url),
  "utf8",
))(window);

test("authenticity QR and label move up 5mm without touching footer text", async () => {
  await window.ReportCardQrRenderer.apply(new Uint8Array([1]), {
    authenticity_qr_data_url: "data:image/png;base64,YWJj",
  });
  const expectedY = 60 + (5 * 72 / 25.4);
  assert.ok(Math.abs(images[0].y - expectedY) < 0.001);
  assert.ok(Math.abs(labels[0].y - (expectedY - 7)) < 0.001);
  assert.ok(labels[0].y > 59 + 5.5);
});
