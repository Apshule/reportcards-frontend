(() => {
  "use strict";

  function pngBytes(dataUrl) {
    const match = /^data:image\/png;base64,([a-z0-9+/]+=*)$/iu.exec(String(dataUrl || ""));
    if (!match) throw new Error("The report verification QR code is not a valid PNG image.");
    const binary = atob(match[1]);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function sideForReport(report) {
    const school = report?.school || {};
    const stamp = {
      ...(school.stamp_config && typeof school.stamp_config === "object" ? school.stamp_config : {}),
      ...(report?.stamp_config && typeof report.stamp_config === "object" ? report.stamp_config : {}),
    };
    const position = String(stamp.position || "Bottom Right").toLowerCase().replace(/[\s_-]+/g, "");
    return position === "bottomcenter" ? "right" : "center";
  }

  async function apply(pdfBytes, report) {
    const source = report?.authenticity_qr_data_url;
    if (!source) return pdfBytes;
    if (!window.PDFLib?.PDFDocument) {
      throw new Error("PDF verification support is unavailable; refresh and try again.");
    }
    const document = await window.PDFLib.PDFDocument.load(pdfBytes);
    const pages = document.getPages();
    const page = pages[pages.length - 1];
    if (!page) return pdfBytes;

    const qrImage = await document.embedPng(pngBytes(source));
    const font = await document.embedFont(window.PDFLib.StandardFonts.Helvetica);
    const size = 42.52;
    const side = sideForReport(report);
    const x = side === "right" ? page.getWidth() - 28 - size : (page.getWidth() - size) / 2;
    page.drawImage(qrImage, { x, y: 60, width: size, height: size });
    const label = "Scan to Verify Authenticity";
    const labelSize = 5.5;
    const labelWidth = font.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: x + (size - labelWidth) / 2,
      y: 53,
      size: labelSize,
      font,
      color: window.PDFLib.rgb(0.18, 0.16, 0.22),
    });
    return document.save();
  }

  window.ReportCardQrRenderer = { apply };
})();
