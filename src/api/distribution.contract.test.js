import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./distribution.ts", import.meta.url), "utf8");
const propertyEditor = readFileSync(
  new URL("../pages/properties/PropertyEditPage.tsx", import.meta.url),
  "utf8"
);
const router = readFileSync(
  new URL("../app/routes/router.tsx", import.meta.url),
  "utf8"
);

test("Connection Center client is property-scoped and credentialed", () => {
  assert.match(
    source,
    /\/api\/dashboard\/distribution\/properties\/\$\{encodeURIComponent\(propertyId\)\}/
  );
  assert.match(source, /credentials:\s*"include"/);
  assert.match(source, /cache:\s*"no-store"/);
});

test("Connection Center client uses Pin&Go white-label contract", () => {
  assert.match(source, /Distribution by Pin&Go/);
  assert.doesNotMatch(source.toLowerCase(), /channex/);
});

test("Connection Center parser rejects unknown lifecycle values", () => {
  for (const catalog of [
    "DISTRIBUTION_PROVIDERS",
    "DISTRIBUTION_CHANNEL_STATUSES",
    "DISTRIBUTION_READINESS_STATUSES",
    "DISTRIBUTION_NEXT_ACTIONS",
  ]) {
    assert.match(source, new RegExp(`isMember\\(${catalog}`));
  }
  assert.match(source, /INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE/);
});

test("legacy property controls cannot bypass the commercial lifecycle", () => {
  assert.doesNotMatch(propertyEditor, /\/distribution\/enable/);
  assert.doesNotMatch(propertyEditor, /\/channex\/(?:provision|sync-availability)/i);
  assert.doesNotMatch(propertyEditor, /distributionEnabled:\s*form\.distributionEnabled/);
  assert.doesNotMatch(router, /ChannexFullSyncPanel/);
});
