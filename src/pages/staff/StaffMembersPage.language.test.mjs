import assert from 'node:assert/strict';
import test, { before, beforeEach, afterEach, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

let dom, temp, root, host, Page, createRoot, staff, calls, failSave;
const originalFetch = globalThis.fetch;
const globals = new Map(['window', 'document', 'navigator', 'HTMLElement', 'Event', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://dashboard.example.test' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event'])
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'window' ? dom.window : dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  ({ createRoot } = await import('react-dom/client'));
  temp = mkdtempSync(join(process.cwd(), '.staff-language-test-'));
  const outfile = join(temp, 'page.mjs');
  await build({ entryPoints: [resolve('src/pages/staff/StaffMembersPage.tsx')], outfile, bundle: true,
    packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE: 'https://api.example.test' }) }, logLevel: 'silent' });
  ({ StaffMembersPage: Page } = await import(pathToFileURL(outfile).href));
});
beforeEach(async () => {
  calls = []; failSave = false;
  staff = [{ id: 'staff-1', organizationId: 'org-1', fullName: 'Cleaner ES', isActive: true, preferredLanguage: 'es' },
    { id: 'staff-2', organizationId: 'org-1', fullName: 'Legacy cleaner', isActive: true }];
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const payload = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, ...init, payload });
    let body;
    let ok = true;
    if (path === '/auth/me') body = { user: { orgId: 'org-1' } };
    else if (path.endsWith('/property-assignments')) body = { properties: [] };
    else if (init.method === 'POST' || init.method === 'PATCH') {
      ok = !failSave;
      if (ok && init.method === 'POST') staff.push({ id: 'created', isActive: true, ...payload });
      if (ok && init.method === 'PATCH') staff = staff.map(item => path.endsWith('/' + item.id) ? { ...item, ...payload } : item);
      body = {};
    } else if (path === '/staff') body = staff;
    else throw new Error('Unexpected API: ' + path);
    return { ok, status: ok ? 200 : 500, json: async () => structuredClone(body), text: async () => 'Save failed' };
  };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(React.createElement(Page)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
after(() => {
  globalThis.fetch = originalFetch; dom?.window.close();
  if (temp) rmSync(temp, { recursive: true, force: true });
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
const select = () => host.querySelector('#staff-preferred-language');
const saves = () => calls.filter(call => ['POST', 'PATCH'].includes(call.method));
async function choose(language) {
  await act(async () => { select().value = language; select().dispatchEvent(new window.Event('change', { bubbles: true })); });
}
async function submit() { await act(async () => host.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); }
async function edit(index = 0) { await act(async () => [...host.querySelectorAll('button')].filter(b => b.textContent === 'Edit')[index].click()); }
test('defaults to English and exposes an accessible two-language selector', () => {
  assert.equal(select().value, 'en');
  assert.deepEqual([...select().options].map(o => [o.value, o.textContent]), [['en', 'English'], ['es', 'Español']]);
  assert.ok(host.querySelector('label[for="staff-preferred-language"]'));
  assert.equal(select().style.width, '100%');
  assert.equal(select().style.minHeight, '44px');
});
for (const language of ['en', 'es']) test(`creates staff with ${language}, reloads the saved language and resets`, async () => {
  const name = host.querySelector('input[placeholder="Full name"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(name, 'New cleaner');
    name.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await choose(language); await submit();
  assert.equal(saves().length, 1);
  assert.equal(saves()[0].method, 'POST');
  assert.equal(saves()[0].credentials, 'include');
  assert.equal(saves()[0].payload.preferredLanguage, language);
  assert.equal(saves()[0].payload.organizationId, 'org-1');
  assert.equal(select().value, 'en');
  await edit(2); assert.equal(select().value, language);
});
test('loads Spanish for editing and persists a switch to English', async () => {
  await edit(); assert.equal(select().value, 'es');
  await choose('en'); await submit();
  assert.equal(saves()[0].path, '/staff/staff-1');
  assert.equal(saves()[0].method, 'PATCH');
  assert.equal(saves()[0].payload.preferredLanguage, 'en');
  await edit(); assert.equal(select().value, 'en');
});
test('legacy staff falls back to English and can switch to Spanish', async () => {
  await edit(1); assert.equal(select().value, 'en');
  await choose('es'); await submit(); await edit(1);
  assert.equal(select().value, 'es');
});
test('failed save keeps the selected language and edit form', async () => {
  await edit(); failSave = true; await choose('en'); await submit();
  assert.equal(select().value, 'en');
  assert.match(host.textContent, /Save failed/);
  assert.match(host.textContent, /Save Changes/);
  assert.equal(staff[0].preferredLanguage, 'es');
});
