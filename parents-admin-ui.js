(() => {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function renderAnnouncements(state) {
    const items = state.parentAdmin.announcements || [];
    return `<div class="parent-admin-page"><div class="page-heading"><div><p class="eyebrow">Family communication</p><h1>Announcements</h1><p>Publish school updates for linked parent accounts.</p></div></div>
      ${state.parentAdmin.error ? `<div class="alert error">${esc(state.parentAdmin.error)}</div>` : ""}
      <section class="card section-card"><h2>Publish an announcement</h2><form id="announcement-form" class="form-grid"><div class="field"><label for="announcement-title">Title *</label><input id="announcement-title" name="title" maxlength="200" required></div><div class="field"><label for="announcement-message">Message *</label><textarea id="announcement-message" name="message" maxlength="5000" rows="5" required></textarea></div><button class="btn btn-primary" type="submit">Publish announcement</button></form></section>
      <section class="card section-card"><div class="section-title"><div><h2>Recent announcements</h2><p>${items.length} published</p></div></div>${items.length ? items.map((item) => `<article class="parent-announcement"><div><h3>${esc(item.title)}</h3><time>${esc(item.created_at)}</time></div><p>${esc(item.message)}</p></article>`).join("") : `<p class="parent-admin-empty">No announcements yet.</p>`}</section>
    </div>`;
  }

  function renderFeedback(state) {
    const items = state.parentAdmin.feedback || [];
    return `<div class="parent-admin-page"><div class="page-heading"><div><p class="eyebrow">Family communication</p><h1>Parent feedback</h1><p>Review messages sent through the parent portal.</p></div></div>
      ${state.parentAdmin.error ? `<div class="alert error">${esc(state.parentAdmin.error)}</div>` : ""}
      <section class="card section-card"><div class="section-title"><div><h2>Feedback inbox</h2><p>${items.length} messages</p></div></div>${items.length ? `<div class="table-wrap"><table><thead><tr><th>Received</th><th>Parent</th><th>Learner</th><th>Message</th><th>Status</th><th>Update</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.created_at)}</td><td>${esc(item.parent_email)}</td><td>${esc(item.learner_name)}<br><small>${esc(item.class_name || "")} · ${esc(item.reg_no || "")}</small></td><td>${esc(item.message)}</td><td><span class="parent-feedback-status ${esc(item.status)}">${esc(item.status)}</span></td><td><select data-feedback-status="${esc(item.id)}" aria-label="Status for feedback from ${esc(item.parent_email)}"><option value="new" ${item.status === "new" ? "selected" : ""}>New</option><option value="read" ${item.status === "read" ? "selected" : ""}>Read</option><option value="resolved" ${item.status === "resolved" ? "selected" : ""}>Resolved</option></select></td></tr>`).join("")}</tbody></table></div>` : `<p class="parent-admin-empty">No parent feedback yet.</p>`}</section>
    </div>`;
  }

  async function publish(form, api, toast, reload) {
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await api("/api/parents/announcements", { method: "POST", body: values });
      form.reset();
      toast("Announcement published.");
      await reload();
    } catch (error) { toast(error.message || "Could not publish announcement.", "error"); }
  }

  async function setFeedbackStatus(id, status, api, toast, reload) {
    try {
      await api(`/api/parents/feedback/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } });
      toast("Feedback status updated.");
      await reload();
    } catch (error) { toast(error.message || "Could not update feedback status.", "error"); }
  }

  window.ReportCardsParentAdmin = { renderAnnouncements, renderFeedback, publish, setFeedbackStatus };
})();
