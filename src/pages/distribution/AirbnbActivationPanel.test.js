import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const source = readFileSync(new URL("./AirbnbActivationPanel.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const ready = { status: "READY", reason: null, channelId: "channel-1", mappingId: "mapping-1", listingId: "listing-1" };

// Executes the real panel and handlers with deterministic hook scheduling.
// No provider/browser network and no copied activation decision function.
function panel(api) {
  const slots = [], effects = [], pending = [];
  let cursor = 0, tree;
  const exported = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect(work, deps) {
      const index = cursor++, previous = effects[index];
      if (!previous || deps.some((d, i) => d !== previous.deps[i])) {
        previous?.cleanup?.();
        const next = { deps }; effects[index] = next;
        pending.push(() => { next.cleanup = work(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  runInNewContext(compiled, { exports: exported, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    return { AirbnbHostSelfServiceApiError: class extends Error {}, ...api };
  } });
  const mapped = [], activations = [];
  const props = { propertyId: "property-1", mappingRevision: "IDLE", onMapped: id => mapped.push(id), onActivated: async () => { activations.push(true); } };
  function render() { cursor = 0; tree = exported.default(props); while (pending.length) pending.shift()(); return tree; }
  function nodes(value = tree) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object") return [];
    return [value, ...nodes(value.props?.children)];
  }
  async function settle() { await new Promise(resolve => setImmediate(resolve)); render(); }
  function button(label) { return nodes().find(n => n.type === "button" && n.props.children === label); }
  function unmount() { effects.forEach(e => e?.cleanup?.()); }
  render();
  return { render, settle, button, nodes, mapped, activations, props, unmount };
}

test("mount and status refresh only inspect; activation requires host click", async () => {
  let reads = 0, writes = 0;
  const p = panel({ inspectAirbnbActivation: async () => { reads++; return ready; }, activateAirbnbForHost: async () => { writes++; } });
  assert.equal(writes, 0); await p.settle();
  assert.equal(reads, 1); assert(p.button("Activate Airbnb"));
  assert.deepEqual(p.mapped, ["property-1"]);
  p.button("Activate Airbnb").props.onClick(); await p.settle();
  assert.equal(writes, 1); assert.equal(p.activations.length, 1);
  assert.equal(p.button("Activate Airbnb"), undefined);
});

test("already mapped/active reload hides activation and never repeats POST", async () => {
  let writes = 0;
  const p = panel({ inspectAirbnbActivation: async () => ({ ...ready, status: "ACTIVE" }), activateAirbnbForHost: async () => { writes++; } });
  await p.settle(); assert.equal(writes, 0); assert.equal(p.button("Activate Airbnb"), undefined);
  assert.deepEqual(p.mapped, ["property-1"]);
});

test("double click cannot submit two activations", async () => {
  let writes = 0, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const p = panel({ inspectAirbnbActivation: async () => ready, activateAirbnbForHost: async () => { writes++; await pending; } });
  await p.settle(); const button = p.button("Activate Airbnb");
  button.props.onClick(); button.props.onClick(); p.render();
  assert.equal(writes, 1); assert.equal(p.button("Activating Airbnb…").props.disabled, true);
  finish(); await p.settle(); assert.equal(p.activations.length, 1);
});

test("uncertain activation removes retry control; checking status uses only GET", async () => {
  let writes = 0, reads = 0;
  const p = panel({ inspectAirbnbActivation: async () => { reads++; return { ...ready, status: reads === 1 ? "READY" : "CHECK_REQUIRED" }; },
    activateAirbnbForHost: async () => { writes++; throw new Error("timeout"); } });
  await p.settle(); p.button("Activate Airbnb").props.onClick(); await p.settle();
  assert.equal(p.button("Activate Airbnb"), undefined);
  p.button("Check connection status").props.onClick(); p.render(); await p.settle();
  assert.equal(reads, 2); assert.equal(writes, 1); assert.equal(p.activations.length, 0);
  assert(p.button("Check activation status"));
  assert.equal(p.button("Activate Airbnb"), undefined);
});

test("CHECK_REQUIRED uses verification POST and never repeats activation", async () => {
  let activationWrites = 0, verificationWrites = 0;
  const checkRequired = { ...ready, status: "CHECK_REQUIRED" };
  const p = panel({
    inspectAirbnbActivation: async () => checkRequired,
    activateAirbnbForHost: async () => { activationWrites++; },
    verifyAirbnbActivationForHost: async () => { verificationWrites++; },
  });
  await p.settle();
  const button = p.button("Check activation status");
  button.props.onClick(); button.props.onClick(); p.render();
  assert.equal(activationWrites, 0);
  assert.equal(verificationWrites, 1);
  assert.equal(p.button("Checking activation…").props.disabled, true);
  await p.settle();
  assert.equal(p.activations.length, 1);
  assert.equal(p.button("Activate Airbnb"), undefined);
});

test("failed explicit verification requires a fresh GET before another verification", async () => {
  let activationWrites = 0, verificationWrites = 0, reads = 0;
  const p = panel({
    inspectAirbnbActivation: async () => { reads++; return { ...ready, status: "CHECK_REQUIRED" }; },
    activateAirbnbForHost: async () => { activationWrites++; },
    verifyAirbnbActivationForHost: async () => { verificationWrites++; throw new Error("not active"); },
  });
  await p.settle(); p.button("Check activation status").props.onClick(); await p.settle();
  assert.equal(activationWrites, 0);
  assert.equal(verificationWrites, 1);
  assert.equal(p.button("Check activation status"), undefined);
  p.button("Check connection status").props.onClick(); p.render(); await p.settle();
  assert.equal(reads, 2);
  assert(p.button("Check activation status"));
  assert.equal(p.button("Activate Airbnb"), undefined);
});

test("failed inspection or unfinished Full Sync never exposes activation", async () => {
  for (const inspect of [async () => { throw new Error("offline"); }, async () => ({ ...ready, status: "NOT_READY", reason: "FULL_SYNC_REQUIRED" }), async () => ({ ...ready, status: "NOT_READY", reason: "MAPPING_REQUIRED" })]) {
    const p = panel({ inspectAirbnbActivation: inspect }); await p.settle();
    assert.equal(p.button("Activate Airbnb"), undefined); assert(p.button("Check connection status"));
  }
  assert.match(source, /Airbnb is still processing the property mapping/);
});

test("completed mapping triggers fresh read; stale unmounted response is ignored", async () => {
  let reads = 0;
  const p = panel({ inspectAirbnbActivation: async () => { reads++; return ready; } });
  await p.settle(); p.props.mappingRevision = "SUBMITTED"; p.render(); await p.settle(); assert.equal(reads, 2);
  let finish;
  const late = panel({ inspectAirbnbActivation: () => new Promise(resolve => { finish = resolve; }) });
  late.unmount(); finish(ready); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(late.mapped, []);
});


test("active Airbnb evidence offers canonical refresh without activation or Full Sync", () => {
  assert.match(source, /onRefreshVerifiedStatus\(\)/);
  assert.match(source, /Refresh verified status/);
  assert.match(source, /This does not request activation or Full Sync\./);
  assert.doesNotMatch(source, /Airbnb activation confirmed\./);
  assert.match(source, /Airbnb reports this channel as active\./);
});

const pageSource = readFileSync(new URL("./ConnectionCenterPage.tsx", import.meta.url), "utf8");
const pageAst = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const checksDeclaration = pageAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "AirbnbConnectionChecks");
assert.ok(checksDeclaration);
const checksCode = ts.transpileModule(checksDeclaration.getText(pageAst), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const renderChecks = runInNewContext(`${checksCode}\nAirbnbConnectionChecks`, { exports: {}, require: () => ({ jsx, jsxs }) });
const pendingChannel = {
  status: "DEGRADED", attentionCode: "OTA_FULL_SYNC_NOT_QUALIFIED",
  readiness: { authorization: "READY", mapping: "READY", distribution: "IN_PROGRESS" },
  lastReadinessCheckedAt: "2026-10-18T15:31:22.360Z",
};

test("Airbnb sync warning separates verified authorization and mapping from pending sync, with explicit recovery", () => {
  const html = renderToStaticMarkup(renderChecks({ channel: pendingChannel }));
  assert.match(html, /Account authorization/);
  assert.match(html, /Property mapping/);
  assert.equal((html.match(/>Verified</g) ?? []).length, 2);
  assert.match(html, /Pending verification/);
  assert.match(html, /after a channel update/);
  assert.match(html, /href="#distribution-full-sync-title"/);
  assert.match(html, /After the sync finishes, use Refresh verified status/);
  assert.match(html, /does not confirm completion/);
  assert.match(html, /Connection details for support/);
  assert.match(html, /OTA_FULL_SYNC_NOT_QUALIFIED/);
  assert.match(html, /dateTime="2026-10-18T15:31:22.360Z"/);
  assert.doesNotMatch(checksDeclaration.getText(pageAst), /\bfetch\(|reconcileDistributionChannel|requestDistributionFullSync|activateAirbnbForHost|confirmAirbnbHostMapping/);
});

test("verified Active Airbnb has no warning or new recovery request", () => {
  assert.equal(renderChecks({ channel: { ...pendingChannel, status: "ACTIVE" } }), null);
});

test("an unrelated or unknown blocker offers status verification and support instead of prescribing a sync", () => {
  for (const attentionCode of ["CHANNEL_MAPPING_NOT_VERIFIED", "FUTURE_DIAGNOSTIC_CODE"]) {
    const html = renderToStaticMarkup(renderChecks({ channel: { ...pendingChannel, attentionCode } }));
    assert.match(html, /Refresh verified status to check the existing connection/);
    assert.match(html, /contact support/);
    assert.doesNotMatch(html, /href="#distribution-full-sync-title"/);
  }
});

test("invalid or absent verification dates do not crash the diagnostic card", () => {
  for (const lastReadinessCheckedAt of [null, "not-a-date"]) {
    const html = renderToStaticMarkup(renderChecks({ channel: { ...pendingChannel, lastReadinessCheckedAt } }));
    assert.doesNotMatch(html, /Invalid Date|Last verified/);
    assert.match(html, /OTA_FULL_SYNC_NOT_QUALIFIED/);
  }
});
