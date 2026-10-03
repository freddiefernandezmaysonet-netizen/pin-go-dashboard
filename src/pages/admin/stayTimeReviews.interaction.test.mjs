import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://dashboard.synthetic.invalid" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react"); const { createRoot } = await import("react-dom/client");
function module(file, replacements = {}) {
  let output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replaceAll("import.meta.env.VITE_API_BASE", '"https://api.synthetic.invalid"');
  for (const specifier of ["react", "react/jsx-runtime", ...Object.keys(replacements)])
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const apiModule = module("../../api/stayTimeReviews.ts");
const { StayTimeReviewApiError, createStayTimeReviewApi } = await import(apiModule);
const { StayTimeReviewWorkspace } = await import(module("./AdminStayTimeReviewPage.tsx", { "../../api/stayTimeReviews": apiModule }));
function item(id = "private-issue-id") { return { id, updatedAt: "2026-10-03T12:00:00.000Z", state: "ACTION_REQUIRED", detectedAt: "2026-10-03T12:00:00.000Z",
  organization: "Synthetic org", property: "Synthetic house", timezone: "America/Puerto_Rico", reservationNumber: "PG-SYNTHETIC",
  operation: "LATE_CHECKOUT", modificationStatus: "AWAITING_PAYMENT", paymentEvidence: "UNVERIFIED", additionalChargeAmount: "20", currency: "usd",
  attempts: 6, nextAttemptAt: "2026-10-03T15:00:00.000Z", reconciliationCompleted: false, physicalAccessCertified: false }; }
async function mount(t, overrides = {}, language = "es") {
  const calls = [], value = item(), history = [];
  const api = { list: async (...args) => { calls.push(["list", ...args]); return { items: [value], nextCursor: null }; },
    read: async (...args) => { calls.push(["read", ...args]); return { item: value, history: [...history], historyHasMore: false }; },
    review: async (...args) => { calls.push(["review", ...args]); history.push({ id: "review-1", at: value.updatedAt, kind: "OPERATOR_REVIEW", note: args[1].note, state: "ACTION_REQUIRED" });
      return { recorded: true, resolved: false, replayed: false }; }, ...overrides };
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(StayTimeReviewWorkspace, { api, language })));
  const button = text => [...container.querySelectorAll("button")].find(b => b.textContent === text);
  const open = async () => { await act(async () => container.querySelector('[aria-pressed]').click()); };
  return { container, root, calls, button, open };
}
async function fill(app, text = "Revisado <script>private note</script>") {
  await act(async () => { const input = app.container.querySelector("textarea");
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
}
test("Spanish evidence stays unverified, physical access is qualified, IDs and raw enums are hidden", async t => {
  const app = await mount(t); await app.open(); assert.match(app.container.textContent, /Pago sin verificar/);
  assert.match(app.container.textContent, /Esperando pago/); assert.match(app.container.textContent, /no certifica/);
  assert.match(app.container.textContent, /America\/Puerto_Rico/); assert.doesNotMatch(app.container.textContent, /private-issue-id|AWAITING_PAYMENT/);
});
test("recording a review retains incident, renders escaped note and sends no closure instruction", async t => {
  const app = await mount(t); await app.open(); await fill(app); await act(async () => app.button("Registrar revisión").click());
  assert.match(app.container.textContent, /Revisión registrada/); assert.match(app.container.textContent, /Requiere revisión/);
  assert.equal(app.container.querySelector("script"), null); assert.match(app.container.textContent, /<script>private note<\/script>/);
  assert.deepEqual(Object.keys(app.calls.find(c => c[0] === "review")[2]).sort(), ["expectedUpdatedAt", "note", "requestId"]);
});
test("409 preserves note and requires refreshed evidence before another submission", async t => {
  const app = await mount(t, { review: async () => { throw new StayTimeReviewApiError(409); } }); await app.open(); await fill(app, "Keep this note");
  await act(async () => app.button("Registrar revisión").click()); assert.equal(app.container.querySelector("textarea").value, "Keep this note");
  assert.equal(app.button("Registrar revisión").disabled, true); assert.match(app.container.textContent, /El incidente cambió/);
  await act(async () => [...app.container.querySelectorAll("article button")].find(b => b.textContent === "Actualizar").click());
  assert.equal(app.button("Registrar revisión").disabled, false);
});
test("ambiguous response retry reuses the exact command; concurrent submits are suppressed", async t => {
  const commands = []; let reject;
  const app = await mount(t, { review: async (_id, command) => { commands.push(command); return new Promise((_resolve, fail) => { reject = fail; }); } });
  await app.open(); await fill(app, "Pending evidence");
  await act(async () => { app.container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    app.container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(commands.length, 1); await act(async () => reject(new TypeError("offline")));
  await act(async () => app.button("Registrar revisión").click()); assert.deepEqual(commands[1], commands[0]);
  await act(async () => reject(new TypeError("offline")));
});
test("selection change aborts outstanding mutation and cannot report success on another item", async t => {
  let release, signal;
  const app = await mount(t, { list: async () => ({ items: [item(), { ...item("other-issue"), property: "Other house" }], nextCursor: null }),
    review: async (_id, _cmd, s) => { signal = s; return new Promise(resolve => { release = resolve; }); } });
  await app.open(); await fill(app); await act(async () => app.button("Registrar revisión").click());
  await act(async () => app.container.querySelectorAll('[aria-pressed]')[1].click()); assert.equal(signal.aborted, true);
  await act(async () => release({ recorded: true })); assert.doesNotMatch(app.container.textContent, /Revisión registrada/);
});
test("empty, forbidden, resolved filter and cursor are supported", async t => {
  const requests = []; const app = await mount(t, { list: async (state, after) => {
    requests.push({ state, after }); return after || state === "RESOLVED" ? { items: [], nextCursor: null } : { items: [item()], nextCursor: "cursor-next" };
  } });
  await act(async () => app.button("Siguiente página").click()); assert.match(app.container.textContent, /No hay incidentes/);
  assert.deepEqual(requests[1], { state: "OPEN", after: "cursor-next" });
  await act(async () => { const select = app.container.querySelector("select"); select.value = "RESOLVED"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  assert.deepEqual(requests[2], { state: "RESOLVED", after: null });
  const denied = await mount(t, { list: async () => { throw new StayTimeReviewApiError(403); } }, "en");
  assert.match(denied.container.textContent, /platform administrator/); assert.equal(denied.container.querySelector("textarea"), null);
});
test("API uses authenticated no-store requests and encoded paths; invalid response rejects", async t => {
  const calls = []; t.mock.method(globalThis, "fetch", async (url, init) => { calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ ok: true, items: [], nextCursor: null }) }; });
  const api = createStayTimeReviewApi("https://api.synthetic.invalid/"); const controller = new AbortController();
  await api.list("OPEN", "a/b", controller.signal); assert.match(calls[0].url, /after=a%2Fb$/);
  assert.equal(calls[0].init.credentials, "include"); assert.equal(calls[0].init.cache, "no-store");
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403, json: async () => ({}) }));
  await assert.rejects(api.read("id", controller.signal), e => e instanceof StayTimeReviewApiError && e.status === 403);
});
