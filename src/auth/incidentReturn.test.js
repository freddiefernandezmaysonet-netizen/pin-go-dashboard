import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";
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
const helperUrl = compile("./incidentReturn.ts");
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
const bridgeUrl = data(`export const state = { search: '', mfa: false, fail: false, navigation: [], refreshes: 0, propertyReads: 0 };`);
const { state } = await import(bridgeUrl);
const router = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export const useNavigate=()=> (...args)=>state.navigation.push(args); export const useLocation=()=>({search:state.search}); export const Link=()=>null;`);
const api = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export async function login(){ if(state.fail) throw Error('bad'); return state.mfa ? {mfaRequired:true,challengeToken:'synthetic',destination:'test',expiresAt:new Date(Date.now()+300000).toISOString(),resendAfterSeconds:30} : {ok:true}; } export async function verifyLoginMfa(){if(state.fail)throw Error('MFA_INVALID_CODE');return {ok:true};} export async function resendLoginMfa(){throw Error('unused');}`);
const auth = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export const useAuth=()=>({refresh:async()=>{state.refreshes++;}});`);
const properties = data(`import {state} from ${JSON.stringify(bridgeUrl)}; export async function fetchProperties(){state.propertyReads++;return {items:[{}]};}`);
const brand = data(`export const useBrand=()=>({brand:{kind:'PIN_GO',displayName:'Pin&Go'},isCustomBrand:false});`);
const { default: Login } = await import(compile("../pages/LoginPage.tsx", { "react-router-dom":router, "../api/auth":api, "../api/properties":properties,
  "../auth/AuthProvider":auth, "../auth/incidentReturn":helperUrl, "../auth/sessionExpiry":compile("./sessionExpiry.ts"), "../branding/BrandProvider":brand }));
test("actual login and MFA preserve incident destination, and failures never navigate", async () => {
  for (const mfa of [false, true]) {
    Object.assign(state, { search:`?returnTo=${encodeURIComponent(destination)}`,mfa,fail:false,navigation:[],refreshes:0,propertyReads:0 });
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
