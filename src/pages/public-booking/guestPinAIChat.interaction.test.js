import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { webcrypto } from "node:crypto";

// Render the actual component with React DOM; all HTTP responses are synthetic.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://portal.example.test", pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
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
  "./pinAIActionStatus": compiledModule("./pinAIActionStatus.ts"),
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

let fixtureSequence = 0;
async function mount(t, { language = "es-PR", expiry = deadline, outcome = "WAITING_FOR_PAYMENT", stayTime } = {}) {
  // A prior unmounted fixture can still finish encryption. Separate scopes keep
  // its pending writes from repopulating this fixture's cleared session.
  const guestToken = `synthetic-guest-token-${++fixtureSequence}`;
  window.sessionStorage.clear();
  Object.defineProperty(dom.window.navigator, "language", { value: language, configurable: true });
  let now = deadline - 60_000;
  t.mock.method(Date, "now", () => now);
  const calls = [];
  const statusCalls = [];
  const historyCalls = [];
  let serverHistory = [];
  let receipt = { proposalId: "synthetic-proposal", proposalStatus: "CONFIRMED", modificationId: "synthetic-modification",
    modificationStatus: "AWAITING_PAYMENT", paymentStatus: "unpaid", paymentExpiresAt: new Date(deadline + 3_600_000).toISOString(),
    appliedAt: null, checkedAt: new Date(now).toISOString() };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.startsWith("https://api.example.test/"), "Network must stay synthetic");
    if (url.endsWith("/history")) {
      historyCalls.push({ url, init });
      assert.equal(init.method, "GET");
      assert.equal(init.cache, "no-store");
      if (serverHistory instanceof Error) throw serverHistory;
      return { ok: true, status: 200, async json() { return { ok: true, version: 1, messages: serverHistory }; } };
    }
    if (url.endsWith("/status")) {
      statusCalls.push({url, init});
      assert.equal(init.method, "GET");
      assert.equal(init.cache, "no-store");
      if (receipt instanceof Error) throw receipt;
      return { ok: true, status: 200, async json() { return { ok: true, status: receipt }; } };
    }
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, async json() { return url.endsWith("/messages")
      ? { ok: true, reply: "Cotización preparada.", requiresHumanReview: false,
          actionProposal: { ...proposal(expiry), quote: { ...proposal(expiry).quote, ...(stayTime ? { stayTime } : {}) } } }
      : { ok: true, action: { actionType: "RESERVATION_MODIFICATION", proposalId: "synthetic-proposal",
          outcome, actionExecuted: outcome === "EXECUTED", checkoutUrl: "https://checkout.example.test/synthetic",
          modificationId: "synthetic-modification", modificationStatus: "AWAITING_PAYMENT", paymentExpiresAt: new Date(deadline + 3_600_000).toISOString() } }; } };
  });
  const container = document.createElement("div");
  document.body.append(container);
  let root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(createElement(GuestPinAIChat, {
    apiBase: "https://api.example.test", guestToken,
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
  const cache = await createGuestChatSession("https://api.example.test", guestToken);
  await until(async () => (await cache.load()).length === 2);
  return { container, calls, setNow: value => { now = value; },
    historyCalls, setHistory: value => { serverHistory = value; },
    statusCalls, setReceipt: value => { receipt = value instanceof Error ? value : { ...receipt, ...value }; },
    cache, guestToken,
    async remount(token = guestToken) {
      await act(async () => root.unmount());
      root = createRoot(container);
      await act(async () => root.render(createElement(GuestPinAIChat, { apiBase: "https://api.example.test", guestToken: token })));
      await until(() => !container.textContent.includes("Recuperando conversación") && !container.textContent.includes("Restoring conversation"));
    },
    confirm: () => [...container.querySelectorAll("button")].find(b => /Confirmar cambio|Confirm change/.test(b.textContent)) };
}

for (const operation of ["EARLY_CHECKIN", "LATE_CHECKOUT"]) {
  for (const language of ["es-PR", "en-US"]) test(`stay-time offer shows exact schedule and consent: ${operation} ${language}`, async t => {
    const stayTime = { operation, requestedLocalTime: operation === "EARLY_CHECKIN" ? "14:00" : "12:00",
      currentCheckIn: "2026-09-27T20:00:00Z", proposedCheckIn: "2026-09-27T18:00:00Z",
      currentCheckOut: "2026-09-28T15:00:00Z", proposedCheckOut: "2026-09-28T16:00:00Z",
      consentText: language === "es-PR" ? "Confirmo el horario por USD 1.12, impuestos incluidos." : "I confirm the time for USD 1.12, including taxes." };
    const h = await mount(t, { language, stayTime, outcome: "EXECUTED" });
    const text = h.container.textContent;
    assert.match(text, operation === "EARLY_CHECKIN" ? /Entrada anticipada|Early check-in/ : /Salida tardía|Late checkout/);
    assert.match(text, /Horario actual|Current time/); assert.match(text, /Nuevo horario|New time/);
    assert.match(text, /impuestos incluidos|tax included/);
    assert.ok(text.includes(stayTime.consentText));
    assert.match(text, /America\/Puerto_Rico/);
    assert.doesNotMatch(h.container.innerHTML, /private-synthetic-confirmation/);
    await h.remount();
    assert.ok(h.container.textContent.includes(stayTime.consentText), "Restored offer retains exact consent");
    await act(async () => h.confirm().click());
    assert.deepEqual(h.calls[1].body, { confirmationToken: "private-synthetic-confirmation" });
    assert.match(h.container.textContent, /Cambio aplicado|Change applied/);
    assert.match(h.container.textContent, /Consulta Acceso|Check Access/);
    assert.equal(h.confirm(), undefined);
  });
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

test("payment link stays in the same tab and restored dialogue checks the paid receipt without another POST", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  assert.equal(h.container.querySelector("a").getAttribute("target"), null);
  await until(async () => Boolean((await h.cache.load())[1]?.actionResult));
  h.setReceipt({ modificationStatus: "APPLIED", paymentStatus: "paid", appliedAt: new Date(deadline - 1000).toISOString() });
  await h.remount();
  await until(() => /Cambio aplicado/.test(h.container.textContent));
  assert.match(h.container.textContent, /Cotización preparada/);
  assert.equal(h.container.querySelector("a"), null);
  assert.equal(h.calls.length, 2, "No repeated confirmation, model call, or payment action on return");
  await until(async () => (await h.cache.load())[1]?.actionResult?.outcome === "EXECUTED");
  const reads = h.statusCalls.length;
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.equal(h.statusCalls.length, reads, "Terminal receipts stop polling");
});

test("the previous tab replaces its stale payment link on focus", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  h.setReceipt({ modificationStatus: "APPLIED", paymentStatus: "paid", appliedAt: new Date(deadline - 1000).toISOString() });
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.match(h.container.textContent, /Cambio aplicado/);
  assert.equal(h.container.querySelector("a"), null);
  assert.equal(h.calls.length, 2);
});

for (const status of ["PAYMENT_PROCESSING", "APPLYING", "EXPIRED", "CANCELLED", "PAYMENT_FAILED"]) {
  test(`receipt ${status} never offers another payment`, async t => {
    const h = await mount(t);
    await act(async () => h.confirm().click());
    h.setReceipt({ modificationStatus: status });
    await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
    assert.equal(h.container.querySelector("a"), null);
    assert.doesNotMatch(h.container.textContent, /Cambio aplicado/);
    assert.match(h.container.textContent, /Pago en proceso|cotización debe actualizarse/);
    assert.equal(h.calls.length, 2);
  });
}

test("status lookup failure hides the payment link instead of claiming success", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  h.setReceipt(new Error("Offline"));
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.match(h.container.textContent, /No se pudo verificar el pago/);
  assert.equal(h.container.querySelector("a"), null);
  assert.doesNotMatch(h.container.textContent, /Cambio aplicado/);
});

test("a receipt for another proposal is rejected without changing the conversation", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  h.setReceipt({ proposalId: "other-proposal", modificationStatus: "APPLIED", appliedAt: new Date(deadline).toISOString() });
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.match(h.container.textContent, /No se pudo verificar el pago/);
  assert.equal(h.container.querySelector("a"), null);
});

test("a receipt for another modification cannot mark this proposal as applied", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  h.setReceipt({ modificationId: "other-modification", modificationStatus: "APPLIED", appliedAt: new Date(deadline).toISOString() });
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  assert.doesNotMatch(h.container.textContent, /Cambio aplicado/);
  assert.equal(h.container.querySelector("a"), null);
});

test("payment success query parameters cannot replace the persisted receipt", async t => {
  const h = await mount(t);
  window.history.replaceState({}, "", "?modificationPayment=success&modificationId=synthetic-modification");
  t.after(() => window.history.replaceState({}, "", "/"));
  await act(async () => h.confirm().click());
  assert.match(h.container.textContent, /Pago requerido/);
  assert.doesNotMatch(h.container.textContent, /Cambio aplicado/);
});

test("a fresh paid receipt at payment click blocks navigation to the old checkout", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  h.setReceipt({ modificationStatus: "APPLIED", paymentStatus: "paid", appliedAt: new Date(deadline - 1000).toISOString() });
  await act(async () => h.container.querySelector("a").click());
  assert.match(h.container.textContent, /Cambio aplicado/);
  assert.equal(h.container.querySelector("a"), null);
  assert.equal(h.calls.length, 2);
});

test("a late receipt is aborted and ignored when switching to another reservation", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  let resolveReceipt;
  let signal;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /\/status$/);
    signal = init.signal;
    return new Promise(resolve => { resolveReceipt = resolve; });
  });
  await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
  await h.remount("different-guest-token");
  assert.equal(signal.aborted, true);
  await act(async () => resolveReceipt({ ok: true, json: async () => ({ ok: true, status: {
    proposalId: "synthetic-proposal", proposalStatus: "CONFIRMED", modificationId: "synthetic-modification",
    modificationStatus: "APPLIED", paymentStatus: "paid", paymentExpiresAt: null,
    appliedAt: new Date(deadline).toISOString(), checkedAt: new Date(deadline).toISOString(),
  } }) }));
  assert.doesNotMatch(h.container.textContent, /Cotización preparada|Cambio aplicado/);
  assert.equal(h.container.querySelector("a"), null);
});

test("corrupt encrypted storage is preserved with a visible recovery error and no actions", async t => {
  const h = await mount(t);
  const key = window.sessionStorage.key(0);
  window.sessionStorage.setItem(key, '{"iv":"broken","data":"broken"}');
  await h.remount();
  assert.equal(h.confirm(), undefined);
  assert.doesNotMatch(h.container.textContent, /Cotización preparada/);
  assert.equal(h.calls.length, 1);
  assert.equal(window.sessionStorage.getItem(key), '{"iv":"broken","data":"broken"}');
  assert.match(h.container.textContent, /No se pudo recuperar la conversación/);
  assert.match(h.container.textContent, /Reintentar recuperación/);
  assert.equal(h.container.querySelector("textarea").disabled, true);
  await assert.rejects(h.cache.load(), /CHAT_HISTORY_RECOVERY_FAILED/);
  await assert.rejects(h.cache.save([]), /CHAT_HISTORY_RECOVERY_FAILED/);
  assert.equal(window.sessionStorage.getItem(key), '{"iv":"broken","data":"broken"}');
});

test("server history restores a paid conversation with no browser snapshot and no confirmation POST", async t => {
  const h = await mount(t);
  const history = await h.cache.load();
  h.setHistory(history.map(m => m.actionProposal ? { ...m, actionResult: {
    actionType: "RESERVATION_MODIFICATION", proposalId: m.actionProposal.proposalId,
    outcome: "EXECUTED", actionExecuted: true, checkoutUrl: null,
    modificationId: "synthetic-modification", modificationStatus: "APPLIED",
  } } : m));
  window.sessionStorage.clear();
  await h.remount();
  assert.match(h.container.textContent, /Cotización preparada/);
  assert.match(h.container.textContent, /Cambio aplicado/);
  assert.equal(h.confirm(), undefined);
  assert.equal(h.container.querySelector("a"), null);
  assert.equal(h.calls.length, 1);
  assert.equal(h.historyCalls.length, 2);
});

test("valid server history wins over corrupt local storage without deleting the ciphertext", async t => {
  const h = await mount(t);
  h.setHistory(await h.cache.load());
  const key = window.sessionStorage.key(0);
  window.sessionStorage.setItem(key, "corrupt-local-copy");
  await h.remount();
  assert.match(h.container.textContent, /Cotización preparada/);
  assert.equal(h.container.querySelector("textarea").disabled, false);
  assert.equal(window.sessionStorage.getItem(key), "corrupt-local-copy");
  assert.equal(h.calls.length, 1);
});

test("server history outage cannot overwrite local history or present a fresh empty conversation", async t => {
  const h = await mount(t);
  const key = window.sessionStorage.key(0);
  const original = window.sessionStorage.getItem(key);
  h.setHistory(new Error("Service unavailable"));
  await h.remount();
  assert.match(h.container.textContent, /No se pudo recuperar la conversación/);
  assert.equal(h.container.querySelector("textarea").disabled, true);
  assert.equal(h.confirm(), undefined);
  assert.equal(window.sessionStorage.getItem(key), original);
  assert.equal(h.calls.length, 1);
});

test("invalid server proposal payload is not rendered or written over valid local history", async t => {
  const h = await mount(t);
  h.setHistory([{ id: "bad", role: "assistant", text: "Invalid", actionProposal: { proposalId: "foreign" } }]);
  await h.remount();
  assert.match(h.container.textContent, /No se pudo recuperar la conversación/);
  assert.equal((await h.cache.load()).length, 2);
  assert.equal(h.confirm(), undefined);
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
  const other = await createGuestChatSession("https://other-api.example.test", h.guestToken);
  await other.save([]);
  const otherKey = window.sessionStorage.key(1);
  window.sessionStorage.setItem(otherKey, original);
  await assert.rejects(other.load(), /CHAT_HISTORY_RECOVERY_FAILED/);
  assert.equal(window.sessionStorage.getItem(otherKey), original);
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

test("a temporary storage read failure preserves history and a retry restores it without requests", async t => {
  const h = await mount(t);
  const key = window.sessionStorage.key(0);
  const original = window.sessionStorage.getItem(key);
  const read = t.mock.method(dom.window.Storage.prototype, "getItem", () => { throw new Error("Storage denied"); });
  await h.remount();
  assert.match(h.container.textContent, /No se pudo recuperar la conversación/);
  assert.equal(h.container.querySelector("textarea").disabled, true);
  read.mock.restore();
  assert.equal(window.sessionStorage.getItem(key), original);
  await h.remount();
  assert.match(h.container.textContent, /Cotización preparada/);
  assert.equal(h.confirm().disabled, false);
  assert.equal(h.calls.length, 1);
});

test("temporary decryption failure preserves the paid card for verified recovery", async t => {
  const h = await mount(t);
  await act(async () => h.confirm().click());
  await until(async () => (await h.cache.load())[1]?.actionResult?.outcome === "WAITING_FOR_PAYMENT");
  const key = window.sessionStorage.key(0);
  const original = window.sessionStorage.getItem(key);
  const decrypt = t.mock.method(webcrypto.subtle, "decrypt", async () => { throw new Error("Temporary crypto failure"); });
  await h.remount();
  assert.match(h.container.textContent, /No se pudo recuperar la conversación/);
  assert.equal(window.sessionStorage.getItem(key), original);
  assert.equal(h.container.querySelector("a"), null);
  decrypt.mock.restore();
  h.setReceipt({ modificationStatus: "APPLIED", paymentStatus: "paid", appliedAt: new Date(deadline).toISOString() });
  await h.remount();
  await until(() => /Cambio aplicado/.test(h.container.textContent));
  assert.equal(h.container.querySelector("a"), null);
  assert.equal(h.calls.length, 2, "Recovery must not send messages or reconfirm");
});

for (const [outcome, expected] of [["WAITING_FOR_PAYMENT", /Pago requerido/],
  ["WAITING_FOR_HOST", /Pendiente de revisión/], ["REVIEW_REQUIRED", /cotización debe actualizarse/],
  ["EXECUTED", /Cambio aplicado/]]) {
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
    if (outcome !== "EXECUTED") assert.doesNotMatch(h.container.textContent, /Cambio aplicado/);
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
