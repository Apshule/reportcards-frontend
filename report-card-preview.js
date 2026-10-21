(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const value = (input) => input === null || input === undefined || input === "" ? "—" : esc(input);
  function formatReportDate(input) {
    if (input === null || input === undefined || input === "") return value(input);
    const isDate = input instanceof Date;
    const text = isDate ? "" : String(input).trim();
    if (!isDate && !/^\d{4}-\d{2}-\d{2}(?:$|T)/u.test(text)) return value(input);
    const date = isDate ? input : new Date(text.includes("T") ? text : `${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return value(input);
    return esc(new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date));
  }
  const number = (input, digits = 1) => {
    const parsed = input === null || input === undefined ? null : Number(input);
    return parsed === null || !Number.isFinite(parsed) ? "—" : parsed.toFixed(digits);
  };
  const imageSource = (source) => {
    if (!source) return "";
    const text = String(source);
    return text.startsWith("data:image/") ? text : `data:image/png;base64,${text}`;
  };
  const contrastText = (hex) => {
    const clean = /^#[0-9a-f]{6}$/i.test(String(hex || "")) ? String(hex).slice(1) : "D1C4E9";
    const channels = [1, 3, 5].map((start) => parseInt(clean.slice(start, start + 2), 16) / 255);
    const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return luminance > 0.179 ? "#24212A" : "#FFFFFF";
  };
  const levelCode = (level) => {
    const code = String(level || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^(ALEVEL|S[56])/.test(code)) return "A_LEVEL";
    if (/^(OLEVEL|S[1-4])/.test(code)) return "O_LEVEL";
    if (/^(PRIMARY|P[1-7])/.test(code)) return "PRIMARY";
    return "NURSERY";
  };
  const displayTerm = (term) => {
    const key = String(term || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return ({
      TERM_1: "TERM I",
      TERM_2: "TERM II",
      TERM_3: "TERM III",
      END_OF_YEAR: "END OF YEAR",
    })[key] || key.replace(/_/g, " ") || "TERM";
  };
  const reportCardTitle = (report, level) => {
    const term = displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3");
    return `${value(report.class?.name || (level === "O_LEVEL" ? "O-LEVEL" : "A-LEVEL"))} ${term} ${value(report.year)} REPORT CARD`;
  };
  const scoreValue = (mark) => number(mark?.period_score ?? mark?.pct100);
  const periodTools = () => window.ReportCardTemplatePicker;
  const assessmentPeriod = (report, options = {}) =>
    periodTools().periodDefinition(options.period ?? report.period ?? "EOT");
  const periodCell = (mark, field, period) =>
    number(periodTools().periodValue(mark, field, period.key));
  const periodFinal = (mark, period) =>
    number(periodTools().periodScore(mark, period.key));
  const periodCells = (mark, period) => [
    ...period.fields.map(({ key }) => periodCell(mark, key, period)),
    ...(period.combined ? [periodFinal(mark, period)] : []),
  ];
  const periodTotals = (entries, period) => [
    ...period.fields.map(({ key }) => {
      const values = entries
        .map(({ mark }) => periodTools().periodValue(mark, key, period.key))
        .filter((score) => score !== null);
      return values.length ? number(values.reduce((sum, score) => sum + score, 0), 0) : "—";
    }),
  ];
  const periodAverages = (entries, period) => [
    ...period.fields.map(({ key }) => {
      const values = entries
        .map(({ mark }) => periodTools().periodValue(mark, key, period.key))
        .filter((score) => score !== null);
      return values.length ? number(values.reduce((sum, score) => sum + score, 0) / values.length) : "—";
    }),
  ];
  const periodSummary = (report) => {
    const summary = report.summary || {};
    return `<div class="rc-summary rc-period-summary">
      <span><b>POSITION:</b> ${value(summary.position)} OUT OF ${value(summary.class_size)}</span>
      <span><b>AVERAGE:</b> ${number(summary.overall_average)}</span>
      <span><b>GRADE:</b> ${value(summary.overall_grade)}</span>
    </div>`;
  };
  function templateInfo(level, options = {}) {
    const id = String(options.template ?? "1").replace(/^template[_-]?/i, "");
    const templates = window.ReportCardTemplateCatalog?.[level] || [];
    const template = templates.find((item) => String(item.id) === id);
    return { id: /^[1-5]$/.test(id) ? id : "1", label: template?.label || `Template ${id || "1"}`, definition: template };
  }
  function previewAttrs(report, level, options) {
    const defaults = window.ReportCardThemeEngine?.defaultsFor(level) || {
      primary_color: "#4B2E9E", accent_color: "#D1C4E9", background_color: "#F6F2FC",
    };
    const template = templateInfo(level, options);
    const suppliedTheme = report.level_theme || report.school?.level_theme;
    const theme = window.ReportCardThemeEngine?.getTemplateTheme?.(level, template.definition, suppliedTheme)
      || window.ReportCardThemeEngine?.getTheme?.(level, suppliedTheme)
      || defaults;
    return `class="rc-preview rc-preview-level-${level.toLowerCase()}" data-level="${level}" data-template="${esc(template.id)}" style="--rc-theme:${theme.primary_color};--rc-header:${theme.header_color};--rc-header-text:${theme.header_text_color};--rc-table-header:${theme.table_header_color};--rc-table-header-text:${theme.table_header_text_color};--rc-accent:${theme.accent_color};--rc-accent-text:${contrastText(theme.accent_color)};--rc-table-bg:${theme.background_color}"`;
  }
  const scoreRows = (report) => (report.subjects || []).map((subject) => ({
    subject,
    mark: subject.mark || {},
  }));
  const header = (report, title, options = {}) => {
    const school = report.school || {};
    const learner = report.learner || {};
    const level = levelCode(report.class?.level);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const secondary = ["O_LEVEL", "A_LEVEL"].includes(level);
    const contact = secondary
      ? [
        school.school_id || school.school_code ? `SCH.ID: ${school.school_code || school.school_id}` : "",
        school.phone ? `TEL: ${school.phone}` : "",
        school.email,
      ].filter(Boolean).join(" · ")
      : [school.phone, school.email, school.website].filter(Boolean).join(" · ");
    const logo = imageSource(school.logo_base64);
    const photo = imageSource(learner.photo_base64);
    const term = displayTerm(report.term);
    const termNumber = term.replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3");
    const period = assessmentPeriod(report, options);
    const bannerText = `${termNumber} PROGRESS REPORT — ${period.title}`;
    return `<header class="rc-head">
      <div class="rc-brand-image">${logo ? `<img src="${esc(logo)}" alt="School logo">` : `<span>${esc(String(school.name || "S").slice(0, 1))}</span>`}</div>
      <div class="rc-school">
        <h2>${value(school.name)}</h2>
        ${school.motto ? `<p class="rc-motto">${value(school.motto)}</p>` : ""}
        ${address ? `<p>${value(address)}</p>` : ""}
        ${contact ? `<p>${value(contact)}</p>` : ""}
      </div>
      <div class="rc-learner-image">${photo ? `<img src="${esc(photo)}" alt="${value(learner.full_name)}">` : `<span>Photo</span>`}</div>
    </header>
    <div class="rc-accent-rule"></div>
      <div class="rc-report-title">${esc(bannerText)}</div>`;
  };
  const learnerInfo = (report, level = "") => {
    const learner = report.learner || {};
    const summary = report.summary || {};
    const rows = level === "NURSERY" ? [
      [["REG NO", learner.reg_no], ["CLASS", report.class?.name], ["FEES BAL", report.fees?.balance], ["SCHOOLPAY CODE", learner.schoolpay_code || report.school?.schoolpay_code]],
      [["NAME", learner.full_name], ["DAYS ATTENDED", report.days_attended ?? report.days_present], ["ABSENT", report.days_absent ?? report.absence], ["TOTAL", report.total_days ?? report.school_days]],
    ] : level === "PRIMARY" ? [
      [["NAME", learner.full_name], ["AD No", learner.reg_no], ["PRINT DATE", String(report.printed_at || report.generated_at || new Date().toLocaleDateString()).slice(0, 10)]],
      [["CLASS", report.class?.name], ["SEX", learner.sex || learner.gender], ["AGE", learner.age]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? report.absence], ["TERM", displayTerm(report.term)], ["YEAR", report.year]],
      [["POSITION", summary.position], ["OUT OF", summary.class_size]],
    ] : level === "O_LEVEL" ? [
      [["NAME", learner.full_name], ["TERM", displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3")], ["YEAR", report.year], ["DATE", String(report.printed_at || report.generated_at || new Date().toLocaleDateString()).slice(0, 10)]],
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
      [["POSITION", summary.position], ["OUT OF", summary.class_size]],
      [["TERM", displayTerm(report.term)], ["YEAR", report.year], ["PRINT DATE", new Date().toLocaleDateString()]],
    ];
    return `<div class="rc-learner-grid rc-learner-grid-${String(level || "general").toLowerCase()}">${rows.map((row, index) =>
      `<div class="rc-info-row rc-info-row-${row.length} ${index % 2 ? "is-tinted" : ""}">${row.map(([label, content]) =>
        `<div><b>${esc(label)}</b><span>${value(content)}</span></div>`).join("")}</div>`).join("")}</div>`;
  };
  const defaultOtherSubjects = ["Handwriting", "Art & Drawing", "P.E & Games", "Music", "Luganda", "Religious Education"];
  const coCurricular = (report, includeDefaults = false) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = items.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.progress ?? item.score,
      item.remark || item.descriptor,
      item.signature || item.teacher_initials,
    ]);
    if (includeDefaults && rows.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(rows.length).forEach((name) => rows.push([name, "", "", ""]));
    }
    return rows.map((row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join("")}</tr>`);
  };
  const nurseryActivityNames = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits"];
  const nurseryActivityItems = (report) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.learning_activities) ? report.learning_activities
        : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = items.map((item, index) => ({
      name: item.activity_name || item.name || item.subject_name || item.subject?.name || nurseryActivityNames[index] || `Activity ${index + 1}`,
      remark: item.remark || item.descriptor || item.teacher_remark || "",
      image: item.image_base64 || item.illustration_base64 || item.photo_base64 || "",
    }));
    const names = new Set(rows.map((item) => String(item.name).trim().toLowerCase()));
    nurseryActivityNames.forEach((name) => {
      if (rows.length < nurseryActivityNames.length && !names.has(name.toLowerCase())) rows.push({ name, remark: "", image: "" });
    });
    return rows.slice(0, nurseryActivityNames.length);
  };
  const primaryOtherRows = (report) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = items.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.grade || item.identifier || item.progress || item.score,
      item.remark || item.descriptor || item.teacher_remark,
      item.teacher_initials || item.initials || item.signature,
    ]);
    if (rows.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(rows.length).forEach((name) => rows.push([name, "", "", ""]));
    }
    return rows.map((row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join("")}</tr>`);
  };
  const earlyYearsRemarks = (report, level) => {
    const definitions = level === "NURSERY" ? [
      ["Class Teacher's Report", report.class_teacher_comment || report.suggested_comment, "Class Teacher"],
      ["Behaviors / Cleanliness", report.behaviors_comment || report.behaviour_comment || report.cleanliness_comment, "Behaviors"],
      ["Head Teacher's Comment", report.head_teacher_comment, "Head Teacher"],
    ] : [
      ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment, "Class Teacher"],
      ["Head of Infants Remarks", report.head_of_infants_comment || report.head_teacher_comment, "Head of Infants"],
      ["Principal's Remarks", report.principal_comment, "Principal"],
    ];
    const signature = imageSource(report.school?.report_signature_base64);
    return `<section class="rc-remarks-signatures"><div class="rc-remarks-grid" data-count="3">${definitions.map(([label, text, signer], index) =>
      `<div><b>${esc(label)}</b><span>${value(text)}</span><div class="rc-remark-signature">${signature && index === 2 ? `<img src="${esc(signature)}" alt="School signature">` : ""}<i></i><strong>${value(signatureName(signer, report))}</strong><small>${esc(signer)}</small></div></div>`).join("")}</div></section>`;
  };
  const signatureName = (label, report) => /class teacher/i.test(label) ? report.class?.class_teacher_name
    : /principal/i.test(label) ? report.school?.principal_name
      : /head teacher|infant/i.test(label) ? report.school?.head_of_infants_name || report.school?.head_teacher_name
        : /department/i.test(label) ? report.school?.head_of_department_name : undefined;
  const remarksAndSignatures = (report, labels = ["Class Teacher", "Head Teacher", "Principal"], count = 3) => {
    const remarks = [
      ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment],
      ["Head Teacher's Remarks", report.head_teacher_comment],
      ["Principal's Remarks", report.principal_comment],
    ].slice(0, count);
    const signature = imageSource(report.school?.report_signature_base64);
    return `<section class="rc-remarks-signatures"><div class="rc-remarks-grid" data-count="${remarks.length}">${remarks.map(([label, text], index) => {
      const signer = labels[index] || ["Class Teacher", "Head Teacher", "Principal"][index];
      return `<div><b>${esc(label)}</b><span>${value(text)}</span><div class="rc-remark-signature">${signature && index === labels.length - 1 ? `<img src="${esc(signature)}" alt="School signature">` : ""}<i></i><strong>${value(signatureName(signer, report))}</strong><small>${esc(signer)}</small></div></div>`;
    }).join("")}</div></section>`;
  };
  const stampBlock = (report, options = {}) => {
    if (options.includeStamp === false) return "";
    const stamp = report.stamp_config || report.school?.stamp_config;
    if (!stamp || typeof stamp !== "object" || !Object.keys(stamp).length) return "";
    const lines = [stamp.line_1, stamp.line_2, stamp.line_3, stamp.line_4, stamp.line_5].filter(Boolean);
    const shape = ["circle", "oval", "rounded_rectangle"].includes(String(stamp.shape || "").toLowerCase()) ? String(stamp.shape).toLowerCase() : "rectangle";
    const stampColor = /^#[0-9a-f]{6}$/i.test(String(stamp.primary_color || "")) ? stamp.primary_color : "#4B2E9E";
    const opacity = Math.max(0.1, Math.min(0.85, Number(stamp.opacity) || 0.45));
    const rotation = Math.max(-15, Math.min(15, Number(stamp.rotation_degrees) || 0));
    return `<div class="rc-stamp-preview rc-stamp-${shape}" style="--rc-stamp-color:${stampColor};--rc-stamp-opacity:${opacity};--rc-stamp-rotation:${rotation}deg" aria-label="Configured school stamp">${lines.map((line) => `<span>${value(line)}</span>`).join("")}</div>`;
  };
  const promotionBanner = (report) => {
    const endOfYear = ["TERM_3", "END_OF_YEAR"].includes(String(report.term || "").toUpperCase());
    if (!endOfYear) return "";
    const decision = report.promotion_decision || report.promotion?.promotion_decision
      || report.suggested_decision || report.promotion?.suggested_decision;
    if (decision === "promoted") {
      return `<div class="rc-promotion-banner rc-promotion-promoted">PROMOTED TO ${value(report.promotion_next_class || report.promotion?.next_class || "NEXT CLASS")}</div>`;
    }
    if (decision === "try_another") {
      return `<div class="rc-promotion-banner rc-promotion-try-another">TRY ANOTHER CLASS</div>`;
    }
    if (decision === "repeat") {
      return `<div class="rc-promotion-banner rc-promotion-repeat">ADVISED TO REPEAT ${value(report.promotion_current_class || report.promotion?.current_class || report.class?.name || "CURRENT CLASS")}</div>`;
    }
    return "";
  };
  const footer = (report, level) => {
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    const earlyYears = level === "NURSERY" || level === "PRIMARY";
    const gradeText = level === "O_LEVEL"
      ? "A 100-80; B 79-70; C 69-60; D 59-40; E <40"
      : level === "A_LEVEL"
      ? "A = Excellent (75–100) • B = Very Good (65–74) • C = Good (50–64) • D = Fair (35–49) • E = Below 35 • GR = Grade"
      : level === "NURSERY"
        ? "GRADING KEY: Learning areas are assessed by descriptor • GR = Grade"
        : "A = Excellent (80–100) • B = Very Good (70–79) • C = Good (60–69) • D = Fair (50–59) • E = Below 50 • GR = Grade • AGGR = Aggregate";
    const footerDetails = level === "NURSERY"
      ? `<div class="rc-early-footer-line"><span><b>Date of Issue:</b> ${formatReportDate(report.printed_at || report.generated_at || new Date())}</span><span><b>Next Term Begins:</b> ${formatReportDate(dates.next_term_begins)}</span></div><div class="rc-school-requirements"><b>School Requirements:</b> ${value(school.school_requirements)}</div>`
      : level === "PRIMARY"
        ? `<div class="rc-early-footer-line"><span><b>Next term will begin on:</b> ${formatReportDate(dates.next_term_begins)}</span></div><div class="rc-school-requirements"><b>KEY:</b> A = Very Good; B = Good; C = Fair; D = Still Weak; GR = Grade; AGGR = Aggregate</div>`
        : `<div class="rc-footer-details">
          <span><b>School term / year</b> ${value(dates.current_term)} / ${value(dates.current_year)}</span>
          <span><b>Term ended</b> ${formatReportDate(dates.term_ended_on)}</span>
          <span><b>Next term begins</b> ${formatReportDate(dates.next_term_begins)}</span>
          <span><b>Next term fees</b> ${value(dates.next_term_fees)}</span>
          <span><b>Fees balance</b> ${value(fees.balance)}</span>
        </div>`;
    const footerLead = value(school.name);
    const footerCenter = earlyYears ? value(school.motto) : esc(gradeText);
    return `<footer class="rc-footer">
      ${footerDetails}
      ${level === "O_LEVEL" ? `<p class="rc-secondary-footer-note">Outstanding school fees balance is UGX ${value(fees.balance)} as at ${formatReportDate(report.printed_at || report.generated_at || new Date())}<br>GRADES: A 100-80; B 79-70; C 69-60; D 59-40; E &lt;40<br>T = Topic; EOTI = end of term 1</p>` : ""}
      <div class="rc-footer-band"><span>${footerLead}</span><span class="rc-grade-key">${earlyYears ? footerCenter : `<b>GRADING KEY:</b> ${footerCenter}`}</span><span class="rc-page-count">Page 1 of 1</span></div>
      <div class="rc-footer-contact"><span>${value([school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · "))}</span><span>${value(school.website || school.motto || school.report_footer_text)}</span></div>
      ${school.report_footer_text ? `<p class="rc-footer-note">${value(school.report_footer_text)}</p>` : ""}
    </footer>`;
  };
  const table = (heads, rows, className = "", total = "", title = "", options = {}) => {
    const totalMarkup = Array.isArray(total)
      ? `<tfoot><tr class="rc-totals-row">${total.map((cell) => `<td>${cell === "" ? "" : value(cell)}</td>`).join("")}</tr></tfoot>`
      : total ? `<tfoot><tr class="rc-totals-row"><th colspan="${heads.length}">${esc(total)}</th></tr></tfoot>` : "";
    const grouped = options.headerGroups?.length
      ? (() => {
        const topCells = [];
        for (let index = 0; index < heads.length;) {
          const group = options.headerGroups.find((item) => item.start === index);
          if (options.rowSpanColumns.includes(index)) {
            topCells.push(`<th rowspan="2">${esc(heads[index])}</th>`);
            index += 1;
          } else if (group) {
            topCells.push(`<th colspan="${group.end - group.start + 1}">${esc(group.label)}</th>`);
            index = group.end + 1;
          } else {
            topCells.push(`<th>${esc(heads[index])}</th>`);
            index += 1;
          }
        }
        return `<tr class="rc-group-header">${topCells.join("")}</tr><tr>${heads.map((head, index) => options.rowSpanColumns.includes(index) ? "" : `<th>${esc(head)}</th>`).join("")}</tr>`;
      })()
      : `<tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr>`;
    const extraFooter = (options.footerRows || []).map((cells) =>
      `<tr class="rc-totals-row">${cells.map(({ text, span = 1 }) => `<td colspan="${span}">${text === "" ? "" : value(text)}</td>`).join("")}</tr>`,
    ).join("");
    const totalRows = totalMarkup ? totalMarkup.slice(7, -8) : "";
    return `<div class="rc-table-wrap"><table class="rc-table ${className}"><thead>${title ? `<tr class="rc-table-section-title"><th colspan="${heads.length}">${esc(title)}</th></tr>` : ""}${grouped}</thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="rc-empty">No marks recorded for this term.</td></tr>`}</tbody>${totalMarkup || extraFooter ? `<tfoot>${totalRows}${extraFooter}</tfoot>` : ""}</table></div>`;
  };
  const promotionStatus = (report) => {
    const decision = report.promotion_decision || report.promotion?.promotion_decision
      || report.suggested_decision || report.promotion?.suggested_decision;
    if (decision === "promoted") return `STATUS: PROMOTED TO ${report.promotion_next_class || report.promotion?.next_class || "NEXT CLASS"}`;
    if (decision === "repeat") return `STATUS: ADVISED TO REPEAT ${report.promotion_current_class || report.promotion?.current_class || report.class?.name || "CURRENT CLASS"}`;
    if (decision === "try_another") return "STATUS: TRY ANOTHER CLASS";
    return "STATUS: —";
  };
  const firstInitials = (report) => report.subjects?.find((subject) => subject.mark?.teacher_initials)?.mark.teacher_initials
    || report.teacher_initials || "—";
  const gradeLegend = (level) => level === "A_LEVEL"
    ? `<p class="rc-legend"><b>Grade scale:</b> A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34</p>`
    : `<p class="rc-legend"><b>Grade scale:</b> A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E &lt; 50</p>`;

  function renderNursery(report, options = {}) {
    const rows = scoreRows(report);
    const summary = report.summary || {};
    const period = assessmentPeriod(report, options);
    const activities = nurseryActivityItems(report);
    const maxScore = summary.maximum_score ?? summary.total_possible ?? rows.length * 100;
    const scored = summary.total_score ?? rows.reduce((total, { mark }) => {
      const score = periodTools().periodScore(mark, period.key);
      return score === null ? total : total + score;
    }, 0);
    const areaRows = rows.map(({ subject, mark }, index) => {
      const description = subject.learning_area_description || subject.description || subject.learning_outcome || subject.details || "";
      const cells = [
        `<b>${value(subject.name || `Learning Area ${index + 1}`)}</b>${description ? `<small>${value(description)}</small>` : ""}`,
        ...periodCells(mark, period),
        value(mark.descriptor || mark.remark),
        "<i aria-hidden=\"true\"></i>",
      ];
      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    }).join("");
    const activityCards = activities.map((item) => {
      const source = imageSource(item.image);
      return `<div class="rc-nursery-activity-card"><div><b>${value(item.name)}</b><span>${value(item.remark)}</span></div>${source ? `<img src="${esc(source)}" alt="">` : `<i aria-hidden="true">${esc(String(item.name || "?").trim().slice(0, 1).toUpperCase())}</i>`}</div>`;
    }).join("");
    return `<article ${previewAttrs(report, "NURSERY", options)}>
      <div class="rc-preview-content">
      ${header(report, "Nursery Learning Report", options)}
      ${learnerInfo(report, "NURSERY")}
      <section class="rc-nursery-panels">
        <div class="rc-nursery-learning">
          <div class="rc-nursery-panel-title">Achievement Scores — ${esc(period.title)}</div>
          ${table(["AREA", ...period.fields.map(({ label }) => label), ...(period.combined ? ["FINAL"] : []), "COMMENT", "SIGNATURE"], areaRows, "rc-period-table")}
          <div class="rc-nursery-totalbar"><span>TOTAL: ${number(maxScore, 0)}</span><span>SCORED: ${number(scored, 0)}</span><span>POSITION ${value(summary.position)} OUT OF ${value(summary.class_size)}</span></div>
        </div>
        <div class="rc-nursery-activities">
          <div class="rc-nursery-panel-title">Performance in the Learning Activities</div>
          <div class="rc-nursery-activity-grid">${activityCards}</div>
        </div>
      </section>
       ${periodSummary(report)}
       ${earlyYearsRemarks(report, "NURSERY")}
      ${stampBlock(report, options)}
       ${footer(report, "NURSERY")}
      </div>
    </article>`;
  }

  function renderPrimary(report, options = {}) {
    const template = templateInfo("PRIMARY", options);
    const period = assessmentPeriod(report, options);
    const entries = scoreRows(report);
    const rows = entries.map(({ subject, mark }) => {
      const cells = template.definition?.blankForm
        ? [value(subject.name), ...period.fields.map(() => "________"), ...(period.combined ? ["________"] : []), "___", "________", "________________", "___"]
        : [
          `<b>${value(subject.name)}</b>`,
          ...period.fields.map(({ key }) => periodCell(mark, key, period)),
          ...(period.combined ? [periodFinal(mark, period)] : []),
          value(mark.grade),
          mark.position ? `${value(mark.position)} of ${value(mark.class_size)}` : "—",
          `<em>${value(mark.descriptor || mark.teacher_remark)}</em>`,
          value(mark.teacher_initials),
        ];
      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    });
    const summary = report.summary || {};
    const periodTotalCells = periodTotals(entries, period);
    if (period.combined) periodTotalCells.push(number(summary.total_score, 0));
    const totals = [
      "TOTALS",
      ...periodTotalCells,
      value(summary.overall_grade),
      `${value(summary.position)} OUT OF ${value(summary.class_size)}`,
      promotionStatus(report).replace(/^STATUS:\s*/, ""),
      firstInitials(report),
    ];
    const activities = primaryOtherRows(report);
    const headers = [
      "SUBJECTS",
      ...period.fields.map(({ label }) => label),
      ...(period.combined ? ["FINAL"] : []),
      "GRADE",
      "POSITION",
      "TEACHER'S REMARKS",
      "INITIALS",
    ];
    return `<article ${previewAttrs(report, "PRIMARY", options)}>
      <div class="rc-preview-content">
      ${header(report, "Primary School Report", options)}
      ${learnerInfo(report, "PRIMARY")}
       <section class="rc-subject-section">${table(headers, rows, "rc-primary-table rc-period-table", totals)}</section>
       ${periodSummary(report)}
       <section class="rc-activities">${table(["SUBJECT", "GR", "TEACHER'S REMARKS", "INITIALS"], activities, "", "", "OTHER SUBJECTS / CO-CURRICULAR")}</section>
      ${earlyYearsRemarks(report, "PRIMARY")}
      ${stampBlock(report, options)}
      ${footer(report, "PRIMARY")}
      </div>
    </article>`;
  }

  function renderSecondary(report, level, options = {}) {
    const entries = scoreRows(report);
    const period = assessmentPeriod(report, options);
    const summary = report.summary || {};
    const template = templateInfo(level, options);
    const prefixHeads = level === "A_LEVEL" ? ["CODE", "SUBJECT", "PAPER"] : ["SUBJECT"];
    const heads = [
      ...prefixHeads,
      ...period.fields.map(({ label }) => label),
      ...(period.combined ? ["FINAL"] : []),
      "GRADE",
      level === "A_LEVEL" ? "COMMENT" : "GRADE DESCRIPTOR",
      "TR",
    ];
    const rows = entries.map(({ subject, mark }) => {
      const cells = [
        ...(level === "A_LEVEL" ? [value(subject.code), value(subject.name), value(mark.paper_number)] : [value(subject.name)]),
        ...period.fields.map(({ key }) => periodCell(mark, key, period)),
        ...(period.combined ? [periodFinal(mark, period)] : []),
        value(mark.grade),
        value(mark.descriptor),
        value(mark.teacher_initials),
      ];
      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    });
    const projects = (report.projects || []).map((project) => `<tr><td>${value(project.project_name)}</td><td>${number(project.score)}</td><td>${project.percentage===null||project.percentage===undefined?"—":`${number(project.percentage)}%`}</td><td>${value(project.grade)}</td><td>${value(project.remarks)}</td><td>${value(project.teacher_initials)}</td></tr>`);
    const activities = coCurricular(report, level === "PRIMARY" || level === "NURSERY");
    const projectHeading = level === "A_LEVEL" ? "STUDENT'S PROJECTS WORK" : "Projects";
    const finalScores = period.combined
      ? entries.map(({ mark }) => periodTools().periodScore(mark, period.key)).filter((score) => score !== null)
      : [];
    const averageCells = [
      ...(level === "A_LEVEL" ? ["", "AVERAGE SCORES", ""] : ["AVERAGE SCORES"]),
      ...periodAverages(entries, period),
      ...(period.combined
        ? [finalScores.length ? number(finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) : "—"]
        : []),
      value(summary.overall_grade),
      value(summary.overall_achievement ?? summary.achievement),
      "",
    ];
    const footerRows = level === "O_LEVEL" ? [[
      { text: "NEXT TERM BEGINS", span: 2 },
      { text: formatReportDate(report.term_dates?.next_term_begins), span: Math.max(1, heads.length - 2) },
    ]] : [];
    const title = level === "A_LEVEL" ? "A-Level Report" : "O-Level Report";
    return `<article ${previewAttrs(report, level, options)}>
      <div class="rc-preview-content">
      ${header(report, title, options)}
      ${learnerInfo(report, level)}
       ${promotionBanner(report)}
        <section class="rc-subject-section">${table(heads, rows, `rc-dense rc-secondary-${level.toLowerCase()} rc-period-table`, averageCells, `TERM PERFORMANCE RECORDS — ${period.title}`, { footerRows })}</section>
        ${periodSummary(report)}
       ${activities.length ? `<section class="rc-activities">${table(["Activity / Subject", "Progress", "Remark", "Signature"], activities, "", "", "Activities / Other Subjects")}</section>` : ""}
        ${level === "A_LEVEL" && projects.length ? `<section class="rc-projects">${table(["TERMLY PROJECT WORK", "AVERAGE SCORE (10)", "OUT OF 100", "GRADE", "REMARKS", "TEACHER"], projects, "", "", projectHeading)}</section>` : ""}
       ${remarksAndSignatures(report, ["Class Teacher", "Head Teacher"], 2)}
      ${stampBlock(report, options)}
      ${footer(report, level)}
      </div>
    </article>`;
  }

  window.ReportCardPreview = {
    formatReportDate,
    render(report, options = {}) {
      const level = levelCode(report.class?.level);
      if (level === "PRIMARY") return renderPrimary(report, options);
      if (level === "O_LEVEL" || level === "A_LEVEL") return renderSecondary(report, level, options);
      return renderNursery(report, options);
    },
  };
})();
