import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("./distributionFullSync.ts", import.meta.url), "utf8");
const control = readFileSync(
  new URL("../components/distribution/ConnectionCenterFullSyncControl.tsx", import.meta.url),
  "utf8"
);
const router = readFileSync(new URL("../app/routes/router.tsx", import.meta.url), "utf8");
const propertyDetail = readFileSync(
  new URL("../pages/property-detail/PropertyDetailPage.tsx", import.meta.url),
  "utf8"
);

test("certified Full Sync is mounted only on the OTA Connection Center route", () => {
  assert.match(router, /import \{ ConnectionCenterFullSyncControl \}/);
  assert.match(router, /function ConnectionCenterRoute\(\)/);
  assert.match(router, /<ConnectionCenterPage\s*\/>/);
  assert.match(router, /<ConnectionCenterFullSyncControl\s*\/>/);
  assert.match(
    router,
    /path: "\/properties\/:id\/distribution", element: <ConnectionCenterRoute \/>/
  );
  assert.doesNotMatch(router, /ChannexFullSyncPanel/);
  assert.doesNotMatch(propertyDetail, /ChannexFullSyncPanel|sync-availability/i);
});

test("Full Sync reuses the certified authenticated backend endpoint", () => {
  assert.match(
    api,
    /\/api\/dashboard\/properties\/\$\{encodeURIComponent\(id\)\}\/channex\/sync-availability/
  );
  assert.match(api, /method:\s*"POST"/);
  assert.match(api, /credentials:\s*"include"/);
  assert.match(api, /cache:\s*"no-store"/);
  assert.match(api, /AVAILABILITY/);
  assert.match(api, /RATES_RESTRICTIONS/);
  assert.doesNotMatch(
    api,
    /channels\/.*(?:mapping|activate)|\/mappings|\/activate|load_future_reservations/i
  );
});

test("Full Sync remains gated by the certified distribution runtime state", () => {
  assert.match(
    api,
    /\/api\/dashboard\/properties\/\$\{encodeURIComponent\(id\)\}/
  );
  assert.match(api, /distributionEnabled/);
  assert.match(api, /distributionStatus/);
  assert.match(control, /center\?\.provisioningStatus === "READY"/);
  assert.match(control, /runtimeState\?\.distributionEnabled === true/);
  assert.match(control, /distributionStatus\.toUpperCase\(\) === "ACTIVE"/);
  assert.match(control, /disabled=\{!canRequest\}/);
});

test("Full Sync surface is explicit, white-label, and separate from OTA activation", () => {
  assert.match(control, /Availability & rates sync/);
  assert.match(control, /Distribution by Pin&Go/);
  assert.match(control, /does not map or activate any OTA channel/);
  assert.match(control, /Sync availability & rates/);
  assert.match(control, /Full Sync queued successfully/);
  assert.doesNotMatch(control, /mappingTransport|confirmAirbnbHostMapping|issueAirbnbHostConnectionLink/);
});

test("simulation cannot submit a Full Sync", () => {
  assert.match(control, /searchParams\.get\("simulation"\) === "1"/);
  assert.match(control, /const canRequest = Boolean\(id && isAdmin && !simulated/);
  assert.match(control, /Safe simulation: no Full Sync request will be sent/);
  assert.doesNotMatch(control, /localStorage|sessionStorage/);
});
