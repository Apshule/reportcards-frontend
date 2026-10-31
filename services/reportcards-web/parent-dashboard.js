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
    holidayResources: [],
    holidayResourcesLoading: false,
    holidayBusyId: "",
    holidayPreview: null,
    error: "",
    success: "",
    mustChange: false,
  };
  let brandingLookupId = 0;
  let holidayResourcesRequestId = 0;
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
  function parentLoginBrandMarkup(school = null) {
    const source = imageSource(school?.logo_base64);
    const name = school?.name || "AppShule";
    const mark = source
      ? `<img class="parent-brand-mark parent-brand-logo" src="${esc(source)}" alt="" data-school-brand-logo>`
      : `<span class="parent-brand-mark">${icon("fa-graduation-cap")}</span>`;
    return `${mark}<span class="parent-brand-copy"><strong>${esc(name)}</strong><small class="parent-school">Parent Portal</small></span>`;
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
  async function binaryApi(path) {
    const response = await fetch(API + path, {
      method: "GET",
      headers: { Authorization: `Bearer ${state.token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return response.blob();
  }

  async function updateParentLoginBranding(identifier) {
    const requestId = ++brandingLookupId;
    const brand = root.querySelector("#parent-login-brand");
    if (!brand) return;
    if (!identifier) {
      brand.innerHTML = parentLoginBrandMarkup();
      return;
    }
    try {
      const result = await api(`/api/schools/branding?identifier=${encodeURIComponent(identifier)}`, { auth: false });
      if (requestId !== brandingLookupId || !brand.isConnected) return;
      brand.innerHTML = parentLoginBrandMarkup(result.school || null);
    } catch {
      // Branding lookup is optional and must never block sign-in.
    }
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
  function clearHolidayPreview() {
    if (state.holidayPreview?.url) URL.revokeObjectURL(state.holidayPreview.url);
    state.holidayPreview = null;
  }
  async function loadHolidayResources() {
    if (!state.childId) {
      state.holidayResources = [];
      return;
    }
    const childId = state.childId;
    const requestId = ++holidayResourcesRequestId;
    state.holidayResourcesLoading = true;
    state.holidayResources = [];
    state.error = "";
    render();
    try {
      const result = await api(`/api/holiday-resources/children/${encodeURIComponent(childId)}/resources`, { cache: "no-store" });
      if (requestId === holidayResourcesRequestId && String(childId) === String(state.childId)) {
        state.holidayResources = result.resources || [];
      }
    } catch (error) {
      if (requestId === holidayResourcesRequestId) state.error = error.message || "Could not load holiday resources.";
    } finally {
      if (requestId === holidayResourcesRequestId) {
        state.holidayResourcesLoading = false;
        render();
      }
    }
  }
  async function previewHolidayResource(resourceId) {
    const childId = state.childId;
    state.holidayBusyId = resourceId;
    state.error = "";
    render();
    try {
      const blob = await binaryApi(`/api/holiday-resources/children/${encodeURIComponent(childId)}/resources/${encodeURIComponent(resourceId)}/preview`);
      if (String(state.childId) !== String(childId)) return;
      clearHolidayPreview();
      state.holidayPreview = { resourceId, url: URL.createObjectURL(blob) };
    } catch (error) {
      state.error = error.message || "Could not load the resource preview.";
    } finally {
      state.holidayBusyId = "";
      render();
    }
  }
  async function downloadHolidayResource(resourceId) {
    const childId = state.childId;
    const resource = state.holidayResources.find((item) => String(item.id) === String(resourceId));
    if (!resource) return;
    state.holidayBusyId = resourceId;
    state.error = "";
    render();
    try {
      const blob = await binaryApi(`/api/holiday-resources/children/${encodeURIComponent(childId)}/resources/${encodeURIComponent(resourceId)}/download`);
      if (String(state.childId) !== String(childId)) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resource.file_name || "holiday-resource";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      state.error = error.message || "Could not download the resource.";
    } finally {
      state.holidayBusyId = "";
      render();
    }
  }
  async function markHolidayResourcePaid(resourceId) {
    const childId = state.childId;
    state.holidayBusyId = resourceId;
    state.error = "";
    state.success = "";
    render();
    try {
      const result = await api(`/api/holiday-resources/children/${encodeURIComponent(childId)}/resources/${encodeURIComponent(resourceId)}/mark-paid`, { method: "POST", body: {} });
      if (String(state.childId) !== String(childId)) return;
      state.holidayResources = state.holidayResources.map((resource) => String(resource.id) === String(resourceId)
        ? { ...resource, access_status: result.access?.status || "pending" }
        : resource);
      state.success = result.access?.status === "paid"
        ? "Payment is already confirmed. You can download this resource."
        : "Payment confirmation requested. The school will review it before the full file is available.";
    } catch (error) {
      state.error = error.message || "Could not submit the payment confirmation request.";
    } finally {
      state.holidayBusyId = "";
      render();
    }
  }

  function loginView() {
    return `<div class="parent-auth-shell"><main class="parent-card parent-login"><div id="parent-login-brand" class="parent-brand">${parentLoginBrandMarkup()}</div>
      <h1>Welcome back</h1><p class="parent-muted">Sign in with your email or phone number and password to reach your school workspace.</p>
      ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}
      <form id="parent-login-form"><label>Email or Phone Number<input type="text" name="email" autocomplete="username" required maxlength="254"></label><label>Password<div class="parent-password-wrap"><input id="parent-login-password" type="password" name="password" autocomplete="current-password" required><button type="button" data-parent-action="toggle-password" data-target="parent-login-password" aria-label="View password" aria-pressed="false">${icon("fa-eye")}</button></div></label><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Signing in…" : "Sign in"}</button></form>
      <p class="parent-muted">Parent accounts are provided by your school. Staff and school accounts will continue to their own workspace.</p></main><footer class="powered-by-footer powered-by-parent"><img src="appshule-logo.jpeg" alt="AppShule" loading="lazy"><span>Powered by AP SHULE TECHNOLOGIES</span></footer></div>`;
  }

  function passwordView() {
    return `<div class="parent-auth-shell"><main class="parent-card parent-login"><div class="parent-brand"><span class="parent-brand-mark">${icon("fa-key")}</span>Change your temporary password</div>
      <p class="parent-muted">Choose a new password before continuing to your children’s information.</p>
      ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}
      <form id="parent-password-form"><label>Temporary password<input name="old_password" type="password" required autocomplete="current-password"></label><label>New password<input name="new_password" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm new password<input name="confirm_password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-primary" type="submit">Change password</button></form></main><footer class="powered-by-footer powered-by-parent"><img src="appshule-logo.jpeg" alt="AppShule" loading="lazy"><span>Powered by AP SHULE TECHNOLOGIES</span></footer></div>`;
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
  function holidayResources() {
    if (state.holidayResourcesLoading) {
      return `<section class="parent-card parent-wide"><h2>Holiday resources</h2><p class="parent-muted">Loading resources for ${esc(state.children.find((item) => String(item.id) === String(state.childId))?.full_name || "this learner")}…</p></section>`;
    }
    const items = state.holidayResources || [];
    const content = items.length ? `<div class="parent-holiday-grid">${items.map((resource) => {
      const isPaid = resource.is_paid === true || resource.is_paid === "true" || resource.is_paid === "t";
      const access = String(resource.access_status || "");
      const canDownload = !isPaid || access === "paid";
      const busy = String(state.holidayBusyId) === String(resource.id);
      return `<article class="parent-card parent-holiday-card">
        <div class="parent-holiday-icon">${icon(resource.mime_type === "application/pdf" ? "fa-file-pdf" : "fa-image")}</div>
        <div class="parent-holiday-copy"><div class="parent-holiday-title"><h3>${esc(resource.title)}</h3><span class="parent-holiday-pill ${isPaid ? "paid" : "free"}">${isPaid ? "Paid" : "Free"}</span></div>
          <p>${esc(resource.description || "No description provided.")}</p>
          <small class="parent-muted">${esc(resource.class_name || "Whole school")} · ${esc(resource.file_name)}</small>
          ${isPaid ? `<div class="parent-holiday-payment"><strong>${money(resource.price)}</strong><span>Payment contact: <b>${esc(resource.payment_contact || "Contact the school")}</b></span>${access === "pending" ? `<span class="parent-holiday-pending">${icon("fa-clock")} Payment awaiting school confirmation</span>` : access === "paid" ? `<span class="parent-holiday-approved">${icon("fa-circle-check")} Payment confirmed</span>` : `<span>Pay directly, then select “I have paid”.</span>`}</div>` : ""}
          <div class="parent-holiday-actions">
            ${isPaid ? `<button class="btn btn-outline" type="button" data-parent-action="holiday-preview" data-id="${esc(resource.id)}" ${busy ? "disabled" : ""}>${icon("fa-eye")} Preview</button>` : ""}
            ${canDownload ? `<button class="btn btn-primary" type="button" data-parent-action="holiday-download" data-id="${esc(resource.id)}" ${busy ? "disabled" : ""}>${icon("fa-download")} ${busy ? "Preparing…" : "Download"}</button>` : access === "pending" ? "" : `<button class="btn btn-primary" type="button" data-parent-action="holiday-mark-paid" data-id="${esc(resource.id)}" ${busy ? "disabled" : ""}>${icon("fa-check")} I have paid</button>`}
          </div>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="parent-empty">There are no holiday resources for this learner’s class yet.</div>`;
    return `<section class="parent-card parent-wide"><div class="parent-heading"><div><h2>Holiday resources</h2><p class="parent-muted">Resources are shown for the selected child’s class and whole-school notices.</p></div><button class="btn btn-outline" type="button" data-parent-action="holiday-refresh">${icon("fa-rotate")} Refresh</button></div>${content}</section>`;
  }
  function holidayPreviewModal() {
    if (!state.holidayPreview) return "";
    const resource = state.holidayResources.find((item) => String(item.id) === String(state.holidayPreview.resourceId));
    return `<div class="parent-holiday-backdrop" role="presentation"><section class="parent-holiday-modal" role="dialog" aria-modal="true" aria-label="Holiday resource preview"><div class="parent-heading"><div><h2>${esc(resource?.title || "Resource preview")}</h2><p class="parent-muted">Preview only — the complete paid file remains locked until the school confirms payment.</p></div><button class="btn btn-outline" type="button" data-parent-action="holiday-close-preview" aria-label="Close preview">${icon("fa-xmark")} Close</button></div><img src="${esc(state.holidayPreview.url)}" alt="First-page preview of ${esc(resource?.title || "holiday resource")}"></section></div>`;
  }

  function dashboardView() {
    if (!state.children.length) return `<div class="parent-app"><header class="parent-topbar"><div class="parent-brand">${schoolLogoMarkup()}<span class="parent-brand-copy"><strong>${esc(state.school?.name || "School")}</strong><small class="parent-school">Parent Portal</small></span></div><div class="parent-account-actions">${learnerAvatarMarkup(null)}<span class="parent-muted">${esc(state.user?.name || state.user?.email || "")}</span><button class="btn btn-outline" data-parent-action="logout">Sign out</button></div></header><section class="parent-card parent-empty">No learner is linked to this parent account yet. Please contact the school office.</section></div>`;
    const child = state.children.find((item) => String(item.id) === String(state.childId)) || {};
    const tabs = [["overview","Overview"],["academics","Academics"],["finance","Finance"],["attendance","Attendance"],["communication","Communication"],["holiday-resources","Holiday Resources"]];
    const content = { overview, academics, finance, attendance, communication, "holiday-resources": holidayResources }[state.tab]();
    return `<div class="parent-app"><header class="parent-topbar"><div class="parent-brand">${schoolLogoMarkup()}<span class="parent-brand-copy"><strong>${esc(state.school?.name || "School")}</strong><small class="parent-school">Parent Portal</small></span></div><div class="parent-account-actions">${learnerAvatarMarkup(child)}<span class="parent-muted">${esc(state.user?.name || state.user?.email || "")}</span><button class="btn btn-outline" data-parent-action="logout">Sign out</button></div></header>
      <main class="parent-main"><div class="parent-heading"><div><p class="parent-muted">Learner overview</p><h1>${esc(child.full_name || "My child")}</h1><p class="parent-muted">${esc(child.class_name || "")} · ${esc(child.reg_no || "")}</p></div><label class="parent-child-select">Child<select id="parent-child">${state.children.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === String(state.childId) ? "selected" : ""}>${esc(item.full_name)} · ${esc(item.class_name || "")}</option>`).join("")}</select></label></div>
       ${state.error ? `<div class="parent-alert" role="alert">${esc(state.error)}</div>` : ""}${state.success ? `<div class="parent-success" role="status">${esc(state.success)}</div>` : ""}
       <nav class="parent-tabs" aria-label="Parent sections">${tabs.map(([key, label]) => `<button class="${state.tab === key ? "active" : ""}" data-parent-tab="${key}">${label}</button>`).join("")}</nav>${content}</main>${holidayPreviewModal()}</div>`;
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
      if (!window.ReportCardsAuthenticityQr) throw new Error("Report verification support is unavailable. Refresh and try again.");
      const templateValue = String(state.card.template || state.template);
      const templateId = /^template_/iu.test(templateValue) ? templateValue : `template_${templateValue}`;
      const issued = await api("/api/verify/issue", {
        method: "POST",
        body: {
          learner_id: state.card.learner?.id,
          term: state.card.term,
          year: Number(state.card.year),
          period: state.card.period || state.period,
          template: templateId,
        },
      });
      const record = issued.cards?.[0];
      if (!record?.id) throw new Error("Could not create a report authenticity record.");
      const verificationUrl = window.ReportCardsAuthenticityQr.verificationUrl(record.id);
      const qrDataUrl = await window.ReportCardsAuthenticityQr.toPngDataUrl(verificationUrl);
      const report = {
        ...state.card,
        authenticity_qr_data_url: qrDataUrl,
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

  root.addEventListener("focusout", (event) => {
    const input = event.target;
    if (input.matches?.('#parent-login-form input[name="email"]')) {
      void updateParentLoginBranding(input.value.trim());
    }
  });
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
      clearHolidayPreview();
      state.childId = event.target.value; state.error = ""; state.success = "";
      state.holidayResources = [];
      try {
        await loadDetail();
        if (state.tab === "holiday-resources") {
          await loadHolidayResources();
          return;
        }
      } catch (error) { state.error = error.message; }
      render();
    } else if (event.target.matches("[data-card-filter]")) {
      state[event.target.dataset.cardFilter] = event.target.value;
      state.card = null;
      render();
    }
  });
  root.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-parent-tab]");
    if (tab) {
      state.tab = tab.dataset.parentTab; state.error = ""; state.success = "";
      render();
      if (state.tab === "holiday-resources") await loadHolidayResources();
      return;
    }
    const button = event.target.closest("[data-parent-action]");
    if (!button) return;
    const action = button.dataset.parentAction;
    if (action === "logout") {
      clearHolidayPreview();
      state.token = ""; state.user = null; state.school = null; state.children = []; state.childId = "";
      state.holidayResources = [];
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
    if (action === "holiday-refresh") { await loadHolidayResources(); return; }
    if (action === "holiday-preview") { await previewHolidayResource(button.dataset.id); return; }
    if (action === "holiday-download") { await downloadHolidayResource(button.dataset.id); return; }
    if (action === "holiday-mark-paid") { await markHolidayResourcePaid(button.dataset.id); return; }
    if (action === "holiday-close-preview") { clearHolidayPreview(); render(); return; }
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
