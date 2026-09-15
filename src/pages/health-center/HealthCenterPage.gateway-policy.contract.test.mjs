import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("./HealthCenterPage.tsx", import.meta.url),
  "utf8"
);
const service = readFileSync(
  new URL("../../services/health.ts", import.meta.url),
  "utf8"
);

test("Health Center understands current gateway monitoring modes", () => {
  for (const mode of ["ENABLED", "DISABLED", "LEGACY_UNCONFIGURED"]) {
    assert.match(page, new RegExp(mode));
    assert.match(service, new RegExp(mode));
  }
});

test("locks without gateway are presented as intentional not monitored state", () => {
  assert.match(page, /Not installed/);
  assert.match(page, /Not monitored/);
  assert.match(page, /notMonitored/);
});

test("legacy locks are surfaced as setup required instead of gateway failure", () => {
  assert.match(page, /Setup required/);
  assert.match(page, /setupRequired/);
});

test("Health Center documents six-hour gateway readiness escalation", () => {
  assert.match(page, /six-hour readiness window/);
});
