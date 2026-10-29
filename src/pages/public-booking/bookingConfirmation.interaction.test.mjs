import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/booking/success" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(file, replacements = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8").replace(/^import "\.\/.*\.css";$/gm, "");
  let output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText.replaceAll("import.meta.env.VITE_API_BASE_URL", "undefined").replaceAll("import.meta.env.VITE_API_BASE", "undefined");
  for (const specifier of ["react", "react/jsx-runtime", "react-router-dom", ...Object.keys(replacements)]) {
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const hookUrl = compile("./useCheckoutConfirmation.ts");
const { useCheckoutConfirmation } = await import(hookUrl);
const { default: Page } = await import(compile("./PublicBookingSuccessPage.tsx", {
  "./useCheckoutConfirmation": hookUrl,
  "./GuestStayGuide": compile("./GuestStayGuide.tsx"),
  "../../lib/publicDocumentMetadata": "data:text/javascript,export function usePublicNoIndex(){}",
}));
async function mount(t, element) {
  const container = document.createElement("div"); const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); });
  await act(async () => root.render(element));
  return { container, render: value => act(async () => root.render(value)) };
}
const reply = body => ({ ok: true, json: async () => body });

test("a success URL without a checkout reference cannot claim payment or advertise Pin AI", async t => {
  window.history.replaceState(null, "", "/booking/success?pinAI=true&organization=org");
  t.mock.method(globalThis, "fetch", () => assert.fail("No checkout reference must not trigger requests"));
  const { container } = await mount(t, createElement(MemoryRouter, null, createElement(Page)));
  assert.ok(container.textContent.includes("We could not confirm your reservation yet."));
  assert.equal(container.textContent.includes("PAYMENT RECEIVED"), false);
  assert.equal(container.textContent.includes("Your stay is confirmed."), false);
  assert.equal(container.textContent.includes("PIN AI"), false);
});

for (const language of ["en", "es"]) test(`delayed webhook: only confirmed server state unlocks the next steps (${language})`, async t => {
  window.localStorage.setItem("pingo_guest_preferred_language", language);
  window.history.replaceState(null, "", "/booking/success?session_id=cs_test_synthetic_123456&identityCheck=required&pinAI=true");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.cache, "no-store"); assert.equal(options.method, undefined);
    return reply(++calls === 1 ? { ok: true, status: "PENDING" } : {
      ok: true, status: "CONFIRMED", organizationSlug: "org", identityVerificationRequired: false, pinAIEnabled: false,
    });
  });
  const { container } = await mount(t, createElement(MemoryRouter, null, createElement(Page)));
  assert.equal(container.querySelector(".pbe-success-journey"), null);
  assert.equal(container.textContent.includes("PIN AI"), false);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 2100)); });
  assert.ok(container.textContent.includes(language === "es" ? "Tu estadía está confirmada." : "Your stay is confirmed."));
  assert.ok(container.querySelector(".pbe-success-journey"));
  assert.equal(container.textContent.includes("Identity Check"), false);
  assert.equal(container.textContent.includes("PIN AI"), false);
  assert.equal(calls, 2);
});

test("confirmed active property shows Pin AI; unavailable state does not claim a paid stay", async t => {
  window.localStorage.setItem("pingo_guest_preferred_language", "en");
  window.history.replaceState(null, "", "/booking/success?session_id=cs_test_synthetic_123456");
  t.mock.method(globalThis, "fetch", async () => reply({ ok: true, status: "CONFIRMED", pinAIEnabled: true }));
  const { container, render } = await mount(t, createElement(MemoryRouter, null, createElement(Page)));
  assert.ok(container.textContent.includes("PIN AI"));
  window.history.replaceState(null, "", "/booking/success?session_id=cs_test_second_session_123");
  globalThis.fetch = async () => reply({ ok: true, status: "UNAVAILABLE" });
  await render(createElement(MemoryRouter, null, createElement(Page)));
  assert.ok(container.textContent.includes("This reservation is unavailable."));
  assert.equal(container.textContent.includes("PAYMENT RECEIVED"), false);
  assert.equal(container.textContent.includes("PIN AI"), false);
});

test("pending polling is bounded; failed status and stale responses never confirm a different checkout", async t => {
  let state;
  function Harness({ sessionId }) { state = useCheckoutConfirmation({ apiBase: "https://api.example.test", sessionId, pollIntervalMs: 1, maxAttempts: 2 }); return createElement("p", null, state.status); }
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return reply({ ok: true, status: "PENDING" }); });
  const { render } = await mount(t, createElement(Harness, { sessionId: "cs_test_synthetic_123456" }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.equal(state.status, "UNVERIFIED"); assert.equal(calls, 2);
  let resolveOld; let oldSignal;
  globalThis.fetch = (_url, options) => { oldSignal = options.signal; return new Promise(resolve => { resolveOld = resolve; }); };
  await render(createElement(Harness, { sessionId: "cs_test_old_session_1234" }));
  globalThis.fetch = async () => { throw new Error("offline"); };
  await render(createElement(Harness, { sessionId: "cs_test_new_session_1234" }));
  assert.equal(oldSignal.aborted, true);
  await act(async () => resolveOld(reply({ ok: true, status: "CONFIRMED", pinAIEnabled: true })));
  assert.equal(state.status, "UNVERIFIED");
});
