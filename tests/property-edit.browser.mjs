import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd(), fixture = await mkdtemp(resolve(root, '.property-browser-'));
const output = resolve(process.env.PROPERTY_EDIT_TEST_OUTPUT || '/tmp/property-edit-browser');
await mkdir(output, { recursive: true });
await writeFile(resolve(fixture, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:Arial"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider} from '../src/auth/AuthProvider';
import {PropertyEditPage as Page} from '../src/pages/properties/PropertyEditPage';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AuthProvider><MemoryRouter initialEntries={['/properties/property/edit']}><Routes><Route path='/properties/:id/edit' element={<Page/>}/><Route path='/properties' element={<div>Saved property</div>}/></Routes></MemoryRouter></AuthProvider></QueryClientProvider>);
`);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 4181, strictPort: true }, define: {
  'import.meta.env.VITE_API_BASE': JSON.stringify('https://property-api.example.invalid'),
  'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://property-api.example.invalid'),
  'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify('') } });
let discountConfig = {enabled:false,combination:"BEST",maxDiscountPercent:100,minimumFinalNightlyRate:0,rules:[]};
let discountVersion = 0; const discountWrites = [];
let browser, page; const errors = [], writes = [], unknown = [];
try {
  await server.listen(); browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'es-PR' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'property-api.example.invalid') { unknown.push(path); return route.abort(); }
    if (path === '/auth/me') return reply({ user: { id: 'host', orgId: 'org', role: 'ORG_ADMIN' } });
    if (path === '/auth/session/activity') return reply({ ok: true });
    if (path === '/api/dashboard/properties/property') {
      if (request.method() === 'PATCH') { writes.push(request.postDataJSON()); return reply({ ok: true }); }
      return reply({ item: { id: 'property', name: 'Casa de prueba', address1: 'Puerto Rico', city: 'San Juan', country: 'PR', timezone: 'America/Puerto_Rico', maxGuests: 4, baseNightlyRate: 100, checkOutTime: '11:00' } });
    }
    if (path === '/api/dashboard/properties/property/direct-discounts') {
      if (request.method() === 'PUT') { const body=request.postDataJSON(); assert.equal(body.version,discountVersion);discountConfig=body.config;discountVersion++;discountWrites.push(body); }
      return reply({config:discountConfig,version:discountVersion});
    }
    if (path === '/api/dashboard/properties/property/direct-discounts/preview') return reply({pricing:{accommodationSubtotalBeforeDiscount:700,accommodationDiscountTotal:101.5,accommodationSubtotalAfterDiscount:598.5,cleaningFee:75,amenitiesTotal:25,taxesTotal:48.9,totalAmount:747.4}});
    if (path.endsWith('/nearby-places') || path.endsWith('/seasons') || path.endsWith('/holiday-pricing')) return reply({ items: [] });
    if (path.endsWith('/cleaning-checklist')) return reply({ revision: 0, items: [] });
    if (path.endsWith('/cleaning-recovery-policy')) return reply({ revision: 0, maxDelayMinutes: 30, maxAccessExtensionMinutes: 0, arrivalSafetyMarginMinutes: 0 });
    if (path.endsWith('/listing-details')) return reply({ ok: true, listingDetails: null });
    if (path.endsWith('/cancellation-policy')) return reply({ ok: true, policy: null });
    if (path.endsWith('/guest-access-settings')) return reply({ ok: true, settings: { propertyId: 'property', propertyName: 'Casa de prueba', maxGuests: 4, guestAccessMode: 'PASSCODE_ONLY', cleaningNfcEnabled: false, configured: false, activeAgreement: null, identityBilling: { version: 'v1', amountCents: 100, currency: 'USD', accepted: true, acceptedAt: '2026-10-08T12:00:00Z' } } });
    if (path.endsWith('/stay-time-settings')) return reply({ ok: true, propertyId: 'property', revision: 1, timezone: 'America/Puerto_Rico', checkInTime: '16:00', checkOutTime: '11:00', currency: 'USD', executionAvailable: true, settings: { earlyCheckin: { enabled: false, limitLocalTime: '12:00', fee: { mode: 'FREE', amountMinor: 0, currency: 'USD' } }, lateCheckout: { enabled: false, limitLocalTime: '14:00', fee: { mode: 'FREE', amountMinor: 0, currency: 'USD' } } } });
    if (path.endsWith('/pin-ai-settings')) return reply({ ok: true, propertyId: 'property', name: 'Casa de prueba', enabled: false, revision: 1, state: 'DISABLED', organization: { enabled: true, revision: 1 }, billing: { version: 'v1', amountCents: 100, currency: 'USD', acceptedVersion: 'v1', acceptedAt: '2026-10-08', collectionReady: true } });
    unknown.push(path); return route.abort();
  });
  await page.goto(`http://127.0.0.1:4181/${basename(fixture)}/index.html`);
  await page.getByRole('tab', { name: 'General', exact: true }).waitFor();
  const general = page.locator('#property-panel-general'), booking = page.locator('#property-panel-booking');
  await general.locator('input').first().fill('Nombre editado');
  await page.getByRole('tab', { name: 'Booking', exact: true }).click();
  await booking.locator('textarea').first().fill('Descripción pendiente');
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  assert.equal(await general.locator('input').first().inputValue(), 'Nombre editado');
  await general.locator('input').first().fill('');
  await page.getByRole('tab', { name: 'Booking', exact: true }).click();
  await booking.getByRole('checkbox', { name: /^Enable damage responsibility protection/ }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'General', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await general.locator('input').first().evaluate(n => n === document.activeElement), true);
  assert.equal(writes.length, 0);
  await general.locator('input').first().fill('Nombre editado');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'Booking', exact: true }).getAttribute('aria-selected'), 'true');
  await booking.getByRole('checkbox', { name: /^Enable damage responsibility protection/ }).click();
  await page.locator('#property-tab-pricing').click();
  const discounts = page.locator('section').filter({has:page.getByRole('heading',{name:'Direct booking discounts',exact:true})});
  await discounts.getByLabel('Enable discounts',{exact:true}).check();
  await discounts.getByLabel(/^Combining discount types/).selectOption('STACK');
  await discounts.getByRole('button',{name:'Add level',exact:true}).click();
  await discounts.getByLabel('Discount (%)',{exact:true}).fill('10');
  await discounts.getByRole('button',{name:'Add level',exact:true}).click();
  await discounts.getByLabel(/^Type/).nth(1).selectOption('LENGTH_OF_STAY');
  await discounts.getByLabel('At least this many nights',{exact:true}).fill('7');
  await discounts.getByRole('button',{name:'Save discounts',exact:true}).click();
  await discounts.getByText('Discounts saved.',{exact:true}).waitFor();
  assert.equal(discountWrites.length,1);assert.equal(writes.length,0,'discount save must not submit parent property form');
  assert.equal(discountWrites[0].config.combination,'STACK');assert.equal(discountWrites[0].config.rules.length,2);
  await discounts.getByLabel('Check-in',{exact:true}).fill('2030-01-02');
  await discounts.getByLabel('Check-out',{exact:true}).fill('2030-01-09');
  await discounts.getByRole('button',{name:'Preview without saving',exact:true}).click();
  await discounts.getByText('Total: $747.40',{exact:true}).waitFor();
  assert.equal(await discounts.getByRole('combobox').count(), 3, 'no independent language selector');
  await page.getByRole('heading',{name:'Direct booking discounts',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'discounts-en.png'),fullPage:true});
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ['general', 'cleaning', 'booking', 'access', 'ai', 'pricing', 'taxes']) {
      await page.locator(`#property-tab-${id}`).click();
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
      if (id === 'cleaning') {
        for (const details of await page.locator('#property-panel-cleaning details').all()) { if ((await details.getAttribute('open')) === null) await details.locator('summary').click(); }
        await page.getByRole('button', {name:'Save checklist',exact:true}).waitFor();
        await page.getByRole('button', {name:'Save limits',exact:true}).waitFor();
      }
      const panelText = await page.locator('[role="tabpanel"]:visible').innerText();
      assert.doesNotMatch(panelText, /Configuración|Descuentos|Guardar|Cargando|Información del alojamiento|Límites|Espacios compartidos|Acuerdo del huésped/);
      if (id === 'access') assert.match(panelText, /Early check-in/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('[role=tabpanel]:not([hidden]) *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1).map(n => ({ tag: n.tagName, text: n.textContent?.slice(0, 70), style: n.getAttribute('style'), width: n.getBoundingClientRect().width })).slice(-12) : []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}/${id}: no horizontal overflow: ${JSON.stringify(overflow)}`);
      await page.screenshot({ path: resolve(output, `${width}-${id}.png`), fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Saved property', { exact: true }).waitFor();
  assert.equal(writes.length, 1); assert.equal(writes[0].name, 'Nombre editado'); assert.equal(writes[0].publicDescription, 'Descripción pendiente');
  assert.deepEqual(errors, []); assert.deepEqual(unknown, []);
  console.log('PASS: seven tabs at desktop/390/320, retained drafts, hidden-field validation and original PATCH payload');
} catch (error) { if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }); console.error(JSON.stringify({ errors, unknown })); throw error; } finally { await browser?.close(); await server.close(); await rm(fixture, { recursive: true, force: true }); }
