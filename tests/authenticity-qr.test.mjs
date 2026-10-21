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

test("PDF QR renderer overlays a 20mm QR and authenticity label at page bottom center", async () => {
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
  assert.equal(calls.images[0].options.width, 56.69);
  assert.equal(calls.images[0].options.height, 56.69);
  assert.equal(calls.images[0].options.x, (595.28 - 56.69) / 2);
  assert.equal(calls.images[0].options.y, 44);
  assert.equal(calls.text[0].text, "Scan to Verify Authenticity");
  assert.equal(calls.text[0].options.y, 36);
  assert.ok(calls.text[0].options.x > 0);
});

