import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const window = {};
new Function("window", readFileSync(new URL("../stamp-builder.js", import.meta.url), "utf8"))(window);
new Function("window", readFileSync(new URL("../pdf-templates/stamp-renderer.js", import.meta.url), "utf8"))(window);

function renderStamp(position, {
  logo = true,
  source,
  logoSettings = {},
  schoolSettings = {},
  returnDetails = false,
} = {}) {
  const calls = [];
  const page = {
    getWidth: () => 612,
    getHeight: () => 792,
    drawLine: () => {},
    drawText: () => {},
    drawImage: (_image, options) => calls.push(options),
  };
  const document = {
    embedFont: async () => ({ widthOfTextAtSize: (text, size) => String(text).length * size * 0.4 }),
    embedPng: async () => ({ width: 600, height: 400 }),
    embedJpg: async () => ({ width: 600, height: 400 }),
    getPages: () => [page],
    save: async () => new Uint8Array([1]),
  };
  window.PDFLib = {
    PDFDocument: { load: async () => document },
    StandardFonts: { Helvetica: "Helvetica" },
    rgb: (r, g, b) => ({ r, g, b }),
    degrees: (degrees) => degrees,
  };
  const logoBase64 = source ?? (logo ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]).toString("base64") : "");
  return window.ReportCardStampRenderer.apply(
    new Uint8Array([1]),
    {
      school: {
        logo_base64: logoBase64,
        stamp_logo_position: position,
        ...schoolSettings,
      },
    },
    {
      shape: "circle",
      position: "Bottom Right",
      line_1: "SCHOOL",
      line_2: "SAMPLE SCHOOL",
      line_3: "OFFICIAL",
      line_4: "2027",
      line_5: "UGANDA",
      ...logoSettings,
    },
  ).then(() => returnDetails
    ? { image: calls[0] || null }
    : calls[0] || null);
}

test("stamp settings expose all requested school-logo positions and default to inside center", () => {
  const html = window.ReportCardStampBuilder.render();
  for (const value of ["inside_center", "inside_top", "inside_bottom", "inside_left", "inside_right", "outside_left", "outside_right", "hidden"]) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
  assert.match(html, /Inside Center \(Default\)/);
  assert.match(html, /name="stamp_logo_size"[^>]*value="20"/);
  assert.match(html, /name="stamp_logo_offset_x"/);
  assert.match(html, /name="stamp_logo_offset_y"/);
  assert.match(html, /name="stamp_logo_rotation"/);
  assert.match(html, /name="stamp_logo_opacity"/);
});

test("school logo is centered within the stamp by default and moved to the inside top when selected", async () => {
  const center = await renderStamp("inside_center");
  const top = await renderStamp("inside_top");
  assert.ok(center);
  assert.ok(top);
  assert.ok(Math.abs(center.x + center.width / 2 - 554) < 0.01);
  assert.ok(Math.abs(center.y + center.height / 2 - 82) < 0.01);
  assert.ok(Math.abs(top.x + top.width / 2 - 554) < 0.01);
  assert.ok(top.y + top.height / 2 > center.y + center.height / 2);
});

test("outside logo settings position the school logo on the requested side; hidden or missing logo omits it", async () => {
  const left = await renderStamp("outside_left");
  const right = await renderStamp("outside_right");
  const hidden = await renderStamp("hidden");
  const missing = await renderStamp("outside_left", { logo: false });
  assert.ok(left);
  assert.ok(right);
  assert.ok(left.x < right.x);
  assert.equal(hidden, null);
  assert.equal(missing, null);
});

test("logo sizing, offsets, rotation, and transparency are applied to the embedded school logo", async () => {
  const image = await renderStamp("inside_center", {
    logoSettings: {
      stamp_logo_size: 30,
      stamp_logo_offset_x: 5,
      stamp_logo_offset_y: -3,
      stamp_logo_rotation: 90,
      stamp_logo_opacity: 50,
    },
  });
  assert.ok(image);
  assert.ok(Math.abs(image.width - (30 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(image.x - (554 - image.width / 2 + 5 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(image.y - (82 - image.height / 2 + 3 * 72 / 25.4)) < 0.01);
  assert.equal(image.rotate, 90);
  assert.equal(image.opacity, 0.5);
});

test("school API logo settings reach drawImage with the requested scale, position, rotation, and opacity", async () => {
  const result = await renderStamp("inside_center", {
    schoolSettings: {
      stamp_logo_size: 30,
      stamp_logo_offset_x: 5,
      stamp_logo_offset_y: -3,
      stamp_logo_rotation: 270,
      stamp_logo_opacity: 35,
    },
    returnDetails: true,
  });
  const image = result.image;
  assert.ok(image);
  assert.ok(Math.abs(image.width - (30 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(image.x - (554 - image.width / 2 + 5 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(image.y - (82 - image.height / 2 - (-3 * 72 / 25.4))) < 0.01);
  assert.equal(image.rotate, 270);
  assert.equal(image.opacity, 0.35);
});

test("school logo parser accepts a base64 image data URI", async () => {
  const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]).toString("base64").replace(/=+$/u, "");
  const image = await renderStamp("inside_center", { source: `"data:image/png;base64,${raw}"` });
  assert.ok(image);
});
