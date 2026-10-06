import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://dashboard.example.test" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
function module(file, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replaceAll("import.meta.env.VITE_API_BASE", '"https://api.example.test"');
  for (const name of ["react", "react/jsx-runtime", "@tanstack/react-query", ...Object.keys(replacements)]) {
    source = source.replaceAll(JSON.stringify(name), JSON.stringify(replacements[name] ?? import.meta.resolve(name)));
  }
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const api = module("../../api/pinAIActivation.ts", { "../auth/sessionExpiry": module("../../auth/sessionExpiry.ts") });
const { PinAISettingsCard } = await import(module("./PinAISettingsCard.tsx", { "../../api/pinAIActivation": api }));
async function settle(check) {
  for (let n = 0; n < 100; n++) { if (check()) return; await act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
  assert.fail("UI did not settle");
}
async function mount(t, { organizationEnabled = true, saveFails = false, saveError = "PIN_AI_ACTIVATION_CONFLICT" } = {}) {
  let data = { ok: true, propertyId: "property-a", name: "Synthetic", enabled: false, revision: 0,
    billing: { version: "pin-ai-connect-usd-1-reservation-v1", amountCents: 100, currency: "USD", acceptedVersion: null, acceptedAt: null, collectionReady: false },
    organization: { enabled: organizationEnabled, revision: 1 }, state: "DISABLED" };
  const writes = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /\/properties\/property-a\/pin-ai-settings$/);
    assert.equal(init.credentials, "include"); assert.equal(init.cache, "no-store");
    if (init.method === "PUT") {
      const body = JSON.parse(init.body); writes.push(body);
      if (saveFails) return new Response(JSON.stringify({ ok: false, error: saveError }), { status: 409 });
      data = { ...data, enabled: body.enabled, revision: 1, state: "PENDING_ACTIVATION" };
    }
    return new Response(JSON.stringify(data));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(PinAISettingsCard, { propertyId: "property-a" }))));
  await settle(() => container.querySelector('input[type="checkbox"]'));
  const button = text => [...container.querySelectorAll("button")].find(b => b.textContent.includes(text));
  return { container, writes, button, toggle: () => container.querySelector('input[type="checkbox"]') };
}
test("host cannot enable a property before the organization is granted", async t => {
  const h = await mount(t, { organizationEnabled: false });
  assert.equal(h.toggle().disabled, true); assert.equal(h.button("Guardar").disabled, true);
  assert.match(h.container.textContent, /habilitar el servicio para tu organización/);
  assert.equal(h.writes.length, 0);
});
test("saving passes both revisions and distinguishes configured from active", async t => {
  const h = await mount(t);
  await act(async () => h.toggle().click());
  await act(async () => h.container.querySelectorAll('input[type="checkbox"]')[1].click());
  await act(async () => h.button("Guardar").click());
  await settle(() => h.container.textContent.includes("Configuración guardada."));
  assert.deepEqual(h.writes, [{ enabled: true, expectedRevision: 0, organizationRevision: 1, acceptedTermsVersion: "pin-ai-connect-usd-1-reservation-v1" }]);
  assert.match(h.container.textContent, /activación pendiente/);
  assert.match(h.container.textContent, /propia habilitación/);
});
test("a conflicting or uncertain save blocks replay until a fresh read", async t => {
  const h = await mount(t, { saveFails: true });
  await act(async () => h.toggle().click());
  await act(async () => h.container.querySelectorAll('input[type="checkbox"]')[1].click());
  await act(async () => h.button("Guardar").click());
  await settle(() => h.container.querySelector('[role="alert"]'));
  assert.equal(h.button("Guardar").disabled, true);
  assert.equal(h.toggle().disabled, true);
  await act(async () => h.button("Actualizar").click());
  await settle(() => !h.toggle().disabled);
  assert.equal(h.toggle().checked, false); assert.equal(h.writes.length, 1);
});

test("price is disclosed and saving activation requires explicit consent", async t => {
  const h = await mount(t);
  assert.match(h.container.textContent, /USD \$1\.00 por reservación/);
  await act(async () => h.toggle().click());
  assert.equal(h.button("Guardar").disabled, true);
  assert.equal(h.container.querySelectorAll('input[type="checkbox"]')[1].checked, false);
  await act(async () => h.button("Guardar").click());
  assert.equal(h.writes.length, 0);
});

const { PinAIBillingCard } = await import(module("./PinAIBillingCard.tsx", {
  "../../api/pinAIActivation": api,
  "../../auth/useOrg": `data:text/javascript;base64,${Buffer.from('export const useOrg = () => ({orgId: "org-a", user: {id: "host-a"}, isReady: true})').toString("base64")}`,
}));
async function mountBilling(t, fails = false, status = "PENDING_BALANCE") {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /\/pin-ai\/billing$/); assert.equal(init.credentials, "include");
    return new Response(JSON.stringify(fails ? { ok: false } : { ok: true, currency: "USD", serviceReviews: 2,
      totals: [{ status, count: 1, amountCents: 100 }], recent: [{ reservationId: "res-a", reservationNumber: "PG-TEST",
        propertyName: "Synthetic", amountCents: 100, status, recordedAt: "2026-10-06" }] }), { status: fails ? 503 : 200 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(PinAIBillingCard))));
  await settle(() => container.querySelector(fails ? '[role="alert"]' : "tbody tr"));
  return container;
}
for (const [status, label] of Object.entries({ PENDING_CONNECT: "Pendiente de descuento Connect",
  PENDING_BALANCE: "Pendiente de saldo disponible", PAID: "Cobrado", NEEDS_REVIEW: "Requiere revisión",
  PENDING_INVOICE: "Registro anterior · requiere revisión" })) {
  test(`billing presents ${status} without treating pending charges as paid`, async t => {
    const container = await mountBilling(t, false, status);
    assert.equal(container.querySelector("tbody tr td:last-child").textContent, label);
    assert.match(container.querySelector("tbody tr").textContent, /PG-TEST.*USD 1\.00/);
    assert.match(container.textContent, /Hay 2 reservas cuyo cargo requiere revisión/);
  });
}
test("billing read failures show a controlled error and a refresh action", async t => {
  const container = await mountBilling(t, true);
  assert.match(container.querySelector('[role="alert"]').textContent, /No se pudieron cargar/);
  assert.equal(container.querySelector("table"), null);
  assert.match(container.querySelector("button").textContent, /Actualizar cargos/);
});

for (const [code, message] of Object.entries({
  PIN_AI_CONNECT_ACCOUNT_REQUIRED: /Conecta tu cuenta de Stripe/,
  PIN_AI_CONNECT_ACCOUNT_INCOMPATIBLE: /todavía no es compatible/,
  PIN_AI_CONNECT_VERIFICATION_UNAVAILABLE: /No pudimos verificar tu cuenta Stripe/,
})) {
  test(`activation explains ${code} and requires a fresh read before retry`, async t => {
    const h = await mount(t, { saveFails: true, saveError: code });
    await act(async () => h.toggle().click());
    await act(async () => h.container.querySelectorAll('input[type="checkbox"]')[1].click());
    await act(async () => h.button("Guardar").click());
    await settle(() => h.container.querySelector('[role="alert"]'));
    assert.match(h.container.querySelector('[role="alert"]').textContent, message);
    assert.equal(h.button("Guardar").disabled, true);
    assert.equal(h.writes.length, 1);
  });
}
