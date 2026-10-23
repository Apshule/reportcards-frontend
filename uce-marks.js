(() => {
  "use strict";

  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const TOKEN_KEY = "appshule_reportcards_school_jwt";
  const state = { key: "", data: null, loading: false, saving: false, error: "", success: "", revision: 0 };
  let scheduled = false;

  const escapeHtml = (input) => String(input ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const numberOrNull = (input) => {
    if (input === "" || input === null || input === undefined) return null;
    const value = Number(input);
    return Number.isFinite(value) ? value : null;
  };

  function selectedFilters() {
    const classSelect = document.querySelector(
      'select[data-filter="class_id"], select[data-rm-filter="class_id"]',
    );
    const subjectSelect = document.querySelector(
      'select[data-filter="subject_id"], select[data-rm-filter="subject_id"]',
    );
    const yearInput = document.querySelector(
      'input[data-filter="academic_year"], input[data-rm-filter="academic_year"]',
    );
    const className = classSelect?.selectedOptions?.[0]?.textContent?.trim() ?? "";
    const normalizedClass = className.toUpperCase().replace(/[^A-Z0-9]/gu, "");
    const isOLevel = /^(?:OLEVEL|S(?:ENIOR)?[1-4]|FORM(?:ONE|TWO|THREE|FOUR|[1-4]))/u.test(normalizedClass);
    if (!classSelect?.value || !subjectSelect?.value || !yearInput?.value || !isOLevel) return null;
    return {
      classId: classSelect.value,
      subjectId: subjectSelect.value,
      year: yearInput.value,
      className,
      subjectName: subjectSelect.selectedOptions?.[0]?.textContent?.trim() ?? "",
      key: `${classSelect.value}:${subjectSelect.value}:${yearInput.value}`,
    };
  }

  async function request(path, init = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  function showPanel(target, filters) {
    const existing = target.querySelector(":scope > .uce-entry-panel");
    if (existing) existing.remove();
    if (!state.data || state.key !== filters.key) return;
    const rows = state.data.learners || [];
    const results = new Map((state.data.learners || []).map((learner) => [learner.learner_id, learner]));
    const body = rows.map((learner) => {
      const result = results.get(learner.learner_id) || {};
      const ca = learner.ca_score ?? "";
      const exam = learner.exam_score ?? "";
      const score = numberOrNull(learner.final_score);
      const grade = learner.subject_grade || "—";
      return `<tr data-uce-learner="${escapeHtml(learner.learner_id)}">
        <td><strong>${escapeHtml(learner.full_name)}</strong><small>${escapeHtml(learner.reg_no || "")}</small></td>
        <td><input type="number" min="0" max="100" step="0.01" data-uce-ca value="${escapeHtml(ca)}" aria-label="CA score for ${escapeHtml(learner.full_name)}"></td>
        <td><input type="number" min="0" max="100" step="0.01" data-uce-exam value="${escapeHtml(exam)}" aria-label="Exam score for ${escapeHtml(learner.full_name)}"></td>
        <td data-uce-final>${score === null ? "—" : score.toFixed(2)}</td>
        <td data-uce-grade>${escapeHtml(grade)}</td>
        <td><label class="uce-project-toggle"><input type="checkbox" data-uce-project ${result.project_work_completed ? "checked" : ""}><span>Completed</span></label></td>
        <td>${escapeHtml(result.result_indicator || result.division_code || "—")}</td>
      </tr>`;
    }).join("");
    const presetLabel = state.data.preset_key === "o_level_old_uce" ? "Old UCE · D1–F9" : "New UCE · A–E";
    const panel = document.createElement("section");
    panel.className = "uce-entry-panel";
    panel.dataset.revision = String(state.revision);
    panel.setAttribute("aria-label", "Annual UCE marks register");
    panel.innerHTML = `
      <div class="uce-entry-heading">
        <div><span class="eyebrow">Separate annual assessment</span><h3>UCE marks · ${escapeHtml(presetLabel)}</h3>
          <p>${escapeHtml(filters.className)} · ${escapeHtml(filters.subjectName)} · ${escapeHtml(filters.year)}</p></div>
        <button type="button" class="btn btn-primary" data-uce-save ${state.saving || !rows.length ? "disabled" : ""}>${state.saving ? "Saving…" : "Save annual marks"}</button>
      </div>
      ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)}</div>` : ""}
      ${state.success ? `<div class="alert success" role="status">${escapeHtml(state.success)}</div>` : ""}
      ${rows.length ? `<div class="uce-entry-scroll"><table class="uce-entry-table">
        <thead><tr><th>Learner</th><th>CA (20%)</th><th>Exam (80%)</th><th>Final</th><th>Grade</th><th>Project Work</th><th>Annual result</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      <p class="field-hint">Annual UCE marks are stored separately from term marks. Final score = CA × 20% + Exam × 80%. Completing Project Work is required for Result 1.</p>`
        : `<div class="empty-state"><p>No active learners are enrolled in this class.</p></div>`}`;
    target.append(panel);
    panel.addEventListener("input", (event) => {
      const row = event.target.closest("tr[data-uce-learner]");
      if (!row) return;
      const ca = numberOrNull(row.querySelector("[data-uce-ca]")?.value);
      const exam = numberOrNull(row.querySelector("[data-uce-exam]")?.value);
      const finalScore = ca === null || exam === null ? null : Math.round((ca * 0.2 + exam * 0.8 + Number.EPSILON) * 100) / 100;
      row.querySelector("[data-uce-final]").textContent = finalScore === null ? "—" : finalScore.toFixed(2);
      const bands = state.data.grading_scale || [];
      const grade = finalScore === null ? "—" : bands.find((band) =>
        finalScore >= Number(band.min_score) && finalScore <= Number(band.max_score),
      )?.grade_code || "—";
      row.querySelector("[data-uce-grade]").textContent = grade;
    });
  }

  function ensureControl() {
    const filters = selectedFilters();
    const periodBar = document.querySelector(".period-bar");
    if (!periodBar) return;
    const section = periodBar.parentElement;
    const existingLaunch = section.querySelector(":scope > .uce-entry-launch");
    const existingPanel = section.querySelector(":scope > .uce-entry-panel");
    if (!filters) {
      existingLaunch?.remove();
      existingPanel?.remove();
      return;
    }
    if (existingLaunch?.dataset.uceKey === filters.key) {
      const loadButton = existingLaunch.querySelector("[data-uce-load]");
      if (loadButton) {
        loadButton.disabled = state.loading;
        loadButton.textContent = state.loading
          ? "Loading…"
          : state.data && state.key === filters.key ? "Refresh UCE register" : "Open UCE register";
      }
      if ((state.data && state.key === filters.key) || state.error) {
        if (existingPanel?.dataset.revision !== String(state.revision)) showPanel(section, filters);
        const saveButton = section.querySelector("[data-uce-save]");
        if (saveButton) {
          saveButton.disabled = state.saving || !(state.data?.learners || []).length;
          saveButton.textContent = state.saving ? "Saving…" : "Save annual marks";
        }
      }
      return;
    }
    existingLaunch?.remove();
    existingPanel?.remove();

    const launch = document.createElement("div");
    launch.className = "uce-entry-launch";
    launch.dataset.uceKey = filters.key;
    launch.innerHTML = `<div><strong>Annual UCE entry</strong><span>Keep UCE results separate from term marks.</span></div>
      <button type="button" class="btn btn-outline" data-uce-load ${state.loading ? "disabled" : ""}>${state.loading ? "Loading…" : state.data?.key === filters.key ? "Refresh UCE register" : "Open UCE register"}</button>`;
    periodBar.insertAdjacentElement("afterend", launch);
    launch.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-uce-load]")) return;
      state.key = filters.key;
      state.data = null;
      state.loading = true;
      state.error = "";
      state.success = "";
      schedule();
      try {
        const query = new URLSearchParams({
          class_id: filters.classId,
          subject_id: filters.subjectId,
          year: filters.year,
        });
        state.data = { ...(await request(`/api/uce/marks?${query}`)), key: filters.key };
        state.key = filters.key;
      } catch (error) {
        state.error = error.message;
        state.data = { key: filters.key, learners: [] };
      } finally {
        state.loading = false;
        state.revision += 1;
        schedule();
      }
    });
    if ((state.data && state.key === filters.key) || state.error) showPanel(section, filters);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureControl();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("change", schedule, true);
  document.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-uce-save]") || state.saving) return;
    const currentFilters = selectedFilters();
    if (!currentFilters || currentFilters.key !== state.key) {
      state.error = "The selected class, subject, or year changed. Reopen the UCE register before saving.";
      state.revision += 1;
      schedule();
      return;
    }
    const panel = document.querySelector(".uce-entry-panel");
    const rows = [...(panel?.querySelectorAll("tr[data-uce-learner]") || [])].map((row) => ({
      learner_id: row.dataset.uceLearner,
      ca_score: numberOrNull(row.querySelector("[data-uce-ca]")?.value),
      exam_score: numberOrNull(row.querySelector("[data-uce-exam]")?.value),
      project_work_completed: row.querySelector("[data-uce-project]")?.checked === true,
    }));
    state.saving = true;
    state.error = "";
    state.success = "";
    schedule();
    try {
      await request("/api/uce/marks/bulk", {
        method: "POST",
        body: JSON.stringify({
          class_id: currentFilters.classId,
          subject_id: currentFilters.subjectId,
          year: Number(currentFilters.year),
          rows,
        }),
      });
      const query = new URLSearchParams({
        class_id: currentFilters.classId,
        subject_id: currentFilters.subjectId,
        year: currentFilters.year,
      });
      state.data = { ...(await request(`/api/uce/marks?${query}`)), key: currentFilters.key };
      state.key = currentFilters.key;
      state.success = "Annual UCE marks saved.";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.saving = false;
      state.revision += 1;
      schedule();
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-uce-load]")) return;
    if (event.target.closest("[data-filter], [data-rm-filter]")) schedule();
  }, true);
  schedule();
})();
