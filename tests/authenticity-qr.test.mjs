import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const qrWindow = {
  qrcode: (version, level) => {
    assert.equal(version, 0);
    assert.equal(level, "H");
    return {
      addData(value) { qrWindow.encodedValue = value; },
      make() {},
      createSvgTag(cellSize, margin) {
        assert.equal(cellSize, 8);
        assert.equal(margin, 4);
        return "<svg></svg>";
      },
    };
  },
};
class FakeImage {
  set src(value) {
    this.source = value;
    this.onload?.();
  }
}
const fakeDocument = {
  createElement(name) {
    assert.equal(name, "canvas");
    return {
      width: 0,
      height: 0,
      getContext(kind) {
        assert.equal(kind, "2d");
        return {
          fillStyle: "",
          fillRect() {},
          drawImage() {},
        };
      },
      toDataURL(type) {
        assert.equal(type, "image/png");
        return "data:image/png;base64,QUJD";
      },
    };
  },
};
new Function(
  "window",
  "Image",
  "document",
  readFileSync(new URL("../authenticity-qr.js", import.meta.url), "utf8"),
)(qrWindow, FakeImage, fakeDocument);

test("verification QR points to the clean public verification URL and produces a PNG", async () => {
  const id = "a9c6c345-2b2d-45a8-8ed3-21a66fcda212";
  const url = qrWindow.ReportCardsAuthenticityQr.verificationUrl(id);
  assert.equal(url, `https://reportcards.appshule.com/verify?id=${id}`);
  assert.equal(
    await qrWindow.ReportCardsAuthenticityQr.toPngDataUrl(url),
    "data:image/png;base64,QUJD",
  );
  assert.equal(qrWindow.encodedValue, url);
});

test("PDF QR renderer uses a compact 10mm QR after moving it up 5mm", async () => {
  const calls = { images: [], text: [] };
  const page = {
    getWidth: () => 595.28,
    drawImage: (image, options) => calls.images.push({ image, options }),
    drawText: (text, options) => calls.text.push({ text, options }),
  };
  const font = { widthOfTextAtSize: () => 100 };
  const pdfDocument = {
    getPages: () => [page],
    embedPng: async (bytes) => {
      calls.pngBytes = [...bytes];
      return { kind: "qr-png" };
    },
    embedFont: async () => font,
    save: async () => new Uint8Array([8, 9, 10]),
  };
  const rendererWindow = {
    PDFLib: {
      PDFDocument: { load: async () => pdfDocument },
      StandardFonts: { Helvetica: "Helvetica" },
      rgb: (...values) => values,
    },
  };
  new Function(
    "window",
    "atob",
    readFileSync(new URL("../pdf-templates/authenticity-qr-renderer.js", import.meta.url), "utf8"),
  )(rendererWindow, globalThis.atob);

  const result = await rendererWindow.ReportCardQrRenderer.apply(
    new Uint8Array([1, 2, 3]),
    { authenticity_qr_data_url: "data:image/png;base64,YWJj" },
  );
  assert.deepEqual([...result], [8, 9, 10]);
  assert.deepEqual(calls.pngBytes, [97, 98, 99]);
  assert.equal(calls.images.length, 1);
  assert.equal(calls.images[0].options.width, 28.35);
  assert.equal(calls.images[0].options.height, 28.35);
  assert.equal(calls.images[0].options.x, (595.28 - 28.35) / 2);
  const expectedY = 60 + (5 * 72 / 25.4);
  assert.ok(Math.abs(calls.images[0].options.y - expectedY) < 0.001);
  assert.equal(calls.text[0].text, "Scan to Verify Authenticity");
  assert.ok(Math.abs(calls.text[0].options.y - (expectedY - 7)) < 0.001);
  assert.ok(calls.text[0].options.x > 0);
});

test("PDF QR renderer moves to the opposite footer corner when the stamp is centered", async () => {
  const calls = [];
  const page = {
    getWidth: () => 595.28,
    drawImage: (_image, options) => calls.push(options),
    drawText() {},
  };
  const rendererWindow = {
    PDFLib: {
      PDFDocument: {
        load: async () => ({
          getPages: () => [page],
          embedPng: async () => ({}),
          embedFont: async () => ({ widthOfTextAtSize: () => 100 }),
          save: async () => new Uint8Array(),
        }),
      },
      StandardFonts: { Helvetica: "Helvetica" },
      rgb: (...values) => values,
    },
  };
  new Function(
    "window",
    "atob",
    readFileSync(new URL("../pdf-templates/authenticity-qr-renderer.js", import.meta.url), "utf8"),
  )(rendererWindow, globalThis.atob);

  await rendererWindow.ReportCardQrRenderer.apply(new Uint8Array(), {
    authenticity_qr_data_url: "data:image/png;base64,YWJj",
    school: { stamp_config: { position: "Bottom Center" } },
  });

  assert.equal(calls[0].x, 595.28 - 28 - 28.35);
});

