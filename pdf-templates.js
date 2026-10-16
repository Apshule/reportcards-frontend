(() => {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  const portrait = [595.28, 841.89];

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
  function fitted(text, font, size, maxWidth) {
    let value = String(text ?? "—")
      .replace(/\s+/g, " ")
      .replace(/[^\x00-\xFF\u2013\u2014\u2018\u2019\u2022]/g, "?");
    if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
    while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value}…`;
  }
  function drawText(page, text, x, y, font, size = 8, fill = rgb(0.16, 0.17, 0.19), maxWidth = 200) {
    page.drawText(fitted(text, font, size, maxWidth), { x, y, size, font, color: fill });
  }
  function centered(page, text, center, y, font, size, fill, maxWidth) {
    const line = fitted(text, font, size, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: center - textWidth / 2, y, size, font, color: fill });
  }
  function alignedText(page, text, x, y, font, size, fill, maxWidth, align = "left") {
    const line = fitted(text, font, size, maxWidth);
    const textWidth = font.widthOfTextAtSize(line, size);
    const left = align === "center" ? x + Math.max(0, (maxWidth - textWidth) / 2)
      : align === "right" ? x + Math.max(0, maxWidth - textWidth) : x;
    page.drawText(line, { x: left, y, size, font, color: fill });
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
    const level = levelCode(report.class?.level);
    if (level !== "O_LEVEL" && level !== "A_LEVEL") return `${displayTerm(report.term)} PROGRESS REPORT — ${str(report.year)}`;
    const term = displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3");
    return `${str(report.class?.name || (level === "O_LEVEL" ? "O-LEVEL" : "A-LEVEL"))} ${term} ${str(report.year)} REPORT CARD`;
  }
  async function drawHeader(doc, page, report, fonts, theme, title) {
    const { width, height } = page.getSize();
    const school = report.school || {};
    const learner = report.learner || {};
    const margin = 28;
    const accent = color(theme.accent_color);
    const headerColor = color(theme.header_color || theme.primary_color);
    const headerText = color(theme.header_text_color || "#FFFFFF");
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
      borderColor: colorToPdf(accent),
      borderWidth: 1.5,
    });
    roundedPanel(page, margin + 1, height - 136, width - (margin + 1) * 2, 118, 12, headerColor);
    const logo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    placeImage(page, logo, margin + 10, height - 120, 85, 85);
    if (!logo) {
      page.drawRectangle({ x: margin + 10, y: height - 120, width: 85, height: 85, borderColor: colorToPdf(accent), borderWidth: 1 });
      centered(page, String(school.name || "S").slice(0, 1).toUpperCase(), margin + 52.5, height - 82, fonts.bold, 20, headerText, 70);
    }
    const photoX = width - margin - 95;
    const photoY = height - 133;
    if (photo) placeImage(page, photo, photoX, photoY, 85, 112);
    else page.drawRectangle({ x: photoX, y: photoY, width: 85, height: 112, borderColor: colorToPdf(accent), borderWidth: 1 });
    const center = width / 2;
    const maxCenter = width - 220;
    centered(page, str(school.name), center, height - 40, fonts.bold, 18, headerText, maxCenter);
    if (school.motto) centered(page, school.motto, center, height - 59, fonts.italic, 10, headerText, maxCenter);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const contact = levelCode(report.class?.level) === "O_LEVEL" || levelCode(report.class?.level) === "A_LEVEL"
      ? [
        school.school_id || school.school_code ? `SCH.ID: ${school.school_code || school.school_id}` : "",
        school.phone ? `TEL: ${school.phone}` : "",
        school.email,
      ].filter(Boolean).join(" · ")
      : [school.phone, school.email, school.website].filter(Boolean).join(" · ");
    if (address) centered(page, address, center, height - 74, fonts.regular, 7.3, headerText, maxCenter);
    if (contact) centered(page, contact, center, height - 86, fonts.regular, 7.3, headerText, maxCenter);
    centered(page, title, center, height - 105, fonts.bold, 10.5, headerText, maxCenter);
    if (!photo) centered(page, "Learner photo", photoX + 42.5, height - 75, fonts.regular, 6.5, headerText, 75);
    page.drawLine({
      start: { x: margin + 2, y: height - 132 },
      end: { x: width - margin - 2, y: height - 132 },
      thickness: 2,
      color: colorToPdf(accent),
    });
    const titleY = height - 164;
    page.drawRectangle({ x: margin, y: titleY - 27, width: width - margin * 2, height: 24, color: accent });
    centered(page, reportCardBanner(report), width / 2, titleY - 18, fonts.bold, 11, contrastColor(accent), width - margin * 2 - 12);
    const infoTop = titleY - 32;
    const level = levelCode(report.class?.level);
    const infoRows = level === "O_LEVEL" ? [
      [["NAME", learner.full_name], ["TERM", displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3")], ["YEAR", report.year], ["DATE", str(report.printed_at || report.generated_at || new Date().toLocaleDateString()).slice(0, 10)]],
      [["SCHOLAR ID", learner.scholar_id || learner.reg_no], ["CLASS", report.class?.name], ["VCODE", learner.vcode]],
      [["LIN/AMIS.NO", learner.lin || learner.amis_no], ["STATE", learner.state], ["RESIDENCE", learner.residence]],
    ] : level === "A_LEVEL" ? [
      [["NAME", learner.full_name], ["GENDER", learner.gender || learner.sex]],
      [["AGE", learner.age], ["ROLL NO", learner.roll_no || learner.reg_no]],
      [["CLASS", report.class?.name], ["STREAM", learner.stream || report.class?.stream]],
      [["COMBINATION", learner.combination || report.class?.combination], ["TERM", displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3")]],
    ] : [
      [["NAME", learner.full_name], ["AD No", learner.reg_no]],
      [["CLASS", report.class?.name], ["SEX", learner.sex]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? report.absence]],
      [["POSITION", report.summary?.position], ["OUT OF", report.summary?.class_size]],
      [["TERM", displayTerm(report.term)], ["YEAR", report.year], ["PRINT DATE", new Date().toLocaleDateString()]],
    ];
    const gridX = margin;
    const gridWidth = width - margin * 2;
    const cellHeight = level === "O_LEVEL" ? 15 : 17.5;
    infoRows.forEach((row, rowIndex) => row.forEach(([label, value], columnIndex) => {
      const cellWidth = gridWidth / row.length;
      const cellX = gridX + columnIndex * cellWidth;
      const cellY = infoTop - (rowIndex + 1) * cellHeight;
      page.drawRectangle({ x: cellX, y: cellY, width: cellWidth, height: cellHeight, borderColor: accent, borderWidth: 0.45, color: rowIndex % 2 ? color(theme.background_color) : rgb(1, 1, 1) });
      const labelText = `${label}:`;
      const labelSize = 5.8;
      const valueSize = 6;
      const textX = cellX + 5;
      const labelWidth = fonts.bold.widthOfTextAtSize(labelText, labelSize);
      drawText(page, labelText, textX, cellY + 6, fonts.bold, labelSize, rgb(0.2, 0.2, 0.22), labelWidth);
      drawText(page, str(value), textX + labelWidth + 3, cellY + 6, fonts.regular, valueSize, rgb(0.2, 0.2, 0.22), cellWidth - labelWidth - 13);
    }));
    return infoTop - infoRows.length * cellHeight - 12;
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
    centered(page, config.text, width / 2, y - 19, fonts.bold, 9, config.foreground, width - 76);
    return y - 39;
  }
  function drawTable(page, columns, rows, x, top, tableWidth, fonts, accent, options = {}) {
    const groupHeaderHeight = options.headerGroups?.length ? (options.groupHeaderHeight ?? 14) : 0;
    const subHeaderHeight = options.headerHeight ?? 25;
    const headerHeight = groupHeaderHeight + subHeaderHeight;
    const rowHeight = options.rowHeight ?? 19;
    const fontSize = options.fontSize ?? 7;
    const headerFontSize = options.headerFontSize ?? fontSize;
    const availableFractions = columns.map((column) => column.weight || 1);
    const totalWeight = availableFractions.reduce((sum, weight) => sum + weight, 0);
    const widths = availableFractions.map((weight) => tableWidth * weight / totalWeight);
    const pale = options.backgroundColor ? colorToPdf(options.backgroundColor) : rgb(0.94, 0.96, 0.94);
    const headerColor = options.headerColor ? colorToPdf(options.headerColor) : pale;
    const headerTextColor = options.headerTextColor ? colorToPdf(options.headerTextColor) : accent;
    const border = options.accentColor ? colorToPdf(options.accentColor) : accent;
    const ink = rgb(0.17, 0.18, 0.2);
    let y = top;
    page.drawRectangle({ x, y: y - headerHeight, width: tableWidth, height: headerHeight, color: headerColor });
    const groupY = y;
    if (groupHeaderHeight) {
      const colStart = (index) => x + widths.slice(0, index).reduce((sum, width) => sum + width, 0);
      const rowSpanColumns = options.rowSpanColumns || [0];
      rowSpanColumns.forEach((index) => {
        alignedText(page, columns[index].label, colStart(index) + 3, groupY - groupHeaderHeight - subHeaderHeight + 5, fonts.bold, headerFontSize, headerTextColor, widths[index] - 6, "center");
        page.drawLine({ start: { x: colStart(index), y: groupY }, end: { x: colStart(index), y: groupY - headerHeight }, thickness: 0.35, color: border });
        page.drawLine({ start: { x: colStart(index) + widths[index], y: groupY }, end: { x: colStart(index) + widths[index], y: groupY - headerHeight }, thickness: 0.35, color: border });
      });
      options.headerGroups.forEach(({ label, start, end }) => {
        const groupX = colStart(start);
        const groupWidth = widths.slice(start, end + 1).reduce((sum, width) => sum + width, 0);
        alignedText(page, label, groupX + 3, groupY - groupHeaderHeight + 4, fonts.bold, options.groupHeaderFontSize ?? headerFontSize, headerTextColor, groupWidth - 6, "center");
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
        alignedText(page, column.label, cellX + 3, y - subHeaderHeight + Math.max(6, (subHeaderHeight - headerFontSize) / 2), fonts.bold, headerFontSize, headerTextColor, widths[index] - 6, "center");
      }
      page.drawLine({ start: { x: cellX, y }, end: { x: cellX, y: y - subHeaderHeight }, thickness: 0.35, color: border });
      cellX += widths[index];
    });
    page.drawLine({ start: { x: x + tableWidth, y }, end: { x: x + tableWidth, y: y - subHeaderHeight }, thickness: 0.35, color: border });
    page.drawLine({ start: { x, y: y - subHeaderHeight }, end: { x: x + tableWidth, y: y - subHeaderHeight }, thickness: 0.45, color: border });
    y -= subHeaderHeight;
    for (const [rowIndex, row] of rows.entries()) {
      page.drawRectangle({ x, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rowIndex % 2 === 0 ? pale : rgb(1, 1, 1) });
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
          const columnFontSize = options.columnFontSizes?.[index] || fontSize;
          if (options.wrappedColumns?.includes(index)) {
            const lines = wrappedLines(str(value), font, columnFontSize, widths[index] - 6);
            lines.forEach((line, lineIndex) => {
              alignedText(page, line, currentX + 3, y - rowHeight + 4 + (lines.length - lineIndex - 1) * (columnFontSize + 1), font, columnFontSize, ink, widths[index] - 6, align);
            });
          } else {
            alignedText(page, str(value), currentX + 3, y - rowHeight + 6, font, columnFontSize, ink, widths[index] - 6, align);
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
    page.drawRectangle({ x, y: top - height, width, height, color: fill });
    drawText(page, label, x + 7, top - 14, fonts.bold, 10, contrastColor(fill), width - 14);
    return top - height - 4;
  }
  async function drawTableFlow(doc, firstPage, report, fonts, theme, title, sectionTitle, columns, rows, x, top, tableWidth, options = {}, meta = null) {
    const rowHeight = options.rowHeight ?? 19;
    const headerHeight = (options.headerHeight ?? 25) + (options.headerGroups?.length ? (options.groupHeaderHeight ?? 14) : 0);
    const bottomLimit = options.bottomLimit ?? 340;
    const sectionHeight = sectionTitle ? 22 : 0;
    const continuationPages = [];
    let page = firstPage;
    let pageTop = top;
    let offset = 0;
    let lastY = top;
    do {
      if (pageTop - sectionHeight - headerHeight - rowHeight < bottomLimit && (page !== firstPage || pageTop === top)) {
        page = doc.addPage(portrait);
        continuationPages.push(page);
        pageTop = await drawHeader(doc, page, report, fonts, theme, title);
        pageTop = drawPromotionBanner(page, report, fonts, pageTop);
        if (meta) variantRule(page, page.getHeight() - 150, page.getWidth(), meta);
      }
      const tableTop = sectionTitle ? drawSectionBar(page, sectionTitle, x, pageTop, tableWidth, fonts, theme) : pageTop;
      const capacity = Math.max(1, Math.floor((tableTop - bottomLimit - headerHeight) / rowHeight));
      const count = rows.length ? Math.min(capacity, rows.length - offset) : 0;
      const batch = rows.slice(offset, offset + count);
      lastY = drawTable(page, columns, batch, x, tableTop, tableWidth, fonts, color(theme.primary_color), options);
      offset += count;
      if (offset < rows.length) {
        page = doc.addPage(portrait);
        continuationPages.push(page);
        pageTop = await drawHeader(doc, page, report, fonts, theme, title);
        pageTop = drawPromotionBanner(page, report, fonts, pageTop);
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
    page.drawRectangle({ x, y: y - 19, width, height: 31, color: pale, borderColor: accent, borderWidth: 0.7 });
    items.forEach(([label, value], index) => {
      const left = x + index * itemWidth;
      if (index) page.drawLine({ start: { x: left, y: y + 12 }, end: { x: left, y: y - 19 }, thickness: 0.5, color: accent });
      drawText(page, label, left + 5, y + 3, fonts.bold, 6.6, accent, itemWidth - 10);
      drawText(page, str(value), left + 5, y - 11, fonts.bold, 8.5, rgb(0.16, 0.17, 0.19), itemWidth - 10);
    });
  }
  function drawTotalsRow(page, label, value, x, top, width, fonts, accent, background) {
    const height = 18;
    const y = top - height;
    const fill = colorToPdf(accent);
    const white = rgb(1, 1, 1);
    page.drawRectangle({ x, y, width, height, color: fill, borderColor: fill, borderWidth: 0.7 });
    drawText(page, `TOTALS · ${label}`, x + 6, y + 5.5, fonts.bold, 6.7, white, width * 0.62);
    drawText(page, str(value), x + width * 0.64, y + 5.5, fonts.bold, 7, white, width * 0.34 - 8);
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
      alignedText(page, item, cellX + 2, top - 12.5, fonts.bold, fontSize, white, cellWidth - 4, "center");
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
      alignedText(page, text, cellX + 3, top - height / 2 - 2, fonts.bold, fontSize, white, cellWidth - 6, "center");
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
    visible[1] = `${visible[1].slice(0, Math.max(0, visible[1].length - 1))}…`;
    return visible;
  }
  async function drawFooter(doc, page, report, fonts, accent, options = {}) {
    const { width } = page.getSize();
    const school = report.school || {};
    const lineAccent = colorToPdf(options.lineAccent || accent);
    if (options.finalPage) {
      const dates = report.term_dates || {};
      const fees = report.fees || {};
      const ink = rgb(0.2, 0.2, 0.22);
      const isOLevel = levelCode(report.class?.level) === "O_LEVEL";
      if (isOLevel) {
        const asAt = report.printed_at || report.generated_at || new Date().toLocaleString();
        drawText(page, `Outstanding school fees balance is UGX ${str(fees.balance)} as at ${str(asAt)}`, 28, 145, fonts.regular, 6.2, ink, width - 56);
        drawText(page, "GRADES: A 100-80; B 79-70; C 69-60; D 59-40; E <40", 28, 134, fonts.regular, 6.2, ink, width - 56);
        drawText(page, "T = Topic; EOTI = end of term 1", 28, 123, fonts.regular, 6.2, ink, width - 56);
      }
      drawText(page, `School term/year: ${str(dates.current_term)} / ${str(dates.current_year)}   ·   Term ended: ${str(dates.term_ended_on)}`, 28, 244, fonts.regular, 6.2, ink, width - 56);
      drawText(page, `Next term fees: ${str(dates.next_term_fees)}   ·   Fees balance: ${str(fees.balance)}`, 28, 233, fonts.regular, 6.2, ink, width - 56);

      const remarkTop = 223;
      const remarkHeight = 68;
      const remarks = [
        ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment],
        ["Head Teacher's Remarks", report.head_teacher_comment],
        ["Principal's Remarks", report.principal_comment],
      ].slice(0, options.remarkCount === 2 ? 2 : 3);
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
            : /head teacher|infant/i.test(signerLabel) ? school.head_teacher_name
              : /department/i.test(signerLabel) ? school.head_of_department_name : "";
        const boxBottom = remarkTop - remarkHeight;
        page.drawRectangle({ x, y: boxBottom, width: remarkWidth, height: remarkHeight, borderColor: lineAccent, borderWidth: 0.6, color: color(options.backgroundColor || "#FFFFFF") });
        drawText(page, label, x + 4, remarkTop - 10, fonts.bold, 5.5, lineAccent, remarkWidth - 8);
        wrappedLines(str(content), fonts.italic, 5.2, remarkWidth - 8).forEach((line, lineIndex) => {
          drawText(page, line, x + 4, remarkTop - 20 - lineIndex * 6, fonts.italic, 5.2, ink, remarkWidth - 8);
        });
        page.drawLine({ start: { x: x + 5, y: 177 }, end: { x: x + remarkWidth - 5, y: 177 }, thickness: 0.55, color: lineAccent });
        if (signature && index === signatures.length - 1) placeImage(page, signature, x + (remarkWidth - 58) / 2, 178, 58, 12);
        drawText(page, str(person), x + 5, 165, fonts.bold, 5.6, ink, remarkWidth - 10);
        drawText(page, signerLabel, x + 5, 157, fonts.regular, 5.2, lineAccent, remarkWidth - 10);
      });
    }
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const pageNumber = doc.getPages().indexOf(page) + 1;
    const pageLabel = `Page ${pageNumber} of ${doc.getPages().length}`;
    if (address || school.website || school.report_footer_text) {
      drawText(page, str(address), 30, 59, fonts.regular, 5.1, rgb(0.32, 0.32, 0.34), width * 0.58);
      drawText(page, str(school.website || school.report_footer_text), width * 0.62, 59, fonts.regular, 5.1, rgb(0.32, 0.32, 0.34), width * 0.34);
    }
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: 24, color: colorToPdf(accent) });
    const footerTextColor = rgb(1, 1, 1);
    drawText(page, str(school.name || "School"), 32, 36, fonts.bold, 4.7, footerTextColor, 125);
    centered(page, `GRADING KEY: ${str(options.gradeKey || "—")}`, width / 2, 36, fonts.regular, 4.8, footerTextColor, width - 206);
    drawText(page, pageLabel, width - 87, 36, fonts.bold, 5.2, footerTextColor, 56);
  }
  async function drawAllFooters(doc, report, fonts, accent, options = {}) {
    const pages = doc.getPages();
    for (const [index, page] of pages.entries()) {
      await drawFooter(doc, page, report, fonts, accent, { ...options, finalPage: index === pages.length - 1 });
    }
  }
  function marks(report) {
    return (report.subjects || []).map((subject) => ({
      subject,
      mark: subject.mark || {},
    }));
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
    if (includeDefaults && result.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(result.length).forEach((name) => result.push([name, "", "", ""]));
    }
    return result;
  }
  function promotionStatus(report) {
    const decision = report.promotion_decision || report.promotion?.promotion_decision
      || report.suggested_decision || report.promotion?.suggested_decision;
    if (decision === "promoted") return `STATUS: PROMOTED TO ${str(report.promotion_next_class || report.promotion?.next_class || "NEXT CLASS")}`;
    if (decision === "repeat") return `STATUS: ADVISED TO REPEAT ${str(report.promotion_current_class || report.promotion?.current_class || report.class?.name || "CURRENT CLASS")}`;
    if (decision === "try_another") return "STATUS: TRY ANOTHER CLASS";
    return "STATUS: —";
  }
  function gradeScale(level) {
    return level === "A_LEVEL"
      ? "Grade scale: A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34"
      : "Grade scale: A >= 80 · B >= 70 · C >= 60 · D >= 50 · E < 50";
  }
  const asReport = (learnerOrReport, school, marksData) =>
    school
      ? { ...(marksData || {}), learner: learnerOrReport, school }
      : learnerOrReport;
  async function prepare(report, level, title) {
    if (!PDFDocument) throw new Error("The PDF library is unavailable; check your connection and reload.");
    const doc = await PDFDocument.create();
    doc.setTitle(`${title} — ${str(report.learner?.full_name)}`);
    doc.setAuthor(str(report.school?.name));
    const size = portrait;
    const page = doc.addPage(size);
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    const theme = window.ReportCardThemeEngine?.getTheme(level, report.level_theme || report.school?.level_theme) || {
      primary_color: level === "NURSERY" ? "#8BC34A" : level === "PRIMARY" ? "#1E5EB5" : level === "O_LEVEL" ? "#7B1FA2" : "#4B2E9E",
      accent_color: level === "NURSERY" ? "#DCEDC8" : level === "PRIMARY" ? "#BBDEFB" : level === "O_LEVEL" ? "#E1BEE7" : "#D1C4E9",
      background_color: "#F7F6FA",
    };
    const primary = color(theme.primary_color);
    const lineAccent = color(theme.accent_color);
    const headerY = await drawHeader(doc, page, report, fonts, theme, title);
    const y = drawPromotionBanner(page, report, fonts, headerY);
    return { doc, page, fonts, accent: primary, primary, lineAccent, backgroundColor: theme.background_color, theme, y, size };
  }

  async function renderNursery(learnerOrReport, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, "NURSERY", "Nursery Learning Report");
    const entries = marks(report);
    const areaRows = entries.map(({ subject, mark }) => [
      subject.name, num(mark.period_score ?? mark.pct100), str(mark.descriptor), str(mark.teacher_initials),
    ]);
    const x = 28;
    const tableWidth = page.getWidth() - 56;
    const areaFlow = await drawTableFlow(doc, page, report, fonts, theme, "Nursery Learning Report", "SUBJECTS • END OF TERM RESULTS", [
      { label: "Learning Area", weight: 2.1 }, { label: "Score /100", weight: 1 },
      { label: "Remark", weight: 1.5 }, { label: "Signature", weight: 1.1 },
    ], areaRows, x, y, tableWidth, { fontSize: 8, headerFontSize: 9, headerHeight: 28, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 });
    const summary = report.summary || {};
    drawTotalsRow(areaFlow.page, "Score", num(summary.total_score, 0), x, areaFlow.y - 1, tableWidth, fonts, lineAccent, theme.background_color);
    drawSummary(areaFlow.page, [
      ["Total score", num(summary.total_score, 0)],
      ["Position", `${str(summary.position)} of ${str(summary.class_size)}`],
    ], x, areaFlow.y - 33, tableWidth, fonts, accent);
    const activities = coCurricular(report, true);
    if (activities.length) {
      await drawTableFlow(doc, areaFlow.page, report, fonts, theme, "Nursery Learning Report", "Activities / Other Subjects", [
        { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
        { label: "Remark", weight: 1.3 }, { label: "Signature", weight: 1 },
      ], activities, x, areaFlow.y - 80, tableWidth, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    await drawAllFooters(doc, report, fonts, accent, { lineAccent, gradeKey: "—" });
    return doc.save();
  }

  async function renderPrimary(learnerOrReport, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, "PRIMARY", "Primary School Report");
    const entries = marks(report);
    const rows = entries.map(({ subject, mark }) => [
      subject.name, num(mark.period_score ?? mark.pct100), str(mark.identifier),
      mark.position ? `${mark.position} of ${str(mark.class_size)}` : "—",
      str(mark.descriptor), str(mark.teacher_initials),
    ]);
    const columns = [
        { label: "Subject", weight: 2.4 }, { label: "Marks", weight: 0.85, align: "center" },
        { label: "AGGR", weight: 0.7, align: "center" }, { label: "Position", weight: 1, align: "center" },
        { label: "Teacher's Remarks", weight: 2 }, { label: "Initials", weight: 0.9, align: "center" },
    ];
    let flow = await drawTableFlow(doc, page, report, fonts, theme, "Primary School Report", "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, y, page.getWidth() - 56, { rowHeight: 23, fontSize: 8, headerFontSize: 9, headerHeight: 28, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260, boldColumns: [0], italicColumns: [4], centerColumns: [1, 2, 3, 5], columnFontSizes: { 0: 11 } });
    const summary = report.summary || {};
    const totalsY = drawTableTotals(flow.page, [
      "TOTALS", num(summary.total_score, 0), num(summary.overall_aggregate ?? summary.total_aggregate ?? summary.overall_average),
      `${str(summary.position)} of ${str(summary.class_size)}`, promotionStatus(report), entries.find(({ mark }) => mark.teacher_initials)?.mark.teacher_initials || "—",
    ], 28, flow.y - 1, page.getWidth() - 56, columns, fonts, lineAccent);
    drawSummary(flow.page, [
      ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
      ["Average", num(summary.overall_average)],
      ["Grade", str(summary.overall_grade)],
    ], 28, totalsY - 8, page.getWidth() - 56, fonts, accent);
    const activities = coCurricular(report, true);
    if (activities.length) {
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, "Primary School Report", "Activities / Other Subjects", [
        { label: "SUBJECT", weight: 2 }, { label: "GR", weight: 0.9 },
        { label: "TEACHER'S REMARKS", weight: 1.8 }, { label: "INITIALS", weight: 0.8 },
      ], activities, 28, flow.y - 50, page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 18, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260, boldColumns: [0], italicColumns: [2] });
    }
    await drawAllFooters(doc, report, fonts, accent, { lineAccent, gradeKey: "Very Good — B  ·  Good — C  ·  Fair — D  ·  Still Weak — E" });
    return doc.save();
  }

  async function renderSecondary(learnerOrReport, level, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const title = level === "A_LEVEL" ? "A-Level Report" : "O-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, level, title);
    const entries = marks(report);
    const mean = (key, digits = 1) => {
      const values = entries.map(({ mark }) => Number(mark[key])).filter(Number.isFinite);
      return values.length ? num(values.reduce((sum, value) => sum + value, 0) / values.length, digits) : "—";
    };
    const overallGrade = str(report.summary?.overall_grade);
    const rows = entries.map(({ subject, mark }) => level === "A_LEVEL"
      ? [subject.code, subject.name, str(mark.paper_number), num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg), num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor), str(mark.teacher_initials)]
      : [subject.name, num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg, 0), num(mark.pct20), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor), str(mark.teacher_initials)]);
    const columns = level === "A_LEVEL" ? [
      { label: "CODE", weight: 0.7, align: "center" }, { label: "SUBJECT", weight: 1.3 }, { label: "PAPER", weight: 0.55, align: "center" },
      { label: "A1", weight: 0.48, align: "center" }, { label: "A2", weight: 0.48, align: "center" }, { label: "A3", weight: 0.48, align: "center" },
      { label: "AVG", weight: 0.55, align: "center" }, { label: "20%", weight: 0.55, align: "center" }, { label: "EOT", weight: 0.55, align: "center" },
      { label: "80%", weight: 0.55, align: "center" }, { label: "100%", weight: 0.6, align: "center" }, { label: "GRADE", weight: 0.58, align: "center" },
      { label: "COMMENT", weight: 1.15 }, { label: "TR", weight: 0.5, align: "center" },
    ] : [
      { label: "SUBJECT", weight: 1.9 }, { label: "T1", weight: 0.52, align: "center" },
      { label: "T2", weight: 0.52, align: "center" }, { label: "T3", weight: 0.52, align: "center" }, { label: "AS", weight: 0.58, align: "center" },
      { label: "FA (20)", weight: 0.72, align: "center" }, { label: "EOTI (80)", weight: 0.78, align: "center" },
      { label: "FINAL (100)", weight: 0.9, align: "center" }, { label: "GRADE", weight: 0.62, align: "center" },
      { label: "GRADE DESCRIPTOR", weight: 1.7 }, { label: "TR", weight: 0.9, align: "center" },
    ];
    let flow = await drawTableFlow(doc, page, report, fonts, theme, title, level === "O_LEVEL" ? "" : "TERM PERFORMANCE RECORDS", columns, rows, 28, y, page.getWidth() - 56, {
      rowHeight: level === "A_LEVEL" ? 18 : 17, fontSize: level === "A_LEVEL" ? 6 : 5.8, headerFontSize: level === "A_LEVEL" ? 6.2 : 6.1, headerHeight: 26, backgroundColor,
      accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
      boldColumns: [level === "A_LEVEL" ? 1 : 0], italicColumns: level === "A_LEVEL" ? [12] : [9],
      columnFontSizes: level === "A_LEVEL" ? { 1: 7.2 } : { 0: 6.5, 9: 5.2 },
      wrappedColumns: level === "O_LEVEL" ? [0, 9] : [],
      ...(level === "O_LEVEL" ? {
        headerGroups: [
          { label: "FORMATIVE ASSESSMENT", start: 1, end: 5 },
          { label: "SUMMATIVE ASSESSMENT", start: 6, end: 10 },
        ],
        rowSpanColumns: [0],
        groupHeaderFontSize: 6.2,
        boldColumns: [0],
        groupHeaderHeight: 14,
      } : {
        headerGroups: [
          { label: "FORMATIVE", start: 3, end: 7 },
          { label: "SUMMATIVE", start: 8, end: 10 },
        ],
        rowSpanColumns: [0, 1, 2, 11, 12, 13],
        groupHeaderFontSize: 7,
        groupHeaderHeight: 15,
      }),
    });
    const summary = report.summary || {};
    if (level === "O_LEVEL") {
      const identifier = str(summary.overall_identifier ?? summary.identifier);
      const totalsY = drawMergedTotals(flow.page, [
        { text: "OVERALL AVERAGE", span: 6 },
        { text: num(summary.overall_average), span: 1 },
        { text: "", span: 1 },
        { text: "LEVEL OF ACHIEVEMENT", span: 2 },
        { text: `RESULT ${identifier}`, span: 1 },
      ], 28, flow.y - 1, page.getWidth() - 56, columns, fonts, lineAccent, 5.5);
      const dates = report.term_dates || {};
      drawMergedTotals(flow.page, [
        { text: "NEXT TERM BEGINS", span: 2 },
        { text: str(dates.next_term_begins), span: 3 },
        { text: "Ends", span: 1 },
        { text: str(dates.next_term_ends || dates.next_term_ends_on), span: 5 },
      ], 28, totalsY, page.getWidth() - 56, columns, fonts, lineAccent, 5.6, 18);
    } else {
      const averages = [
        "", "AVERAGE SCORES", "", mean("a1"), mean("a2"), mean("a3"), mean("avg"),
        mean("pct20"), mean("eot"), mean("pct80"), mean("period_score") !== "—" ? mean("period_score") : mean("pct100"),
        overallGrade, str(summary.overall_achievement ?? summary.achievement), "",
      ];
      drawTableTotals(flow.page, averages, 28, flow.y - 1, page.getWidth() - 56, columns, fonts, lineAccent, 5.3);
      drawMergedTotals(flow.page, [
        { text: "Overall Identifier", span: 2 },
        { text: str(summary.overall_identifier ?? summary.identifier), span: 1 },
        { text: "Overall Achievement", span: 3 },
        { text: str(summary.overall_achievement ?? summary.achievement ?? summary.overall_average), span: 3 },
        { text: "Overall grade", span: 2 },
        { text: overallGrade, span: 3 },
      ], 28, flow.y - 25, page.getWidth() - 56, columns, fonts, lineAccent, 5.6);
    }
    const activities = coCurricular(report);
    if (activities.length) {
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
        { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
        { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
      ], activities, 28, flow.y - 90, page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    if (level === "A_LEVEL" && (report.projects || []).length) {
      const projectRows = report.projects.map((project) => [
        project.project_name, num(project.score), project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
        str(project.grade), str(project.remarks), str(project.teacher_initials),
      ]);
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "STUDENT'S PROJECTS WORK", [
        { label: "TERMLY PROJECT WORK", weight: 2.2 }, { label: "AVERAGE SCORE (10)", weight: 1.2 },
        { label: "OUT OF 100", weight: 1 }, { label: "GRADE", weight: 0.7 },
        { label: "REMARKS", weight: 1.8 }, { label: "TEACHER", weight: 0.9 },
      ], projectRows, 28, flow.y - (activities.length ? 75 : 53), page.getWidth() - 56, { fontSize: 7.2, headerFontSize: 6.3, headerHeight: 29, rowHeight: 22, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    await drawAllFooters(doc, report, fonts, accent, {
      lineAccent, remarkCount: 2, signatures: ["Class Teacher", "Head Teacher"],
      gradeKey: level === "O_LEVEL" ? "A 100-80 · B 79-70 · C 69-60 · D 59-40 · E <40" : gradeScale(level),
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
    if (meta.signatures) return meta.signatures;
    if (meta.lowerPrimarySignature && isLowerPrimary(report)) return ["Class Teacher", "Head of Infants", "Principal"];
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
    const title = level === "NURSERY" ? "Nursery Learning Report"
      : level === "PRIMARY" ? "Primary School Report"
        : level === "O_LEVEL" ? "O-Level Report" : "A-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y: headerY } = await prepare(report, level, title);
    const width = page.getWidth();
    variantRule(page, page.getHeight() - 150, width, meta);
    const entries = marks(report);
    let top = headerY - 4;

    if (level === "NURSERY") {
      if (meta.learnerFeeBar) top = drawLearnerFeeBar(page, report, top, fonts, accent, backgroundColor);
      const areaRows = entries.map(({ subject, mark }) => [subject.name, num(mark.period_score ?? mark.pct100), str(mark.descriptor), str(mark.teacher_initials)]);
      const x = 31;
      const panelWidth = width - 62;
      const flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", [
        { label: "Learning Area", weight: 2 }, { label: "Score /100", weight: 0.8 },
        { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
      ], areaRows, x, top, panelWidth, { fontSize: 7.8, headerFontSize: 8.6, headerHeight: 28, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 }, meta);
      let nextY = flow.y;
      const summary = report.summary || {};
      drawTotalsRow(flow.page, "Score", num(summary.total_score, 0), x, nextY - 1, panelWidth, fonts, lineAccent, theme.background_color);
      drawSummary(flow.page, [["Total score", num(summary.total_score, 0)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], x, nextY - 33, panelWidth, fonts, accent);
      nextY -= 73;
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
      const showPosition = String(meta.id) !== "3";
      const rows = entries.map(({ subject, mark }) => {
        const values = [
          subject.name, num(mark.period_score ?? mark.pct100), str(mark.identifier),
          ...(showPosition ? [mark.position ? `${mark.position} of ${str(mark.class_size)}` : "—"] : []),
          str(mark.descriptor), str(mark.teacher_initials),
        ];
        if (meta.blankForm) return [subject.name, "________", "___", ...(showPosition ? ["________"] : []), "________________", "___"];
        return values;
      });
      if (meta.printDate || meta.classAverageAge) {
        const averageAge = report.class_average_age ?? report.class?.average_age;
        const info = [
          meta.printDate ? `Print Date: ${new Date().toLocaleDateString()}` : "",
          meta.classAverageAge ? `Class Avg. Age: ${str(averageAge)}` : "",
        ].filter(Boolean).join("    ");
        top = variantBanner(page, info, top, fonts, accent, backgroundColor, width);
      }
      const columns = [
        { label: "Subject", weight: 2.1 }, { label: "Marks", weight: 0.85, align: "center" },
        { label: "AGGR", weight: 0.7, align: "center" }, ...(showPosition ? [{ label: "Position", weight: 1.05, align: "center" }] : []),
        { label: "Teacher's Remarks", weight: 1.8 }, { label: "Initials", weight: 0.75, align: "center" },
      ];
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, top, width - 56, { rowHeight: 23, fontSize: 8, headerFontSize: 9, headerHeight: 28, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260, boldColumns: [0], italicColumns: [showPosition ? 4 : 3], centerColumns: showPosition ? [1, 2, 3, 5] : [1, 2, 4], columnFontSizes: { 0: 11 } }, meta);
      const summary = report.summary || {};
      const initials = entries.find(({ mark }) => mark.teacher_initials)?.mark.teacher_initials || "—";
      const totalCells = showPosition
        ? ["TOTALS", num(summary.total_score, 0), num(summary.overall_aggregate ?? summary.total_aggregate ?? summary.overall_average), `${str(summary.position)} of ${str(summary.class_size)}`, promotionStatus(report), initials]
        : ["TOTALS", num(summary.total_score, 0), num(summary.overall_aggregate ?? summary.total_aggregate ?? summary.overall_average), promotionStatus(report), initials];
      const totalsY = drawTableTotals(flow.page, totalCells, 28, flow.y - 1, width - 56, columns, fonts, lineAccent);
      drawSummary(flow.page, [
        ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
        ["Average", num(summary.overall_average)],
        ["Grade", str(summary.overall_grade)],
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
      const columns = [
        { label: "SUBJECT", weight: 1.9 }, { label: "T1", weight: .52, align: "center" },
        { label: "T2", weight: .52, align: "center" }, { label: "T3", weight: .52, align: "center" }, { label: "AS", weight: .58, align: "center" },
        { label: "FA (20)", weight: .72, align: "center" }, { label: "EOTI (80)", weight: .78, align: "center" },
        { label: "FINAL (100)", weight: .9, align: "center" }, { label: "GRADE", weight: .62, align: "center" },
        { label: "GRADE DESCRIPTOR", weight: 1.7 }, { label: "TR", weight: .9, align: "center" },
      ];
      const rows = entries.map(({ subject, mark }) => [subject.name, num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg, 0), num(mark.pct20), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor), str(mark.teacher_initials)]);
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "", columns, rows, 28, nextY, width - 56, {
        rowHeight: 17, fontSize: 5.8, headerFontSize: 6.1, headerHeight: 26, groupHeaderHeight: 14, backgroundColor,
        accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
        boldColumns: [0], italicColumns: [9], columnFontSizes: { 0: 6.5, 9: 5.2 }, wrappedColumns: [0, 9],
        rowSpanColumns: [0], headerGroups: [
          { label: "FORMATIVE ASSESSMENT", start: 1, end: 5 },
          { label: "SUMMATIVE ASSESSMENT", start: 6, end: 10 },
        ],
      }, meta);
      const summary = report.summary || {};
      const totalsY = drawMergedTotals(flow.page, [
        { text: "OVERALL AVERAGE", span: 6 }, { text: num(summary.overall_average), span: 1 }, { text: "", span: 1 },
        { text: "LEVEL OF ACHIEVEMENT", span: 2 }, { text: `RESULT ${str(summary.overall_identifier ?? summary.identifier)}`, span: 1 },
      ], 28, flow.y - 1, width - 56, columns, fonts, lineAccent, 5.5);
      const dates = report.term_dates || {};
      drawMergedTotals(flow.page, [
        { text: "NEXT TERM BEGINS", span: 2 }, { text: str(dates.next_term_begins), span: 3 },
        { text: "Ends", span: 1 }, { text: str(dates.next_term_ends || dates.next_term_ends_on), span: 5 },
      ], 28, totalsY, width - 56, columns, fonts, lineAccent, 5.6, 18);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, flow.y - 75, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else {
      let nextY = top;
      if (meta.studentBanner && level !== "A_LEVEL") {
        const learner = report.learner || {};
        const info = `STUDENT INFORMATION   ${str(learner.full_name)}   ·   ${str(learner.reg_no)}   ·   ${str(report.class?.name)}   ·   ${str(report.term)} ${str(report.year)}`;
        nextY = variantBanner(page, info, nextY, fonts, accent, backgroundColor, width);
      }
      const rows = entries.map(({ subject, mark }) => [
        subject.code, subject.name, str(mark.paper_number), num(mark.a1), num(mark.a2), num(mark.a3),
        num(mark.avg), num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100),
        str(mark.grade), str(mark.descriptor), str(mark.teacher_initials),
      ]);
      const columns = [
        { label: "CODE", weight: .7, align: "center" }, { label: "SUBJECT", weight: 1.3 }, { label: "PAPER", weight: .55, align: "center" },
        { label: "A1", weight: .48, align: "center" }, { label: "A2", weight: .48, align: "center" }, { label: "A3", weight: .48, align: "center" },
        { label: "AVG", weight: .55, align: "center" }, { label: "20%", weight: .55, align: "center" }, { label: "EOT", weight: .55, align: "center" },
        { label: "80%", weight: .55, align: "center" }, { label: "100%", weight: .6, align: "center" }, { label: "GRADE", weight: .58, align: "center" },
        { label: "COMMENT", weight: 1.15 }, { label: "TR", weight: .5, align: "center" },
      ];
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "TERM PERFORMANCE RECORDS", columns, rows, 28, nextY, width - 56, {
        rowHeight: 18, fontSize: 6, headerFontSize: 6.2, headerHeight: 27, groupHeaderHeight: 15, backgroundColor,
        accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
        boldColumns: [1], italicColumns: [12], columnFontSizes: { 1: 7.2 },
        rowSpanColumns: [0, 1, 2, 11, 12, 13],
        headerGroups: [
          { label: "FORMATIVE", start: 3, end: 7 },
          { label: "SUMMATIVE", start: 8, end: 10 },
        ],
      }, meta);
      const summary = report.summary || {};
      const averages = [
        "", "AVERAGE SCORES", "", ...["a1", "a2", "a3", "avg", "pct20", "eot", "pct80", "pct100"].map((key) => {
          const values = entries.map(({ mark }) => Number(key === "pct100" ? mark.period_score ?? mark.pct100 : mark[key])).filter(Number.isFinite);
          return values.length ? num(values.reduce((sum, value) => sum + value, 0) / values.length) : "—";
        }),
        str(summary.overall_grade), str(summary.overall_achievement ?? summary.achievement), "",
      ];
      drawTableTotals(flow.page, averages, 28, flow.y - 1, width - 56, columns, fonts, lineAccent, 5.3);
      drawMergedTotals(flow.page, [
        { text: "Overall Identifier", span: 2 }, { text: str(summary.overall_identifier ?? summary.identifier), span: 1 },
        { text: "Overall Achievement", span: 3 }, { text: str(summary.overall_achievement ?? summary.achievement ?? summary.overall_average), span: 3 },
        { text: "Overall grade", span: 2 }, { text: str(summary.overall_grade), span: 3 },
      ], 28, flow.y - 25, width - 56, columns, fonts, lineAccent, 5.6);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, flow.y - 90, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
      const shouldShowProjects = (meta.projects || meta.apicultureExample) && (report.projects || []).length > 0;
      if (shouldShowProjects) {
        const projectRowsForTemplate = report.projects.map((project) => [
          project.project_name, num(project.score), project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
          str(project.grade), str(project.remarks), str(project.teacher_initials),
        ]);
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "STUDENT'S PROJECTS WORK", [
          { label: "TERMLY PROJECT WORK", weight: 1.8 }, { label: "AVERAGE SCORE (10)", weight: 1.2 },
          { label: "OUT OF 100", weight: 1 }, { label: "GRADE", weight: .7 },
          { label: "REMARKS", weight: 1.4 }, { label: "TEACHER", weight: .7 },
        ], projectRowsForTemplate, 28, flow.y - (activities.length ? 75 : 53), width - 56, { rowHeight: 23, fontSize: 7.2, headerFontSize: 6.2, headerHeight: 29, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    }
    await drawAllFooters(doc, report, fonts, accent, {
      lineAccent,
      remarkCount: level === "O_LEVEL" || level === "A_LEVEL" ? 2 : 3,
      signatures: level === "O_LEVEL" || level === "A_LEVEL" ? ["Class Teacher", "Head Teacher"] : signatureLabels(meta, report),
      gradeKey: level === "NURSERY" ? "—" : level === "PRIMARY" ? "Very Good — B  ·  Good — C  ·  Fair — D  ·  Still Weak — E" : gradeScale(level),
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

  async function render(report, classLevel, templateId = "1", includeStamp = true) {
    const stamp = includeStamp ? report?.stamp_config || report?.school?.stamp_config : null;
    const renderReport = { ...report, __includeStamp: Boolean(stamp && typeof stamp === "object" && Object.keys(stamp).length) };
    const level = levelCode(classLevel || renderReport.class?.level);
    const id = String(templateId || "1").replace(/^template[_-]?/i, "");
    const meta = templateMeta(level, id);
    const suppliedTheme = renderReport.level_theme || renderReport.school?.level_theme;
    const templateTheme = window.ReportCardThemeEngine?.getTemplateTheme?.(level, meta, suppliedTheme);
    const themedReport = templateTheme ? { ...renderReport, level_theme: templateTheme } : renderReport;
    let bytes;
    if (String(meta.id) === "1") {
      if (level === "NURSERY") bytes = await renderNursery(themedReport);
      else if (level === "PRIMARY") bytes = await renderPrimary(themedReport);
      else bytes = await renderSecondary(themedReport, level);
    } else {
      bytes = await renderVariant(themedReport, level, meta);
    }
    if (includeStamp && window.ReportCardStampRenderer) {
      return window.ReportCardStampRenderer.apply(bytes, themedReport, stamp);
    }
    return bytes;
  }

  window.ReportCardPdf = {
    render,
    renderVariant,
    renderNursery,
    renderPrimary,
    renderOLevel: (learner, school, marksData) => renderSecondary(learner, "O_LEVEL", school, marksData),
    renderALevel: (learner, school, marksData) => renderSecondary(learner, "A_LEVEL", school, marksData),
    createZip: zipStore,
  };
})();
