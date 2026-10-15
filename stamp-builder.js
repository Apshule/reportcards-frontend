(() => {
  "use strict";

  const defaults = {
    shape: "circle",
    primary_color: "#1E5EB5",
    secondary_color: "#000000",
    line_1: "",
    line_2: "",
    line_3: "",
    line_4: "",
    line_5: "",
    position: "Bottom Right",
    transparency: 100,
    rotation_degrees: 0,
  };
  const shapes = [
    ["circle", "Circle"],
    ["oval", "Oval"],
    ["rectangle", "Rectangle"],
    ["rounded_rectangle", "Rounded Rectangle"],
  ];
  const positions = ["Bottom Right", "Bottom Left", "Bottom Center"];
  const lineFields = ["line_1", "line_2", "line_3", "line_4", "line_5"];
  const lineLabels = ["Line 1 · Top text", "Line 2", "Line 3 · Center", "Line 4 · Date line", "Line 5 · Bottom text"];
  const linePlaceholders = ["MINISTRY OF EDUCATION", "TRODAT PRIMARY SCHOOL", "Deputy Principal", "21 MAY 2033", "P.O. Box 123, Wakiso"];

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  const safeHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;
  const numericValue = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  function previewMarkup(config) {
    return `<svg class="rc-stamp-builder__preview-svg" data-stamp-preview-svg viewBox="0 0 320 210" role="img" aria-label="Live school stamp preview">
      <rect class="rc-stamp-builder__paper" x="1" y="1" width="318" height="208" rx="10"></rect>
      <path class="rc-stamp-builder__paper-rule" d="M20 29h280M20 181h280"></path>
      <g data-stamp-preview-mark transform="rotate(${config.rotation_degrees} 160 105)" opacity="${config.transparency / 100}">
        <circle data-stamp-preview-shape cx="160" cy="105" r="69" fill="none" stroke="${config.secondary_color}" stroke-width="4"></circle>
        <circle data-stamp-preview-inner cx="160" cy="105" r="60" fill="none" stroke="${config.primary_color}" stroke-width="1.5"></circle>
        <rect data-stamp-preview-rect x="78" y="53" width="164" height="104" rx="7" fill="none" stroke="${config.secondary_color}" stroke-width="4" display="none"></rect>
        <rect data-stamp-preview-rect-inner x="85" y="60" width="150" height="90" rx="4" fill="none" stroke="${config.primary_color}" stroke-width="1.5" display="none"></rect>
        <g data-stamp-preview-text fill="${config.primary_color}" text-anchor="middle" font-family="var(--font-display, sans-serif)">
          <text data-stamp-preview-line="0" x="160" y="74" font-size="10" font-weight="700" letter-spacing="1.2">SCHOOL STAMP</text>
          <text data-stamp-preview-line="1" x="160" y="94" font-size="13" font-weight="700"></text>
          <text data-stamp-preview-line="2" x="160" y="111" font-size="12"></text>
          <text data-stamp-preview-line="3" x="160" y="128" font-size="12"></text>
          <text data-stamp-preview-line="4" x="160" y="145" font-size="12"></text>
        </g>
      </g>
      <text class="rc-stamp-builder__preview-caption" x="160" y="199" text-anchor="middle">STAMP PREVIEW · ON REPORT CARD</text>
    </svg>`;
  }

  function render(config = {}, { saving = false, error = "" } = {}) {
    const values = { ...defaults, ...(config && typeof config === "object" ? config : {}) };
    values.shape = shapes.some(([shape]) => shape === values.shape) ? values.shape : defaults.shape;
    const positionKey = String(values.position || "").toLowerCase().replace(/[\s_-]+/g, "");
    values.position = positions.find((position) => position.toLowerCase().replace(/\s+/g, "") === positionKey) || defaults.position;
    values.primary_color = safeHex(values.primary_color, defaults.primary_color);
    values.secondary_color = safeHex(values.secondary_color, defaults.secondary_color);
    values.transparency = numericValue(values.transparency, defaults.transparency, 0, 100);
    values.rotation_degrees = numericValue(values.rotation_degrees, defaults.rotation_degrees, -15, 15);

    const shapeOptions = shapes.map(([shape, label]) => `<label class="rc-stamp-builder__shape-option"><input type="radio" name="shape" data-stamp-field="shape" value="${escapeHTML(shape)}" ${values.shape === shape ? "checked" : ""}><span>${escapeHTML(label)}</span></label>`).join("");
    const positionOptions = positions.map((position) => `<option value="${escapeHTML(position)}" ${values.position === position ? "selected" : ""}>${escapeHTML(position)}</option>`).join("");
    const linesMarkup = lineFields.map((field, index) => `<div class="rc-stamp-builder__field rc-stamp-builder__line-field">
      <label for="stamp-${field}">${lineLabels[index]}</label>
      <input id="stamp-${field}" name="${field}" type="text" maxlength="200" autocomplete="off" data-stamp-field="${field}" value="${escapeHTML(values[field])}" placeholder="${escapeHTML(linePlaceholders[index])}">
    </div>`).join("");

    return `<section class="rc-stamp-builder" data-stamp-builder>
      <form id="report-card-stamp-builder" class="rc-stamp-builder__form" novalidate>
        <header class="rc-stamp-builder__header">
          <div><p class="rc-stamp-builder__eyebrow">Report card identity</p><h2>Digital school stamp</h2>
          <p class="rc-stamp-builder__lede">Set the official mark that appears on learner reports.</p></div>
          <span class="rc-stamp-builder__seal" aria-hidden="true">RC</span>
        </header>
        ${error ? `<div class="rc-stamp-builder__error" role="alert">${escapeHTML(error)}</div>` : ""}
        <div class="rc-stamp-builder__layout">
          <div class="rc-stamp-builder__controls">
            <fieldset class="rc-stamp-builder__fieldset rc-stamp-builder__shape-fieldset">
              <legend>Shape</legend>
              <div class="rc-stamp-builder__shape-options">${shapeOptions}</div>
            </fieldset>
            <div class="rc-stamp-builder__color-row">
              <div class="rc-stamp-builder__field">
              <label for="stamp-primary-color">Primary color · stamp text</label>
                <div class="rc-stamp-builder__color-control"><input id="stamp-primary-color" name="primary_color" type="color" data-stamp-field="primary_color" value="${values.primary_color}" aria-label="Primary stamp text color"><output data-stamp-color-value="primary_color">${values.primary_color}</output></div>
              </div>
              <div class="rc-stamp-builder__field">
              <label for="stamp-secondary-color">Secondary color · border</label>
                <div class="rc-stamp-builder__color-control"><input id="stamp-secondary-color" name="secondary_color" type="color" data-stamp-field="secondary_color" value="${values.secondary_color}" aria-label="Secondary stamp border color"><output data-stamp-color-value="secondary_color">${values.secondary_color}</output></div>
              </div>
            </div>
            <div class="rc-stamp-builder__field">
              <label for="stamp-position">Stamp position</label>
              <select id="stamp-position" name="position" data-stamp-field="position">${positionOptions}</select>
            </div>
            <fieldset class="rc-stamp-builder__fieldset">
              <legend>Stamp wording</legend>
              <div class="rc-stamp-builder__lines">${linesMarkup}</div>
              <p class="rc-stamp-builder__hint">Keep wording short so it stays legible when printed.</p>
            </fieldset>
            <div class="rc-stamp-builder__tuning">
              <div class="rc-stamp-builder__field">
                <label for="stamp-transparency">Transparency <output data-stamp-value="transparency">${values.transparency}%</output></label>
                <input id="stamp-transparency" name="transparency" type="range" min="0" max="100" step="1" data-stamp-field="transparency" value="${values.transparency}">
              </div>
              <div class="rc-stamp-builder__field">
                <label for="stamp-rotation">Rotation <output data-stamp-value="rotation_degrees">${values.rotation_degrees}°</output></label>
                <input id="stamp-rotation" name="rotation_degrees" type="range" min="-15" max="15" step="1" data-stamp-field="rotation_degrees" value="${values.rotation_degrees}">
              </div>
            </div>
          </div>
          <aside class="rc-stamp-builder__preview-panel" aria-label="Stamp preview panel">
            <div class="rc-stamp-builder__preview-head"><div><strong>Live preview</strong><span>Print-friendly stamp impression</span></div><span class="rc-stamp-builder__live-dot">LIVE</span></div>
            ${previewMarkup(values)}
            <div class="rc-stamp-builder__position-note"><span aria-hidden="true">↳</span><span>Printed at <strong data-stamp-preview-position>${escapeHTML(values.position)}</strong> of the report.</span></div>
          </aside>
        </div>
        <div class="rc-stamp-builder__actions">
          <p>Changes apply to future report previews and PDFs.</p>
          <button class="btn btn-primary" type="submit" ${saving ? 'disabled aria-busy="true"' : ""}>${saving ? "Saving stamp…" : "Save stamp settings"}</button>
        </div>
      </form>
    </section>`;
  }

  function bind(root, config = {}) {
    if (!root || typeof root.querySelector !== "function") return;
    const defaultsSnapshot = { ...defaults, ...(config && typeof config === "object" ? config : {}) };
    const fields = Array.from(root.querySelectorAll("[data-stamp-field]"));
    const shapeOutline = root.querySelector("[data-stamp-preview-shape]");
    const shapeInner = root.querySelector("[data-stamp-preview-inner]");
    const rectOutline = root.querySelector("[data-stamp-preview-rect]");
    const rectInner = root.querySelector("[data-stamp-preview-rect-inner]");
    const mark = root.querySelector("[data-stamp-preview-mark]");
    const textGroup = root.querySelector("[data-stamp-preview-text]");
    const previewLines = Array.from(root.querySelectorAll("[data-stamp-preview-line]"));
    const transparencyValue = root.querySelector('[data-stamp-value="transparency"]');
    const rotationValue = root.querySelector('[data-stamp-value="rotation_degrees"]');
    const positionValue = root.querySelector("[data-stamp-preview-position]");

    const current = () => {
      const result = { ...defaultsSnapshot };
      fields.forEach((field) => {
        const key = field.dataset.stampField;
        if (field.type === "radio") {
          if (field.checked) result[key] = field.value;
          return;
        }
        result[key] = field.type === "number" || field.type === "range" ? Number(field.value) : field.value;
      });
      result.primary_color = safeHex(result.primary_color, defaults.primary_color);
      result.secondary_color = safeHex(result.secondary_color, defaults.secondary_color);
      result.transparency = numericValue(result.transparency, defaults.transparency, 0, 100);
      result.rotation_degrees = numericValue(result.rotation_degrees, defaults.rotation_degrees, -15, 15);
      return result;
    };

    const update = () => {
      const value = current();
      if (shapeOutline) {
        const isCircle = value.shape === "circle";
        shapeOutline.setAttribute("display", isCircle ? "inline" : "none");
        shapeInner?.setAttribute("display", isCircle ? "inline" : "none");
        rectOutline?.setAttribute("display", isCircle ? "none" : "inline");
        rectInner?.setAttribute("display", isCircle ? "none" : "inline");
        shapeOutline.setAttribute("stroke", value.secondary_color);
        shapeInner?.setAttribute("stroke", value.primary_color);
        rectOutline?.setAttribute("stroke", value.secondary_color);
        rectInner?.setAttribute("stroke", value.primary_color);
        if (!isCircle) {
          const width = value.shape === "oval" ? 154 : 164;
          const height = value.shape === "oval" ? 96 : 104;
          const radius = value.shape === "oval" ? String(height / 2) : value.shape === "rounded_rectangle" ? "12" : "7";
          rectOutline?.setAttribute("x", String(160 - width / 2)); rectOutline?.setAttribute("y", String(105 - height / 2));
          rectOutline?.setAttribute("width", String(width)); rectOutline?.setAttribute("height", String(height)); rectOutline?.setAttribute("rx", radius);
          rectInner?.setAttribute("x", String(160 - width / 2 + 7)); rectInner?.setAttribute("y", String(105 - height / 2 + 7));
          rectInner?.setAttribute("width", String(width - 14)); rectInner?.setAttribute("height", String(height - 14));
          rectInner?.setAttribute("rx", value.shape === "oval" ? String((height - 14) / 2) : value.shape === "rounded_rectangle" ? "7" : "4");
        }
      }
      if (mark) {
        mark.setAttribute("opacity", String(value.transparency / 100));
        mark.setAttribute("transform", `rotate(${value.rotation_degrees} 160 105)`);
      }
      if (textGroup) textGroup.setAttribute("fill", value.primary_color);
      lineFields.forEach((field, index) => {
        const text = root.querySelector(`[data-stamp-field="${field}"]`)?.value?.trim() || "";
        const target = previewLines.find((line) => line.dataset.stampPreviewLine === String(index));
        if (target) target.textContent = text;
      });
      if (transparencyValue) transparencyValue.textContent = `${value.transparency}%`;
      if (rotationValue) rotationValue.textContent = `${value.rotation_degrees}°`;
      if (positionValue) positionValue.textContent = value.position;
      ["primary_color", "secondary_color"].forEach((field) => {
        const output = root.querySelector(`[data-stamp-color-value="${field}"]`);
        if (output) output.textContent = value[field];
      });
    };

    fields.forEach((field) => field.addEventListener("input", update));
    fields.forEach((field) => field.addEventListener("change", update));
    update();
  }

  window.ReportCardStampBuilder = { render, bind };
})();
