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

test("Isolation V2 visibility is controlled exclusively by backend organization eligibility", () => {
  assert.doesNotMatch(cardSource, /VITE_STRIPE_CONNECT_ISOLATION_V2_ENABLED/);
  assert.doesNotMatch(cardSource, /VITE_STRIPE_CONNECT_V2_ACCOUNT_CREATION_ENABLED/);
  assert.doesNotMatch(experienceSource, /VITE_STRIPE_CONNECT_ISOLATION_V2_ENABLED/);
  assert.doesNotMatch(experienceSource, /VITE_STRIPE_CONNECT_V2_ACCOUNT_CREATION_ENABLED/);
  assert.match(experienceSource, /getStripeConnectV2Eligibility/);
  assert.match(experienceSource, /eligibility\?\.eligible/);
  assert.match(experienceSource, /return <HostPayoutsCard \/>/);
});

test("Isolation V2 account creation permission comes from backend eligibility", () => {
  assert.match(experienceSource, /accountCreationAllowed=/);
  assert.match(experienceSource, /eligibility\.accountCreationAllowed/);
  assert.match(cardSource, /accountCreationAllowed: boolean/);
  assert.match(cardSource, /if \(!accountCreationAllowed\) return/);
  assert.match(cardSource, /accountCreationAllowed \?/);
});

test("Isolation V2 fails closed to legacy payouts when eligibility request fails", () => {
  assert.match(experienceSource, /eligible: false/);
  assert.match(experienceSource, /accountCreationAllowed: false/);
  assert.match(experienceSource, /return <HostPayoutsCard \/>/);
});

test("Isolation V2 account endpoints never accept an account id from the browser", () => {
  assert.match(
    apiSource,
    /\/api\/dashboard\/payouts\/connect-isolation-v2\/eligibility/
  );
  assert.match(
    apiSource,
    /\/api\/dashboard\/payouts\/connect-isolation-v2\/account"/
  );
  assert.match(
    apiSource,
    /\/api\/dashboard\/payouts\/connect-isolation-v2\/account-session/
  );
  assert.doesNotMatch(
    apiSource,
    /connect-isolation-v2\/account(?:-session)?[\s\S]{0,300}(accountId|stripeConnectAccountId)\s*:/
  );
});

test("Isolation V2 embedded experience never falls back to Express Dashboard login links", () => {
  assert.doesNotMatch(cardSource, /createHostPayoutDashboardLoginLink/);
  assert.doesNotMatch(cardSource, /login-link/);
  assert.doesNotMatch(cardSource, /window\.location/);
  assert.doesNotMatch(cardSource, /express\.stripe\.com/);
  assert.match(cardSource, /No external Stripe\s+Dashboard link is used as a fallback/);
});

test("Isolation V2 mounts the required no-dashboard embedded components", () => {
  assert.match(cardSource, /"account-onboarding"/);
  assert.match(cardSource, /"account-management"/);
  assert.match(cardSource, /"notification-banner"/);
  assert.match(cardSource, /"documents"/);
  assert.match(cardSource, /"payments"/);
  assert.match(cardSource, /"payouts"/);
  assert.match(cardSource, /VITE_STRIPE_PUBLISHABLE_KEY/);
  assert.match(cardSource, /fetchClientSecret/);
});

test("organization route uses the gated payout experience", () => {
  assert.match(routerSource, /HostPayoutsExperience/);
  assert.match(routerSource, /<HostPayoutsExperience \/>/);
  assert.doesNotMatch(routerSource, /<HostPayoutsCard \/>/);
});
