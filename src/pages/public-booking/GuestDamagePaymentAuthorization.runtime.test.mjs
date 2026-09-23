import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Existing test-only renderer pattern: never fetch a live guest URL.
const testRequire = createRequire(process.env.PINGO_REACT_TEST_PACKAGE);
const React = testRequire("react");
const { act, create } = testRequire("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const source = ts.transpileModule(readFileSync("src/pages/public-booking/GuestDamagePaymentAuthorization.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const terms = (language = "en") => ({
  damageCaseId: "synthetic-case", version: "PROPERTY_PROTECTION_PAYMENT_AUTHORIZATION_V1", action: "ACCEPT_AND_AUTHORIZE_PAYMENT",
  claimRevision: "a".repeat(64), amountMinor: 10025, currency: "usd", acceptedMaximumMinor: 50000,
  reportedAmountMinor: 12500, description: "Synthetic description", evidenceNotes: "Synthetic evidence",
  language, consentText: language === "es" ? "Texto exacto del servidor: 100.25 USD" : "Exact server consent: 100.25 USD", collectionStatus: "NO_CHARGE_MADE",
});
const preview = (language = "en") => ({ ok: true, terms: terms(language), authorization: null });
const receipt = () => ({ id: "synthetic-authorization", authorizedAt: "2026-09-23T19:00:00Z", amountMinor: 10025, currency: "usd", claimRevision: "a".repeat(64) });
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const props = { apiBase: "https://synthetic.invalid", guestToken: "synthetic/token", caseId: "synthetic-case", language: "en" };
async function mount(fetch, overrides = {}) {
  const exports = {};
  vm.runInNewContext(source, { exports, fetch, AbortController, Intl, require: name => {
    if (name === "react" || name === "react/jsx-runtime") return testRequire(name);
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  const View = exports.GuestDamagePaymentAuthorization;
  let renderer;
  await act(async () => { renderer = create(React.createElement(View, { ...props, ...overrides })); });
  return { renderer, View };
}
const text = renderer => JSON.stringify(renderer.toJSON());
const check = async renderer => act(async () => renderer.root.findByType("input").props.onChange({ target: { checked: true } }));
const click = async renderer => act(async () => renderer.root.findByType("button").props.onClick());
const close = async renderer => act(async () => renderer.unmount());

for (const language of ["en", "es"]) test(`explicit exact-amount authorization in ${language}`, async () => {
  const calls = [];
  const { renderer } = await mount(async (url, options) => {
    calls.push({ url, options });
    return response(options.method === "POST" ? { ok: true, authorization: receipt(), collectionStatus: "NO_CHARGE_MADE" } : preview(language));
  }, { language });
  assert.match(calls[0].url, /synthetic%2Ftoken\/property-protection-case\/payment-authorization\?language=/);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(renderer.root.findByType("input").props.checked, false);
  assert.equal(renderer.root.findByType("button").props.disabled, true);
  await click(renderer); assert.equal(calls.length, 1, "Disabled action cannot post even if invoked directly");
  assert.ok(text(renderer).includes(terms(language).consentText));
  await check(renderer); await click(renderer);
  const sent = JSON.parse(calls[1].options.body);
  assert.deepEqual(sent, { action: terms().action, version: terms().version, claimRevision: terms().claimRevision, amountMinor: 10025, currency: "usd", language, consent: true });
  assert.equal(renderer.root.findAllByType("input").length, 0);
  assert.match(text(renderer), language === "es" ? /Autorización de pago registrada/ : /Payment authorization recorded/);
  assert.match(text(renderer), language === "es" ? /No se ha realizado ningún cargo/ : /No charge has been made/);
  await close(renderer);
});
test("double submit sends one request and never shows success before confirmation", async () => {
  let resolve; let posts = 0;
  const { renderer } = await mount(async (_url, options) => options.method === "POST" ? (++posts, new Promise(r => { resolve = r; })) : response(preview()));
  await check(renderer);
  const handler = renderer.root.findByType("button").props.onClick;
  await act(async () => { void handler(); void handler(); });
  assert.equal(posts, 1); assert.equal(renderer.root.findByType("input").props.disabled, true);
  assert.doesNotMatch(text(renderer), /Payment authorization recorded/);
  await act(async () => resolve(response({ ok: true, authorization: receipt(), collectionStatus: "NO_CHARGE_MADE" })));
  assert.match(text(renderer), /Payment authorization recorded/); await close(renderer);
});
for (const status of [404, 409, 500]) test(`GET ${status} cannot expose an authorization checkbox`, async () => {
  const { renderer } = await mount(async () => response({}, status));
  assert.equal(renderer.root.findAllByType("input").length, 0);
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 1);
  await close(renderer);
});
test("changed terms require refresh and fresh unchecked consent", async () => {
  let calls = 0;
  const { renderer } = await mount(async (_url, options) => {
    calls++;
    if (options.method === "POST") return response({}, 409);
    const next = preview();
    if (calls > 2) { next.terms.amountMinor = 9999; next.terms.claimRevision = "b".repeat(64); }
    return response(next);
  });
  await check(renderer); await click(renderer);
  assert.equal(calls, 2); assert.equal(renderer.root.findAllByType("input").length, 0);
  assert.match(text(renderer), /changed/);
  await click(renderer); assert.equal(calls, 3);
  assert.equal(renderer.root.findByType("input").props.checked, false);
  assert.equal(renderer.root.findByType("button").props.disabled, true); await close(renderer);
});
test("lost POST response reconciles via GET without silently posting again", async () => {
  let posts = 0;
  const { renderer } = await mount(async (_url, options) => {
    if (options.method === "POST") { posts++; throw new Error("Synthetic response lost"); }
    return response({ ...preview(), authorization: posts ? { ...receipt(), matchesCurrentTerms: true } : null });
  });
  await check(renderer); await click(renderer);
  assert.match(text(renderer), /could not confirm/); await click(renderer);
  assert.equal(posts, 1); assert.match(text(renderer), /Payment authorization recorded/); await close(renderer);
});
for (const matchesCurrentTerms of [true, false]) test(`existing authorization: matches=${matchesCurrentTerms}`, async () => {
  const { renderer } = await mount(async () => response({ ...preview(), authorization: { ...receipt(), matchesCurrentTerms } }));
  assert.equal(renderer.root.findAllByType("input").length, 0);
  assert.equal(renderer.root.findAllByType("button").length, 0);
  assert.match(text(renderer), matchesCurrentTerms ? /Payment authorization recorded/ : /does not match/); await close(renderer);
});
for (const change of [{ language: "es" }, { currency: "eur" }, { amountMinor: 60000 }, { amountMinor: 1.1 }, { damageCaseId: "other-case" }, { version: "legacy" }, { consentText: "" }]) test(`malformed terms fail closed ${JSON.stringify(change)}`, async () => {
  const next = preview(); Object.assign(next.terms, change);
  const { renderer } = await mount(async () => response(next));
  assert.equal(renderer.root.findAllByType("input").length, 0); await close(renderer);
});
test("a stale language request cannot replace current terms", async () => {
  let resolve;
  const { renderer, View } = await mount(async url => url.endsWith("=en") ? new Promise(r => { resolve = r; }) : response(preview("es")));
  await act(async () => renderer.update(React.createElement(View, { ...props, language: "es" })));
  await act(async () => resolve(response(preview("en"))));
  assert.ok(text(renderer).includes(terms("es").consentText));
  assert.equal(renderer.root.findByType("input").props.checked, false); await close(renderer);
});
test("malformed success never claims an authorization was saved", async () => {
  const { renderer } = await mount(async (_url, options) => response(options.method === "POST" ? { ok: true, authorization: { ...receipt(), amountMinor: 1 }, collectionStatus: "NO_CHARGE_MADE" } : preview()));
  await check(renderer); await click(renderer);
  assert.match(text(renderer), /could not confirm/); assert.doesNotMatch(text(renderer), /Payment authorization recorded/); await close(renderer);
});
test("parent gates the separate form to notified accepted cases", () => {
  const parent = readFileSync("src/pages/public-booking/GuestCancellationPage.tsx", "utf8");
  assert.match(parent, /damageCase.status === "GUEST_NOTIFIED" &&\s*propertyProtectionCase.damageCase.guestResponse === "ACCEPTED" && guestToken/);
  assert.match(parent, /GuestDamagePaymentAuthorization/);
});
