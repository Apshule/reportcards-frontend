(() => {
  "use strict";

  const icon = (name, size = 24) => {
    const paths = {
      mark: '<path d="M5 18.5 8.4 6h3.2L15 18.5h-3l-.7-2.8H8.5l-.7 2.8H5Zm4.1-5.1h1.6l-.8-3.2-.8 3.2Z"/><path d="M17 6h2.8v12.5H17z"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      report: '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M8 13h7M8 17h7"/>',
      teachers: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M17 11h6"/>',
      comments: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.4Z"/><path d="M8 12h8M8 9h5"/>',
      fees: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 15h4M17 3v4"/>',
      stamp: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9M8 3.8 12 6l4-2.2"/>',
      design: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5-9.5 9.5-4 1 1-4L18 5"/><path d="m14 5 5 5"/>',
      shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
      support: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><path d="M4 14H3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3v-6H4ZM20 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3v-6h2ZM17 21c-1 1-2 1-4 1"/>',
      bolt: '<path d="m13 2-3 8h7l-6 12 2-9H6l7-11Z"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
      globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
      school: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7M3 10l9 6 9-6"/>',
      steps: '<path d="M3 18h5v-5h5V8h5V3"/><path d="M14 3h4v4"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      facebook: '<path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9a1 1 0 0 1 1-1Z"/>',
      instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
      youtube: '<path d="M22 12s0-3.5-.9-4.5c-.8-.9-1.7-1-2.2-1C15.8 6.2 12 6.2 12 6.2s-3.8 0-6.9.3c-.5 0-1.4.1-2.2 1C2 8.5 2 12 2 12s0 3.5.9 4.5c.8.9 1.8 1 2.2 1 3.1.3 6.9.3 6.9.3s3.8 0 6.9-.3c.5 0 1.4-.1 2.2-1 .9-1  .9-4.5.9-4.5Z"/><path d="m10 9 5 3-5 3V9Z"/>',
      tiktok: '<path d="M14 3v12.2a4.2 4.2 0 1 1-4-4.2M14 6c1.1 2.2 2.8 3.3 5 3.5"/>',
      x: '<path d="M4 4l16 16M20 4 4 20"/>',
      linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7h.01M12 17v-7h3v1a2.5 2.5 0 0 1 4 2v4"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.report}</svg>`;
  };

  const featureItems = [
    ["report", "20 Report Card Templates", "Nursery, Primary, O-Level and A-Level formats, ready for your school."],
    ["teachers", "Teacher Accounts with Marks Entry", "Give teachers the access they need to submit marks for their classes."],
    ["comments", "Auto Comments & Promotion Decisions", "Turn results into clear comments and consistent promotion outcomes."],
    ["fees", "Fee Tracking & SchoolPay Integration", "Keep school fees visible alongside learner records and payment activity."],
    ["stamp", "Digital Stamp & School Branding", "Add your school identity to reports with a digital stamp and details."],
    ["design", "Custom Report Card Designs", "Shape reports to suit the way your school communicates progress."]
  ];
  const services = [
    ["school", "Learning Platform", "Lessons, assignments and progress tools for schools."],
    ["bolt", "AI Tutor", "A guided study companion for questions and practice."],
    ["globe", "Virtual Lab", "Explore interactive science experiments and demonstrations."],
    ["design", "Video Studio", "Create and share useful learning videos."],
    ["fees", "MFI / SACCO Management", "Organise member services and financial records."],
    ["support", "Clinic Management", "Support everyday clinic records and patient workflows."],
    ["school", "Farm Management", "Keep farm activities, people and records connected."],
    ["arrow", "And more…", "Explore more practical tools across the AppShule platform."]
  ];

  function render(container) {
    if (!container || typeof container.innerHTML !== "string") return;
    container.innerHTML = `
      <div class="asl-landing">
        <a class="asl-skip" href="#asl-main">Skip to content</a>
        <header class="asl-header">
          <div class="asl-container asl-nav">
              <a class="asl-brand" href="#top" aria-label="AppShule Report Cards home">
              <img class="asl-brand-mark" src="appshule-logo.jpeg" alt=""><span>AppShule</span>
            </a>
            <nav class="asl-nav-links" id="asl-navigation" aria-label="Main navigation">
              <a href="#top">Home</a><a href="#features">Features</a><a href="#services">Other AppShule Services</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a>
              <a class="asl-mobile-auth" href="/login">Login</a><a class="asl-mobile-auth asl-mobile-start" href="/signup">Get Started</a>
            </nav>
            <div class="asl-nav-actions">
              <a class="asl-button asl-button-primary" href="/login">Login</a>
              <a class="asl-button asl-button-accent" href="/signup">Get Started ${icon("arrow",16)}</a>
              <button class="asl-menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="asl-navigation">${icon("menu",21)}</button>
            </div>
          </div>
        </header>
        <main id="asl-main">
          <section class="asl-hero" id="top">
            <div class="asl-container asl-hero-grid">
              <div class="asl-hero-content">
                <p class="asl-kicker">A better school office starts here</p>
                <h1>The Complete Report Card &amp; School Management System for <em>Ugandan Schools</em></h1>
                <p class="asl-hero-copy">Create report cards, manage teachers, track fees, and send SMS notifications — all in one place.</p>
                <div class="asl-hero-actions">
                  <a class="asl-button asl-button-accent" href="/signup">Get Started ${icon("arrow",17)}</a>
                  <a class="asl-button asl-button-soft" href="/login">Login</a>
                </div>
                <div class="asl-proofline">
                  <span>${icon("check",16)} Built for Ugandan schools</span>
                  <span>${icon("check",16)} Nursery through A-Level</span>
                </div>
              </div>
              <div class="asl-preview-wrap" aria-label="Illustration of a school report card">
                <div class="asl-report-preview">
                  <div class="asl-report-top">
                    <div class="asl-seal">${icon("school",24)}</div>
                    <div class="asl-report-school"><strong>GREEN VALLEY SCHOOL</strong><span>LEARN • GROW • EXCEL</span></div>
                  </div>
                  <div class="asl-report-heading"><b>LEARNER PROGRESS REPORT</b><span>TERM II · 2025 · PRIMARY 5</span></div>
                  <div class="asl-student-line"><span><b>Learner:</b> Amina N.</span><span><b>Class:</b> P.5 Blue</span><span><b>Position:</b> 04 / 38</span><span><b>Attendance:</b> 58 / 60</span></div>
                  <table class="asl-mini-table" aria-label="Sample report card marks"><thead><tr><th>SUBJECT</th><th>MARK</th><th>GRADE</th><th>COMMENT</th></tr></thead><tbody>
                    <tr><td>English</td><td>86</td><td>A</td><td>Excellent</td></tr><tr><td>Mathematics</td><td>78</td><td>B</td><td>Very good</td></tr><tr><td>Science</td><td>91</td><td>A</td><td>Outstanding</td></tr><tr><td>Social Studies</td><td>74</td><td>B</td><td>Good work</td></tr>
                  </tbody></table>
                  <div class="asl-preview-summary"><span>AVERAGE: 82.3%</span><span>PROMOTED TO PRIMARY 6</span></div>
                  <div class="asl-preview-stamp">SCHOOL<br>STAMP</div>
                </div>
                <div class="asl-preview-note">${icon("report",17)} Clear results. Ready to share.</div>
              </div>
            </div>
          </section>
          <div class="asl-trust-strip"><div class="asl-container asl-trust-inner">
            <span class="asl-trust-label">One connected school office</span>
            <span class="asl-trust-item">${icon("report",19)} Report cards</span>
            <span class="asl-trust-item">${icon("teachers",19)} Teachers &amp; marks</span>
            <span class="asl-trust-item">${icon("fees",19)} Fee tracking</span>
            <span class="asl-trust-item">${icon("comments",19)} Family updates</span>
          </div></div>
          <section class="asl-section asl-features" id="features">
            <div class="asl-container asl-feature-layout">
              <div class="asl-feature-intro asl-reveal">
                <p class="asl-kicker">Made for the school year you run</p>
                <h2>Less chasing paperwork. More time for learners.</h2>
                <p>Bring essential school-office work into one dependable workspace. Your team can prepare results, keep fees in view and communicate with families without juggling disconnected tools.</p>
                <div class="asl-feature-count"><strong>20</strong><span>report-card designs across four school levels</span></div>
              </div>
              <div class="asl-feature-list">
                ${featureItems.map(([ico,title,desc]) => `<article class="asl-feature asl-reveal"><span class="asl-feature-icon">${icon(ico,21)}</span><div><h3>${title}</h3><p>${desc}</p></div></article>`).join("")}
              </div>
            </div>
          </section>
          <section class="asl-section asl-workflow" id="how-it-works">
            <div class="asl-container">
              <div class="asl-section-head asl-reveal"><p class="asl-kicker">A straightforward start</p><h2>From setup to a report in three steps.</h2><p>Bring your school team in at a pace that works for you. The essentials stay clear from day one.</p></div>
              <div class="asl-workflow-grid">
                <article class="asl-step asl-reveal"><span class="asl-step-num">01</span><h3>Set up your school</h3><p>Add your school details, classes and the people who need access.</p></article>
                <article class="asl-step asl-reveal"><span class="asl-step-num">02</span><h3>Enter marks together</h3><p>Teachers submit marks for their assigned subjects and classes.</p></article>
                <article class="asl-step asl-reveal"><span class="asl-step-num">03</span><h3>Review and share</h3><p>Prepare branded reports with comments, decisions and family updates.</p></article>
              </div>
            </div>
          </section>
          <section class="asl-section asl-benefits">
            <div class="asl-container">
              <div class="asl-section-head asl-reveal"><p class="asl-kicker">Support for the people behind the school</p><h2>Why Choose AppShule?</h2><p>Made to feel manageable for busy administrators, teachers and school teams.</p></div>
              <div class="asl-benefit-band asl-reveal">
                <div class="asl-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="5"/></svg><strong>Fast &amp; Easy</strong><p>Setup in minutes and works on any device.</p></div>
                <div class="asl-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg><strong>100% Secure</strong><p>Role-based access and encrypted data.</p></div>
                <div class="asl-benefit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><path d="M4 14H3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3v-6H4ZM20 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3v-6h2Z"/></svg><strong>24/7 Support</strong><p>WhatsApp, email and phone support.</p></div>
              </div>
            </div>
          </section>
          <section class="asl-pricing" id="pricing">
            <div class="asl-container asl-pricing-inner asl-reveal">
              <div><p class="asl-kicker">Pricing that fits your school</p><h2>Let's find the right plan.</h2><p>Tell us about your school and we'll help you choose a setup that fits your needs.</p></div>
              <a class="asl-button asl-button-accent" href="#contact">Ask about pricing ${icon("arrow",16)}</a>
            </div>
          </section>
          <section class="asl-services" id="services">
            <div class="asl-container">
              <div class="asl-section-head asl-reveal"><p class="asl-kicker">One platform, more possibilities</p><h2>AppShule grows with your organisation.</h2><p>Alongside school management, explore practical tools for learning, finance, health and agriculture.</p></div>
              <div class="asl-service-grid">
                ${services.map(([ico,name,description]) => `<a class="asl-service asl-reveal" href="https://appshule.com" target="_blank" rel="noopener noreferrer"><span class="asl-service-icon">${icon(ico,20)}</span><strong>${name}</strong><p>${description}</p><span class="asl-service-more">Learn more ${icon("arrow",16)}</span></a>`).join("")}
              </div>
              <div class="asl-services-cta"><p>Explore all AppShule services at appshule.com</p><a class="asl-button asl-button-light" href="https://appshule.com" target="_blank" rel="noopener noreferrer">Explore all services ${icon("arrow",16)}</a></div>
            </div>
          </section>
          <section class="asl-contact" id="contact">
            <div class="asl-container asl-contact-grid">
              <div class="asl-contact-copy asl-reveal">
                <p class="asl-kicker">Talk with AppShule</p><h2>Let's make the school office feel lighter.</h2>
                <p>Have a question, want to see how it fits your school, or need help getting started? Send a note and our team will be in touch.</p>
                <div class="asl-contact-links">
                  <a class="asl-contact-link" href="tel:+256705732540"><span class="asl-contact-icon">${icon("phone",18)}</span><span>+256 705 732 540<br>+256 794 221 315</span></a>
                  <a class="asl-contact-link" href="mailto:reportcard.appshule@gmail.com"><span class="asl-contact-icon">${icon("mail",18)}</span><span>reportcard.appshule@gmail.com</span></a>
              <a class="asl-contact-link" href="https://reportcards.appshule.com" target="_blank" rel="noopener noreferrer"><span class="asl-contact-icon">${icon("globe",18)}</span><span>reportcards.appshule.com</span></a>
                  <a class="asl-contact-link" href="https://wa.me/256705732540" target="_blank" rel="noopener noreferrer"><span class="asl-contact-icon">${icon("comments",18)}</span><span>Chat on WhatsApp</span></a>
                </div>
              </div>
              <div class="asl-form-card asl-reveal">
                <h3>Send an inquiry</h3><p>Tell us a little about your school. We’ll follow up with you.</p>
                <form id="landing-inquiry-form" class="asl-inquiry-form" novalidate>
                  <div class="asl-honeypot" aria-hidden="true"><label for="asl-website">Leave this field empty</label><input id="asl-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
                  <div class="asl-form-grid">
                    <div class="asl-field"><label for="asl-full-name">Full name <span>(required)</span></label><input id="asl-full-name" name="full_name" type="text" required autocomplete="name" maxlength="160" placeholder="Your name"></div>
                    <div class="asl-field"><label for="asl-school-name">School name <span>(required)</span></label><input id="asl-school-name" name="school_name" type="text" required autocomplete="organization" maxlength="200" placeholder="Your school"></div>
                    <div class="asl-field"><label for="asl-email">Email <span>(required)</span></label><input id="asl-email" name="email" type="email" required autocomplete="email" maxlength="254" placeholder="you@school.ug"></div>
                    <div class="asl-field"><label for="asl-phone">Phone <span>(required)</span></label><input id="asl-phone" name="phone" type="tel" required autocomplete="tel" maxlength="60" placeholder="+256"></div>
                    <div class="asl-field asl-field-full"><label for="asl-message">Message <span>(optional)</span></label><textarea id="asl-message" name="message" maxlength="2000" placeholder="What would you like to know?"></textarea></div>
                  </div>
                  <button class="asl-button asl-button-primary asl-form-submit" type="submit">Send Inquiry ${icon("arrow",16)}</button>
                  <p class="asl-form-status" id="asl-inquiry-status" role="status" aria-live="polite"></p>
                </form>
              </div>
            </div>
          </section>
        </main>
        <footer class="asl-footer">
          <div class="asl-container asl-footer-main">
            <div class="asl-footer-about">
              <a class="asl-brand" href="#top" aria-label="AppShule ReportCards home"><img class="asl-brand-mark" src="appshule-logo.jpeg" alt=""><span>AppShule</span></a>
              <p>Report-card tools that help your school office work with more ease.</p>
              <p class="asl-motto">Let's learn with ease.</p>
              <div class="asl-footer-contact"><a href="tel:+256705732540">+256 705 732 540</a><a href="tel:+256794221315">+256 794 221 315</a><a href="mailto:reportcard.appshule@gmail.com">reportcard.appshule@gmail.com</a><a href="https://reportcards.appshule.com">reportcards.appshule.com</a></div>
              <div class="asl-socials" aria-label="Social media">
                <span role="img" aria-label="Facebook" title="Facebook">${icon("facebook",16)}</span>
                <span role="img" aria-label="Instagram" title="Instagram">${icon("instagram",16)}</span>
                <span role="img" aria-label="YouTube" title="YouTube">${icon("youtube",16)}</span>
                <span role="img" aria-label="TikTok" title="TikTok">${icon("tiktok",16)}</span>
                <span role="img" aria-label="X / Twitter" title="X / Twitter">${icon("x",16)}</span>
                <span role="img" aria-label="LinkedIn" title="LinkedIn">${icon("linkedin",16)}</span>
              </div>
            </div>
            <div class="asl-footer-col"><h3>Quick links</h3><nav class="asl-footer-links" aria-label="Footer navigation"><a href="#top">Home</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a></nav></div>
            <div class="asl-footer-col"><h3>Main App</h3><div class="asl-footer-links"><a href="https://appshule.com" target="_blank" rel="noopener noreferrer">appshule.com ${icon("arrow",14)}</a><a href="https://reportcards.appshule.com">reportcards.appshule.com</a><a href="https://wa.me/256705732540" target="_blank" rel="noopener noreferrer">WhatsApp us</a></div></div>
          </div>
          <div class="asl-container asl-footer-bottom"><span>© 2026 AppShule. All rights reserved.</span><a href="https://appshule.com" target="_blank" rel="noopener noreferrer">Main App: appshule.com</a></div>
        </footer>
      </div>`;

    const root = container.querySelector(".asl-landing");
    const menuButton = root.querySelector(".asl-menu-toggle");
    const nav = root.querySelector(".asl-nav-links");
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menuButton.innerHTML = icon(open ? "close" : "menu", 21);
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", event => {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");
        menuButton.innerHTML = icon("menu", 21);
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
      submit.innerHTML = "Sending…";
      status.dataset.state = "loading";
      status.textContent = "Sending your enquiry…";
      try {
        const response = await fetch("https://reportcards-api.apshule-migration.workers.dev/api/landing/inquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        let result = {};
        try { result = await response.json(); } catch { /* Response may be empty. */ }
        if (!response.ok) throw new Error(result.error || result.message || "We couldn't send your enquiry. Please try again, or contact us directly.");
        status.textContent = "Thank you, we'll be in touch.";
        status.dataset.state = "success";
        form.reset();
      } catch (error) {
        status.textContent = error && error.message ? error.message : "We couldn't send your enquiry. Please try again, or contact us directly.";
        status.dataset.state = "error";
      } finally {
        submit.disabled = false;
        submit.innerHTML = `Send Inquiry ${icon("arrow",16)}`;
      }
    });
  }

  window.AppShuleLanding = window.AppShuleLanding || {};
  window.AppShuleLanding.render = render;
})();
