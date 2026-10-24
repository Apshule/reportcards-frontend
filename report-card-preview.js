(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const value = (input) => input === null || input === undefined || input === "" ? "—" : esc(input);
  const infoValue = (label, input) => {
    const blankWhenMissing = ["HOUSE", "ABSENT", "DAYS ABSENT"].includes(String(label).toUpperCase());
    return blankWhenMissing && (input === null || input === undefined || String(input).trim() === "")
      ? ""
      : value(input);
  };
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
  const safeHexColor = (input, fallback) =>
    /^#[0-9a-f]{6}$/i.test(String(input || "")) ? String(input) : fallback;
  const colorWithAlpha = (hex, alpha) => {
    const clean = safeHexColor(hex, "#4B2E9E").slice(1);
    const [red, green, blue] = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
    return `rgba(${red},${green},${blue},${alpha})`;
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
  const reportPositionEnabled = (report, level = levelCode(report.class?.level), templateId = "1") => {
    const setting = report?.school?.show_report_position ?? report?.show_report_position;
    return setting !== false && setting !== "false" && !(level === "PRIMARY" && String(templateId) === "3");
  };
  const periodSummary = (report, options = {}) => {
    const summary = report.summary || {};
    const level = levelCode(report.class?.level);
    const template = templateInfo(level, options);
    const showPosition = reportPositionEnabled(report, level, template.id);
    const resultMetric = summary.result_metric ?? report.primary_result_metric ?? report.school?.primary_result_metric;
    const usePleAggregate = level === "PRIMARY" && resultMetric === "ple_aggregate";
    const resultValue = usePleAggregate
      ? `${value(summary.aggregate)}${summary.aggregate_division ? ` · ${value(summary.aggregate_division)}` : ""}`
      : number(summary.overall_average);
    return `<div class="rc-summary rc-period-summary">
      ${showPosition ? `<span><b>POSITION:</b> ${value(summary.position)} OUT OF ${value(summary.class_size)}</span>` : ""}
      <span><b>${usePleAggregate ? "PLE AGGREGATE" : "AVERAGE"}:</b> ${resultValue}</span>
      ${report.ple_official_enabled && !usePleAggregate ? `<span><b>AGGREGATE:</b> ${value(summary.aggregate)} · <b>DIVISION:</b> ${value(summary.aggregate_division)}</span>` : ""}
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
    const theme = window.ReportCardThemeEngine?.getTemplateTheme?.(level, template.definition, suppliedTheme, report.school)
      || window.ReportCardThemeEngine?.getTheme?.(level, suppliedTheme, report.school)
      || defaults;
    const layoutFormat = options.layoutFormat || report.layout_format || "A4";
    const layoutClass = layoutFormat === "A5_CONDENSED" ? " rc-preview-a5-condensed" : "";
    const customFont=Boolean(report.school?.report_font_color);
    const pageBackground=report.school?.report_background_color||"#FFFFFF";
    return `class="rc-preview rc-preview-level-${level.toLowerCase()}${layoutClass}" data-level="${level}" data-template="${esc(template.id)}" data-layout-format="${esc(layoutFormat)}" data-custom-font="${customFont}" style="--rc-theme:${theme.primary_color};--rc-header:${theme.header_color};--rc-header-text:${theme.header_text_color};--rc-table-header:${theme.table_header_color};--rc-table-header-text:${theme.table_header_text_color};--rc-accent:${theme.accent_color};--rc-accent-text:${contrastText(theme.accent_color)};--rc-table-bg:${theme.background_color};--rc-page-bg:${pageBackground};--rc-font:${theme.font_color||"#24242a"}`;
  }
  const scoreRows = (report) => (report.subjects || []).map((subject) => ({
    subject,
    mark: subject.mark || {},
  }));
  const header = (report, title, options = {}) => {
    const school = report.school || {};
    const learner = report.learner || {};
    const summary = report.summary || {};
    const level = levelCode(report.class?.level);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(", ");
    const subtitle = school.school_subtitle || school.subtitle || school.school_type || "";
    const contact = [
      school.phone ? `Tel: ${school.phone}` : "",
      school.email ? `Email: ${school.email}` : "",
    ].filter(Boolean).join(", ");
    const logo = imageSource(school.logo_base64);
    const photo = imageSource(learner.photo_base64);
    const term = displayTerm(report.term);
    const termNumber = term.replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3");
    const period = assessmentPeriod(report, options);
    const presetKey = report.grading_scale_preset_key
      ?? report.active_grading_scale?.preset_key
      ?? report.grading_scale?.preset_key;
    const bannerText = ["o_level_old_uce", "o_level_new_uce"].includes(presetKey)
      ? "ANNUAL UCE REPORT"
      : `${termNumber} PROGRESS REPORT — ${period.title}`;
    return `<header class="rc-head">
      <div class="rc-brand-image">${logo ? `<img src="${esc(logo)}" alt="School logo">` : `<span>${esc(String(school.name || "S").slice(0, 1))}</span>`}</div>
      <div class="rc-school">
        <h2>${value(school.name)}</h2>
        ${subtitle ? `<p class="rc-school-subtitle">${value(subtitle)}</p>` : ""}
        ${address ? `<p class="rc-school-address">${value(address)}</p>` : ""}
        ${contact ? `<p class="rc-school-contact">${value(contact)}</p>` : ""}
        ${school.website ? `<p class="rc-school-website">Website: ${value(school.website)}</p>` : ""}
        ${school.motto ? `<p class="rc-motto">${value(school.motto)}</p>` : ""}
      </div>
      <div class="rc-learner-image">${photo ? `<img src="${esc(photo)}" alt="${value(learner.full_name)}">` : `<span>Photo</span>`}</div>
    </header>
    <div class="rc-accent-rule"></div>
      <div class="rc-report-title">${esc(bannerText)}</div>`;
  };
  const learnerInfo = (report, level = "", options = {}) => {
    const learner = report.learner || {};
    const summary = report.summary || {};
    const template = templateInfo(level, options);
    const showPosition = reportPositionEnabled(report, level, template.id);
    const rows = level === "NURSERY" ? [
      [["REG NO", learner.reg_no], ["CLASS", report.class?.name], ["FEES BAL", report.fees?.balance], ["SCHOOLPAY CODE", learner.schoolpay_code || report.school?.schoolpay_code]],
      [["NAME", learner.full_name], ["DAYS ATTENDED", report.days_attended ?? report.days_present], ["ABSENT", report.days_absent ?? learner.days_absent ?? report.absence], ["TOTAL", report.total_days ?? report.school_days], ["HOUSE", learner.house]],
    ] : level === "PRIMARY" ? [
      [["NAME", learner.full_name], ["AD No", learner.reg_no], ["PRINT DATE", formatReportDate(report.printed_at || report.generated_at || new Date())]],
       [["CLASS", report.class?.name], ["SEX", learner.sex || learner.gender], ["AGE", learner.age], ["SCHOOLPAY CODE", learner.schoolpay_code]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? learner.days_absent ?? report.absence], ["TERM", displayTerm(report.term)], ["YEAR", report.year]],
      [["POSITION", summary.position], ["OUT OF", summary.class_size]],
    ] : level === "O_LEVEL" ? [
      [["NAME", learner.full_name], ["TERM", displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3")], ["YEAR", report.year], ["DATE", formatReportDate(report.printed_at || report.generated_at || new Date())]],
       [["SCHOLAR ID", learner.scholar_id || learner.reg_no], ["CLASS", report.class?.name], ["VCODE", learner.vcode], ["SCHOOLPAY CODE", learner.schoolpay_code]],
      [["LIN/AMIS.NO", learner.lin || learner.amis_no], ["STATE", learner.state], ["RESIDENCE", learner.residence], ["HOUSE", learner.house]],
    ] : level === "A_LEVEL" ? [
      [["NAME", learner.full_name], ["GENDER", learner.gender || learner.sex]],
       [["AGE", learner.age], ["ROLL NO", learner.roll_no || learner.reg_no], ["SCHOOLPAY CODE", learner.schoolpay_code]],
      [["CLASS", report.class?.name], ["STREAM", learner.stream || report.class?.stream], ["HOUSE", learner.house]],
      [["COMBINATION", learner.combination || report.class?.combination], ["TERM", displayTerm(report.term).replace("TERM I", "TERM 1").replace("TERM II", "TERM 2").replace("TERM III", "TERM 3")]],
    ] : [
      [["NAME", learner.full_name], ["AD No", learner.reg_no]],
       [["CLASS", report.class?.name], ["SEX", learner.sex], ["SCHOOLPAY CODE", learner.schoolpay_code]],
      [["HOUSE", learner.house], ["DAYS ABSENT", report.days_absent ?? learner.days_absent ?? report.absence]],
      [["POSITION", summary.position], ["OUT OF", summary.class_size]],
      [["TERM", displayTerm(report.term)], ["YEAR", report.year], ["PRINT DATE", formatReportDate(new Date())]],
    ];
    const visibleRows = rows.filter((row) => showPosition || !row.some(([label]) => label === "POSITION"));
    return `<div class="rc-learner-grid rc-learner-grid-${String(level || "general").toLowerCase()}">${visibleRows.map((row, index) =>
      `<div class="rc-info-row rc-info-row-${row.length} ${index % 2 ? "is-tinted" : ""}">${row.map(([label, content]) =>
        `<div><b>${esc(label)}</b><span>${infoValue(label, content)}</span></div>`).join("")}</div>`).join("")}</div>`;
  };
  const defaultOtherSubjects = ["Handwriting", "Art & Drawing", "P.E & Games", "Music", "Luganda", "Religious Education"];
  const pleEnabled = (report) => report?.ple_official_enabled === true ||
    (report?.grading_scale_preset_key === "primary_ple_upper" && levelCode(report?.class?.level) === "PRIMARY");
  const incompleteWarning = (report) => {
    const subjects = Array.isArray(report?.incomplete_marks) ? report.incomplete_marks : [];
    return pleEnabled(report) && subjects.length
      ? `<p class="alert warning rc-incomplete-marks" role="alert"><b>Incomplete marks</b>: ${esc(subjects.join(", "))}</p>`
      : "";
  };
  const coCurricular = (report, includeDefaults = false) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = items.map((item) => [
      item.activity_name || item.name || item.subject_name || item.subject?.name,
      item.progress ?? item.score,
      item.remark || item.descriptor,
      item.signature || item.teacher_initials,
    ]);
    if (includeDefaults && !report.co_curricular_configured && rows.length < defaultOtherSubjects.length) {
      defaultOtherSubjects.slice(rows.length).forEach((name) => rows.push([name, "", "", ""]));
    }
    return rows.map((row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join("")}</tr>`);
  };
  const nurseryActivityNames = ["Writing", "Listening", "Reading", "Speaking", "Drawing", "Games", "Rhymes / Stories", "Music", "Health Habits", "Toilet Habits"];
  const nurseryIconKeys = ["writing", "listening", "reading", "speaking", "drawing", "games", "rhymes_stories", "music", "health_habits", "toilet_habits"];
  const activityKey = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const activityIconSource = (report, name) => {
    const icons = report.school?.activity_icons;
    const row = Array.isArray(icons)
      ? icons.find((item) => activityKey(item.activity_name) === activityKey(name))
      : icons?.[name];
    return imageSource(row?.icon_base64 || row?.icon || "");
  };
  const nurseryGradeForScore = (score, mark, report) => {
    if (score === null || score === undefined || score === "") return "—";
    const numericScore = Number(score);
    const rows = Array.isArray(report.grading_scale)
      ? report.grading_scale
      : report.grading_scale?.rows || [];
    const match = rows.find((row) => {
      const min = Number(row.min_score ?? row.min);
      const max = Number(row.max_score ?? row.max);
      return Number.isFinite(min) && Number.isFinite(max) && numericScore >= min && numericScore <= max;
    });
    if (match) return match.grade_code || match.grade || "—";
    return mark?.grade || mark?.grade_code || (numericScore >= 80 ? "A" : numericScore >= 70 ? "B" : numericScore >= 60 ? "C" : numericScore >= 50 ? "D" : "E");
  };
  const nurseryActivityItems = (report) => {
    const items = Array.isArray(report.activities) ? report.activities
      : Array.isArray(report.learning_activities) ? report.learning_activities
        : Array.isArray(report.other_subjects) ? report.other_subjects : [];
    const rows = items.map((item, index) => ({
      name: item.activity_name || item.name || item.subject_name || item.subject?.name || nurseryActivityNames[index] || `Activity ${index + 1}`,
      remark: item.remark || item.descriptor || item.teacher_remark || "",
      image: item.image_base64 || item.illustration_base64 || item.photo_base64 || "",
    }));
    const byName = new Map(rows.map((item) => [activityKey(item.name), item]));
    return nurseryActivityNames.map((name, index) => ({
      ...(byName.get(activityKey(name)) || { name, remark: "", image: "" }),
      name,
      icon: activityIconSource(report, name),
      defaultIcon: `/pdf-templates/nursery-icons/${nurseryIconKeys[index]}.png`,
    }));
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
      ["Behaviors / Cleanliness", report.behaviors_comment || report.behaviour_comment || report.cleanliness_comment || "Good behavior and maintains cleanliness.", "Behaviors"],
      ["Head of Infants Remarks", report.head_of_infants_comment || report.head_teacher_comment, "Head of Infants"],
    ] : [
      ["Class Teacher's Remarks", report.class_teacher_comment || report.suggested_comment, "Class Teacher"],
      ["Head Teacher's Remarks", report.head_teacher_comment || report.head_of_infants_comment, "Head Teacher"],
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
    const school = report.school || {};
    if (
      options.includeStamp === false ||
      report.show_stamp === false ||
      school.show_stamp === false
    ) return "";
    const stamp = {
      ...(school.stamp_config && typeof school.stamp_config === "object" ? school.stamp_config : {}),
      ...(report.stamp_config && typeof report.stamp_config === "object" ? report.stamp_config : {}),
    };
    if (!stamp || typeof stamp !== "object" || !Object.keys(stamp).length) return "";
    const lines = [stamp.line_1, stamp.line_2, stamp.line_3, stamp.line_4, stamp.line_5].filter(Boolean);
    const shape = ["circle", "oval", "rounded_rectangle"].includes(String(stamp.shape || "").toLowerCase()) ? String(stamp.shape).toLowerCase() : "rectangle";
    const primaryColor = safeHexColor(stamp.primary_color, "#4B2E9E");
    const secondaryColor = safeHexColor(stamp.secondary_color, "#000000");
    const transparencyValue = Number(stamp.transparency);
    const legacyOpacity = Number(stamp.opacity);
    const stampAlpha = Number.isFinite(transparencyValue)
      ? Math.max(0, Math.min(100, transparencyValue)) / 100
      : Number.isFinite(legacyOpacity)
        ? Math.max(0, Math.min(1, legacyOpacity))
        : 0.45;
    const rotation = Math.max(-15, Math.min(15, Number(stamp.rotation_degrees) || 0));
    const position = String(stamp.position || "Bottom Right").toLowerCase().replace(/[\s_]+/g, "-");
    const positionClass = ["bottom-left", "bottom-center"].includes(position) ? position : "bottom-right";
    const logoPosition = String(
      school.stamp_logo_position ?? stamp.stamp_logo_position ?? "inside_center",
    ).toLowerCase().replace(/[\s-]+/g, "_");
    const validLogoPositions = [
      "inside_center", "inside_top", "inside_bottom", "inside_left", "inside_right",
      "outside_left", "outside_right", "hidden",
    ];
    const normalizedLogoPosition = validLogoPositions.includes(logoPosition) ? logoPosition : "inside_center";
    const logo = imageSource(school.logo_base64);
    const numericSetting = (key, fallback, min, max) => {
      const direct = Number(report[key] ?? school[key] ?? stamp[key]);
      return Number.isFinite(direct) ? Math.max(min, Math.min(max, direct)) : fallback;
    };
    const stampDimensions = shape === "circle" ? [68, 68] : shape === "oval" ? [88, 54] : [98, 58];
    const maxLogoSizeMm = Math.min(...stampDimensions) * 0.5 * 25.4 / 96;
    const logoSize = Math.min(numericSetting("stamp_logo_size", 20, 1, 100), maxLogoSizeMm);
    let offsetX = numericSetting("stamp_logo_offset_x", 0, -100, 100) * 96 / 25.4;
    let offsetY = numericSetting("stamp_logo_offset_y", 0, -100, 100) * 96 / 25.4;
    if (logo && normalizedLogoPosition.startsWith("inside_")) {
      const [stampWidth, stampHeight] = stampDimensions;
      const baseX = stampWidth * (normalizedLogoPosition === "inside_left" ? 0.23 : normalizedLogoPosition === "inside_right" ? 0.77 : 0.5);
      const baseY = stampHeight * (normalizedLogoPosition === "inside_top" ? 0.23 : normalizedLogoPosition === "inside_bottom" ? 0.77 : 0.5);
      const logoRadius = logoSize * 96 / 25.4 / Math.SQRT2;
      const availableRadius = Math.max(0, Math.min(stampWidth, stampHeight) / 2 - 2 - logoRadius);
      const dx = baseX + offsetX - stampWidth / 2;
      const dy = baseY + offsetY - stampHeight / 2;
      const distance = Math.hypot(dx, dy);
      if (distance > availableRadius && distance > 0) {
        const scale = availableRadius / distance;
        offsetX = stampWidth / 2 + dx * scale - baseX;
        offsetY = stampHeight / 2 + dy * scale - baseY;
      }
    }
    const logoRotationValue = numericSetting("stamp_logo_rotation", 0, 0, 360);
    const logoRotation = [0, 90, 180, 270].includes(logoRotationValue) ? logoRotationValue : 0;
    const logoOpacity = numericSetting("stamp_logo_opacity", 100, 0, 100) / 100;
    const logoMarkup = logo && normalizedLogoPosition !== "hidden"
      ? `<img class="rc-stamp-logo rc-stamp-logo-${normalizedLogoPosition}" src="${esc(logo)}" alt="School logo in digital stamp">`
      : "";
    const outsideLogo = ["outside_left", "outside_right"].includes(normalizedLogoPosition) ? " rc-stamp-has-external-logo" : "";
    return `<div class="rc-stamp-preview rc-stamp-${shape} rc-stamp-${positionClass}${outsideLogo}" style="--rc-stamp-text:${colorWithAlpha(primaryColor, stampAlpha)};--rc-stamp-border:${colorWithAlpha(secondaryColor, stampAlpha)};--rc-stamp-rotation:${rotation}deg;--rc-stamp-logo-size:${logoSize}mm;--rc-stamp-logo-x:${offsetX}px;--rc-stamp-logo-y:${offsetY}px;--rc-stamp-logo-rotation:${logoRotation}deg;--rc-stamp-logo-opacity:${logoOpacity}" aria-label="Configured school stamp"><div class="rc-stamp-copy">${lines.map((line) => `<span>${value(line)}</span>`).join("")}</div>${logoMarkup}</div>`;
  };
  const qrFooterSide = (report) => {
    const school = report.school || {};
    const stamp = {
      ...(school.stamp_config && typeof school.stamp_config === "object" ? school.stamp_config : {}),
      ...(report.stamp_config && typeof report.stamp_config === "object" ? report.stamp_config : {}),
    };
    const position = String(stamp.position || "Bottom Right").toLowerCase().replace(/[\s_]+/g, "");
    return position === "bottomcenter" ? "right" : "center";
  };
  const authenticityQrBlock = (report) => {
    const image = report.authenticity_qr_data_url;
    if (!image) return "";
    return `<div class="rc-authenticity-qr" data-qr-position="${qrFooterSide(report)}"><img src="${esc(image)}" alt="Report card authenticity QR code"><span>Scan to Verify Authenticity</span></div>`;
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
    const gradeScale = gradeLegend(report, level);
    const authenticityQr = authenticityQrBlock(report);
    const gradeParts = gradeScale.split(/\s*·\s*/u);
    const midpoint = Math.ceil(gradeParts.length / 2);
    const qrSide = qrFooterSide(report);
    const gradingScaleMarkup = !authenticityQr
      ? `<div class="rc-grading-scale"><b>GRADING SCALE:</b> ${esc(gradeScale)}</div>`
      : qrSide === "center"
        ? `<div class="rc-grading-scale rc-grading-scale--qr-center"><span><b>GRADING SCALE:</b> ${esc(gradeParts.slice(0, midpoint).join(" · "))}</span><span aria-hidden="true"></span><span>${esc(gradeParts.slice(midpoint).join(" · "))}</span></div>`
        : `<div class="rc-grading-scale rc-grading-scale--qr-right"><span><b>GRADING SCALE:</b> ${esc(gradeScale)}</span><span aria-hidden="true"></span></div>`;
    const termDates = `<div class="rc-early-footer-line">
      <span><b>Term Ends On:</b> ${formatReportDate(dates.term_ended_on)}</span>
      <span><b>Next Term Begins:</b> ${formatReportDate(dates.next_term_begins)}</span>
    </div>`;
    const footerDetails = level === "NURSERY"
      ? `${termDates}<div class="rc-early-footer-line"><span><b>Date of Issue:</b> ${formatReportDate(report.printed_at || report.generated_at || new Date())}</span></div><div class="rc-school-requirements"><b>School Requirements:</b> ${value(school.school_requirements)}</div>`
      : level === "PRIMARY"
        ? termDates
        : `<div class="rc-footer-details">
          <span><b>School term / year</b> ${value(dates.current_term)} / ${value(dates.current_year)}</span>
          <span><b>Term Ends On:</b> ${formatReportDate(dates.term_ended_on)}</span>
          <span><b>Next Term Begins:</b> ${formatReportDate(dates.next_term_begins)}</span>
          <span><b>Next term fees</b> ${value(dates.next_term_fees)}</span>
          <span><b>Fees balance</b> ${value(fees.balance)}</span>
        </div>`;
    const footerLead = value(school.name);
    const footerCenter = earlyYears ? value(school.motto) : "";
    const contactLeft = value([school.street, school.po_box, school.city, school.district].filter(Boolean).join(" · "));
    const contactRight = value(school.website || school.motto || school.report_footer_text);
    const footerContactMarkup = !authenticityQr
      ? `<div class="rc-footer-contact"><span>${contactLeft}</span><span>${contactRight}</span></div>`
      : qrSide === "center"
        ? `<div class="rc-footer-contact rc-footer-contact--qr-center"><span>${contactLeft}</span><span aria-hidden="true"></span><span>${contactRight}</span></div>`
        : `<div class="rc-footer-contact rc-footer-contact--qr-right"><span>${contactLeft}${contactLeft && contactRight ? " · " : ""}${contactRight}</span><span aria-hidden="true"></span></div>`;
    return `<footer class="rc-footer">
      ${footerDetails}
      ${level === "O_LEVEL" ? `<p class="rc-secondary-footer-note">Outstanding school fees balance is UGX ${value(fees.balance)} as at ${formatReportDate(report.printed_at || report.generated_at || new Date())}<br>T = Topic; EOTI = end of term 1</p>` : ""}
      ${gradingScaleMarkup}
      <div class="rc-footer-band"><span>${footerLead}</span><span class="rc-grade-key">${footerCenter}</span><span class="rc-page-count">Page 1 of 1</span></div>
      ${footerContactMarkup}
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
  const gradeLegend = (report, level) => {
    const bands = (Array.isArray(report.grading_scale) ? report.grading_scale : []).map((band) => {
      const grade = String(band.grade_code || "").trim();
      const min = Number(band.min_score);
      const max = Number(band.max_score);
      if (!grade || !Number.isFinite(min) || !Number.isFinite(max)) return "";
      const score = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
      const points = band.points === null || band.points === undefined || band.points === ""
        ? ""
        : ` (${String(band.points)} pt${Number(band.points) === 1 ? "" : "s"})`;
      const description = String(band.descriptor || "").trim();
      return `${grade} ${score(min)}–${score(max)}${points}${description ? ` ${description}` : ""}`;
    }).filter(Boolean);
    if (pleEnabled(report)) {
      return bands.length ? `UNEB PLE: ${bands.join(" · ")}` : "UNEB PLE grading scale unavailable";
    }
    if (bands.length) {
      const scheme = report.grading_points_scheme || {};
      const mapText = (key) => {
        const map = scheme[key] || {};
        return ["A", "B", "C", "D", "E", "O", "F"]
          .filter((grade) => map[grade] !== undefined)
          .map((grade) => `${grade}=${map[grade]}`)
          .join(", ");
      };
      const points = report.grading_scale_preset_key === "a_level_legacy"
        ? ` · Principal points ${mapText("principal")} · Subsidiary points ${mapText("subsidiary")}`
        : "";
      const composition = report.grading_scale_preset_key === "a_level_uace_cbc"
        ? " · 20% CA + 80% Exams"
        : "";
      return `${bands.join(" · ")}${points}${composition}`;
    }
    return level === "A_LEVEL"
      ? "A 75–100 · B 65–74 · C 50–64 · D 35–49 · E 0–34"
      : level === "NURSERY"
        ? "Learning areas are assessed by descriptor"
        : "A 80–100 · B 70–79 · C 60–69 · D 50–59 · E 0–49";
  };
  const gradeDisplay = (mark = {}, includePoints = true) => {
    const grade = String(mark.grade || "").trim();
    const overall = String(mark.overall_grade_code || "").trim();
    const points = !includePoints || mark.points === null || mark.points === undefined || mark.points === ""
      ? ""
      : String(mark.points);
    if (overall) return `${grade ? `${grade}/` : ""}${overall}${points ? ` (${points} pts)` : ""}`;
    return `${grade}${points ? ` (${points} pts)` : ""}`;
  };

  function renderA5Condensed(report, options = {}) {
    const period = assessmentPeriod(report, options);
    if (period.key !== "COMBINED_BM") {
      return `<article ${previewAttrs(report, levelCode(report.class?.level), options)}><div class="rc-preview-content"><p class="alert info">The Half Page (A5) Condensed layout is for Combined (B.O.T + Midterm).</p></div></article>`;
    }
    const level = levelCode(report.class?.level);
    const school = report.school || {};
    const learner = report.learner || {};
    const summary = report.summary || {};
    const logo = imageSource(school.logo_base64);
    const photo = imageSource(learner.photo_base64);
    const subtitle = school.school_subtitle || school.subtitle || school.school_type || "";
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(", ");
    const entries = scoreRows(report);
    const rows = entries.map(({ subject, mark }) => {
      const average = periodTools().periodScore(mark, period.key);
      return [
        `<b>${value(subject.name)}</b>`,
        periodCell(mark, "bot", period),
        periodCell(mark, "mid_term", period),
        number(average),
        value(gradeDisplay(mark, !pleEnabled(report))),
        ...(pleEnabled(report) ? [number(mark.points, 0)] : []),
        value(mark.tr || mark.teacher_remark || mark.descriptor || mark.remark),
      ];
    }).map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`);
    const comments = [
      ["Class Teacher", report.class_teacher_comment || report.suggested_comment],
      ["Principal", report.principal_comment || report.head_teacher_comment],
    ].filter(([, text]) => text).map(([label, text]) => `<p><b>${esc(label)}:</b> ${value(String(text).replace(/\s+/g, " ").trim())}</p>`);
    const schoolContact = [
      school.phone ? `Tel: ${school.phone}` : "",
      school.email ? `Email: ${school.email}` : "",
    ].filter(Boolean).join(", ");
    const info = [
      ["Learner", learner.full_name],
      ["Class", report.class?.name],
      ["Term / Year", `${displayTerm(report.term)} ${report.year ?? ""}`.trim()],
      ["Term Ends On", formatReportDate(report.term_dates?.term_ended_on)],
      ["Next Term Begins", formatReportDate(report.term_dates?.next_term_begins)],
      ["Reg. No. / House", [learner.reg_no, learner.house ? `House ${learner.house}` : ""].filter(Boolean).join(" · ")],
    ];
    const resultMetric = summary.result_metric ?? report.primary_result_metric ?? school.primary_result_metric;
    const usePleAggregate = level === "PRIMARY" && resultMetric === "ple_aggregate";
    const resultSummary = usePleAggregate
      ? `<b>PLE Aggregate:</b> ${value(summary.aggregate)}${summary.aggregate_division ? ` · ${value(summary.aggregate_division)}` : ""}`
      : `<b>Average:</b> ${number(summary.overall_average)}`;
    const pleSummary = pleEnabled(report) && !usePleAggregate
      ? ` &nbsp; · &nbsp; <b>Aggregate:</b> ${value(summary.aggregate)} · <b>Division:</b> ${value(summary.aggregate_division)}`
      : "";
    return `<article ${previewAttrs(report, level, options)}>
      <div class="rc-preview-content rc-a5-content">
        <header class="rc-a5-header">
          ${logo ? `<img src="${esc(logo)}" alt="School logo">` : `<span class="rc-a5-logo-placeholder">${esc(String(school.name || "S").slice(0, 1))}</span>`}
          <div class="rc-a5-school">
            <h2>${value(school.name)}</h2>
            ${subtitle ? `<p class="rc-a5-subtitle">${value(subtitle)}</p>` : ""}
            ${address ? `<p>${value(address)}</p>` : ""}
            ${schoolContact ? `<p>${value(schoolContact)}</p>` : ""}
            ${school.website ? `<p>Website: ${value(school.website)}</p>` : ""}
            ${school.motto ? `<p class="rc-a5-motto">${value(school.motto)}</p>` : ""}
            <strong>${esc(displayTerm(report.term))} · B.O.T + MIDTERM REPORT</strong>
          </div>
          <div class="rc-a5-learner-image">${photo ? `<img src="${esc(photo)}" alt="${value(learner.full_name)}">` : `<span>Photo</span>`}</div>
        </header>
        <div class="rc-a5-learner-info">${info.map(([label, content]) => `<span><b>${esc(label)}:</b> ${value(content)}</span>`).join("")}</div>
        ${incompleteWarning(report)}
        <div class="rc-a5-table-wrap">${table(
          ["Subject", "B.O.T", "Midterm", "Average", "Grade", ...(pleEnabled(report) ? ["Points"] : []), "Remarks"],
          rows,
          "rc-a5-table",
          "",
          "",
        )}</div>
        <section class="rc-a5-bottom">
          <div class="rc-a5-remarks">${comments.join("") || "<p>—</p>"}</div>
          <p class="rc-a5-grading-key">${resultSummary}${pleSummary} &nbsp; · &nbsp; <b>Grading key:</b> ${esc(gradeLegend(report, level))}</p>
          <div class="rc-a5-signature"><span></span><b>Class Teacher's signature</b></div>
        </section>
      </div>
    </article>`;
  }

  function renderNursery(report, options = {}) {
    const rows = scoreRows(report);
    const summary = report.summary || {};
    const period = assessmentPeriod(report, options);
    const activities = nurseryActivityItems(report);
    const maxScore = summary.maximum_score ?? summary.total_possible ?? rows.length * 100;
    const scored = rows.reduce((total, { mark }) => {
      const score = periodTools().periodScore(mark, period.key);
      return score === null ? total : total + score;
    }, 0);
    const combined = period.key === "COMBINED_BM";
    const areaRows = rows.map(({ subject, mark }, index) => {
      const description = subject.learning_area_description || subject.description || subject.learning_outcome || subject.details || "";
      const average = periodTools().periodScore(mark, period.key);
      const cells = [
        `<b>${value(subject.name || `Learning Area ${index + 1}`)}</b>${description ? `<small>${value(description)}</small>` : ""}`,
        ...period.fields.map(({ key }) => periodCell(mark, key, period)),
        ...(combined ? [number(average), value(nurseryGradeForScore(average, mark, report))] : []),
        value(mark.tr || mark.teacher_remark || mark.descriptor || mark.remark),
        "<i aria-hidden=\"true\"></i>",
      ];
      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    });
    const activityCards = activities.map((item) => {
      const source = item.icon || imageSource(item.image) || item.defaultIcon;
      return `<div class="rc-nursery-activity-card"><div><b>${value(item.name)}</b><span>${value(item.remark)}</span></div><img src="${esc(source)}" alt="" loading="eager"></div>`;
    }).join("");
    const headers = [
      "AREA",
      ...period.fields.map(({ label }) => label),
      ...(combined ? ["AVERAGE", "GRADE"] : []),
      "TEACHER'S REMARK",
      "SIGNATURE",
    ];
    const tableClass = `rc-period-table${combined ? " rc-nursery-combined-table" : ""}`;
    return `<article ${previewAttrs(report, "NURSERY", options)}>
      <div class="rc-preview-content">
      ${header(report, `${period.title} Nursery Learning Report`, options)}
      ${learnerInfo(report, "NURSERY", options)}
      <section class="rc-nursery-panels">
        <div class="rc-nursery-learning">
          <div class="rc-nursery-panel-title">Achievement Scores — ${esc(period.title)}</div>
          ${table(headers, areaRows, tableClass)}
          <div class="rc-nursery-totalbar"><span>TOTAL: ${number(maxScore, 0)}</span><span>SCORED: ${number(scored, 0)}</span>${reportPositionEnabled(report, "NURSERY", templateInfo("NURSERY", options).id) ? `<span>POSITION ${value(summary.position)} OUT OF ${value(summary.class_size)}</span>` : ""}</div>
        </div>
        <div class="rc-nursery-activities">
          <div class="rc-nursery-panel-title">Performance in the Learning Activities</div>
          <div class="rc-nursery-activity-grid">${activityCards}</div>
        </div>
      </section>
        ${periodSummary(report, options)}
       ${earlyYearsRemarks(report, "NURSERY")}
      ${stampBlock(report, options)}
       ${authenticityQrBlock(report)}
       ${footer(report, "NURSERY")}
      </div>
    </article>`;
  }

  function renderNurseryA5(report, options = {}) {
    const period = assessmentPeriod(report, options);
    if (period.key !== "COMBINED_BM") {
      return `<article ${previewAttrs(report, "NURSERY", options)}><div class="rc-preview-content"><p class="alert info">The Nursery A5 layout is for Combined (B.O.T + Midterm).</p></div></article>`;
    }
    const learner = report.learner || {};
    const school = report.school || {};
    const summary = report.summary || {};
    const entries = scoreRows(report);
    const activities = nurseryActivityItems(report);
    const areaRows = entries.map(({ subject, mark }, index) => {
      const average = periodTools().periodScore(mark, period.key);
      const description = subject.learning_area_description || subject.description || subject.learning_outcome || "";
      return [
        `<b>${value(subject.name || `Learning Area ${index + 1}`)}</b>${description ? `<small>${value(description)}</small>` : ""}<em>${value(mark.tr || mark.teacher_remark || mark.descriptor || mark.remark)}</em>`,
        periodCell(mark, "bot", period),
        periodCell(mark, "mid_term", period),
        number(average),
        value(nurseryGradeForScore(average, mark, report)),
      ];
    });
    const activityCards = activities.map((item) => {
      const source = item.icon || imageSource(item.image) || item.defaultIcon;
      return `<div class="rc-a5-nursery-activity"><img src="${esc(source)}" alt=""><div><b>${value(item.name)}</b><span>${value(item.remark)}</span></div></div>`;
    }).join("");
    const behavior = report.behaviors_comment || report.behaviour_comment || report.cleanliness_comment || "Good behavior and maintains cleanliness.";
    const comments = [
      ["Class Teacher's Report", report.class_teacher_comment || report.suggested_comment || ""],
      ["Behaviors / Cleanliness", behavior],
      ["Head Teacher's Comment", report.head_of_infants_comment || report.head_teacher_comment || ""],
    ];
    const total = entries.reduce((sum, { mark }) => sum + (periodTools().periodScore(mark, period.key) ?? 0), 0);
    const feeBalance = report.fees?.balance ?? "";
    const nextFees = report.term_dates?.next_term_fees ?? school.next_term_fees ?? "";
    const termEnd = formatReportDate(report.term_dates?.term_ended_on);
    const nextTerm = formatReportDate(report.term_dates?.next_term_begins);
    const logo = imageSource(school.logo_base64);
    const photo = imageSource(learner.photo_base64);
    const address = [school.street, school.po_box, school.city, school.district].filter(Boolean).join(", ");
    const contact = [school.phone ? `Tel: ${school.phone}` : "", school.email ? `Email: ${school.email}` : ""].filter(Boolean).join(" · ");
    return `<article ${previewAttrs(report, "NURSERY", options)}>
      <div class="rc-preview-content rc-a5-content rc-a5-nursery-content">
        <header class="rc-a5-nursery-header">
          <div class="rc-a5-nursery-logo">${logo ? `<img src="${esc(logo)}" alt="School logo">` : ""}</div>
          <div class="rc-a5-nursery-school"><h2>${value(school.name)}</h2><p>${value(address)}</p><p>${value(contact)}</p>${school.website ? `<p>Website: ${value(school.website)}</p>` : ""}<strong>${value(school.motto)}</strong></div>
          <div class="rc-a5-nursery-photo">${photo ? `<img src="${esc(photo)}" alt="${value(learner.full_name)}">` : "Photo"}</div>
          <div class="rc-a5-nursery-title">${esc(displayTerm(report.term))} · ${esc(period.title)} REPORT CARD</div>
        </header>
        <div class="rc-a5-nursery-info">
          <span><b>Reg No:</b> ${value(learner.reg_no)}</span><span><b>Class:</b> ${value(report.class?.name)}</span><span><b>Fees Bal:</b> ${value(feeBalance)}</span><span><b>SchoolPay Code:</b> ${value(learner.schoolpay_code)}</span>
          <span><b>Name:</b> ${value(learner.full_name)}</span><span><b>Days Attended:</b> ${value(report.days_attended ?? learner.days_attended ?? report.days_present)}</span><span><b>Absent:</b> ${value(report.days_absent ?? learner.days_absent ?? report.absence)}</span><span><b>Total:</b> ${value(report.total_days ?? learner.total_days ?? report.school_days)}</span>
        </div>
        <section class="rc-a5-nursery-panels">
          <div class="rc-nursery-learning"><h3>Achievement Scores in the 5 Learning Areas</h3>
            ${table(["AREA", "B.O.T", "MIDTERM", "AVERAGE", "GRADE"], areaRows, "rc-a5-nursery-table")}
            <div class="rc-nursery-totalbar"><span>TOTAL: ${number(500, 0)}</span><span>SCORED: ${number(total, 0)}</span><span>POSITION: ${value(summary.position)} / ${value(summary.class_size)}</span></div>
          </div>
          <div class="rc-nursery-activities"><h3>Performance in the Learning Activities</h3><div class="rc-a5-nursery-grid">${activityCards}</div></div>
        </section>
        <section class="rc-a5-nursery-remarks">${comments.map(([label, content]) => `<div><b>${esc(label)}</b><span>${value(content)}</span></div>`).join("")}</section>
        <div class="rc-a5-nursery-footer"><span>Fees balance: ${value(feeBalance)}</span><span>Next term fees: ${value(nextFees)}</span><span>Term ends: ${value(termEnd)}</span><span>Next term begins: ${value(nextTerm)}</span></div>
      </div>
    </article>`;
  }

  function renderPrimary(report, options = {}) {
    const template = templateInfo("PRIMARY", options);
    const showPosition = reportPositionEnabled(report, "PRIMARY", template.id);
    const isPle = pleEnabled(report);
    const period = assessmentPeriod(report, options);
    const entries = scoreRows(report);
    const rows = entries.map(({ subject, mark }) => {
      const cells = template.definition?.blankForm
        ? [value(subject.name), ...period.fields.map(() => "________"), ...(period.combined ? ["________"] : []), "___", ...(isPle ? ["___"] : []), ...(showPosition ? ["________"] : []), "________________", "___"]
        : [
          `<b>${value(subject.name)}</b>`,
          ...period.fields.map(({ key }) => periodCell(mark, key, period)),
          ...(period.combined ? [periodFinal(mark, period)] : []),
          value(gradeDisplay(mark, !isPle)),
          ...(isPle ? [number(mark.points, 0)] : []),
          ...(showPosition ? [mark.position ? `${value(mark.position)} of ${value(mark.class_size)}` : "—"] : []),
          `<em>${value(mark.tr || mark.teacher_remark || mark.descriptor)}</em>`,
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
      ...(isPle ? [number(summary.aggregate, 0)] : []),
      ...(showPosition ? [`${value(summary.position)} OUT OF ${value(summary.class_size)}`] : []),
      promotionStatus(report).replace(/^STATUS:\s*/, ""),
      firstInitials(report),
    ];
    const activities = primaryOtherRows(report);
    const headers = [
      "SUBJECTS",
      ...period.fields.map(({ label }) => label),
      ...(period.combined ? ["FINAL"] : []),
      "GRADE",
      ...(isPle ? ["POINTS"] : []),
      ...(showPosition ? ["POSITION"] : []),
      "TEACHER'S REMARKS",
      "INITIALS",
    ];
    return `<article ${previewAttrs(report, "PRIMARY", options)}>
      <div class="rc-preview-content">
      ${header(report, "Primary School Report", options)}
       ${learnerInfo(report, "PRIMARY", options)}
       ${incompleteWarning(report)}
       <section class="rc-subject-section">${table(headers, rows, "rc-primary-table rc-period-table", totals)}</section>
        ${periodSummary(report, options)}
       <section class="rc-activities">${table(["SUBJECT", "GR", "TEACHER'S REMARKS", "INITIALS"], activities, "", "", "OTHER SUBJECTS / CO-CURRICULAR")}</section>
      ${earlyYearsRemarks(report, "PRIMARY")}
      ${stampBlock(report, options)}
       ${authenticityQrBlock(report)}
      ${footer(report, "PRIMARY")}
      </div>
    </article>`;
  }

  function renderSecondary(report, level, options = {}) {
    const entries = scoreRows(report);
    const period = assessmentPeriod(report, options);
    const summary = report.summary || {};
    const template = templateInfo(level, options);
    const presetKey = report.grading_scale_preset_key
      ?? report.active_grading_scale?.preset_key
      ?? report.grading_scale?.preset_key;
    const oldUce = level === "O_LEVEL" && presetKey === "o_level_old_uce";
    const newUce = level === "O_LEVEL" && presetKey === "o_level_new_uce";
    const usesUce = oldUce || newUce;
    const prefixHeads = level === "A_LEVEL" ? ["CODE", "SUBJECT", "PAPER"] : ["SUBJECT"];
    const heads = usesUce
      ? oldUce
        ? ["SUBJECT", "FINAL SCORE", "GRADE", "POINTS", "TEACHER'S REMARK", "TR"]
        : ["SUBJECT", "CA 20%", "EXAM 80%", "FINAL", "GRADE", "ACHIEVEMENT LEVEL", "REMARKS", "TR"]
      : [
        ...prefixHeads,
        ...period.fields.map(({ label }) => label),
        ...(period.combined ? ["FINAL"] : []),
        "GRADE",
        level === "A_LEVEL" ? "COMMENT" : "GRADE DESCRIPTOR",
        "TR",
      ];
    const rows = entries.map(({ subject, mark }) => {
      const cells = usesUce
        ? oldUce
          ? [
            value(subject.name),
            number(mark.final_score ?? mark.pct100),
            value(mark.grade),
            number(mark.points),
            value(mark.tr || mark.teacher_remark || mark.descriptor),
            value(mark.teacher_initials),
          ]
          : [
            value(subject.name),
            number(mark.ca_score),
            number(mark.exam_score),
            number(mark.final_score ?? mark.pct100),
            value(mark.grade),
            value(mark.achievement_level || mark.descriptor),
            value(mark.tr || mark.teacher_remark),
            value(mark.teacher_initials),
          ]
        : [
          ...(level === "A_LEVEL" ? [value(subject.code), value(subject.name), value(mark.paper_number)] : [value(subject.name)]),
          ...period.fields.map(({ key }) => periodCell(mark, key, period)),
          ...(period.combined ? [periodFinal(mark, period)] : []),
          value(gradeDisplay(mark)),
          value(mark.tr || mark.teacher_remark || mark.descriptor),
          value(mark.teacher_initials),
        ];
      return `<tr>${cells.map((cell, index) => `<td${index === cells.length - 2 ? ' class="rc-long-descriptor"' : ""}>${cell}</td>`).join("")}</tr>`;
    });
    const projects = (report.projects || []).map((project) => `<tr><td>${value(project.project_name)}</td><td>${number(project.score)}</td><td>${project.percentage===null||project.percentage===undefined?"—":`${number(project.percentage)}%`}</td><td>${value(project.grade)}</td><td>${value(project.remarks)}</td><td>${value(project.teacher_initials)}</td></tr>`);
    const activities = coCurricular(report, level === "PRIMARY" || level === "NURSERY");
    const projectHeading = level === "A_LEVEL" ? "STUDENT'S PROJECTS WORK" : "Projects";
    const finalScores = period.combined
      ? entries.map(({ mark }) => periodTools().periodScore(mark, period.key)).filter((score) => score !== null)
      : [];
    const averageCells = usesUce ? "" : [
      ...(level === "A_LEVEL" ? ["", "AVERAGE SCORES", ""] : ["AVERAGE SCORES"]),
      ...periodAverages(entries, period),
      ...(period.combined
        ? [finalScores.length ? number(finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length) : "—"]
        : []),
      value(summary.overall_grade),
      value(summary.overall_achievement ?? summary.achievement),
      "",
    ];
    const footerRows = level === "O_LEVEL" && !usesUce ? [[
      { text: "NEXT TERM BEGINS", span: 2 },
      { text: formatReportDate(report.term_dates?.next_term_begins), span: Math.max(1, heads.length - 2) },
    ]] : [];
    const title = level === "A_LEVEL" ? "A-Level Report"
      : oldUce ? "Old UCE Report"
        : newUce ? "New UCE Report" : "O-Level Report";
    const result = report.uce_result || {};
    const uceSummary = oldUce
      ? `<div class="rc-summary rc-summary-wide rc-uce-summary"><span><b>Best-8 Aggregate:</b> ${value(result.aggregate ?? summary.aggregate)}</span><span><b>Division:</b> ${value(result.division_code ?? summary.aggregate_division)}</span></div>`
      : newUce
        ? `<div class="rc-summary rc-summary-wide rc-uce-summary"><span><b>Result:</b> ${value(result.result_indicator)}</span><span><b>Certificate:</b> ${result.qualified_for_certificate ? "Qualified" : "Did not qualify"}</span><span><b>Project Work:</b> ${result.project_work_completed ? "Completed" : "Not completed"}</span><span><b>Subjects graded:</b> ${value(result.completed_subject_count)}</span></div>`
        : "";
    return `<article ${previewAttrs(report, level, options)}>
      <div class="rc-preview-content">
      ${header(report, title, options)}
      ${learnerInfo(report, level, options)}
       ${usesUce ? "" : promotionBanner(report)}
        <section class="rc-subject-section">${table(heads, rows, `rc-dense rc-secondary-${level.toLowerCase()} ${usesUce ? "rc-uce-table" : "rc-period-table"}`, averageCells, usesUce ? (oldUce ? "ANNUAL UCE RESULTS — D1–F9 SYSTEM" : "ANNUAL UCE RESULTS — COMPETENCY SYSTEM") : `TERM PERFORMANCE RECORDS — ${period.title}`, { footerRows })}</section>
        ${usesUce ? uceSummary : periodSummary(report, options)}
       ${activities.length ? `<section class="rc-activities">${table(["Activity / Subject", "Progress", "Remark", "Signature"], activities, "", "", "Activities / Other Subjects")}</section>` : ""}
        ${level === "A_LEVEL" && projects.length ? `<section class="rc-projects">${table(["TERMLY PROJECT WORK", "AVERAGE SCORE (10)", "OUT OF 100", "GRADE", "REMARKS", "TEACHER"], projects, "", "", projectHeading)}</section>` : ""}
       ${remarksAndSignatures(report, ["Class Teacher", "Head Teacher"], 2)}
      ${stampBlock(report, options)}
       ${authenticityQrBlock(report)}
      ${footer(report, level)}
      </div>
    </article>`;
  }

  window.ReportCardPreview = {
    formatReportDate,
    renderStamp: stampBlock,
    render(report, options = {}) {
      const level = levelCode(report.class?.level);
      if ((options.layoutFormat || report.layout_format) === "A5_CONDENSED") {
        return level === "NURSERY" ? renderNurseryA5(report, options) : renderA5Condensed(report, options);
      }
      if (level === "PRIMARY") return renderPrimary(report, options);
      if (level === "O_LEVEL" || level === "A_LEVEL") return renderSecondary(report, level, options);
      return renderNursery(report, options);
    },
  };
})();
