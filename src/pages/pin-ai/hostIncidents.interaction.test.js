import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://synthetic.test" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
function moduleUrl(file, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText.replace(/import "\.\/hostIncidents.css";/, "");
  for (const name of ["react", "react/jsx-runtime", ...Object.keys(replacements)]) source = source.replaceAll(JSON.stringify(name), JSON.stringify(replacements[name] ?? import.meta.resolve(name)));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const apiModule = moduleUrl("../../api/hostIncidents.ts");
const { createIncidentApi, IncidentApiError } = await import(apiModule);
const { HostIncidentWorkspace } = await import(moduleUrl("./HostIncidentWorkspace.tsx", { "../../api/hostIncidents": apiModule }));
const { GuestIncidentUpdates } = await import(moduleUrl("../public-booking/GuestIncidentUpdates.tsx"));
const reference = "GI-123456789ABC";
test("guest status renders without a published message and never exposes private outcome", async t => {
  let resolution = "OPEN";
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200, json: async () => ({ ok: true,
    incidents: [{ reference, createdAt: "2026-09-27T19:00:00Z", resolution, hostAcknowledged: true,
      privateOutcome: "PRIVATE OUTCOME MUST NEVER RENDER" }], updates: [], nextAfter: null }) }));
  const { el } = await mount(t, GuestIncidentUpdates, { apiBase: "https://api.synthetic.test", guestToken: "synthetic-guest-token" });
  await until(() => el.textContent.includes("Resolution pending"));
  assert.match(el.textContent, /Confirmada \/ Confirmed/);
  assert.doesNotMatch(el.textContent, /PRIVATE OUTCOME/);
  resolution = "RESOLVED"; await click(el, "Refresh");
  await until(() => el.textContent.includes("Recorded as resolved"));
  assert.doesNotMatch(el.textContent, /PRIVATE OUTCOME|Resolution pending/);
  assert.match(el.textContent, /does not verify a physical repair/);
});

test("visible portal refreshes incident status automatically without provider polling", async t => {
  let interval, resolution = "OPEN", calls = 0;
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  t.mock.method(window, "setInterval", fn => { interval = fn; return 123; });
  t.mock.method(window, "clearInterval", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ ok: true,
      incidents: [{ reference, createdAt: "2026-09-27T19:00:00Z", resolution, hostAcknowledged: false }],
      updates: [], nextAfter: null }) };
  });
  const { el } = await mount(t, GuestIncidentUpdates, { apiBase: "https://api.synthetic.test", guestToken: "synthetic-guest-token" });
  await until(() => el.textContent.includes("Resolution pending"));
  resolution = "RESOLVED";
  await act(async () => interval());
  await until(() => el.textContent.includes("Recorded as resolved"));
  assert.equal(calls, 2);
});

function sample(ref = reference) { return { reference: ref, state: "ACTION_REQUIRED", propertyName: "Synthetic home", reservationNumber: "PG-TEST", version: 0, reportedFacts: "Cold water", acknowledgedAt: null, messages: [], nextAfter: null }; }
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await act(async () => { await new Promise(r => setTimeout(r, 5)); }); } assert.fail("UI did not settle"); }
async function mount(t, Component, props) { const el = document.createElement("div"); document.body.append(el); const root = createRoot(el); await act(async () => root.render(createElement(Component, props))); t.after(async () => { await act(async () => root.unmount()); el.remove(); }); return { el, async render(next) { await act(async () => root.render(createElement(Component, next))); } }; }
async function click(el, label) { const b = [...el.querySelectorAll("button")].find(x => x.textContent.includes(label)); assert.ok(b, label); assert.equal(b.disabled, false, label); await act(async () => b.click()); }
async function input(el, value) { const input = el.querySelector("textarea"); await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }); }
async function select(el, value) { await act(async () => { const s = el.querySelector("select"); s.value = value; s.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); }
function fakeApi() { let current = sample(); const commands = []; return { commands, api: { list: async () => ({ items: [current], nextCursor: null }), read: async () => structuredClone(current), command: async (ref, command) => { commands.push({ ref, command }); current = { ...current, version: current.version + 1, state: command.operation === "RESOLVE" ? "RESOLVED" : current.state, messages: [...current.messages, { id: command.requestId, sequence: current.version + 1, kind: command.operation, audience: command.operation === "PUBLISH" ? "GUEST" : "INTERNAL", createdAt: "2026-09-27T19:00:00Z", text: command.text }] }; return { eventId: command.requestId }; } } }; }

test("API uses session auth, scopes reference and paginates a consistent history", async t => {
  const calls = []; t.mock.method(globalThis, "fetch", async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, ...sample(), messages: [{ id: String(calls.length) }], nextAfter: calls.length === 1 ? 100 : null }) }; });
  const api = createIncidentApi("https://api.synthetic.test"); const result = await api.read(reference);
  assert.equal(result.messages.length, 2); assert.ok(calls[1].url.endsWith("?after=100")); assert.equal(calls[0].init.credentials, "include"); assert.equal(calls[0].init.cache, "no-store");
  await assert.rejects(api.read("../another-organization"), /NOT_FOUND/);
});
test("mixed history versions fail closed", async t => {
  let n = 0; t.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200, json: async () => ({ ok: true, ...sample(), version: ++n, nextAfter: n === 1 ? 100 : null }) }));
  await assert.rejects(createIncidentApi("https://api.synthetic.test").read(reference), /VERSION_CONFLICT/);
});
test("private note and guest publication require separate explicit confirmations", async t => {
  const { api, commands } = fakeApi(); const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} });
  await until(() => el.querySelector("textarea")); await input(el, "Internal plan"); await click(el, "Revisar acción"); assert.equal(commands.length, 0);
  await click(el, "Confirmar acción"); await until(() => !el.querySelector("textarea")?.disabled);
  assert.equal(commands[0].command.operation, "NOTE"); assert.ok(el.textContent.includes("Solo organización"));
  await select(el, "PUBLISH"); await input(el, "A technician will visit at 5."); await click(el, "Revisar acción"); assert.equal(commands.length, 1);
  await click(el, "Confirmar acción"); await until(() => commands.length === 2 && !el.querySelector("textarea")?.disabled);
  assert.equal(commands[1].command.text, "A technician will visit at 5."); assert.equal(commands[1].command.operation, "PUBLISH"); assert.equal(commands[1].command.expectedVersion, 1);
  assert.ok(el.textContent.includes("No confirma lectura")); assert.ok(el.querySelector(".hi-public"));
});
test("uncertain request retries identical command and prevents new actions", async t => {
  const { api } = fakeApi(); const calls = []; api.command = async (ref, c) => { calls.push({ ref, c }); if (calls.length === 1) throw new Error("lost response"); return { eventId: "persisted" }; };
  const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => el.querySelector("textarea"));
  await input(el, "Private retry"); await click(el, "Revisar acción"); await click(el, "Confirmar acción"); await until(() => el.textContent.includes("resultado es incierto"));
  assert.ok(el.querySelector("textarea").disabled); await click(el, "Verificar misma acción"); await until(() => calls.length === 2 && !el.querySelector("textarea")?.disabled); assert.deepEqual(calls[0], calls[1]);
});
test("version conflict clears stale actions and requires fresh review", async t => {
  const { api } = fakeApi(); let calls = 0; api.command = async () => { calls++; throw new IncidentApiError(409, "VERSION_CONFLICT"); };
  const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => el.querySelector("textarea")); await input(el, "note"); await click(el, "Revisar acción"); await click(el, "Confirmar acción");
  await until(() => el.textContent.includes("El incidente cambió")); assert.equal(el.querySelector("textarea"), null); assert.equal(calls, 1); await click(el, "Actualizar caso"); await until(() => el.querySelector("textarea")); assert.equal(calls, 1);
});
test("single-case resolution is explicit and removes further write controls", async t => {
  const { api, commands } = fakeApi(); const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => el.querySelector("textarea")); await select(el, "RESOLVE"); await input(el, "Repair inspected by host"); await click(el, "Revisar acción"); assert.ok(el.textContent.includes("únicamente este incidente")); await click(el, "Confirmar acción"); await until(() => !el.querySelector("textarea")); assert.equal(commands[0].ref, reference); assert.equal(commands[0].command.operation, "RESOLVE"); assert.ok(el.textContent.includes("no verifica una reparación física"));
});
test("late history from previous incident never appears in new incident", async t => {
  const { api } = fakeApi(); let late; api.read = ref => ref === reference ? new Promise(r => { late = r; }) : Promise.resolve(sample(ref));
  const props = { api, reference, onSelect() {} }; const { el, render } = await mount(t, HostIncidentWorkspace, props); const next = "GI-FFFFFFFFFFFF"; await render({ ...props, reference: next }); await until(() => el.querySelector("textarea")); await act(async () => late({ ...sample(), reportedFacts: "SECRET OLD REPORT" })); assert.ok(!el.textContent.includes("SECRET OLD REPORT"));
});
test("guest uses only public projection without host cookies and renders text safely", async t => {
  const calls = []; t.mock.method(globalThis, "fetch", async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, updates: [{ id: "public-1", reference, createdAt: "2026-09-27T19:00:00Z", text: "<script>public update</script>" }], nextAfter: null }) }; });
  const { el } = await mount(t, GuestIncidentUpdates, { apiBase: "https://api.synthetic.test", guestToken: "synthetic-guest-token" }); await until(() => el.textContent.includes("public update")); assert.equal(calls[0].init.credentials, "omit"); assert.ok(calls[0].url.includes("/pin-ai/incident-updates")); assert.equal(el.querySelector("script"), null); assert.ok(!el.textContent.includes("Internal plan"));
});
test("disabled backend hides guest updates and offers no host controls", async t => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 })); const { el } = await mount(t, GuestIncidentUpdates, { apiBase: "https://api.synthetic.test", guestToken: "synthetic-guest-token" }); await act(async () => {}); assert.equal(el.textContent, "");
});
test("permission denial never creates an empty writable thread", async t => {
  const { api, commands } = fakeApi(); api.read = async () => { throw new IncidentApiError(403, "HOST_ACCESS_DENIED"); }; const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => el.textContent.includes("Access denied")); assert.equal(el.querySelector("textarea"), null); assert.equal(commands.length, 0);
});
test("acknowledgement has empty text and does not publish the draft", async t => {
  const { api, commands } = fakeApi(); const { el } = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => el.querySelector("textarea")); await input(el, "Unpublished private draft"); await click(el, "Confirmar atención"); assert.equal(commands.length, 0); await click(el, "Confirmar acción"); await until(() => commands.length === 1 && !el.querySelector("textarea")?.disabled); assert.equal(commands[0].command.operation, "ACKNOWLEDGE"); assert.equal(commands[0].command.text, ""); assert.equal(el.querySelector("textarea").value, "Unpublished private draft");
});
test("server history is restored in a fresh workspace", async t => {
  const { api, commands } = fakeApi(); const first = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => first.el.querySelector("textarea")); await input(first.el, "Durable private note"); await click(first.el, "Revisar acción"); await click(first.el, "Confirmar acción"); await until(() => commands.length === 1 && !first.el.querySelector("textarea")?.disabled); const second = await mount(t, HostIncidentWorkspace, { api, reference, onSelect() {} }); await until(() => second.el.querySelector(".hi-event")); assert.ok(second.el.textContent.includes("Durable private note")); assert.equal(commands.length, 1);
});
