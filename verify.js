(() => {
  "use strict";

  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const result = document.getElementById("verification-result");

  function detail(label, value) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value || "—";
    row.append(term, description);
    return row;
  }

  async function verify() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) throw new Error("This QR code does not include a report card ID.");
    const response = await fetch(`${API}/api/verify/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This report card could not be verified.");

    result.classList.add("is-authentic");
    result.replaceChildren();
    const heading = document.createElement("h1");
    heading.textContent = "✓ Authentic Report Card";
    const message = document.createElement("p");
    message.textContent = "This report card was issued through AppShule ReportCards.";
    const details = document.createElement("dl");
    details.className = "verification-details";
    details.append(
      detail("School", data.school_name),
      detail("Learner", data.learner_name),
      detail("Term", data.term),
      detail("Year", String(data.year ?? "")),
      detail("Status", data.status || "Authentic"),
    );
    result.append(heading, message, details);
  }

  verify().catch((error) => {
    result.classList.add("is-invalid");
    result.replaceChildren();
    const heading = document.createElement("h1");
    heading.textContent = "Report Card Not Verified";
    const message = document.createElement("p");
    message.textContent = error.message || "This report card could not be verified.";
    result.append(heading, message);
  });
})();
