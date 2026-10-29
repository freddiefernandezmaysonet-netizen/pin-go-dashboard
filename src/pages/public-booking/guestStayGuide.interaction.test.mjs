import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/booking/success?pinAI=true" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compiled(file, replacements = {}) {
  let output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8")
    .replace('import "./GuestStayGuide.css";', ""), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const specifier of ["react", "react/jsx-runtime", ...Object.keys(replacements)]) {
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const guideModule = compiled("./GuestStayGuide.tsx");
const { GuestStayGuide, PinAIUsageGuide } = await import(guideModule);
const { PropertyPinAIUsageGuide } = await import(compiled("./PropertyPinAIUsageGuide.tsx", { "./GuestStayGuide": guideModule }));
const props = { apiBase: "https://api.example.test", organizationSlug: "org", propertySlug: "house", language: "es" };
const active = { ok: true, property: { slug: "house", organization: { slug: "org" }, pinAIEnabled: true } };
const response = data => ({ ok: true, json: async () => data });
async function mount(t) {
  const container = document.createElement("div");
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); });
  return { container, render: input => act(async () => root.render(createElement(PropertyPinAIUsageGuide, input))) };
}

test("general guide is always present while Pin AI needs explicit activation, in ES/EN", () => {
  for (const language of ["es", "en"]) {
    for (const enabled of [undefined, false, true]) {
      const html = renderToStaticMarkup(createElement(GuestStayGuide, { language, enabled }));
      assert.ok(html.includes(language === "es" ? "Desde tu reserva hasta la salida" : "From booking to checkout"));
      assert.equal(html.includes("PIN AI"), enabled === true);
      assert.equal(renderToStaticMarkup(createElement(PinAIUsageGuide, { language, enabled })).includes("PIN AI"), enabled === true);
    }
  }
});

test("post-payment guide stays hidden until this property's server response confirms activation", async t => {
  let resolve;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/public-booking/org/house");
    assert.equal(options.cache, "no-store");
    return new Promise(r => { resolve = r; });
  });
  const { container, render } = await mount(t);
  await render(props);
  assert.equal(container.textContent, "");
  await act(async () => resolve(response(active)));
  assert.ok(container.textContent.includes("PIN AI"));
  assert.ok(container.textContent.includes("24 horas antes"));
});

test("disabled, missing, invalid, mismatched and failed responses hide Pin AI", async t => {
  const outcomes = [
    response({ ...active, property: { ...active.property, pinAIEnabled: false } }),
    response({ ...active, property: { ...active.property, pinAIEnabled: undefined } }),
    response({ ...active, property: { ...active.property, pinAIEnabled: "true" } }),
    response({ ...active, property: { ...active.property, slug: "different" } }),
    response({ ...active, property: { ...active.property, organization: { slug: "different" } } }),
    response(null), { ...response(active), ok: false }, new Error("offline"),
  ];
  for (const outcome of outcomes) {
    await t.test(String(outcomes.indexOf(outcome)), async sub => {
      sub.mock.method(globalThis, "fetch", async () => { if (outcome instanceof Error) throw outcome; return outcome; });
      const { container, render } = await mount(sub);
      await render(props);
      assert.equal(container.textContent, "");
    });
  }
});

test("older success links without property scope cannot show Pin AI or issue lookups", async t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("lookup without a property"));
  const { container, render } = await mount(t);
  await render({ ...props, propertySlug: "" });
  assert.equal(container.textContent, "");
});

test("changing property clears the guide immediately and ignores late responses", async t => {
  const pending = [];
  t.mock.method(globalThis, "fetch", (url, options) => new Promise(resolve => pending.push({ url, options, resolve })));
  const { container, render } = await mount(t);
  await render(props);
  await act(async () => pending[0].resolve(response(active)));
  assert.ok(container.textContent.includes("PIN AI"));
  await render({ ...props, propertySlug: "second" });
  assert.equal(container.textContent, "");
  await render({ ...props, propertySlug: "third" });
  assert.equal(pending[1].options.signal.aborted, true);
  await act(async () => pending[1].resolve(response({ ...active, property: { ...active.property, slug: "second" } })));
  assert.equal(container.textContent, "");
});
