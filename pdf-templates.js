(() => {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  const portrait = [595.28, 841.89];
  const watermarkImageCache = new WeakMap();
  const reportFonts = { heading: 15, subheading: 14, body: 12, table: 11, descriptor: 10 };

  const levelCode = (level) => {
    const code = String(level || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^(ALEVEL|S[56])/.test(code)) return "A_LEVEL";
    if (/^(OLEVEL|S[1-4])/.test(code)) return "O_LEVEL";
    if (/^(PRIMARY|P[1-7])/.test(code)) return "PRIMARY";
    return "NURSERY";
  };
  const color = (hex) => {
    const safe = /^#[0-9a-f]{6}$/i.test(String(hex || "")) ? hex.slice(1) : "4B2E9E";
    return rgb(
      parseInt(safe.slice(0, 2), 16) / 255,
      parseInt(safe.slice(2, 4), 16) / 255,
      parseInt(safe.slice(4, 6), 16) / 255,
    );
  };
  const colorToPdf = (value) => value && typeof value === "object" && "red" in value ? value : color(value);
  const contrastColor = (fill) => {
    const channels = typeof fill === "string"
      ? [1, 3, 5].map((start) => parseInt(fill.slice(start, start + 2), 16) / 255)
      : [fill.red, fill.green, fill.blue];
    const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return luminance > 0.179 ? rgb(0.12, 0.11, 0.14) : rgb(1, 1, 1);
  };
  const num = (value, digits = 1) => {
    if (value === null || value === undefined || value === "") return "—";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : "—";
  };
  const str = (value) => value === null || value === undefined || value === "" ? "—" : String(value);
  const infoValue = (label, value) => {
    const blankWhenMissing = ["HOUSE", "ABSENT", "DAYS ABSENT"].includes(String(label).toUpperCase());
    return blankWhenMissing && (value === null || value === undefined || String(value).trim() === "")
      ? ""
      : str(value);
  };
  function formatReportDate(value) {
    if (value === null || value === undefined || value === "") return str(value);
    const isDate = value instanceof Date;
    const text = isDate ? "" : String(value).trim();
    if (!isDate && !/^\d{4}-\d{2}-\d{2}(?:$|T)/u.test(text)) return str(value);
    const date = isDate ? value : new Date(text.includes("T") ? text : `${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return str(value);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  const periodTools = () => window.ReportCardTemplatePicker;
  const assessmentPeriod = (report) => {
    const suppliedDefinition = report?.periodDefinition ?? report?.period_definition;
    if (suppliedDefinition && typeof suppliedDefinition === "object" && Array.isArray(suppliedDefinition.fields)) {
      return suppliedDefinition;
    }
    const picker = periodTools();
    if (typeof picker?.periodDefinition === "function") {
      return picker.periodDefinition(report?.period ?? "EOT");
    }
    return {
      key: "EOT",
      title: "END OF TERM",
      fields: [{ key: "eot_period", label: "E.O.T" }],
      combined: false,
    };
  };
  const periodValue = (mark, field, period) =>
    periodTools().periodValue(mark, field, period.key);
  const periodScore = (mark, period) =>
    periodTools().periodScore(mark, period.key);
  const periodSum = (entries, field, period) => {
    const values = entries
      .map(({ mark }) => periodValue(mark, field, period))
      .filter((score) => score !== null);
    return values.length ? values.reduce((sum, score) => sum + score, 0) : null;
  };
  const periodAverage = (entries, field, period) => {
    const values = entries
      .map(({ mark }) => periodValue(mark, field, period))
      .filter((score) => score !== null);
    return values.length ? values.reduce((sum, score) => sum + score, 0) / values.length : null;
  };
  const bytesFromImage = (source) => {
    if (!source) return null;
    const value = String(source).replace(/^data:image\/[^;]+;base64,/i, "").trim();
    try {
      const raw = atob(value);
      return Uint8Array.from(raw, (char) => char.charCodeAt(0));
    } catch {
      return null;
    }
  };
  async function embedImage(doc, source) {
    const bytes = bytesFromImage(source);
    if (!bytes) return null;
    try {
      if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
  async function drawPageWatermark(doc, page, report) {
    const school = report?.school || {};
    const schoolLogoBase64 = school.logo_base64;
    const pageSize = page.getSize();
    if (typeof school.report_background_color === "string" && /^#[0-9a-f]{6}$/iu.test(school.report_background_color)) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageSize.width,
        height: pageSize.height,
        color: color(school.report_background_color),
      });
    }
    if (school.watermark_enabled !== true || !schoolLogoBase64) return;
    let image = watermarkImageCache.get(doc);
    if (!image) {
      image = await embedImage(doc, schoolLogoBase64);
      if (image) watermarkImageCache.set(doc, image);
    }
    if (!image) {
      throw new Error("The school logo could not be embedded as a report-card watermark.");
    }
    const { width, height } = page.getSize();
    const scale = Math.min((width * 0.62) / image.width, (height * 0.62) / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const savedOpacity = school.watermark_opacity === null || school.watermark_opacity === undefined || school.watermark_opacity === ""
      ? 5
      : Number(school.watermark_opacity);
    const opacity = Number.isFinite(savedOpacity)
      ? Math.max(0, Math.min(100, savedOpacity)) / 100
      : 0.05;
    page.drawImage(image, {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
      opacity,
    });
  }
  function fitted(text, font, size, maxWidth) {
    let value = String(text ?? "—")
      .replace(/\s+/g, " ")
      .replace(/[^\x00-\xFF\u2013\u2014\u2018\u2019\u2022]/g, "?");
    if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
    while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value}...`;
  }
  function completeWrappedLines(text, font, size, maxWidth) {
    const value = String(text ?? "")
      .replace(/\s+/g, " ")
      .replace(/[^\x00-\xFF\u2013\u2014\u2018\u2019\u2022]/g, "?")
      .trim();
    if (!value) return [];
    const lines = [];
    let line = "";
    for (const word of value.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of Array.from(word)) {
        const next = line + character;
        if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(line);
          line = character;
        } else {
          line = next;
        }
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function fitCompleteText(text, font, maxWidth, maxLines, maximumSize = reportFonts.body, minimumSize = 4) {
    for (let size = maximumSize; size >= minimumSize; size -= 0.5) {
      const lines = completeWrappedLines(text, font, size, maxWidth);
      if (lines.length <= maxLines) return { lines, size };
    }
    return { lines: completeWrappedLines(text, font, minimumSize, maxWidth), size: minimumSize };
  }
  function fitCompleteTextInBox(text, font, maxWidth, maxHeight, maximumSize = reportFonts.body, minimumSize = 4, leading = 1) {
    for (let size = maximumSize; size >= minimumSize; size -= 0.5) {
      const lines = completeWrappedLines(text, font, size, maxWidth);
      const lineHeight = size + leading;
      if (lines.length * lineHeight <= maxHeight) {
        return { lines, size, lineHeight, fits: true };
      }
    }
    return {
      lines: completeWrappedLines(text, font, minimumSize, maxWidth),
      size: minimumSize,
      lineHeight: minimumSize + leading,
      fits: false,
    };
  }
  function drawCenteredHeaderRows(page, rows, center, startY, maxWidth) {
    let y = startY;
    let lastBaseline = startY;
    for (const row of rows) {
      if (row.text === null || row.text === undefined || String(row.text).trim() === "") continue;
      const lines = completeWrappedLines(row.text, row.font, row.size, maxWidth);
      for (const line of lines) {
        const textWidth = row.font.widthOfTextAtSize(line, row.size);
        const x = center - textWidth / 2;
        page.drawText(line, { x, y, size: row.size, font: row.font, color: row.fill });
        if (row.underline) {
          page.drawLine({
            start: { x, y: y - 1.5 },
            end: { x: x + textWidth, y: y - 1.5 },
            thickness: 0.65,
            color: row.fill,
          });
        }
        lastBaseline = y;
        y -= row.size + 1;
      }
    }
    return lastBaseline;
  }
  function drawText(page, text, x, y, font, size = reportFonts.body, fill = rgb(0.16, 0.17, 0.19), maxWidth = 200) {
    const bodySize = Math.max(reportFonts.body, size);
    page.drawText(fitted(text, font, bodySize, maxWidth), { x, y, size: bodySize, font, color: fill });
  }
  function centered(page, text, center, y, font, size, fill, maxWidth) {
    const bodySize = Math.max(reportFonts.body, size);
    const line = fitted(text, font, bodySize, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, bodySize);
    page.drawText(line, { x: center - textWidth / 2, y, size: bodySize, font, color: fill });
  }
  function centeredHeaderLine(page, text, center, y, font, size, fill, maxWidth, minimumSize = 7) {
    if (text === null || text === undefined || String(text).trim() === "") return null;
    const safeText = String(text).replace(/\s+/g, " ").trim();
    let renderedSize = size;
    while (renderedSize > minimumSize && font.widthOfTextAtSize(safeText, renderedSize) > maxWidth) {
      renderedSize = Math.max(minimumSize, renderedSize - 0.5);
    }
    const line = fitted(safeText, font, renderedSize, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, renderedSize);
    const x = center - textWidth / 2;
    page.drawText(line, { x, y, size: renderedSize, font, color: fill });
    return { x, width: textWidth, size: renderedSize };
  }
  function alignedText(page, text, x, y, font, size, fill, maxWidth, align = "left", minimumSize = 0) {
    const renderedSize = Math.max(size, minimumSize);
    const line = fitted(text, font, renderedSize, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, renderedSize);
    const left = align === "center" ? x + Math.max(0, (maxWidth - textWidth) / 2)
      : align === "right" ? x + Math.max(0, maxWidth - textWidth) : x;
    page.drawText(line, { x: left, y, size: renderedSize, font, color: fill });
  }
  function drawTableText(page, text, x, y, font, size = reportFonts.table, fill = rgb(0.16, 0.17, 0.19), maxWidth = 200) {
    const tableSize = Math.max(reportFonts.table, size);
    page.drawText(fitted(text, font, tableSize, maxWidth), { x, y, size: tableSize, font, color: fill });
  }
  function centeredTable(page, text, center, y, font, size, fill, maxWidth, minimumSize = reportFonts.table) {
    const tableSize = Math.max(minimumSize, size);
    const line = fitted(text, font, tableSize, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, tableSize);
    page.drawText(line, { x: center - textWidth / 2, y, size: tableSize, font, color: fill });
  }
  function placeImage(page, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
  function roundedPanel(page, x, y, width, height, radius, fill) {
    const paper = rgb(1, 1, 1);
    const corners = [
      { maskX: x, maskY: y + height - radius, cx: x + radius, cy: y + height - radius },
      { maskX: x + width - radius, maskY: y + height - radius, cx: x + width - radius, cy: y + height - radius },
      { maskX: x, maskY: y, cx: x + radius, cy: y + radius },
      { maskX: x + width - radius, maskY: y, cx: x + width - radius, cy: y + radius },
    ];
    page.drawRectangle({ x, y, width, height, color: fill });
    corners.forEach(({ maskX, maskY, cx, cy }) => {
      page.drawRectangle({ x: maskX, y: maskY, width: radius, height: radius, color: paper });
      page.drawEllipse({ x: cx, y: cy, xScale: radius, yScale: radius, color: fill });
    });
  }
  function displayTerm(term) {
    const key = String(term || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return ({
      TERM_1: "TERM I",
      TERM_2: "TERM II",
      TERM_3: "TERM III",
      END_OF_YEAR: "END OF YEAR",
    })[key] || key.replace(/_/g, " ") || "TERM";
  }
  function reportCardBanner(report) {
    const presetKey = report.grading_scale_preset_key
      ?? report.active_grading_scale?.preset_key
      ?? report.grading_scale?.preset_key;
    if (["o_level_old_uce", "o_level_new_uce"].includes(presetKey)) return "ANNUAL UCE REPORT";
    const term = displayTerm(report.term)
      .replace("TERM III", "TERM 3")
      .replace("TERM II", "TERM 2")
      .replace("TERM I", "TERM 1");
    const period = assessmentPeriod(report);
    return `${term} PROGRESS REPORT - ${period.title}`;
  }
  async function drawHeader(doc, page, report, fonts, theme, title, meta = null) {
    const { width, height } = page.getSize();
    const school = report.school || {};
    const learner = report.learner || {};
    const margin = 28;
    const accent = color(theme.accent_color);
    const maroon = color("#800000");
    const gold = color("#D4AF37");
    const ink = theme.font_color ? color(theme.font_color) : rgb(0.12, 0.12, 0.13);
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
      borderColor: colorToPdf(accent),
      borderWidth: 1.5,
    });
    page.drawLine({
      start: { x: margin + 1, y: height - 29 },
      end: { x: width - margin - 1, y: height - 29 },
      thickness: 3,
      color: maroon,
    });
    page.drawLine({
      start: { x: margin + 1, y: height - 33 },
      end: { x: width - margin - 1, y: height - 33 },
      thickness: 1,
      color: gold,
    });
    const schoolLogo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    const imageY = height - 119;
    const imageSize = 72;
    placeImage(page, schoolLogo, margin + 9, imageY, imageSize, imageSize);
    if (!schoolLogo) {
      centeredHeaderLine(page, String(school.name || "S").slice(0, 1).toUpperCase(), margin + 45, height - 84, fonts.bold, 20, maroon, 60, 14);
    }
    const photoX = width - margin - imageSize - 9;
    if (photo) placeImage(page, photo, photoX, imageY, imageSize, imageSize);
    else centeredHeaderLine(page, "Photo", photoX + imageSize / 2, height - 84, fonts.regular, 9, rgb(0.48, 0.48, 0.5), imageSize, 7);
    const center = width / 2;
    const maxCenter = width - (margin * 2) - (imageSize * 2) - 36;
    const subtitle = school.school_subtitle || school.subtitle || school.school_type || "";
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(", ");
    const contact = [
      school.phone ? `Tel: ${school.phone}` : "",
      school.email ? `Email: ${school.email}` : "",
    ].filter(Boolean).join(", ");
    const lastHeaderBaseline = drawCenteredHeaderRows(page, [
      { text: school.name || "School", font: fonts.bold, size: 15, fill: maroon },
      { text: address, font: fonts.regular, size: 14, fill: ink },
      { text: contact, font: fonts.regular, size: 14, fill: ink },
      { text: school.website ? `Website: ${school.website}` : "", font: fonts.regular, size: 14, fill: ink },
      { text: subtitle, font: fonts.bold, size: 12, fill: ink, underline: true },
      { text: school.motto || "", font: fonts.bold, size: 12, fill: maroon, underline: true },
    ], center, height - 47, maxCenter);
    const dividerY = Math.min(height - 132, lastHeaderBaseline - 10);
    page.drawLine({
      start: { x: margin + 2, y: dividerY },
      end: { x: width - margin - 2, y: dividerY },
      thickness: 1.5,
      color: gold,
    });
    const titleY = dividerY - 32;
    page.drawRectangle({ x: margin, y: titleY - 27, width: width - margin * 2, height: 24, color: rgb(1, 1, 1), opacity: 0.08 });
    page.drawLine({
      start: { x: margin, y: titleY - 27 },
      end: { x: width - margin, y: titleY - 27 },
      thickness: 1,
      color: gold,
    });
    centered(page, reportCardBanner(report), width / 2, titleY - 18, fonts.bold, reportFonts.heading, color("#800000"), width - margin * 2 - 12);
    const infoTop = titleY - 32;
    const level = levelCode(report.class?.level);
    const showPosition = reportPositionEnabled(report, meta);
    const infoRows = level === "NURSERY" ? [
      [["REG NO", learner.reg_no], ["CLASS", report.class?.name], ["FEES BAL", report.fees?.balance], ["SCHOOLPAY CODE", learner.schoolpay_code || school.schoolpay_code]],
      [["NAME", learner.full_name], ["DAYS ATTENDED", report.days_attended ?? report.days_present], ["ABSENT", report.days_absent ?? learner.days_absent ?? report.absence], ["TOTAL", report.total_days ?? report.school_days]],
    ] : level === "PRIMARY" ? [
      [["NAME", learner.full_name], ["AD No", learner.reg_no], ["PRINT DATE", formatReportDate(report.printed_at || report.generated_at || new Date())]],
      [["CLASS", report.class?.name], ["SEX", learner.sex || learner.gender], ["AGE", learner.age], ["SCHOOLPAY CODE", learner.schoolpay_code || school.schoolpay_code]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? learner.days_absent ?? report.absence], ["TERM", displayTerm(report.term)], ["YEAR", report.year]],
      [["POSITION", positionValue({}, report)], ["OUT OF", classSizeValue({}, report)]],
    ] : level === "O_LEVEL" ? [
      [["NAME", learner.full_name], ["TERM", displayTerm(report.term).replace("TERM III", "TERM 3").replace("TERM II", "TERM 2").replace("TERM I", "TERM 1")], ["YEAR", report.year], ["DATE", formatReportDate(report.printed_at || report.generated_at || new Date())]],
      [["ID", learner.scholar_id || learner.reg_no], ["CLASS", report.class?.name], ["VCODE", learner.vcode], ["SCHOOLPAY CODE", learner.schoolpay_code || school.schoolpay_code]],
      [["LIN/AMIS.NO", learner.lin || learner.amis_no], ["STATE", learner.state], ["RESIDENCE", learner.residence], ["HOUSE", learner.house]],
    ] : level === "A_LEVEL" ? [
      [["NAME", learner.full_name], ["GENDER", learner.gender || learner.sex]],
      [["AGE", learner.age], ["ROLL NO", learner.roll_no || learner.reg_no], ["SCHOOLPAY CODE", learner.schoolpay_code || school.schoolpay_code]],
      [["CLASS", report.class?.name], ["STREAM", learner.stream || report.class?.stream], ["HOUSE", learner.house]],
      [["COMBINATION", learner.combination || report.class?.combination], ["TERM", displayTerm(report.term).replace("TERM III", "TERM 3").replace("TERM II", "TERM 2").replace("TERM I", "TERM 1")]],
    ] : [
      [["NAME", learner.full_name], ["AD No", learner.reg_no]],
      [["CLASS", report.class?.name], ["SEX", learner.sex], ["SCHOOLPAY CODE", learner.schoolpay_code || school.schoolpay_code]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? learner.days_absent ?? report.absence]],
      [["POSITION", positionValue({}, report)], ["OUT OF", classSizeValue({}, report)]],
      [["TERM", displayTerm(report.term)], ["YEAR", report.year], ["PRINT DATE", formatReportDate(new Date())]],
    ];
    const gridX = margin;
    const gridWidth = width - margin * 2;
    const cellHeight = level === "O_LEVEL" ? 19 : 20;
    const visibleInfoRows = infoRows.filter((row) => showPosition || !row.some(([label]) => label === "POSITION"));
    let infoRowTop = infoTop;
    visibleInfoRows.forEach((row, rowIndex) => {
      const rowHeight = cellHeight;
      row.forEach(([label, value], columnIndex) => {
      const weights = row.map(([cellLabel]) => String(cellLabel).toUpperCase().includes("SCHOOLPAY") ? 3.5 : 1);
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const cellWidth = gridWidth * weights[columnIndex] / totalWeight;
      const cellX = gridX + gridWidth * weights.slice(0, columnIndex).reduce((sum, weight) => sum + weight, 0) / totalWeight;
      const cellY = infoRowTop - rowHeight;
      page.drawRectangle({ x: cellX, y: cellY, width: cellWidth, height: rowHeight, borderColor: accent, borderWidth: 0.45, color: rowIndex % 2 ? color(theme.background_color) : rgb(1, 1, 1), opacity: 0.08 });
      const labelText = `${label}:`;
      const labelSize = reportFonts.body;
      const valueSize = reportFonts.body;
      const textX = cellX + 5;
      const labelWidth = fonts.bold.widthOfTextAtSize(labelText, labelSize);
      if (level === "NURSERY") {
        const nurseryLabelSize = 9;
        const nurseryLabelWidth = fonts.bold.widthOfTextAtSize(labelText, nurseryLabelSize);
        page.drawText(labelText, {
          x: textX,
          y: cellY + 6,
          size: nurseryLabelSize,
          font: fonts.bold,
          color: rgb(0.2, 0.2, 0.22),
        });
        const valueX = textX + nurseryLabelWidth + 3;
        const valueWidth = cellWidth - nurseryLabelWidth - 13;
        const layout = fitCompleteTextInBox(infoValue(label, value), fonts.regular, valueWidth, rowHeight - 4, 9, 4.5);
        if (!layout.fits) throw new Error(`The ${label} value is too long to fit in the Nursery learner details header.`);
        const valueHeight = layout.lines.length * layout.lineHeight;
        const valueBaseline = cellY + Math.max(1, (rowHeight - valueHeight) / 2);
        layout.lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: valueX,
            y: valueBaseline + (layout.lines.length - lineIndex - 1) * layout.lineHeight,
            size: layout.size,
            font: fonts.regular,
            color: rgb(0.2, 0.2, 0.22),
          });
        });
      } else {
        page.drawText(labelText, { x: textX, y: cellY + 6, size: labelSize, font: fonts.bold, color: rgb(0.2, 0.2, 0.22) });
        const valueText = infoValue(label, value);
        const valueGap = String(label).toUpperCase().includes("SCHOOLPAY") ? 7 : 3;
        const valueX = textX + labelWidth + valueGap;
        const valueWidth = cellWidth - labelWidth - valueGap - 10;
        const layout = fitCompleteTextInBox(valueText, fonts.regular, valueWidth, rowHeight - 3, valueSize, 4);
        if (!layout.fits) throw new Error(`The ${label} value is too long to fit in the learner details header.`);
        const valueHeight = layout.lines.length * layout.lineHeight;
        const valueBaseline = cellY + Math.max(1, (rowHeight - valueHeight) / 2);
        layout.lines.forEach((line, lineIndex) => page.drawText(line, {
          x: valueX,
          y: valueBaseline + (layout.lines.length - lineIndex - 1) * layout.lineHeight,
          size: layout.size,
          font: fonts.regular,
          color: rgb(0.2, 0.2, 0.22),
        }));
      }
      });
      infoRowTop -= rowHeight;
    });
    return infoRowTop - 12;
  }
  function drawPromotionBanner(page, report, fonts, y) {
    if (!["TERM_3", "END_OF_YEAR"].includes(String(report.term || "").toUpperCase())) return y;
    const decision = report.promotion_decision || report.promotion?.promotion_decision
      || report.suggested_decision || report.promotion?.suggested_decision;
    const currentClass = report.promotion_current_class || report.promotion?.current_class || report.class?.name || "CURRENT CLASS";
    const nextClass = report.promotion_next_class || report.promotion?.next_class || "NEXT CLASS";
    const config = decision === "promoted"
      ? { text: `PROMOTED TO ${nextClass}`, background: rgb(0.14, 0.53, 0.41), foreground: rgb(1, 1, 1) }
      : decision === "try_another"
        ? { text: "TRY ANOTHER CLASS", background: rgb(0.96, 0.82, 0.32), foreground: rgb(0.12, 0.12, 0.12) }
        : decision === "repeat"
          ? { text: `ADVISED TO REPEAT ${currentClass}`, background: rgb(0.75, 0.22, 0.26), foreground: rgb(1, 1, 1) }
          : null;
    if (!config) return y;
    const { width } = page.getSize();
    page.drawRectangle({ x: 28, y: y - 27, width: width - 56, height: 23, color: config.background });
    centered(page, config.text, width / 2, y - 19, fonts.bold, reportFonts.heading, config.foreground, width - 76);
    return y - 39;
  }
  function drawTable(page, columns, rows, x, top, tableWidth, fonts, accent, options = {}) {
    const groupHeaderHeight = options.headerGroups?.length ? Math.max(18, options.groupHeaderHeight ?? 14) : 0;
    const subHeaderHeight = Math.max(20, options.headerHeight ?? 25);
    const headerHeight = groupHeaderHeight + subHeaderHeight;
    const rowHeight = Math.max(12, options.rowHeight ?? 19);
    const fontSize = Math.max(reportFonts.table, options.fontSize ?? 7);
    const headerFontSize = Math.max(reportFonts.subheading, options.headerFontSize ?? fontSize);
    const availableFractions = columns.map((column) => column.weight || 1);
    const totalWeight = availableFractions.reduce((sum, weight) => sum + weight, 0);
    const widths = availableFractions.map((weight) => tableWidth * weight / totalWeight);
    const pale = options.backgroundColor ? colorToPdf(options.backgroundColor) : rgb(0.94, 0.96, 0.94);
    const headerColor = options.headerColor ? colorToPdf(options.headerColor) : pale;
    const headerTextColor = options.headerTextColor ? colorToPdf(options.headerTextColor) : accent;
    const border = options.accentColor ? colorToPdf(options.accentColor) : accent;
    const ink = options.textColor || rgb(0.17, 0.18, 0.2);
    let y = top;
    page.drawRectangle({ x, y: y - headerHeight, width: tableWidth, height: headerHeight, color: headerColor, opacity: 0.45 });
    const groupY = y;
    if (groupHeaderHeight) {
      const colStart = (index) => x + widths.slice(0, index).reduce((sum, width) => sum + width, 0);
      const rowSpanColumns = options.rowSpanColumns || [0];
      rowSpanColumns.forEach((index) => {
        alignedText(page, columns[index].label, colStart(index) + 3, groupY - groupHeaderHeight - subHeaderHeight + 3, fonts.bold, headerFontSize, headerTextColor, widths[index] - 6, "center", reportFonts.subheading);
        page.drawLine({ start: { x: colStart(index), y: groupY }, end: { x: colStart(index), y: groupY - headerHeight }, thickness: 0.35, color: border });
        page.drawLine({ start: { x: colStart(index) + widths[index], y: groupY }, end: { x: colStart(index) + widths[index], y: groupY - headerHeight }, thickness: 0.35, color: border });
      });
      options.headerGroups.forEach(({ label, start, end }) => {
        const groupX = colStart(start);
        const groupWidth = widths.slice(start, end + 1).reduce((sum, width) => sum + width, 0);
        alignedText(page, label, groupX + 3, groupY - groupHeaderHeight + 2, fonts.bold, Math.max(reportFonts.subheading, options.groupHeaderFontSize ?? headerFontSize), headerTextColor, groupWidth - 6, "center", reportFonts.subheading);
        page.drawLine({ start: { x: groupX, y: groupY }, end: { x: groupX + groupWidth, y: groupY }, thickness: 0.35, color: border });
        page.drawLine({ start: { x: groupX, y: groupY - groupHeaderHeight }, end: { x: groupX + groupWidth, y: groupY - groupHeaderHeight }, thickness: 0.35, color: border });
        page.drawLine({ start: { x: groupX, y: groupY }, end: { x: groupX, y: groupY - headerHeight }, thickness: 0.35, color: border });
        page.drawLine({ start: { x: groupX + groupWidth, y: groupY }, end: { x: groupX + groupWidth, y: groupY - headerHeight }, thickness: 0.35, color: border });
      });
      page.drawLine({ start: { x, y: groupY }, end: { x, y: groupY - headerHeight }, thickness: 0.35, color: border });
      page.drawLine({ start: { x: x + tableWidth, y: groupY }, end: { x: x + tableWidth, y: groupY - headerHeight }, thickness: 0.35, color: border });
      y -= groupHeaderHeight;
    }
    let cellX = x;
    columns.forEach((column, index) => {
      if (!(groupHeaderHeight && (options.rowSpanColumns || [0]).includes(index))) {
        alignedText(page, column.label, cellX + 3, y - subHeaderHeight + Math.max(2, (subHeaderHeight - headerFontSize) / 2 + 2), fonts.bold, headerFontSize, headerTextColor, widths[index] - 6, "center", reportFonts.subheading);
      }
      page.drawLine({ start: { x: cellX, y }, end: { x: cellX, y: y - subHeaderHeight }, thickness: 0.35, color: border });
      cellX += widths[index];
    });
    page.drawLine({ start: { x: x + tableWidth, y }, end: { x: x + tableWidth, y: y - subHeaderHeight }, thickness: 0.35, color: border });
    page.drawLine({ start: { x, y: y - subHeaderHeight }, end: { x: x + tableWidth, y: y - subHeaderHeight }, thickness: 0.45, color: border });
    y -= subHeaderHeight;
    for (const [rowIndex, row] of rows.entries()) {
      page.drawRectangle({ x, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rowIndex % 2 === 0 ? pale : rgb(1, 1, 1), opacity: 0.08 });
      page.drawLine({
        start: { x, y: y - rowHeight },
        end: { x: x + tableWidth, y: y - rowHeight },
        thickness: 0.4,
        color: border,
      });
      let currentX = x;
        row.forEach((value, index) => {
        const font = options.boldColumns?.includes(index) ? fonts.bold
          : options.italicColumns?.includes(index) ? fonts.italic : fonts.regular;
        const align = columns[index]?.align || (options.centerColumns?.includes(index) ? "center" : "left");
          const completeWrapped = options.completeWrappedColumns?.includes(index);
          const minColumnSize = completeWrapped
            ? (options.completeTextMinFontSizes?.[index] ?? 3.5)
            : options.smallTextColumns?.includes(index) ? reportFonts.descriptor : reportFonts.table;
          const columnFontSize = completeWrapped
            ? (options.completeTextMaxFontSizes?.[index] ?? options.columnFontSizes?.[index] ?? 9)
            : Math.max(minColumnSize, options.columnFontSizes?.[index] || fontSize);
          if (completeWrapped) {
            const layout = fitCompleteTextInBox(str(value), font, widths[index] - 6, rowHeight - 2, columnFontSize, minColumnSize);
            if (!layout.fits) {
              throw new Error(`A report-card remark is too long to fit without truncation: ${str(value).slice(0, 48)}`);
            }
            const textHeight = layout.lines.length * layout.lineHeight;
            const baseline = y - rowHeight + Math.max(1, (rowHeight - textHeight) / 2 + 1);
            layout.lines.forEach((line, lineIndex) => {
              alignedText(page, line, currentX + 3, baseline + (layout.lines.length - lineIndex - 1) * layout.lineHeight, font, layout.size, ink, widths[index] - 6, align, minColumnSize);
            });
          } else if (options.wrappedColumns?.includes(index)) {
            const allLines = wrappedLines(str(value), font, columnFontSize, widths[index] - 6);
            const maxLines = Math.max(1, Math.floor((rowHeight - 3) / (columnFontSize + 1)));
            const lines = allLines.slice(0, maxLines);
            if (allLines.length > maxLines && lines.length) {
              lines[lines.length - 1] = fitted(`${lines[lines.length - 1]}...`, font, columnFontSize, widths[index] - 6);
            }
            const baseline = y - rowHeight + Math.max(1, (rowHeight - columnFontSize) / 2 + 1);
            lines.forEach((line, lineIndex) => {
              alignedText(page, line, currentX + 3, baseline + (lines.length - lineIndex - 1) * (columnFontSize + 1), font, columnFontSize, ink, widths[index] - 6, align, minColumnSize);
            });
          } else {
            const baseline = y - rowHeight + Math.max(1, (rowHeight - columnFontSize) / 2 + 1);
            alignedText(page, str(value), currentX + 3, baseline, font, columnFontSize, ink, widths[index] - 6, align, minColumnSize);
          }
        page.drawLine({ start: { x: currentX, y }, end: { x: currentX, y: y - rowHeight }, thickness: 0.35, color: border });
        currentX += widths[index];
      });
      page.drawLine({ start: { x: x + tableWidth, y }, end: { x: x + tableWidth, y: y - rowHeight }, thickness: 0.35, color: border });
      y -= rowHeight;
    }
    page.drawRectangle({ x, y, width: tableWidth, height: top - y, borderColor: border, borderWidth: 0.55 });
    return y;
  }
  function drawSectionBar(page, label, x, top, width, fonts, theme) {
    const height = 20;
    const fill = color(theme.accent_color);
    page.drawRectangle({ x, y: top - height, width, height, color: fill, opacity: 0.62 });
    drawText(page, label, x + 7, top - 15, fonts.bold, reportFonts.subheading, contrastColor(fill), width - 14);
    return top - height - 4;
  }
  async function drawTableFlow(doc, firstPage, report, fonts, theme, title, sectionTitle, columns, rows, x, top, tableWidth, options = {}, meta = null) {
    const requestedRowHeight = Math.max(12, options.rowHeight ?? 19);
    const headerHeight = Math.max(20, options.headerHeight ?? 25) + (options.headerGroups?.length ? Math.max(18, options.groupHeaderHeight ?? 14) : 0);
    const bottomLimit = options.bottomLimit ?? 340;
    const sectionHeight = sectionTitle ? 22 : 0;
    const continuationPages = [];
    let page = firstPage;
    let pageTop = top;
    let offset = 0;
    let lastY = top;
    do {
      if (pageTop - sectionHeight - headerHeight - requestedRowHeight < bottomLimit && (page !== firstPage || pageTop === top)) {
        page = doc.addPage(portrait);
        continuationPages.push(page);
        await drawPageWatermark(doc, page, report);
        pageTop = await drawHeader(doc, page, report, fonts, theme, title);
        if (["O_LEVEL", "A_LEVEL"].includes(levelCode(report.class?.level))) pageTop = drawPromotionBanner(page, report, fonts, pageTop);
        if (meta) variantRule(page, page.getHeight() - 150, page.getWidth(), meta);
      }
      const tableTop = sectionTitle ? drawSectionBar(page, sectionTitle, x, pageTop, tableWidth, fonts, theme) : pageTop;
      const availableRowsHeight = Math.max(0, tableTop - bottomLimit - headerHeight);
      const rowHeight = rows.length
        ? Math.max(12, Math.min(requestedRowHeight, availableRowsHeight / rows.length))
        : requestedRowHeight;
      const capacity = Math.max(1, Math.floor((availableRowsHeight + 0.01) / rowHeight));
      const count = rows.length ? Math.min(capacity, rows.length - offset) : 0;
      const batch = rows.slice(offset, offset + count);
      lastY = drawTable(page, columns, batch, x, tableTop, tableWidth, fonts, color(theme.primary_color), {
        ...options,
        rowHeight,
        textColor: theme.font_color ? color(theme.font_color) : options.textColor,
      });
      offset += count;
      if (offset < rows.length) {
        page = doc.addPage(portrait);
        continuationPages.push(page);
        await drawPageWatermark(doc, page, report);
        pageTop = await drawHeader(doc, page, report, fonts, theme, title);
        if (["O_LEVEL", "A_LEVEL"].includes(levelCode(report.class?.level))) pageTop = drawPromotionBanner(page, report, fonts, pageTop);
        if (meta) variantRule(page, page.getHeight() - 150, page.getWidth(), meta);
      } else {
        break;
      }
    } while (true);
    return { page, y: lastY, pages: continuationPages };
  }
  function drawSummary(page, items, x, y, width, fonts, accent) {
    const itemWidth = width / items.length;
    const pale = rgb(0.96, 0.95, 0.91);
    page.drawRectangle({ x, y: y - 19, width, height: 31, color: pale, borderColor: accent, borderWidth: 0.7, opacity: 0.1 });
    items.forEach(([label, value], index) => {
      const left = x + index * itemWidth;
      if (index) page.drawLine({ start: { x: left, y: y + 12 }, end: { x: left, y: y - 19 }, thickness: 0.5, color: accent });
      drawText(page, label, left + 5, y + 3, fonts.bold, reportFonts.body, accent, itemWidth - 10);
      drawText(page, str(value), left + 5, y - 11, fonts.bold, reportFonts.body, rgb(0.16, 0.17, 0.19), itemWidth - 10);
    });
  }
  function drawCompactSummary(page, items, x, top, width, fonts, accent) {
    const height = 18;
    const itemWidth = width / items.length;
    const pale = rgb(0.96, 0.95, 0.91);
    page.drawRectangle({ x, y: top - height, width, height, color: pale, borderColor: accent, borderWidth: 0.7, opacity: 0.1 });
    items.forEach(([label, value], index) => {
      const left = x + index * itemWidth;
      if (index) page.drawLine({ start: { x: left, y: top }, end: { x: left, y: top - height }, thickness: 0.5, color: accent });
      alignedText(page, `${label}: ${str(value)}`, left + 4, top - 13, fonts.bold, reportFonts.body, rgb(0.16, 0.17, 0.19), itemWidth - 8, "center", reportFonts.body);
    });
  }
  function drawTotalsRow(page, label, value, x, top, width, fonts, accent, background) {
    const height = 18;
    const y = top - height;
    const fill = colorToPdf(accent);
    const white = rgb(1, 1, 1);
    page.drawRectangle({ x, y, width, height, color: fill, borderColor: fill, borderWidth: 0.7 });
    drawTableText(page, `TOTALS · ${label}`, x + 6, y + 3, fonts.bold, reportFonts.table, white, width * 0.62);
    drawTableText(page, str(value), x + width * 0.64, y + 3, fonts.bold, reportFonts.table, white, width * 0.34 - 8);
    return y - 4;
  }
  function drawTableTotals(page, cells, x, top, tableWidth, columns, fonts, accent, fontSize = 6.2) {
    const height = 19;
    const weights = columns.map((column) => column.weight || 1);
    const totalWeight = weights.reduce((sum, item) => sum + item, 0);
    const fill = colorToPdf(accent);
    const white = rgb(1, 1, 1);
    page.drawRectangle({ x, y: top - height, width: tableWidth, height, color: fill, borderColor: fill, borderWidth: 0.6 });
    let cellX = x;
    cells.forEach((item, index) => {
      const cellWidth = tableWidth * weights[index] / totalWeight;
    alignedText(page, item, cellX + 2, top - 12.5, fonts.bold, fontSize, white, cellWidth - 4, "center", reportFonts.table);
      if (index) page.drawLine({ start: { x: cellX, y: top }, end: { x: cellX, y: top - height }, thickness: 0.35, color: white });
      cellX += cellWidth;
    });
    return top - height - 4;
  }
  function drawMergedTotals(page, segments, x, top, tableWidth, columns, fonts, accent, fontSize = 6.2, height = 19) {
    const weights = columns.map((column) => column.weight || 1);
    const totalWeight = weights.reduce((sum, item) => sum + item, 0);
    const fill = colorToPdf(accent);
    const white = rgb(1, 1, 1);
    page.drawRectangle({ x, y: top - height, width: tableWidth, height, color: fill, borderColor: fill, borderWidth: 0.6 });
    let cellX = x;
    let columnIndex = 0;
    segments.forEach(({ text, span }) => {
      const cellWidth = tableWidth * weights.slice(columnIndex, columnIndex + span).reduce((sum, item) => sum + item, 0) / totalWeight;
      alignedText(page, text, cellX + 3, top - height / 2 - 2, fonts.bold, fontSize, white, cellWidth - 6, "center", reportFonts.table);
      if (columnIndex) page.drawLine({ start: { x: cellX, y: top }, end: { x: cellX, y: top - height }, thickness: 0.35, color: white });
      cellX += cellWidth;
      columnIndex += span;
    });
    page.drawRectangle({ x, y: top - height, width: tableWidth, height, borderColor: fill, borderWidth: 0.6 });
    return top - height - 4;
  }
  function wrappedLines(text, font, size, maxWidth) {
    const words = String(text || "—").replace(/\s+/g, " ").split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    if (lines.length <= 2) return lines;
    const visible = lines.slice(0, 2);
    visible[1] = `${visible[1].slice(0, Math.max(0, visible[1].length - 1))}...`;
    return visible;
  }
  function qrFooterSide(report) {
    const school = report?.school || {};
    const stamp = {
      ...(school.stamp_config && typeof school.stamp_config === "object" ? school.stamp_config : {}),
      ...(report?.stamp_config && typeof report.stamp_config === "object" ? report.stamp_config : {}),
    };
    const position = String(stamp.position || "Bottom Right").toLowerCase().replace(/[\s_-]+/g, "");
    return position === "bottomcenter" ? "right" : "center";
  }
  function splitGradeScale(text) {
    const parts = String(text || "").split(/\s+·\s+/u);
    const midpoint = Math.ceil(parts.length / 2);
    return [parts.slice(0, midpoint).join(" · "), parts.slice(midpoint).join(" · ")];
  }
  async function drawFooter(doc, page, report, fonts, accent, options = {}) {
    const { width } = page.getSize();
    const school = report.school || {};
    const lineAccent = colorToPdf(options.lineAccent || accent);
    if (options.finalPage) {
      const dates = report.term_dates || {};
      const fees = report.fees || {};
      const ink = rgb(0.2, 0.2, 0.22);
      const level = levelCode(report.class?.level);
      const isOLevel = level === "O_LEVEL";
      const isNursery = level === "NURSERY";
      const isPrimary = level === "PRIMARY";
      const gradeKey = options.gradeKey || gradeScale(level, report);
      const dateColumnWidth = (width - 72) / 2;
      drawText(page, `Term Ends On: ${formatReportDate(dates.term_ended_on)}`, 28, 125, fonts.regular, reportFonts.body, ink, dateColumnWidth);
      drawText(page, `Next Term Begins: ${formatReportDate(dates.next_term_begins)}`, width / 2 + 8, 125, fonts.regular, reportFonts.body, ink, dateColumnWidth);
      if (isOLevel) {
        const asAt = formatReportDate(report.printed_at || report.generated_at || new Date());
        const details = `Outstanding school fees balance is UGX ${str(fees.balance)} as at ${asAt} · T = Topic; EOTI = end of term 1`;
        page.drawText(fitted(details, fonts.regular, 9, width - 56), { x: 28, y: 108, size: 9, font: fonts.regular, color: ink });
      } else if (isNursery) {
        const issueDate = formatReportDate(report.printed_at || report.generated_at || new Date());
        const details = `Date of Issue: ${issueDate} · School Requirements: ${str(school.school_requirements)}`;
        page.drawText(fitted(details, fonts.regular, 9, width - 56), { x: 28, y: 108, size: 9, font: fonts.regular, color: ink });
      } else if (isPrimary) {
        // The active grading key below is the only PLE key shown on the card.
      } else {
        const details = `School term/year: ${str(dates.current_term)} / ${str(dates.current_year)} · Next term fees: ${str(dates.next_term_fees)} · Fees balance: ${str(fees.balance)}`;
        page.drawText(fitted(details, fonts.regular, 9, width - 56), { x: 28, y: 108, size: 9, font: fonts.regular, color: ink });
      }
      const gradeText = `GRADING SCALE: ${str(gradeKey)}`;
      if (report.authenticity_qr_data_url) {
        const qrSize = 28.35;
        const qrSide = qrFooterSide(report);
        const qrX = qrSide === "right" ? width - 28 - qrSize : (width - qrSize) / 2;
        const gap = 8;
        const drawLines = (text, x, maxWidth) => wrappedLines(
          text,
          fonts.regular,
          reportFonts.body,
          maxWidth,
        ).slice(0, 2).forEach((line, index) =>
          drawText(page, line, x, 91 - index * 12, fonts.regular, reportFonts.body, ink, maxWidth),
        );
        if (qrSide === "center") {
          const [leftGrades, rightGrades] = splitGradeScale(str(gradeKey));
          drawLines(`GRADING SCALE: ${leftGrades}`, 28, Math.max(80, qrX - 28 - gap));
          if (rightGrades) {
            drawLines(rightGrades, qrX + qrSize + gap, Math.max(60, width - qrX - qrSize - gap - 28));
          }
        } else {
          drawLines(gradeText, 28, Math.max(80, qrX - 28 - gap));
        }
      } else {
        wrappedLines(gradeText, fonts.regular, reportFonts.body, width - 56)
          .slice(0, 2)
          .forEach((line, index) => drawText(page, line, 28, 91 - index * 12, fonts.regular, reportFonts.body, ink, width - 56));
      }

      if (!options.skipRemarks) {
      const remarkTop = 223;
      const remarkHeight = 80;
      const remarks = (options.remarks || [
        ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment],
        ["Head Teacher's Remarks", report.head_teacher_comment],
        ["Principal's Remarks", report.principal_comment],
      ]).slice(0, options.remarkCount === 2 ? 2 : 3)
        .map(([label, content]) => [label, resolvedRemarkContent(label, content, report)]);
      const remarkWidth = (width - 56) / remarks.length;
      const signature = await embedImage(doc, school.report_signature_base64);
      const signatures = Array.isArray(options.signatures) && options.signatures.length
        ? options.signatures
        : ["Class Teacher", "Head Teacher", "Principal"];
      remarks.forEach(([label, content], index) => {
        const x = 28 + index * remarkWidth;
        const signerLabel = signatures[index] || ["Class Teacher", "Head Teacher", "Principal"][index];
        const person = signerLabel === "Class Teacher" ? report.class?.class_teacher_name
          : /principal/i.test(signerLabel) ? school.principal_name
          : /head teacher|head of infants|infant/i.test(signerLabel) ? school.head_of_infants_name || school.head_teacher_name
              : /department/i.test(signerLabel) ? school.head_of_department_name : "";
        const boxBottom = remarkTop - remarkHeight;
        page.drawRectangle({ x, y: boxBottom, width: remarkWidth, height: remarkHeight, borderColor: lineAccent, borderWidth: 0.6, color: color(options.backgroundColor || "#FFFFFF"), opacity: 0.08 });
        drawText(page, label, x + 4, remarkTop - 11, fonts.bold, reportFonts.body, ink, remarkWidth - 8);
        const fittedRemark = fitCompleteText(str(content), fonts.italic, remarkWidth - 8, 2);
        fittedRemark.lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: x + 4,
            y: remarkTop - 25 - lineIndex * 13,
            size: fittedRemark.size,
            font: fonts.italic,
            color: ink,
          });
        });
        page.drawLine({ start: { x: x + 5, y: 177 }, end: { x: x + remarkWidth - 5, y: 177 }, thickness: 0.55, color: lineAccent });
        if (signature && index === signatures.length - 1) placeImage(page, signature, x + (remarkWidth - 58) / 2, 178, 58, 12);
        drawText(page, str(person), x + 5, 165, fonts.bold, reportFonts.body, ink, remarkWidth - 10);
        drawText(page, signerLabel, x + 5, 150, fonts.regular, reportFonts.body, ink, remarkWidth - 10);
      });
      }
    }
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const pageNumber = doc.getPages().indexOf(page) + 1;
    const pageLabel = `Page ${pageNumber} of ${doc.getPages().length}`;
    if (address || school.website || school.report_footer_text) {
      const ink = rgb(0.32, 0.32, 0.34);
      const drawFooterLines = (text, x, maxWidth) => wrappedLines(
        text,
        fonts.regular,
        reportFonts.body,
        maxWidth,
      ).slice(0, 2).forEach((line, lineIndex) => drawText(
        page,
        line,
        x,
        63 - lineIndex * 9,
        fonts.regular,
        reportFonts.body,
        ink,
        maxWidth,
      ));
      if (report.authenticity_qr_data_url) {
        const qrSize = 28.35;
        const qrSide = qrFooterSide(report);
        const qrX = qrSide === "right" ? width - 28 - qrSize : (width - qrSize) / 2;
        if (qrSide === "center") {
          drawFooterLines(str(address), 30, Math.max(80, qrX - 40));
          drawFooterLines(str(school.website || school.report_footer_text), qrX + qrSize + 8, Math.max(60, width - qrX - qrSize - 38));
        } else {
          const contact = [address, school.website || school.report_footer_text].filter(Boolean).join(" · ");
          drawFooterLines(str(contact), 30, Math.max(80, qrX - 40));
        }
      } else {
        drawFooterLines(str(address), 30, width * 0.58);
        drawFooterLines(str(school.website || school.report_footer_text), width * 0.62, width * 0.34);
      }
    }
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: 24, color: colorToPdf(accent) });
    const footerTextColor = rgb(1, 1, 1);
    const footerLevel = levelCode(report.class?.level);
    const leftFooter = footerLevel === "NURSERY"
      ? `Next term: ${formatReportDate(report.term_dates?.next_term_begins)}`
      : school.name || "School";
    const footerNameLayout = fitCompleteTextInBox(str(leftFooter), fonts.bold, 140, 18, reportFonts.body, 4);
    if (!footerNameLayout.fits) throw new Error("The school name is too long to fit in the report-card footer without truncation.");
    const footerNameHeight = footerNameLayout.lines.length * footerNameLayout.lineHeight;
    const footerNameBaseline = 28 + (24 - footerNameHeight) / 2 + 1;
    footerNameLayout.lines.forEach((line, index) => page.drawText(line, {
      x: 32,
      y: footerNameBaseline + (footerNameLayout.lines.length - index - 1) * footerNameLayout.lineHeight,
      size: footerNameLayout.size,
      font: fonts.bold,
      color: footerTextColor,
    }));
    centered(page, str(school.motto || ""), width / 2, 36, fonts.regular, reportFonts.body, footerTextColor, width - 230);
    drawText(page, pageLabel, width - 122, 36, fonts.bold, reportFonts.body, footerTextColor, 90);
    const footerNoteY = 13;
    const footerContentWidth = width - 56;
    const disclaimerWidth = footerContentWidth * 0.58;
    const noteGap = footerContentWidth * 0.04;
    const poweredWidth = footerContentWidth * 0.38;
    const footerNoteSize = 5;
    const disclaimer = "This report is invalid without the official school stamp.";
    const poweredBy = "Powered by AP SHULE TECHNOLOGIES";
    const disclaimerTextWidth = fonts.italic.widthOfTextAtSize(disclaimer, footerNoteSize);
    const poweredTextWidth = fonts.regular.widthOfTextAtSize(poweredBy, footerNoteSize);
    page.drawText(disclaimer, {
      x: 28 + Math.max(0, (disclaimerWidth - disclaimerTextWidth) / 2),
      y: footerNoteY,
      size: footerNoteSize,
      font: fonts.italic,
      color: lineAccent,
    });
    page.drawText(poweredBy, {
      x: 28 + disclaimerWidth + noteGap + Math.max(0, (poweredWidth - poweredTextWidth) / 2),
      y: footerNoteY,
      size: footerNoteSize,
      font: fonts.regular,
      color: lineAccent,
    });
  }
  async function drawAllFooters(doc, report, fonts, accent, options = {}) {
    const pages = doc.getPages();
    for (const [index, page] of pages.entries()) {
      await drawFooter(doc, page, report, fonts, accent, { ...options, finalPage: index === pages.length - 1 });
    }
  }
  function marks(report) {
    return (report.subjects || []).map((subject) => {
      const source = subject && typeof subject === "object" ? subject : {};
      const nestedMark = source.mark && typeof source.mark === "object" ? source.mark : {};
      return {
        subject: source,
        mark: { ...source, ...nestedMark },
      };
    });
  }
  function printableValue(value) {
    if (value === null || value === undefined) return "";
    const text = String(value).trim();
    return ["-", "—", "–", "-/-", "/-"].includes(text) ? "" : text;
  }
  function ordinalPosition(value) {
    const normalized = printableValue(value);
    if (!normalized) return "";
    if (/[a-z]/i.test(normalized)) return normalized;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return normalized;
    const remainder100 = parsed % 100;
    const suffix = remainder100 >= 11 && remainder100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[parsed % 10] || "th");
    return `${parsed}${suffix}`;
  }
  function reportClassSize(report) {
    for (const value of [
      report?.summary?.class_size,
      report?.summary_class_size,
      report?.summary_out_of,
      report?.class_size,
    ]) {
      const normalized = printableValue(value);
      if (normalized) return normalized;
    }
    return "";
  }
  function numericMarkValue(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function scoreForMark(mark, report) {
    const period = assessmentPeriod(report);
    const selectedValues = period.key === "EOT"
      ? [mark?.pct100, mark?.period_score]
      : [mark?.period_score, periodScore(mark, period), mark?.pct100];
    for (const value of selectedValues) {
      const parsed = numericMarkValue(value);
      if (parsed !== null) return parsed;
    }
    if (period.key !== "EOT") return null;
    const eotValues = [
      periodValue(mark, "eot_period", period),
      periodValue(mark, "eot", period),
      mark?.eot_period,
      mark?.eot,
      mark?.exam_score,
    ];
    for (const value of eotValues) {
      const parsed = numericMarkValue(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }
  function gradeForScore(score, report) {
    if (score === null) return "";
    const scaleValue = report?.grading_scale;
    const rows = Array.isArray(scaleValue)
      ? scaleValue
      : Array.isArray(scaleValue?.rows) ? scaleValue.rows : [];
    const matchingRow = rows.find((row) => {
      const minimum = numericMarkValue(row?.min_score ?? row?.min);
      const maximum = numericMarkValue(row?.max_score ?? row?.max);
      return minimum !== null && maximum !== null && score >= minimum && score <= maximum;
    });
    const configuredGrade = printableValue(matchingRow?.grade_code ?? matchingRow?.grade);
    if (configuredGrade) return configuredGrade;

    const level = levelCode(report?.class?.level);
    if (level === "NURSERY") return "";
    const thresholds = level === "A_LEVEL"
      ? [[75, "A"], [65, "B"], [50, "C"], [35, "D"], [0, "E"]]
      : [[80, "A"], [70, "B"], [60, "C"], [50, "D"], [0, "E"]];
    return thresholds.find(([minimum]) => score >= minimum)?.[1] || "E";
  }
  function overallAverage(report) {
    const summary = report?.summary || {};
    for (const value of [
      summary.overall_average,
      summary.average,
      report?.overall_average,
      report?.average,
    ]) {
      const parsed = numericMarkValue(value);
      if (parsed !== null) return parsed;
    }
    const scores = marks(report)
      .map(({ mark }) => scoreForMark(mark, report))
      .filter((score) => score !== null);
    if (!scores.length) return null;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length + Number.EPSILON) * 100) / 100;
  }
  function overallResultMetric(report) {
    const summary = report?.summary || {};
    const metric = summary.result_metric ??
      report?.primary_result_metric ??
      report?.school?.primary_result_metric;
    if (levelCode(report?.class?.level) === "PRIMARY" && metric === "ple_aggregate") {
      const aggregate = numericMarkValue(summary.aggregate);
      const division = printableValue(summary.aggregate_division);
      const value = aggregate === null
        ? "—"
        : `${num(aggregate)}${division ? ` · ${division.replace(/^Division\s+/u, "Div ")}` : ""}`;
      return ["PLE Aggregate", value];
    }
    return ["Average", num(overallAverage(report))];
  }
  function overallGrade(report) {
    const summaryGrade = printableValue(report?.summary?.overall_grade ?? report?.overall_grade);
    return summaryGrade || gradeForScore(overallAverage(report), report) || "—";
  }
  function positionValue(mark, report) {
    for (const value of [
      mark?.position,
      mark?.class_position,
      mark?.rank,
      report?.summary_position,
      report?.summary?.position,
      report?.position,
    ]) {
      const normalized = ordinalPosition(value);
      if (normalized) return normalized;
    }
    if (reportClassSize(report) === "1") return "1st";
    return "";
  }
  function classSizeValue(mark, report) {
    for (const value of [
      mark?.class_size,
      report?.summary?.class_size,
      report?.summary_class_size,
      report?.summary_out_of,
      report?.class_size,
    ]) {
      const normalized = printableValue(value);
      if (normalized) return normalized;
    }
    return "";
  }
  function overallPositionValue(report) {
    const summaryPosition = positionValue({}, report);
    if (summaryPosition) return summaryPosition;
    return marks(report)
      .map(({ mark }) => positionValue(mark, {}))
      .find(Boolean) || "";
  }
  function overallClassSizeValue(report) {
    const summarySize = reportClassSize(report);
    if (summarySize) return summarySize;
    return marks(report).map(({ mark }) => printableValue(mark?.class_size)).find(Boolean) || "";
  }
  function subjectRemark(mark, report) {
    for (const value of [
      mark?.tr,
      mark?.teacher_remark,
      mark?.subject_remark,
      mark?.remark,
      mark?.descriptor,
      mark?.grade_desc,
      mark?.auto_remark,
    ]) {
      const normalized = printableValue(value);
      if (normalized) return normalized;
    }
    const score = scoreForMark(mark, report);
    const grade = (
      printableValue(mark?.grade) ||
      printableValue(mark?.grade_code) ||
      gradeForScore(score, report)
    ).toUpperCase();
    if (/^(A|D1|D2|C3|3|2A)$/u.test(grade) || (score !== null && score >= 80)) return "Excellent achievement";
    if (/^(B|C4|C5|C6|2)$/u.test(grade) || (score !== null && score >= 70)) return "Very good progress";
    if (/^(C|P7|2B)$/u.test(grade) || (score !== null && score >= 60)) return "Satisfactory progress";
    if (/^(D|P8|1A)$/u.test(grade) || (score !== null && score >= 50)) return "Developing";
    if (score !== null || grade) return "Needs improvement";
    return "—";
  }
  function overallPerformance(report) {
    const grade = overallGrade(report).toUpperCase();
    const average = overallAverage(report);
    if (/^(A|D1|D2|3|2A)$/u.test(grade) || (average !== null && average >= 80)) return "excellent";
    if (/^(B|C3|C4|C5|C6|2)$/u.test(grade) || (average !== null && average >= 70)) return "very good";
    if (/^(C|2B)$/u.test(grade) || (average !== null && average >= 60)) return "satisfactory";
    if (/^(D|1A)$/u.test(grade) || (average !== null && average >= 50)) return "developing";
    return average === null ? "" : "needs improvement";
  }
  function autoOverallRemark(report, audience) {
    const average = overallAverage(report);
    if (average === null) return "";
    const learnerName = printableValue(report?.learner?.full_name).split(/\s+/u)[0] || "The learner";
    const performance = overallPerformance(report) || "steady";
    const formattedAverage = average.toFixed(1);
    if (audience === "principal") {
      return `The school commends ${learnerName} for ${performance} performance and an overall average of ${formattedAverage}.`;
    }
    if (audience === "teacher") {
      return `${learnerName} has shown ${performance} progress this term, with an overall average of ${formattedAverage}. Keep it up.`;
    }
    return `${learnerName} has attained an overall average of ${formattedAverage} with ${performance} academic progress.`;
  }
  function resolvedRemarkContent(label, content, report) {
    if (printableValue(content)) return content;
    const key = String(label || "").toLowerCase();
    if (/class teacher/u.test(key)) return autoOverallRemark(report, "teacher") || content;
    if (/principal/u.test(key)) return autoOverallRemark(report, "principal") || content;
    if (/head teacher|head of infants|infant/u.test(key)) return autoOverallRemark(report, "head") || content;
    return content;
  }
  function reportPositionEnabled(report, meta = null) {
    const setting = report?.school?.show_report_position ?? report?.show_report_position;
    const templateHidesPosition = levelCode(report?.class?.level) === "PRIMARY" && String(meta?.id ?? "") === "3";
    return setting !== false && setting !== "false" && !templateHidesPosition;
  }
  function isLowerPrimaryReport(report = {}) {
    const level = levelCode(report.class?.level || report.level);
    const className = String(report.class?.name || report.class_name || "").toUpperCase().replace(/[^A-Z0-9]/gu, "");
    return level === "PRIMARY" && /^(?:P|PRIMARY)[1-3]$/u.test(className);
  }
  function lowerPrimaryLetterGrade(mark = {}, report = {}) {
    const score = scoreForMark(mark, report);
    if (score === null) {
      const stored = printableValue(mark.grade || mark.grade_code);
      return /^[A-E]$/u.test(stored) ? stored : "—";
    }
    const rows = Array.isArray(report.grading_scale) ? report.grading_scale
      : Array.isArray(report.active_grading_scale?.rows) ? report.active_grading_scale.rows
        : [];
    const activeLetter = rows.find((row) => {
      const code = String(row.grade_code ?? row.code ?? "").trim().toUpperCase();
      return /^[A-E]$/u.test(code)
        && score >= Number(row.min_score ?? row.min)
        && score <= Number(row.max_score ?? row.max);
    });
    if (activeLetter) return String(activeLetter.grade_code ?? activeLetter.code).trim().toUpperCase();
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "E";
  }
  const defaultOtherSubjects = ["Handwriting", "Art & Drawing", "P.E & Games", "Music", "Luganda", "Religious Education"];
  function coCurricular(report, includeDefaults = false) {
    const rows = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const result = rows.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.progress ?? item.score,
      item.remark || item.descriptor,
      item.signature || item.teacher_initials,
    ]);
    if (includeDefaults && !report.co_curricular_configured && result.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(result.length).forEach((name) => result.push([name, "", "", ""]));
    }
    return result;
  }
  const nurseryActivityDefaults = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits"];
  const nurseryLearningAreaDefaults = [
    "Taking care of myself for proper growth and development",
    "Interacting, exploring, knowing and using my environment",
    "Relating with others in an acceptable way",
    "Developing and using my Language appropriately",
    "Developing and using Mathematical Concepts in my day-to-day",
  ];
  const nurseryActivityIconKeys = [
    "writing", "listening", "reading", "speaking", "drawing",
    "games", "rhymes_stories", "music", "health_habits", "toilet_habits",
  ];
  const nurseryIconBytesCache = new Map();
  async function embedNurseryIcon(doc, key) {
    if (!nurseryIconBytesCache.has(key)) {
      const pending = (async () => {
        try {
          const response = await fetch(`/pdf-templates/nursery-icons/${key}.png`, { cache: "force-cache" });
          if (!response.ok) return null;
          return new Uint8Array(await response.arrayBuffer());
        } catch {
          return null;
        }
      })();
      nurseryIconBytesCache.set(key, pending);
    }
    const bytes = await nurseryIconBytesCache.get(key);
    return bytes ? doc.embedPng(bytes) : null;
  }
  function nurseryWrappedLayout(text, font, width, height, preferredSize, minimumSize = 5.5, leading = 1.15) {
    for (let size = preferredSize; size >= minimumSize; size -= 0.5) {
      const lines = completeWrappedLines(str(text), font, size, width);
      const lineHeight = size * leading;
      if (lines.length * lineHeight <= height) return { lines, size, lineHeight };
    }
    const size = minimumSize;
    return { lines: completeWrappedLines(str(text), font, size, width), size, lineHeight: size * leading };
  }
  function drawNurseryWrappedText(page, text, x, top, width, height, font, preferredSize, ink, align = "left", minimumSize = 5.5) {
    const layout = nurseryWrappedLayout(text, font, width, height, preferredSize, minimumSize);
    layout.lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, layout.size);
      const drawX = align === "center" ? x + Math.max(0, (width - textWidth) / 2)
        : align === "right" ? x + Math.max(0, width - textWidth) : x;
      page.drawText(line, {
        x: drawX,
        y: top - layout.size - index * layout.lineHeight,
        size: layout.size,
        font,
        color: ink,
      });
    });
    return layout;
  }
  function nurseryActivityItems(report) {
    const source = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.learning_activities) ? report.learning_activities
        : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const items = source.map((item, index) => ({
      name: item.activity_name || item.name || item.subject_name || item.subject?.name || nurseryActivityDefaults[index] || `Activity ${index + 1}`,
      remark: item.remark || item.descriptor || item.teacher_remark || "",
      image: item.image_base64 || item.illustration_base64 || item.photo_base64 || "",
    }));
    const names = new Set(items.map((item) => String(item.name).trim().toLowerCase()));
    if (!report.co_curricular_configured) nurseryActivityDefaults.forEach((name) => {
      if (items.length < nurseryActivityDefaults.length && !names.has(name.toLowerCase())) {
        items.push({ name, remark: "", image: "" });
      }
    });
    return items.slice(0, nurseryActivityDefaults.length);
  }
  function nurserySchoolIcon(report, name) {
    const icons = report.school?.activity_icons;
    const normalized = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const row = Array.isArray(icons)
      ? icons.find((item) => String(item.activity_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === normalized)
      : icons?.[name];
    return row?.icon_base64 || row?.icon || "";
  }
  function primaryOtherSubjectRows(report, includeDefaults = true) {
    const source = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = source.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.grade || item.identifier || item.progress || item.score,
      item.remark || item.descriptor || item.teacher_remark,
      item.teacher_initials || item.initials || item.signature,
    ]);
    if (includeDefaults && !report.co_curricular_configured && rows.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(rows.length).forEach((name) => rows.push([name, "", "", ""]));
    }
    return rows;
  }
  function promotionStatus(report) {
    const decision = report.promotion_decision || report.promotion?.promotion_decision
      || report.suggested_decision || report.promotion?.suggested_decision;
    if (decision === "promoted") return `STATUS: PROMOTED TO ${str(report.promotion_next_class || report.promotion?.next_class || "NEXT CLASS")}`;
    if (decision === "repeat") return `STATUS: ADVISED TO REPEAT ${str(report.promotion_current_class || report.promotion?.current_class || report.class?.name || "CURRENT CLASS")}`;
    if (decision === "try_another") return "STATUS: TRY ANOTHER CLASS";
    return "STATUS: —";
  }
  function isOfficialPle(report = {}) {
    const presetKey = report.grading_scale_preset_key
      ?? report.active_grading_scale?.preset_key
      ?? report.grading_scale?.preset_key;
    return report.ple_official_enabled === true || presetKey === "primary_ple_upper";
  }
  function gradeScale(level, report = {}) {
    const scaleRows = Array.isArray(report.grading_scale)
      ? report.grading_scale
      : Array.isArray(report.grading_scale?.rows) ? report.grading_scale.rows : [];
    const usesOfficialPle = isOfficialPle(report);
    const rows = scaleRows;
    const custom = rows.map((row) => {
      const code = str(row.grade_code);
      const min = Number(row.min_score ?? row.min_mark);
      const max = Number(row.max_score ?? row.max_mark);
      if (!code || !Number.isFinite(min) || !Number.isFinite(max)) return "";
      const score = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
      const points = row.points === null || row.points === undefined || row.points === ""
        ? ""
        : ` (${str(row.points)} pt${Number(row.points) === 1 ? "" : "s"})`;
      const description = str(row.descriptor);
      return `${code} ${score(min)}–${score(max)}${points}${description ? ` ${description}` : ""}`;
    }).filter(Boolean);
    if (usesOfficialPle) {
      const compact = rows.map((row) => {
        const code = str(row.grade_code);
        const min = Number(row.min_score ?? row.min_mark);
        const max = Number(row.max_score ?? row.max_mark);
        const points = Number(row.points);
        if (!code || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(points)) return "";
        const score = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
        return `${code} ${score(min)}–${score(max)}=${points}`;
      }).filter(Boolean);
      return compact.length ? `UNEB PLE: ${compact.join(", ")}` : "UNEB PLE grading scale unavailable";
    }
    if (custom.length) {
      const pointsScheme = report.grading_points_scheme || {};
      const mapText = (key) => {
        const values = pointsScheme[key] || {};
        return ["A", "B", "C", "D", "E", "O", "F"]
          .filter((grade) => values[grade] !== undefined)
          .map((grade) => `${grade}${str(values[grade])}`)
          .join("/");
      };
      const legacyPoints = report.grading_scale_preset_key === "a_level_legacy"
        ? ` · Principal ${mapText("principal")} · Subsidiary ${mapText("subsidiary")}`
        : "";
      const composition = report.grading_scale_preset_key === "a_level_uace_cbc"
        ? " · 20% CA + 80% Exams"
        : "";
      return `${custom.join(" · ")}${legacyPoints}${composition}`;
    }
    if (level === "NURSERY") return "Learning areas are assessed by descriptor";
    return level === "A_LEVEL"
      ? "A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34"
      : "A 80–100 · B 70–79 · C 60–69 · D 50–59 · E 0–49";
  }
  function gradeLabel(mark = {}, report = {}, includePoints = true) {
    const grade = isLowerPrimaryReport(report)
      ? lowerPrimaryLetterGrade(mark, report)
      : printableValue(mark.grade) || gradeForScore(scoreForMark(mark, report), report);
    const overall = printableValue(mark.overall_grade_code);
    const pointsValue = includePoints ? printableValue(mark.points) : "";
    const points = pointsValue ? ` (${pointsValue})` : "";
    if (overall) return `${grade ? `${grade}/` : ""}${overall}${points}`;
    return `${grade}${points}` || "—";
  }
  const asReport = (learnerOrReport, school, marksData) =>
    school
      ? { ...(marksData || {}), learner: learnerOrReport, school }
      : learnerOrReport;
  async function prepare(report, level, title, meta = null) {
    if (!PDFDocument) throw new Error("The PDF library is unavailable; check your connection and reload.");
    const doc = await PDFDocument.create();
    doc.setTitle(`${title} — ${str(report.learner?.full_name)}`);
    doc.setAuthor(str(report.school?.name));
    const size = portrait;
    const page = doc.addPage(size);
    await drawPageWatermark(doc, page, report);
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    const theme = window.ReportCardThemeEngine?.getTheme(level, report.level_theme || report.school?.level_theme, report.school) || {
      primary_color: level === "NURSERY" ? "#8BC34A" : level === "PRIMARY" ? "#1E5EB5" : level === "O_LEVEL" ? "#7B1FA2" : "#4B2E9E",
      accent_color: level === "NURSERY" ? "#DCEDC8" : level === "PRIMARY" ? "#BBDEFB" : level === "O_LEVEL" ? "#E1BEE7" : "#D1C4E9",
      background_color: "#F7F6FA",
    };
    const primary = color(theme.primary_color);
    const lineAccent = color(theme.accent_color);
    const headerY = await drawHeader(doc, page, report, fonts, theme, title, meta);
    const y = ["O_LEVEL", "A_LEVEL"].includes(level) ? drawPromotionBanner(page, report, fonts, headerY) : headerY;
    return { doc, page, fonts, accent: primary, primary, lineAccent, backgroundColor: theme.background_color, theme, y, size };
  }

  async function renderNursery(learnerOrReport, school, marksData, meta = null) {
    const report = asReport(learnerOrReport, school, marksData);
    const period = assessmentPeriod(report);
    const { doc, page, fonts, theme, y } = await prepare(report, "NURSERY", `${period.title} Nursery Learning Report`, meta);
    const width = page.getWidth();
    const x = 28;
    const contentWidth = width - 56;
    const gap = 8;
    const leftWidth = (contentWidth - gap) * 0.6;
    const rightWidth = contentWidth - gap - leftWidth;
    const rightX = x + leftWidth + gap;
    const sourceEntries = marks(report);
    const entryByName = new Map(sourceEntries.map((entry) => [
      String(entry.subject.name || "").toLowerCase().replace(/[^a-z0-9]+/g, ""),
      entry,
    ]));
    const entries = nurseryLearningAreaDefaults.map((name, index) => {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return entryByName.get(normalizedName) || sourceEntries[index] || {
        subject: { name },
        mark: {},
      };
    });
    const combinedPeriod = period.key === "COMBINED_BM";
    const sourceActivities = nurseryActivityItems(report);
    const activityByName = new Map(sourceActivities.map((item) => [
      String(item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, ""),
      item,
    ]));
    const activities = nurseryActivityDefaults.map((name, index) =>
      activityByName.get(name.toLowerCase().replace(/[^a-z0-9]+/g, ""))
      || sourceActivities[index]
      || { name, remark: "", image: "" },
    );
    const top = y;
    const sectionHeight = 24;
    const headerHeight = 18;
    const totalHeight = 19;
    const rowHeight = Math.max(35, Math.min(47, (top - sectionHeight - headerHeight - 305) / 5));
    const leftHeaderY = top - sectionHeight;
    const rowTopStart = leftHeaderY - headerHeight;
    const tableBottom = rowTopStart - rowHeight * 5;
    const maroon = color("#800000");
    const gold = color("#D4AF37");
    const border = maroon;
    const pale = color("#FFF8F7");
    const ink = rgb(0.17, 0.18, 0.2);
    const white = rgb(1, 1, 1);
    if (meta) variantRule(page, page.getHeight() - 150, width, meta);

    const panelTitle = (panelX, panelWidth, label, size) => {
      page.drawRectangle({ x: panelX, y: top - sectionHeight, width: panelWidth, height: sectionHeight, color: white, borderColor: maroon, borderWidth: 0.7, opacity: 0.1 });
      drawNurseryWrappedText(page, label, panelX + 5, top - 3, panelWidth - 10, sectionHeight - 5, fonts.bold, size, maroon, "center", 7);
    };
    panelTitle(x, leftWidth, `ACHIEVEMENT SCORES — ${period.title}`, 10);
    panelTitle(rightX, rightWidth, "PERFORMANCE IN THE LEARNING ACTIVITIES", 9.5);

    page.drawRectangle({ x, y: rowTopStart, width: leftWidth, height: headerHeight, color: white, borderColor: border, borderWidth: 0.55, opacity: 0.45 });
    const areaWidths = combinedPeriod
      ? [leftWidth * 0.31, leftWidth * 0.10, leftWidth * 0.10, leftWidth * 0.10, leftWidth * 0.08, leftWidth * 0.22, leftWidth * 0.09]
      : [leftWidth * 0.48, leftWidth * 0.38, leftWidth * 0.14];
    const areaHeads = combinedPeriod
      ? ["Area", "B.O.T", "Midterm", "Average", "Grade", "Teacher's Remark", "Signature"]
      : ["Area", period.fields[0]?.label || "E.O.T", "Signature"];
    let headerX = x;
    areaHeads.forEach((label, index) => {
      drawNurseryWrappedText(page, label, headerX + 3, rowTopStart + headerHeight - 3, areaWidths[index] - 6, headerHeight - 5, fonts.bold, 8.5, maroon, "center", 6.5);
      if (index) page.drawLine({ start: { x: headerX, y: rowTopStart + headerHeight }, end: { x: headerX, y: rowTopStart }, thickness: 0.5, color: border });
      headerX += areaWidths[index];
    });
    let rowTop = rowTopStart;
    const maxScore = 500;
    const calculatedScored = entries.reduce((sum, { mark }) => {
      const parsed = periodScore(mark, period);
      return parsed === null ? sum : sum + parsed;
    }, 0);
    const scored = combinedPeriod
      ? calculatedScored
      : (report.summary?.total_score ?? calculatedScored);
    entries.forEach(({ subject, mark }, index) => {
      const rowBottom = rowTop - rowHeight;
      page.drawRectangle({ x, y: rowBottom, width: leftWidth, height: rowHeight, color: index % 2 ? white : pale, borderColor: border, borderWidth: 0.45, opacity: 0.08 });
      let cellX = x;
      areaWidths.slice(0, -1).forEach((cellWidth) => {
        cellX += cellWidth;
        page.drawLine({ start: { x: cellX, y: rowTop }, end: { x: cellX, y: rowBottom }, thickness: 0.4, color: border });
      });
      const name = str(subject.name || `Learning Area ${index + 1}`);
      const description = subject.learning_area_description || subject.description || subject.learning_outcome || subject.details || "";
      const remark = subjectRemark(mark, report);
      if (combinedPeriod) {
        drawNurseryWrappedText(page, name, x + 3, rowTop - 3, areaWidths[0] - 6, 12, fonts.bold, 7, ink, "left", 5.5);
        drawNurseryWrappedText(page, description, x + 3, rowTop - 16, areaWidths[0] - 6, rowHeight - 17, fonts.regular, 5.9, ink, "left", 4.8);
        let valueX = x + areaWidths[0];
        period.fields.forEach(({ key }) => {
          const value = periodValue(mark, key, period);
          drawNurseryWrappedText(page, value === null ? "—" : num(value), valueX + 1, rowTop - 3, areaWidths[1] - 2, rowHeight - 5, fonts.bold, 6.7, maroon, "center", 5.2);
          valueX += areaWidths[1];
        });
        const average = periodScore(mark, period);
        drawNurseryWrappedText(page, average === null ? "—" : num(average), valueX + 1, rowTop - 3, areaWidths[3] - 2, rowHeight - 5, fonts.bold, 6.7, maroon, "center", 5.2);
        valueX += areaWidths[3];
        const configuredGrade = gradeForScore(average, report) || printableValue(mark.grade || mark.grade_code);
        drawNurseryWrappedText(page, configuredGrade || "—", valueX + 1, rowTop - 3, areaWidths[4] - 2, rowHeight - 5, fonts.bold, 6.3, maroon, "center", 5);
        valueX += areaWidths[4];
        drawNurseryWrappedText(page, remark === "—" ? "" : remark, valueX + 2, rowTop - 3, areaWidths[5] - 4, rowHeight - 5, fonts.italic, 6.2, ink, "left", 4.8);
      } else {
        drawNurseryWrappedText(page, name, x + 5, rowTop - 3, areaWidths[0] - 10, 19, fonts.bold, 8.5, ink, "center", 6);
        if (description) {
          drawNurseryWrappedText(page, description, x + 5, rowTop - 21, areaWidths[0] - 10, rowHeight - 23, fonts.regular, 7.8, ink, "center", 5.5);
        }
        const score = periodScore(mark, period);
        const scoreText = score === null ? "SCORE: —" : `SCORE: ${Number.isInteger(score) ? score : num(score, 1)}`;
        const scoreX = x + areaWidths[0];
        const scoreWidth = areaWidths[1];
        drawNurseryWrappedText(page, scoreText, scoreX + 4, rowTop - 8, scoreWidth - 8, 12, fonts.bold, 9.5, maroon, "center", 7);
        drawNurseryWrappedText(page, remark === "—" ? "" : `Remark: ${remark}`, scoreX + 5, rowTop - 23, scoreWidth - 10, rowHeight - 26, fonts.italic, 7.7, ink, "center", 5.2);
      }
      const signX = x + areaWidths.slice(0, -1).reduce((sum, value) => sum + value, 0);
      page.drawLine({ start: { x: signX + 3, y: rowBottom + 8 }, end: { x: signX + areaWidths[areaWidths.length - 1] - 3, y: rowBottom + 8 }, thickness: 0.45, color: border });
      rowTop = rowBottom;
    });
    const totalTop = rowTop;
    const totalFill = maroon;
    page.drawRectangle({ x, y: totalTop - totalHeight, width: leftWidth, height: totalHeight, color: totalFill, borderColor: totalFill, borderWidth: 0.5 });
    const showPosition = reportPositionEnabled(report, meta);
    const totals = [`TOTAL: ${num(maxScore, 0)}`, `SCORED: ${num(scored, 0)}`, ...(showPosition ? [`POSITION: ${overallPositionValue(report) || "—"} OUT OF ${overallClassSizeValue(report) || "—"}`] : [])];
    let totalX = x;
    const totalWidths = showPosition
      ? [leftWidth * 0.25, leftWidth * 0.27, leftWidth * 0.48]
      : [leftWidth * 0.5, leftWidth * 0.5];
    totals.forEach((label, index) => {
      drawNurseryWrappedText(page, label, totalX + 2, totalTop - 3, totalWidths[index] - 4, totalHeight - 5, fonts.bold, 8.2, white, "center", 6.3);
      if (index) page.drawLine({ start: { x: totalX, y: totalTop }, end: { x: totalX, y: totalTop - totalHeight }, thickness: 0.4, color: white });
      totalX += totalWidths[index];
    });

    const activityColumns = 2;
    const cardHeight = (top - sectionHeight - tableBottom) / 5;
    const cardWidth = rightWidth / activityColumns;
    for (let index = 0; index < activities.length; index += 1) {
      const item = activities[index];
      const column = index % activityColumns;
      const row = Math.floor(index / activityColumns);
      const cardX = rightX + column * cardWidth;
      const cardTop = top - sectionHeight - row * cardHeight;
      const cardBottom = cardTop - cardHeight;
      page.drawRectangle({ x: cardX, y: cardBottom, width: cardWidth, height: cardHeight, color: index % 2 ? white : pale, borderColor: border, borderWidth: 0.45, opacity: 0.08 });
      const iconSize = Math.min(27, cardHeight - 10, cardWidth * 0.25);
      const iconX = cardX + 5;
      const iconY = cardBottom + (cardHeight - iconSize) / 2;
      const schoolIcon = nurserySchoolIcon(report, item.name || nurseryActivityDefaults[index]);
      const customImage = schoolIcon
        ? await embedImage(doc, schoolIcon)
        : item.image ? await embedImage(doc, item.image) : null;
      const icon = customImage || await embedNurseryIcon(doc, nurseryActivityIconKeys[index]);
      if (icon) {
        placeImage(page, icon, iconX, iconY, iconSize, iconSize);
      } else {
        page.drawEllipse({ x: iconX + iconSize / 2, y: iconY + iconSize / 2, xScale: iconSize / 2, yScale: iconSize / 2, color: pale, borderColor: maroon, borderWidth: 1 });
        centered(page, String(index + 1), iconX + iconSize / 2, iconY + iconSize / 2 - 2, fonts.bold, 8, maroon, iconSize - 4);
      }
      const textX = iconX + iconSize + 5;
      const textWidth = cardWidth - iconSize - 15;
      const configuredName = String(item.name || nurseryActivityDefaults[index]).trim();
      const defaultName = nurseryActivityDefaults[index];
      const displayName = configuredName.toLowerCase().replace(/[^a-z0-9]+/g, "")
        === defaultName.toLowerCase().replace(/[^a-z0-9]+/g, "")
        ? defaultName
        : `${defaultName} / ${configuredName}`;
      drawNurseryWrappedText(page, displayName.toUpperCase(), textX, cardTop - 4, textWidth, 18, fonts.bold, 8, maroon, "left", 5.8);
      if (item.remark) {
        drawNurseryWrappedText(page, item.remark, textX, cardTop - 23, textWidth, cardHeight - 27, fonts.italic, 7.4, ink, "left", 5.2);
      }
    }
    const remarks = [
      ["Class Teacher's Report", resolvedRemarkContent("Class Teacher's Report", report.class_teacher_comment || report.suggested_comment, report), report.class?.class_teacher_name],
      ["Behaviors / Cleanliness", report.behaviors_comment || report.behaviour_comment || report.cleanliness_comment || "Good behavior and maintains cleanliness.", report.behaviors_teacher_name || report.class?.class_teacher_name],
      ["Head Teacher's Comment", resolvedRemarkContent("Head Teacher's Comment", report.head_of_infants_comment || report.head_teacher_comment, report), report.school?.head_of_infants_name || report.school?.head_teacher_name],
    ];
    const remarkTop = totalTop - totalHeight - 12;
    const remarkHeight = Math.min(31, (remarkTop - 158) / remarks.length);
    const labelWidth = 112;
    const signatureWidth = 86;
    remarks.forEach(([label, content, signer], index) => {
      const rowTop = remarkTop - index * remarkHeight;
      const rowBottom = rowTop - remarkHeight;
      page.drawRectangle({ x, y: rowBottom, width: contentWidth, height: remarkHeight, color: white, borderColor: maroon, borderWidth: 0.55, opacity: 0.08 });
      page.drawLine({ start: { x: x + labelWidth, y: rowTop }, end: { x: x + labelWidth, y: rowBottom }, thickness: 0.45, color: maroon });
      page.drawLine({ start: { x: x + contentWidth - signatureWidth, y: rowTop }, end: { x: x + contentWidth - signatureWidth, y: rowBottom }, thickness: 0.45, color: maroon });
      drawNurseryWrappedText(page, label, x + 4, rowTop - 4, labelWidth - 8, remarkHeight - 6, fonts.bold, 7.8, ink, "left", 5.5);
      if (content) {
        drawNurseryWrappedText(page, content, x + labelWidth + 5, rowTop - 4, contentWidth - labelWidth - signatureWidth - 10, remarkHeight - 6, fonts.italic, 8.2, ink, "left", 5.5);
      }
      if (signer) {
        drawNurseryWrappedText(page, signer, x + contentWidth - signatureWidth + 4, rowTop - 4, signatureWidth - 8, remarkHeight - 6, fonts.bold, 7.5, ink, "right", 5.5);
      }
    });
    await drawFooter(doc, page, report, fonts, "#800000", {
      finalPage: true,
      skipRemarks: true,
      lineAccent: "#800000",
    });
    return doc.save();
  }

  async function renderPrimary(learnerOrReport, school, marksData, meta = null) {
    const report = asReport(learnerOrReport, school, marksData);
    if (isOfficialPle(report) && Array.isArray(report.incomplete_marks) && report.incomplete_marks.length) {
      throw new Error(`Incomplete marks: ${report.incomplete_marks.join(", ")}`);
    }
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, "PRIMARY", "Primary School Report");
    const entries = marks(report);
    const period = assessmentPeriod(report);
    const showOverallPosition = reportPositionEnabled(report, meta);
    const isPle = isOfficialPle(report);
    const ordinal = (input) => {
      if (input === null || input === undefined || input === "") return "—";
      if (typeof input === "string" && /[a-z]/i.test(input)) return input;
      const parsed = Number(input);
      if (!Number.isFinite(parsed)) return String(input);
      const suffix = parsed % 100 >= 11 && parsed % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[parsed % 10] || "th";
      return `${parsed}${suffix}`;
    };
    const columns = [
      { label: "SUBJECT", weight: isPle ? 1.1 : 1.45 },
      ...period.fields.map(({ label }) => ({ label, weight: isPle ? 0.38 : 0.55, align: "center" })),
      ...(period.combined ? [{ label: "FINAL", weight: 0.62, align: "center" }] : []),
      { label: "GR.", weight: 0.5, align: "center" },
      ...(isPle ? [{ label: "POINTS", weight: 0.55, align: "center" }] : []),
      { label: "POS.", weight: isPle ? 0.5 : 0.75, align: "center" },
      { label: "REMARKS", weight: isPle ? 2.5 : 2.85 },
      { label: "INIT.", weight: 0.5, align: "center" },
    ];
    const rows = entries.map(({ subject, mark }) => {
      if (meta?.blankForm) {
        return [
          subject.name,
          ...period.fields.map(() => "________"),
          ...(period.combined ? ["________"] : []),
          "___",
          ...(isPle ? ["___"] : []),
          "________",
          "________________",
          "___",
        ];
      }
      const position = positionValue(mark, report);
      return [
        subject.name,
        ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
        ...(period.combined ? [num(periodScore(mark, period))] : []),
        gradeLabel(mark, report, !isPle),
        ...(isPle ? [num(mark.points, 0)] : []),
        position ? `${ordinal(position)} of ${classSizeValue(mark, report) || "—"}` : "—",
        subjectRemark(mark, report),
        str(mark.teacher_initials),
      ];
    });
    const width = page.getWidth() - 56;
    const gradeIndex = 1 + period.fields.length + (period.combined ? 1 : 0);
    const pointsIndex = gradeIndex + 1;
    const positionIndex = pointsIndex + (isPle ? 1 : 0);
    const remarkIndex = columns.length - 2;
    if (meta) variantRule(page, page.getHeight() - 150, page.getWidth(), meta);
    let flow = await drawTableFlow(doc, page, report, fonts, theme, "Primary School Report", "", columns, rows, 28, y, width, {
      rowHeight: 13, fontSize: reportFonts.table, headerFontSize: reportFonts.subheading, headerHeight: 20,
      backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color,
      bottomLimit: 275,
      boldColumns: [0], italicColumns: [remarkIndex],
      centerColumns: [
        ...period.fields.map((_, index) => index + 1),
        ...(period.combined ? [period.fields.length + 1] : []),
        gradeIndex,
        ...(isPle ? [pointsIndex] : []),
        positionIndex,
        columns.length - 1,
      ],
      wrappedColumns: [0],
      completeWrappedColumns: [remarkIndex],
      completeTextMaxFontSizes: { [remarkIndex]: 9 },
      completeTextMinFontSizes: { [remarkIndex]: 4.5 },
      columnFontSizes: { 0: 7.2 },
    }, meta);
    const summary = report.summary || {};
    const initials = entries.find(({ mark }) => mark.teacher_initials)?.mark.teacher_initials || "—";
    const totalCells = [
      "TOTALS",
      ...period.fields.map(({ key }) => num(periodSum(entries, key, period), 0)),
      ...(period.combined ? [num(summary.total_score, 0)] : []),
      overallGrade(report),
      ...(isPle ? [num(summary.aggregate, 0)] : []),
      showOverallPosition ? `${ordinal(overallPositionValue(report))} OUT OF ${overallClassSizeValue(report) || "—"}` : "",
      promotionStatus(report).replace(/^STATUS:\s*/, ""),
      initials,
    ];
    const totalsY = drawTableTotals(flow.page, totalCells, 28, flow.y, width, columns, fonts, lineAccent, 5.8);
    drawCompactSummary(flow.page, [
      ...(showOverallPosition ? [["Overall position", `${ordinal(overallPositionValue(report))} of ${overallClassSizeValue(report) || "—"}`]] : []),
      overallResultMetric(report),
      ...(isPle && (summary.result_metric ?? report.primary_result_metric) !== "ple_aggregate"
        ? [["Aggregate", num(summary.aggregate, 0)], ["Division", str(summary.aggregate_division)]]
        : []),
      ["Grade", overallGrade(report)],
    ], 28, totalsY - 1, width, fonts, accent);
    const otherRows = primaryOtherSubjectRows(report, true);
    drawText(flow.page, "OTHER SUBJECTS / CO-CURRICULAR", 28, totalsY - 33, fonts.bold, reportFonts.subheading, color(theme.primary_color), width);
    flow = await drawTableFlow(doc, flow.page, report, fonts, theme, "Primary School Report", "", [
      { label: "SUBJECT", weight: 2 }, { label: "GR", weight: 0.65, align: "center" },
      { label: "TEACHER'S REMARKS", weight: 2 }, { label: "INITIALS", weight: 0.75, align: "center" },
    ], otherRows, 28, totalsY - 39, width, {
      fontSize: reportFonts.table, headerFontSize: reportFonts.subheading, headerHeight: 20, rowHeight: 12, backgroundColor, accentColor: lineAccent,
      headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 210,
      boldColumns: [0], italicColumns: [2], centerColumns: [1, 3], completeWrappedColumns: [2],
      completeTextMaxFontSizes: { 2: 8 }, completeTextMinFontSizes: { 2: 3.5 },
    }, meta);
    const remarks = [
      ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment],
      ["Head Teacher's Remarks", report.head_teacher_comment || report.head_of_infants_comment],
      ["Principal's Remarks", report.principal_comment],
    ];
    await drawAllFooters(doc, report, fonts, accent, { lineAccent, remarks, signatures: ["Class Teacher", "Head Teacher", "Principal"], remarkCount: 3 });
    return doc.save();
  }

  async function renderSecondary(learnerOrReport, level, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const presetKey = report.grading_scale_preset_key
      ?? report.active_grading_scale?.preset_key
      ?? report.grading_scale?.preset_key;
    const oldUce = level === "O_LEVEL" && presetKey === "o_level_old_uce";
    const newUce = level === "O_LEVEL" && presetKey === "o_level_new_uce";
    const usesUce = (oldUce || newUce) && report.uce_report_mode !== "progressive";
    const title = level === "A_LEVEL" ? "A-Level Report"
      : usesUce && oldUce ? "Old UCE Report"
        : usesUce && newUce ? "New UCE Report" : "O-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, level, title);
    const entries = marks(report);
    const period = assessmentPeriod(report);
    const overallGradeText = overallGrade(report);
    const isALevel = level === "A_LEVEL";
    const prefixColumns = isALevel
      ? [
        { label: "CODE", weight: 0.65, align: "center" },
        { label: "SUBJECT", weight: 1.3 },
        { label: "P.", weight: 0.55, align: "center" },
      ]
      : [{ label: "SUBJECT", weight: 1.75 }];
    const prefixValues = (subject, mark) => isALevel
      ? [str(subject.code), subject.name, str(mark.paper_number)]
      : [subject.name];
    const periodColumns = period.fields.map(({ label }) => ({ label, weight: 0.56, align: "center" }));
    const columns = usesUce
      ? oldUce
        ? [
          { label: "SUBJECT", weight: 1.4 },
          { label: "FINAL SCORE", weight: 0.72, align: "center" },
          { label: "GRADE", weight: 0.62, align: "center" },
          { label: "POINTS", weight: 0.55, align: "center" },
          { label: "TEACHER'S REMARK", weight: 1.5 },
          { label: "TR", weight: 0.48, align: "center" },
        ]
        : [
          { label: "SUBJECT", weight: 1.35 },
          { label: "CA 20%", weight: 0.7, align: "center" },
          { label: "EXAM 80%", weight: 0.72, align: "center" },
          { label: "FINAL", weight: 0.72, align: "center" },
          { label: "GRADE", weight: 0.58, align: "center" },
          { label: "ACHIEVEMENT LEVEL", weight: 1.3 },
          { label: "REMARKS", weight: 1.35 },
          { label: "TR", weight: 0.48, align: "center" },
        ]
      : [
        ...prefixColumns,
        ...periodColumns,
        ...(period.combined ? [{ label: "FINAL", weight: 0.6, align: "center" }] : []),
        { label: isALevel ? "GR." : "GRADE", weight: 0.58, align: "center" },
        { label: isALevel ? "COMMENT" : "GRADE DESCRIPTOR", weight: isALevel ? 1.65 : 1.45 },
        { label: "TR", weight: 0.55, align: "center" },
      ];
    const rows = entries.map(({ subject, mark }) => usesUce
      ? oldUce
        ? [
          subject.name,
          num(mark.final_score ?? mark.pct100),
          str(mark.grade),
          num(mark.points),
          subjectRemark(mark, report),
          str(mark.teacher_initials),
        ]
        : [
          subject.name,
          num(mark.ca_score),
          num(mark.exam_score),
          num(mark.final_score ?? mark.pct100),
          str(mark.grade),
          str(mark.achievement_level ?? mark.descriptor),
          subjectRemark(mark, report),
          str(mark.teacher_initials),
        ]
      : [
        ...prefixValues(subject, mark),
        ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
        ...(period.combined ? [num(periodScore(mark, period))] : []),
        gradeLabel(mark, report),
        subjectRemark(mark, report),
        str(mark.teacher_initials),
      ]);
    const subjectIndex = isALevel ? 1 : 0;
    const descriptorIndex = usesUce
      ? oldUce ? 4 : 5
      : columns.length - 2;
    const periodStart = prefixColumns.length;
    const sectionTitle = usesUce
      ? oldUce ? "ANNUAL UCE RESULTS — D1–F9 SYSTEM" : "ANNUAL UCE RESULTS — COMPETENCY SYSTEM"
      : `TERM PERFORMANCE RECORDS — ${period.title}`;
    let flow = await drawTableFlow(doc, page, report, fonts, theme, title, sectionTitle, columns, rows, 28, y, page.getWidth() - 56, {
      rowHeight: usesUce ? 14 : isALevel ? 14 : 17, fontSize: reportFonts.table, headerFontSize: reportFonts.subheading, headerHeight: 23, backgroundColor,
      accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
      boldColumns: [subjectIndex], italicColumns: [descriptorIndex],
      columnFontSizes: { [subjectIndex]: reportFonts.table, [descriptorIndex]: reportFonts.descriptor },
      smallTextColumns: [descriptorIndex],
      completeWrappedColumns: [
        subjectIndex,
        ...(usesUce ? oldUce ? [4] : [5, 6] : [descriptorIndex]),
      ],
      completeTextMaxFontSizes: {
        [subjectIndex]: 7.5,
        ...(usesUce ? { [oldUce ? 4 : 5]: 8 } : {}),
        [usesUce && !oldUce ? 6 : descriptorIndex]: isALevel ? 8 : 9,
      },
      completeTextMinFontSizes: {
        [subjectIndex]: 4.5,
        ...(usesUce ? { [oldUce ? 4 : 5]: 3.5 } : {}),
        [usesUce && !oldUce ? 6 : descriptorIndex]: 3.5,
      },
      centerColumns: usesUce
        ? oldUce ? [1, 2, 3, 5] : [1, 2, 3, 4, 7]
        : [
          ...(isALevel ? [0, 2] : []),
          ...period.fields.map((_, index) => periodStart + index),
          ...(period.combined ? [periodStart + period.fields.length] : []),
          columns.length - 3,
          columns.length - 1,
        ],
    });
    const summary = report.summary || {};
    const finalScores = period.combined
      ? entries.map(({ mark }) => periodScore(mark, period)).filter((score) => score !== null)
      : [];
    let totalsY;
    if (usesUce) {
      const uce = report.uce_result || {};
      const uceSummary = oldUce
        ? [
          ["Best-8 Aggregate", str(uce.aggregate ?? summary.aggregate)],
          ["Division", str(uce.division_code ?? summary.aggregate_division)],
        ]
        : [
          ["Result Indicator", str(uce.result_indicator)],
          ["Certificate", uce.qualified_for_certificate ? "Qualified" : "Did not qualify"],
          ["Project Work", uce.project_work_completed ? "Completed" : "Not completed"],
          ["Subjects Graded", str(uce.completed_subject_count)],
        ];
      drawSummary(flow.page, uceSummary, 28, flow.y - 11, page.getWidth() - 56, fonts, accent);
      totalsY = flow.y;
    } else {
      const averages = [
        ...(isALevel ? ["", "AVERAGE SCORES", ""] : ["AVERAGE SCORES"]),
        ...period.fields.map(({ key }) => num(periodAverage(entries, key, period))),
        ...(period.combined
          ? [finalScores.length ? num(finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) : "—"]
          : []),
        overallGradeText,
        str(summary.overall_achievement ?? summary.achievement),
        "",
      ];
      totalsY = drawTableTotals(flow.page, averages, 28, flow.y - 2, page.getWidth() - 56, columns, fonts, lineAccent, 5.3);
      drawSummary(flow.page, [
        ...(reportPositionEnabled(report) ? [["Overall position", `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}`]] : []),
        overallResultMetric(report),
        ["Grade", overallGradeText],
        ["Identifier", str(summary.overall_identifier ?? summary.identifier)],
      ], 28, totalsY - 11, page.getWidth() - 56, fonts, accent);
    }
    let nextContentY = totalsY - 43;
    if (level === "O_LEVEL") {
      const dates = report.term_dates || {};
      const dateSpan = Math.max(1, Math.floor((columns.length - 3) / 2));
      const endSpan = Math.max(1, columns.length - 3 - dateSpan);
      totalsY = drawMergedTotals(flow.page, [
        { text: "NEXT TERM BEGINS", span: 2 },
        { text: formatReportDate(dates.next_term_begins), span: dateSpan },
        { text: "ENDS", span: 1 },
        { text: formatReportDate(dates.next_term_ends || dates.next_term_ends_on), span: endSpan },
      ], 28, nextContentY, page.getWidth() - 56, columns, fonts, lineAccent, 5.4, 18);
      nextContentY = totalsY - 4;
    }
    const activities = coCurricular(report);
    if (activities.length) {
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
        { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
        { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
      ], activities, 28, nextContentY - 4, page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    if (level === "A_LEVEL" && (report.projects || []).length) {
      const projectRows = report.projects.map((project) => [
        project.project_name, num(project.score), project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
        str(project.grade), str(project.remarks), str(project.teacher_initials),
      ]);
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "STUDENT'S PROJECTS WORK", [
        { label: "PROJECT", weight: 2.2 }, { label: "AVG / 10", weight: 1.2 },
        { label: "% OF 100", weight: 1 }, { label: "GR.", weight: 0.7 },
        { label: "REMARKS", weight: 1.8 }, { label: "TR", weight: 0.9 },
      ], projectRows, 28, flow.y - (activities.length ? 75 : 53), page.getWidth() - 56, { fontSize: 7.2, headerFontSize: 6.3, headerHeight: 20, rowHeight: 18, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 225 });
    }
    await drawAllFooters(doc, report, fonts, accent, {
      lineAccent, remarkCount: 2, signatures: ["Class Teacher", "Head Teacher"],
      gradeKey: gradeScale(level, report),
    });
    return doc.save();
  }

  function templateMeta(level, id) {
    const catalog = window.ReportCardTemplateCatalog || {};
    const templates = catalog[level] || [];
    return templates.find((item) => String(item.id) === String(id)) || templates[0] || { id: "1", variant: "default" };
  }

  function decorativeColor(meta) {
    return color(/^#[0-9a-f]{6}$/i.test(String(meta.decorative || "")) ? meta.decorative : "#B58A2A");
  }

  function variantRule(page, y, width, meta) {
    page.drawRectangle({ x: 30, y, width: width - 60, height: 3, color: decorativeColor(meta) });
  }

  function variantBanner(page, label, y, fonts, primary, background, width) {
    page.drawRectangle({ x: 30, y: y - 23, width: width - 60, height: 22, color: color(background) });
    drawText(page, label, 38, y - 16, fonts.bold, 8.5, primary, width - 76);
    return y - 32;
  }

  function drawLearnerFeeBar(page, report, y, fonts, primary, background) {
    const { width } = page.getSize();
    const learner = report.learner || {};
    const fees = report.fees || {};
    const school = report.school || {};
    page.drawRectangle({ x: 31, y: y - 27, width: width - 62, height: 24, color: color(background) });
    const content = `Reg. no. ${str(learner.reg_no)}    Class ${str(report.class?.name)}    Fees balance ${str(fees.balance)}    SchoolPay Code ${str(learner.schoolpay_code || school.schoolpay_code)}`;
    drawText(page, content, 38, y - 19, fonts.bold, 7, primary, width - 76);
    return y - 37;
  }

  function signatureLabels(meta, report) {
    if (meta.signatures && meta.signatures.some((label) => /behaviors/i.test(label))) return ["Class Teacher", "Head Teacher", "Principal"];
    if (meta.signatures) {
      return levelCode(report.class?.level) === "PRIMARY"
        ? meta.signatures.map((label) => /head of infants|infant/i.test(label) ? "Head Teacher" : label)
        : meta.signatures;
    }
    if (meta.lowerPrimarySignature && isLowerPrimary(report)) return ["Class Teacher", "Head Teacher", "Principal"];
    if (meta.variant === "primary_silver") return ["Class Teacher", "Head of Department", "Principal"];
    return ["Class Teacher", "Head Teacher", "Principal"];
  }

  function isLowerPrimary(report) {
    return /(^|\b)(P[1-3]|PRIMARY\s*[1-3]|PRIMARY\s+(ONE|TWO|THREE))(\b|$)/i.test(String(report.class?.name || ""));
  }

  function projectRows(report) {
    const projects = report.projects || [];
    return projects.map((project) => [
      project.project_name,
      num(project.score),
      num(project.out_of),
      project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
      str(project.grade),
      str(project.remarks),
      str(project.teacher_initials),
    ]);
  }

  async function renderVariant(report, level, meta) {
    if (level === "NURSERY") return renderNursery(report, undefined, undefined, meta);
    if (level === "PRIMARY") return renderPrimary(report, undefined, undefined, meta);
    const title = level === "NURSERY" ? "Nursery Learning Report"
      : level === "PRIMARY" ? "Primary School Report"
        : level === "O_LEVEL" ? "O-Level Report" : "A-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y: headerY } = await prepare(report, level, title, meta);
    const width = page.getWidth();
    variantRule(page, page.getHeight() - 150, width, meta);
    const entries = marks(report);
    const showPositionInVariant = reportPositionEnabled(report, meta);
    let top = headerY - 4;

    if (level === "NURSERY") {
      if (meta.learnerFeeBar) top = drawLearnerFeeBar(page, report, top, fonts, accent, backgroundColor);
      const period = assessmentPeriod(report);
      const areaRows = entries.map(({ subject, mark }) => [
        subject.name,
        ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
        ...(period.combined ? [num(periodScore(mark, period))] : []),
        subjectRemark(mark, report),
        str(mark.teacher_initials),
      ]);
      const x = 31;
      const panelWidth = width - 62;
      const columns = [
        { label: "Learning Area", weight: 2 },
        ...period.fields.map(({ label }) => ({ label, weight: 0.8, align: "center" })),
        ...(period.combined ? [{ label: "FINAL", weight: 0.8, align: "center" }] : []),
        { label: "Remark", weight: 1.2 },
        { label: "Signature", weight: 1 },
      ];
      const flow = await drawTableFlow(doc, page, report, fonts, theme, title, `SUBJECTS • ${period.title}`, columns, areaRows, x, top, panelWidth, { fontSize: 7, headerFontSize: 7.6, headerHeight: 25, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 }, meta);
      let nextY = flow.y;
      const summary = report.summary || {};
      drawTotalsRow(flow.page, "Score", num(summary.total_score, 0), x, nextY - 1, panelWidth, fonts, lineAccent, theme.background_color);
      drawSummary(flow.page, [
        ...(showPositionInVariant ? [["Position", `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}`]] : []),
        overallResultMetric(report),
        ["Grade", overallGrade(report)],
      ], x, nextY - 33, panelWidth, fonts, accent);
      nextY -= 76;
      if (meta.requirements) {
        nextY = drawSectionBar(flow.page, "School Requirements", x, nextY, panelWidth, fonts, theme);
        drawText(flow.page, str(report.school?.school_requirements), x + 5, nextY - 11, fonts.regular, 7, accent, panelWidth - 10);
        nextY -= 24;
      }
      const activities = coCurricular(report, true);
      if (activities.length) {
        await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, x, nextY, panelWidth, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 18, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else if (level === "PRIMARY") {
      const showPosition = showPositionInVariant;
      const period = assessmentPeriod(report);
      const columns = [
        { label: "Subject", weight: 1.7 },
        ...period.fields.map(({ label }) => ({ label, weight: 0.62, align: "center" })),
        ...(period.combined ? [{ label: "FINAL", weight: 0.68, align: "center" }] : []),
        { label: isALevel ? "GR." : "GRADE", weight: 0.58, align: "center" },
        { label: "Position", weight: 0.8, align: "center" },
        { label: "Teacher's Remarks", weight: 2.35 },
        { label: "Initials", weight: 0.62, align: "center" },
      ];
      const rows = entries.map(({ subject, mark }) => {
        const position = positionValue(mark, report);
        const values = [
          subject.name,
          ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
          ...(period.combined ? [num(periodScore(mark, period))] : []),
          gradeLabel(mark, report),
          position ? `${position} of ${classSizeValue(mark, report) || "—"}` : "—",
          subjectRemark(mark, report),
          str(mark.teacher_initials),
        ];
        if (meta.blankForm) return [
          subject.name,
          ...period.fields.map(() => "________"),
          ...(period.combined ? ["________"] : []),
          "___",
          "________",
          "________________",
          "___",
        ];
        return values;
      });
      if (meta.printDate || meta.classAverageAge) {
        const averageAge = report.class_average_age ?? report.class?.average_age;
        const info = [
          meta.printDate ? `Print Date: ${formatReportDate(new Date())}` : "",
          meta.classAverageAge ? `Class Avg. Age: ${str(averageAge)}` : "",
        ].filter(Boolean).join("    ");
        top = variantBanner(page, info, top, fonts, accent, backgroundColor, width);
      }
      const subjectIndex = 0;
      const remarkIndex = columns.length - 2;
      const periodStart = 1;
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, `SUBJECTS • ${period.title}`, columns, rows, 28, top, width - 56, {
        rowHeight: 22, fontSize: 6.4, headerFontSize: 6.5, headerHeight: 25, backgroundColor,
        accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260,
        boldColumns: [subjectIndex], italicColumns: [remarkIndex], wrappedColumns: [subjectIndex],
        completeWrappedColumns: [remarkIndex],
        completeTextMaxFontSizes: { [remarkIndex]: 9 },
        completeTextMinFontSizes: { [remarkIndex]: 3.5 },
        centerColumns: [
          ...period.fields.map((_, index) => periodStart + index),
          ...(period.combined ? [periodStart + period.fields.length] : []),
          columns.length - 4,
          columns.length - 3,
          columns.length - 1,
        ],
        columnFontSizes: { 0: 8, [remarkIndex]: 5.8 },
      }, meta);
      const summary = report.summary || {};
      const initials = entries.find(({ mark }) => mark.teacher_initials)?.mark.teacher_initials || "—";
      const totalCells = [
        "TOTALS",
        ...period.fields.map(({ key }) => num(periodSum(entries, key, period), 0)),
        ...(period.combined ? [num(summary.total_score, 0)] : []),
        overallGrade(report),
        showPosition ? `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}` : "",
        promotionStatus(report),
        initials,
      ];
      const totalsY = drawTableTotals(flow.page, totalCells, 28, flow.y - 2, width - 56, columns, fonts, lineAccent);
      drawSummary(flow.page, [
        ...(showPosition ? [["Overall position", `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}`]] : []),
        overallResultMetric(report),
        ["Grade", overallGrade(report)],
      ], 28, totalsY - 8, width - 56, fonts, accent);
      const activities = coCurricular(report, true);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "SUBJECT", weight: 2 }, { label: "GR", weight: 0.9 },
          { label: "TEACHER'S REMARKS", weight: 1.8 }, { label: "INITIALS", weight: 0.8 },
        ], activities, 28, flow.y - 75, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 18, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260, boldColumns: [0], italicColumns: [2] }, meta);
      }
    } else if (level === "O_LEVEL") {
      let nextY = top;
      if (meta.academicBanner) nextY = variantBanner(page, "ACADEMIC PERFORMANCE", nextY, fonts, accent, backgroundColor, width);
      const period = assessmentPeriod(report);
      const formative = Boolean(meta.formativeEotiFinal);
      const subjectLabel = meta.alternatePaperCodes ? "PAPER / SUBJECT" : "SUBJECT";
      const columns = formative
        ? [
          { label: subjectLabel, weight: 1.75 },
          ...["A1", "A2", "A3", "AVG", "20%", "EOT", "80%"].map((label) => ({ label, weight: 0.55, align: "center" })),
          { label: "FINAL", weight: 0.82, align: "center" },
          { label: "GR.", weight: 0.58, align: "center" },
          { label: "LEVEL", weight: 1.55 },
          { label: "REMARK", weight: 1.35 },
          { label: "TR", weight: 0.48, align: "center" },
        ]
        : [
          { label: subjectLabel, weight: 1.75 },
          ...period.fields.map(({ label }) => ({ label, weight: 0.56, align: "center" })),
          ...(period.combined ? [{ label: "FINAL", weight: 0.6, align: "center" }] : []),
          { label: "GRADE", weight: 0.58, align: "center" },
          { label: "GRADE DESCRIPTOR", weight: 2.1 },
          { label: "TR", weight: 0.55, align: "center" },
        ];
      const rows = entries.map(({ subject, mark }) => {
        const displayName = meta.alternatePaperCodes && subject.code
          ? `${subject.code}: ${subject.name}`
          : subject.name;
        if (formative) {
          return [
            displayName,
            num(mark.a1),
            num(mark.a2),
            num(mark.a3),
            num(mark.avg),
            num(mark.pct20),
            num(mark.eot_period ?? mark.eot),
            num(mark.pct80),
            num(mark.pct100 ?? scoreForMark(mark, report)),
            gradeLabel(mark, report),
            str(mark.descriptor ?? mark.grade_desc),
            subjectRemark(mark, report),
            str(mark.teacher_initials),
          ];
        }
        return [
          displayName,
          ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
          ...(period.combined ? [num(periodScore(mark, period))] : []),
          gradeLabel(mark, report),
          subjectRemark(mark, report),
          str(mark.teacher_initials),
        ];
      });
      const gradeIndex = formative ? 9 : columns.length - 3;
      const descriptorIndex = formative ? 10 : columns.length - 2;
      const remarkIndex = formative ? 11 : descriptorIndex;
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, `TERM PERFORMANCE RECORDS — ${period.title}`, columns, rows, 28, nextY, width - 56, {
        rowHeight: formative ? 18 : 17, fontSize: formative ? 5.5 : 5.8, headerFontSize: formative ? 4.8 : 6.1, headerHeight: 23, backgroundColor,
        accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
        boldColumns: [0], italicColumns: formative ? [remarkIndex] : [descriptorIndex],
        columnFontSizes: { 0: meta.alternatePaperCodes ? 5.8 : 6.5, ...(formative ? { [remarkIndex]: 5.3 } : {}) },
        completeWrappedColumns: formative ? [0, descriptorIndex, remarkIndex] : [0, descriptorIndex],
        completeTextMaxFontSizes: { 0: 7, [descriptorIndex]: 8, ...(formative ? { [remarkIndex]: 8 } : {}) },
        completeTextMinFontSizes: { 0: 4.5, [descriptorIndex]: 3.5, ...(formative ? { [remarkIndex]: 3.5 } : {}) },
        centerColumns: [
          ...(formative ? [1, 2, 3, 4, 5, 6, 7, gradeIndex, columns.length - 1] : [
            ...period.fields.map((_, index) => index + 1),
            ...(period.combined ? [period.fields.length + 1] : []),
            gradeIndex,
            columns.length - 1,
          ]),
        ],
      }, meta);
      const summary = report.summary || {};
      const finalScores = period.combined ? entries.map(({ mark }) => periodScore(mark, period)).filter((score) => score !== null) : [];
      const averages = [
        "AVERAGE SCORES",
        ...period.fields.map(({ key }) => num(periodAverage(entries, key, period))),
        ...(period.combined ? [finalScores.length ? num(finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) : "—"] : []),
        overallGrade(report),
        str(summary.overall_achievement ?? summary.achievement),
        "",
      ];
      const totalsY = drawTableTotals(flow.page, averages, 28, flow.y - 2, width - 56, columns, fonts, lineAccent, 5.3);
      drawSummary(flow.page, [
        ...(showPositionInVariant ? [["Overall position", `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}`]] : []),
        overallResultMetric(report),
        ["Grade", overallGrade(report)],
        ["Identifier", str(summary.overall_identifier ?? summary.identifier)],
      ], 28, totalsY - 11, width - 56, fonts, accent);
      const dates = report.term_dates || {};
      const dateSpan = Math.max(1, Math.floor((columns.length - 3) / 2));
      const endSpan = Math.max(1, columns.length - 3 - dateSpan);
      const datesY = totalsY - 43;
      const activitiesY = drawMergedTotals(flow.page, [
        { text: "NEXT TERM BEGINS", span: 2 }, { text: formatReportDate(dates.next_term_begins), span: dateSpan },
        { text: "ENDS", span: 1 }, { text: formatReportDate(dates.next_term_ends || dates.next_term_ends_on), span: endSpan },
      ], 28, datesY, width - 56, columns, fonts, lineAccent, 5.4, 18);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, activitiesY - 4, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else {
      let nextY = top;
      if (meta.studentBanner && level !== "A_LEVEL") {
        const learner = report.learner || {};
        const info = `STUDENT INFORMATION   ${str(learner.full_name)}   ·   ${str(learner.reg_no)}   ·   ${str(report.class?.name)}   ·   ${str(report.term)} ${str(report.year)}`;
        nextY = variantBanner(page, info, nextY, fonts, accent, backgroundColor, width);
      }
      const period = assessmentPeriod(report);
      const columns = [
        { label: "CODE", weight: 0.65, align: "center" },
        { label: "SUBJECT", weight: 1.3 },
        { label: "PAPER", weight: 0.55, align: "center" },
        ...period.fields.map(({ label }) => ({ label, weight: 0.56, align: "center" })),
        ...(period.combined ? [{ label: "FINAL", weight: 0.6, align: "center" }] : []),
        { label: "GRADE", weight: 0.58, align: "center" },
        { label: "COMMENT", weight: 1.8 },
        { label: "TR", weight: 0.5, align: "center" },
      ];
      const rows = entries.map(({ subject, mark }) => [
        subject.code, subject.name, str(mark.paper_number),
        ...period.fields.map(({ key }) => num(periodValue(mark, key, period))),
        ...(period.combined ? [num(periodScore(mark, period))] : []),
        gradeLabel(mark, report), subjectRemark(mark, report), str(mark.teacher_initials),
      ]);
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, `TERM PERFORMANCE RECORDS — ${period.title}`, columns, rows, 28, nextY, width - 56, {
        rowHeight: 18, fontSize: 5.9, headerFontSize: 6.1, headerHeight: 23, backgroundColor,
        accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
        boldColumns: [1], italicColumns: [columns.length - 2], columnFontSizes: { 1: 7.1 },
        wrappedColumns: [1],
        completeWrappedColumns: [columns.length - 2],
        completeTextMaxFontSizes: { [columns.length - 2]: 9 },
        completeTextMinFontSizes: { [columns.length - 2]: 3.5 },
        centerColumns: [0, 2, ...period.fields.map((_, index) => index + 3), ...(period.combined ? [period.fields.length + 3] : []), columns.length - 3, columns.length - 1],
      }, meta);
      const summary = report.summary || {};
      const finalScores = period.combined ? entries.map(({ mark }) => periodScore(mark, period)).filter((score) => score !== null) : [];
      const averages = [
        "", "AVERAGE SCORES", "",
        ...period.fields.map(({ key }) => num(periodAverage(entries, key, period))),
        ...(period.combined ? [finalScores.length ? num(finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) : "—"] : []),
        overallGrade(report), str(summary.overall_achievement ?? summary.achievement), "",
      ];
      const totalsY = drawTableTotals(flow.page, averages, 28, flow.y - 2, width - 56, columns, fonts, lineAccent, 5.3);
      drawSummary(flow.page, [
        ...(showPositionInVariant ? [["Overall position", `${overallPositionValue(report) || "—"} of ${overallClassSizeValue(report) || "—"}`]] : []),
        overallResultMetric(report),
        ["Grade", overallGrade(report)],
        ["Identifier", str(summary.overall_identifier ?? summary.identifier)],
      ], 28, totalsY - 11, width - 56, fonts, accent);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, totalsY - 45, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
      const shouldShowProjects = (meta.projects || meta.apicultureExample) && (report.projects || []).length > 0;
      if (shouldShowProjects) {
        const projectRowsForTemplate = report.projects.map((project) => [
          project.project_name, num(project.score), project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
          str(project.grade), str(project.remarks), str(project.teacher_initials),
        ]);
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "STUDENT'S PROJECTS WORK", [
          { label: "PROJECT", weight: 1.8 }, { label: "AVG / 10", weight: 1.2 },
          { label: "% OF 100", weight: 1 }, { label: "GR.", weight: .7 },
          { label: "REMARKS", weight: 1.4 }, { label: "TR", weight: .7 },
      ], projectRowsForTemplate, 28, flow.y - (activities.length ? 75 : 53), width - 56, { rowHeight: 18, fontSize: 7.2, headerFontSize: 6.2, headerHeight: 20, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 225 }, meta);
      }
    }
    await drawAllFooters(doc, report, fonts, accent, {
      lineAccent,
      remarkCount: level === "O_LEVEL" || level === "A_LEVEL" ? 2 : 3,
      signatures: level === "O_LEVEL" || level === "A_LEVEL" ? ["Class Teacher", "Head Teacher"] : signatureLabels(meta, report),
      gradeKey: gradeScale(level, report),
    });
    return doc.save();
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zipStore(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    for (const entry of entries) {
      const filename = encoder.encode(entry.name);
      const data = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
      const checksum = crc32(data);
      const local = new Uint8Array(30 + filename.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0x21, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, filename.length, true);
      localView.setUint16(28, 0, true);
      local.set(filename, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + filename.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0x21, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, filename.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, localOffset, true);
      central.set(filename, 46);
      centralParts.push(central);
      localOffset += local.length + data.length;
    }
    const centralLength = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralLength, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  }
  function archiveNamePart(value, fallback = "file") {
    const cleaned = String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 90);
    return cleaned || fallback;
  }
  function archiveTermPart(value) {
    return archiveNamePart(value, "TERM1").replace(/^TERM_?([123])$/i, "TERM$1");
  }

  function drawA5Text(page, text, x, y, font, size, fill, maxWidth, align = "left") {
    const line = fitted(text, font, size, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, size);
    const drawX = align === "center" ? x + Math.max(0, (maxWidth - textWidth) / 2)
      : align === "right" ? x + Math.max(0, maxWidth - textWidth) : x;
    page.drawText(line, { x: drawX, y, size, font, color: fill });
  }

  function drawA5WrappedText(page, text, x, top, width, height, font, maxSize, fill, align = "left", minSize = 3.5) {
    const layout = fitCompleteTextInBox(text, font, width, height - 2, maxSize, minSize);
    if (!layout.fits) {
      throw new Error(`A report-card field is too long to fit in the A5 layout without truncation: ${str(text).slice(0, 48)}`);
    }
    const totalHeight = layout.lines.length * layout.lineHeight;
    const firstBaseline = top - Math.max(0, (height - totalHeight) / 2) - layout.size;
    layout.lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, layout.size);
      const drawX = align === "center" ? x + Math.max(0, (width - textWidth) / 2)
        : align === "right" ? x + Math.max(0, width - textWidth) : x;
      page.drawText(line, {
        x: drawX,
        y: firstBaseline - index * layout.lineHeight,
        size: layout.size,
        font,
        color: fill,
      });
    });
    return layout;
  }

  function a5GradeLabel(mark = {}, report = {}, includePoints = true) {
    const grade = isLowerPrimaryReport(report)
      ? lowerPrimaryLetterGrade(mark, report)
      : printableValue(mark.grade) || gradeForScore(scoreForMark(mark, report), report);
    const overall = printableValue(mark.overall_grade_code);
    const points = includePoints ? printableValue(mark.points) : "";
    if (overall) return `${grade ? `${grade}/` : ""}${overall}${points ? ` (${points})` : ""}`;
    return `${grade}${points ? ` (${points})` : ""}` || "—";
  }

  async function renderNurseryA5Condensed(report) {
    const period = assessmentPeriod(report);
    if (period.key !== "COMBINED_BM") {
      throw new Error("The Nursery A5 layout requires Combined (B.O.T + Midterm).");
    }
    if (!PDFDocument) throw new Error("The PDF library is unavailable; check your connection and reload.");
    const doc = await PDFDocument.create();
    const width = 419.53;
    const height = 595.28;
    const page = doc.addPage([width, height]);
    await drawPageWatermark(doc, page, report);
    const school = report.school || {};
    const learner = report.learner || {};
    const summary = report.summary || {};
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    const theme = window.ReportCardThemeEngine?.getTheme("NURSERY", report.level_theme || school.level_theme, school) || {
      primary_color: "#800000",
      accent_color: "#E6C8C8",
      background_color: "#FFFFFF",
      font_color: "#24242A",
    };
    const maroon = color("#800000");
    const gold = color("#D4AF37");
    const border = color(theme.accent_color || "#E6C8C8");
    const pale = color("#FFF8F7");
    const ink = theme.font_color ? color(theme.font_color) : rgb(0.17, 0.18, 0.2);
    const white = rgb(1, 1, 1);
    const x = 14;
    const contentWidth = width - x * 2;
    page.drawLine({ start: { x, y: height - 13 }, end: { x: width - x, y: height - 13 }, thickness: 2.3, color: maroon });
    page.drawLine({ start: { x, y: height - 16 }, end: { x: width - x, y: height - 16 }, thickness: 0.75, color: gold });
    const logo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    const imageSize = 25;
    if (logo) placeImage(page, logo, x, height - 54, imageSize, imageSize);
    if (photo) placeImage(page, photo, width - x - imageSize, height - 54, imageSize, imageSize);
    const headerX = x + imageSize + 5;
    const headerWidth = contentWidth - (imageSize + 5) * 2;
    const headerRows = [
      [school.name || "School", fonts.bold, 9, maroon],
      [school.school_subtitle || school.subtitle || school.school_type || "", fonts.regular, 5.8, ink],
      [[school.street, school.po_box, school.city, school.district].filter(Boolean).join(", "), fonts.regular, 5.5, ink],
      [[school.phone ? `Tel: ${school.phone}` : "", school.email ? `Email: ${school.email}` : ""].filter(Boolean).join(" · "), fonts.regular, 5.5, ink],
      [school.website ? `Website: ${school.website}` : "", fonts.regular, 5.2, ink],
      [school.motto || "", fonts.bold, 5.8, maroon],
    ];
    headerRows.forEach(([text, font, size, fill], index) => {
      drawNurseryWrappedText(page, text, headerX, height - 20 - index * 8, headerWidth, 7.5, font, size, fill, "center", 4.5);
    });
    page.drawLine({ start: { x, y: height - 61 }, end: { x: width - x, y: height - 61 }, thickness: 0.8, color: gold });
    const title = `${displayTerm(report.term)} · ${period.title.toUpperCase()} REPORT CARD`;
    drawNurseryWrappedText(page, title, x, height - 64, contentWidth, 11, fonts.bold, 7.2, maroon, "center", 5.5);

    const infoTop = height - 79;
    const infoRowHeight = 12;
    const infoRows = [
      [
        ["Reg No", learner.reg_no],
        ["Class", report.class?.name],
        ["Fees Bal", report.fees?.balance],
      ],
      [
        ["Name", learner.full_name],
        ["Days Attended", report.days_attended ?? report.days_present],
        ["Absent", report.days_absent ?? learner.days_absent ?? report.absence],
        ["Total", report.total_days ?? report.school_days],
      ],
    ];
    const nurserySchoolPayCode = learner.schoolpay_code || school.schoolpay_code;
    if (nurserySchoolPayCode) infoRows.push([["SchoolPay Code", nurserySchoolPayCode]]);
    infoRows.forEach((row, rowIndex) => row.forEach(([label, value], columnIndex) => {
      const weights = row.map(([cellLabel]) => String(cellLabel).toLowerCase().includes("schoolpay") ? 1.8 : 1);
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      const cellWidth = contentWidth * weights[columnIndex] / weightTotal;
      const cellX = x + contentWidth * weights.slice(0, columnIndex).reduce((sum, weight) => sum + weight, 0) / weightTotal;
      const cellTop = infoTop - rowIndex * infoRowHeight;
      const cellY = cellTop - infoRowHeight;
      page.drawRectangle({ x: cellX, y: cellY, width: cellWidth, height: infoRowHeight, color: rowIndex ? pale : white, borderColor: border, borderWidth: 0.4, opacity: 0.08 });
      drawNurseryWrappedText(page, `${label}: ${value === null || value === undefined || value === "" ? "—" : value}`, cellX + 2, cellTop - 2, cellWidth - 4, infoRowHeight - 3, fonts.regular, 5.3, ink, "left", 4.3);
    }));

    const gap = 5;
    const panelTop = infoTop - infoRowHeight * infoRows.length - 10;
    const panelTitleHeight = 14;
    const tableHeaderHeight = 14;
    const rowHeight = 31;
    const totalHeight = 12;
    const leftWidth = (contentWidth - gap) * 0.6;
    const rightWidth = contentWidth - gap - leftWidth;
    const rightX = x + leftWidth + gap;
    const bodyTop = panelTop - panelTitleHeight - tableHeaderHeight;
    const bodyBottom = bodyTop - rowHeight * 5;
    const areaWidths = [
      leftWidth * 0.31, leftWidth * 0.10, leftWidth * 0.10,
      leftWidth * 0.10, leftWidth * 0.08, leftWidth * 0.22,
      leftWidth * 0.09,
    ];
    const drawPanelTitle = (panelX, panelWidth, label) => {
      page.drawRectangle({ x: panelX, y: panelTop - panelTitleHeight, width: panelWidth, height: panelTitleHeight, color: white, borderColor: maroon, borderWidth: 0.55, opacity: 0.1 });
      drawNurseryWrappedText(page, label, panelX + 2, panelTop - 2, panelWidth - 4, panelTitleHeight - 3, fonts.bold, 6, maroon, "center", 4.6);
    };
    drawPanelTitle(x, leftWidth, "ACHIEVEMENT SCORES IN THE 5 LEARNING AREAS");
    drawPanelTitle(rightX, rightWidth, "PERFORMANCE IN LEARNING ACTIVITIES");
    const heads = ["Area", "B.O.T", "Midterm", "Average", "Grade", "Remark", "Sign"];
    let currentX = x;
    heads.forEach((label, index) => {
      page.drawRectangle({ x: currentX, y: bodyTop, width: areaWidths[index], height: tableHeaderHeight, color: pale, borderColor: border, borderWidth: 0.45, opacity: 0.45 });
      drawNurseryWrappedText(page, label, currentX + 1, bodyTop + tableHeaderHeight - 2, areaWidths[index] - 2, tableHeaderHeight - 3, fonts.bold, 5.2, maroon, "center", 4.1);
      currentX += areaWidths[index];
    });
    const entries = marks(report);
    const fixedEntries = nurseryLearningAreaDefaults.map((name, index) => entries.find(({ subject }) =>
      String(subject.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === name.toLowerCase().replace(/[^a-z0-9]+/g, "")
    ) || entries[index] || { subject: { name }, mark: {} });
    const scored = fixedEntries.reduce((sum, { mark }) => sum + (periodScore(mark, period) ?? 0), 0);
    fixedEntries.forEach(({ subject, mark }, rowIndex) => {
      const rowTop = bodyTop - rowIndex * rowHeight;
      const rowBottom = rowTop - rowHeight;
      let cellX = x;
      areaWidths.forEach((cellWidth, colIndex) => {
        page.drawRectangle({ x: cellX, y: rowBottom, width: cellWidth, height: rowHeight, color: rowIndex % 2 ? white : pale, borderColor: border, borderWidth: 0.4, opacity: 0.08 });
        cellX += cellWidth;
      });
      const name = subject.name || `Learning Area ${rowIndex + 1}`;
      const description = subject.learning_area_description || subject.description || subject.learning_outcome || "";
      const remark = subjectRemark(mark, report);
      drawNurseryWrappedText(page, name, x + 2, rowTop - 2, areaWidths[0] - 4, 10, fonts.bold, 5.5, ink, "left", 4.5);
      drawNurseryWrappedText(page, [description, remark === "—" ? "" : remark].filter(Boolean).join(" · "), x + 2, rowTop - 12, areaWidths[0] - 4, rowHeight - 13, fonts.regular, 4.6, ink, "left", 3.8);
      let cellStartX = x + areaWidths[0];
      const values = [
        periodValue(mark, "bot", period),
        periodValue(mark, "mid_term", period),
        periodScore(mark, period),
      ];
      values.forEach((value, index) => {
        drawNurseryWrappedText(page, value === null ? "—" : num(value), cellStartX + 1, rowTop - 3, areaWidths[index + 1] - 2, rowHeight - 5, fonts.bold, 5.5, maroon, "center", 4.2);
        cellStartX += areaWidths[index + 1];
      });
      const grade = gradeForScore(periodScore(mark, period), report) || printableValue(mark.grade || mark.grade_code) || "—";
      drawNurseryWrappedText(page, grade, cellStartX + 1, rowTop - 3, areaWidths[4] - 2, rowHeight - 5, fonts.bold, 5.3, maroon, "center", 4.1);
      const signX = x + areaWidths.slice(0, -1).reduce((sum, value) => sum + value, 0);
      page.drawLine({ start: { x: signX + 2, y: rowBottom + 5 }, end: { x: signX + areaWidths[6] - 2, y: rowBottom + 5 }, thickness: 0.4, color: border });
    });
    const totalTop = bodyBottom;
    const showPosition = reportPositionEnabled(report);
    const totalLabels = ["TOTAL: 500", `SCORED: ${num(scored, 0)}`, `POSITION: ${overallPositionValue(report) || "—"} / ${overallClassSizeValue(report) || "—"}`];
    const totalWidths = showPosition ? [leftWidth * 0.28, leftWidth * 0.3, leftWidth * 0.42] : [leftWidth * 0.5, leftWidth * 0.5];
    const visibleTotals = showPosition ? totalLabels : totalLabels.slice(0, 2);
    let totalX = x;
    page.drawRectangle({ x, y: totalTop - totalHeight, width: leftWidth, height: totalHeight, color: maroon, borderColor: maroon, borderWidth: 0.4 });
    visibleTotals.forEach((label, index) => {
      drawNurseryWrappedText(page, label, totalX + 1, totalTop - 2, totalWidths[index] - 2, totalHeight - 3, fonts.bold, 5.3, white, "center", 4.2);
      if (index) page.drawLine({ start: { x: totalX, y: totalTop }, end: { x: totalX, y: totalTop - totalHeight }, thickness: 0.4, color: white });
      totalX += totalWidths[index];
    });

    const sourceActivities = nurseryActivityItems(report);
    const activityByName = new Map(sourceActivities.map((item) => [String(item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, ""), item]));
    const activities = nurseryActivityDefaults.map((name, index) =>
      activityByName.get(name.toLowerCase().replace(/[^a-z0-9]+/g, "")) || sourceActivities[index] || { name, remark: "", image: "" },
    );
    const activityTop = panelTop - panelTitleHeight;
    const activityHeight = activityTop - bodyBottom;
    const cardWidth = rightWidth / 2;
    const cardHeight = activityHeight / 5;
    for (let index = 0; index < activities.length; index += 1) {
      const item = activities[index];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cardX = rightX + column * cardWidth;
      const cardTop = activityTop - row * cardHeight;
      const cardBottom = cardTop - cardHeight;
      page.drawRectangle({ x: cardX, y: cardBottom, width: cardWidth, height: cardHeight, color: index % 2 ? white : pale, borderColor: border, borderWidth: 0.4, opacity: 0.08 });
      const iconSize = Math.min(15, cardHeight - 5, cardWidth * 0.25);
      const iconX = cardX + 2;
      const iconY = cardBottom + (cardHeight - iconSize) / 2;
      const customSource = nurserySchoolIcon(report, item.name || nurseryActivityDefaults[index]);
      const customImage = customSource
        ? await embedImage(doc, customSource)
        : item.image ? await embedImage(doc, item.image) : null;
      const icon = customImage || await embedNurseryIcon(doc, nurseryActivityIconKeys[index]);
      if (icon) placeImage(page, icon, iconX, iconY, iconSize, iconSize);
      const textX = iconX + iconSize + 2;
      const textWidth = cardWidth - iconSize - 6;
      drawNurseryWrappedText(page, nurseryActivityDefaults[index].toUpperCase(), textX, cardTop - 2, textWidth, 11, fonts.bold, 4.5, maroon, "left", 3.7);
      if (item.remark) drawNurseryWrappedText(page, item.remark, textX, cardTop - 13, textWidth, cardHeight - 15, fonts.italic, 4.4, ink, "left", 3.6);
    }

    const commentTop = totalTop - totalHeight - 8;
    const commentHeight = 19;
    const labelWidth = 69;
    const signatureWidth = 48;
    const comments = [
      ["Class Teacher's Report", resolvedRemarkContent("Class Teacher's Report", report.class_teacher_comment || report.suggested_comment, report), report.class?.class_teacher_name],
      ["Behaviors / Cleanliness", report.behaviors_comment || report.behaviour_comment || report.cleanliness_comment || "Good behavior and maintains cleanliness.", report.behaviors_teacher_name || report.class?.class_teacher_name],
      ["Head Teacher's Comment", resolvedRemarkContent("Head Teacher's Comment", report.head_of_infants_comment || report.head_teacher_comment, report), report.school?.head_of_infants_name || report.school?.head_teacher_name],
    ];
    comments.forEach(([label, content, signer], index) => {
      const rowTop = commentTop - index * commentHeight;
      const rowBottom = rowTop - commentHeight;
      page.drawRectangle({ x, y: rowBottom, width: contentWidth, height: commentHeight, color: white, borderColor: maroon, borderWidth: 0.45, opacity: 0.08 });
      page.drawLine({ start: { x: x + labelWidth, y: rowTop }, end: { x: x + labelWidth, y: rowBottom }, thickness: 0.4, color: maroon });
      page.drawLine({ start: { x: x + contentWidth - signatureWidth, y: rowTop }, end: { x: x + contentWidth - signatureWidth, y: rowBottom }, thickness: 0.4, color: maroon });
      drawNurseryWrappedText(page, label, x + 2, rowTop - 2, labelWidth - 4, commentHeight - 3, fonts.bold, 5, ink, "left", 4);
      if (content) drawNurseryWrappedText(page, content, x + labelWidth + 3, rowTop - 2, contentWidth - labelWidth - signatureWidth - 6, commentHeight - 3, fonts.italic, 5, ink, "left", 3.8);
      if (signer) drawNurseryWrappedText(page, signer, x + contentWidth - signatureWidth + 2, rowTop - 2, signatureWidth - 4, commentHeight - 3, fonts.bold, 4.8, ink, "right", 3.8);
    });
    const dates = report.term_dates || {};
    const footerTop = commentTop - commentHeight * comments.length - 7;
    const footerText = [
      `Fees balance UGX ${str(report.fees?.balance)}`,
      `Next term fees UGX ${str(dates.next_term_fees ?? school.next_term_fees)}`,
      `Term ended ${formatReportDate(dates.term_ended_on)}`,
      `Next term begins ${formatReportDate(dates.next_term_begins)}`,
    ].join("  ·  ");
    drawNurseryWrappedText(page, footerText, x, footerTop, contentWidth, 12, fonts.regular, 5.2, ink, "left", 4.2);
    page.drawLine({ start: { x, y: 24 }, end: { x: width - x, y: 24 }, thickness: 0.6, color: maroon });
    drawNurseryWrappedText(page, school.report_footer_text || school.motto || "Let's learn with ease.", x, 20, contentWidth, 9, fonts.italic, 5.2, maroon, "center", 4.2);
    drawNurseryWrappedText(page, "This report is invalid without the official school stamp.", x, 10, contentWidth * 0.58, 7, fonts.italic, 4.8, maroon, "left", 4.1);
    drawNurseryWrappedText(page, "Powered by AP SHULE TECHNOLOGIES", x + contentWidth * 0.58, 10, contentWidth * 0.42, 7, fonts.regular, 4.8, maroon, "right", 4.1);
    doc.setTitle(`${period.title} Nursery Report — ${str(learner.full_name)}`);
    doc.setAuthor(str(school.name));
    return doc.save();
  }

  async function renderA5Condensed(report, classLevel) {
    const period = assessmentPeriod(report);
    if (isOfficialPle(report) && Array.isArray(report.incomplete_marks) && report.incomplete_marks.length) {
      throw new Error(`Incomplete marks: ${report.incomplete_marks.join(", ")}`);
    }
    if (period.key !== "COMBINED_BM") {
      throw new Error("The Half Page (A5) Condensed layout requires Combined (B.O.T + Midterm).");
    }
    if (!PDFDocument) throw new Error("The PDF library is unavailable; check your connection and reload.");
    const doc = await PDFDocument.create();
    const width = 419.53;
    const height = 595.28;
    const page = doc.addPage([width, height]);
    await drawPageWatermark(doc, page, report);
    doc.setTitle(`B.O.T + Midterm Report — ${str(report.learner?.full_name)}`);
    doc.setAuthor(str(report.school?.name));
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    const theme = window.ReportCardThemeEngine?.getTheme(classLevel, report.level_theme || report.school?.level_theme, report.school) || {
      primary_color: "#4B2E9E",
      accent_color: "#D1C4E9",
      table_header_color: "#F6F2FC",
      table_header_text_color: "#4B2E9E",
    };
    const primary = color(theme.primary_color);
    const accent = color(theme.accent_color);
    const headerFill = color(theme.table_header_color || theme.accent_color);
    const headerText = color(theme.table_header_text_color || theme.primary_color);
    const maroon = color("#800000");
    const gold = color("#D4AF37");
    const ink = theme.font_color ? color(theme.font_color) : rgb(0.16, 0.16, 0.18);
    const white = rgb(1, 1, 1);
    const x = 18;
    const contentWidth = width - x * 2;
    const school = report.school || {};
    const learner = report.learner || {};
    const logo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    const subtitle = school.school_subtitle || school.subtitle || school.school_type || "";
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(", ");
    const contact = [
      school.phone ? `Tel: ${school.phone}` : "",
      school.email ? `Email: ${school.email}` : "",
    ].filter(Boolean).join(", ");
    const logoBox = 28;
    const logoX = x;
    const photoX = width - x - logoBox;
    page.drawLine({ start: { x, y: height - 17 }, end: { x: width - x, y: height - 17 }, thickness: 2.5, color: maroon });
    page.drawLine({ start: { x, y: height - 20 }, end: { x: width - x, y: height - 20 }, thickness: 0.8, color: gold });
    if (logo) placeImage(page, logo, logoX, height - 68, logoBox, logoBox);
    else drawA5Text(page, String(school.name || "S").slice(0, 1).toUpperCase(), logoX, height - 50, fonts.bold, 16, maroon, logoBox, "center");
    if (photo) placeImage(page, photo, photoX, height - 68, logoBox, logoBox);
    else drawA5Text(page, "Photo", photoX, height - 50, fonts.regular, 6.5, ink, logoBox, "center");
    const center = width / 2;
    const headerX = x + logoBox + 4;
    const headerWidth = contentWidth - (logoBox + 4) * 2;
    const lastHeaderBaseline = drawCenteredHeaderRows(page, [
      { text: school.name || "School", font: fonts.bold, size: 15, fill: maroon },
      { text: address, font: fonts.regular, size: 14, fill: ink },
      { text: contact, font: fonts.regular, size: 14, fill: ink },
      { text: school.website ? `Website: ${school.website}` : "", font: fonts.regular, size: 14, fill: ink },
      { text: subtitle, font: fonts.bold, size: 12, fill: ink, underline: true },
      { text: school.motto || "", font: fonts.bold, size: 12, fill: maroon, underline: true },
    ], center, height - 29, headerWidth);
    const headerRuleY = Math.min(height - 111, lastHeaderBaseline - 8);
    page.drawLine({ start: { x, y: headerRuleY }, end: { x: width - x, y: headerRuleY }, thickness: 1, color: gold });
    const titleY = headerRuleY - 11;
    drawA5Text(page, `${str(displayTerm(report.term))} - B.O.T + MIDTERM REPORT`, headerX, titleY, fonts.bold, 7.2, primary, headerWidth, "center");

    const infoTop = titleY - 13;
    const infoHeight = 56;
    page.drawRectangle({ x, y: infoTop - infoHeight, width: contentWidth, height: infoHeight, borderColor: accent, borderWidth: 0.7 });
    const dates = report.term_dates || {};
    const info = [
      ["Learner", learner.full_name],
      ["Class", report.class?.name],
      ["Term / Year", `${displayTerm(report.term)} ${report.year ?? ""}`.trim()],
      ["Term Ends On", formatReportDate(dates.term_ended_on)],
      ["Next Term Begins", formatReportDate(dates.next_term_begins)],
      ["Reg. No. / House", [learner.reg_no, learner.house ? `House ${learner.house}` : ""].filter(Boolean).join(" · ")],
      ["SchoolPay Code", learner.schoolpay_code || school.schoolpay_code],
    ];
    const cellWidth = contentWidth / 2;
    const infoRowHeight = infoHeight / 4;
    info.forEach(([label, value], index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const cellX = row === 3 ? x : x + column * cellWidth;
      const currentCellWidth = row === 3 ? contentWidth : cellWidth;
      const cellTop = infoTop - row * infoRowHeight;
      if (column && row < 3) page.drawLine({ start: { x: cellX, y: cellTop }, end: { x: cellX, y: cellTop - infoRowHeight }, thickness: 0.5, color: accent });
      if (row) page.drawLine({ start: { x, y: cellTop }, end: { x: width - x, y: cellTop }, thickness: 0.5, color: accent });
      if (String(label).toLowerCase().includes("schoolpay")) {
        drawA5WrappedText(page, `${label}: ${str(value)}`, cellX + 4, cellTop - 1, currentCellWidth - 8, infoRowHeight - 2, fonts.regular, 7.2, ink, "left", 3.5);
      } else {
        drawA5Text(page, `${label}: ${str(value)}`, cellX + 4, cellTop - 10, fonts.regular, 7.5, ink, currentCellWidth - 8);
      }
    });

    const tableTop = infoTop - infoHeight - 20;
    const headerHeight = 19;
    const footerBottom = 130;
    const rowHeight = entries => entries.length
      ? Math.min(16, Math.max(9, (tableTop - footerBottom - headerHeight) / entries.length))
      : 16;
    const entries = marks(report);
    const isPle = isOfficialPle(report);
    const rowH = rowHeight(entries);
    const fontSize = Math.min(8.5, Math.max(8, rowH - 2));
    const columns = [
      { label: "Subject", weight: 1.7, align: "left" },
      { label: "B.O.T", weight: 0.62, align: "center" },
      { label: "Midterm", weight: 0.72, align: "center" },
      { label: "Average", weight: 0.8, align: "center" },
      { label: "Grade", weight: 1, align: "center" },
      { label: "Pos.", weight: 0.7, align: "center" },
      ...(isPle ? [{ label: "Points", weight: 0.65, align: "center" }] : []),
      { label: "Remarks", weight: 1.8, align: "left" },
    ];
    const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const widths = columns.map((column) => contentWidth * column.weight / totalWeight);
    let currentX = x;
    columns.forEach((column, index) => {
      const cellWidth = widths[index];
      page.drawRectangle({ x: currentX, y: tableTop - headerHeight, width: cellWidth, height: headerHeight, color: headerFill, borderColor: accent, borderWidth: 0.55 });
      drawA5Text(page, column.label, currentX + 2, tableTop - 13, fonts.bold, 8, headerText, cellWidth - 4, column.align);
      currentX += cellWidth;
    });
    let rowTop = tableTop - headerHeight;
    entries.forEach(({ subject, mark }, rowIndex) => {
      const values = [
        subject.name,
        num(periodValue(mark, "bot", period), 1),
        num(periodValue(mark, "mid_term", period), 1),
        num(periodScore(mark, period), 1),
        a5GradeLabel(mark, report, !isPle),
        `${positionValue(mark, {}) || "—"}${classSizeValue(mark, {}) ? `/${classSizeValue(mark, {})}` : ""}`,
        ...(isPle ? [num(mark.points, 0)] : []),
        subjectRemark(mark, report),
      ];
      currentX = x;
      columns.forEach((column, index) => {
        const cellWidth = widths[index];
        const rowY = rowTop - rowH;
        page.drawRectangle({
          x: currentX,
          y: rowY,
          width: cellWidth,
          height: rowH,
          color: rowIndex % 2 ? color("#FAF9FC") : white,
          borderColor: accent,
          borderWidth: 0.45,
          opacity: 0.08,
        });
        if (index === 0 || index === columns.length - 1) {
          drawA5WrappedText(page, values[index], currentX + 2, rowTop - 1, cellWidth - 4, rowH - 2,
            index === 0 ? fonts.bold : fonts.regular, Math.min(fontSize, 8), ink, column.align, 3.5);
        } else {
          drawA5Text(
            page,
            values[index],
            currentX + 2,
            rowY + Math.max(2, (rowH - fontSize) / 2),
            index === 0 ? fonts.bold : fonts.regular,
            fontSize,
            ink,
            cellWidth - 4,
            column.align,
          );
        }
        currentX += cellWidth;
      });
      rowTop -= rowH;
    });

    const comments = [
      ["Class Teacher", report.class_teacher_comment || report.suggested_comment || autoOverallRemark(report, "teacher")],
      ["Head Teacher", report.head_teacher_comment || report.head_of_infants_comment || autoOverallRemark(report, "head_teacher")],
      ["Principal", report.principal_comment || autoOverallRemark(report, "principal")],
    ].filter(([, content]) => printableValue(content));
    const footerY = Math.max(80, rowTop - 16);
    page.drawLine({ start: { x, y: footerY + 8 }, end: { x: width - x, y: footerY + 8 }, thickness: 0.6, color: accent });
    const commentText = comments.map(([label, content]) => `${label}: ${str(content)}`).join("  ·  ");
    const maxCommentLines = Math.max(1, Math.floor((footerY - 64) / 8.5));
    const fittedComments = fitCompleteText(commentText, fonts.regular, contentWidth - 4, maxCommentLines, 7.5, 3.5);
    const commentLeading = fittedComments.size + 1;
    fittedComments.lines.forEach((line, index) => {
      page.drawText(line, {
        x: x + 2,
        y: footerY - index * commentLeading,
        size: fittedComments.size,
        font: fonts.regular,
        color: ink,
      });
    });
    const resultMetric = overallResultMetric(report);
    const summary = report.summary || {};
    const pleSummary = isPle && resultMetric[0] !== "PLE Aggregate"
      ? ` · Aggregate: ${num(summary.aggregate, 0)} · ${str(summary.aggregate_division)}`
      : "";
    const key = `${resultMetric[0]}: ${resultMetric[1]}${pleSummary} · Overall grade: ${overallGrade(report)} · Position: ${overallPositionValue(report) || "—"} / ${overallClassSizeValue(report) || "—"} · Grading key: ${gradeScale(classLevel, report)}`;
    const keyY = footerY - fittedComments.lines.length * commentLeading - 2;
    const keyLinesAvailable = Math.max(1, Math.floor((keyY - 42) / 6));
    const fittedKey = fitCompleteText(key, fonts.regular, contentWidth - 4, keyLinesAvailable, 6, 3.8);
    if (fittedKey.lines.length > keyLinesAvailable) throw new Error("The report-card summary and grading key cannot fit completely in the A5 footer.");
    fittedKey.lines.forEach((line, index) => page.drawText(line, {
      x: x + 2,
      y: keyY - index * (fittedKey.size + 1),
      size: fittedKey.size,
      font: fonts.regular,
      color: ink,
    }));
    const signatureY = 27;
    page.drawLine({ start: { x, y: signatureY + 12 }, end: { x: width - x, y: signatureY + 12 }, thickness: 0.5, color: accent });
    page.drawLine({ start: { x, y: signatureY }, end: { x: x + 93, y: signatureY }, thickness: 0.6, color: ink });
    drawA5Text(page, "Class Teacher's signature", x + 97, signatureY + 2, fonts.regular, 7.5, ink, contentWidth - 97);
    drawA5Text(page, "This report is invalid without the official school stamp.", x, 8, fonts.regular, 5.2, maroon, contentWidth * 0.58, "left");
    drawA5Text(page, "Powered by AP SHULE TECHNOLOGIES", x + contentWidth * 0.58, 8, fonts.regular, 5.2, maroon, contentWidth * 0.42, "right");
    return doc.save();
  }

  async function render(report, classLevel, templateId = "1", includeStamp = true, layoutFormat = null) {
    const stampSources = [report?.school?.stamp_config, report?.stamp_config]
      .filter((value) => value && typeof value === "object" && !Array.isArray(value));
    const stamp = includeStamp ? Object.assign({}, ...stampSources) : null;
    const showStamp = report?.school?.show_stamp !== false && report?.show_stamp !== false;
    const renderReport = { ...report, __includeStamp: Boolean(showStamp && stamp && typeof stamp === "object" && Object.keys(stamp).length) };
    if (isOfficialPle(renderReport) && Array.isArray(renderReport.incomplete_marks) && renderReport.incomplete_marks.length) {
      throw new Error(`Incomplete marks: ${renderReport.incomplete_marks.join(", ")}`);
    }
    const level = levelCode(classLevel || renderReport.class?.level);
    if ((layoutFormat || renderReport.layout_format || "A4") === "A5_CONDENSED") {
      return level === "NURSERY"
        ? renderNurseryA5Condensed(renderReport)
        : renderA5Condensed(renderReport, level);
    }
    const id = String(templateId || "1").replace(/^template[_-]?/i, "");
    const meta = templateMeta(level, id);
    const suppliedTheme = renderReport.level_theme || renderReport.school?.level_theme;
    const templateTheme = window.ReportCardThemeEngine?.getTemplateTheme?.(level, meta, suppliedTheme, renderReport.school);
    const themedReport = templateTheme ? { ...renderReport, level_theme: templateTheme } : renderReport;
    let bytes;
    if (String(meta.id) === "1") {
      if (level === "NURSERY") bytes = await renderNursery(themedReport);
      else if (level === "PRIMARY") bytes = await renderPrimary(themedReport);
      else bytes = await renderSecondary(themedReport, level);
    } else {
      bytes = await renderVariant(themedReport, level, meta);
    }
    if (includeStamp && showStamp && window.ReportCardStampRenderer) {
      bytes = await window.ReportCardStampRenderer.apply(bytes, themedReport, stamp);
    }
    if (themedReport.authenticity_qr_data_url) {
      if (!window.ReportCardQrRenderer?.apply) {
        throw new Error("Report card authenticity support is unavailable. Refresh and try again.");
      }
      bytes = await window.ReportCardQrRenderer.apply(bytes, themedReport);
    }
    return bytes;
  }

  window.ReportCardPdf = {
    render,
    renderA5Condensed,
    renderVariant,
    renderNursery,
    renderPrimary,
    renderOLevel: (learner, school, marksData) => renderSecondary(learner, "O_LEVEL", school, marksData),
    renderALevel: (learner, school, marksData) => renderSecondary(learner, "A_LEVEL", school, marksData),
    createZip: zipStore,
    archiveNamePart,
    archiveTermPart,
  };
})();
