import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://dashboard.example.test", pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event; globalThis.HTMLInputElement = dom.window.HTMLInputElement;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
function module(file, replacements = {}) {
  let output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replaceAll("import.meta.env.VITE_API_BASE", '"https://api.example.test"');
  for (const specifier of ["react", "react/jsx-runtime", ...Object.keys(replacements)]) {
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const api = module("../../api/stayTimeSettings.ts", { "../auth/sessionExpiry": module("../../auth/sessionExpiry.ts") });
const formModule = module("./stayTimeSettingsForm.ts");
const { formToSettings, settingsToForm } = await import(formModule);
const { StayTimeSettingsCard } = await import(module("./StayTimeSettingsCard.tsx", {
  "../../api/stayTimeSettings": api, "./stayTimeSettingsForm": formModule,
}));
function fixture(propertyId = "property-a") {
  return { ok: true, propertyId, revision: 0, timezone: "America/Puerto_Rico", checkInTime: "15:00", checkOutTime: "11:00",
    currency: "USD", executionAvailable: false, settings: {
      earlyCheckin: { enabled: false, limitLocalTime: "12:00", fee: { mode: "FREE", amountMinor: 0, currency: "USD" } },
      lateCheckout: { enabled: false, limitLocalTime: "14:00", fee: { mode: "FREE", amountMinor: 0, currency: "USD" } },
    } };
}
async function until(check) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  assert.fail("UI did not settle");
}
async function mount(t, { language = "es", getStatus = 200, saveStatus = 200, delaySave = false } = {}) {
  const calls = []; let current = fixture(); let release;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.startsWith("https://api.example.test/api/dashboard/properties/"));
    assert.equal(init.credentials, "include"); assert.equal(init.cache, "no-store");
    calls.push({ url, init });
    if (init.method === "GET") {
      return { ok: getStatus === 200, status: getStatus, json: async () => getStatus === 200 ? structuredClone(current) : { error: "STAY_TIME_SETTINGS_FORBIDDEN" } };
    }
    const body = JSON.parse(init.body);
    if (delaySave) await new Promise(resolve => { release = resolve; });
    if (saveStatus === 200) current = { ...current, settings: body.settings, revision: body.expectedRevision + 1 };
    return { ok: saveStatus === 200, status: saveStatus, json: async () => saveStatus === 200 ? structuredClone(current) : { error: "STAY_TIME_SETTINGS_CONFLICT" } };
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(StayTimeSettingsCard, { propertyId: "property-a", language })));
  await until(() => container.querySelector("fieldset") || container.querySelector('[role="alert"]'));
  const field = suffix => container.querySelector(`[id="property-a-${suffix}"]`);
  const save = () => [...container.querySelectorAll("button")].find(button => /Guardar|Save time/.test(button.textContent));
  return { container, root, calls, field, save, release: () => release?.(), current: value => { current = value; } };
}
async function setValue(element, value) {
  await act(async () => {
    const proto = element.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function enablePaid(app) {
  await act(async () => app.field("lateCheckout-enabled").click());
  await setValue(app.field("lateCheckout-fee"), "PER_HOUR");
  await setValue(app.field("lateCheckout-amount"), "25.50");
}
test("renders Spanish disabled defaults and discloses requests are not active", async t => {
  const app = await mount(t);
  assert.match(app.container.textContent, /Entrada anticipada/);
  assert.match(app.container.textContent, /aún no están disponibles/);
  assert.equal(app.field("earlyCheckin-enabled").checked, false);
  assert.equal(app.field("lateCheckout-time").disabled, true);
  assert.equal(app.calls.length, 1);
});
test("renders English copy", async t => {
  const app = await mount(t, { language: "en" });
  assert.match(app.container.textContent, /Early check-in/);
  assert.match(app.container.textContent, /prorated by minute/);
});
test("saves independent hourly price in cents with expected revision", async t => {
  const app = await mount(t); await enablePaid(app);
  await act(async () => app.save().click());
  await until(() => app.container.textContent.includes("Preferencias de horario guardadas"));
  const writes = app.calls.filter(call => call.init.method === "PUT");
  assert.equal(writes.length, 1);
  const body = JSON.parse(writes[0].init.body);
  assert.equal(body.expectedRevision, 0);
  assert.equal(body.settings.lateCheckout.fee.amountMinor, 2550);
  assert.equal(body.settings.earlyCheckin.enabled, false);
  await act(async () => app.save().click());
  await until(() => app.calls.filter(call => call.init.method === "PUT").length === 2);
  assert.equal(JSON.parse(app.calls.at(-1).init.body).expectedRevision, 1);
});
test("invalid paid amount prevents network write", async t => {
  const app = await mount(t); await enablePaid(app);
  await setValue(app.field("lateCheckout-amount"), "25.555");
  await act(async () => app.save().click());
  assert.match(app.container.querySelector('[role="alert"]').textContent, /dos decimales/);
  assert.equal(app.calls.filter(call => call.init.method === "PUT").length, 0);
});
test("host limits are checked against standard property hours", async t => {
  const app = await mount(t); await enablePaid(app);
  await setValue(app.field("lateCheckout-time"), "10:00");
  await act(async () => app.save().click());
  assert.match(app.container.querySelector('[role="alert"]').textContent, /salida habitual/);
  assert.equal(app.calls.filter(call => call.init.method === "PUT").length, 0);
});
test("409 preserves draft and blocks writes until explicit reload", async t => {
  const app = await mount(t, { saveStatus: 409 }); await enablePaid(app);
  await act(async () => app.save().click());
  await until(() => app.container.textContent.includes("Otra sesión"));
  assert.equal(app.field("lateCheckout-amount").value, "25.50");
  assert.equal(app.save().disabled, true);
  app.current({ ...fixture(), revision: 2 });
  await act(async () => [...app.container.querySelectorAll("button")].find(button => /Recargar/.test(button.textContent)).click());
  await until(() => app.field("lateCheckout-enabled") && !app.field("lateCheckout-enabled").checked);
  assert.equal(app.save().disabled, false);
});
test("save locks controls and suppresses duplicate submissions", async t => {
  const app = await mount(t, { delaySave: true }); await enablePaid(app);
  const button = app.save();
  await act(async () => { button.click(); button.click(); });
  assert.equal(app.calls.filter(call => call.init.method === "PUT").length, 1);
  assert.equal(app.container.querySelector("fieldset").disabled, true);
  await act(async () => app.release());
  await until(() => app.container.textContent.includes("Preferencias de horario guardadas"));
});
test("forbidden response never shows writable settings", async t => {
  const app = await mount(t, { getStatus: 403 });
  assert.match(app.container.textContent, /Solo un administrador/);
  assert.equal(app.container.querySelector("fieldset"), null);
  assert.equal(app.calls.length, 1);
});
test("money parser supports decimal comma without binary rounding", () => {
  const form = settingsToForm(fixture().settings);
  form.lateCheckout.mode = "FIXED"; form.lateCheckout.amount = "12,34";
  assert.equal(formToSettings(form).lateCheckout.fee.amountMinor, 1234);
  for (const amount of ["", "1e2", "-5", "0", "1.001", "1,234.50"]) {
    assert.throws(() => formToSettings({ ...form, lateCheckout: { ...form.lateCheckout, amount } }), /INVALID_AMOUNT/);
  }
});
test("Enter in a price input saves this card and prevents parent form submission", async t => {
  const app = await mount(t); await enablePaid(app);
  const event = new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  await act(async () => app.field("lateCheckout-amount").dispatchEvent(event));
  assert.equal(event.defaultPrevented, true);
  await until(() => app.calls.some(call => call.init.method === "PUT"));
  assert.equal(app.calls.filter(call => call.init.method === "PUT").length, 1);
});
test("property switch aborts prior request and cannot display the prior property's settings", async t => {
  let release; let oldSignal;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.includes("property-a")) {
      oldSignal = init.signal;
      await new Promise(resolve => { release = resolve; });
      return { ok: true, status: 200, json: async () => ({ ...fixture(), timezone: "Pacific/Honolulu" }) };
    }
    return { ok: true, status: 200, json: async () => fixture("property-b") };
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(StayTimeSettingsCard, { propertyId: "property-a", language: "en" })));
  await act(async () => root.render(createElement(StayTimeSettingsCard, { propertyId: "property-b", language: "en" })));
  assert.equal(oldSignal.aborted, true);
  await act(async () => release());
  await until(() => container.querySelector("fieldset"));
  assert.ok(container.querySelector('[id="property-b-lateCheckout-time"]'));
  assert.doesNotMatch(container.textContent, /Honolulu/);
});
