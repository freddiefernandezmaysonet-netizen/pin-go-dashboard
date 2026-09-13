import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("./distribution.ts", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../pages/distribution/ConnectionCenterPage.tsx", import.meta.url),
  "utf8"
);
const activationPanel = readFileSync(
  new URL("../pages/distribution/AirbnbActivationPanel.tsx", import.meta.url),
  "utf8"
);
const airbnbClient = readFileSync(
  new URL("./airbnbHostSelfService.ts", import.meta.url),
  "utf8"
);
const vercel = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")
);

test("Connection Center contract requires channelLinked boolean", () => {
  assert.match(api, /channelLinked:\s*boolean/);
  assert.match(api, /typeof channel\.channelLinked !== "boolean"/);
});

test("Airbnb linked presentation is explicit and does not promote lifecycle status", () => {
  assert.match(
    page,
    /channel\.provider === "AIRBNB" &&\s*channel\.channelLinked &&\s*AIRBNB_LISTING_DISCOVERY_STATUSES\.has\(channel\.status\)/
  );
  assert.match(page, /status: airbnbSetupLinked \? "Setup in progress" : statusLabel\(channel\.status\)/);
  assert.match(page, /Airbnb is linked to this property/);
  assert.match(page, /Additional setup is required before the channel becomes active/);
  assert.doesNotMatch(page, /Airbnb account connected successfully/);
  assert.doesNotMatch(page, /Airbnb is active/);
  assert.doesNotMatch(page, /will continue the Airbnb setup/);
  assert.match(page, /channel\.provider === "AIRBNB" && channel\.channelLinked && channel\.status !== "ACTIVE"/);
  assert.match(page, /Pin&Go is verifying activation and commercial readiness/);
  assert.match(page, /Pin&Go is checking the remaining setup requirements/);
});

test("linked Airbnb suppresses a second connect action without affecting Booking.com", () => {
  assert.match(page, /SELF_SERVICE\.has\(channel\.provider\) && !airbnbChannelLinked/);
  assert.match(page, /channel\.provider === "AIRBNB" \? "Connect Airbnb" : `Connect \$\{channel\.name\}`/);
});

test("host activation remains property-scoped behind the Pin&Go API", () => {
  assert.match(page, /<AirbnbActivationPanel/);
  assert.doesNotMatch(page, /\/mappings|\/activate|load_future_reservations/);
  assert.match(activationPanel, /Activate Airbnb/);
  assert.match(activationPanel, /inspectAirbnbActivation/);
  assert.match(activationPanel, /activateAirbnbForHost/);
  assert.match(activationPanel, /verifyAirbnbActivationForHost/);
  assert.match(airbnbClient, /properties\/\$\{encodeURIComponent\(propertyId\)\}\/channels\/AIRBNB\/activate/);
  assert.match(airbnbClient, /CONFIRM_AIRBNB_ACTIVATION/);
  assert.match(airbnbClient, /channels\/AIRBNB\/activation\/verify/);
  assert.match(airbnbClient, /VERIFY_AIRBNB_ACTIVATION/);
  assert.doesNotMatch(activationPanel, /app\.channex\.io|staging\.channex\.io|user-api-key/);
});

test("previous callback-presentation branch deployment veto remains present", () => {
  assert.equal(
    vercel.git?.deploymentEnabled?.["agent/airbnb-callback-persistence-presentation"],
    false
  );
});
