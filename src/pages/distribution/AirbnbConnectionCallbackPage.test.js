import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the complete real TSX component with isolated React/router/API hooks.
// No browser navigation, credentials, network, provider or persistence exists.
const source = readFileSync(new URL("./AirbnbConnectionCallbackPage.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { fileName: "AirbnbConnectionCallbackPage.tsx", compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}, reportDiagnostics: true });
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const pending = { success: true, propertyId: "property-1", channelId: "716305c4-561a-4561-a187-7f5b8aeb5920",
  channelActive: true, airbnbAccountVerified: false, nextAction: "LISTING_DISCOVERY_REQUIRED" };
const successQuery = "?success=true&channel_id=716305c4-561a-4561-a187-7f5b8aeb5920&token=test-only-state";
const discovered = { propertyId: pending.propertyId, channelId: pending.channelId, airbnbAccountVerified: true,
  listings: [{ id: "42544559", title: "Test Property · Test Channex Property" }], nextAction: "MAPPING_REQUIRED" };
function page(query, { result = pending, user = { role: "ORG_ADMIN" }, reject = false,
  discoveryResult = discovered, discoveryReject = false, discoveryWait = null } = {}) {
  const effects = [], states = [], refs = [], calls = [], history = [], navigations = [];
  let stateIndex = 0, refIndex = 0, initialRender = true;
  const listingCalls = [];
  const exports = {};
  const modules = {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: {
      useState(initial) { const i = stateIndex++; if (initialRender) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
      useRef(initial) { const i = refIndex++; if (initialRender) refs[i] = { current: initial }; return refs[i]; },
      useEffect(effect) { if (initialRender) effects.push(effect); },
    },
    "lucide-react": { CheckCircle2: "check", LoaderCircle: "loader", ShieldCheck: "shield", TriangleAlert: "alert" },
    "react-router-dom": { Navigate: "Navigate", useNavigate: () => (...args) => navigations.push(args), useSearchParams: () => [new URLSearchParams(query)] },
    "../../auth/AuthProvider": { useAuth: () => ({ user }) },
    "../../api/airbnbHostSelfService": {
      AirbnbHostSelfServiceApiError: class extends Error {},
      async discoverAirbnbHostListings(propertyId, channelId) {
        listingCalls.push({ propertyId, channelId });
        if (discoveryWait) await discoveryWait;
        if (discoveryReject) throw new Error("SYNTHETIC_PRIVATE_ERROR");
        return discoveryResult;
      },
      async verifyAirbnbHostCallback(args) { calls.push(args); if (reject) throw new Error("test-only-state"); return result; },
    },
  };
  runInNewContext(compiled.outputText, {
    exports, require(name) { assert.ok(name in modules, `unexpected module ${name}`); return modules[name]; },
    window: { history: { replaceState(...args) { history.push(args); } } }, document: { title: "Test callback" },
  }, { timeout: 1000 });
  function render() { stateIndex = 0; refIndex = 0; const node = exports.AirbnbConnectionCallbackPage(); initialRender = false; return node; }
  return { render, effects, states, calls, listingCalls, history, navigations };
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return node && typeof node === "object" ? text(node.props?.children) : "";
}
function button(node, pattern = /Volver/) {
  if (!node) return null;
  if (Array.isArray(node)) return node.map(child => button(child, pattern)).find(Boolean) ?? null;
  if (node.type === "button" && pattern.test(text(node))) return node;
  return button(node.props?.children, pattern);
}
async function execute(p) { p.render(); for (const effect of p.effects) effect(); await new Promise(setImmediate); return p.render(); }

for (const query of ["?success=false", "?success=false&channel_id=untrusted&token=untrusted"]) {
  test(`documented failure stays local and uncorrelated: ${query}`, async () => {
    const p = page(query); const node = await execute(p);
    assert.equal(p.calls.length, 0); assert.equal(p.states[0], "FAILED"); assert.equal(p.states[1], null);
    assert.match(text(node), /no se completó/); assert.doesNotMatch(text(node), /no contiene una autorización válida/);
    assert.equal(p.history[0][2], "/distribution/airbnb/callback");
    button(node).props.onClick(); assert.equal(p.navigations[0][0], "/properties");
  });
}
for (const query of ["?success=true", "?success=true&token=test-only-state", "?success=true&channel_id=test", "?success=TRUE", "?success=1", ""]) {
  test(`incomplete/malformed successful redirect never calls verification: ${query}`, async () => {
    const p = page(query); await execute(p);
    assert.equal(p.states[0], "FAILED"); assert.equal(p.calls.length, 0); assert.equal(p.history.length, 1);
  });
}
test("exact resource read is displayed as pending Airbnb account confirmation", async () => {
  const p = page(successQuery); const node = await execute(p);
  assert.equal(p.calls.length, 1); assert.equal(p.calls[0].channelId, pending.channelId); assert.equal(p.calls[0].token, "test-only-state");
  assert.equal(p.states[0], "CHANNEL_READ"); assert.match(text(node), /Canal localizado/); assert.match(text(node), /Falta confirmar la cuenta/);
  assert.doesNotMatch(text(node), /Autorización confirmada|Airbnb confirmó|test-only-state/);
  button(node).props.onClick(); assert.equal(p.navigations[0][0], "/properties/property-1/distribution");
});
test("effect re-entry cannot duplicate verification", async () => {
  const p = page(successQuery); await execute(p); p.effects[0](); await new Promise(setImmediate);
  assert.equal(p.calls.length, 1); assert.equal(p.history.length, 1);
});
test("backend failure never becomes authorization or exposes artifacts", async () => {
  const p = page(successQuery, { reject: true }); const node = await execute(p);
  assert.equal(p.states[0], "FAILED"); assert.doesNotMatch(text(node), /test-only-state|Autorización confirmada/);
});
for (const user of [null, { role: "MEMBER" }]) {
  test(`existing authentication/role guard remains unchanged: ${user?.role ?? "anonymous"}`, async () => {
    const p = page(successQuery, { user }); const node = await execute(p);
    assert.equal(node.type, "Navigate"); assert.equal(node.props.to, user ? "/overview" : "/login"); assert.equal(p.calls.length, 0);
  });
}

// Gate 3 continues only after explicit host action; callback failures and
// read-only callback verification do not initiate listings automatically.
test("listing discovery is explicit after callback, never automatic", async () => {
  const p = page(successQuery); const node = await execute(p);
  assert.equal(p.listingCalls.length, 0);
  assert.ok(button(node, /Consultar anuncios/));
  assert.doesNotMatch(text(node), /Test Property · Test Channex Property/);
  button(node, /Consultar anuncios/).props.onClick();
  await new Promise(setImmediate); const read = p.render();
  assert.deepEqual(p.listingCalls, [{ propertyId: pending.propertyId, channelId: pending.channelId }]);
  assert.match(text(read), /42544559/); assert.match(text(read), /Test Property · Test Channex Property/);
  assert.match(text(read), /no realizó mapeos ni activaciones/);
  assert.doesNotMatch(text(read), /test-only-state|Autorización confirmada/);
  assert.equal(p.calls.length, 1);
});
test("empty response is reported as no returned titled listings, not no Airbnb account", async () => {
  const p = page(successQuery, { discoveryResult: { ...discovered, listings: [] } });
  const node = await execute(p); button(node, /Consultar anuncios/).props.onClick();
  await new Promise(setImmediate); const read = p.render();
  assert.match(text(read), /no devolvió anuncios con título/);
  assert.doesNotMatch(text(read), /cuenta no existe|No tienes anuncios/);
});
test("discovery failure keeps resource boundary and does not expose error or token", async () => {
  const p = page(successQuery, { discoveryReject: true });
  const node = await execute(p); button(node, /Consultar anuncios/).props.onClick();
  await new Promise(setImmediate); const read = p.render();
  assert.match(text(read), /No pudimos consultar/);
  assert.doesNotMatch(text(read), /SYNTHETIC_PRIVATE_ERROR|test-only-state|42544559/);
  assert.equal(p.listingCalls.length, 1);
  assert.equal(button(read, /Consultar anuncios/).props.disabled, false);
  assert.ok(button(read, /Volver al Centro/));
});
test("double click cannot duplicate in-flight listing retrieval", async () => {
  let release;
  const discoveryWait = new Promise(resolve => { release = resolve; });
  const p = page(successQuery, { discoveryWait });
  const node = await execute(p); const action = button(node, /Consultar anuncios/);
  action.props.onClick(); action.props.onClick();
  assert.equal(p.listingCalls.length, 1);
  const busy = p.render(); assert.equal(button(busy, /Consultando anuncios/).props.disabled, true);
  release(); await new Promise(setImmediate);
  assert.equal(button(p.render(), /Consultar anuncios/).props.disabled, false);
});
for (const query of ["?success=false", "?success=true", ""]) {
  test(`unverified callback has no listing-discovery control: ${query}`, async () => {
    const p = page(query); const node = await execute(p);
    assert.equal(button(node, /Consultar anuncios/), null);
    assert.equal(p.listingCalls.length, 0);
  });
}
test("provider title/id are React text nodes, not HTML or external navigation", async () => {
  const title = "<img src=x onerror=alert(1)>";
  const p = page(successQuery, { discoveryResult: { ...discovered, listings: [{ id: "001-id", title }, { id: "001-id", title: "Repeated ID" }] } });
  const node = await execute(p); button(node, /Consultar anuncios/).props.onClick(); await new Promise(setImmediate);
  const read = p.render(); assert.ok(text(read).includes(title)); assert.match(text(read), /Repeated ID/);
  assert.doesNotMatch(JSON.stringify(read), /dangerouslySetInnerHTML|https:\/\/www.airbnb/);
});
