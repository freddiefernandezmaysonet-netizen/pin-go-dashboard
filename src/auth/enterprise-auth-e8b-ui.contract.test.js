import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authApi = fs.readFileSync(new URL("../api/auth.ts", import.meta.url), "utf8");
const apiClient = fs.readFileSync(new URL("../api/client.ts", import.meta.url), "utf8");
const authProvider = fs.readFileSync(new URL("./AuthProvider.tsx", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../pages/LoginPage.tsx", import.meta.url), "utf8");
const sessionExpiry = fs.readFileSync(new URL("./sessionExpiry.ts", import.meta.url), "utf8");

test("E8B UI maps server session errors to explicit login reasons", () => {
  assert.match(sessionExpiry, /SESSION_EXPIRED/);
  assert.match(sessionExpiry, /session_expired/);
  assert.match(sessionExpiry, /SESSION_REAUTH_REQUIRED/);
  assert.match(sessionExpiry, /reauth_required/);
});

test("E8B dashboard sends activity only through the dedicated endpoint", () => {
  assert.match(authApi, /export async function signalSessionActivity/);
  assert.match(authApi, /\/auth\/session\/activity/);
  assert.match(authApi, /res\.status === 404/);
  assert.match(authProvider, /signalSessionActivity/);
  assert.match(authProvider, /SESSION_ACTIVITY_SIGNAL_INTERVAL_MS/);
});

test("E8B activity is event-driven and never kept alive by a timer", () => {
  assert.match(authProvider, /pointerdown/);
  assert.match(authProvider, /touchstart/);
  assert.match(authProvider, /keydown/);
  assert.match(authProvider, /visibilitychange/);
  assert.doesNotMatch(authProvider, /setInterval/);
});

test("E8B shared API client preserves session-expiry reason", () => {
  assert.match(apiClient, /loginPathForSessionError/);
  assert.match(apiClient, /res\.clone\(\)\.json/);
  assert.match(apiClient, /window\.location\.href/);
});

test("E8B login explains expiration and security reauthentication bilingually", () => {
  assert.match(loginPage, /sessionNoticeFromSearch/);
  assert.match(loginPage, /role="status"/);
  assert.match(sessionExpiry, /Tu sesión expiró por seguridad/);
  assert.match(sessionExpiry, /Your session expired for security/);
  assert.match(sessionExpiry, /Actualizamos la seguridad de tu sesión/);
  assert.match(sessionExpiry, /We updated your session security/);
});

test("E8B UI preserves the certified MFA flow", () => {
  assert.match(loginPage, /verifyLoginMfa/);
  assert.match(loginPage, /resendLoginMfa/);
  assert.match(loginPage, /Trust this device for 30 days/);
  assert.match(authApi, /\/auth\/mfa\/verify/);
  assert.match(authApi, /\/auth\/mfa\/resend/);
});

// Incident return integration coverage within the certified auth surface.
{

const { readFileSync } = await import("node:fs");

const { default: ts } = await import("typescript");
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://synthetic.test/login" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const data = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path, imports = {}) {
  let code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const name of ["react", "react/jsx-runtime", ...Object.keys(imports)]) code = code.replaceAll(JSON.stringify(name), JSON.stringify(imports[name] ?? import.meta.resolve(name)));
  return data(code);
}
const helperUrl = compile("./sessionExpiry.ts");
const helper = await import(helperUrl);
const destination = "/pin-ai/incidents/GI-012345ABCDEF";
test("only exact incident destinations survive login; duplicate and external targets are rejected", () => {
  assert.equal(helper.incidentReturnFromSearch(`?returnTo=${encodeURIComponent(destination)}`), destination);
  assert.equal(helper.incidentLoginPath("/login?reason=session_expired", destination), `/login?reason=session_expired&returnTo=${encodeURIComponent(destination)}`);
  for (const bad of ["https://evil.test", "//evil.test", "/overview", `${destination}?x=1`, `${destination}#x`, `${destination}/..`, "/pin-ai/incidents/GI-INVALID", "%2Fpin-ai%2Fincidents%2FGI-012345ABCDEF"]) {
    assert.equal(helper.incidentReturnFromSearch(`?returnTo=${encodeURIComponent(bad)}`), null);
  }
  assert.equal(helper.incidentReturnFromSearch(`?returnTo=${destination}&returnTo=${destination}`), null);
  assert.equal(helper.incidentLoginPath("/login", "/overview"), "/login");
});
const bridgeUrl = data(`export const state = { search: '', mfa: false, fail: false, navigation: [], refreshes: 0, propertyReads: 0, role: 'ORG_ADMIN' };`);
const { state } = await import(bridgeUrl);
const router = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export const useNavigate=()=> (...args)=>state.navigation.push(args); export const useLocation=()=>({search:state.search}); export const Link=()=>null;`);
const api = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export async function login(){ if(state.fail) throw Error('bad'); return state.mfa ? {mfaRequired:true,challengeToken:'synthetic',destination:'test',expiresAt:new Date(Date.now()+300000).toISOString(),resendAfterSeconds:30} : {ok:true,user:{id:"user",orgId:"org",email:"a@example.com",role:state.role}}; } export async function verifyLoginMfa(){if(state.fail)throw Error('MFA_INVALID_CODE');return {ok:true,user:{id:"user",orgId:"org",email:"a@example.com",role:state.role}};} export async function resendLoginMfa(){throw Error('unused');}`);
const auth = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export const useAuth=()=>({refresh:async()=>{state.refreshes++;}});`);
const properties = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export async function fetchProperties(){state.propertyReads++;return {items:[{}]};}`);
const brand = data(`export const useBrand=()=>({brand:{kind:'PIN_GO',displayName:'Pin&Go'},isCustomBrand:false});`);
const { default: Login } = await import(compile("../pages/LoginPage.tsx", { "react-router-dom":router, "../api/auth":api, "../api/properties":properties,
  "../auth/AuthProvider":auth, "../auth/sessionExpiry":compile("./sessionExpiry.ts"), "../branding/BrandProvider":brand }));
test("actual login and MFA preserve incident destination, and failures never navigate", async () => {
  for (const mfa of [false, true]) {
    Object.assign(state, { role:"ORG_ADMIN", search:`?returnTo=${encodeURIComponent(destination)}`,mfa,fail:false,navigation:[],refreshes:0,propertyReads:0 });
    const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
    try {
      await act(async()=>root.render(createElement(Login)));
      const submit=async()=>{await act(async()=>el.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
      if (!mfa) {state.fail=true;await submit();assert.equal(state.navigation.length,0);state.fail=false;}
      await submit();
      if(mfa){
        assert.equal(state.navigation.length,0);
        const code=el.querySelector('input[autocomplete="one-time-code"]');assert.ok(code);
        await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(code,'123456');code.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
        state.fail=true;await submit();assert.equal(state.navigation.length,0);state.fail=false;await submit();
      }
      assert.deepEqual(state.navigation,[[destination,{replace:true}]]);assert.equal(state.refreshes,1);assert.equal(state.propertyReads,0);
    } finally {await act(async()=>root.unmount());el.remove();}
  }
});

test("cleaner login ignores host incident destination and never fetches properties", async () => {
  Object.assign(state,{role:"CLEANER",search:`?returnTo=${encodeURIComponent(destination)}`,mfa:false,fail:false,navigation:[],refreshes:0,propertyReads:0});
  const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
  try {
    await act(async()=>root.render(createElement(Login)));
    await act(async()=>el.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
    assert.deepEqual(state.navigation,[["/my-cleanings",{replace:true}]]);
    assert.equal(state.propertyReads,0);
  } finally {await act(async()=>root.unmount());el.remove();}
});

}
