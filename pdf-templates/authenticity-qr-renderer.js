(() => {
  "use strict";

  function pngBytes(dataUrl) {
    const match = /^data:image\/png;base64,([a-z0-9+/]+=*)$/iu.exec(String(dataUrl || ""));
    if (!match) throw new Error("The report verification QR code is not a valid PNG image.");
    const binary = atob(match[1]);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
    const size = 56.69;
    const x = (page.getWidth() - size) / 2;
    page.drawImage(qrImage, { x, y: 44, width: size, height: size });
    const label = "Scan to Verify Authenticity";
    const labelSize = 5.5;
    const labelWidth = font.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: (page.getWidth() - labelWidth) / 2,
      y: 36,
      size: labelSize,
      font,
      color: window.PDFLib.rgb(0.18, 0.16, 0.22),
    });
    return document.save();
  }

  window.ReportCardQrRenderer = { apply };
})();
