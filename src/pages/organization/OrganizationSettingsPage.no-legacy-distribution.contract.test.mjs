import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("./OrganizationSettingsPage.tsx", import.meta.url),
  "utf8"
);
const api = await readFile(
  new URL("../../api/organization.ts", import.meta.url),
  "utf8"
);

test("organization settings no longer shows legacy channel distribution", () => {
  assert.doesNotMatch(page, /Channel Distribution/);
  assert.doesNotMatch(page, /Validate Connection/);
  assert.doesNotMatch(page, /getChannelDistributionStatus/);
  assert.doesNotMatch(page, /getVisibleChannelLabel/);
});

test("organization api no longer calls legacy distribution endpoint", () => {
  assert.doesNotMatch(api, /channel-distribution/);
  assert.doesNotMatch(api, /ChannelDistributionStatus/);
  assert.doesNotMatch(api, /getChannelDistributionStatus/);
});

test("organization identity and Direct Booking remain intact", () => {
  assert.match(page, /Organization Identity/);
  assert.match(page, /Direct Booking Catalog/);
  assert.match(page, /URL Structure/);
  assert.match(api, /getDashboardOrganization/);
  assert.match(api, /updateDashboardOrganization/);
});
