(() => {
  "use strict";

  const INQUIRY_ENDPOINT = "https://reportcards-api.apshule-migration.workers.dev/api/landing/inquiry";
  let markupPromise;

  async function loadMarkup() {
    if (!markupPromise) {
      markupPromise = fetch(new URL("landing.html", document.baseURI), { credentials: "same-origin" })
        .then(response => {
          if (!response.ok) throw new Error("The landing page could not be loaded.");
          return response.text();
        });
    }
    return markupPromise;
  }

  function bindLanding(container) {
    const root = container.querySelector(".asl-landing");
    if (!root) return;

    const menuButton = root.querySelector(".asl-menu-toggle");
    const nav = root.querySelector(".asl-nav-links");
    const closeMenu = () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
      menuButton.innerHTML = '<svg><use href="#asl-menu"/></svg>';
    };
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menuButton.innerHTML = open ? '<svg><use href="#asl-close"/></svg>' : '<svg><use href="#asl-menu"/></svg>';
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", event => {
      if (event.target.closest("a")) closeMenu();
    });
    root.addEventListener("keydown", event => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu();
        menuButton.focus();
      }
    });

    const revealItems = root.querySelectorAll(".asl-reveal");
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      revealItems.forEach(item => observer.observe(item));
    } else {
      revealItems.forEach(item => item.classList.add("is-visible"));
    }

    const form = root.querySelector("#landing-inquiry-form");
    const status = root.querySelector("#asl-inquiry-status");
    const submit = form.querySelector('button[type="submit"]');
    const defaultButton = submit.innerHTML;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      status.textContent = "";
      status.removeAttribute("data-state");
      if (!form.reportValidity()) return;

      const formData = new FormData(form);
      if (String(formData.get("website") || "").trim()) {
        status.textContent = "Thank you, we'll be in touch.";
        status.dataset.state = "success";
        form.reset();
        return;
      }

      const payload = {
        full_name: String(formData.get("full_name") || "").trim(),
        school_name: String(formData.get("school_name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        website: String(formData.get("website") || "")
      };
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submit.textContent = "Sending…";
      status.dataset.state = "loading";
      status.textContent = "Sending your enquiry…";
      try {
        const response = await fetch(INQUIRY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        let result = {};
        try { result = await response.json(); } catch { /* Response may be empty. */ }
        if (!response.ok) {
          throw new Error(result.error || result.message || "We couldn't send your enquiry. Please try again, or contact us directly.");
        }
        status.textContent = "Thank you, we'll be in touch.";
        status.dataset.state = "success";
        form.reset();
      } catch (error) {
        status.textContent = error && error.message ? error.message : "We couldn't send your enquiry. Please try again, or contact us directly.";
        status.dataset.state = "error";
      } finally {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submit.innerHTML = defaultButton;
      }
    });
  }

  async function render(container) {
    if (!container || typeof container.innerHTML !== "string") return;
    container.innerHTML = '<main class="asl-landing-loading" aria-label="Loading AppShule"><div class="asl-loading-lines" aria-hidden="true"></div><p>Opening the school office…</p></main>';
    try {
      container.innerHTML = await loadMarkup();
      bindLanding(container);
    } catch {
      container.innerHTML = '<main class="asl-landing-error" role="alert"><h1>We could not open this page just now.</h1><p>Please refresh to try again.</p><button type="button" class="asl-retry">Try again</button></main>';
      container.querySelector(".asl-retry").addEventListener("click", () => {
        markupPromise = null;
        render(container);
      });
    }
  }

  window.AppShuleLanding = window.AppShuleLanding || {};
  window.AppShuleLanding.render = render;
})();
