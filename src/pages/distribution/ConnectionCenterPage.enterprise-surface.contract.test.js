import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("./ConnectionCenterPage.tsx", import.meta.url),
  "utf8"
);
const shell = readFileSync(
  new URL("../../app/layout/AppShell.tsx", import.meta.url),
  "utf8"
);
const airbnbClient = readFileSync(
  new URL("../../api/airbnbHostSelfService.ts", import.meta.url),
  "utf8"
);
const callbackPage = readFileSync(
  new URL("./AirbnbConnectionCallbackPage.tsx", import.meta.url),
  "utf8"
);

test("Connection Center uses the established Pin&Go dashboard visual language", () => {
  assert.match(page, /border: "1px solid #e5e7eb"/);
  assert.match(page, /borderRadius: 18/);
  assert.match(page, /background: "#fff"/);
  assert.match(page, /Booking channels/);
  assert.match(page, /Secure connections/);
  assert.match(page, /Back to property/);
});

test("dashboard shell gives distribution its own page title before generic Properties", () => {
  const bookingChannelsIndex = shell.indexOf('return "Booking channels"');
  const propertiesIndex = shell.indexOf('return "Properties"');
  assert.notEqual(bookingChannelsIndex, -1);
  assert.notEqual(propertiesIndex, -1);
  assert.ok(bookingChannelsIndex < propertiesIndex);
  assert.ok(
    shell.includes('if (/^\\/properties\\/[^/]+\\/distribution(?:\\/|$)/.test(pathname)) return "Booking channels";')
  );
});

test("Airbnb linked state is presented as setup in progress, never active", () => {
  assert.match(
    page,
    /channel\.provider === "AIRBNB" && channel\.channelLinked && channel\.status === "NOT_CONNECTED"/
  );
  assert.match(page, /status: "Setup in progress"/);
  assert.match(page, /Property setup and activation are still pending/);
  assert.match(page, /This status does not mean the channel is active/);
});

test("existing Airbnb and Booking.com connection execution remains in place", () => {
  assert.match(page, /await prepareDistributionChannel\(id, provider\)/);
  assert.match(page, /const link = await issueAirbnbHostConnectionLink\(id\)/);
  assert.match(page, /window\.location\.assign\(link\.authorizationUrl\)/);
  assert.match(page, /issueDistributionConnectionSession\(id, provider\)/);
  assert.match(page, /transitionDistributionConnectionSession\(session\.value\.sessionId, "opened"\)/);
  assert.match(page, /transitionDistributionConnectionSession\(current\.value\.sessionId, "cancelled"\)/);
  assert.match(page, /transitionDistributionConnectionSession\(session\.value\.sessionId, "completed"\)/);
});

test("presentation-only redesign does not introduce listing discovery, mapping or activation", () => {
  assert.doesNotMatch(page, /listAirbnb|listListings|\/listings|\/mappings|\/activate|load_future_reservations/);
  assert.doesNotMatch(page, /Listing Discovery|Map listing|Activate channel|Load reservations/);
});

test("Airbnb API client and callback remain outside this presentation delivery", () => {
  assert.doesNotMatch(airbnbClient, /\/channels\/AIRBNB\/listings/);
  assert.match(airbnbClient, /verifyAirbnbHostCallback/);
  assert.match(callbackPage, /verifyAirbnbHostCallback/);
  assert.match(callbackPage, /Volver al Centro de conexiones/);
});
