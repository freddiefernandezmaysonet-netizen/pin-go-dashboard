import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const locksPage = readFileSync(
  new URL("./LocksPage.tsx", import.meta.url),
  "utf8"
);

const lockDetailPage = readFileSync(
  new URL("../lock-detail/LockDetailPage.tsx", import.meta.url),
  "utf8"
);

test("locks list uses explicit gateway monitoring states", () => {
  assert.match(locksPage, /gatewayMonitoringMode/);
  assert.match(locksPage, /Not installed/);
  assert.match(locksPage, /Setup required/);
  assert.match(locksPage, /Offline/);
  assert.doesNotMatch(locksPage, /return value \? "Connected" : "No gateway"/);
});

test("lock detail can configure gateway installation", () => {
  assert.match(
    lockDetailPage,
    /\/api\/dashboard\/locks\/\$\{encodeURIComponent\(lock\.id\)\}\/gateway-monitoring/
  );
  assert.match(lockDetailPage, /Gateway installed/);
  assert.match(lockDetailPage, /No gateway installed/);
  assert.match(lockDetailPage, /gatewayInstalled/);
});

test("locks without gateways do not present remote telemetry as current", () => {
  assert.match(lockDetailPage, /Not monitored/);
  assert.match(lockDetailPage, /NOT MONITORED/);
  assert.match(
    lockDetailPage,
    /Pin&Go will not spend TTLock calls checking remote battery or gateway connectivity/
  );
});
