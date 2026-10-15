(() => {
  "use strict";

  const fallbackPrimary = "#1E5EB5";
  const fallbackSecondary = "#000000";
  const hexPattern = /^#[0-9a-f]{6}$/i;

  function safeColor(value, fallback) {
    const input = String(value || "");
    const clean = hexPattern.test(input) ? input.slice(1) : fallback.slice(1);
    return window.PDFLib.rgb(
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
    );
  }

  function cleanText(value) {
    return String(value || "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  }

  function opacity(config) {
    const number = Number(config.transparency);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) / 100 : 1;
  }

  function normalizedShape(value) {
    const shape = String(value || "circle").toLowerCase().replace(/[\s_-]+/g, "");
    if (shape === "oval") return "oval";
    if (shape === "rectangle") return "rectangle";
    if (shape === "roundedrectangle") return "rounded_rectangle";
    return "circle";
  }

  function normalizedPosition(value) {
    return String(value || "Bottom Right").toLowerCase().replace(/[\s_-]+/g, "");
  }

  function boundsFor(page, config) {
    const shape = normalizedShape(config.shape);
    const width = shape === "circle" ? 62 : shape === "oval" ? 82 : 98;
    const height = shape === "circle" ? 62 : shape === "oval" ? 52 : 58;
    const margin = 27;
    const position = normalizedPosition(config.position);
    const x = position === "bottomleft" ? margin
      : position === "bottomcenter" ? (page.getWidth() - width) / 2
        : page.getWidth() - width - margin;
    const y = 51;
    return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
  }

  function rotatedPoint(x, y, cx, cy, radians) {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: cy + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  }

  function ellipsePoints(bounds, inset = 0, segments = 48) {
    const rx = Math.max(1, bounds.width / 2 - inset);
    const ry = Math.max(1, bounds.height / 2 - inset);
    return Array.from({ length: segments }, (_, index) => {
      const angle = index * Math.PI * 2 / segments;
      return { x: bounds.cx + Math.cos(angle) * rx, y: bounds.cy + Math.sin(angle) * ry };
    });
  }

  function rectanglePoints(bounds, inset = 0) {
    const left = bounds.x + inset;
    const right = bounds.x + bounds.width - inset;
    const bottom = bounds.y + inset;
    const top = bounds.y + bounds.height - inset;
    return [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }];
  }

  function roundedRectanglePoints(bounds, inset = 0) {
    const left = bounds.x + inset;
    const right = bounds.x + bounds.width - inset;
    const bottom = bounds.y + inset;
    const top = bounds.y + bounds.height - inset;
    const radius = Math.min(8, (right - left) / 5, (top - bottom) / 4);
    const corners = [
      { x: right - radius, y: bottom + radius, start: -90, end: 0 },
      { x: right - radius, y: top - radius, start: 0, end: 90 },
      { x: left + radius, y: top - radius, start: 90, end: 180 },
      { x: left + radius, y: bottom + radius, start: 180, end: 270 },
    ];
    return corners.flatMap((corner) => Array.from({ length: 6 }, (_, index) => {
      const angle = (corner.start + (corner.end - corner.start) * index / 5) * Math.PI / 180;
      return { x: corner.x + Math.cos(angle) * radius, y: corner.y + Math.sin(angle) * radius };
    }));
  }

  function strokePolygon(page, points, centerX, centerY, rotation, strokeColor, strokeWidth, alpha) {
    const radians = rotation * Math.PI / 180;
    const rotated = points.map((point) => rotatedPoint(point.x, point.y, centerX, centerY, radians));
    rotated.forEach((point, index) => {
      const next = rotated[(index + 1) % rotated.length];
      page.drawLine({
        start: point,
        end: next,
        thickness: strokeWidth,
        color: strokeColor,
        opacity: alpha,
      });
    });
  }

  function drawShape(page, bounds, config, primary, secondary, alpha, rotation) {
    const shape = normalizedShape(config.shape);
    if (shape === "circle") {
      strokePolygon(page, ellipsePoints(bounds), bounds.cx, bounds.cy, rotation, secondary, 1.7, alpha);
      strokePolygon(page, ellipsePoints(bounds, 5), bounds.cx, bounds.cy, rotation, primary, 1, alpha);
    } else if (shape === "oval") {
      strokePolygon(page, ellipsePoints(bounds), bounds.cx, bounds.cy, rotation, secondary, 1.7, alpha);
      strokePolygon(page, ellipsePoints(bounds, 5), bounds.cx, bounds.cy, rotation, primary, 1, alpha);
    } else if (shape === "rounded_rectangle") {
      strokePolygon(page, roundedRectanglePoints(bounds), bounds.cx, bounds.cy, rotation, secondary, 1.8, alpha);
      strokePolygon(page, roundedRectanglePoints(bounds, 5), bounds.cx, bounds.cy, rotation, primary, 1, alpha);
    } else {
      strokePolygon(page, rectanglePoints(bounds), bounds.cx, bounds.cy, rotation, secondary, 1.8, alpha);
      strokePolygon(page, rectanglePoints(bounds, 5), bounds.cx, bounds.cy, rotation, primary, 1, alpha);
    }
  }

  function drawCentered(page, text, x, y, font, size, color, alpha, rotation) {
    const content = cleanText(text);
    if (!content) return;
    const width = font.widthOfTextAtSize(content, size);
    page.drawText(content, {
      x: x - width / 2,
      y,
      size,
      font,
      color,
      opacity: alpha,
      rotate: window.PDFLib.degrees(rotation),
    });
  }

  function drawArcText(page, text, bounds, font, color, alpha, rotation, top) {
    const content = cleanText(text).slice(0, 24);
    if (!content) return;
    const radius = bounds.width / 2 - 8;
    const start = top ? 158 : 202;
    const end = top ? 22 : 338;
    const count = content.length;
    const turn = Number(rotation) * Math.PI / 180;
    for (let index = 0; index < count; index += 1) {
      const fraction = count === 1 ? 0.5 : index / (count - 1);
      const angle = (start + (end - start) * fraction) * Math.PI / 180;
      const x = bounds.cx + Math.cos(angle) * radius;
      const y = bounds.cy + Math.sin(angle) * radius;
      const point = rotatedPoint(x, y, bounds.cx, bounds.cy, turn);
      const tangent = (top ? angle - Math.PI / 2 : angle + Math.PI / 2) + turn;
      const char = content[index];
      const size = 4.2;
      const charWidth = font.widthOfTextAtSize(char, size);
      page.drawText(char, {
        x: point.x - charWidth / 2,
        y: point.y - size / 2,
        size,
        font,
        color,
        opacity: alpha,
        rotate: window.PDFLib.degrees(tangent * 180 / Math.PI),
      });
    }
  }

  function drawStampOnPage(page, config, font) {
    const bounds = boundsFor(page, config);
    const alpha = opacity(config);
    const rotation = Math.max(-15, Math.min(15, Number(config.rotation_degrees) || 0));
    const primary = safeColor(config.primary_color, fallbackPrimary);
    const secondary = safeColor(config.secondary_color, fallbackSecondary);
    const angle = rotation * Math.PI / 180;
    drawShape(page, bounds, config, primary, secondary, alpha, rotation);
    if (normalizedShape(config.shape) === "circle") {
      drawArcText(page, config.line_1, bounds, font, primary, alpha, rotation, true);
      drawArcText(page, config.line_5, bounds, font, primary, alpha, rotation, false);
      const lines = [config.line_2, config.line_3, config.line_4];
      const offsets = [10, 0, -10];
      lines.forEach((line, index) => {
        const point = rotatedPoint(bounds.cx, bounds.cy + offsets[index], bounds.cx, bounds.cy, angle);
        drawCentered(page, line, point.x, point.y - 2.5, font, index === 1 ? 7 : 6.1, primary, alpha, rotation);
      });
      return;
    }
    const lines = [config.line_1, config.line_2, config.line_3, config.line_4, config.line_5].filter((line) => cleanText(line));
    if (!lines.length) return;
    const lineGap = Math.min(10, (bounds.height - 16) / Math.max(1, lines.length));
    const firstY = bounds.cy + ((lines.length - 1) * lineGap) / 2 - 2.4;
    lines.forEach((line, index) => {
      const point = rotatedPoint(bounds.cx, firstY - index * lineGap, bounds.cx, bounds.cy, angle);
      drawCentered(page, line, point.x, point.y, font, lines.length > 3 ? 5.3 : 6.1, primary, alpha, rotation);
    });
  }

  async function apply(bytes, report, configuredStamp) {
    const stamp = configuredStamp || report?.stamp_config || report?.school?.stamp_config;
    if (!stamp || typeof stamp !== "object" || Object.keys(stamp).length === 0) return bytes;
    if (!window.PDFLib?.PDFDocument) throw new Error("PDF stamp support is unavailable; reload and try again.");
    const document = await window.PDFLib.PDFDocument.load(bytes);
    const font = await document.embedFont(window.PDFLib.StandardFonts.Helvetica);
    document.getPages().forEach((page) => drawStampOnPage(page, stamp, font));
    return document.save();
  }

  window.ReportCardStampRenderer = { apply };
})();
