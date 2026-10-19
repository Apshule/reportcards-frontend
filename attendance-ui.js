(() => {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const today = () => new Date().toISOString().slice(0, 10);
  const state = { classes: [], classId: "", date: today(), learners: [], weekStart: "", weekly: [], loading: false, error: "" };

  async function load(api) {
    state.loading = true;
    state.error = "";
    try {
      const result = await api("/api/attendance/classes");
      state.classes = result.classes || [];
      if (!state.classes.some((item) => String(item.id) === String(state.classId))) {
        state.classId = state.classes[0]?.id || "";
      }
      if (state.classId) await loadDay(api);
      else state.learners = [];
    } catch (error) { state.error = error.message || "Could not load attendance."; }
    state.loading = false;
  }

  async function loadDay(api) {
    if (!state.classId || !state.date) return;
    state.loading = true;
    try {
      const result = await api(`/api/attendance/class/${encodeURIComponent(state.classId)}?date=${encodeURIComponent(state.date)}`);
      state.learners = result.learners || [];
      state.error = "";
    } catch (error) { state.error = error.message || "Could not load the class roster."; }
    state.loading = false;
  }

  async function loadWeek(api) {
    if (!state.classId || !state.weekStart) return;
    state.loading = true;
    try {
      const result = await api(`/api/attendance/class/${encodeURIComponent(state.classId)}?week_start=${encodeURIComponent(state.weekStart)}`);
      state.weekly = result.records || [];
      state.error = "";
    } catch (error) { state.error = error.message || "Could not load this week's attendance."; }
    state.loading = false;
  }

  function render() {
    const classOptions = state.classes.map((item) =>
      `<option value="${esc(item.id)}" ${String(item.id) === String(state.classId) ? "selected" : ""}>${esc(item.name)}${item.stream ? ` · ${esc(item.stream)}` : ""}</option>`).join("");
    const records = state.weekly;
    const counts = {
      present: records.filter((item) => item.status === "present").length,
      absent: records.filter((item) => item.status === "absent").length,
      late: records.filter((item) => item.status === "late").length,
    };
    return `<div class="attendance-page">
      <div class="page-heading"><div><p class="eyebrow">Classroom</p><h1>Attendance</h1><p>Record daily attendance and review a class week.</p></div></div>
      ${state.error ? `<div class="alert error" role="alert">${esc(state.error)}</div>` : ""}
      <section class="card section-card attendance-controls">
        <label>Class<select id="attendance-class" required><option value="">Select class</option>${classOptions}</select></label>
        <label>Attendance date<input id="attendance-date" type="date" value="${esc(state.date)}" required></label>
        <button class="btn btn-outline" data-attendance-action="load-day"><i class="fa-solid fa-rotate"></i> Load roster</button>
      </section>
      ${state.loading ? `<section class="card section-card"><div class="loading-row">Loading attendance</div></section>` :
        !state.classId ? `<section class="card section-card"><div class="empty-state"><h3>No assigned classes</h3><p>Ask a school administrator to assign you to a class.</p></div></section>` :
        `<form id="attendance-form" class="card section-card"><div class="section-title"><div><h2>Daily register</h2><p>${state.learners.length} learners · ${esc(state.date)}</p></div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save attendance</button></div>
        <div class="table-wrap"><table><thead><tr><th>Reg No</th><th>Learner</th><th>Status</th><th>Reason (optional)</th></tr></thead><tbody>${state.learners.map((learner) =>
          `<tr data-attendance-learner="${esc(learner.learner_id)}"><td>${esc(learner.reg_no || "—")}</td><td>${esc(learner.full_name)}</td><td><select data-attendance-status aria-label="Attendance status for ${esc(learner.full_name)}"><option value="present" ${learner.status === "present" ? "selected" : ""}>Present</option><option value="absent" ${learner.status === "absent" ? "selected" : ""}>Absent</option><option value="late" ${learner.status === "late" ? "selected" : ""}>Late</option></select></td><td><input data-attendance-reason value="${esc(learner.reason || "")}" maxlength="500" placeholder="Optional reason" aria-label="Reason for ${esc(learner.full_name)}"></td></tr>`).join("")}</tbody></table></div></form>`}
      <section class="card section-card attendance-week">
        <div class="section-title"><div><h2>Weekly attendance</h2><p>Review daily marks and reasons for any seven-day period.</p></div></div>
        <div class="attendance-week-tools"><label>Week starting<input id="attendance-week" type="date" value="${esc(state.weekStart || state.date)}"></label><button class="btn btn-outline" data-attendance-action="load-week"><i class="fa-solid fa-calendar-week"></i> View week</button></div>
        ${records.length ? `<div class="attendance-summary"><span>Present ${counts.present}</span><span>Absent ${counts.absent}</span><span>Late ${counts.late}</span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Reg No</th><th>Learner</th><th>Status</th><th>Reason</th></tr></thead><tbody>${records.map((item) =>
          `<tr><td>${esc(item.date)}</td><td>${esc(item.reg_no || "—")}</td><td>${esc(item.full_name)}</td><td><span class="attendance-status ${esc(item.status)}">${esc(item.status)}</span></td><td>${esc(item.reason || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="attendance-empty">Choose a week and select “View week” to see saved records.</p>`}
      </section>
    </div>`;
  }

  function bind(root, api, rerender, notify) {
    root.addEventListener("change", async (event) => {
      const target = event.target;
      if (target.id === "attendance-class") state.classId = target.value;
      else if (target.id === "attendance-date") state.date = target.value;
      else if (target.id === "attendance-week") state.weekStart = target.value;
      else return;
      if (target.id === "attendance-class" || target.id === "attendance-date") {
        await loadDay(api);
        rerender();
      }
    });
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-attendance-action]");
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.attendanceAction;
      if (action === "load-day") {
        state.date = document.getElementById("attendance-date")?.value || state.date;
        state.classId = document.getElementById("attendance-class")?.value || state.classId;
        await loadDay(api);
      } else if (action === "load-week") {
        state.weekStart = document.getElementById("attendance-week")?.value || state.date;
        await loadWeek(api);
      }
      rerender();
    });
    root.addEventListener("submit", async (event) => {
      if (event.target.id !== "attendance-form") return;
      event.preventDefault();
      const rows = [...event.target.querySelectorAll("[data-attendance-learner]")].map((tr) => ({
        learner_id: tr.dataset.attendanceLearner,
        status: tr.querySelector("[data-attendance-status]")?.value,
        reason: tr.querySelector("[data-attendance-reason]")?.value || null,
      }));
      try {
        const result = await api(`/api/attendance/class/${encodeURIComponent(state.classId)}`, {
          method: "POST", body: { date: state.date, rows },
        });
        notify(`Saved attendance for ${result.saved} learners.`);
        await loadDay(api);
        if (state.weekStart) await loadWeek(api);
      } catch (error) { notify(error.message || "Could not save attendance.", "error"); }
      rerender();
    });
  }

  window.ReportCardsAttendance = { load, render, bind };
})();
