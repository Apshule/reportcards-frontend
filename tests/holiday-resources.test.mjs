import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const uiSource = readFileSync(new URL("../holiday-resources-ui.js", import.meta.url), "utf8");
const parentSource = readFileSync(new URL("../parent-dashboard.js", import.meta.url), "utf8");
const mainHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const parentHtml = readFileSync(new URL("../parent-dashboard.html", import.meta.url), "utf8");

function holidayUi() {
  const window = {};
  vm.runInNewContext(uiSource, { window, Intl, Date, String, Number });
  return window.ReportCardsHolidayResources;
}

test("school admin holiday page supports school/class resources and bounded file uploads", () => {
  const html = holidayUi().render({
    role: "school_admin",
    data: {
      classes: [{ id: "class-1", name: "P.5", level: "PRIMARY" }],
      holidayResources: [],
      holidayPending: [],
      holidayTab: "resources",
    },
  });
  assert.match(html, /Upload a holiday resource/u);
  assert.match(html, /accept="application\/pdf,image\/jpeg,image\/png,image\/webp"/u);
  assert.match(html, /Maximum file size: 5 MB/u);
  assert.match(html, /Whole school/u);
  assert.match(html, /P\.5/u);
  assert.match(html, /Require payment/u);
  assert.match(html, /Staff must confirm the payment/u);
});

test("teachers only see pending payments and the confirm action", () => {
  const html = holidayUi().render({
    role: "teacher",
    data: {
      holidayPending: [{
        access_id: "access-1",
        parent_name: "Parent",
        parent_email: "parent@example.test",
        learner_names: "Amina",
        class_names: "P.5",
        resource_title: "Holiday pack",
        price: 5000,
        payment_contact: "+256700000000",
        requested_at: "2026-10-30T08:00:00.000Z",
      }],
    },
  });
  assert.match(html, /Pending holiday payments/u);
  assert.match(html, /Amina/u);
  assert.match(html, /Confirm/u);
  assert.doesNotMatch(html, /Upload a holiday resource/u);
  assert.doesNotMatch(html, /data-action="holiday-delete"/u);
});

test("parent portal exposes child-scoped holiday access and uses bearer-authenticated downloads", () => {
  assert.match(parentHtml, /holiday-resources\.css/u);
  assert.match(parentSource, /Authorization: `Bearer \$\{state\.token\}`/u);
  assert.match(parentSource, /\/api\/holiday-resources\/children\/\$\{encodeURIComponent\(childId\)\}\/resources/u);
  assert.match(parentSource, /\/preview/u);
  assert.match(parentSource, /\/download/u);
  assert.match(parentSource, /\/mark-paid/u);
  assert.match(parentSource, /if \(state\.tab === "holiday-resources"\) await loadHolidayResources\(\)/u);
});

test("main app loads the holiday UI module before its route renderer", () => {
  const moduleIndex = mainHtml.indexOf("holiday-resources-ui.js");
  const appIndex = mainHtml.indexOf("app.js");
  assert.ok(moduleIndex >= 0 && appIndex > moduleIndex);
  assert.match(mainHtml, /holiday-resources\.css/u);
});
