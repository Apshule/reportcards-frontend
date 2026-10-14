(() => {
  "use strict";

  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const TERMS = ["TERM_1", "TERM_2", "TERM_3"];
  const CATEGORIES = ["salaries", "utilities", "supplies", "rent", "transport", "repairs", "other"];
  const METHODS = ["cash", "momo", "bank", "schoolpay", "cheque"];
  const PURPOSES = ["fees", "uniform", "lunch", "transport", "other"];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const num = (value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const titleCase = (value) => String(value || "").replaceAll("_", " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
  const role = (state) => state.role || "school_admin";
  const admin = (state) => role(state) === "school_admin";
  const approver = (state) => ["school_admin", "head_teacher", "director"].includes(role(state));
  const writer = (state) => ["school_admin", "bursar", "head_teacher"].includes(role(state));
  const manager = (state) => admin(state);
  const settingsManager = (state) => admin(state);
  const canSync = (state) => ["school_admin", "bursar"].includes(role(state));

  function money(state, value) {
    const currency = state.finance?.data?.settings?.settings?.currency || "UGX";
    try {
      return new Intl.NumberFormat("en-UG", {
        style: "currency", currency, maximumFractionDigits: 0,
      }).format(num(value));
    } catch {
      return `${currency} ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(num(value))}`;
    }
  }

  function period(state) {
    return `<div class="fin-period">
      <label>Term<select data-fin-filter="term">${TERMS.map((term) =>
        `<option value="${term}" ${state.finance.term === term ? "selected" : ""}>${titleCase(term)}</option>`).join("")}</select></label>
      <label>Year<input type="number" min="1900" max="2100" data-fin-filter="year" value="${esc(state.finance.year)}"></label>
      <button class="btn btn-quiet" data-fin-action="refresh">${icon("fa-rotate")} Refresh</button>
    </div>`;
  }

  function icon(name) {
    return `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  }

  function button(label, action, ico = "fa-plus", kind = "btn-primary", extra = "") {
    return `<button class="btn ${kind}" data-fin-action="${action}" ${extra}>${icon(ico)}${label}</button>`;
  }

  function stat(label, value, ico, foot = "") {
    return `<article class="card stat-card"><div class="stat-head"><span>${label}</span><span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }

  function selectOptions(values, selected = "", blank = null) {
    return `${blank === null ? "" : `<option value="">${esc(blank)}</option>`}${values.map((value) =>
      `<option value="${esc(value.value ?? value)}" ${String(value.value ?? value) === String(selected) ? "selected" : ""}>${esc(value.label ?? titleCase(value))}</option>`).join("")}`;
  }

  function lookupClasses(state) {
    return state.finance?.data?.lookups?.classes || [];
  }

  function lookupLearners(state) {
    return state.finance?.data?.lookups?.learners || [];
  }

  function learnerOptions(state, selected = "") {
    return `<option value="">Select learner</option>${lookupLearners(state).map((learner) =>
      `<option value="${esc(learner.id)}" ${String(learner.id) === String(selected) ? "selected" : ""}>${esc(learner.full_name)} · ${esc(learner.reg_no)}</option>`).join("")}`;
  }

  function classOptions(state, selected = "") {
    return `<option value="">All classes</option>${lookupClasses(state).map((item) =>
      `<option value="${esc(item.id)}" ${String(item.id) === String(selected) ? "selected" : ""}>${esc(item.name)}</option>`).join("")}`;
  }

  function empty(title, body) {
    return `<div class="fin-empty"><div>${icon("fa-inbox")}</div><strong>${title}</strong><span>${body}</span></div>`;
  }

  function table(headers, rows, emptyLabel = "No records for this period.") {
    if (!rows?.length) return empty("Nothing to show yet", emptyLabel);
    return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function bars(title, rows, labelKey, valueKey, state) {
    if (!rows?.length) return `<section class="card section-card"><div class="section-title"><h2>${title}</h2></div>${empty("No chart data yet", "Records will appear here for the selected period.")}</section>`;
    const max = Math.max(1, ...rows.map((row) => num(row[valueKey])));
    return `<section class="card section-card"><div class="section-title"><div><h2>${title}</h2><p>Amounts for the selected term</p></div></div><div class="fin-bars" role="img" aria-label="${esc(title)}">${rows.map((row) => {
      const value = num(row[valueKey]);
      return `<div class="fin-bar-row"><span>${esc(row[labelKey])}</span><div class="fin-bar-track"><div class="fin-bar-fill" style="width:${Math.max(0, value / max * 100)}%"></div></div><strong>${money(state, value)}</strong></div>`;
    }).join("")}</div></section>`;
  }

  function comparisonBars(title, rows, labelKey, firstKey, secondKey, state) {
    if (!rows?.length) return `<section class="card section-card"><div class="section-title"><h2>${title}</h2></div>${empty("No class comparison yet", "Income and approved expense records appear here.")}</section>`;
    const max = Math.max(1, ...rows.flatMap((row) => [num(row[firstKey]), num(row[secondKey])]));
    return `<section class="card section-card"><div class="section-title"><div><h2>${title}</h2><p><span class="fin-chart-key income"></span> Income <span class="fin-chart-key expense"></span> Approved expenses</p></div></div><div class="fin-bars" role="img" aria-label="${esc(title)}">${rows.map((row) =>
      `<div class="fin-compare-row"><span>${esc(row[labelKey])}</span><div class="fin-compare-tracks"><div class="fin-bar-track"><div class="fin-bar-fill" style="width:${Math.max(0, num(row[firstKey]) / max * 100)}%"></div></div><div class="fin-bar-track"><div class="fin-bar-fill actual" style="width:${Math.max(0, num(row[secondKey]) / max * 100)}%"></div></div></div><strong>${money(state, row[firstKey])}<small> / ${money(state, row[secondKey])}</small></strong></div>`).join("")}</div></section>`;
  }

  function pie(title, rows, state) {
    const ranked = [...(rows || [])].map((row) => ({
      label: String(row.category || "Other"),
      value: num(row.amount),
    })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
    if (!ranked.length) {
      return `<section class="card section-card"><div class="section-title"><h2>${title}</h2></div>${empty("No expense breakdown yet", "Approved expenses appear here by category.")}</section>`;
    }
    const top = ranked.slice(0, 4);
    if (ranked.length > 4) top.push({ label: "Other", value: ranked.slice(4).reduce((sum, row) => sum + row.value, 0) });
    const total = top.reduce((sum, row) => sum + row.value, 0);
    const colors = ["#4b2e9e", "#ff8c42", "#277a6d", "#7892d4", "#b9a5df"];
    let cursor = 0;
    const gradient = top.map((row, index) => {
      const start = cursor;
      cursor += row.value / total * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    }).join(", ");
    return `<section class="card section-card"><div class="section-title"><div><h2>${title}</h2><p>Share of approved spending</p></div></div><div class="fin-pie-layout"><div class="fin-pie" role="img" aria-label="${esc(title)}: ${top.map((row) => `${esc(row.label)} ${Math.round(row.value / total * 100)}%`).join(", ")}" style="background:conic-gradient(${gradient})"></div><ul class="fin-legend">${top.map((row, index) =>
      `<li><span class="fin-legend-dot" style="--fin-color:${colors[index % colors.length]}"></span><span>${esc(titleCase(row.label))}: ${money(state, row.value)} (${Math.round(row.value / total * 100)}%)</span></li>`).join("")}</ul></div></section>`;
  }

  function budgetBars(rows, state) {
    if (!rows?.length) return empty("No budget rows yet", "Add budgets to compare approved spending with plans.");
    return `<div class="fin-budget-bars">${rows.map((row) => {
      const budget = num(row.budgeted_amount), actual = num(row.actual);
      const max = Math.max(1, budget, actual);
      return `<div class="fin-budget-row"><div class="fin-budget-label"><strong>${esc(titleCase(row.category))}</strong><span>Budget ${money(state, budget)} · Actual ${money(state, actual)}</span></div><div class="fin-budget-pair"><div class="fin-bar-track" aria-label="Budget"><div class="fin-bar-fill" style="width:${budget / max * 100}%"></div></div><div class="fin-bar-track" aria-label="Actual"><div class="fin-bar-fill actual" style="width:${actual / max * 100}%"></div></div></div><small>Variance ${money(state, num(row.variance))}</small></div>`;
    }).join("")}</div>`;
  }

  function tabs(state) {
    const all = [
      ["overview", "Overview", "fa-chart-pie"],
      ["income", "Income", "fa-money-bill-transfer"],
      ["expenses", "Expenses", "fa-receipt"],
      ["schoolpay", "SchoolPay Sync", "fa-mobile-screen-button"],
      ["fee-structure", "Fee Structure", "fa-book"],
      ["budget", "Budget", "fa-calendar-days"],
      ["reports", "Reports", "fa-chart-column"],
      ...(settingsManager(state) ? [["settings", "Settings", "fa-gear"]] : []),
    ];
    return `<div class="fin-tabs" role="tablist" aria-label="Finance sections">${all.map(([key, label, ico]) =>
      `<button role="tab" aria-selected="${state.finance.tab === key}" class="fin-tab ${state.finance.tab === key ? "active" : ""}" data-fin-tab="${key}">${icon(ico)}${label}</button>`).join("")}</div>`;
  }

  function filterForm(state) {
    return `<form class="fin-filterbar" data-fin-form="filters">${period(state)}<span class="fin-period-note">Changes are scoped to your school.</span></form>`;
  }

  function overview(state) {
    const data = state.finance.data.summary || {};
    const classes = data.income_by_class || [];
    const expenses = data.expenses_by_category || [];
    return `<div class="stats-grid">
      ${stat("Total income", money(state, data.total_income), "fa-arrow-trend-up", "Recorded for this term")}
      ${stat("Total expenses", money(state, data.total_expenses), "fa-arrow-trend-down", "Approved expenses")}
      ${stat("Net balance", money(state, data.net_balance), "fa-scale-balanced", "Income less approved expenses")}
      ${stat("Outstanding fees", money(state, data.outstanding_fees), "fa-triangle-exclamation", "Across active learners")}
      ${stat("SchoolPay pending", money(state, data.schoolpay_pending), "fa-mobile-screen-button", "Successful payments not matched")}
    </div><div class="content-grid fin-chart-grid">
      ${bars("Income by class", classes, "class_name", "amount", state)}
      ${pie("Expenses by category", expenses, state)}
    </div><div class="fin-quick-actions">
      ${button("Record payment", "record-payment", "fa-plus")}
      ${button("Add expense", "add-expense", "fa-receipt", "btn-outline", writer(state) ? "" : "disabled")}
      ${button("Reconcile SchoolPay", "reconcile", "fa-rotate", "btn-quiet", canSync(state) ? "" : "disabled")}
    </div>`;
  }

  function income(state) {
    const data = state.finance.data.income || [];
    const filters = state.finance.incomeFilters || {};
    const rows = data.map((item) => `<tr>
      <td>${esc(new Date(item.received_at).toLocaleDateString("en-UG"))}</td>
      <td><strong>${esc(item.learner_name || "Former learner")}</strong><span class="fin-sub">${esc(item.reg_no || "")}</span></td>
      <td>${esc(item.class_name || "—")}</td><td>${money(state, item.amount)}</td>
      <td><span class="badge">${esc(titleCase(item.payment_method))}</span></td><td>${esc(titleCase(item.purpose))}</td>
      <td>${esc(item.schoolpay_reference || "—")}</td><td>${esc(item.received_by_label || "—")}</td>
      ${manager(state) ? `<td><button class="icon-btn delete" aria-label="Delete income" data-fin-action="delete-income" data-id="${esc(item.id)}">${icon("fa-trash")}</button></td>` : ""}
    </tr>`);
    return `<section class="card section-card"><div class="section-title"><div><h2>Income ledger</h2><p>${data.length} records in the current view</p></div><div class="page-actions">${button("Export CSV", "export-income", "fa-download", "btn-outline")}${button("CSV template", "export-income-template", "fa-file-arrow-down", "btn-outline")}${button("Import CSV", "import-csv", "fa-file-csv", "btn-outline", writer(state) ? "" : "disabled")}${button("Record payment", "record-payment", "fa-plus", "btn-primary", writer(state) ? "" : "disabled")}</div></div>
      <div class="toolbar"><label class="sr-only" for="fin-income-class">Class</label><select id="fin-income-class" data-fin-income-filter="class_id">${classOptions(state, filters.class_id || "")}</select>
      <label class="sr-only" for="fin-income-method">Payment method</label><select id="fin-income-method" data-fin-income-filter="method">${selectOptions(METHODS, filters.method || "", "All methods")}</select>
      <label class="sr-only" for="fin-income-from">From date</label><input id="fin-income-from" type="date" data-fin-income-filter="from" value="${esc(filters.from || "")}">
      <label class="sr-only" for="fin-income-to">To date</label><input id="fin-income-to" type="date" data-fin-income-filter="to" value="${esc(filters.to || "")}">
      <button class="btn btn-quiet" data-fin-action="filter-income">${icon("fa-filter")} Apply</button></div>
      ${table(["Date", "Learner", "Class", "Amount", "Method", "Purpose", "Ref", "Received by", ...(manager(state) ? [""] : [])], rows)}
      <p class="field-hint">CSV import columns: reg_no, amount, payment_method, purpose, term, year, notes, schoolpay_reference.</p>
      <input type="file" id="finance-csv" accept=".csv,text/csv" class="hidden" aria-label="Choose income CSV file"></section>${paymentForm(state)}`;
  }

  function paymentForm(state) {
    return `<details class="card fin-form-card" id="payment-form-card"><summary><span>${icon("fa-plus")} Record payment</span><small>Enter learner, amount, and payment details</small></summary>
      <form data-fin-form="payment" class="fin-form-grid">
        <label>Learner<select name="learner_id" required>${learnerOptions(state)}</select></label>
        <label>Amount (UGX)<input name="amount" type="number" min=".01" step=".01" required></label>
        <label>Payment method<select name="payment_method" required>${selectOptions(METHODS)}</select></label>
        <label>Purpose<select name="purpose" required>${selectOptions(PURPOSES)}</select></label>
        <label>Term<select name="term" required>${selectOptions(TERMS, state.finance.term)}</select></label>
        <label>Year<input name="year" type="number" min="1900" max="2100" value="${esc(state.finance.year)}" required></label>
        <label>Reference (optional)<input name="schoolpay_reference" maxlength="200"></label>
        <label class="fin-wide">Notes<textarea name="notes" maxlength="2000"></textarea></label>
        <div class="fin-wide fin-form-actions"><button class="btn btn-primary" type="submit">${icon("fa-floppy-disk")} Save payment</button><button class="btn btn-outline" type="reset">Clear</button></div>
      </form></details>`;
  }

  function expenses(state) {
    const data = state.finance.data.expenses || [];
    const filters = state.finance.expenseFilters || {};
    const rows = data.map((item) => {
      const pendingActions = item.status === "pending" && approver(state)
        ? `<button class="btn btn-quiet btn-small" data-fin-action="approve-expense" data-id="${esc(item.id)}">Approve</button><button class="btn btn-danger btn-small" data-fin-action="reject-expense" data-id="${esc(item.id)}">Reject</button>`
        : "";
      const deleteAction = admin(state)
        ? `<button class="icon-btn delete" aria-label="Delete expense" data-fin-action="delete-expense" data-id="${esc(item.id)}">${icon("fa-trash")}</button>` : "";
      return `<tr><td>${esc(new Date(item.created_at).toLocaleDateString("en-UG"))}</td><td>${esc(titleCase(item.category))}</td>
        <td><strong>${esc(item.description || "—")}</strong><span class="fin-sub">${esc(item.vendor || item.class_name || "")}</span></td>
        <td>${money(state, item.amount)}</td><td><span class="badge ${item.status === "pending" ? "orange" : ""}">${esc(titleCase(item.status))}</span></td>
        <td>${esc(item.approved_by_label || "—")}</td><td><div class="fin-row-actions">${pendingActions}${deleteAction}</div></td></tr>`;
    });
    return `<section class="card section-card"><div class="section-title"><div><h2>Expense ledger</h2><p>${data.length} records in the current view</p></div>${button("Add expense", "add-expense", "fa-plus", "btn-primary", writer(state) ? "" : "disabled")}</div>
      <div class="toolbar"><select aria-label="Expense category" data-fin-expense-filter="category">${selectOptions(CATEGORIES, filters.category || "", "All categories")}</select>
        <select aria-label="Expense status" data-fin-expense-filter="status">${selectOptions(["pending","approved","rejected"], filters.status || "", "All statuses")}</select>
        <button class="btn btn-quiet" data-fin-action="filter-expenses">${icon("fa-filter")} Apply</button></div>
      ${table(["Date", "Category", "Description / vendor", "Amount", "Status", "Approved by", ""], rows)}
      <p class="field-hint">Bursar expenses above the configured approval threshold remain pending until an approver acts.</p></section>${expenseForm(state)}`;
  }

  function expenseForm(state) {
    return `<details class="card fin-form-card" id="expense-form-card"><summary><span>${icon("fa-receipt")} Add expense</span><small>Approval rules are applied automatically</small></summary>
      <form data-fin-form="expense" class="fin-form-grid">
        <label>Amount (UGX)<input name="amount" type="number" min=".01" step=".01" required></label>
        <label>Category<select name="category" required>${selectOptions(CATEGORIES)}</select></label>
        <label class="fin-wide">Description<input name="description" maxlength="1000"></label>
        <label>Vendor<input name="vendor" maxlength="200"></label>
        <label>Class (optional)<select name="class_id">${classOptions(state)}</select></label>
        <label>Payment method<input name="payment_method" maxlength="50" value="cash"></label>
        <label>Receipt reference<input name="receipt_ref" maxlength="200"></label>
        <label>Term<select name="term" required>${selectOptions(TERMS, state.finance.term)}</select></label>
        <label>Year<input name="year" type="number" min="1900" max="2100" value="${esc(state.finance.year)}" required></label>
        <label class="fin-wide">Notes<textarea name="notes" maxlength="2000"></textarea></label>
        <div class="fin-wide fin-form-actions"><button class="btn btn-primary" type="submit">${icon("fa-floppy-disk")} Save expense</button></div>
      </form></details>`;
  }

  function schoolpay(state) {
    const data = state.finance.data.transactions || [];
    const learners = lookupLearners(state);
    const rows = data.map((item) => {
      const matched = Boolean(item.matched_income_id);
      const reference = item.learner_reference || "—";
      const matchCell = matched
        ? `<span class="badge">Matched · ${esc(item.learner_name || item.reg_no || "learner")}</span>`
        : `<div class="fin-match"><select aria-label="Select learner for transaction ${esc(item.schoolpay_transaction_id)}" data-fin-match-id="${esc(item.id)}"><option value="">Select learner</option>${learners.map((learner) => `<option value="${esc(learner.id)}">${esc(learner.full_name)} · ${esc(learner.reg_no)}</option>`).join("")}</select><button class="btn btn-quiet btn-small" data-fin-action="match-transaction" data-id="${esc(item.id)}" ${canSync(state) ? "" : "disabled"}>Match</button></div>`;
      return `<tr><td>${esc(item.transaction_date ? new Date(item.transaction_date).toLocaleString("en-UG") : new Date(item.received_at).toLocaleString("en-UG"))}</td>
        <td>${esc(reference)}</td><td>${money(state, item.amount)}</td><td>${esc(item.payment_channel || "—")}</td>
        <td><span class="badge ${matched ? "" : "orange"}">${matched ? "Matched" : esc(titleCase(item.status || "unmatched"))}</span></td><td>${matchCell}</td></tr>`;
    });
    return `<section class="card section-card"><div class="section-title"><div><h2>SchoolPay transactions</h2><p>Incoming webhooks refresh here every 30 seconds.</p></div><div class="page-actions">${button("Reconcile now", "reconcile", "fa-rotate", "btn-quiet", canSync(state) ? "" : "disabled")}</div></div>
      <div class="notice fin-notice"><div>${icon("fa-circle-info")}</div><div><strong>Webhook endpoint</strong><span>Configure SchoolPay to send transactions to <code>${API}/api/fin/schoolpay/webhook</code>. Include a merchant_code or learner reference to identify the school. If a consumer secret is saved, send an HMAC-SHA256 signature in <code>X-SchoolPay-Signature</code>.</span></div></div>
      <div class="toolbar"><select aria-label="SchoolPay status" data-fin-schoolpay-filter="status">${selectOptions(["matched","unmatched"], state.finance.schoolpayFilters?.status || "", "All transactions")}</select><button class="btn btn-quiet" data-fin-action="filter-schoolpay">${icon("fa-filter")} Apply</button></div>
      ${table(["Date", "Learner ref", "Amount", "Channel", "Status", "Match learner"], rows, "New successful webhook payments will appear here.")}</section>`;
  }

  function feeStructure(state) {
    const data = state.finance.data.feeStructure || [];
    const rows = data.map((item) => `<tr><td>${esc(item.class_name)}</td><td>${esc(titleCase(item.term))} ${esc(item.year)}</td><td>${money(state, item.total_fees)}</td><td>${esc(Object.entries(item.breakdown || {}).map(([key, value]) => `${titleCase(key)}: ${money(state, value)}`).join(" · ") || "—")}</td><td>${admin(state) ? `<button class="icon-btn delete" data-fin-action="delete-fee-structure" data-id="${esc(item.id)}" aria-label="Delete fee structure">${icon("fa-trash")}</button>` : ""}</td></tr>`);
    return `<section class="card section-card"><div class="section-title"><div><h2>Fee structure by class</h2><p>New learners inherit all matching class fee periods.</p></div></div>
      ${table(["Class", "Period", "Total fees", "Breakdown", ""], rows)}
      ${admin(state) ? `<details class="card fin-form-card"><summary><span>${icon("fa-plus")} Set class fees</span><small>Enter a total and optional JSON breakdown</small></summary>
        <form data-fin-form="fee-structure" class="fin-form-grid">
          <label>Class<select name="class_id" required>${classOptions(state, "")}</select></label>
          <label>Total fees<input type="number" name="total_fees" min="0" step=".01" required></label>
          <label>Term<select name="term" required>${selectOptions(TERMS, state.finance.term)}</select></label>
          <label>Year<input name="year" type="number" min="1900" max="2100" value="${esc(state.finance.year)}" required></label>
          <label class="fin-wide">Breakdown (optional JSON)<textarea name="breakdown" placeholder='{"tuition":250000,"lunch":50000}'></textarea></label>
          <div class="fin-wide fin-form-actions"><button class="btn btn-primary" type="submit">${icon("fa-floppy-disk")} Save fee structure</button></div>
        </form></details>` : ""}</section>`;
  }

  function budget(state) {
    const data = state.finance.data.budget || [];
    const rows = data.map((item) => `<tr><td>${esc(titleCase(item.category))}</td><td>${money(state, item.budgeted_amount)}</td><td>${money(state, item.actual)}</td><td class="${num(item.variance) < 0 ? "fin-negative" : ""}">${money(state, item.variance)}</td><td>${admin(state) ? `<button class="icon-btn delete" data-fin-action="delete-budget" data-id="${esc(item.id)}" aria-label="Delete budget row">${icon("fa-trash")}</button>` : ""}</td></tr>`);
    return `<section class="card section-card"><div class="section-title"><div><h2>Term budget</h2><p>Actuals include approved expenses.</p></div></div>
      ${budgetBars(data, state)}
      ${table(["Category", "Budgeted", "Actual", "Variance", ""], rows)}
      ${["school_admin","head_teacher"].includes(role(state)) ? `<details class="card fin-form-card"><summary><span>${icon("fa-plus")} Add or update budget row</span><small>One row per category and term</small></summary>
        <form data-fin-form="budget" class="fin-form-grid">
          <label>Category<select name="category" required>${selectOptions(CATEGORIES)}</select></label>
          <label>Budgeted amount<input name="budgeted_amount" type="number" min="0" step=".01" required></label>
          <label>Term<select name="term" required>${selectOptions(TERMS, state.finance.term)}</select></label>
          <label>Year<input name="year" type="number" min="1900" max="2100" value="${esc(state.finance.year)}" required></label>
          <div class="fin-wide fin-form-actions"><button class="btn btn-primary" type="submit">${icon("fa-floppy-disk")} Save budget</button></div>
        </form></details>` : ""}</section>`;
  }

  function reports(state) {
    const data = state.finance.data.reports || {};
    const classes = data.byClass || [];
    const learners = data.byLearner || [];
    const categories = data.byCategory || [];
    const budgetRows = data.budgetVsActual || [];
    const outstanding = data.outstanding || [];
    const learnerRows = learners.map((item) => `<tr><td>${esc(item.full_name)}</td><td>${esc(item.reg_no)}</td><td>${esc(item.class_name || "—")}</td><td>${money(state, item.total_fees)}</td><td>${money(state, item.paid)}</td><td>${money(state, item.balance)}</td></tr>`);
    const outstandingRows = outstanding.map((item) => `<tr><td>${esc(item.learner)}</td><td>${esc(item.reg_no)}</td><td>${esc(item.class || "—")}</td><td>${money(state, item.total_fees)}</td><td>${money(state, item.paid)}</td><td>${money(state, item.balance)}</td></tr>`);
    const classRows = classes.map((item) => `<tr><td>${esc(item.class_name)}</td><td>${money(state, item.income)}</td><td>${money(state, item.expenses)}</td><td>${money(state, item.net)}</td></tr>`);
    const categoryRows = categories.map((item) => `<tr><td>${esc(titleCase(item.category))}</td><td>${money(state, item.amount)}</td></tr>`);
    return `<div class="fin-report-tools"><label>Class for learner report<select data-fin-filter="reportClass">${classOptions(state, state.finance.reportClass || "")}</select></label>${button("Export learner CSV", "export-report-learners", "fa-download", "btn-outline")}</div>
      <div class="content-grid fin-chart-grid">${comparisonBars("Income and expenses by class", classes, "class_name", "income", "expenses", state)}${pie("Expenses by category", categories, state)}</div>
      <section class="card section-card"><div class="section-title"><h2>Budget vs actual</h2>${button("Export CSV", "export-budget", "fa-download", "btn-outline")}</div>${budgetBars(budgetRows, state)}</section>
      <section class="card section-card"><div class="section-title"><h2>By class</h2>${button("Export CSV", "export-class", "fa-download", "btn-outline")}</div>${table(["Class", "Income", "Expenses", "Net"], classRows)}</section>
      <section class="card section-card"><div class="section-title"><h2>By learner</h2></div>${table(["Learner", "Reg. no.", "Class", "Fees", "Paid", "Balance"], learnerRows)}</section>
      <section class="card section-card"><div class="section-title"><h2>Expenses by category</h2>${button("Export CSV", "export-category", "fa-download", "btn-outline")}</div>${table(["Category", "Approved expenses"], categoryRows)}</section>
      <section class="card section-card"><div class="section-title"><h2>Outstanding fees</h2>${button("Export CSV", "export-outstanding", "fa-download", "btn-outline")}</div>${table(["Learner", "Reg. no.", "Class", "Total fees", "Paid", "Balance"], outstandingRows)}</section>`;
  }

  function settings(state) {
    const data = state.finance.data.settings?.settings || {};
    const users = state.finance.data.roles?.users || [];
    const roleRows = users.map((user) => `<tr><td>${esc(user.name)}</td><td>${esc(user.email || user.phone || "—")}</td><td>${esc(titleCase(user.finance_role || "No finance role"))}</td><td><select aria-label="Finance role for ${esc(user.name)}" data-fin-role-user="${esc(user.id)}">${selectOptions([{value:"",label:"Remove role"},{value:"bursar",label:"Bursar"},{value:"head_teacher",label:"Head teacher"},{value:"director",label:"Director"}], user.finance_role || "")}</select><button class="btn btn-quiet btn-small" data-fin-action="save-role" data-id="${esc(user.id)}">Save</button></td></tr>`);
    return `<section class="card section-card"><div class="section-title"><div><h2>Finance settings</h2><p>SchoolPay keys are encrypted before they are stored and are never returned to the browser.</p></div></div>
      <form data-fin-form="settings" class="fin-form-grid">
        <label>Currency<input name="currency" value="${esc(data.currency || "UGX")}" maxlength="3" required></label>
        <label>Expense approval threshold<input name="expense_approval_threshold" type="number" min="0" step=".01" value="${esc(data.expense_approval_threshold ?? 500000)}" required></label>
        <label>SchoolPay merchant code<input name="schoolpay_merchant_code" value="${esc(data.schoolpay_merchant_code || "")}" maxlength="500"></label>
        <label>Environment<select name="schoolpay_environment">${selectOptions(["sandbox","production"], data.schoolpay_environment || "sandbox")}</select></label>
        <label>Consumer key<input name="schoolpay_consumer_key" type="password" autocomplete="new-password" placeholder="${data.schoolpay_consumer_key_configured ? "Already saved — blank keeps it" : "Not configured"}"></label>
        <label>Consumer secret<input name="schoolpay_consumer_secret" type="password" autocomplete="new-password" placeholder="${data.schoolpay_consumer_secret_configured ? "Already saved — blank keeps it" : "Not configured"}"></label>
        ${data.schoolpay_consumer_key_configured ? `<label class="fin-check"><input type="checkbox" name="clear_consumer_key" value="yes"> Remove saved consumer key</label>` : ""}
        ${data.schoolpay_consumer_secret_configured ? `<label class="fin-check"><input type="checkbox" name="clear_consumer_secret" value="yes"> Remove saved consumer secret</label>` : ""}
        <div class="fin-wide fin-form-actions"><button class="btn btn-primary" type="submit">${icon("fa-floppy-disk")} Save settings</button></div>
      </form></section>
      <section class="card section-card"><div class="section-title"><div><h2>Finance roles</h2><p>Assign bursar, head teacher, or director access to active staff accounts.</p></div></div>${table(["Staff member", "Contact", "Current role", "Change role"], roleRows, "Create staff accounts first, then assign finance roles.")}</section>`;
  }

  function render(state) {
    const tab = state.finance.tab;
    const content = {
      overview: () => overview(state),
      income: () => income(state),
      expenses: () => expenses(state),
      schoolpay: () => schoolpay(state),
      "fee-structure": () => feeStructure(state),
      budget: () => budget(state),
      reports: () => reports(state),
      settings: () => settings(state),
    }[tab]?.() || overview(state);
    return `<div class="fin-heading"><div><p class="eyebrow">School office · Finance</p><h1>Finance</h1><p>Income, expenses, fees, and budget for your school.</p></div>${tab !== "settings" ? period(state) : ""}</div>
      ${state.finance.error ? `<div class="alert error" role="alert">${esc(state.finance.error)} <button class="text-button" data-fin-action="refresh">Try again</button></div>` : ""}
      ${state.finance.loading ? `<div class="card section-card"><div class="loading-row">Loading finance records</div><div class="loading-row" style="margin-top:10px">Loading finance records</div></div>` : `${tabs(state)}${content}`}`;
  }

  function csv(rows, filename) {
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const content = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  window.ReportCardsFinance = { render, csv, helpers: { money, titleCase } };
})();
