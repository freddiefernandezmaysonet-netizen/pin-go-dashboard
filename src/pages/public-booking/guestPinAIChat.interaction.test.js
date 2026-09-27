import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { webcrypto } from "node:crypto";

// Render the actual component with React DOM; all HTTP responses are synthetic.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://portal.example.test" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(dom.window, "crypto", { value: webcrypto });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
await import("react-markdown");

function compiledModule(file, replacements = {}) {
  let output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const specifier of ["react", "react/jsx-runtime", "react-markdown", ...Object.keys(replacements)]) {
    output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(replacements[specifier] ?? import.meta.resolve(specifier)));
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const sessionModule = compiledModule("./pinAIChatSession.ts");
const { createGuestChatSession } = await import(sessionModule);
const { GuestPinAIChat } = await import(compiledModule("./GuestPinAIChat.tsx", {
  "./pinAIProposalExpiry": compiledModule("./pinAIProposalExpiry.ts"),
  "./pinAIChatSession": sessionModule,
}));

async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  assert.fail("Timed out waiting for asynchronous session recovery");
}

const deadline = Date.parse("2026-09-27T15:00:00Z");
function proposal(expiresAt = deadline) {
  const expiry = new Date(expiresAt).toISOString();
  return { actionType: "RESERVATION_MODIFICATION", proposalId: "synthetic-proposal",
    requiresGuestConfirmation: true, confirmationToken: "private-synthetic-confirmation",
    expiresAt: expiry, quote: { quotedAt: "2026-09-27T14:00:00Z", quoteExpiresAt: expiry,
      quoteExpiresAtLocal: "2026-09-27T11:00:00-04:00", priceGuaranteedUntil: expiry,
      propertyTimezone: "America/Puerto_Rico", availabilityCheckedAt: "2026-09-27T14:00:00Z",
      availabilityHeld: false, currentTotalAmount: 3.35, proposedTotalAmount: 4.47,
      amountDifference: 1.12, amountDifferenceCents: 112, currency: "USD",
      financialAction: "ADDITIONAL_PAYMENT_REQUIRED" } };
}

async function mount(t, { language = "es-PR", expiry = deadline, outcome = "WAITING_FOR_PAYMENT" } = {}) {
  window.sessionStorage.clear();
  Object.defineProperty(dom.window.navigator, "language", { value: language, configurable: true });
  let now = deadline - 60_000;
  t.mock.method(Date, "now", () => now);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.startsWith("https://api.example.test/"), "Network must stay synthetic");
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, async json() { return url.endsWith("/messages")
      ? { ok: true, reply: "Cotización preparada.", requiresHumanReview: false, actionProposal: proposal(expiry) }
      : { ok: true, action: { actionType: "RESERVATION_MODIFICATION", proposalId: "synthetic-proposal",
          outcome, actionExecuted: outcome === "EXECUTED", checkoutUrl: "https://checkout.example.test/synthetic" } }; } };
  });
  const container = document.createElement("div");
  document.body.append(container);
  let root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(GuestPinAIChat, {
    apiBase: "https://api.example.test", guestToken: "synthetic-guest-token",
  })));
  await until(() => !container.querySelector("textarea").disabled);
  const input = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, "Extender solo mi salida.");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  const cache = await createGuestChatSession("https://api.example.test", "synthetic-guest-token");
  await until(async () => (await cache.load()).length === 2);
  return { container, calls, setNow: value => { now = value; },
    cache,
    async remount(token = "synthetic-guest-token") {
      await act(async () => root.unmount());
      root = createRoot(container);
      await act(async () => root.render(createElement(GuestPinAIChat, { apiBase: "https://api.example.test", guestToken: token })));
      await until(() => !container.querySelector("textarea").disabled);
    },
    confirm: () => [...container.querySelectorAll("button")].find(b => /Confirmar cambio|Confirm change/.test(b.textContent)) };
}

test("actual card renders canonical quote fields, PR timezone, and keeps its credential private", async t => {
  const h = await mount(t);
  assert.equal(h.calls.length, 1);
  assert.match(h.container.textContent, /3\.35/);
  assert.match(h.container.textContent, /4\.47/);
  assert.match(h.container.textContent, /1\.12/);
  assert.match(h.container.textContent, /11:00/);
  assert.match(h.container.textContent, /America\/Puerto_Rico/);
  assert.doesNotMatch(h.container.innerHTML, /private-synthetic-confirmation/);
  assert.equal(h.confirm().disabled, false);
});

test("reload restores dialogue and the same pending quote without sending or confirming", async t => {
  const h = await mount(t);
  const raw = JSON.stringify({ ...window.sessionStorage });
  assert.doesNotMatch(raw, /private-synthetic-confirmation|Cotización|synthetic-guest-token/);
  await h.remount();
  assert.match(h.container.textContent, /Cotización preparada/);
  assert.match(h.container.textContent, /Conversación recuperada/);
  assert.match(h.container.textContent, /4\.47/);
  assert.equal(h.confirm().disabled, false);
  assert.equal(h.calls.length, 1);
  await act(async () => h.confirm().click());
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1].body, { confirmationToken: "private-synthetic-confirmation" });
});

test("returning after quote expiry restores the card disabled, with no request", async t => {
  const h = await mount(t);
  h.setNow(deadline + 1);
  await h.remount();
  assert.equal(h.confirm().disabled, true);
  assert.match(h.container.textContent, /La cotización venció/);
  assert.equal(h.calls.length, 1);
});

test("another reservation cannot receive the previous conversation or its credential", async t => {
  const h = await mount(t);
  await h.remount("other-synthetic-guest-token");
  assert.doesNotMatch(h.container.textContent, /Cotización preparada|4\.47/);
  assert.equal(h.confirm(), undefined);
  assert.equal(h.calls.length, 1);
});

test("confirmed result restores without replaying confirmation", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  await until(async () => Boolean((await h.cache.load())[1]?.actionResult));
  await h.remount();
  assert.match(h.container.textContent, /Pago requerido/);
  assert.equal(h.confirm(), undefined);
  assert.equal(h.calls.length, 2);
});

test("corrupt encrypted storage is discarded without rendering a confirmation", async t => {
  const h = await mount(t);
  const key = window.sessionStorage.key(0);
  window.sessionStorage.setItem(key, '{"iv":"broken","data":"broken"}');
  await h.remount();
  assert.equal(h.confirm(), undefined);
  assert.doesNotMatch(h.container.textContent, /Cotización preparada/);
  assert.equal(h.calls.length, 1);
});

test("saved dialogue expires after 24 hours even if the tab remains available", async t => {
  const h = await mount(t);
  h.setNow(deadline + 24 * 60 * 60 * 1000);
  await h.remount();
  assert.equal(h.confirm(), undefined);
  assert.doesNotMatch(h.container.textContent, /Cotización preparada/);
  assert.equal(h.calls.length, 1);
});

test("cache scope includes API origin and encrypted data cannot be moved to another scope", async t => {
  const h = await mount(t);
  const original = window.sessionStorage.getItem(window.sessionStorage.key(0));
  const other = await createGuestChatSession("https://other-api.example.test", "synthetic-guest-token");
  await other.save([]);
  const otherKey = window.sessionStorage.key(1);
  window.sessionStorage.setItem(otherKey, original);
  assert.deepEqual(await other.load(), []);
  assert.equal((await h.cache.load()).length, 2);
});

test("snapshot writes retain only bounded recent dialogue", async t => {
  const h = await mount(t);
  await h.cache.save(Array.from({ length: 80 }, (_, i) => ({ id: String(i), role: "guest", text: `Message ${i}` })));
  const saved = await h.cache.load();
  assert.equal(saved.length, 40);
  assert.equal(saved[0].id, "40");
  assert.equal(saved[39].id, "79");
});

test("unavailable storage surfaces a recovery warning while the chat remains usable", async t => {
  const h = await mount(t);
  t.mock.method(dom.window.Storage.prototype, "getItem", () => { throw new Error("Storage denied"); });
  await h.remount();
  assert.match(h.container.textContent, /no permite conservar la conversación/);
  assert.equal(h.container.querySelector("textarea").disabled, false);
  assert.equal(h.calls.length, 1);
});

for (const [outcome, expected] of [["WAITING_FOR_PAYMENT", /Pago requerido/],
  ["WAITING_FOR_HOST", /Pendiente de revisión/], ["REVIEW_REQUIRED", /cotización debe actualizarse/],
  ["EXECUTED", /Cambio confirmado/]]) {
  test(`explicit synthetic confirmation renders ${outcome}`, async t => {
    const h = await mount(t, { outcome });
    assert.equal(h.calls.length, 1, "Rendering must not confirm automatically");
    await act(async () => h.confirm().click());
    assert.equal(h.calls.length, 2);
    assert.match(h.calls[1].url, /action-proposals\/synthetic-proposal\/confirm$/);
    assert.deepEqual(h.calls[1].body, { confirmationToken: "private-synthetic-confirmation" });
    assert.match(h.container.textContent, expected);
    assert.equal(h.confirm(), undefined);
    assert.equal(Boolean(h.container.querySelector("a")), outcome === "WAITING_FOR_PAYMENT");
    if (outcome !== "EXECUTED") assert.doesNotMatch(h.container.textContent, /Cambio confirmado/);
  });
}

test("already expired quote cannot send a confirmation", async t => {
  const h = await mount(t, { expiry: deadline - 120_000 });
  assert.equal(h.confirm().disabled, true);
  await act(async () => h.confirm().click());
  assert.equal(h.calls.length, 1);
  assert.match(h.container.textContent, /La cotización venció/);
});

test("deadline crossing is blocked at click time before the next timer refresh", async t => {
  const h = await mount(t);
  h.setNow(deadline);
  await act(async () => h.confirm().click());
  assert.equal(h.calls.length, 1);
  assert.match(h.container.textContent, /La cotización venció/);
});

test("focus refresh disables an expired English card", async t => {
  const h = await mount(t, { language: "en-US" });
  h.setNow(deadline);
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.equal(h.confirm().disabled, true);
  assert.match(h.container.textContent, /This quote has expired/);
  assert.equal(h.calls.length, 1);
});
