import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiSource = readFileSync("src/api/payouts.ts", "utf8");
const cardSource = readFileSync(
  "src/components/payouts/StripeConnectIsolationV2Card.tsx",
  "utf8"
);
const experienceSource = readFileSync(
  "src/components/payouts/HostPayoutsExperience.tsx",
  "utf8"
);
const routerSource = readFileSync("src/app/routes/router.tsx", "utf8");

test("Isolation V2 UI is default-off and explicitly gated", () => {
  assert.match(cardSource, /VITE_STRIPE_CONNECT_ISOLATION_V2_ENABLED/);
  assert.match(cardSource, /toLowerCase\(\) === "true"/);
  assert.match(experienceSource, /stripeConnectIsolationV2UiEnabled\(\)/);
  assert.match(experienceSource, /return <HostPayoutsCard \/>/);
});

test("Isolation V2 requests the account session without accepting an account id from the browser", () => {
  assert.match(
    apiSource,
    /\/api\/dashboard\/payouts\/connect-isolation-v2\/account-session/
  );
  assert.doesNotMatch(
    apiSource,
    /connect-isolation-v2\/account-session[\s\S]{0,300}(accountId|stripeConnectAccountId)\s*:/
  );
});

test("Isolation V2 embedded experience never falls back to Express Dashboard login links", () => {
  assert.doesNotMatch(cardSource, /createHostPayoutDashboardLoginLink/);
  assert.doesNotMatch(cardSource, /login-link/);
  assert.doesNotMatch(cardSource, /window\.location/);
  assert.doesNotMatch(cardSource, /express\.stripe\.com/);
  assert.match(cardSource, /No external Stripe Dashboard link is\s+used as a fallback/);
});

test("Isolation V2 mounts only the account-scoped payments embedded component in this phase", () => {
  assert.match(cardSource, /instance\.create\("payments"\)/);
  assert.doesNotMatch(cardSource, /instance\.create\("payouts"\)/);
  assert.match(cardSource, /VITE_STRIPE_PUBLISHABLE_KEY/);
  assert.match(cardSource, /fetchClientSecret/);
});

test("organization route uses the gated payout experience", () => {
  assert.match(routerSource, /HostPayoutsExperience/);
  assert.match(routerSource, /<HostPayoutsExperience \/>/);
  assert.doesNotMatch(routerSource, /<HostPayoutsCard \/>/);
});
