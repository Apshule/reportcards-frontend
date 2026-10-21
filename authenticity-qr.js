(() => {
  "use strict";

  const VERIFY_URL = "https://reportcards.appshule.com/verify";
  const QR_SIZE = 512;

  function verificationUrl(reportCardId) {
    return `${VERIFY_URL}?id=${encodeURIComponent(reportCardId)}`;
  }

  function toPngDataUrl(content) {
    if (typeof window.qrcode !== "function") {
      return Promise.reject(new Error("The QR code library did not load. Refresh and try again."));
    }
    const qr = window.qrcode(0, "H");
    qr.addData(content);
    qr.make();
    const svg = qr.createSvgTag(8, 4);
    const image = new Image();
    return new Promise((resolve, reject) => {
      image.onerror = () => reject(new Error("Could not render the report verification QR code."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = QR_SIZE;
        canvas.height = QR_SIZE;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare the report verification QR code."));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, QR_SIZE, QR_SIZE);
        context.drawImage(image, 0, 0, QR_SIZE, QR_SIZE);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }

  window.ReportCardsAuthenticityQr = { verificationUrl, toPngDataUrl };
})();
