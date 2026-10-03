import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "https://host.example.test", pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
let output = ts.transpileModule(readFileSync(new URL("./ChannexInbox.tsx", import.meta.url), "utf8").replace('import "./ChannexInbox.css";', "").replace("import.meta.env.VITE_API_BASE", '"https://api.example.test"'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
for (const specifier of ["react", "react/jsx-runtime", "@tanstack/react-query"]) output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(import.meta.resolve(specifier)));
const { default: Inbox } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  assert.fail("Inbox did not reach expected state");
}
async function mount(t, { unknown = false, closed = false, unavailable = false, aiEnabled = false, automatic = false, bookingId = null, reservationNumber = null } = {}) {
  sessionStorage.clear();
  const posts = [], thread = { id: "thread-1", title: "Consulta de Ana", provider: "Airbnb", isClosed: closed, bookingId, reservationNumber, messageCount: 1 };
  const history = [{ id: "msg-1", text: "¿Está disponible?", sender: "guest", insertedAt: "2026-10-03T01:00:00Z", attachments: [] }];
  const automation = { enabled: automatic, mode: automatic ? "AUTO" : "OFF", reason: null, sending: false };
  t.mock.method(globalThis, "fetch", async (raw, init) => {
    const url = new URL(raw);
    assert.equal(url.origin, "https://api.example.test");
    assert.equal(init.credentials, "include");
    if (unavailable) return new Response(JSON.stringify({ error: "HOST_INBOX_DISABLED" }), { status: 503 });
    if (init.method === "POST") {
      posts.push({ path: url.pathname, key: init.headers["idempotency-key"], ...JSON.parse(init.body) });
      if (url.pathname.endsWith("/pin-ai-control")) { automation.mode = JSON.parse(init.body).mode; automation.reason = automation.mode === "HUMAN" ? "HOST_TAKEOVER" : null; return new Response(JSON.stringify(automation)); }
      if (url.pathname.endsWith("/pin-ai-draft")) return new Response(JSON.stringify({ text: "Tenemos estacionamiento en la propiedad.", requiresHumanReview: false, basedOnMessageId: "msg-1", sent: false }));
      if (unknown) return new Response(JSON.stringify({ error: "HOST_INBOX_SEND_OUTCOME_UNKNOWN" }), { status: 409 });
      history.push({ ...history[0], id: "msg-2", sender: "property", text: JSON.parse(init.body).text });
      return new Response(JSON.stringify({ message: history[1], replayed: false }));
    }
    if (url.pathname.endsWith("/properties")) return new Response(JSON.stringify({ items: [{ id: "p1", name: "Casa Uno", pinAIDraftsEnabled: aiEnabled }, { id: "p2", name: "Casa Dos" }] }));
    if (url.pathname.endsWith("/messages")) return new Response(JSON.stringify({ thread, items: history, page: 1, limit: 25, total: history.length, automation }));
    return new Response(JSON.stringify({ items: [thread], page: 1, limit: 25, total: 1 }));
  });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container), client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const render = actor => act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(Inbox, { actor }))));
  await render("org-a:host-a");
  t.after(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  return { container, posts, render };
}
async function selectThread(h) {
  await until(() => h.container.querySelector("select"));
  await act(async () => { const select = h.container.querySelector("select"); select.value = "p1"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => h.container.querySelector("button[aria-pressed]"));
  await act(async () => h.container.querySelector("button[aria-pressed]").click());
  await until(() => h.container.querySelector("article"));
}
async function compose(h, text) {
  await act(async () => {
    const input = h.container.querySelector("textarea");
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => h.container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
}
test("host reads an inquiry and submits one text reply to the selected destination", async t => {
  const h = await mount(t); await selectThread(h);
  assert.match(h.container.textContent, /Consulta sin reserva/);
  await compose(h, "Sí, está disponible.");
  await until(() => h.container.textContent.includes("Respuesta aceptada"));
  assert.equal(h.posts.length, 1); assert.equal(h.posts[0].text, "Sí, está disponible.");
  assert.match(h.posts[0].path, /properties\/p1\/threads\/thread-1\/messages$/);
  assert.ok(h.posts[0].key); assert.equal(sessionStorage.length, 0);
});
test("linked reservation number appears in the list and conversation header", async t => {
  const h = await mount(t, { bookingId: "booking-a", reservationNumber: "PG-2026-000060" }); await selectThread(h);
  assert.match(h.container.querySelector("button[aria-pressed]").textContent, /Reserva PG-2026-000060/);
  assert.match(h.container.querySelector("h3").nextElementSibling.textContent, /Reserva PG-2026-000060/);
  assert.equal(h.posts.length, 0);
});
test("unmatched channel booking is identified without inventing a reservation number", async t => {
  const h = await mount(t, { bookingId: "booking-a" }); await selectThread(h);
  assert.match(h.container.textContent, /Reserva pendiente de vincular/);
  assert.doesNotMatch(h.container.textContent, /PG-2026-/);
});
test("uncertain outcome retains its key and blocks automatic resend", async t => {
  const h = await mount(t, { unknown: true }); await selectThread(h); await compose(h, "Respuesta pendiente");
  await until(() => h.container.textContent.includes("No pudimos confirmar"));
  assert.equal(h.container.querySelector("textarea").disabled, true); assert.equal(h.posts.length, 1);
  const saved = JSON.parse(sessionStorage.getItem("channex-reply:v1:org-a:host-a:p1:thread-1"));
  assert.equal(saved.key, h.posts[0].key);
  await act(async () => [...h.container.querySelectorAll("button")].find(b => b.textContent === "Actualizar historial").click());
  assert.equal(h.posts.length, 1);
});
test("changing authenticated actor clears selected conversation and draft", async t => {
  const h = await mount(t); await selectThread(h);
  await h.render("org-b:host-b");
  assert.equal(h.container.querySelector("textarea"), null);
  assert.equal(h.container.querySelector("article"), null);
  assert.equal(h.posts.length, 0);
});
test("closed conversations cannot be replied to", async t => {
  const h = await mount(t, { closed: true }); await selectThread(h);
  assert.equal(h.container.querySelector("textarea"), null); assert.match(h.container.textContent, /Conversación cerrada/);
});
test("disabled runtime shows an actionable status instead of an empty inbox", async t => {
  const h = await mount(t, { unavailable: true });
  await until(() => h.container.querySelector('[role="alert"]'));
  assert.match(h.container.textContent, /todavía no está activada/); assert.equal(h.posts.length, 0);
});
test("Pin AI suggestion is reviewed and edited before a separate manual send", async t => {
  const h = await mount(t, { aiEnabled: true }); await selectThread(h);
  await act(async () => [...h.container.querySelectorAll("button")].find(b => b.textContent === "Sugerir respuesta con Pin AI").click());
  await until(() => h.container.textContent.includes("Aún no enviada"));
  assert.equal(h.posts.length, 1); assert.ok(h.posts[0].path.endsWith("/pin-ai-draft"));
  assert.equal(h.posts[0].messageId, "msg-1"); assert.equal(h.container.querySelector("textarea").value, "");
  await act(async () => [...h.container.querySelectorAll("button")].find(b => b.textContent === "Usar y editar respuesta").click());
  assert.equal(h.container.querySelector("textarea").value, "Tenemos estacionamiento en la propiedad.");
  assert.equal(h.posts.length, 1);
  await compose(h, "Tenemos un espacio de estacionamiento.");
  await until(() => h.posts.length === 2);
  assert.ok(h.posts[1].path.endsWith("/messages")); assert.equal(h.posts[1].text, "Tenemos un espacio de estacionamiento.");
});
test("Pin AI stays hidden for properties outside the enabled scope", async t => {
  const h = await mount(t); await selectThread(h);
  assert.ok(!h.container.textContent.includes("Sugerir respuesta con Pin AI"));
});
test("automatic mode needs no approval button and host can pause then resume future replies", async t => {
  const h = await mount(t, { automatic: true }); await selectThread(h);
  assert.match(h.container.textContent, /Respuestas automáticas/); assert.equal(h.posts.length, 0);
  await act(async () => [...h.container.querySelectorAll("button")].find(b => b.textContent === "Tomar conversación").click());
  await until(() => h.container.textContent.includes("Atención del host"));
  assert.equal(h.posts[0].mode, "HUMAN");
  await act(async () => [...h.container.querySelectorAll("button")].find(b => b.textContent === "Devolver a Pin AI").click());
  await until(() => h.container.textContent.includes("a partir de ahora"));
  assert.equal(h.posts[1].mode, "AUTO"); assert.ok(h.posts.every(p => p.path.endsWith("/pin-ai-control")));
});
