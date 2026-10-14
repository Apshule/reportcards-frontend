(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const value = (input) => input === null || input === undefined || input === "" ? "—" : esc(input);
  const number = (input, digits = 1) => {
    const parsed = input === null || input === undefined ? null : Number(input);
    return parsed === null || !Number.isFinite(parsed) ? "—" : parsed.toFixed(digits);
  };
  const themeColor = (theme) => ({
    blue: "#1B5E20",
    maroon: "#7B1FA2",
    mixed: "#4B2E9E",
  }[(theme || "blue").toLowerCase()] || "#1B5E20");
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
  const footer = (report, commentLabels = []) => {
    const school = report.school || {};
    const dates = report.term_dates || {};
    const fees = report.fees || {};
    const signature = imageSource(school.report_signature_base64);
    return `<footer class="rc-footer">
      <div class="rc-footer-details">
        <span><b>Term ended</b> ${value(dates.term_ended_on)}</span>
        <span><b>Next term begins</b> ${value(dates.next_term_begins)}</span>
        <span><b>Next term fees</b> ${value(dates.next_term_fees)}</span>
        <span><b>Fees balance</b> ${value(fees.balance)}</span>
      </div>
      ${commentLabels.length ? `<div class="rc-comments">${commentLabels.map((label) => `<div><b>${esc(label)}</b><span></span></div>`).join("")}</div>` : ""}
      <div class="rc-signatures">
        <div><span>${value(report.class?.class_teacher_name)}</span><b>Class Teacher</b></div>
        <div>${signature ? `<img src="${esc(signature)}" alt="School signature">` : `<span>${value(school.head_teacher_name)}</span>`}<b>${value(school.principal_name || "Head Teacher / Principal")}</b></div>
      </div>
      ${school.report_footer_text ? `<p class="rc-footer-note">${value(school.report_footer_text)}</p>` : ""}
    </footer>`;
  };
  const table = (heads, rows, className = "") => `<div class="rc-table-wrap"><table class="rc-table ${className}"><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="rc-empty">No marks recorded for this term.</td></tr>`}</tbody></table></div>`;
  const identifierLegend = `<p class="rc-legend"><b>Identifier:</b> 3 = AVG ≥ 2.5 · 2 = AVG ≥ 1.5 · 1 = AVG &lt; 1.5</p>`;
  const gradeLegend = (level) => level === "A_LEVEL"
    ? `<p class="rc-legend"><b>Grade scale:</b> A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34</p>`
    : `<p class="rc-legend"><b>Grade scale:</b> A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E &lt; 50</p>`;

  function renderNursery(report) {
    const rows = scoreRows(report);
    const namedAreas = rows.slice(0, 5);
    const areaRows = Array.from({ length: 5 }, (_, index) => {
      const item = namedAreas[index];
      return `<tr><td>${item ? value(item.subject.name) : `Learning area ${index + 1}`}</td><td>${number(item?.mark.pct100)}</td><td>${value(item?.mark.descriptor)}</td></tr>`;
    });
    const activities = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes/Stories", "Music", "Health Habits", "Toilet Habits"];
    const activityRows = activities.map((activity) => `<tr><td>${esc(activity)}</td><td>—</td><td>—</td></tr>`);
    const summary = report.summary || {};
    return `<article class="rc-preview" style="--rc-theme:${themeColor(report.school?.report_theme)}">
      ${header(report, "Nursery Learning Report")}
      <div class="rc-two-panels">
        <section><h3>Learning areas</h3>${table(["Learning area", "Score / 100", "Remark"], areaRows)}</section>
        <section><h3>Activities</h3>${table(["Activity", "Progress", "Remark"], activityRows)}</section>
      </div>
      <div class="rc-summary"><span><b>Total score</b> ${number(summary.total_score, 0)}</span><span><b>Position</b> ${value(summary.position)} of ${value(summary.class_size)}</span></div>
      ${footer(report)}
    </article>`;
  }

  function renderPrimary(report) {
    const rows = scoreRows(report).map(({ subject, mark }) =>
      `<tr><td>${value(subject.name)}</td><td>${number(mark.pct100)}</td><td>${value(mark.identifier)}</td><td>${value(mark.position)} of ${value(mark.class_size)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td></tr>`,
    );
    const summary = report.summary || {};
    return `<article class="rc-preview" style="--rc-theme:${themeColor(report.school?.report_theme)}">
      ${header(report, "Primary School Report")}
      ${table(["Subject", "Marks", "Aggr", "Position", "Remarks", "Initials"], rows)}
      <div class="rc-summary"><span><b>Overall position</b> ${value(summary.position)} of ${value(summary.class_size)}</span><span><b>Average</b> ${number(summary.overall_average)}</span><span><b>Grade</b> ${value(summary.overall_grade)}</span></div>
      <p class="rc-legend"><b>Legend:</b> Very Good — B · Good — C · Fair — D · Still Weak — E</p>
      ${footer(report)}
    </article>`;
  }

  function renderSecondary(report, level) {
    const rows = scoreRows(report).map(({ subject, mark }) => `<tr>
      <td>${value(subject.code)}</td><td>${value(subject.name)}</td>
      ${level === "A_LEVEL" ? `<td>${value(mark.paper_number)}</td>` : ""}
      <td>${number(mark.a1)}</td><td>${number(mark.a2)}</td><td>${number(mark.a3)}</td>
      <td>${number(mark.avg)}</td><td>${number(mark.pct20)}</td><td>${number(mark.eot)}</td>
      <td>${number(mark.pct80)}</td><td>${number(mark.pct100)}</td><td>${value(mark.identifier)}</td>
      <td>${value(mark.grade)}</td><td>${value(mark.descriptor)}</td><td>${value(mark.teacher_initials)}</td>
    </tr>`);
    const heads = ["Code", "Subject", ...(level === "A_LEVEL" ? ["Paper"] : []),
      "A1", "A2", "A3", "AVG", "20%", "EOT", "80%", "100%", "Ident", "Grade", "Descriptor", "TR"];
    const summary = report.summary || {};
    const projects = (report.projects || []).map((project) => `<tr><td>${value(project.project_name)}</td><td>${number(project.score)}</td><td>${number(project.out_of)}</td><td>${number(project.percentage)}%</td><td>${value(project.grade)}</td><td>${value(project.remarks)}</td></tr>`);
    return `<article class="rc-preview" style="--rc-theme:${themeColor(report.school?.report_theme)}">
      ${header(report, level === "A_LEVEL" ? "A-Level Report" : "O-Level Report")}
      ${table(heads, rows, "rc-dense")}
      <div class="rc-summary rc-summary-wide">
        <span><b>Overall average</b> ${number(summary.overall_average)}</span>
        <span><b>Overall grade</b> ${value(summary.overall_grade)}</span>
        <span><b>Position</b> ${value(summary.position)} of ${value(summary.class_size)}</span>
        <span><b>Result</b> ${summary.overall_average === null ? "Pending" : "Recorded"}</span>
      </div>
      ${gradeLegend(level)}${identifierLegend}
      ${level === "A_LEVEL" ? `<section class="rc-projects"><h3>Projects</h3>${table(["Project", "Score", "Out of", "Percent", "Grade", "Remarks"], projects)}</section>` : ""}
      ${footer(report, ["Class Teacher Comment", "Head Teacher Comment"])}
    </article>`;
  }

  window.ReportCardPreview = {
    render(report) {
      const level = levelCode(report.class?.level);
      if (level === "PRIMARY") return renderPrimary(report);
      if (level === "O_LEVEL" || level === "A_LEVEL") return renderSecondary(report, level);
      return renderNursery(report);
    },
  };
})();
