import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("./distribution.ts", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../pages/distribution/ConnectionCenterPage.tsx", import.meta.url),
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
    /channel\.provider === "AIRBNB" && channel\.channelLinked && channel\.status === "NOT_CONNECTED"/
  );
  assert.match(page, /status: "Setup in progress"/);
  assert.match(page, /Airbnb is linked to this property/);
  assert.match(page, /Additional setup is required before the channel becomes active/);
  assert.doesNotMatch(page, /Airbnb account connected successfully/);
  assert.doesNotMatch(page, /Airbnb is active/);
  assert.doesNotMatch(page, /will continue the Airbnb setup/);
});

test("linked Airbnb suppresses a second connect action without affecting Booking.com", () => {
  assert.match(page, /SELF_SERVICE\.has\(channel\.provider\) && !airbnbLinked/);
  assert.match(page, /channel\.provider === "AIRBNB" \? "Connect Airbnb" : `Connect \$\{channel\.name\}`/);
});

test("presentation patch does not add mapping activation or provider execution controls", () => {
  assert.doesNotMatch(page, /\/mappings|\/activate|load_future_reservations/);
  assert.doesNotMatch(page, /Map listing|Activate channel|Load reservations/);
});

test("previous callback-presentation branch deployment veto remains present", () => {
  assert.equal(
    vercel.git?.deploymentEnabled?.["agent/airbnb-callback-persistence-presentation"],
    false
  );
});
