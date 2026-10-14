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
  const themeHex = (theme) => ({
    blue: "#1B5E20",
    maroon: "#7B1FA2",
    mixed: "#4B2E9E",
  }[(theme || "blue").toLowerCase()] || "#1B5E20");
  const color = (hex) => {
    const safe = hex.replace("#", "");
    return rgb(
      parseInt(safe.slice(0, 2), 16) / 255,
      parseInt(safe.slice(2, 4), 16) / 255,
      parseInt(safe.slice(4, 6), 16) / 255,
    );
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
  async function drawHeader(doc, page, report, fonts, accent, title) {
    const { width, height } = page.getSize();
    const school = report.school || {};
    const learner = report.learner || {};
    const margin = 18;
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
      borderColor: accent,
      borderWidth: 1.5,
    });
    const logo = await embedImage(doc, school.logo_base64);
    const photo = await embedImage(doc, learner.photo_base64);
    placeImage(page, logo, 27, height - 92, 57, 57);
    placeImage(page, photo, width - 84, height - 103, 57, 70);
    const center = width / 2;
    const maxCenter = width - 205;
    centered(page, str(school.name), center, height - 38, fonts.bold, 15, accent, maxCenter);
    if (school.motto) centered(page, school.motto, center, height - 53, fonts.italic, 8, rgb(0.28, 0.28, 0.3), maxCenter);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const contact = [school.phone, school.email, school.website].filter(Boolean).join(" · ");
    if (address) centered(page, address, center, height - 67, fonts.regular, 7, rgb(0.3, 0.3, 0.32), maxCenter);
    if (contact) centered(page, contact, center, height - 79, fonts.regular, 7, rgb(0.3, 0.3, 0.32), maxCenter);
    centered(page, title, center, height - 98, fonts.bold, 11, accent, maxCenter);
    const learnerText = `${str(learner.full_name)}   ·   Reg. ${str(learner.reg_no)}   ·   ${str(report.class?.name)}   ·   ${str(report.term)} ${str(report.year)}`;
    centered(page, learnerText, center, height - 119, fonts.bold, 8, rgb(0.13, 0.14, 0.16), width - 150);
    page.drawLine({
      start: { x: margin + 2, y: height - 132 },
      end: { x: width - margin - 2, y: height - 132 },
      thickness: 2,
      color: accent,
    });
    return height - 148;
  }
  function drawTable(page, columns, rows, x, top, tableWidth, fonts, accent, options = {}) {
    const headerHeight = options.headerHeight ?? 25;
    const rowHeight = options.rowHeight ?? 19;
    const fontSize = options.fontSize ?? 7;
    const availableFractions = columns.map((column) => column.weight || 1);
    const totalWeight = availableFractions.reduce((sum, weight) => sum + weight, 0);
    const widths = availableFractions.map((weight) => tableWidth * weight / totalWeight);
    const pale = rgb(0.94, 0.96, 0.94);
    const ink = rgb(0.17, 0.18, 0.2);
    let y = top;
    page.drawRectangle({ x, y: y - headerHeight, width: tableWidth, height: headerHeight, color: pale });
    let cellX = x;
    columns.forEach((column, index) => {
      drawText(page, column.label, cellX + 3, y - headerHeight + 8, fonts.bold, fontSize, accent, widths[index] - 6);
      cellX += widths[index];
    });
    y -= headerHeight;
    for (const row of rows) {
      page.drawLine({
        start: { x, y: y - rowHeight },
        end: { x: x + tableWidth, y: y - rowHeight },
        thickness: 0.4,
        color: rgb(0.84, 0.85, 0.87),
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
  async function drawFooter(doc, page, report, fonts, accent) {
    const { width } = page.getSize();
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    const y = 46;
    page.drawLine({
      start: { x: 28, y: y + 29 },
      end: { x: width - 28, y: y + 29 },
      thickness: 0.7,
      color: accent,
    });
    const footerText = `Term ended: ${str(dates.term_ended_on)}   ·   Next term begins: ${str(dates.next_term_begins)}   ·   Next term fees: ${str(dates.next_term_fees)}   ·   Fees balance: ${str(fees.balance)}`;
    drawText(page, footerText, 31, y + 16, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), width - 62);
    const signature = await embedImage(doc, school.report_signature_base64);
    const leftX = 60;
    const rightX = width - 250;
    page.drawLine({ start: { x: leftX, y }, end: { x: leftX + 155, y }, thickness: 0.6, color: rgb(0.35, 0.35, 0.37) });
    page.drawLine({ start: { x: rightX, y }, end: { x: rightX + 155, y }, thickness: 0.6, color: rgb(0.35, 0.35, 0.37) });
    if (signature) placeImage(page, signature, rightX + 42, y + 2, 75, 28);
    drawText(page, str(report.class?.class_teacher_name || "Class Teacher"), leftX, y - 11, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), 150);
    drawText(page, "Class Teacher", leftX, y - 20, fonts.bold, 6.5, accent, 150);
    drawText(page, str(school.principal_name || school.head_teacher_name || "Head Teacher / Principal"), rightX, y - 11, fonts.regular, 6.5, rgb(0.25, 0.26, 0.28), 180);
    drawText(page, "Head Teacher / Principal", rightX, y - 20, fonts.bold, 6.5, accent, 180);
    if (school.report_footer_text) {
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
    const accent = color(themeHex(report.school?.report_theme));
    const y = await drawHeader(doc, page, report, fonts, accent, title);
    return { doc, page, fonts, accent, y, size };
  }

  async function renderNursery(learnerOrReport, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const { doc, page, fonts, accent, y } = await prepare(report, "NURSERY", "Nursery Learning Report");
    const entries = marks(report);
    const areas = entries.slice(0, 5);
    const areaRows = Array.from({ length: 5 }, (_, index) => {
      const entry = areas[index];
      return [
        entry?.subject.name || `Learning area ${index + 1}`,
        num(entry?.mark.pct100),
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
    ], areaRows, x, y - 9, panelWidth, fonts, accent, { fontSize: 7.5, rowHeight: 23 });
    const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes/Stories", "Music", "Health Habits", "Toilet Habits"];
    const activityRows = activities.map((activity) => [activity, "—", "—"]);
    const rightX = x + panelWidth + panelGap;
    drawText(page, "Activities", rightX, y - 2, fonts.bold, 9, accent, panelWidth);
    drawTable(page, [
      { label: "Activity", weight: 2.1 }, { label: "Progress", weight: 1 },
      { label: "Remark", weight: 1.5 },
    ], activityRows, rightX, y - 9, panelWidth, fonts, accent, { fontSize: 7.5, rowHeight: 23 });
    const summary = report.summary || {};
    drawSummary(page, [
      ["Total score", num(summary.total_score, 0)],
      ["Position", `${str(summary.position)} of ${str(summary.class_size)}`],
    ], x, 220, page.getWidth() - 62, fonts, accent);
    await drawFooter(doc, page, report, fonts, accent);
    return doc.save();
  }

  async function renderPrimary(learnerOrReport, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const { doc, page, fonts, accent, y } = await prepare(report, "PRIMARY", "Primary School Report");
    const rows = marks(report).map(({ subject, mark }) => [
      subject.name, num(mark.pct100), str(mark.identifier),
      mark.position ? `${mark.position} of ${mark.class_size}` : "—",
      str(mark.descriptor), str(mark.teacher_initials),
    ]);
    let nextY = drawTable(page, [
      { label: "Subject", weight: 2.4 }, { label: "Marks", weight: 0.85 },
      { label: "Aggr", weight: 0.7 }, { label: "Position", weight: 1 },
      { label: "Remarks", weight: 2 }, { label: "Initials", weight: 0.9 },
    ], rows, 30, y, page.getWidth() - 60, fonts, accent, { rowHeight: 19, fontSize: 7.5 });
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
    await drawFooter(doc, page, report, fonts, accent);
    return doc.save();
  }

  async function renderSecondary(learnerOrReport, level, school, marksData) {
    const report = asReport(learnerOrReport, school, marksData);
    const title = level === "A_LEVEL" ? "A-Level Report" : "O-Level Report";
    const { doc, page, fonts, accent, y } = await prepare(report, level, title);
    const rows = marks(report).map(({ subject, mark }) => [
      subject.code, subject.name,
      ...(level === "A_LEVEL" ? [str(mark.paper_number)] : []),
      num(mark.a1), num(mark.a2), num(mark.a3), num(mark.avg),
      num(mark.pct20), num(mark.eot), num(mark.pct80), num(mark.pct100),
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
      rowHeight: 19, fontSize: 6.6, headerHeight: 23,
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
            str(project.grade), str(project.remarks),
          ])
        : [["No projects recorded", "—", "—", "—", "—", "—"]];
      nextY -= 91;
      if (nextY < 130) {
        const nextPage = doc.addPage(landscape);
        const nextTitle = "A-Level Projects";
        const nextTop = await drawHeader(doc, nextPage, report, fonts, accent, nextTitle);
        drawText(nextPage, "Projects", 30, nextTop - 2, fonts.bold, 9, accent, 200);
        drawTable(nextPage, [
          { label: "Project", weight: 2.2 }, { label: "Score", weight: 0.8 },
          { label: "Out of", weight: 0.8 }, { label: "Percent", weight: 0.9 },
          { label: "Grade", weight: 0.8 }, { label: "Remarks", weight: 2 },
        ], projectRows, 30, nextTop - 10, nextPage.getWidth() - 60, fonts, accent, { fontSize: 7.4, rowHeight: 19 });
        await drawFooter(doc, nextPage, report, fonts, accent);
      } else {
        drawText(page, "Projects", 30, nextY, fonts.bold, 9, accent, 200);
        drawTable(page, [
          { label: "Project", weight: 2.2 }, { label: "Score", weight: 0.8 },
          { label: "Out of", weight: 0.8 }, { label: "Percent", weight: 0.9 },
          { label: "Grade", weight: 0.8 }, { label: "Remarks", weight: 2 },
        ], projectRows, 30, nextY - 8, page.getWidth() - 60, fonts, accent, { fontSize: 7.4, rowHeight: 17 });
      }
    }
    await drawFooter(doc, page, report, fonts, accent);
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

  async function render(report, classLevel) {
    const level = levelCode(classLevel);
    if (level === "NURSERY") return renderNursery(report);
    if (level === "PRIMARY") return renderPrimary(report);
    return renderSecondary(report, level);
  }

  window.ReportCardPdf = {
    render,
    renderNursery,
    renderPrimary,
    renderOLevel: (learner, school, marksData) => renderSecondary(learner, "O_LEVEL", school, marksData),
    renderALevel: (learner, school, marksData) => renderSecondary(learner, "A_LEVEL", school, marksData),
    createZip: zipStore,
  };
})();
