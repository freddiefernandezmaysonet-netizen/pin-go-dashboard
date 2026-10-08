import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

test("cleaner visiting a host route sees only own cleaning page in preferred language", async () => {
  const tmp = await mkdtemp(path.join(process.cwd(), ".cleaner-ui-test-"));
  const dom = new JSDOM("<div id='root'></div>", { url: "https://app.pin-ngo.com" });
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const requests = [];
  const checklistWrites = [];
  let checked = false;
  let cancelled = false;
  let cancellations = 0;
  for (const key of ["window", "document", "HTMLElement", "Event"]) globalThis[key] = dom.window[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const outfile = path.join(tmp, "entry.mjs");
  let root;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await build({ stdin: { contents: `export { default as Page } from './src/pages/cleaner/MyCleaningsPage'; export { RequireCleaner, RequireHost } from './src/auth/RequireCleaner'; export { AuthProvider } from './src/auth/AuthProvider'; export { BrandProvider } from './src/branding/BrandProvider';`, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, packages: "external", platform: "node", format: "esm", outfile, jsx: "automatic", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ VITE_API_BASE: "https://api.test", DEV: true }) } });
    const ui = await import(pathToFileURL(outfile).href);
    globalThis.fetch = async (url, init) => {
      const endpoint = new URL(url).pathname; requests.push(endpoint);
      let data;
      if (endpoint === "/api/public/brand-context") data = { ok: true, data: { kind: "PIN_GO_STANDARD", displayName: "Pin&Go", logoUrl: null, faviconUrl: null, primaryColor: null, onPrimaryColor: null, organizationSlug: null, version: null, poweredByPinGo: true } };
      else if (endpoint === "/auth/me") data = { user: { id: "user", orgId: "org", role: "CLEANER", email: "maria@example.com" } };
      else if (endpoint === "/api/cleaner/me") data = { id: "staff", fullName: "Maria", preferredLanguage: "es" };
      else if (endpoint === "/api/cleaner/cleanings") data = { items: [{ id: "task", property: { id: "p", name: "Casa Collores", timezone: "America/Puerto_Rico" }, status: cancelled ? "CANCELLED" : "CONFIRMED", departureAt: new Date().toISOString(), scheduledStartAt: new Date(Date.now() + 60000).toISOString(), durationCommitmentMinutes: 60, startedAt: null, completedAt: null, access: { startsAt: new Date(Date.now() + 60000).toISOString(), endsAt: new Date(Date.now() + 7200000).toISOString(), status: "COMPLETED" } }], nextCursor: null };
      else if (endpoint === "/api/cleaner/cleanings/task/cancel" && init?.method === "POST") { cancellations++; cancelled = true; data = {}; }
      else if (endpoint === "/api/cleaner/cleanings/task/issues" && !init?.method) data = { reports: [], assessment: { decision: "ACCESS_EXTENSION_REQUIRED", estimatedFinishAt: null, proposedAccessEnd: null, actionsExecuted: false, accessChanged: false } };
      else if (endpoint === "/api/cleaner/cleanings/task/checklist") data = { id: "checklist", editable: true, legacy: false, items: [{ id: "item", labelEs: "Limpiar baño", labelEn: "Clean bathroom", required: true, checked, version: checked ? 1 : 0 }] };
      else if (endpoint === "/api/cleaner/cleanings/task/checklist/item" && init?.method === "PATCH") { checklistWrites.push(JSON.parse(init.body)); checked = true; data = {}; }
      else throw new Error(`Unexpected API ${endpoint}`);
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    root = createRoot(document.getElementById("root"));
    await act(async () => {
      root.render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(ui.BrandProvider, null, React.createElement(ui.AuthProvider, null, React.createElement(MemoryRouter, { initialEntries: ["/overview"] }, React.createElement(Routes, null,
        React.createElement(Route, { path: "/overview", element: React.createElement(ui.RequireHost, null, React.createElement("div", null, "Host secrets")) }),
        React.createElement(Route, { path: "/my-cleanings", element: React.createElement(ui.RequireCleaner, null, React.createElement(ui.Page)) })
      ))))));
    });
    for (let i = 0; i < 20 && !document.body.textContent.includes("Casa Collores"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Mis limpiezas/);
    assert.match(document.body.textContent, /Casa Collores/);
    assert.match(document.body.textContent, /Confirmada/);
    assert.match(document.body.textContent, /Trabajo/);
    assert.match(document.body.textContent, /Acceso/);
    assert.equal(document.body.textContent.includes("Host secrets"), false);
    assert.equal(document.querySelector("article").textContent.includes("Completada"), false);
    assert.equal(requests.some(endpoint => endpoint.includes("properties") || endpoint.includes("overview")), false);
    assert.equal(requests.some(endpoint => endpoint.endsWith("/checklist")), false);
    const details = document.querySelector("details");
    await act(async () => { details.open = true; details.dispatchEvent(new dom.window.Event("toggle")); });
    for (let i = 0; i < 20 && !document.body.textContent.includes("Limpiar baño"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Limpiar baño/);
    assert.equal(document.body.textContent.includes("Clean bathroom"), false);
    await act(async () => document.querySelector('input[type="checkbox"]').click());
    for (let i = 0; i < 20 && !document.body.textContent.includes("1/1"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.deepEqual(checklistWrites, [{ checked: true, version: 0 }]);
    assert.match(document.body.textContent, /1\/1 puntos completados/);
    const button = label => [...document.querySelectorAll('button')].find(candidate => candidate.textContent === label);
    assert.equal(requests.some(endpoint => endpoint.endsWith("/issues")), false);
    await act(async () => button("Reportar un problema").click());
    for (let i = 0; i < 20 && !requests.some(endpoint => endpoint.endsWith("/issues")); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Llegaré tarde/);
    assert.equal(document.body.textContent.includes("No puedo completar el trabajo"), false);
    assert.equal(document.querySelector('textarea').maxLength, 1000);
    assert.equal(button("Registrar reporte").disabled, true);
    for (let i = 0; i < 20 && !document.body.textContent.includes("Todavía no se ha aplicado"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Todavía no se ha aplicado/);
    await act(async () => cache.setQueryData(["cleaner-issues", "task"], { reports: [], assessment: {
      decision: "ACCESS_EXTENDED", proposedAccessEnd: new Date(Date.now() + 3600000).toISOString(),
      estimatedFinishAt: null, actionsExecuted: true, accessChanged: true,
    } }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Tu acceso fue extendido con confirmación de TTLock/);
    assert.match(document.body.textContent, /Acceso válido hasta/);
    await act(async () => cache.setQueryData(["cleaner-issues", "task"], { reports: [], assessment: {
      decision: "HOST_REVIEW_REQUIRED", proposedAccessEnd: null, estimatedFinishAt: null,
      actionsExecuted: false, accessChanged: false,
    } }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(document.body.textContent.includes("Acceso válido hasta"), false);
    assert.equal(cancellations, 0);
    await act(async () => button("Cancelar limpieza").click());
    assert.equal(cancellations, 0);
    assert.match(document.body.textContent, /¿Confirmas que ya no puedes/);
    Date.now = () => originalNow() + 120000;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
    assert.equal(button("Sí, cancelar limpieza"), undefined);
    assert.equal(button("Cancelar limpieza"), undefined);
    assert.equal(cancellations, 0);
    Date.now = originalNow;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
    await act(async () => button("Sí, cancelar limpieza").click());
    for (let i = 0; i < 20 && !document.body.textContent.includes("Cancelada"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(cancellations, 1);
    assert.match(document.body.textContent, /Cancelada/);
    assert.equal(button("Cancelar limpieza"), undefined);
    assert.equal(button("Reportar un problema"), undefined);
    assert.ok(button("Reportes y seguimiento"));
    await act(async () => cache.setQueryData(["cleaner-issues", "task"], {
      reports: [{ id: "own-report", kind: "INCOMPLETE", reportedAt: new Date().toISOString(), estimatedAt: null }],
      assessment: { decision: "REPORT_SUPERSEDED", actionsExecuted: false, accessChanged: false },
      canReport: false, recoveryOutcome: { state: "BACKUP_OFFER_PENDING" },
    }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Último reporte/);
    assert.match(document.body.textContent, /falta su aceptación/);
    assert.equal(button("Registrar reporte"), undefined);
    assert.equal(document.querySelector("textarea"), null);
    await act(async () => cache.setQueryData(["cleaner-issues", "task"], {
      ...cache.getQueryData(["cleaner-issues", "task"]), recoveryOutcome: { state: "BACKUP_ACCEPTED" },
    }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Un respaldo aceptó la limpieza/);
    await act(async () => cache.setQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }], {
      ...cache.getQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }]), pages: [{ items: [{
        ...cache.getQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }]).pages[0].items[0], status: "REASSIGNED",
      }], nextCursor: null }],
    }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Reasignada/);
    assert.ok(button("Reportes y seguimiento"));
    assert.match(document.body.textContent, /Un respaldo aceptó la limpieza/);
    assert.equal(button("Abrir limpieza"), undefined);
    await act(async () => cache.setQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }], {
      ...cache.getQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }]), pages: [{ items: [{
        ...cache.getQueryData(["cleaner-tasks", "user", "today", { q: "", status: "", from: "", to: "" }]).pages[0].items[0], status: "COMPLETED", completedAt: new Date().toISOString(),
      }], nextCursor: null }],
    }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.match(document.body.textContent, /Completada/);
    assert.ok(button("Reportes y seguimiento"));
    assert.equal(button("Registrar reporte"), undefined);
    assert.equal(document.body.textContent.includes("Pin AI revisará el caso"), false);
  } finally {
    if (root) await act(async () => root.unmount());
    cache.clear(); globalThis.fetch = originalFetch; Date.now = originalNow;
    dom.window.close();
    await rm(tmp, { recursive: true });
  }
});
