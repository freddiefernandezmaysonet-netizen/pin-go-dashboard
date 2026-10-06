import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

// Actual React components with synthetic API responses. Never signs in or calls
// production. Backend integration is covered by the PostgreSQL companion test.
const root = process.cwd();
const fixture = await mkdtemp(resolve(root, ".demo-browser-"));
const output = resolve(root, "test-artifacts/demo-center");
await mkdir(output, { recursive: true });
await writeFile(resolve(fixture, "index.html"), '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo review</title></head><body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, "main.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import AdminDemoCenterPage from '../src/pages/admin/AdminDemoCenterPage';
import GuestCancellationPage from '../src/pages/public-booking/GuestCancellationPage';
import {BrandProvider} from '../src/branding/BrandProvider';
const guest = new URLSearchParams(location.search).has('guest');
createRoot(document.getElementById('root')!).render(guest ? <BrandProvider><MemoryRouter initialEntries={['/booking/manage/synthetic-token']}><Routes><Route path='/booking/manage/:guestToken' element={<GuestCancellationPage/>}/></Routes></MemoryRouter></BrandProvider> : <AdminDemoCenterPage/>);
`);
const server = await createServer({ root, server: { host: "127.0.0.1", port: 4178, strictPort: true },
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://demo-api.example.invalid") } });
let browser, page;
const errors = [], unexpected = [], commands = [];
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, timezoneId: "America/Puerto_Rico" });
  page.on("pageerror", error => errors.push(error.message));
  const prep = { ready: true, blockers: [], property: { name: "Pin&Go Demo Property", timezone: "America/Puerto_Rico",
    cleaningStartOffsetMinutes: 15, cleaningAccessMinutes: 30 }, primaryAdmin: { email: "principal@example.invalid", fullName: "Demo host" },
    cleaner: { id: "synthetic-cleaner", name: "Demo Cleaner", phone: "+12025550123", language: "es" }, lock: { name: "Demo" } };
  let run = null, phase = "PRE_STAY";
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === "127.0.0.1") return route.continue();
    const reply = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (url.pathname.endsWith("/api/public/brand-context")) return reply({ ok: true, data: {
      kind: "PIN_GO_STANDARD", displayName: "Pin&Go", logoUrl: null, faviconUrl: null, primaryColor: null,
      onPrimaryColor: null, organizationSlug: null, version: null, poweredByPinGo: true } });
    if (url.pathname.endsWith("/demo/preparation")) return reply({ ok: true, data: prep });
    if (url.pathname.endsWith("/demo/run")) {
      const input = request.postDataJSON(); commands.push(input);
      if (input.guestEmail === "invalid@example.invalid") return reply({ ok: false, safeToEdit: true, error: "DEMO_RECIPIENTS_CHANGED" }, 409);
      run ??= { requestId: input.requestId, stage: "READY", lastError: null, timezone: prep.property.timezone,
        propertyName: prep.property.name, secureReady: true, manageReservationUrl: "https://demo-api.example.invalid/booking/manage/synthetic-token",
        reservation: { id: "synthetic-reservation", reservationNumber: "PG-2026-000999", guestName: input.guestName,
          checkIn: input.checkIn, checkOut: input.checkOut, accessGrants: [{ id: "synthetic-pin", type: "GUEST", status: "ACTIVE",
            startsAt: input.checkIn, endsAt: input.checkOut, accessCodeMasked: "12*****" }],
          NfcAssignment: [{ id: "synthetic-nfc", role: "CLEANING", status: "ACTIVE", startsAt: input.checkOut, endsAt: input.checkOut }] },
        messages: [{ id: "guest-email", channel: "email", to: input.guestEmail, communicationType: "DIRECT_BOOKING_GUEST_CONFIRMATION", delivery: "DELIVERED" },
          { id: "host-email", channel: "email", to: prep.primaryAdmin.email, communicationType: "DIRECT_BOOKING_HOST_NOTIFICATION", delivery: "ACCEPTED" }],
        confirmations: [{ id: "synthetic-cleaner-confirm", status: "CONFIRMED" }], cleaningWork: [], cleaningWindow: null,
        pinAI: { conversationStarted: true }, incidents: [{ reference: "GI-AABBCCDDEEFF", state: "RESOLVED", publishedReplies: 1, url: "https://demo-api.example.invalid/pin-ai/incidents/GI-AABBCCDDEEFF" }] };
      return reply({ ok: true, data: run });
    }
    if (url.pathname.includes("/demo/runs/")) return reply(run ? { ok: true, data: run } : { ok: false }, run ? 200 : 404);
    if (url.pathname.endsWith("/cancellation-preview")) return reply({ ok: true, managementPhase: phase,
      cancellationAllowed: false, demo: { paymentSimulated: true, identitySimulated: true, timezone: prep.property.timezone },
      reservation: { ...run.reservation, propertyName: prep.property.name, currency: "usd", totalAmount: 0 } });
    if (url.pathname.endsWith("/pin-ai/history")) return reply({ ok: true, messages: [], receipts: [] });
    if (url.pathname.endsWith("/pin-ai/incident-updates")) return reply({ ok: true, incidents: [], updates: [], nextAfter: null });
    unexpected.push(`${request.method()} ${url.pathname}`); return route.abort();
  });
  const address = `http://127.0.0.1:4178/${fixture.split('/').at(-1)}/index.html`;
  await page.goto(address);
  await page.getByText("principal@example.invalid", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Crear reserva Demo" }).isEnabled(), false);
  await page.getByLabel("Email del huésped", { exact: true }).fill("guest@example.invalid");
  await page.getByLabel("Teléfono del huésped", { exact: true }).fill("+12025550125");
  await page.getByLabel("El huésped autoriza los SMS de esta demostración.").check();
  await page.getByLabel(/Los destinatarios mostrados participan/).check();
  await page.screenshot({ path: resolve(output, "desktop-preparation.png"), fullPage: true });
  await page.getByRole("button", { name: "Crear reserva Demo" }).click();
  await page.getByRole("heading", { name: "Reserva PG-2026-000999", exact: true }).waitFor();
  assert.equal(commands.length, 1);
  const requestId = commands[0].requestId;
  await page.reload();
  await page.getByRole("heading", { name: "Reserva PG-2026-000999", exact: true }).waitFor();
  await page.getByRole("button", { name: "Continuar la misma ejecución", exact: true }).click();
  await page.getByRole("button", { name: "Continuar la misma ejecución", exact: true }).waitFor();
  assert.equal(commands.length, 2); assert.equal(commands[1].requestId, requestId);
  assert.equal(await page.getByRole("button", { name: "Preparar siguiente demo" }).isEnabled(), false);
  assert.equal(await page.locator(".vite-error-overlay").count(), 0);
  for (const label of ["1 · Reserva y registro", "2 · Comunicaciones", "3 · Acceso real", "4 · Pin AI", "5 · Incidente y respuesta", "6 · Checkout y limpieza"]) {
    assert.equal(await page.getByRole("heading", { name: label, exact: true }).count(), 1);
  }
  await page.screenshot({ path: resolve(output, "desktop-journey.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, "mobile-journey.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "no horizontal overflow");
  run.reservation.checkOut = new Date(Date.now() - 60000).toISOString();
  run.reservation.accessGrants[0].status = "REVOKED"; run.reservation.NfcAssignment[0].status = "ENDED";
  run.cleaningWork = [{ startConfirmedAt: new Date().toISOString(), completionConfirmedAt: new Date().toISOString() }];
  await page.getByRole("button", { name: "Actualizar estado", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Preparar siguiente demo' && !b.disabled));
  await page.goto(`${address}?guest=1`);
  await page.getByRole("heading", { name: "Reservation #PG-2026-000999", exact: true }).waitFor();
  assert.equal(await page.locator("textarea").count(), 1, "Pin AI is visible for the same pre-stay reservation");
  assert.equal(await page.getByRole("button", { name: /Cancel reservation|Confirm cancellation/i }).count(), 0);
  await page.screenshot({ path: resolve(output, "mobile-manage-reservation.png"), fullPage: true });
  phase = "POST_STAY"; await page.reload();
  await page.getByRole("heading", { name: "Reservation #PG-2026-000999", exact: true }).waitFor();
  assert.equal(await page.locator("textarea").count(), 0, "existing post-stay Pin AI policy is preserved");
  await page.goto(address);
  await page.getByRole("heading", { name: "Reserva PG-2026-000999", exact: true }).waitFor();
  await page.getByRole("button", { name: "Preparar siguiente demo" }).click();
  await page.getByLabel("Email del huésped", { exact: true }).fill("invalid@example.invalid");
  await page.getByLabel("Teléfono del huésped", { exact: true }).fill("+12025550125");
  await page.getByLabel("El huésped autoriza los SMS de esta demostración.").check();
  await page.getByLabel(/Los destinatarios mostrados participan/).check();
  await page.getByRole("button", { name: "Crear reserva Demo" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Email del huésped", { exact: true }).count(), 1, "definitive pre-creation rejection unlocks the form");
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  await writeFile(resolve(output, "result.json"), JSON.stringify({ passed: true, scope: "React components with synthetic API responses",
    checks: ["preparation and consent", "same request after reload and resume", "six journey steps", "mobile overflow", "ENDED NFC permits next demo after cleaning", "same reservation in guest portal", "no commercial guest controls", "pre/post stay Pin AI visibility", "pre-creation rejection recovery"], errors, unexpected }, null, 2));
  console.log("Demo Center browser checks passed; screenshots are in test-artifacts/demo-center.");
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true });
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ error: String(error), errors, unexpected,
    pageText: await page?.locator("body").innerText() }, null, 2));
  console.error({ errors, unexpected });
  throw error;
} finally {
  await browser?.close(); await server.close(); await rm(fixture, { recursive: true, force: true });
}
