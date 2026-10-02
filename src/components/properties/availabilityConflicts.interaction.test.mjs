import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://dashboard.synthetic.invalid" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
function module(file, replacements = {}) {
  let output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText.replaceAll("import.meta.env.VITE_API_BASE", '"https://api.synthetic.invalid"');
  for (const specifier of ["react", "react/jsx-runtime", ...Object.keys(replacements)]) {
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const api = module("../../api/availabilityConflicts.ts", { "../auth/sessionExpiry": module("../../auth/sessionExpiry.ts") });
const whiteLabel = module("../../lib/whiteLabel.ts");
const component = module("./AvailabilityConflictReview.tsx", { "../../api/availabilityConflicts": api, "../../lib/whiteLabel": whiteLabel });
const { AvailabilityConflictReview } = await import(component);
const { OperationalIntelligencePanel } = await import(module("./OperationalIntelligencePanel.tsx", {
  "./AvailabilityConflictReview": component, "../../lib/whiteLabel": whiteLabel,
}));
function fixture(reservationId = "incoming") {
  return { ok: true, reservation: { id: reservationId, reservationNumber: "PG-INCOMING", checkIn: "2026-11-03T19:00:00Z", checkOut: "2026-11-06T15:00:00Z",
    property: { name: "Synthetic house", timezone: "America/Puerto_Rico" } }, hasMore: false,
    currentAvailability: { available: false, cause: null }, items: [{ id: "issue-a", updatedAt: "2026-10-02T12:00:00.000Z", state: "ACTION_REQUIRED",
      detectedAt: "2026-10-02T12:00:00.000Z", detectedCause: { type: "RESERVATION", label: "Reservation overlap", startsAt: "2026-11-03T19:00:00Z",
        endsAt: "2026-11-04T15:00:00Z", blockReason: null, reservation: { id: "other-stay", reservationNumber: "PG-OTHER", guestName: "Other guest" } },
      resolutionSummary: null, resolvedAt: null, history: [{ state: "ACTION_REQUIRED", summary: "Channex booking preserved", actor: "PIN_GO", at: "2026-10-02T12:00:00Z" }] }] };
}
async function mount(t, { status = 200, componentType = AvailabilityConflictReview, props = {}, pending = false } = {}) {
  const calls = [], opened = []; let saved = false, release;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, init });
    if (init.method === "POST") {
      if (pending) await new Promise(resolve => { release = resolve; });
      if (status !== 409) saved = true;
      return { ok: status !== 409, status: status === 409 ? 409 : 200, json: async () => status === 409 ? { ok: false } : { ok: true, state: "RESOLVED" } };
    }
    const value = fixture();
    if (saved) { value.items[0].state = "RESOLVED"; value.items[0].resolutionSummary = "Coordinated solution";
      value.items[0].history.push({ state: "RESOLVED", summary: "Coordinated solution", actor: "HOST", at: "2026-10-02T13:00:00Z" }); }
    return { ok: status !== 403, status: status === 403 ? 403 : 200, json: async () => value };
  });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(componentType, { reservationId: "incoming", onOpenReservation: id => opened.push(id), ...props })));
  return { container, root, calls, opened, release: () => release?.(), button: text => [...container.querySelectorAll("button")].find(b => b.textContent === text) };
}
async function fill(app, value = "Coordinated solution") {
  const input = app.container.querySelector("textarea");
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
}
test("review shows scoped reference and property-local time without internal IDs or provider name", async t => {
  const app = await mount(t); assert.match(app.container.textContent, /PG-OTHER/);
  assert.match(app.container.textContent, /3:00:00 PM/); assert.match(app.container.textContent, /America\/Puerto_Rico/);
  assert.doesNotMatch(app.container.textContent, /other-stay|issue-a|Channex/);
  await act(async () => app.button("#PG-OTHER Other guest").click()); assert.deepEqual(app.opened, ["other-stay"]);
  assert.equal(app.calls[0].init.credentials, "include"); assert.equal(app.calls[0].init.cache, "no-store");
});
test("blank solution cannot close; valid closure sends exact version and reloads canonical history", async t => {
  const app = await mount(t); const button = app.button("Record solution and close alert"); assert.equal(button.disabled, true);
  await fill(app); await act(async () => button.click());
  const post = app.calls.find(c => c.init.method === "POST");
  assert.deepEqual(JSON.parse(post.init.body), { expectedUpdatedAt: "2026-10-02T12:00:00.000Z", resolutionSummary: "Coordinated solution" });
  assert.equal(app.calls.filter(c => c.init.method === "GET").length, 2);
  assert.match(app.container.textContent, /Alert closed by the host/);
  assert.equal(app.container.querySelector("textarea"), null);
  assert.match(app.container.querySelector("details").textContent, /Host: Coordinated solution/);
});
test("double click during persistence produces one closure request", async t => {
  const app = await mount(t, { pending: true }); await fill(app);
  await act(async () => { app.button("Record solution and close alert").click(); app.button("Record solution and close alert").click(); });
  assert.equal(app.calls.filter(c => c.init.method === "POST").length, 1);
  assert.equal(app.container.querySelector("textarea").disabled, true);
  await act(async () => app.release());
});
test("stale closure preserves the note and never reports success", async t => {
  const app = await mount(t, { status: 409 }); await fill(app);
  await act(async () => app.button("Record solution and close alert").click());
  assert.match(app.container.querySelector('[role="alert"]').textContent, /another session/);
  assert.equal(app.container.querySelector("textarea").value, "Coordinated solution");
  assert.doesNotMatch(app.container.textContent, /Alert closed by the host/);
});
test("forbidden review has no closure controls; Spanish copy is supported", async t => {
  const app = await mount(t, { status: 403, props: { language: "es" } });
  assert.match(app.container.textContent, /Solo un administrador/); assert.equal(app.container.querySelector("textarea"), null);
});
test("reservation switch aborts prior read and refuses stale cross-reservation payload", async t => {
  const app = await mount(t); const oldSignal = app.calls[0].init.signal;
  await act(async () => app.root.render(createElement(AvailabilityConflictReview, { reservationId: "different" })));
  assert.equal(oldSignal.aborted, true); assert.doesNotMatch(app.container.textContent, /PG-OTHER/);
  assert.match(app.container.textContent, /Unable to load/);
});
for (const state of ["ACTION_REQUIRED", "RESOLVED"]) test(`Mission Control retains ${state} OTA review with working button`, async t => {
  const item = { issueCode: "CHANNEX_AVAILABILITY_CONFLICT", visibility: "HOST", workflowState: state, actionRequired: state === "ACTION_REQUIRED",
    responsibleActor: "HOST", reservationId: "incoming", reservationNumber: "PG-INCOMING", engine: "Reservation", title: "OTA conflict", issue: "Availability conflict",
    firstDetectedAt: "2026-10-02T12:00:00Z", lastSignalAt: "2026-10-02T12:00:00Z", resolutionSummary: "Host solution" };
  const app = await mount(t, { componentType: OperationalIntelligencePanel, props: { items: [item] } });
  assert.equal(app.calls.length, 0); await act(async () => app.button("Review conflict").click());
  assert.match(app.container.textContent, /PG-OTHER/); assert.equal(app.calls.length, 1);
});
