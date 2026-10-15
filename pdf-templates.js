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
    const contact = [school.phone, school.email, school.website].filter(Boolean).join(" · ");
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
    centered(page, `${displayTerm(report.term)} PROGRESS REPORT — ${str(report.year)}`, width / 2, titleY - 18, fonts.bold, 11, contrastColor(accent), width - margin * 2 - 12);
    const infoTop = titleY - 32;
    const infoRows = [
      [["Name", learner.full_name], ["Reg. no.", learner.reg_no], ["Sex", learner.sex], ["Age", learner.age]],
       [["Class", report.class?.name], ["House", learner.house], ["Absence", report.days_absent ?? report.absence], ["Position", report.summary?.position]],
       [["Out of", report.summary?.class_size], ["Term", displayTerm(report.term)], ["Year", report.year], ["Print date", new Date().toLocaleDateString()]],
    ];
    const gridX = margin;
    const gridWidth = width - margin * 2;
    const cellWidth = gridWidth / 4;
    const cellHeight = 24;
    infoRows.forEach((row, rowIndex) => row.forEach(([label, value], columnIndex) => {
      const cellX = gridX + columnIndex * cellWidth;
      const cellY = infoTop - (rowIndex + 1) * cellHeight;
      page.drawRectangle({ x: cellX, y: cellY, width: cellWidth, height: cellHeight, borderColor: accent, borderWidth: 0.45, color: rowIndex % 2 ? color(theme.background_color) : rgb(1, 1, 1) });
      const labelText = `${label}:`;
      const labelSize = 6.4;
      const valueSize = 6.5;
      const textX = cellX + 5;
      const labelWidth = fonts.bold.widthOfTextAtSize(labelText, labelSize);
      drawText(page, labelText, textX, cellY + 8.5, fonts.bold, labelSize, rgb(0.2, 0.2, 0.22), labelWidth);
      drawText(page, str(value), textX + labelWidth + 3, cellY + 8.5, fonts.regular, valueSize, rgb(0.2, 0.2, 0.22), cellWidth - labelWidth - 13);
    }));
    return infoTop - 3 * cellHeight - 12;
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
    const headerHeight = options.headerHeight ?? 25;
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
    let cellX = x;
    columns.forEach((column, index) => {
      drawText(page, column.label, cellX + 3, y - headerHeight + Math.max(6, (headerHeight - headerFontSize) / 2), fonts.bold, headerFontSize, headerTextColor, widths[index] - 6);
      cellX += widths[index];
    });
    y -= headerHeight;
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
        drawText(page, str(value), currentX + 3, y - rowHeight + 6, fonts.regular, fontSize, ink, widths[index] - 6);
        page.drawLine({ start: { x: currentX, y }, end: { x: currentX, y: y - rowHeight }, thickness: 0.35, color: border });
        currentX += widths[index];
      });
      page.drawLine({ start: { x: x + tableWidth, y }, end: { x: x + tableWidth, y: y - rowHeight }, thickness: 0.35, color: border });
      y -= rowHeight;
    }
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
    const headerHeight = options.headerHeight ?? 25;
    const bottomLimit = options.bottomLimit ?? 340;
    const sectionHeight = 22;
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
      const tableTop = drawSectionBar(page, sectionTitle, x, pageTop, tableWidth, fonts, theme);
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
    page.drawRectangle({ x, y, width, height, color: color(background || "#F4F1E8"), borderColor: colorToPdf(accent), borderWidth: 0.7 });
    drawText(page, `TOTALS · ${label}`, x + 6, y + 5.5, fonts.bold, 6.7, colorToPdf(accent), width * 0.62);
    drawText(page, str(value), x + width * 0.64, y + 5.5, fonts.bold, 7, rgb(0.16, 0.17, 0.19), width * 0.34 - 8);
    return y - 4;
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
      drawText(page, `School term/year: ${str(dates.current_term)} / ${str(dates.current_year)}   ·   Term ended: ${str(dates.term_ended_on)}`, 28, 244, fonts.regular, 6.2, ink, width - 56);
      drawText(page, `Next term fees: ${str(dates.next_term_fees)}   ·   Fees balance: ${str(fees.balance)}`, 28, 233, fonts.regular, 6.2, ink, width - 56);

      const remarkTop = 223;
      const remarkHeight = 24;
      const remarkWidth = (width - 56) / 3;
      const remarks = [
        ["Class teacher remarks", report.class_teacher_comment || report.suggested_comment],
        ["Head teacher remarks", report.head_teacher_comment],
        ["Principal remarks", report.principal_comment],
      ];
      remarks.forEach(([label, content], index) => {
        const x = 28 + index * remarkWidth;
        page.drawRectangle({ x, y: remarkTop - remarkHeight, width: remarkWidth, height: remarkHeight, borderColor: lineAccent, borderWidth: 0.6 });
        drawText(page, label, x + 4, remarkTop - 9, fonts.bold, 5.7, lineAccent, remarkWidth - 8);
        wrappedLines(str(content), fonts.regular, 5.5, remarkWidth - 8).forEach((line, lineIndex) => {
          drawText(page, line, x + 4, remarkTop - 17 - lineIndex * 6, fonts.regular, 5.5, ink, remarkWidth - 8);
        });
      });
      const signature = await embedImage(doc, school.report_signature_base64);
      const signatures = Array.isArray(options.signatures) && options.signatures.length
        ? options.signatures
        : ["Class Teacher", "Head Teacher", "Principal"];
      const signatureWidth = (width - 62 - 14 * (signatures.length - 1)) / signatures.length;
      page.drawRectangle({ x: 28, y: 156, width: width - 56, height: 38, borderColor: lineAccent, borderWidth: 0.8 });
      signatures.forEach((label, index) => {
        const left = 31 + index * (signatureWidth + 14);
        page.drawLine({ start: { x: left, y: 181 }, end: { x: left + signatureWidth, y: 181 }, thickness: 0.6, color: rgb(0.35, 0.35, 0.37) });
        const person = label === "Class Teacher" ? report.class?.class_teacher_name
          : /principal/i.test(label) ? school.principal_name
          : /head teacher|infant/i.test(label) ? school.head_teacher_name
              : /department/i.test(label) ? school.head_of_department_name : "";
        drawText(page, str(person), left, 169, fonts.regular, 6.1, ink, signatureWidth - 2);
        drawText(page, label, left, 159, fonts.bold, 6, lineAccent, signatureWidth - 2);
        if (signature && index === signatures.length - 1) placeImage(page, signature, left + (signatureWidth - 68) / 2, 182, 68, 10);
      });
      page.drawRectangle({ x: 28, y: 126, width: width - 56, height: 18, color: lineAccent });
      centered(page, `NEXT TERM BEGINS: ${str(dates.next_term_begins)}`, width / 2, 132, fonts.bold, 7.2, contrastColor(lineAccent), width - 68);
      page.drawRectangle({ x: 28, y: 80, width: width - 56, height: 18, color: lineAccent });
      drawText(page, "GRADING KEY", 33, 86, fonts.bold, 7, contrastColor(lineAccent), width - 160);
      drawText(page, str(options.gradeKey || "—"), 33, 67, fonts.regular, 6.1, rgb(0.2, 0.2, 0.22), width - 160);
    }
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const pageNumber = doc.getPages().indexOf(page) + 1;
    const pageLabel = `Page ${pageNumber} of ${doc.getPages().length}`;
    page.drawRectangle({ x: 28, y: 28, width: width - 56, height: 22, color: lineAccent });
    const footerTextColor = contrastColor(lineAccent);
    drawText(page, str(address), 32, 36, fonts.regular, 5.8, footerTextColor, width * 0.46);
    centered(page, pageLabel, width / 2, 36, fonts.bold, 5.8, footerTextColor, 70);
    drawText(page, str(school.website || school.motto || school.report_footer_text), width * 0.56, 36, fonts.regular, 5.8, footerTextColor, width * 0.38);
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
  function coCurricular(report) {
    const rows = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    return rows.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.progress ?? item.score,
      item.remark || item.descriptor,
      item.signature || item.teacher_initials,
    ]);
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
    const activities = coCurricular(report);
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
    const rows = marks(report).map(({ subject, mark }) => [
      subject.name, num(mark.period_score ?? mark.pct100), str(mark.identifier),
      mark.position ? `${mark.position} of ${str(mark.class_size)}` : "—",
      str(mark.descriptor), str(mark.teacher_initials),
    ]);
    let flow = await drawTableFlow(doc, page, report, fonts, theme, "Primary School Report", "SUBJECTS • END OF TERM RESULTS", [
      { label: "Subject", weight: 2.4 }, { label: "Marks", weight: 0.85 },
      { label: "AGGR", weight: 0.7 }, { label: "Position", weight: 1 },
      { label: "Teacher's Remarks", weight: 2 }, { label: "Initials", weight: 0.9 },
    ], rows, 28, y, page.getWidth() - 56, { rowHeight: 23, fontSize: 8, headerFontSize: 9, headerHeight: 28, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 });
    const summary = report.summary || {};
    drawTotalsRow(flow.page, "Subject score", num(summary.total_score, 0), 28, flow.y - 1, page.getWidth() - 56, fonts, lineAccent, theme.background_color);
    drawSummary(flow.page, [
      ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
      ["Average", num(summary.overall_average)],
      ["Grade", str(summary.overall_grade)],
    ], 28, flow.y - 33, page.getWidth() - 56, fonts, accent);
    const activities = coCurricular(report);
    if (activities.length) {
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, "Primary School Report", "Activities / Other Subjects", [
        { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
        { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
      ], activities, 28, flow.y - 50, page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    await drawAllFooters(doc, report, fonts, accent, { lineAccent, gradeKey: "Very Good — B  ·  Good — C  ·  Fair — D  ·  Still Weak — E" });
    return doc.save();
  }

  async function renderSecondary(learnerOrReport, level, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const title = level === "A_LEVEL" ? "A-Level Report" : "O-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, level, title);
    const rows = marks(report).map(({ subject, mark }) => level === "A_LEVEL"
      ? [subject.code, subject.name, str(mark.paper_number), num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg), num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor), str(mark.teacher_initials)]
      : [subject.code, subject.name, num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg), num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.teacher_initials)]);
    const columns = level === "A_LEVEL" ? [
      { label: "Code", weight: 0.7 }, { label: "Subject", weight: 1.3 }, { label: "Paper", weight: 0.55 },
      { label: "A1", weight: 0.48 }, { label: "A2", weight: 0.48 }, { label: "A3", weight: 0.48 },
      { label: "AVG", weight: 0.55 }, { label: "20%", weight: 0.55 }, { label: "EOT", weight: 0.55 },
      { label: "80%", weight: 0.55 }, { label: "100%", weight: 0.6 }, { label: "Grade", weight: 0.58 },
      { label: "Comment", weight: 1.15 }, { label: "TR", weight: 0.5 },
    ] : [
      { label: "Code", weight: 0.68 }, { label: "Subject", weight: 1.4 }, { label: "T1", weight: 0.52 },
      { label: "T2", weight: 0.52 }, { label: "T3", weight: 0.52 }, { label: "AS", weight: 0.58 },
      { label: "FA (20)", weight: 0.72 }, { label: "EOTI (80)", weight: 0.78 },
      { label: "FINAL (100)", weight: 0.9 }, { label: "Grade", weight: 0.62 }, { label: "TR", weight: 0.5 },
    ];
    let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, y, page.getWidth() - 56, {
      rowHeight: 23, fontSize: level === "A_LEVEL" ? 6 : 6.4, headerFontSize: level === "A_LEVEL" ? 6.2 : 6.6, headerHeight: 29, backgroundColor,
      accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340,
    });
    const summary = report.summary || {};
    drawTotalsRow(flow.page, "Overall average", num(summary.overall_average), 28, flow.y - 1, page.getWidth() - 56, fonts, lineAccent, theme.background_color);
    drawSummary(flow.page, [
      ["Overall average", num(summary.overall_average)],
      ["Overall grade", str(summary.overall_grade)],
      ["Position", `${str(summary.position)} of ${str(summary.class_size)}`],
      ["Result", summary.overall_average === null || summary.overall_average === undefined ? "Pending" : "Recorded"],
    ], 28, flow.y - 33, page.getWidth() - 56, fonts, accent);
    const activities = coCurricular(report);
    if (activities.length) {
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
        { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
        { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
      ], activities, 28, flow.y - 90, page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    if (level === "A_LEVEL" && (report.projects || []).length) {
      const projectRows = report.projects.map((project) => [
        project.project_name, num(project.score), num(project.out_of),
        project.percentage === null || project.percentage === undefined ? "—" : `${num(project.percentage)}%`,
        str(project.grade), str(project.remarks), str(project.teacher_initials),
      ]);
      flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Student Projects Work", [
        { label: "Project", weight: 2.2 }, { label: "Score", weight: 0.8 }, { label: "Out of", weight: 0.8 },
        { label: "Percent", weight: 0.9 }, { label: "Grade", weight: 0.8 }, { label: "Remarks", weight: 1.7 },
        { label: "Teacher initials", weight: 0.9 },
      ], projectRows, 28, flow.y - (activities.length ? 75 : 120), page.getWidth() - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 });
    }
    await drawAllFooters(doc, report, fonts, accent, { lineAccent, gradeKey: gradeScale(level) });
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
      const activities = coCurricular(report);
      if (activities.length) {
        await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, x, nextY, panelWidth, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else if (level === "PRIMARY") {
      const rows = entries.map(({ subject, mark }) => {
        const values = [
          subject.name, num(mark.period_score ?? mark.pct100), str(mark.identifier),
          mark.position ? `${mark.position} of ${str(mark.class_size)}` : "—",
          str(mark.descriptor), str(mark.teacher_initials),
        ];
        if (meta.blankForm) return [subject.name, "________", "___", "________", "________________", "___"];
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
        { label: "Subject", weight: 2.1 }, { label: "Marks", weight: 0.85 },
        { label: "AGGR", weight: 0.7 }, { label: "Position", weight: 1.05 },
        { label: "Teacher's Remarks", weight: 1.8 }, { label: "Initials", weight: 0.75 },
      ];
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, top, width - 56, { rowHeight: 23, fontSize: 8, headerFontSize: 9, headerHeight: 28, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 }, meta);
      const summary = report.summary || {};
      drawTotalsRow(flow.page, "Subject score", num(summary.total_score, 0), 28, flow.y - 1, width - 56, fonts, lineAccent, theme.background_color);
      drawSummary(flow.page, [
        ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
        ["Average", num(summary.overall_average)],
        ["Grade", str(summary.overall_grade)],
      ], 28, flow.y - 33, width - 56, fonts, accent);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, flow.y - 75, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else if (level === "O_LEVEL") {
      let nextY = top;
      if (meta.academicBanner) nextY = variantBanner(page, "ACADEMIC PERFORMANCE", nextY, fonts, accent, backgroundColor, width);
      const columns = [
        { label: "Code", weight: .68 }, { label: "Subject", weight: 1.4 }, { label: "T1", weight: .52 },
        { label: "T2", weight: .52 }, { label: "T3", weight: .52 }, { label: "AS", weight: .58 },
        { label: "FA (20)", weight: .72 }, { label: "EOTI (80)", weight: .78 },
        { label: "FINAL (100)", weight: .9 }, { label: "Grade", weight: .62 }, { label: "TR", weight: .5 },
      ];
      const rows = entries.map(({ subject, mark }) => [subject.code, subject.name, num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg), num(mark.pct20), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.teacher_initials)]);
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, nextY, width - 56, { rowHeight: 23, fontSize: 6.4, headerFontSize: 6.6, headerHeight: 29, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 }, meta);
      const summary = report.summary || {};
      drawTotalsRow(flow.page, "Overall average", num(summary.overall_average), 28, flow.y - 1, width - 56, fonts, lineAccent, theme.background_color);
       drawSummary(flow.page, [["Overall average", num(summary.overall_average)], ["Overall grade", str(summary.overall_grade)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], 28, flow.y - 33, width - 56, fonts, accent);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, flow.y - 75, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    } else {
      let nextY = top;
      if (meta.studentBanner) {
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
        { label: "Code", weight: .7 }, { label: "Subject", weight: 1.3 }, { label: "Paper", weight: .55 },
        { label: "A1", weight: .48 }, { label: "A2", weight: .48 }, { label: "A3", weight: .48 },
        { label: "AVG", weight: .55 }, { label: "20%", weight: .55 }, { label: "EOT", weight: .55 },
        { label: "80%", weight: .55 }, { label: "100%", weight: .6 }, { label: "Grade", weight: .58 },
        { label: "Comment", weight: 1.15 }, { label: "TR", weight: .5 },
      ];
      let flow = await drawTableFlow(doc, page, report, fonts, theme, title, "SUBJECTS • END OF TERM RESULTS", columns, rows, 28, nextY, width - 56, { rowHeight: 23, fontSize: 6, headerFontSize: 6.2, headerHeight: 29, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 340 }, meta);
      const summary = report.summary || {};
      drawTotalsRow(flow.page, "Overall average", num(summary.overall_average), 28, flow.y - 1, width - 56, fonts, lineAccent, theme.background_color);
      drawSummary(flow.page, [["Average", num(summary.overall_average)], ["Grade", str(summary.overall_grade)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], 28, flow.y - 33, width - 56, fonts, accent);
      const activities = coCurricular(report);
      if (activities.length) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, "Activities / Other Subjects", [
          { label: "Activity / Subject", weight: 2 }, { label: "Progress", weight: 0.9 },
          { label: "Remark", weight: 1.2 }, { label: "Signature", weight: 1 },
        ], activities, 28, flow.y - 90, width - 56, { fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
      const shouldShowProjects = (meta.projects || meta.apicultureExample) && (report.projects || []).length > 0;
      if (shouldShowProjects) {
        flow = await drawTableFlow(doc, flow.page, report, fonts, theme, title, meta.projectsHeading || "Student Projects Work", [
          { label: "Project", weight: 1.8 }, { label: "Score", weight: .65 }, { label: "Out of", weight: .65 },
          { label: "Percent", weight: .7 }, { label: "Grade", weight: .6 }, { label: "Remarks", weight: 1.4 }, { label: "Initials", weight: .7 },
        ], projectRows(report), 28, flow.y - (activities.length ? 75 : 120), width - 56, { rowHeight: 23, fontSize: 7.8, headerFontSize: 8.4, headerHeight: 27, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color, bottomLimit: 260 }, meta);
      }
    }
    await drawAllFooters(doc, report, fonts, accent, {
      lineAccent,
      signatures: signatureLabels(meta, report),
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
