(() => {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
  const landscape = [841.89, 595.28];
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
  async function drawHeader(doc, page, report, fonts, theme, title) {
    const { width, height } = page.getSize();
    const school = report.school || {};
    const learner = report.learner || {};
    const margin = 18;
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
    page.drawRectangle({
      x: margin + 1,
      y: height - 136,
      width: width - (margin + 1) * 2,
      height: 118,
      color: headerColor,
    });
    const logo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    placeImage(page, logo, 27, height - 92, 57, 57);
    placeImage(page, photo, width - 84, height - 103, 57, 70);
    const center = width / 2;
    const maxCenter = width - 205;
    centered(page, str(school.name), center, height - 38, fonts.bold, 15, headerText, maxCenter);
    if (school.motto) centered(page, school.motto, center, height - 53, fonts.italic, 8, headerText, maxCenter);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const contact = [school.phone, school.email, school.website].filter(Boolean).join(" · ");
    if (address) centered(page, address, center, height - 67, fonts.regular, 7, headerText, maxCenter);
    if (contact) centered(page, contact, center, height - 79, fonts.regular, 7, headerText, maxCenter);
    centered(page, title, center, height - 98, fonts.bold, 11, headerText, maxCenter);
    const learnerText = `${str(learner.full_name)}   ·   Reg. ${str(learner.reg_no)}   ·   ${str(report.class?.name)}   ·   ${str(report.term)} ${str(report.year)}`;
    centered(page, learnerText, center, height - 119, fonts.bold, 8, headerText, width - 150);
    page.drawLine({
      start: { x: margin + 2, y: height - 132 },
      end: { x: width - margin - 2, y: height - 132 },
      thickness: 2,
      color: colorToPdf(accent),
    });
    return height - 148;
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
      drawText(page, column.label, cellX + 3, y - headerHeight + 8, fonts.bold, fontSize, headerTextColor, widths[index] - 6);
      cellX += widths[index];
    });
    y -= headerHeight;
    for (const [rowIndex, row] of rows.entries()) {
      if (options.backgroundColor && rowIndex % 2 === 0) {
        page.drawRectangle({ x, y: y - rowHeight, width: tableWidth, height: rowHeight, color: pale, opacity: 0.48 });
      }
      page.drawLine({
        start: { x, y: y - rowHeight },
        end: { x: x + tableWidth, y: y - rowHeight },
        thickness: 0.4,
        color: border,
      });
      let currentX = x;
      row.forEach((value, index) => {
        drawText(page, str(value), currentX + 3, y - rowHeight + 6, fonts.regular, fontSize, ink, widths[index] - 6);
        currentX += widths[index];
      });
      y -= rowHeight;
    }
    return y;
  }
  function drawSummary(page, items, x, y, width, fonts, accent) {
    const itemWidth = width / items.length;
    items.forEach(([label, value], index) => {
      const left = x + index * itemWidth;
      drawText(page, label, left, y, fonts.bold, 7, accent, itemWidth - 8);
      drawText(page, str(value), left, y - 12, fonts.regular, 9, rgb(0.16, 0.17, 0.19), itemWidth - 8);
    });
  }
  async function drawFooter(doc, page, report, fonts, accent, options = {}) {
    const { width } = page.getSize();
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    const y = report.__includeStamp === true ? 110 : 46;
    const dividerY = report.__includeStamp === true ? 123 : y + 29;
    const termY = report.__includeStamp === true ? 144 : y + 16;
    const feesY = report.__includeStamp === true ? 133 : y + 7;
    const lineAccent = colorToPdf(options.lineAccent || accent);
    page.drawLine({
      start: { x: 28, y: dividerY },
      end: { x: width - 28, y: dividerY },
      thickness: 0.7,
      color: lineAccent,
    });
    const termText = `School term/year: ${str(dates.current_term)} ${str(dates.current_year)}   ·   Term ended: ${str(dates.term_ended_on)}   ·   Next term begins: ${str(dates.next_term_begins)}`;
    const feesText = `Next term fees: ${str(dates.next_term_fees)}   ·   Fees balance: ${str(fees.balance)}`;
    const teacherComment = report.class_teacher_comment || report.suggested_comment;
    if (teacherComment) {
      const commentY = report.__includeStamp === true ? 157 : 88;
      drawText(page, `Class teacher comment: ${teacherComment}`, 31, commentY, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), width - 62);
    }
    drawText(page, termText, 31, termY, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), width - 62);
    drawText(page, feesText, 31, feesY, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), width - 62);
    const signature = await embedImage(doc, school.report_signature_base64);
    const signatures = Array.isArray(options.signatures) && options.signatures.length
      ? options.signatures
      : ["Class Teacher", "Head Teacher / Principal"];
    const signatureWidth = (width - 62 - 14 * (signatures.length - 1)) / signatures.length;
    signatures.forEach((label, index) => {
      const left = 31 + index * (signatureWidth + 14);
      page.drawLine({
        start: { x: left, y },
        end: { x: left + signatureWidth, y },
        thickness: 0.6,
        color: rgb(0.35, 0.35, 0.37),
      });
      const person = label === "Class Teacher"
        ? report.class?.class_teacher_name
        : /principal|head teacher/i.test(label)
          ? school.principal_name || school.head_teacher_name
          : /department/i.test(label)
            ? school.head_of_department_name
            : "";
      drawText(page, str(person || ""), left, y - 11, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), signatureWidth - 2);
      drawText(page, label, left, y - 20, fonts.bold, 6.5, lineAccent, signatureWidth - 2);
      if (signature && index === signatures.length - 1) placeImage(page, signature, left + (signatureWidth - 75) / 2, y + 2, 75, 28);
    });
    if (school.report_footer_text && report.__includeStamp !== true) {
      centered(page, school.report_footer_text, width / 2, 26, fonts.regular, 6.5, rgb(0.32, 0.32, 0.34), width - 80);
    }
  }
  function marks(report) {
    return (report.subjects || []).map((subject) => ({
      subject,
      mark: subject.mark || {},
    }));
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
    const size = level === "NURSERY" ? portrait : landscape;
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
    const areas = entries.slice(0, 5);
    const areaRows = Array.from({ length: 5 }, (_, index) => {
      const entry = areas[index];
      return [
        entry?.subject.name || `Learning area ${index + 1}`,
        num(entry?.mark.period_score ?? entry?.mark.pct100),
        entry?.mark.descriptor || "—",
      ];
    });
    const x = 31;
    const panelGap = 17;
    const panelWidth = (page.getWidth() - 62 - panelGap) / 2;
    drawText(page, "Learning areas", x, y - 2, fonts.bold, 9, accent, panelWidth);
    drawTable(page, [
      { label: "Learning area", weight: 2.1 }, { label: "Score /100", weight: 1 },
      { label: "Remark", weight: 1.5 },
    ], areaRows, x, y - 9, panelWidth, fonts, accent, { fontSize: 7.5, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
    const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes/Stories", "Music", "Health Habits", "Toilet Habits"];
    const activityRows = activities.map((activity) => [activity, "—", "—"]);
    const rightX = x + panelWidth + panelGap;
    drawText(page, "Activities", rightX, y - 2, fonts.bold, 9, accent, panelWidth);
    drawTable(page, [
      { label: "Activity", weight: 2.1 }, { label: "Progress", weight: 1 },
      { label: "Remark", weight: 1.5 },
    ], activityRows, rightX, y - 9, panelWidth, fonts, accent, { fontSize: 7.5, rowHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
    const summary = report.summary || {};
    drawSummary(page, [
      ["Total score", num(summary.total_score, 0)],
      ["Position", `${str(summary.position)} of ${str(summary.class_size)}`],
    ], x, 220, page.getWidth() - 62, fonts, accent);
    await drawFooter(doc, page, report, fonts, accent, { lineAccent });
    return doc.save();
  }

  async function renderPrimary(learnerOrReport, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, "PRIMARY", "Primary School Report");
    const rows = marks(report).map(({ subject, mark }) => [
      subject.name, num(mark.period_score ?? mark.pct100), str(mark.identifier),
      mark.position ? `${mark.position} of ${mark.class_size}` : "—",
      str(mark.descriptor), str(mark.teacher_initials),
    ]);
    let nextY = drawTable(page, [
      { label: "Subject", weight: 2.4 }, { label: "Marks", weight: 0.85 },
      { label: "Aggr", weight: 0.7 }, { label: "Position", weight: 1 },
      { label: "Remarks", weight: 2 }, { label: "Initials", weight: 0.9 },
    ], rows, 30, y, page.getWidth() - 60, fonts, accent, { rowHeight: 19, fontSize: 7.5, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
    const summary = report.summary || {};
    drawSummary(page, [
      ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
      ["Average", num(summary.overall_average)],
      ["Grade", str(summary.overall_grade)],
    ], 34, nextY - 25, page.getWidth() - 68, fonts, accent);
    drawText(page, "Legend: Very Good — B · Good — C · Fair — D · Still Weak — E", 34, nextY - 61, fonts.regular, 7, accent, page.getWidth() - 70);
    const signatures = ["Class Teacher", "Head of Infants", "Principal"];
    signatures.forEach((label, index) => {
      const sx = 35 + index * ((page.getWidth() - 100) / 3);
      page.drawLine({ start: { x: sx, y: 97 }, end: { x: sx + 155, y: 97 }, thickness: 0.6, color: rgb(0.35, 0.35, 0.37) });
      const name = index === 0 ? report.class?.class_teacher_name : index === 2 ? report.school?.principal_name : "";
      drawText(page, str(name || ""), sx, 87, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), 150);
      drawText(page, label, sx, 77, fonts.bold, 6.5, accent, 150);
    });
    await drawFooter(doc, page, report, fonts, accent, { lineAccent });
    return doc.save();
  }

  async function renderSecondary(learnerOrReport, level, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const title = level === "A_LEVEL" ? "A-Level Report" : "O-Level Report";
    const { doc, page, fonts, accent, lineAccent, backgroundColor, theme, y } = await prepare(report, level, title);
    const rows = marks(report).map(({ subject, mark }) => [
      subject.code, subject.name,
      ...(level === "A_LEVEL" ? [str(mark.paper_number)] : []),
      num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg),
      num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100),
      str(mark.identifier), str(mark.grade), str(mark.descriptor), str(mark.teacher_initials),
    ]);
    const columns = [
      { label: "Code", weight: 0.72 }, { label: "Subject", weight: 1.45 },
      ...(level === "A_LEVEL" ? [{ label: "Paper", weight: 0.65 }] : []),
      { label: "A1", weight: 0.55 }, { label: "A2", weight: 0.55 },
      { label: "A3", weight: 0.55 }, { label: "AVG", weight: 0.65 },
      { label: "20%", weight: 0.65 }, { label: "EOT", weight: 0.65 },
      { label: "80%", weight: 0.65 }, { label: "100%", weight: 0.7 },
      { label: "Ident", weight: 0.66 }, { label: "Grade", weight: 0.65 },
      { label: "Descriptor", weight: 1.18 }, { label: "TR", weight: 0.55 },
    ];
    let nextY = drawTable(page, columns, rows, 28, y, page.getWidth() - 56, fonts, accent, {
      rowHeight: 19, fontSize: 6.6, headerHeight: 23, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color,
    });
    const summary = report.summary || {};
    drawSummary(page, [
      ["Overall average", num(summary.overall_average)],
      ["Overall grade", str(summary.overall_grade)],
      ["Position", `${str(summary.position)} of ${str(summary.class_size)}`],
      ["Result", summary.overall_average === null ? "Pending" : "Recorded"],
    ], 32, nextY - 23, page.getWidth() - 64, fonts, accent);
    drawText(page, gradeScale(level), 32, nextY - 58, fonts.regular, 6.7, accent, page.getWidth() - 64);
    drawText(page, "Identifier: 3 = AVG >= 2.5 · 2 = AVG >= 1.5 · 1 = AVG < 1.5", 32, nextY - 70, fonts.regular, 6.7, accent, page.getWidth() - 64);

    if (level === "A_LEVEL") {
      const projectRows = (report.projects || []).length
        ? report.projects.map((project) => [
            project.project_name, num(project.score), num(project.out_of),
            project.percentage === null ? "—" : `${num(project.percentage)}%`,
            str(project.grade), str(project.remarks), str(project.teacher_initials),
          ])
        : [["No projects recorded", "—", "—", "—", "—", "—", "—"]];
      nextY -= 91;
      if (nextY < 130) {
        const nextPage = doc.addPage(landscape);
        const nextTitle = "A-Level Projects";
        const nextTop = await drawHeader(doc, nextPage, report, fonts, theme, nextTitle);
        drawText(nextPage, "Projects", 30, nextTop - 2, fonts.bold, 9, accent, 200);
        drawTable(nextPage, [
          { label: "Project", weight: 2.2 }, { label: "Score", weight: 0.8 },
          { label: "Out of", weight: 0.8 }, { label: "Percent", weight: 0.9 },
          { label: "Grade", weight: 0.8 }, { label: "Remarks", weight: 1.7 },
          { label: "Teacher initials", weight: 0.9 },
        ], projectRows, 30, nextTop - 10, nextPage.getWidth() - 60, fonts, accent, { fontSize: 7.4, rowHeight: 19, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
        await drawFooter(doc, nextPage, report, fonts, accent, { lineAccent });
      } else {
        drawText(page, "Projects", 30, nextY, fonts.bold, 9, accent, 200);
        drawTable(page, [
          { label: "Project", weight: 2.2 }, { label: "Score", weight: 0.8 },
          { label: "Out of", weight: 0.8 }, { label: "Percent", weight: 0.9 },
          { label: "Grade", weight: 0.8 }, { label: "Remarks", weight: 1.7 },
          { label: "Teacher initials", weight: 0.9 },
          ], projectRows, 30, nextY - 8, page.getWidth() - 60, fonts, accent, { fontSize: 7.4, rowHeight: 17, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      }
    }
    await drawFooter(doc, page, report, fonts, accent, { lineAccent });
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
    if (meta.signatures) return meta.signatures;
    if (meta.lowerPrimarySignature && isLowerPrimary(report)) return ["Class Teacher", "Head of Infants", "Principal"];
    if (meta.variant === "primary_silver") return ["Class Teacher", "Head of Department", "Principal"];
    return ["Class Teacher", "Head Teacher / Principal"];
  }

  function isLowerPrimary(report) {
    return /(^|\b)(P[1-3]|PRIMARY\s*[1-3]|PRIMARY\s+(ONE|TWO|THREE))(\b|$)/i.test(String(report.class?.name || ""));
  }

  function projectRows(report, includeExample = false) {
    const projects = report.projects || [];
    if (projects.length) return projects.map((project) => [
      project.project_name,
      num(project.score),
      num(project.out_of),
      project.percentage === null || project.percentage === undefined
        ? project.out_of && Number.isFinite(Number(project.score)) ? `${num((Number(project.score) / Number(project.out_of)) * 100)}%` : "—"
        : `${num(project.percentage)}%`,
      str(project.grade),
      str(project.remarks),
      str(project.teacher_initials),
    ]);
    return [[includeExample ? "No projects recorded (example: Apiculture)" : "No projects recorded", "—", "—", "—", "—", "—", "—"]];
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
      if (meta.photoPlaceholder && !report.learner?.photo_base64) {
        page.drawRectangle({ x: width - 86, y: page.getHeight() - 107, width: 58, height: 70, borderColor: lineAccent, borderWidth: 1 });
        centered(page, "Learner Photo", width - 57, page.getHeight() - 72, fonts.regular, 5.5, accent, 52);
      }
      const areas = entries.slice(0, 5);
      const areaRows = Array.from({ length: 5 }, (_, index) => {
        const entry = areas[index];
        return [entry?.subject.name || `Learning area ${index + 1}`, num(entry?.mark.period_score ?? entry?.mark.pct100), str(entry?.mark.descriptor)];
      });
      const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes/Stories", "Music", "Health Habits", "Toilet Habits"];
      const activityRows = activities.map((activity) => [activity, "—", "—"]);
      const x = 31;
      const gap = 15;
      const panelWidth = (width - 62 - gap) / 2;
      drawText(page, "Learning Areas", x, top - 2, fonts.bold, 9, accent, panelWidth);
      const afterAreas = drawTable(page, [
        { label: "Learning area", weight: 2 }, { label: "Score", weight: 0.8 }, { label: "Remark", weight: 1.2 },
      ], areaRows, x, top - 9, panelWidth, fonts, accent, { fontSize: 6.8, rowHeight: 19, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      const rightX = x + panelWidth + gap;
      drawText(page, "Activities", rightX, top - 2, fonts.bold, 9, accent, panelWidth);
      drawTable(page, [
        { label: "Activity", weight: 1.7 }, { label: "Progress", weight: 0.9 }, { label: "Remark", weight: 1.2 },
      ], activityRows, rightX, top - 9, panelWidth, fonts, accent, { fontSize: 6.5, rowHeight: 15, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      let bottom = Math.min(afterAreas, top - 25 - 10 * 15);
      if (meta.requirements) {
        const requirementsY = Math.max(190, bottom - 23);
        drawText(page, "School Requirements", 32, requirementsY, fonts.bold, 8.5, accent, width - 64);
        drawText(page, str(report.school?.school_requirements || "Exercise books · pencils · ruler · crayons · school diary"), 32, requirementsY - 12, fonts.regular, 7, accent, width - 64);
        bottom = requirementsY - 25;
      }
      const summary = report.summary || {};
      drawSummary(page, [["Total score", num(summary.total_score, 0)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], 32, Math.max(180, bottom - 22), width - 64, fonts, accent);
      await drawFooter(doc, page, report, fonts, accent, { lineAccent, signatures: signatureLabels(meta, report) });
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
        { label: meta.aggregation ? "AGGR" : "Ident", weight: 0.7 },
        { label: meta.subjectPosition ? "Position" : "Result", weight: 1.05 },
        { label: "Remarks", weight: 1.8 }, { label: "Initials", weight: 0.75 },
      ];
      let nextY = drawTable(page, columns, rows, 30, top, width - 60, fonts, accent, { rowHeight: 19, fontSize: 7.1, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      const summary = report.summary || {};
      drawSummary(page, [
        ["Overall position", `${str(summary.position)} of ${str(summary.class_size)}`],
        ["Average", num(summary.overall_average)],
        ["Grade", str(summary.overall_grade)],
      ], 34, nextY - 22, width - 68, fonts, accent);
      await drawFooter(doc, page, report, fonts, accent, { lineAccent, signatures: signatureLabels(meta, report) });
    } else if (level === "O_LEVEL") {
      let nextY = top;
      if (meta.academicBanner) nextY = variantBanner(page, "ACADEMIC PERFORMANCE", nextY, fonts, accent, backgroundColor, width);
      if (meta.twoSections) {
        drawText(page, "FORMATIVE", 30, nextY - 2, fonts.bold, 8.5, accent, width - 60);
        nextY = drawTable(page, [
          { label: "Code", weight: 0.7 }, { label: "Subject", weight: 1.7 }, { label: "A1", weight: 0.55 },
          { label: "A2", weight: 0.55 }, { label: "A3", weight: 0.55 }, { label: "AVG", weight: 0.65 }, { label: "FA (20)", weight: 0.7 },
        ], entries.map(({ subject, mark }) => [subject.code, subject.name, num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg), num(mark.pct20)]), 30, nextY - 9, width - 60, fonts, accent, { rowHeight: 18, fontSize: 6.6, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color }) - 14;
        drawText(page, "SUMMATIVE", 30, nextY, fonts.bold, 8.5, accent, width - 60);
        nextY = drawTable(page, [
          { label: "Code", weight: 0.7 }, { label: "Subject", weight: 1.7 }, { label: "EOT", weight: 0.65 },
          { label: "EOTI (80)", weight: 0.8 }, { label: "FINAL (100)", weight: 0.9 }, { label: "Grade", weight: 0.65 }, { label: "Descriptor", weight: 1.2 },
        ], entries.map(({ subject, mark }) => [subject.code, subject.name, num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor)]), 30, nextY - 8, width - 60, fonts, accent, { rowHeight: 18, fontSize: 6.5, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      } else {
        const columns = meta.formativeFinal
          ? [{ label: "Code", weight: .7 }, { label: "Subject", weight: 1.8 }, { label: "FA (20)", weight: .8 }, { label: "EOT", weight: .7 }, { label: "FINAL (100)", weight: .9 }, { label: "Grade", weight: .7 }, { label: "Descriptor", weight: 1.3 }]
          : meta.formativeEotiFinal
            ? [{ label: "Code", weight: .7 }, { label: "Subject", weight: 1.8 }, { label: "FA (20)", weight: .8 }, { label: "EOTI (80)", weight: .8 }, { label: "FINAL (100)", weight: .9 }, { label: "Grade", weight: .7 }, { label: "Descriptor", weight: 1.3 }]
            : [{ label: "Code", weight: .7 }, { label: "Subject", weight: 1.7 }, { label: "AW Code", weight: .8 }, { label: "A1", weight: .5 }, { label: "A2", weight: .5 }, { label: "A3", weight: .5 }, { label: "FINAL", weight: .8 }, { label: "Grade", weight: .65 }, { label: "Descriptor", weight: 1.1 }];
        const rows = entries.map(({ subject, mark }) => meta.formativeFinal
          ? [subject.code, subject.name, num(mark.pct20), num(mark.eot), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor)]
          : meta.formativeEotiFinal
            ? [subject.code, subject.name, num(mark.pct20), num(mark.pct80), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor)]
            : [subject.code, subject.name, str(mark.aw_code || subject.aw_code), num(mark.a1), num(mark.a2), num(mark.a3), num(mark.period_score ?? mark.pct100), str(mark.grade), str(mark.descriptor)]);
        nextY = drawTable(page, columns, rows, 30, nextY, width - 60, fonts, accent, { rowHeight: 19, fontSize: 6.6, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      }
      const summary = report.summary || {};
      drawSummary(page, [["Overall average", num(summary.overall_average)], ["Overall grade", str(summary.overall_grade)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], 32, nextY - 18, width - 64, fonts, accent);
      await drawFooter(doc, page, report, fonts, accent, { lineAccent });
    } else {
      let nextY = top;
      if (meta.studentBanner) {
        const learner = report.learner || {};
        const info = `STUDENT INFORMATION   ${str(learner.full_name)}   ·   ${str(learner.reg_no)}   ·   ${str(report.class?.name)}   ·   ${str(report.term)} ${str(report.year)}`;
        nextY = variantBanner(page, info, nextY, fonts, accent, backgroundColor, width);
      }
      const rows = entries.map(({ subject, mark }) => [
        subject.code, subject.name, str(mark.paper_number),
        num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.period_score ?? mark.pct100),
        str(mark.grade), str(mark.descriptor),
      ]);
      let columns = [
        { label: "Code", weight: .7 }, { label: "Subject", weight: 1.4 }, { label: "Paper", weight: .55 },
        { label: "Formative", weight: .8 }, { label: "EOT", weight: .6 }, { label: "Summative", weight: .8 },
        { label: "Final", weight: .7 }, { label: "Grade", weight: .55 }, { label: "Descriptor", weight: 1.1 },
      ];
      nextY = drawTable(page, columns, rows, 28, nextY, width - 56, fonts, accent, { rowHeight: 18, fontSize: 6.4, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
      const summary = report.summary || {};
      drawSummary(page, [["Average", num(summary.overall_average)], ["Grade", str(summary.overall_grade)], ["Position", `${str(summary.position)} of ${str(summary.class_size)}`]], 32, nextY - 18, width - 64, fonts, accent);
      let projectsY = nextY - 61;
      const shouldShowProjects = meta.projects || meta.apicultureExample;
      if (shouldShowProjects) {
        if (projectsY < 160) {
          const projectPage = doc.addPage(landscape);
          const projectTop = await drawHeader(doc, projectPage, report, fonts, theme, "A-Level Projects");
          projectsY = projectTop - 4;
          variantRule(projectPage, projectPage.getHeight() - 150, projectPage.getWidth(), meta);
          drawText(projectPage, meta.projectsHeading || (meta.apicultureExample ? "Student Projects Work" : "Projects"), 30, projectsY, fonts.bold, 9, accent, projectPage.getWidth() - 60);
          drawTable(projectPage, [
            { label: "Project", weight: 1.8 }, { label: "Score", weight: .65 }, { label: "Out of", weight: .65 },
            { label: "Percent", weight: .7 }, { label: "Grade", weight: .6 }, { label: "Remarks", weight: 1.4 }, { label: "Initials", weight: .7 },
          ], projectRows(report, meta.apicultureExample), 30, projectsY - 8, projectPage.getWidth() - 60, fonts, accent, { rowHeight: 18, fontSize: 6.8, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
          await drawFooter(doc, projectPage, report, fonts, accent, { lineAccent });
        } else {
          drawText(page, meta.projectsHeading || (meta.apicultureExample ? "Student Projects Work" : "Projects"), 30, projectsY, fonts.bold, 9, accent, width - 60);
          drawTable(page, [
            { label: "Project", weight: 1.8 }, { label: "Score", weight: .65 }, { label: "Out of", weight: .65 },
            { label: "Percent", weight: .7 }, { label: "Grade", weight: .6 }, { label: "Remarks", weight: 1.4 }, { label: "Initials", weight: .7 },
          ], projectRows(report, meta.apicultureExample), 30, projectsY - 8, width - 60, fonts, accent, { rowHeight: 18, fontSize: 6.8, backgroundColor, accentColor: lineAccent, headerColor: theme.table_header_color, headerTextColor: theme.table_header_text_color });
        }
      }
      await drawFooter(doc, page, report, fonts, accent, { lineAccent });
    }
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
