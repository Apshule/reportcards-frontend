import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("SSO receiver only starts in an iframe and targets the exact AppShule origin", () => {
  assert.match(source, /if\(window\.self===window\.top\)return/u);
  assert.match(source, /const appShuleOrigin="https:\/\/appshule\.com"/u);
  assert.match(source, /window\.parent\.postMessage\(\{type:"READY"\},appShuleOrigin\)/u);
});

test("SSO receiver validates message origin and source before redeeming tickets", () => {
  assert.match(source, /event\.origin!==appShuleOrigin\|\|event\.source!==window\.parent/u);
  assert.match(source, /message\.type!=="AUTH_TICKET"/u);
  assert.match(source, /message\.ticket\.length>8192/u);
  assert.match(source, /api\("\/api\/auth\/sso-redeem",\{method:"POST",auth:false,body:\{ticket:message\.ticket\}\}\)/u);
});

test("successful SSO redemption stores the existing app session and reuses normal session loading", () => {
  assert.match(source, /localStorage\.setItem\(TOKEN_KEY,state\.token\)/u);
  assert.match(source, /await verifySession\(\)/u);
});
