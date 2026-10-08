import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

// Real components and CSS; synthetic requests only. No production login or I/O.
const root = process.cwd(), fixture = await mkdtemp(resolve(root, ".cleaner-browser-"));
const output = resolve(root, "test-artifacts/cleaner-mobile");
await mkdir(output, { recursive: true });
await writeFile(resolve(fixture, "index.html"), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:Arial,sans-serif"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, "main.tsx"), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider} from '../src/auth/AuthProvider';
import {BrandProvider} from '../src/branding/BrandProvider';
import {RequireCleaner} from '../src/auth/RequireCleaner';
import Page from '../src/pages/cleaner/MyCleaningsPage';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><BrandProvider><AuthProvider><MemoryRouter><RequireCleaner><Page/></RequireCleaner></MemoryRouter></AuthProvider></BrandProvider></QueryClientProvider>);
`);
const server = await createServer({ root, server: { host: "127.0.0.1", port: 4179, strictPort: true },
  define: { "import.meta.env.VITE_API_BASE": JSON.stringify("https://cleaner-api.example.invalid"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://cleaner-api.example.invalid") } });
const now = Date.parse("2026-10-07T14:00:00Z"), iso = minutes => new Date(now + minutes * 60000).toISOString();
let browser, page, language = "es", started = false, checked = false;
const errors = [], unexpected = [], checks = [];
try {
  await server.listen(); browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "America/Puerto_Rico" });
  await page.clock.install({ time: new Date(now) });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    const reply = data => route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname === "/api/public/brand-context") return reply({ ok: true, data: { kind: "PIN_GO_STANDARD", displayName: "Pin&Go", poweredByPinGo: true, logoUrl: null, faviconUrl: null, primaryColor: null, onPrimaryColor: null, organizationSlug: null, version: null } });
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.hostname !== "cleaner-api.example.invalid") { unexpected.push(req.url()); return route.abort(); }
    if (url.pathname === "/auth/me") return reply({ user: { id: "user", orgId: "org", role: "CLEANER", email: "synthetic@example.invalid" } });
    if (url.pathname === "/api/cleaner/me/language" && req.method() === "PATCH") { language = req.postDataJSON().language; return reply({}); }
    if (url.pathname === "/api/cleaner/me") return reply({ id: "staff", fullName: "Cleaner de prueba", preferredLanguage: language });
    if (url.pathname === "/api/cleaner/cleanings") {
      const view = url.searchParams.get("view"), minutes = view === "upcoming" ? 1440 : view === "history" ? -1440 : started ? -10 : 60;
      return reply({ items: [{ id: "task", property: { id: "p", name: "Casa Collores · apartamento familiar con terraza y vista al mar", timezone: "America/Puerto_Rico" }, status: view === "history" ? "COMPLETED" : started ? "IN_PROGRESS" : "CONFIRMED", departureAt: iso(minutes), scheduledStartAt: iso(minutes), durationCommitmentMinutes: 60, startedAt: started ? iso(-5) : null, completedAt: view === "history" ? iso(-1380) : null, access: { startsAt: iso(minutes), endsAt: iso(minutes + 180), status: "ENDED" } }], nextCursor: null });
    }
    if (url.pathname === "/api/cleaner/cleanings/task/checklist") return reply({ id: "checklist", editable: started, legacy: false, items: [{ id: "item", labelEs: "Limpiar y desinfectar los baños, revisar las toallas y reponer todos los suministros", labelEn: "Clean and disinfect bathrooms, inspect towels and replenish all supplies", required: true, checked, version: checked ? 1 : 0 }] });
    if (url.pathname === "/api/cleaner/cleanings/task/checklist/item" && req.method() === "PATCH") { checked = req.postDataJSON().checked; return reply({}); }
    if (url.pathname === "/api/cleaner/cleanings/task/issues" && req.method() === "GET") return reply({ reports: [], assessment: null });
    unexpected.push(`${req.method()} ${url.pathname}`); return route.abort();
  });
  const address = `http://127.0.0.1:4179/${basename(fixture)}/index.html`;
  async function capture(name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`);
    const small = await page.locator(".pg-cleaner button, .pg-cleaner select").evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().height < 44).map(n => n.textContent));
    assert.deepEqual(small, [], `${name}: touch targets at least 44px`);
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }); checks.push(name);
  }
  await page.goto(address); await page.getByRole("heading", { name: "Mis limpiezas", exact: true }).waitFor();
  await page.getByText("Confirmada", { exact: true }).waitFor();
  assert.equal(await page.getByText("Completada", { exact: true }).count(), 0, "expired access does not imply completion");
  await page.getByText("Checklist de limpieza", { exact: true }).click();
  await page.getByText(/Limpiar y desinfectar/).waitFor();
  await page.getByRole("button", { name: "Reportar un problema", exact: true }).click();
  await page.getByLabel("Motivo", { exact: true }).fill("Necesito informar un retraso de tráfico.");
  await capture("es-390-confirmed");
  await page.getByRole("button", { name: "Cancelar limpieza", exact: true }).click();
  await page.getByRole("button", { name: "Sí, cancelar limpieza", exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 740 }); await capture("es-320-cancel-prompt");
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await page.getByRole("heading", { name: "My cleanings", exact: true }).waitFor(); await capture("en-320-confirmed");
  await page.getByRole("button", { name: "Upcoming", exact: true }).click(); await page.getByText("Confirmed", { exact: true }).waitFor(); await capture("en-320-upcoming");
  await page.getByRole("button", { name: "History", exact: true }).click(); await page.getByText("Completed", { exact: true }).waitFor(); await capture("en-320-history");
  started = true; await page.reload(); await page.getByText("In progress", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Cancel cleaning", exact: true }).count(), 0);
  await page.getByText("Cleaning checklist", { exact: true }).click(); await page.getByRole("checkbox").click();
  await page.getByText("1/1 items completed", { exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox").isChecked(), true, "checkbox reflects the acknowledged save");
  await page.getByRole("button", { name: "Report an issue", exact: true }).click();
  await page.getByLabel("Situation", { exact: true }).selectOption("INCOMPLETE"); await capture("en-320-incomplete");
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page.getByRole("heading", { name: "Mis limpiezas", exact: true }).waitFor(); await capture("es-390-incomplete");
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  await writeFile(resolve(output, "result.json"), JSON.stringify({ passed: true, scope: "Real React/CSS with synthetic API; no physical NFC", checks, errors, unexpected }, null, 2));
  console.log(`Cleaner browser passed: ${checks.length} mobile states, no overflow/errors/unexpected requests.`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true });
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ error: String(error), errors, unexpected, text: await page?.locator("body").innerText() }, null, 2));
  throw error;
} finally { await browser?.close(); await server.close(); await rm(fixture, { recursive: true, force: true }); }
