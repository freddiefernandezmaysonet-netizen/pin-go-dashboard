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
function page(query, { result = pending, user = { role: "ORG_ADMIN" }, reject = false } = {}) {
  const effects = [], states = [], refs = [], calls = [], history = [], navigations = [];
  let stateIndex = 0, refIndex = 0, initialRender = true;
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
      async verifyAirbnbHostCallback(args) { calls.push(args); if (reject) throw new Error("test-only-state"); return result; },
    },
  };
  runInNewContext(compiled.outputText, {
    exports, require(name) { assert.ok(name in modules, `unexpected module ${name}`); return modules[name]; },
    window: { history: { replaceState(...args) { history.push(args); } } }, document: { title: "Test callback" },
  }, { timeout: 1000 });
  function render() { stateIndex = 0; refIndex = 0; const node = exports.AirbnbConnectionCallbackPage(); initialRender = false; return node; }
  return { render, effects, states, calls, history, navigations };
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return node && typeof node === "object" ? text(node.props?.children) : "";
}
function button(node) {
  if (!node) return null;
  if (Array.isArray(node)) return node.map(button).find(Boolean) ?? null;
  if (node.type === "button") return node;
  return button(node.props?.children);
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
