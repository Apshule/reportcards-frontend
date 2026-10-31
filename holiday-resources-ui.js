(() => {
  "use strict";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const money = (value) => `UGX ${new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))}`;
  const icon = (name) => `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  const isPaidResource = (value) => value === true || value === "true" || value === "t" || value === 1;

  function resourcesList(resources, loading, error, canManage) {
    if (loading) return `<div class="card section-card"><div class="loading-row">Loading holiday resources…</div></div>`;
    if (error) return `<div class="alert error" role="alert">${esc(error)}</div>`;
    if (!resources.length) {
      return `<div class="empty-state"><div class="empty-icon">${icon("fa-sun")}</div><h3>No holiday resources yet</h3><p>Upload a worksheet, reading pack, or holiday note for your school.</p></div>`;
    }
    return `<div class="holiday-resource-grid">${resources.map((resource) => {
      const paid = isPaidResource(resource.is_paid);
      return `
      <article class="card holiday-resource-card">
        <div class="holiday-resource-icon">${icon(resource.mime_type === "application/pdf" ? "fa-file-pdf" : "fa-image")}</div>
        <div class="holiday-resource-copy">
          <div class="holiday-resource-heading"><h3>${esc(resource.title)}</h3><span class="holiday-pill ${paid ? "paid" : "free"}">${paid ? "Paid" : "Free"}</span></div>
          <p>${esc(resource.description || "No description provided.")}</p>
          <div class="holiday-resource-meta">
            <span>${icon("fa-people-group")} ${esc(resource.class_name || "Whole school")}</span>
            <span>${icon("fa-paperclip")} ${esc(resource.file_name)} · ${esc((Number(resource.file_size_bytes || 0) / 1024 / 1024).toFixed(2))} MB</span>
            ${paid ? `<span><strong>${money(resource.price)}</strong> · Pay to ${esc(resource.payment_contact)}</span>` : ""}
          </div>
        </div>
        ${canManage ? `<div class="holiday-resource-actions"><button class="btn btn-outline btn-small" type="button" data-action="holiday-edit" data-id="${esc(resource.id)}">${icon("fa-pen")} Edit</button><button class="btn btn-danger btn-small" type="button" data-action="holiday-delete" data-id="${esc(resource.id)}">${icon("fa-trash")} Delete</button></div>` : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function pendingList(items, loading, error, canConfirm) {
    if (loading) return `<div class="card section-card"><div class="loading-row">Loading pending payments…</div></div>`;
    if (error) return `<div class="alert error" role="alert">${esc(error)}</div>`;
    if (!items.length) {
      return `<div class="empty-state"><div class="empty-icon">${icon("fa-circle-check")}</div><h3>No pending payments</h3><p>Requests marked as paid by parents will appear here.</p></div>`;
    }
    return `<div class="card section-card holiday-pending-card"><div class="table-wrap"><table class="holiday-pending-table"><thead><tr><th>Parent</th><th>Learner(s)</th><th>Resource</th><th>Amount</th><th>Requested</th><th>Action</th></tr></thead><tbody>${items.map((item) => `
      <tr>
        <td><strong>${esc(item.parent_name || "Parent")}</strong><small>${esc(item.parent_email || "")}</small></td>
        <td>${esc(item.learner_names || "—")}<small>${esc(item.class_names || "")}</small></td>
        <td><strong>${esc(item.resource_title)}</strong><small>Pay to ${esc(item.payment_contact)}</small></td>
        <td>${money(item.price)}</td>
        <td>${esc(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.requested_at)))}</td>
        <td>${canConfirm ? `<button class="btn btn-primary btn-small" type="button" data-action="holiday-confirm-payment" data-id="${esc(item.access_id)}">${icon("fa-check")} Confirm</button>` : "Review only"}</td>
      </tr>`).join("")}</tbody></table></div></div>`;
  }

  function resourceForm(state) {
    const editing = state.data.holidayEditing;
    const paid = isPaidResource(editing?.is_paid);
    const classes = state.data.classes || [];
    return `<section class="card section-card holiday-form-card">
      <div class="section-title"><div><h2>${editing ? "Edit holiday resource" : "Upload a holiday resource"}</h2><p>Share notes or holiday packages with parents. Files are private to your school.</p></div></div>
      <div class="alert error holiday-form-error" data-holiday-form-error role="alert" hidden></div>
      <form id="holiday-resource-form" data-id="${esc(editing?.id || "")}">
        <div class="form-two">
          <div class="field"><label for="holiday-title">Title *</label><input id="holiday-title" name="title" required maxlength="150" value="${esc(editing?.title || "")}" placeholder="e.g. Term break mathematics practice"></div>
          <div class="field"><label for="holiday-class">Available to</label><select id="holiday-class" name="class_id"><option value="">Whole school</option>${classes.map((item) => `<option value="${esc(item.id)}" ${String(editing?.class_id || "") === String(item.id) ? "selected" : ""}>${esc(item.name)}${item.level ? ` · ${esc(item.level)}` : ""}</option>`).join("")}</select><span class="field-hint">Choose a class or leave as Whole school.</span></div>
          <div class="field wide"><label for="holiday-description">Description</label><textarea id="holiday-description" name="description" maxlength="2000" placeholder="Explain what the learner should complete.">${esc(editing?.description || "")}</textarea></div>
          <div class="field wide"><label class="holiday-payment-toggle"><input type="checkbox" name="is_paid" data-holiday-paid ${paid ? "checked" : ""}><span><strong>Require payment</strong><small>Parents will see a preview and submit a payment confirmation request.</small></span></label></div>
          <div class="field wide holiday-paid-fields" data-holiday-paid-fields ${paid ? "" : "hidden"}>
            <div class="form-two">
              <div class="field"><label for="holiday-price">Price (UGX) *</label><input id="holiday-price" name="price" type="number" min="1" max="1000000000" step="1" value="${esc(paid ? editing?.price : "")}" ${paid ? "required" : "disabled"}></div>
              <div class="field"><label for="holiday-payment-contact">Payment contact number *</label><input id="holiday-payment-contact" name="payment_contact" maxlength="50" value="${esc(paid ? editing?.payment_contact : "")}" placeholder="+256 700 000 000" ${paid ? "required" : "disabled"}></div>
            </div>
            <p class="field-hint">Parents pay the contact directly. Staff must confirm the payment before the full file unlocks.</p>
          </div>
          <div class="field wide"><label for="holiday-file">File (PDF or image) ${editing ? "" : "*"}</label><input id="holiday-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-holiday-file ${editing ? "" : "required"}><span class="field-hint" id="holiday-file-status">${editing ? `Current file: ${esc(editing.file_name)}. Choose a file only to replace it.` : "Maximum file size: 5 MB. A first-page preview is prepared automatically."}</span><div class="holiday-local-preview" id="holiday-local-preview" hidden><img alt="Selected file preview" id="holiday-local-preview-image"><span id="holiday-local-preview-name"></span></div></div>
        </div>
        <div class="holiday-form-actions">${editing ? `<button class="btn btn-outline" type="button" data-action="holiday-cancel-edit">Cancel edit</button>` : ""}<button class="btn btn-primary" type="submit">${icon(editing ? "fa-floppy-disk" : "fa-cloud-arrow-up")} ${editing ? "Save changes" : "Upload resource"}</button></div>
      </form>
    </section>`;
  }

  function render(state) {
    const isTeacher = state.role === "teacher";
    const activeTab = isTeacher ? "pending" : (state.data.holidayTab || "resources");
    const resources = state.data.holidayResources || [];
    const pending = state.data.holidayPending || [];
    const canManage = state.role === "school_admin";
    const tabs = isTeacher ? "" : `<div class="settings-tabs holiday-tabs" role="tablist" aria-label="Holiday resources sections"><button class="settings-tab ${activeTab === "resources" ? "active" : ""}" type="button" data-action="holiday-tab" data-tab="resources">Resources</button><button class="settings-tab ${activeTab === "pending" ? "active" : ""}" type="button" data-action="holiday-tab" data-tab="pending">Pending Payments <span class="holiday-tab-count">${pending.length}</span></button></div>`;
    const title = isTeacher ? "Pending holiday payments" : "Holiday Resources";
    const subtitle = isTeacher
      ? "Review payment requests for learners in your assigned classes."
      : "Upload school holiday notes and manage parent payment confirmations.";
    const refresh = `<button class="btn btn-outline" type="button" data-action="holiday-refresh">${icon("fa-rotate")} Refresh</button>`;
    return `<div class="page-heading holiday-page-heading"><div><p class="eyebrow">AppShule · School office</p><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${refresh}</div></div>
      ${tabs}
      ${activeTab === "resources" && canManage ? `${resourceForm(state)}${resourcesList(resources, state.data.holidayResourcesLoading, state.data.holidayResourcesError, canManage)}` : ""}
      ${activeTab === "pending" ? pendingList(pending, state.data.holidayPendingLoading, state.data.holidayPendingError, true) : ""}`;
  }

  window.ReportCardsHolidayResources = { render };
})();
