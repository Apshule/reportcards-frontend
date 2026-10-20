(() => {
  "use strict";
  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const TOKEN_KEY = "appshule_reportcards_school_jwt";
  const LEGACY_TOKEN_KEY = "appshule_reportcards_parent_jwt";
  const root = document.getElementById("parent-root");
  const state = {
    token: localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || "",
    user: null,
    school: null,
    children: [],
    childId: "",
    detail: null,
    tab: "overview",
    term: "TERM_1",
    year: String(new Date().getFullYear()),
    period: "EOT",
    template: "1",
    card: null,
    busy: false,
    error: "",
    success: "",
    mustChange: false,
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (value) => `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
  const icon = (name) => `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  function imageSource(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^data:image\/(?:png|jpe?g|webp);base64,/iu.test(raw) || /^https?:\/\//iu.test(raw) || /^\/[^/]/u.test(raw)) return raw;
    return `data:image/jpeg;base64,${raw.replace(/\s/gu, "")}`;
  }
  function schoolLogoMarkup() {
    const source = imageSource(state.school?.logo_base64);
    return source
      ? `<img class="parent-brand-mark parent-brand-logo" src="${esc(source)}" alt="${esc(state.school?.name || "School")} logo">`
      : `<span class="parent-brand-mark">${icon("fa-graduation-cap")}</span>`;
  }
  function learnerAvatarMarkup(learner) {
    const source = imageSource(learner?.photo_base64);
    return source
      ? `<img class="parent-learner-avatar" src="${esc(source)}" alt="${esc(learner?.full_name || "Learner")}">`
      : `<span class="parent-learner-avatar parent-learner-avatar-placeholder" role="img" aria-label="Learner photo unavailable">${icon("fa-user")}</span>`;
  }
  function announcementDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.auth === false ? {} : { Authorization: `Bearer ${state.token}` }) };
    const response = await fetch(API + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function showError(message) { state.error = message; state.success = ""; render(); }

  async function loadChildren() {
    const result = await api("/api/parents/children");
    state.children = result.children || [];
    if (!state.children.some((item) => String(item.id) === String(state.childId))) {
      state.childId = String(state.children[0]?.id || "");
    }
    await loadDetail();
  }

  async function loadDetail() {
    state.detail = null;
    state.card = null;
    if (!state.childId) return;
    state.detail = await api(`/api/parents/children/${encodeURIComponent(state.childId)}`);
  }

  function loginView() {
    return `<main class="parent-card parent-login"><div class="parent-brand"><span class="parent-brand-mark">${icon("fa-graduation-cap")}</span><span>AppShule <small class="parent-school">Parent Portal</small></span></div>
      <h1>Welcome back</h1><p class="parent-muted">Sign in with your email and password. We’ll send you to the right school workspace.</p>
      ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}
      <form id="parent-login-form"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<div class="parent-password-wrap"><input id="parent-login-password" type="password" name="password" autocomplete="current-password" required><button type="button" data-parent-action="toggle-password" data-target="parent-login-password" aria-label="View password" aria-pressed="false">${icon("fa-eye")}</button></div></label><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Signing in…" : "Sign in"}</button></form>
      <p class="parent-muted">Parent accounts are provided by your school. Staff and school accounts will continue to their own workspace.</p></main>`;
  }

  function passwordView() {
    return `<main class="parent-card parent-login"><div class="parent-brand"><span class="parent-brand-mark">${icon("fa-key")}</span>Change your temporary password</div>
      <p class="parent-muted">Choose a new password before continuing to your children’s information.</p>
      ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}
      <form id="parent-password-form"><label>Temporary password<input name="old_password" type="password" required autocomplete="current-password"></label><label>New password<input name="new_password" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm new password<input name="confirm_password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-primary" type="submit">Change password</button></form></main>`;
  }

  function overview() {
    const d = state.detail || {};
    const fees = d.fees || [];
    const currentFee = fees[0] || {};
    const attendance = d.attendance_summary || {};
    const grade = d.latest_grade || {};
    return `<div class="parent-grid"><article class="parent-card parent-stat">Fee balance<small>${money(currentFee.balance)} · ${esc(currentFee.term || "No fee record")} ${esc(currentFee.year || "")}</small></article>
      <article class="parent-card parent-stat">Latest grade<small>${esc(grade.grade || "Not available")} · ${esc(grade.subject || "No subject record")}</small></article>
      <article class="parent-card parent-stat">Attendance<small>${attendance.percentage == null ? "Not recorded" : `${esc(attendance.percentage)}%`} · ${esc(attendance.attended || 0)} attended of ${esc(attendance.recorded || 0)}</small></article>
      <section class="parent-card parent-wide"><h2>Latest school announcements</h2>${(d.announcements || []).slice(0, 4).map((item) => `<article class="parent-announcement"><strong>${esc(item.title)}</strong><small class="parent-muted"> · <time datetime="${esc(item.created_at)}">${esc(announcementDate(item.created_at))}</time></small><p>${esc(item.message)}</p></article>`).join("") || `<p class="parent-empty">No announcements have been published.</p>`}</section></div>`;
  }

  function academics() {
    const data = state.card;
    return `<section class="parent-card parent-wide"><div class="parent-heading"><div><h2>Academic results</h2><p class="parent-muted">Select a term and download the official report card.</p></div><div class="parent-card-controls"><label>Term<select data-card-filter="term">${["TERM_1","TERM_2","TERM_3"].map((term) => `<option value="${term}" ${term === state.term ? "selected" : ""}>${term.replace("_", " ")}</option>`).join("")}</select></label><label>Year<input data-card-filter="year" type="number" min="1900" max="2100" value="${esc(state.year)}"></label><label>Assessment<select data-card-filter="period">${["EOT","BOT","MID","COMBINED_BME","COMBINED_BE","COMBINED_ME"].map((period) => `<option value="${period}" ${period === state.period ? "selected" : ""}>${period.replaceAll("_", " ")}</option>`).join("")}</select></label><button class="btn btn-outline" data-parent-action="load-card">${icon("fa-rotate")} Load results</button></div></div>
      ${data ? `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Score</th><th>Grade</th><th>Descriptor</th></tr></thead><tbody>${(data.subjects || []).map((subject) => `<tr><td>${esc(subject.name || subject.subject_name || subject.code)}</td><td>${esc(subject.mark?.period_score ?? subject.mark?.pct100 ?? "—")}</td><td>${esc(subject.mark?.grade || "—")}</td><td>${esc(subject.mark?.descriptor || "—")}</td></tr>`).join("")}</tbody></table></div><div class="parent-account-actions"><button class="btn btn-primary" data-parent-action="download-card">${icon("fa-file-pdf")} Download report card</button><span class="parent-muted">${esc(data.class?.name || "")} · ${esc(data.term)} ${esc(data.year)}</span></div>` : `<p class="parent-empty">Load results to see marks for this term.</p>`}
    </section>`;
  }

  function finance() {
    const d = state.detail || {};
    return `<div class="parent-grid"><section class="parent-card parent-wide"><h2>Fee statement</h2>${(d.fees || []).length ? `<div class="table-wrap"><table><thead><tr><th>Term</th><th>Total fees</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${d.fees.map((item) => `<tr><td>${esc(item.term)} ${esc(item.year)}</td><td>${money(item.total_fees)}</td><td>${money(item.amount_paid)}</td><td><strong>${money(item.balance)}</strong></td></tr>`).join("")}</tbody></table></div>` : `<p class="parent-empty">No fee statement is available yet.</p>`}</section>
      <section class="parent-card parent-wide"><h2>Payment history</h2>${(d.payments || []).length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Purpose</th><th>Method</th><th>Amount</th></tr></thead><tbody>${d.payments.map((item) => `<tr><td>${esc(item.received_at)}</td><td>${esc(item.purpose)}</td><td>${esc(item.payment_method)}</td><td>${money(item.amount)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="parent-empty">No payments have been recorded.</p>`}
      <button class="btn btn-outline" data-parent-action="simulate-payment">${icon("fa-mobile-screen-button")} Try Mobile Money (simulation)</button><p class="parent-payment-note">This is a demo only. It will not charge a phone or record a payment.</p></section></div>`;
  }

  function attendance() {
    const records = state.detail?.attendance || [];
    return `<section class="parent-card parent-wide"><h2>Attendance history</h2>${records.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Reason / note</th></tr></thead><tbody>${records.map((item) => `<tr><td>${esc(item.date)}</td><td>${esc(item.status)}</td><td>${esc(item.reason || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="parent-empty">No attendance history has been recorded.</p>`}</section>`;
  }

  function communication() {
    const d = state.detail || {};
    return `<div class="parent-grid"><section class="parent-card parent-wide"><h2>School announcements</h2>${(d.announcements || []).map((item) => `<article class="parent-announcement"><strong>${esc(item.title)}</strong><small class="parent-muted"> · <time datetime="${esc(item.created_at)}">${esc(announcementDate(item.created_at))}</time></small><p>${esc(item.message)}</p></article>`).join("") || `<p class="parent-empty">No announcements have been published.</p>`}</section>
      <section class="parent-card parent-wide"><h2>Send feedback to the school</h2><form id="parent-feedback-form"><label>Message<textarea name="message" maxlength="3000" required placeholder="Share a question or comment with the school"></textarea></label><button class="btn btn-primary" type="submit">Send feedback</button></form></section></div>`;
  }

  function dashboardView() {
    if (!state.children.length) return `<div class="parent-app"><header class="parent-topbar"><div class="parent-brand">${schoolLogoMarkup()}<span>AppShule Parent Portal<small class="parent-school">${esc(state.school?.name || "School")}</small></span></div><div class="parent-account-actions">${learnerAvatarMarkup(null)}<span class="parent-muted">${esc(state.user?.name || state.user?.email || "")}</span><button class="btn btn-outline" data-parent-action="logout">Sign out</button></div></header><section class="parent-card parent-empty">No learner is linked to this parent account yet. Please contact the school office.</section></div>`;
    const child = state.children.find((item) => String(item.id) === String(state.childId)) || {};
    const tabs = [["overview","Overview"],["academics","Academics"],["finance","Finance"],["attendance","Attendance"],["communication","Communication"]];
    const content = { overview, academics, finance, attendance, communication }[state.tab]();
    return `<div class="parent-app"><header class="parent-topbar"><div class="parent-brand">${schoolLogoMarkup()}<span>AppShule Parent Portal<small class="parent-school">${esc(state.school?.name || "School")}</small></span></div><div class="parent-account-actions">${learnerAvatarMarkup(child)}<span class="parent-muted">${esc(state.user?.name || state.user?.email || "")}</span><button class="btn btn-outline" data-parent-action="logout">Sign out</button></div></header>
      <main class="parent-main"><div class="parent-heading"><div><p class="parent-muted">Learner overview</p><h1>${esc(child.full_name || "My child")}</h1><p class="parent-muted">${esc(child.class_name || "")} · ${esc(child.reg_no || "")}</p></div><label class="parent-child-select">Child<select id="parent-child">${state.children.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === String(state.childId) ? "selected" : ""}>${esc(item.full_name)} · ${esc(item.class_name || "")}</option>`).join("")}</select></label></div>
      ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}${state.success ? `<div class="parent-success" role="status">${esc(state.success)}</div>` : ""}
      <nav class="parent-tabs" aria-label="Parent sections">${tabs.map(([key, label]) => `<button class="${state.tab === key ? "active" : ""}" data-parent-tab="${key}">${label}</button>`).join("")}</nav>${content}</main></div>`;
  }

  function render() {
    if (!state.token) { root.innerHTML = loginView(); return; }
    if (state.mustChange) { root.innerHTML = passwordView(); return; }
    root.innerHTML = dashboardView();
  }

  async function login(form) {
    state.busy = true; state.error = ""; render();
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = await api("/api/auth/login", { method: "POST", auth: false, body: values });
      state.token = result.token;
      localStorage.setItem(TOKEN_KEY, state.token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      if (result.role !== "parent") {
        location.assign("/");
        return;
      }
      state.user = result.user;
      state.mustChange = result.must_change_password === true;
      if (!state.mustChange) {
        const me = await api("/api/auth/me");
        state.user = me.user; state.school = me.school;
        if (me.role !== "parent") throw new Error("This sign-in is for parent accounts only.");
        await loadChildren();
      }
    } catch (error) { state.token = ""; localStorage.removeItem(TOKEN_KEY); state.error = error.message || "Could not sign in."; }
    state.busy = false; render();
  }

  async function changePassword(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.new_password !== values.confirm_password) { showError("The new passwords do not match."); return; }
    try {
      await api("/api/auth/change-password", { method: "POST", body: values });
      state.mustChange = false; state.error = "";
      const me = await api("/api/auth/me"); state.user = me.user; state.school = me.school;
      await loadChildren();
      state.success = "Password updated. Welcome to your parent portal.";
    } catch (error) { state.error = error.message || "Could not change password."; }
    render();
  }

  async function loadCard() {
    state.card = null;
    const query = new URLSearchParams({ term: state.term, year: state.year, period: state.period, template: state.template });
    state.card = await api(`/api/parents/children/${encodeURIComponent(state.childId)}/card-data?${query}`);
  }

  async function downloadCard() {
    try {
      if (!state.card) await loadCard();
      if (!window.ReportCardPdf || !window.PDFLib) throw new Error("Report card PDF library is unavailable. Refresh and try again.");
      const report = {
        ...state.card,
        school: { ...state.card.school, stamp_config: state.card.stamp_config || state.card.school?.stamp_config },
        class: state.card.class,
        term: state.card.term,
        year: state.card.year,
        period: state.card.period,
        template: state.card.template,
        stamp_config: state.card.stamp_config,
        level_theme: state.card.level_theme,
      };
      const bytes = await window.ReportCardPdf.render(report, state.card.class?.level, state.template, true);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${state.card.learner?.reg_no || state.card.learner?.full_name || "report-card"}-${state.card.term}-${state.card.year}.pdf`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) { showError(error.message || "Could not download report card."); }
  }

  root.addEventListener("submit", async (event) => {
    if (event.target.id === "parent-login-form") { event.preventDefault(); await login(event.target); }
    else if (event.target.id === "parent-password-form") { event.preventDefault(); await changePassword(event.target); }
    else if (event.target.id === "parent-feedback-form") {
      event.preventDefault();
      try {
        await api(`/api/parents/children/${encodeURIComponent(state.childId)}/feedback`, { method: "POST", body: Object.fromEntries(new FormData(event.target).entries()) });
        event.target.reset(); state.success = "Your feedback was sent to the school."; state.error = "";
      } catch (error) { state.error = error.message || "Could not send feedback."; state.success = ""; }
      render();
    }
  });
  root.addEventListener("change", async (event) => {
    if (event.target.id === "parent-child") {
      state.childId = event.target.value; state.error = ""; state.success = "";
      try { await loadDetail(); } catch (error) { state.error = error.message; }
      render();
    } else if (event.target.matches("[data-card-filter]")) {
      state[event.target.dataset.cardFilter] = event.target.value;
      state.card = null;
      render();
    }
  });
  root.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-parent-tab]");
    if (tab) { state.tab = tab.dataset.parentTab; state.error = ""; render(); return; }
    const button = event.target.closest("[data-parent-action]");
    if (!button) return;
    const action = button.dataset.parentAction;
    if (action === "logout") {
      state.token = ""; state.user = null; state.school = null; state.children = []; state.childId = "";
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(LEGACY_TOKEN_KEY); render(); return;
    }
    if (action === "toggle-password") {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute("aria-label", visible ? "Hide password" : "View password");
      button.innerHTML = icon(visible ? "fa-eye-slash" : "fa-eye");
      input.focus();
      return;
    }
    if (action === "load-card") {
      try { state.busy = true; render(); await loadCard(); state.error = ""; }
      catch (error) { state.error = error.message; }
      state.busy = false; render(); return;
    }
    if (action === "download-card") { await downloadCard(); return; }
    if (action === "simulate-payment") { state.success = "This mobile money option is a demo only. No payment was made or charged."; render(); }
  });

  async function restore() {
    if (!state.token) { render(); return; }
    try {
      const me = await api("/api/auth/me");
      if (me.role !== "parent") {
        localStorage.setItem(TOKEN_KEY, state.token);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        location.replace("/");
        return;
      }
      localStorage.setItem(TOKEN_KEY, state.token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      state.user = me.user; state.school = me.school; state.mustChange = me.must_change_password === true;
      if (!state.mustChange) await loadChildren();
    } catch (error) {
      state.token = ""; localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(LEGACY_TOKEN_KEY); state.error = error.message;
    }
    render();
  }
  restore();
})();
