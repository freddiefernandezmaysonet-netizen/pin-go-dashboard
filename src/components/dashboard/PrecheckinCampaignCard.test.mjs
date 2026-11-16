import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
let source = ts.transpileModule(readFileSync(new URL("./PrecheckinCampaignCard.tsx", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll("import.meta.env.VITE_API_BASE", '"https://api.example.test"');
for (const name of ["react", "react/jsx-runtime"]) source = source.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
const { PrecheckinCampaignCard } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const empty = { from: "2026-10-17T16:00:00Z", to: "2026-11-16T16:00:00Z", bookings: 0, cancelled: 0, currencies: [] };
async function mount(t, response) {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/dashboard/metrics/precheckin-campaign");
    assert.equal(options.credentials, "include");
    return { ok: response !== null, json: async () => response };
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(PrecheckinCampaignCard)));
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  return container;
}
test("zero campaign bookings use an explicit empty state", async t => {
  const element = await mount(t, empty);
  const toggle = element.querySelector("button");
  assert.equal(toggle.textContent.trim(), "View details");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(element.querySelector("#precheckin-campaign-details"), null);
  await act(async () => toggle.click());
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.match(element.textContent, /No paid reservations have been attributed/);
  assert.equal(element.querySelector("table"), null);
  await act(async () => toggle.click());
  assert.equal(element.querySelector("#precheckin-campaign-details"), null);
});
test("currencies and refunds render separately", async t => {
  const element = await mount(t, { ...empty, bookings: 3, cancelled: 1, currencies: [
    { currency: "USD", bookings: 2, cancelled: 1, collected: "120.10", refunded: "20.10", retained: "100.00" },
    { currency: "EUR", bookings: 1, cancelled: 0, collected: "80.00", refunded: "0.00", retained: "80.00" },
  ] });
  await act(async () => element.querySelector("button").click());
  assert.equal(element.querySelectorAll("tbody tr").length, 2);
  assert.match(element.textContent, /USD/); assert.match(element.textContent, /EUR/);
  assert.match(element.textContent, /100\.00/); assert.match(element.textContent, /before fees and host payouts/);
});
test("API failure is not presented as zero bookings and can be refreshed", async t => {
  const element = await mount(t, null);
  assert.ok(element.querySelector('[role="alert"]'));
  assert.doesNotMatch(element.textContent, /No paid reservations/);
  await act(async () => element.querySelector("button").click());
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => empty }));
  await act(async () => [...element.querySelectorAll("button")].find(button => button.textContent === "Refresh").click());
  assert.equal(element.querySelector('[role="alert"]'), null);
  assert.match(element.textContent, /No paid reservations/);
});
