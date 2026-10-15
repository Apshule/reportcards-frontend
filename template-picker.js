(() => {
  "use strict";

  const periods = [
    ["BOT", "Beginning of Term (B.O.T)"],
    ["MID", "Mid-Term"],
    ["EOT", "End of Term (E.O.T)"],
    ["COMBINED_BME", "Combined (B.O.T + Mid + E.O.T)"],
    ["COMBINED_BE", "Combined (B.O.T + E.O.T)"],
    ["COMBINED_ME", "Combined (Mid + E.O.T)"],
  ];

  const paletteLabels = {
    NURSERY: ["Default", "Orange/Blue", "Purple/Pink", "Green/Eco", "Maroon/Gold"],
    PRIMARY: ["Default", "Gold/Black", "Silver/Iridescent", "Blue/Gold Blank", "Maroon/Gold"],
    O_LEVEL: ["Default", "Blue/Silver", "Green/Eco", "Maroon", "Blue/Gold"],
    A_LEVEL: ["Default", "Blue/Silver", "Maroon", "Green", "Gold/Black"],
  };

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  const levelKey = (level) => {
    const normalized = String(level ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^(ALEVEL|S[56])/.test(normalized)) return "A_LEVEL";
    if (/^(OLEVEL|S[1-4])/.test(normalized)) return "O_LEVEL";
    if (/^(PRIMARY|P[1-7])/.test(normalized)) return "PRIMARY";
    return "NURSERY";
  };

  function render({ level, template, period, includeStamp } = {}) {
    const key = levelKey(level);
    const palettes = paletteLabels[key];
    const selectedTemplate = String(template ?? "1");
    const selectedPeriod = String(period ?? "EOT");
    const checked = includeStamp === true || includeStamp === "true" || includeStamp === 1;
    const levelLabel = escapeHTML(String(level ?? key.replace("_", " ")));

    return `<div class="rc-template-picker" data-report-template-picker>
      <div class="rc-template-picker__field">
        <label for="report-template-choice">Report template <span class="rc-template-picker__level">${levelLabel}</span></label>
        <select id="report-template-choice" data-report-filter="template" aria-label="Report template">
          ${palettes.map((palette, index) => {
            const value = String(index + 1);
            return `<option value="${value}" ${selectedTemplate === value ? "selected" : ""}>Template ${value}${index === 0 ? " (Default)" : ""} — ${escapeHTML(palette)}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="rc-template-picker__field">
        <label for="report-assessment-period">Assessment period</label>
        <select id="report-assessment-period" data-report-filter="period" aria-label="Assessment period">
          ${periods.map(([value, label]) => `<option value="${value}" ${selectedPeriod === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <label class="rc-template-picker__stamp" for="report-include-stamp">
        <input id="report-include-stamp" type="checkbox" data-report-filter="includeStamp" ${checked ? "checked" : ""}>
        <span class="rc-template-picker__check" aria-hidden="true"></span>
        <span><strong>Include school stamp</strong><small>Show the configured stamp on this report</small></span>
      </label>
    </div>`;
  }

  window.ReportCardTemplatePicker = { render };
})();
