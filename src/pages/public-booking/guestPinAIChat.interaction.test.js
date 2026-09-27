import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

// Render the actual component with React DOM; all HTTP responses are synthetic.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://portal.example.test" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
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
const { GuestPinAIChat } = await import(compiledModule("./GuestPinAIChat.tsx", {
  "./pinAIProposalExpiry": compiledModule("./pinAIProposalExpiry.ts"),
}));

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
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(GuestPinAIChat, {
    apiBase: "https://api.example.test", guestToken: "synthetic-guest-token",
  })));
  const input = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, "Extender solo mi salida.");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  return { container, calls, setNow: value => { now = value; },
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
