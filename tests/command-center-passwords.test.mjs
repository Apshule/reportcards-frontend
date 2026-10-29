import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../command-center.css", import.meta.url), "utf8");

test("Super Admin Command Center lists accounts and offers audited, one-time password resets", () => {
  assert.match(appSource, /data-tab="accounts">User Accounts/u);
  assert.match(appSource, /api\("\/api\/command-center\/accounts"\)/u);
  assert.match(appSource, /data-action="reset-account-password"/u);
  assert.match(appSource, /confirm-account-password-reset/u);
  assert.match(appSource, /temporary_password/u);
  assert.match(appSource, /Passwords are not viewable/u);
  assert.match(appSource, /must_change_password:true/u);
  assert.doesNotMatch(appSource, /password_hash/u);
  assert.match(styles, /\.cc-accounts-table/u);
});
