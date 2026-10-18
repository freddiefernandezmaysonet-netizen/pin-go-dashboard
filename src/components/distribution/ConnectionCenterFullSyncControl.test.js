import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const source = readFileSync(new URL("./ConnectionCenterFullSyncControl.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const requestedAt = "2026-10-18T15:38:30.000Z";
const oldSync = "2026-09-24T18:14:22.180Z";
const newSync = "2026-10-18T15:38:49.000Z";
function center(confirmedAt = oldSync, status = "DEGRADED", propertyId = "property-1") {
  return { property: { id: propertyId }, provisioningStatus: "READY", channels: [
    { provider: "AIRBNB", channelLinked: true, status, lastFullSyncConfirmedAt: confirmedAt },
    { provider: "VRBO", channelLinked: true, status: "ACTIVE", lastFullSyncConfirmedAt: oldSync },
  ] };
}

function control({ read = async () => center(), reconcile = async () => {}, simulation = false } = {}) {
  const slots = [], effects = [], pendingEffects = [], timers = new Map(), events = [], calls = [];
  let cursor = 0, tree, nextTimer = 0;
  const route = { id: "property-1" };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useMemo(work) { cursor++; return work(); },
    useEffect(work, deps) {
      const i = cursor++, previous = effects[i];
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        previous?.cleanup?.();
        const effect = { deps }; effects[i] = effect;
        pendingEffects.push(() => { effect.cleanup = work(); });
      }
    },
  };
  const exported = {};
  const jsxStub = (type, props) => ({ type, props });
  runInNewContext(compiled, {
    exports: exported,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    window: { dispatchEvent(event) { events.push(event); } },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: jsxStub, jsxs: jsxStub };
      if (name === "react-router-dom") return { useParams: () => route, useSearchParams: () => [new URLSearchParams(simulation ? "simulation=1" : "")] };
      if (name.includes("AuthProvider")) return { useAuth: () => ({ user: { role: "ORG_ADMIN" } }) };
      if (name.endsWith("/distribution")) return {
        getDistributionConnectionCenter: read,
        async reconcileDistributionChannel(id, provider) { calls.push(["verify", id, provider]); await reconcile(id, provider); },
      };
      if (name.endsWith("/distributionFullSync")) return {
        DistributionFullSyncApiError: class extends Error {},
        getDistributionRuntimeState: async () => ({ distributionEnabled: true, distributionStatus: "ACTIVE" }),
        async requestDistributionFullSync(id) { calls.push(["sync", id]); return { queued: true, syncMode: "FULL", correlationId: "sync-1", requestedAt, messageKinds: ["AVAILABILITY", "RATES_RESTRICTIONS"] }; },
      };
      return {};
    },
  });
  function render() { cursor = 0; tree = exported.ConnectionCenterFullSyncControl(); while (pendingEffects.length) pendingEffects.shift()(); }
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object") return [];
    return [value, ...nodes(value.props?.children)];
  }
  function text(value) {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (value == null || typeof value === "boolean") return "";
    return typeof value === "object" ? text(value.props?.children) : String(value);
  }
  const button = label => nodes(tree).find(node => node.type === "button" && text(node).trim() === label);
  async function settle() { await new Promise(resolve => setImmediate(resolve)); render(); }
  async function tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await settle(); }
  render();
  return { route, render, settle, tick, button, text: () => text(tree), events, calls, timers, unmount: () => effects.forEach(effect => effect?.cleanup?.()) };
}

test("host request is sent once; an old Active timestamp is not accepted; a new verified sync updates the page", async () => {
  let checks = 0;
  const c = control({ read: async () => checks === 0 ? center() : checks === 1 ? center(oldSync, "ACTIVE") : center(newSync, "ACTIVE"), reconcile: async () => { checks++; } });
  await c.settle();
  assert.deepEqual(c.calls, []);
  const submit = c.button("Sync availability & rates");
  submit.props.onClick(); submit.props.onClick();
  await c.settle();
  assert.equal(c.calls.filter(call => call[0] === "sync").length, 1);
  await c.tick();
  assert.match(c.text(), /checking Airbnb/);
  assert.equal(c.events.length, 0);
  await c.tick();
  assert.match(c.text(), /sync verified for Airbnb/);
  assert.equal(c.events[0].detail.propertyId, "property-1");
  assert.equal(c.timers.size, 0);
  assert.equal(c.calls.filter(call => call[0] === "sync").length, 1);
  assert.deepEqual(c.calls.filter(call => call[0] === "verify").map(call => call[2]), ["AIRBNB", "AIRBNB"]);
});

test("pending verification stops after three attempts and manual recheck never replays Full Sync", async () => {
  let complete = false;
  const c = control({ read: async () => complete ? center(newSync, "ACTIVE") : center() });
  await c.settle(); c.button("Sync availability & rates").props.onClick(); await c.settle();
  for (let i = 0; i < 3; i++) await c.tick();
  assert.match(c.text(), /sync is not verified yet/);
  assert.equal(c.timers.size, 0);
  assert.equal(c.calls.filter(call => call[0] === "verify").length, 3);
  complete = true;
  c.button("Check sync status").props.onClick(); c.render(); await c.tick();
  assert.match(c.text(), /sync verified for Airbnb/);
  assert.equal(c.calls.filter(call => call[0] === "sync").length, 1);
});

test("network failure does not claim completion or automatically resend", async () => {
  const c = control({ reconcile: async () => { throw new Error("offline"); } });
  await c.settle(); c.button("Sync availability & rates").props.onClick(); await c.settle();
  for (let i = 0; i < 3; i++) await c.tick();
  assert.match(c.text(), /could not verify/);
  assert.doesNotMatch(c.text(), /sync verified for Airbnb/);
  assert.equal(c.calls.filter(call => call[0] === "sync").length, 1);
  assert.equal(c.timers.size, 0);
});

test("unmount and property navigation cancel follow-up checks and ignore an in-flight response", async () => {
  const c = control();
  await c.settle(); c.button("Sync availability & rates").props.onClick(); await c.settle();
  c.unmount(); assert.equal(c.timers.size, 0);

  let finish;
  const p = control({ reconcile: () => new Promise(resolve => { finish = resolve; }) });
  await p.settle(); p.button("Sync availability & rates").props.onClick(); await p.settle();
  const tick = p.tick();
  p.route.id = "property-2"; p.render();
  finish(); await tick;
  assert.equal(p.events.length, 0);
  assert.equal(p.timers.size, 0);
  assert.doesNotMatch(p.text(), /sync verified for Airbnb/);
});

test("simulation never submits or schedules verification", async () => {
  const c = control({ simulation: true }); await c.settle();
  assert.equal(c.button("Sync availability & rates").props.disabled, true);
  assert.equal(c.timers.size, 0); assert.deepEqual(c.calls, []);
});

const pageSource = readFileSync(new URL("../../pages/distribution/ConnectionCenterPage.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const checks = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AirbnbConnectionChecks");
const checksCode = ts.transpileModule(checks.getText(ast), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const renderChecks = runInNewContext(`${checksCode}\nAirbnbConnectionChecks`, { exports: {}, require: () => ({ jsx, jsxs }) });
test("pending Airbnb explains sync recovery while preserving separate verified checks; active hides warning", () => {
  const channel = { status: "DEGRADED", attentionCode: "OTA_FULL_SYNC_NOT_QUALIFIED", readiness: { authorization: "READY", mapping: "READY", distribution: "IN_PROGRESS" }, lastReadinessCheckedAt: requestedAt };
  const html = renderToStaticMarkup(renderChecks({ channel }));
  assert.match(html, /Account authorization/); assert.match(html, /Property mapping/);
  assert.match(html, /Pending verification/); assert.match(html, /after a channel update/);
  assert.match(html, /href="#distribution-full-sync-title"/);
  assert.match(html, /Connection details for support/); assert.match(html, /OTA_FULL_SYNC_NOT_QUALIFIED/);
  assert.equal(renderChecks({ channel: { ...channel, status: "ACTIVE" } }), null);
});
