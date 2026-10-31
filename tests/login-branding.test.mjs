import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const parent = readFileSync(new URL("../parent-dashboard.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const parentStyles = readFileSync(new URL("../parent-dashboard.css", import.meta.url), "utf8");
const loginHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const parentHtml = readFileSync(new URL("../parent-dashboard.html", import.meta.url), "utf8");

test("school and parent login cards use the AppShule logo before school lookup", () => {
  assert.match(app, /function genericLoginBrandMarkup\(\)\{return `[^`]*src="appshule-logo\.jpeg"[^`]*AppShule/);
  assert.match(parent, /parent-company-logo[^`]*src="appshule-logo\.jpeg"/);
  assert.match(parent, /brand\.innerHTML = parentLoginBrandMarkup\(\)/);
});

test("typing an account identifier preserves the public school-branding lookup", () => {
  assert.match(app, /api\(`\/api\/schools\/branding\?identifier=\$\{encodeURIComponent\(identifier\)\}`,\{auth:false\}\)/);
  assert.match(app, /void updateLoginBranding\(input\.value\.trim\(\)\)/);
  assert.ok(/api\(`\/api\/schools\/branding\?identifier=\$\{encodeURIComponent\(identifier\)\}`,\s*\{\s*auth:\s*false\s*\}\)/.test(parent), "parent branding uses the public school lookup");
  assert.match(parent, /void updateParentLoginBranding\(input\.value\.trim\(\)\)/);
  assert.match(parent, /data-school-brand-logo/);
});

test("login footer keeps its logo aligned to one 11pt text line", () => {
  assert.match(styles, /\.powered-by-footer\{[^}]*font-size:11pt[^}]*white-space:nowrap/);
  assert.match(styles, /\.powered-by-footer img\{width:15px;height:15px;flex:0 0 15px/);
  assert.match(styles, /\.powered-by-auth,.powered-by-parent\{position:fixed[^}]*bottom:0/);
  assert.match(app, /Powered by AP SHULE TECHNOLOGIES/);
  assert.match(parent, /Powered by AP SHULE TECHNOLOGIES/);
});

test("parent sign-in brand and card stay centered and fit narrow screens", () => {
  assert.match(styles, /\.parent-login \.parent-brand\{justify-content:center;flex-direction:column/);
  assert.match(parentStyles, /\.parent-login\{width:min\(100%,460px\);max-width:460px/);
  assert.match(loginHtml, /styles\.css\?v=login-branding-v1/);
  assert.match(parentHtml, /parent-dashboard\.js\?v=login-branding-v1/);
});
