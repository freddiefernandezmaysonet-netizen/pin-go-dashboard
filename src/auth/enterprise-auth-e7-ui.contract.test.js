import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/pages/auth/SignupSuccessPage.tsx", "utf8");

test("E7 signup success understands secure-login completion", () => {
  assert.match(source, /requiresLogin\?: boolean/);
  assert.match(source, /data\.ok && data\.ready && data\.requiresLogin/);
  assert.match(source, /Continue to secure sign in/);
  assert.match(source, /\/login\?signup=complete/);
  assert.match(source, /verification code to your account email/);
});

test("E7 secure-login branch never assumes an authenticated dashboard session", () => {
  const start = source.indexOf("// E7 contract:");
  const end = source.indexOf("attempts += 1", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const secureLoginBranch = source.slice(start, end);
  assert.match(secureLoginBranch, /setReady\(true\)/);
  assert.match(secureLoginBranch, /setLoading\(false\)/);
  assert.doesNotMatch(secureLoginBranch, /refresh\(/);
  assert.doesNotMatch(secureLoginBranch, /fetchProperties\(/);
  assert.doesNotMatch(secureLoginBranch, /navigate\("\/overview"/);
  assert.doesNotMatch(secureLoginBranch, /navigate\("\/onboarding\/property"/);
});

test("E7 dashboard remains backward compatible during coordinated deployment", () => {
  const legacy = source.indexOf("data.ok && data.ready && data.autoLoggedIn");
  const secure = source.indexOf("data.ok && data.ready && data.requiresLogin");

  assert.notEqual(legacy, -1);
  assert.notEqual(secure, -1);
  assert.ok(legacy < secure);
  assert.match(source, /await refresh\(\)/);
  assert.match(source, /await fetchProperties\(\)/);
});

test("E7 signup messaging no longer promises automatic sign-in", () => {
  assert.doesNotMatch(source, /finishing your account setup and signing you in/i);
  assert.doesNotMatch(source, /Redirecting you to the dashboard/i);
  assert.match(source, /finishing your account setup securely/i);
});
