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
  const levelCode = (level) => {
    const code = String(level || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^(ALEVEL|S[56])/.test(code)) return "A_LEVEL";
    if (/^(OLEVEL|S[1-4])/.test(code)) return "O_LEVEL";
    if (/^(PRIMARY|P[1-7])/.test(code)) return "PRIMARY";
    return "NURSERY";
  };
  const periodLabels = {
    BOT: "Beginning of Term (B.O.T)",
    MID: "Mid-Term",
    EOT: "End of Term (E.O.T)",
    COMBINED_BME: "Combined (B.O.T + Mid + E.O.T)",
    COMBINED_BE: "Combined (B.O.T + E.O.T)",
    COMBINED_ME: "Combined (Mid + E.O.T)",
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
    return `class="rc-preview rc-preview-level-${level.toLowerCase()}" data-level="${level}" data-template="${esc(template.id)}" style="--rc-theme:${theme.primary_color};--rc-header:${theme.header_color};--rc-header-text:${theme.header_text_color};--rc-table-header:${theme.table_header_color};--rc-table-header-text:${theme.table_header_text_color};--rc-accent:${theme.accent_color};--rc-table-bg:${theme.background_color}"`;
  }
  function previewMeta(level, options = {}) {
    const template = templateInfo(level, options);
    const period = periodLabels[options.period] || periodLabels.EOT;
    return `<div class="rc-preview-meta"><span>${esc(template.label)}</span><span>Assessment Period: ${esc(period)}</span></div>`;
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
        <strong>${esc(title)}</strong>
      </div>
      <div class="rc-learner-image">${photo ? `<img src="${esc(photo)}" alt="${value(learner.full_name)}">` : `<span>Photo</span>`}</div>
    </header>
    <div class="rc-learner-line">
      <span><b>Learner</b> ${value(learner.full_name)}</span>
      <span><b>Reg. no.</b> ${value(learner.reg_no)}</span>
      <span><b>Class</b> ${value(report.class?.name)}</span>
      <span><b>Term / year</b> ${value(report.term)} / ${value(report.year)}</span>
    </div>`;
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
  const footer = (report, commentLabels = [], signatureLabels = ["Class Teacher", "Head Teacher / Principal"]) => {
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    const signature = imageSource(school.report_signature_base64);
    return `<footer class="rc-footer">
      <div class="rc-footer-details">
        <span><b>School term / year</b> ${value(dates.current_term)} / ${value(dates.current_year)}</span>
        <span><b>Term ended</b> ${value(dates.term_ended_on)}</span>
        <span><b>Next term begins</b> ${value(dates.next_term_begins)}</span>
        <span><b>Next term fees</b> ${value(dates.next_term_fees)}</span>
        <span><b>Fees balance</b> ${value(fees.balance)}</span>
      </div>
       ${commentLabels.length ? `<div class="rc-comments">${commentLabels.map((label) => `<div><b>${esc(label)}</b><span>${label === "Class Teacher Comment" ? value(report.class_teacher_comment || report.suggested_comment) : ""}</span></div>`).join("")}</div>` : ""}
      <div class="rc-signatures rc-signatures-${signatureLabels.length}">${signatureLabels.map((label, index) => {
        const person = label === "Class Teacher" ? report.class?.class_teacher_name
          : /principal|head teacher/i.test(label) ? school.principal_name || school.head_teacher_name
            : /department/i.test(label) ? school.head_of_department_name : "";
        const image = signature && index === signatureLabels.length - 1;
        return `<div>${image ? `<img src="${esc(signature)}" alt="School signature">` : `<span>${value(person)}</span>`}<b>${esc(label)}</b></div>`;
      }).join("")}</div>
      ${school.report_footer_text ? `<p class="rc-footer-note">${value(school.report_footer_text)}</p>` : ""}
    </footer>`;
  };
  const table = (heads, rows, className = "") => `<div class="rc-table-wrap"><table class="rc-table ${className}"><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="rc-empty">No marks recorded for this term.</td></tr>`}</tbody></table></div>`;
  const identifierLegend = `<p class="rc-legend"><b>Identifier:</b> 3 = AVG ≥ 2.5 · 2 = AVG ≥ 1.5 · 1 = AVG &lt; 1.5</p>`;
  const gradeLegend = (level) => level === "A_LEVEL"
    ? `<p class="rc-legend"><b>Grade scale:</b> A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34</p>`
    : `<p class="rc-legend"><b>Grade scale:</b> A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E &lt; 50</p>`;

  function renderNursery(report, options = {}) {
    const rows = scoreRows(report);
    const namedAreas = rows.slice(0, 5);
    const areaRows = Array.from({ length: 5 }, (_, index) => {
      const item = namedAreas[index];
      return `<tr><td>${item ? value(item.subject.name) : `Learning area ${index + 1}`}</td><td>${scoreValue(item?.mark)}</td><td>${value(item?.mark.descriptor)}</td></tr>`;
    });
    const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes/Stories", "Music", "Health Habits", "Toilet Habits"];
    const activityRows = activities.map((activity) => `<tr><td>${esc(activity)}</td><td>—</td><td>—</td></tr>`);
    const summary = report.summary || {};
    const template = templateInfo("NURSERY", options);
    const feeBar = template.id === "3" ? `<div class="rc-template-info"><span><b>Fees balance</b> ${value(report.fees?.balance)}</span><span><b>SchoolPay Code</b> ${value(report.learner?.schoolpay_code || report.school?.schoolpay_code)}</span></div>` : "";
    const requirements = template.id === "4" ? `<section class="rc-requirements"><h3>School Requirements</h3><p>${value(report.school?.school_requirements || "Exercise books · pencils · ruler · crayons · school diary")}</p></section>` : "";
    const signatures = ["2", "5"].includes(template.id) ? ["Class Teacher", "Behaviors", "Head Teacher"] : undefined;
    return `<article ${previewAttrs(report, "NURSERY", options)}>
      ${previewMeta("NURSERY", options)}
      ${header(report, "Nursery Learning Report")}
       ${promotionBanner(report)}
      ${feeBar}
      <div class="rc-two-panels">
        <section><h3>Learning areas</h3>${table(["Learning area", "Score / 100", "Remark"], areaRows)}</section>
        <section><h3>Activities</h3>${table(["Activity", "Progress", "Remark"], activityRows)}</section>
      </div>
      <div class="rc-summary"><span><b>Total score</b> ${number(summary.total_score, 0)}</span><span><b>Position</b> ${value(summary.position)} of ${value(summary.class_size)}</span></div>
      ${requirements}
       ${footer(report, ["Class Teacher Comment"], signatures)}
    </article>`;
  }

  function renderPrimary(report, options = {}) {
    const rows = scoreRows(report).map(({ subject, mark }) =>
      `<tr><td>${value(subject.name)}</td><td>${scoreValue(mark)}</td><td>${value(mark.identifier)}</td><td>${value(mark.position)} of ${value(mark.class_size)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td></tr>`,
    );
    const summary = report.summary || {};
    const template = templateInfo("PRIMARY", options);
    const lowerPrimary = /(^|\b)(P[1-3]|PRIMARY\s*[1-3]|PRIMARY\s+(ONE|TWO|THREE))(\b|$)/i.test(String(report.class?.name || ""));
    const info = template.id === "3" ? `<div class="rc-template-info"><span><b>Print Date</b> ${esc(new Date().toLocaleDateString())}</span><span><b>Class Avg. Age</b> ${value(report.class_average_age ?? report.class?.average_age)}</span></div>` : "";
    const signatures = template.id === "3" ? ["Class Teacher", "Head of Department", "Principal"]
      : template.id === "5" && lowerPrimary ? ["Class Teacher", "Head of Infants", "Principal"] : undefined;
    return `<article ${previewAttrs(report, "PRIMARY", options)}>
      ${previewMeta("PRIMARY", options)}
      ${header(report, "Primary School Report")}
       ${promotionBanner(report)}
      ${info}
      ${table(["Subject", "Marks", "Aggr", "Position", "Remarks", "Initials"], rows)}
      <div class="rc-summary"><span><b>Overall position</b> ${value(summary.position)} of ${value(summary.class_size)}</span><span><b>Average</b> ${number(summary.overall_average)}</span><span><b>Grade</b> ${value(summary.overall_grade)}</span></div>
      <p class="rc-legend"><b>Legend:</b> Very Good — B · Good — C · Fair — D · Still Weak — E</p>
       ${footer(report, ["Class Teacher Comment"], signatures)}
    </article>`;
  }

  function renderSecondary(report, level, options = {}) {
    const rows = scoreRows(report).map(({ subject, mark }) => `<tr>
      <td>${value(subject.code)}</td><td>${value(subject.name)}</td>
      ${level === "A_LEVEL" ? `<td>${value(mark.paper_number)}</td>` : ""}
      <td>${number(mark.a1)}</td><td>${number(mark.a2)}</td><td>${number(mark.a3)}</td>
      <td>${number(mark.avg)}</td><td>${number(mark.pct20)}</td><td>${number(mark.eot)}</td>
      <td>${number(mark.pct80)}</td><td>${scoreValue(mark)}</td><td>${value(mark.identifier)}</td>
      <td>${value(mark.grade)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td>
    </tr>`);
    const heads = ["Code", "Subject", ...(level === "A_LEVEL" ? ["Paper"] : []),
      "A1", "A2", "A3", "AVG", "20%", "EOT", "80%", "100%", "Ident", "Grade", "Descriptor", "TR"];
    const summary = report.summary || {};
    const template = templateInfo(level, options);
    const projects = (report.projects || []).map((project) => `<tr><td>${value(project.project_name)}</td><td>${number(project.score)}</td><td>${number(project.out_of)}</td><td>${project.percentage===null||project.percentage===undefined?"—":`${number(project.percentage)}%`}</td><td>${value(project.grade)}</td><td>${value(project.remarks)}</td><td>${value(project.teacher_initials)}</td></tr>`);
    const projectRows = projects.length ? projects : template.id === "3" && level === "A_LEVEL" ? [`<tr><td colspan="7">Example project: Apiculture — no projects recorded for this learner.</td></tr>`] : [];
    const projectHeading = level === "A_LEVEL" && template.id === "4" ? "STUDENT'S PROJECTS WORK" : level === "A_LEVEL" && template.id === "3" ? "Student Projects Work" : "Projects";
    return `<article ${previewAttrs(report, level, options)}>
      ${previewMeta(level, options)}
      ${header(report, level === "A_LEVEL" ? "A-Level Report" : "O-Level Report")}
       ${promotionBanner(report)}
      ${table(heads, rows, "rc-dense")}
      <div class="rc-summary rc-summary-wide">
        <span><b>Overall average</b> ${number(summary.overall_average)}</span>
        <span><b>Overall grade</b> ${value(summary.overall_grade)}</span>
        <span><b>Position</b> ${value(summary.position)} of ${value(summary.class_size)}</span>
        <span><b>Result</b> ${summary.overall_average === null ? "Pending" : "Recorded"}</span>
      </div>
      ${gradeLegend(level)}${identifierLegend}
       ${level === "A_LEVEL" ? `<section class="rc-projects"><h3>${esc(projectHeading)}</h3>${table(["Project", "Score", "Out of", "Percent", "Grade", "Remarks", "Teacher initials"], projectRows)}</section>` : ""}
      ${footer(report, ["Class Teacher Comment", "Head Teacher Comment"])}
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
