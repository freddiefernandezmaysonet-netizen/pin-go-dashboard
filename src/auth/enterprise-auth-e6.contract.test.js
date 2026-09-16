import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiAuth = fs.readFileSync(new URL("../api/auth.ts", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../pages/LoginPage.tsx", import.meta.url), "utf8");

test("auth API models the MFA-required login response", () => {
  assert.match(apiAuth, /export type LoginMfaRequired/);
  assert.match(apiAuth, /mfaRequired: true/);
  assert.match(apiAuth, /challengeToken: string/);
  assert.match(apiAuth, /resendAfterSeconds: number/);
});

test("dashboard exposes verify and resend APIs with credentials", () => {
  assert.match(apiAuth, /export async function verifyLoginMfa/);
  assert.match(apiAuth, /\/auth\/mfa\/verify/);
  assert.match(apiAuth, /export async function resendLoginMfa/);
  assert.match(apiAuth, /\/auth\/mfa\/resend/);
  assert.match(apiAuth, /credentials: "include"/);
});

test("login page does not refresh session before MFA completes", () => {
  const mfaBranch = loginPage.indexOf('if ("mfaRequired" in result && result.mfaRequired)');
  const finishSignIn = loginPage.indexOf("await finishSignIn();", mfaBranch);
  assert.ok(mfaBranch >= 0);
  assert.ok(finishSignIn > mfaBranch);
  assert.match(loginPage, /setMfa\(result\)/);
  assert.match(loginPage, /return;/);
});

test("OTP UI uses six digits and explicit trusted-device opt in", () => {
  assert.match(loginPage, /maxLength=\{6\}/);
  assert.match(loginPage, /autoComplete="one-time-code"/);
  assert.match(loginPage, /Trust this device for 30 days/);
  assert.match(loginPage, /checked=\{trustDevice\}/);
  assert.match(loginPage, /useState\(false\)/);
});

test("OTP UI exposes expiry and resend cooldown", () => {
  assert.match(loginPage, /Code expires in \{expiryLabel\}/);
  assert.match(loginPage, /resendRemaining > 0/);
  assert.match(loginPage, /Resend code \/ Reenviar código/);
});
