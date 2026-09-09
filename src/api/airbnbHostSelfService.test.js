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
