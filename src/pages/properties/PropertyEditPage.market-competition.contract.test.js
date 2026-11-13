import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./PropertyEditPage.tsx", import.meta.url),
  "utf8"
);

test("Market Competition configuration uses the dedicated dashboard contract", () => {
  assert.match(
    source,
    /\/api\/dashboard\/properties\/\$\{id\}\/market-pricing/
  );
  assert.match(source, /method: "PUT"/);
  assert.match(source, /Pricing Goal/);
  assert.match(source, /Market Position/);
  assert.match(source, /Adjustment Style/);
  assert.match(source, /Advanced settings/);
});

test("Market Competition remains fail-closed while the data provider is pending", () => {
  assert.match(
    source,
    /enabled: marketPricing\.providerAssigned\s*\? marketPricing\.enabled\s*:\s*false/
  );
  assert.match(source, /Configured · Data provider pending/);
  assert.match(
    source,
    /Market Competition will remain\s*off until Pin&Go has a competitive-data provider assigned/
  );
});

test("Market Competition does not replace the existing property save path", () => {
  assert.equal(
    source.includes('fetch(`${API_BASE}/api/dashboard/properties/${id}`, {'),
    true
  );
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /Save Market Competition/);
});
