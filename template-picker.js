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

  const periodAliases = {
    BOT: "BOT",
    BEGINNINGOFTERM: "BOT",
    BEGINNINGOFTERMBOT: "BOT",
    MID: "MID",
    MIDTERM: "MID",
    EOT: "EOT",
    ENDOFTERM: "EOT",
    ENDOFTERMEOT: "EOT",
    COMBINEDBME: "COMBINED_BME",
    COMBINEDBOTMIDEOT: "COMBINED_BME",
    COMBINEDBE: "COMBINED_BE",
    COMBINEDBOTEOT: "COMBINED_BE",
    COMBINEDME: "COMBINED_ME",
    COMBINEDMIDEOT: "COMBINED_ME",
  };

  const periodDefinitions = {
    BOT: { title: "BEGINNING OF TERM", fields: [{ key: "bot", label: "B.O.T" }], combined: false },
    MID: { title: "MID-TERM", fields: [{ key: "mid_term", label: "MID-TERM" }], combined: false },
    EOT: { title: "END OF TERM", fields: [{ key: "eot_period", label: "E.O.T" }], combined: false },
    COMBINED_BME: {
      title: "COMBINED (B.O.T + MID + E.O.T)",
      fields: [
        { key: "bot", label: "B.O.T" },
        { key: "mid_term", label: "MID-TERM" },
        { key: "eot_period", label: "E.O.T" },
      ],
      combined: true,
    },
    COMBINED_BE: {
      title: "COMBINED (B.O.T + E.O.T)",
      fields: [{ key: "bot", label: "B.O.T" }, { key: "eot_period", label: "E.O.T" }],
      combined: true,
    },
    COMBINED_ME: {
      title: "COMBINED (MID + E.O.T)",
      fields: [{ key: "mid_term", label: "MID-TERM" }, { key: "eot_period", label: "E.O.T" }],
      combined: true,
    },
  };

  function normalizePeriod(value) {
    const normalized = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return periodAliases[normalized] || "EOT";
  }

  function periodDefinition(value) {
    const key = normalizePeriod(value);
    return { key, ...periodDefinitions[key] };
  }

  function periodValue(mark, field, period) {
    const raw = mark?.period_marks?.[field] ?? mark?.[field];
    if (raw !== null && raw !== undefined && raw !== "") {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (field === "eot_period" && !periodDefinition(period).combined) {
      const selectedPeriod = mark?.selected_period
        ? normalizePeriod(mark.selected_period)
        : periodDefinition(period).key;
      if (selectedPeriod === "EOT") {
        const fallback = mark?.period_score ?? mark?.pct100;
        if (fallback !== null && fallback !== undefined && fallback !== "") {
          const parsed = Number(fallback);
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
    }
    return null;
  }

  function periodScore(mark, period) {
    const definition = periodDefinition(period);
    const values = definition.fields.map(({ key }) => periodValue(mark, key, definition.key));
    if (values.every((score) => score !== null)) {
      return Math.round((values.reduce((sum, score) => sum + score, 0) / values.length + Number.EPSILON) * 100) / 100;
    }
    if (mark?.selected_period && normalizePeriod(mark.selected_period) === definition.key) {
      const selected = mark.period_score;
      if (selected !== null && selected !== undefined && selected !== "") {
        const parsed = Number(selected);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    if (definition.key === "EOT" && !definition.combined) {
      const legacy = mark?.pct100;
      if (legacy !== null && legacy !== undefined && legacy !== "") {
        const parsed = Number(legacy);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    return null;
  }

  function normalizeTemplate(value) {
    const normalized = String(value ?? "").trim();
    const match = normalized.match(/^(?:template[\s_-]*)?([1-5])(?:\b|$)/i);
    return match ? `template_${match[1]}` : normalized;
  }

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

  window.ReportCardTemplatePicker = {
    render,
    normalizePeriod,
    normalizeTemplate,
    periodDefinition,
    periodValue,
    periodScore,
  };
})();
