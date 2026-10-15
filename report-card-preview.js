(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const value = (input) => input === null || input === undefined || input === "" ? "—" : esc(input);
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
  const scoreValue = (mark) => number(mark?.period_score ?? mark?.pct100);
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
  const header = (report, title) => {
    const school = report.school || {};
    const learner = report.learner || {};
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · ");
    const contact = [school.phone, school.email, school.website].filter(Boolean).join(" · ");
    const logo = imageSource(school.logo_base64);
    const photo = imageSource(learner.photo_base64);
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
    <div class="rc-report-title">${esc(displayTerm(report.term))} PROGRESS REPORT <span>${value(report.year)}</span></div>`;
  };
  const learnerInfo = (report) => {
    const learner = report.learner || {};
    const summary = report.summary || {};
    const rows = [
      [["Learner name", learner.full_name], ["Registration no.", learner.reg_no], ["Sex", learner.sex], ["Age", learner.age]],
      [["Class", report.class?.name], ["House", learner.house], ["Absence", report.days_absent ?? report.absence], ["Position", summary.position]],
      [["Out of", summary.class_size], ["Term", displayTerm(report.term)], ["Year", report.year], ["Print date", new Date().toLocaleDateString()]],
    ];
    return `<div class="rc-learner-grid">${rows.map((row) => row.map(([label, content]) =>
      `<div><b>${esc(label)}</b><span>${value(content)}</span></div>`).join("")).join("")}</div>`;
  };
  const nextTermBanner = (report) => `<div class="rc-next-term"><b>Next term begins</b><span>${value(report.term_dates?.next_term_begins)}</span></div>`;
  const coCurricular = (report) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    return items.map((item) => `<tr><td>${value(item.activity_name || item.name || item.subject_name || item.subject?.name)}</td><td>${value(item.progress ?? item.score)}</td><td>${value(item.remark || item.descriptor)}</td><td>${value(item.signature || item.teacher_initials)}</td></tr>`);
  };
  const signatureName = (label, report) => /class teacher/i.test(label) ? report.class?.class_teacher_name
    : /principal/i.test(label) ? report.school?.principal_name
      : /head teacher|infant/i.test(label) ? report.school?.head_teacher_name
        : /department/i.test(label) ? report.school?.head_of_department_name : undefined;
  const remarksAndSignatures = (report, labels = ["Class Teacher", "Head Teacher", "Principal"]) => {
    const remarks = [
      ["Class teacher remarks", report.class_teacher_comment || report.suggested_comment],
      ["Head teacher remarks", report.head_teacher_comment],
      ["Principal remarks", report.principal_comment],
    ];
    const signature = imageSource(report.school?.report_signature_base64);
    return `<section class="rc-remarks-signatures"><div class="rc-remarks-grid">${remarks.map(([label, text]) => `<div><b>${esc(label)}</b><span>${value(text)}</span></div>`).join("")}</div><div class="rc-signatures rc-signatures-${labels.length}">${labels.map((label, index) => `<div><span>${value(signatureName(label, report))}</span>${signature && index === labels.length - 1 ? `<img src="${esc(signature)}" alt="School signature">` : ""}<b>${esc(label)}</b></div>`).join("")}</div></section>`;
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
  const footer = (report) => {
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    return `<footer class="rc-footer">
      <div class="rc-footer-details">
        <span><b>School term / year</b> ${value(dates.current_term)} / ${value(dates.current_year)}</span>
        <span><b>Term ended</b> ${value(dates.term_ended_on)}</span>
        <span><b>Next term begins</b> ${value(dates.next_term_begins)}</span>
        <span><b>Next term fees</b> ${value(dates.next_term_fees)}</span>
        <span><b>Fees balance</b> ${value(fees.balance)}</span>
      </div>
      <div class="rc-footer-band"><span>${value([school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · "))}</span><span class="rc-page-count">Page count on export</span><span>${value(school.website || school.motto || school.report_footer_text)}</span></div>
      ${school.report_footer_text ? `<p class="rc-footer-note">${value(school.report_footer_text)}</p>` : ""}
    </footer>`;
  };
  const table = (heads, rows, className = "", total = "", title = "") => `<div class="rc-table-wrap"><table class="rc-table ${className}"><thead>${title ? `<tr class="rc-table-section-title"><th colspan="${heads.length}">${esc(title)}</th></tr>` : ""}<tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="rc-empty">No marks recorded for this term.</td></tr>`}</tbody>${total ? `<tfoot><tr><th colspan="${heads.length}">${esc(total)}</th></tr></tfoot>` : ""}</table></div>`;
  const gradeLegend = (level) => level === "A_LEVEL"
    ? `<p class="rc-legend"><b>Grade scale:</b> A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34</p>`
    : `<p class="rc-legend"><b>Grade scale:</b> A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E &lt; 50</p>`;

  function renderNursery(report, options = {}) {
    const rows = scoreRows(report);
    const areaRows = rows.map(({ subject, mark }) => `<tr><td>${value(subject.name)}</td><td>${scoreValue(mark)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td></tr>`);
    const summary = report.summary || {};
    const template = templateInfo("NURSERY", options);
    const feeBar = template.id === "3" ? `<div class="rc-template-info"><span><b>Fees balance</b> ${value(report.fees?.balance)}</span><span><b>SchoolPay Code</b> ${value(report.learner?.schoolpay_code || report.school?.schoolpay_code)}</span></div>` : "";
    const requirements = template.id === "4" ? `<section class="rc-requirements"><h3>School Requirements</h3><p>${value(report.school?.school_requirements)}</p></section>` : "";
    const activities = coCurricular(report);
      return `<article ${previewAttrs(report, "NURSERY", options)}>
      ${header(report, "Nursery Learning Report")}
      ${learnerInfo(report)}
       ${promotionBanner(report)}
      ${feeBar}
      <section class="rc-learning-table">${table(["Learning Area", "Score /100", "Remark", "Signature"], areaRows, "", `TOTALS · Score: ${number(summary.total_score, 0)} · Position: ${value(summary.position)} of ${value(summary.class_size)}`, "SUBJECTS • END OF TERM RESULTS")}</section>
      ${activities.length ? `<section class="rc-activities">${table(["Activity / Subject", "Progress", "Remark", "Signature"], activities, "", "", "Activities / Other Subjects")}</section>` : ""}
      ${requirements}
      ${remarksAndSignatures(report)}
      ${nextTermBanner(report)}
      <p class="rc-legend"><b>Grading key:</b> —</p>
      ${stampBlock(report, options)}
      ${footer(report)}
    </article>`;
  }

  function renderPrimary(report, options = {}) {
    const template = templateInfo("PRIMARY", options);
    const rows = scoreRows(report).map(({ subject, mark }) =>
      template.definition?.blankForm
        ? `<tr><td>${value(subject.name)}</td><td>________</td><td>___</td><td>________</td><td>________________</td><td>___</td></tr>`
        : `<tr><td>${value(subject.name)}</td><td>${scoreValue(mark)}</td><td>${value(mark.identifier)}</td><td>${mark.position ? `${value(mark.position)} of ${value(mark.class_size)}` : "—"}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td></tr>`,
    );
    const summary = report.summary || {};
    const lowerPrimary = /(^|\b)(P[1-3]|PRIMARY\s*[1-3]|PRIMARY\s+(ONE|TWO|THREE))(\b|$)/i.test(String(report.class?.name || ""));
    const info = template.definition?.printDate || template.definition?.classAverageAge ? `<div class="rc-template-info">${template.definition?.printDate ? `<span><b>Print Date</b> ${esc(new Date().toLocaleDateString())}</span>` : ""}${template.definition?.classAverageAge ? `<span><b>Class Avg. Age</b> ${value(report.class_average_age ?? report.class?.average_age)}</span>` : ""}</div>` : "";
    const signatures = template.definition?.signatures
      || (template.definition?.lowerPrimarySignature && lowerPrimary ? ["Class Teacher", "Head of Infants", "Principal"] : undefined);
    const activities = coCurricular(report);
    return `<article ${previewAttrs(report, "PRIMARY", options)}>
      ${header(report, "Primary School Report")}
      ${learnerInfo(report)}
       ${promotionBanner(report)}
      ${info}
       <section class="rc-subject-section">${table(["Subject", "Marks", "AGGR", "Position", "Teacher's Remarks", "Initials"], rows, "", `TOTALS · Score: ${number(summary.total_score, 0)} · Average: ${number(summary.overall_average)} · Position: ${value(summary.position)} of ${value(summary.class_size)}`, "SUBJECTS • END OF TERM RESULTS")}</section>
       ${activities.length ? `<section class="rc-activities">${table(["Activity / Subject", "Progress", "Remark", "Signature"], activities, "", "", "Activities / Other Subjects")}</section>` : ""}
      ${remarksAndSignatures(report, signatures)}
      ${nextTermBanner(report)}
      <p class="rc-legend"><b>Legend:</b> Very Good — B · Good — C · Fair — D · Still Weak — E</p>
      ${stampBlock(report, options)}
      ${footer(report)}
    </article>`;
  }

  function renderSecondary(report, level, options = {}) {
    const rows = scoreRows(report).map(({ subject, mark }) => level === "A_LEVEL"
      ? `<tr><td>${value(subject.code)}</td><td>${value(subject.name)}</td><td>${value(mark.paper_number)}</td><td>${number(mark.a1)}</td><td>${number(mark.a2)}</td><td>${number(mark.a3)}</td><td>${number(mark.avg)}</td><td>${number(mark.pct20)}</td><td>${number(mark.eot)}</td><td>${number(mark.pct80)}</td><td>${scoreValue(mark)}</td><td>${value(mark.grade)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td></tr>`
      : `<tr><td>${value(subject.code)}</td><td>${value(subject.name)}</td><td>${number(mark.a1)}</td><td>${number(mark.a2)}</td><td>${number(mark.a3)}</td><td>${number(mark.avg)}</td><td>${number(mark.pct20)}</td><td>${number(mark.eot)}</td><td>${number(mark.pct80)}</td><td>${scoreValue(mark)}</td><td>${value(mark.grade)}</td><td>${value(mark.teacher_initials)}</td></tr>`);
    const heads = level === "A_LEVEL"
      ? ["Code", "Subject", "Paper", "A1", "A2", "A3", "AVG", "20%", "EOT", "80%", "100%", "Grade", "Comment", "TR"]
      : ["Code", "Subject", "T1", "T2", "T3", "AS", "FA (20)", "EOTI (80)", "FINAL (100)", "Grade", "TR"];
    const summary = report.summary || {};
    const template = templateInfo(level, options);
    const projects = (report.projects || []).map((project) => `<tr><td>${value(project.project_name)}</td><td>${number(project.score)}</td><td>${number(project.out_of)}</td><td>${project.percentage===null||project.percentage===undefined?"—":`${number(project.percentage)}%`}</td><td>${value(project.grade)}</td><td>${value(project.remarks)}</td><td>${value(project.teacher_initials)}</td></tr>`);
    const projectRows = projects;
    const activities = coCurricular(report);
    const projectHeading = level === "A_LEVEL" && template.id === "4" ? "STUDENT'S PROJECTS WORK" : level === "A_LEVEL" && template.id === "3" ? "Student Projects Work" : "Projects";
    return `<article ${previewAttrs(report, level, options)}>
      ${header(report, level === "A_LEVEL" ? "A-Level Report" : "O-Level Report")}
      ${learnerInfo(report)}
       ${promotionBanner(report)}
       <section class="rc-subject-section">${table(heads, rows, "rc-dense", `TOTALS · Average: ${number(summary.overall_average)} · Grade: ${value(summary.overall_grade)} · Position: ${value(summary.position)} of ${value(summary.class_size)}`, "SUBJECTS • END OF TERM RESULTS")}</section>
       ${activities.length ? `<section class="rc-activities">${table(["Activity / Subject", "Progress", "Remark", "Signature"], activities, "", "", "Activities / Other Subjects")}</section>` : ""}
       ${level === "A_LEVEL" && projects.length ? `<section class="rc-projects">${table(["Project", "Score", "Out of", "Percent", "Grade", "Remarks", "Teacher initials"], projectRows, "", "", projectHeading)}</section>` : ""}
      ${remarksAndSignatures(report)}
      ${nextTermBanner(report)}
      ${gradeLegend(level)}
      ${stampBlock(report, options)}
      ${footer(report)}
    </article>`;
  }

  window.ReportCardPreview = {
    render(report, options = {}) {
      const level = levelCode(report.class?.level);
      if (level === "PRIMARY") return renderPrimary(report, options);
      if (level === "O_LEVEL" || level === "A_LEVEL") return renderSecondary(report, level, options);
      return renderNursery(report, options);
    },
  };
})();
