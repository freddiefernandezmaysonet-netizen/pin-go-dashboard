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
  }).outputText.replaceAll("import.meta.env.VITE_API_BASE_URL", '"https://api.example.test"').replaceAll("import.meta.env.VITE_API_BASE", '"https://api.example.test"');
  for (const name of ["react", "react/jsx-runtime", "@tanstack/react-query", ...Object.keys(replacements)]) {
    source = source.replaceAll(JSON.stringify(name), JSON.stringify(replacements[name] ?? import.meta.resolve(name)));
  }
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const api = module("../../api/guestAccessSettings.ts");
const { GuestAccessSettingsCard } = await import(module("./GuestAccessSettingsCard.tsx", { "../../api/guestAccessSettings": api }));
async function settle(check) {
  for (let n = 0; n < 100; n++) { if (check()) return; await act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
  assert.fail("UI did not settle");
}
async function mount(t, { accepted = false, saveFails = false } = {}) {
  const writes = [];
  const settings = { propertyId: "property-a", propertyName: "Synthetic", maxGuests: 4,
    guestAccessMode: "PASSCODE_ONLY", cleaningNfcEnabled: false, configured: true,
    identityBilling: { version: "identity-check-direct-booking-usd-250-v1", amountCents: 250, currency: "USD",
      collectionMethod: "DIRECT_BOOKING_APPLICATION_FEE", reservationScope: "DIRECT_BOOKING", accepted, acceptedAt: null },
    activeAgreement: { version: "v-current", titleEn: "Guest agreement", titleEs: "Acuerdo",
      guestFacingSummaryEn: "Summary", guestFacingSummaryEs: "Resumen", agreementTextEn: "Agreement content",
      agreementTextEs: "Contenido del acuerdo", rulesEn: ["Rule"], rulesEs: ["Regla"],
      requiresIdentityVerification: true } };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /properties\/property-a\/guest-access-settings$/);
    assert.equal(init.credentials, "include"); assert.equal(init.cache, "no-store");
    if (init.method === "PUT") {
      writes.push(JSON.parse(init.body));
      if (saveFails) return new Response(JSON.stringify({ error: "GUEST_ACCESS_SETTINGS_CONFLICT" }),
        { status: 409, headers: { "Content-Type": "application/json" } });
      settings.identityBilling.accepted = true;
    }
    return new Response(JSON.stringify({ ok: true, settings, newVersionCreated: false }));
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(GuestAccessSettingsCard, { propertyId: "property-a" })));
  await settle(() => container.textContent.includes("USD $2.50"));
  const button = text => [...container.querySelectorAll("button")].find(b => b.textContent.includes(text));
  const consent = () => [...container.querySelectorAll("label")].find(l => l.textContent.includes("Autorizo a Pin&Go"))?.querySelector("input");
  return { container, writes, button, consent };
}
test("legacy enabled Identity Check has no inferred host consent", async t => {
  const h = await mount(t);
  assert.equal(h.consent().checked, false);
  assert.equal(h.button("Save Secure").disabled, true);
  await act(async () => h.button("Save Secure").click());
  assert.equal(h.writes.length, 0);
});
test("explicit host acceptance sends exact server terms and agreement revision", async t => {
  const h = await mount(t);
  await act(async () => h.consent().click());
  await act(async () => h.button("Save Secure").click());
  await settle(() => h.container.textContent.includes("Autorización de cobro registrada"));
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].acceptedIdentityBillingTermsVersion, "identity-check-direct-booking-usd-250-v1");
  assert.equal(h.writes[0].expectedAgreementVersion, "v-current");
});
test("disabling does not require or send a billing authorization", async t => {
  const h = await mount(t);
  await act(async () => h.container.querySelector('input[type="checkbox"]').click());
  assert.equal(h.consent(), undefined);
  await act(async () => h.button("Save Secure").click());
  await settle(() => h.writes.length === 1);
  assert.equal(h.writes[0].requiresIdentityVerification, false);
  assert.equal(h.writes[0].acceptedIdentityBillingTermsVersion, undefined);
});
test("uncertain save cannot replay until a fresh read and new explicit consent", async t => {
  const h = await mount(t, { saveFails: true });
  await act(async () => h.consent().click());
  await act(async () => h.button("Save Secure").click());
  await settle(() => h.container.textContent.includes("No se pudo confirmar el cambio"));
  assert.equal(h.button("Save Secure").disabled, true);
  await act(async () => h.button("Actualizar estado").click());
  await settle(() => !h.consent().disabled);
  assert.equal(h.consent().checked, false);
  assert.equal(h.writes.length, 1);
});
test("valid persisted authorization is shown and does not ask for repeated acceptance", async t => {
  const h = await mount(t, { accepted: true });
  assert.equal(h.consent(), undefined);
  assert.equal(h.button("Save Secure").disabled, false);
});
