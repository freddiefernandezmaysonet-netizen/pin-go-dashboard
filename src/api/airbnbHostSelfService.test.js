import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Literal 200 JSON from the supplied Channex Airbnb guide, lines 123-131.
// example.com is the documentation placeholder, NOT an asserted Airbnb endpoint.
const DOCUMENTED_CONNECTION_LINK = JSON.parse(`{
  "data": {
    "type": "connection_link",
    "attributes": {
      "url": "https://example.com"
    }
  }
}`);

const source = readFileSync(new URL("./airbnbHostSelfService.ts", import.meta.url), "utf8");
// Supply only Vite's build-time environment in this isolated test environment.
// Execute the complete real client/parser, not a copied validation function.
assert.equal(source.split("import.meta.env.VITE_API_BASE").length - 1, 1);
const compiled = ts.transpileModule(
  source.replace("import.meta.env.VITE_API_BASE", '"https://api.example.test"'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true }
);
assert.equal((compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);

function client(payload, { status = 200, invalidJson = false } = {}) {
  const calls = [];
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    URL,
    crypto: { randomUUID: () => "test-only-idempotency-key" },
    async fetch(url, options) {
      calls.push({ url, options });
      return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
          if (invalidJson) throw new Error("test-only invalid JSON");
          return payload;
        },
      };
    },
  }, { filename: "airbnbHostSelfService.test-runtime.js", timeout: 1000 });
  return { api: exports, calls };
}

function backendEnvelope(url = DOCUMENTED_CONNECTION_LINK.data.attributes.url) {
  return { ok: true, authorizationUrl: url, expiresAt: "2026-09-09T07:00:00.000Z" };
}

test("literal Channex authorization URL survives the real dashboard client unchanged", async () => {
  // The backend exposes the documented data.attributes.url through its existing DTO.
  const { api, calls } = client(backendEnvelope());
  const result = await api.issueAirbnbHostConnectionLink("property/1");
  assert.equal(result.authorizationUrl, "https://example.com");
  assert.equal(result.authorizationUrl, DOCUMENTED_CONNECTION_LINK.data.attributes.url);
  assert.equal(result.expiresAt, "2026-09-09T07:00:00.000Z");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/api/dashboard/distribution/properties/property%2F1/channels/AIRBNB/connection-link");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.body, "{}");
  assert.match(calls[0].options.headers["Idempotency-Key"], /^ota\.airbnb\.connection-link:/);
});

// Synthetic preservation probes, not actual Airbnb URLs or provider responses.
for (const [label, url] of [
  ["query order, escaping, duplicate keys and fragment", "https://example.com?token=a%2Fb+c&scope=one%20two&scope=three#resume"],
  ["host case and default port", "https://EXAMPLE.com:443?token=test"],
  ["no undocumented 4096-character cap", `https://example.com?token=${"x".repeat(5000)}`],
]) {
  test(`dashboard synthetic URL preservation: ${label}`, async () => {
    const { api, calls } = client(backendEnvelope(url));
    assert.equal((await api.issueAirbnbHostConnectionLink("property-1")).authorizationUrl, url);
    assert.equal(calls.length, 1);
  });
}

// Mutations of the literal fixture for local browser-navigation security guards.
for (const [label, url] of [
  ["HTTP", "http://example.com"],
  ["javascript", "javascript:alert(1)"],
  ["data", "data:text/html,test"],
  ["file", "file:///tmp/test"],
  ["protocol-relative", "//example.com"],
  ["relative", "/authorize"],
  ["username", "https://owner@example.com"],
  ["password", "https://owner:secret@example.com"],
  ["malformed host", "https://[invalid"],
  ["empty", ""],
  ["null", null],
  ["number", 1],
  ["array", ["https://example.com"]],
  ["object", { url: "https://example.com" }],
]) {
  test(`dashboard synthetic invalid authorization URL is rejected: ${label}`, async () => {
    const { api } = client(backendEnvelope(url));
    await assert.rejects(() => api.issueAirbnbHostConnectionLink("property-1"),
      (error) => error.message === "INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  });
}

for (const [label, payload] of [
  ["null", null], ["array", []], ["missing ok", {}],
  ["ok false", { ...backendEnvelope(), ok: false }],
  ["missing URL", { ok: true, expiresAt: "2026-09-09T07:00:00.000Z" }],
  ["invalid expiry type", { ...backendEnvelope(), expiresAt: null }],
]) {
  test(`dashboard malformed backend envelope is rejected: ${label}`, async () => {
    const { api } = client(payload);
    await assert.rejects(() => api.issueAirbnbHostConnectionLink("property-1"),
      (error) => error.message === "INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  });
}

test("dashboard invalid JSON cannot produce a navigation URL", async () => {
  const { api } = client(null, { invalidJson: true });
  await assert.rejects(() => api.issueAirbnbHostConnectionLink("property-1"),
    (error) => error.message === "INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
});

for (const status of [422, 503]) {
  test(`dashboard propagates a mocked backend ${status} without a retry or invented URL`, async () => {
    const { api, calls } = client({ ok: false, error: "MOCK_BACKEND_ERROR" }, { status });
    await assert.rejects(() => api.issueAirbnbHostConnectionLink("property-1"),
      (error) => error instanceof api.AirbnbHostSelfServiceApiError &&
        error.code === "MOCK_BACKEND_ERROR" && error.status === status);
    assert.equal(calls.length, 1);
  });
}

// Internal Pin&Go DTOs for the documented callback + exact-resource-read phase.
// These fields are NOT represented as fields returned by Channex.
function pendingRead(overrides = {}) {
  return { success: true, propertyId: "property-1", channelId: "716305c4-561a-4561-a187-7f5b8aeb5920",
    channelActive: true, airbnbAccountVerified: false, nextAction: "LISTING_DISCOVERY_REQUIRED", ...overrides };
}
const callbackArgs = { success: "true", channelId: "716305c4-561a-4561-a187-7f5b8aeb5920", token: "test-only-signed-state" };

test("callback client accepts only pending account verification after exact resource read", async () => {
  const result = pendingRead(); const { api, calls } = client({ ok: true, result });
  assert.deepEqual(await api.verifyAirbnbHostCallback(callbackArgs), result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/api/dashboard/distribution/airbnb/callback/verify");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.cache, "no-store");
  assert.deepEqual(JSON.parse(calls[0].options.body), callbackArgs);
});
for (const [label, overrides] of [
  ["premature mapping", { nextAction: "MAPPING_REQUIRED" }],
  ["premature activation", { nextAction: "ACTIVE" }],
  ["claimed account verification", { airbnbAccountVerified: true }],
  ["absent verification marker", { airbnbAccountVerified: undefined }],
  ["missing property", { propertyId: null }],
  ["missing channel", { channelId: null }],
  ["empty channel", { channelId: "" }],
  ["incorrect active type", { channelActive: "true" }],
]) {
  test(`callback parser rejects incompatible phase evidence: ${label}`, async () => {
    const { api } = client({ ok: true, result: pendingRead(overrides) });
    await assert.rejects(() => api.verifyAirbnbHostCallback(callbackArgs), (e) => e.message === "INVALID_AIRBNB_CALLBACK_VERIFICATION_RESPONSE");
  });
}
test("failure DTO cannot infer a property, channel or authorization", async () => {
  const result = { success: false, propertyId: null, channelId: null, channelActive: null,
    airbnbAccountVerified: false, nextAction: "RETRY_AUTHORIZATION" };
  const { api } = client({ ok: true, result });
  assert.deepEqual(await api.verifyAirbnbHostCallback({ success: "false", channelId: null, token: "" }), result);
  for (const changed of [{ propertyId: "property-1" }, { channelId: "channel-1" }, { channelActive: true }, { nextAction: "LISTING_DISCOVERY_REQUIRED" }]) {
    const { api: invalid } = client({ ok: true, result: { ...result, ...changed } });
    await assert.rejects(() => invalid.verifyAirbnbHostCallback(callbackArgs), (e) => e.message === "INVALID_AIRBNB_CALLBACK_VERIFICATION_RESPONSE");
  }
});


const activationState = { status: "READY", reason: null, channelId: "channel-1", mappingId: "mapping-1", listingId: "551126434553599406" };
test("activation inspection is GET-only and preserves the confirmed identity", async () => {
  const { api, calls } = client({ ok: true, activation: activationState });
  const result = await api.inspectAirbnbActivation("property/1");
  assert.equal(result.channelId, activationState.channelId);
  assert.equal(result.mappingId, activationState.mappingId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.credentials, "include");
  assert.match(calls[0].url, /property%2F1\/channels\/AIRBNB\/activation$/);
});

test("activation POST carries explicit host confirmation and exact inspected mapping", async () => {
  const { api, calls } = client({ ok: true, activation: { outcome: "ACTIVATED", channelActive: true, readinessChecked: false } });
  const result = await api.activateAirbnbForHost("property/1", activationState);
  assert.equal(result.channelActive, true);
  assert.equal(result.readinessChecked, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /property%2F1\/channels\/AIRBNB\/activate$/);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    channelId: activationState.channelId, mappingId: activationState.mappingId, listingId: activationState.listingId,
    confirmation: "CONFIRM_AIRBNB_ACTIVATION",
  });
});

test("non-ready activation state cannot issue a POST", async () => {
  for (const status of ["ACTIVE", "NOT_READY", "CHECK_REQUIRED", "unknown"]) {
    const { api, calls } = client({});
    await assert.rejects(() => api.activateAirbnbForHost("property-1", { ...activationState, status }));
    assert.equal(calls.length, 0);
  }
});

test("malformed activation success is rejected without retrying", async () => {
  for (const activation of [null, {}, { outcome: "ACTIVATED", channelActive: false, readinessChecked: true }, { outcome: "ACTIVATED", channelActive: true }]) {
    const { api, calls } = client({ ok: true, activation });
    await assert.rejects(() => api.activateAirbnbForHost("property-1", activationState), /INVALID_AIRBNB_ACTIVATION_RESPONSE/);
    assert.equal(calls.length, 1);
  }
});

test("activation verification POST carries the inspected identity and cannot repeat activation", async () => {
  const checkRequired = { ...activationState, status: "CHECK_REQUIRED" };
  const { api, calls } = client({ ok: true, activation: { outcome: "VERIFIED", channelActive: true, readinessChecked: true } });
  const result = await api.verifyAirbnbActivationForHost("property/1", checkRequired);
  assert.equal(result.channelActive, true);
  assert.equal(result.readinessChecked, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /property%2F1\/channels\/AIRBNB\/activation\/verify$/);
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].options.headers["Idempotency-Key"], /^ota\.airbnb\.activation-verify:/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    channelId: checkRequired.channelId, mappingId: checkRequired.mappingId, listingId: checkRequired.listingId,
    confirmation: "VERIFY_AIRBNB_ACTIVATION",
  });
  assert.doesNotMatch(calls[0].url, /\/channels\/AIRBNB\/activate$/);
});

test("activation verification is available only after CHECK_REQUIRED inspection", async () => {
  for (const status of ["READY", "ACTIVE", "NOT_READY", "unknown"]) {
    const { api, calls } = client({});
    await assert.rejects(() => api.verifyAirbnbActivationForHost("property-1", { ...activationState, status }));
    assert.equal(calls.length, 0);
  }
});

test("malformed activation verification is rejected without another request", async () => {
  const checkRequired = { ...activationState, status: "CHECK_REQUIRED" };
  for (const activation of [null, {}, { outcome: "ACTIVATED", channelActive: true, readinessChecked: true }, { outcome: "VERIFIED", channelActive: false, readinessChecked: true }]) {
    const { api, calls } = client({ ok: true, activation });
    await assert.rejects(() => api.verifyAirbnbActivationForHost("property-1", checkRequired), /INVALID_AIRBNB_ACTIVATION_VERIFICATION_RESPONSE/);
    assert.equal(calls.length, 1);
  }
});

test("activation inspector rejects incomplete identities and unknown status", async () => {
  for (const changed of [{ mappingId: null }, { listingId: "" }, { channelId: "" }, { status: "UNKNOWN" }]) {
    const { api } = client({ ok: true, activation: { ...activationState, ...changed } });
    await assert.rejects(() => api.inspectAirbnbActivation("property-1"), /INVALID_AIRBNB_ACTIVATION_RESPONSE/);
  }
});
