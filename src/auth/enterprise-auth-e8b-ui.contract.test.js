import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authApi = fs.readFileSync(new URL("../api/auth.ts", import.meta.url), "utf8");
const apiClient = fs.readFileSync(new URL("../api/client.ts", import.meta.url), "utf8");
const authProvider = fs.readFileSync(new URL("./AuthProvider.tsx", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../pages/LoginPage.tsx", import.meta.url), "utf8");
const sessionExpiry = fs.readFileSync(new URL("./sessionExpiry.ts", import.meta.url), "utf8");

test("E8B UI maps server session errors to explicit login reasons", () => {
  assert.match(sessionExpiry, /SESSION_EXPIRED/);
  assert.match(sessionExpiry, /session_expired/);
  assert.match(sessionExpiry, /SESSION_REAUTH_REQUIRED/);
  assert.match(sessionExpiry, /reauth_required/);
});

test("E8B dashboard sends activity only through the dedicated endpoint", () => {
  assert.match(authApi, /export async function signalSessionActivity/);
  assert.match(authApi, /\/auth\/session\/activity/);
  assert.match(authApi, /res\.status === 404/);
  assert.match(authProvider, /signalSessionActivity/);
  assert.match(authProvider, /SESSION_ACTIVITY_SIGNAL_INTERVAL_MS/);
});

test("E8B activity is event-driven and never kept alive by a timer", () => {
  assert.match(authProvider, /pointerdown/);
  assert.match(authProvider, /touchstart/);
  assert.match(authProvider, /keydown/);
  assert.match(authProvider, /visibilitychange/);
  assert.doesNotMatch(authProvider, /setInterval/);
});

test("E8B shared API client preserves session-expiry reason", () => {
  assert.match(apiClient, /loginPathForSessionError/);
  assert.match(apiClient, /res\.clone\(\)\.json/);
  assert.match(apiClient, /window\.location\.href/);
});

test("E8B login explains expiration and security reauthentication bilingually", () => {
  assert.match(loginPage, /sessionNoticeFromSearch/);
  assert.match(loginPage, /role="status"/);
  assert.match(sessionExpiry, /Tu sesión expiró por seguridad/);
  assert.match(sessionExpiry, /Your session expired for security/);
  assert.match(sessionExpiry, /Actualizamos la seguridad de tu sesión/);
  assert.match(sessionExpiry, /We updated your session security/);
});

test("E8B UI preserves the certified MFA flow", () => {
  assert.match(loginPage, /verifyLoginMfa/);
  assert.match(loginPage, /resendLoginMfa/);
  assert.match(loginPage, /Trust this device for 30 days/);
  assert.match(authApi, /\/auth\/mfa\/verify/);
  assert.match(authApi, /\/auth\/mfa\/resend/);
});
