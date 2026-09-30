import assert from 'node:assert/strict';
import test, { before, beforeEach, afterEach, after } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

let dom, temp, root, host, Panel, createRoot, routing;
let calls, confirmations;
const originalFetch = globalThis.fetch;
const originalGlobals = new Map(['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const response = (body = { ok: true, affectedDates: 1, syncQueued: true }, ok = true) => ({ ok, json: async () => body });

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://dashboard.example.test' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event']) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'window' ? dom.window : dom.window[key] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ createRoot } = await import('react-dom/client'));
  routing = await import('react-router-dom');
  temp = mkdtempSync(join(process.cwd(), '.stay-removal-test-'));
  const outfile = join(temp, 'panel.mjs');
  await build({ entryPoints: [resolve('src/components/properties/PropertyCalendarStayRestrictionsPanel.tsx')], outfile,
    bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: 'https://api.example.test' }) }, logLevel: 'silent' });
  ({ PropertyCalendarStayRestrictionsPanel: Panel } = await import(pathToFileURL(outfile).href));
});

beforeEach(async () => {
  calls = []; confirmations = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init, body: JSON.parse(init.body) }); return response(); };
  window.confirm = message => { confirmations.push(message); return true; };
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  const { MemoryRouter, Routes, Route } = routing;
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/properties/property-1/calendar'] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/properties/:id/calendar', element: React.createElement(Panel) })))));
});

afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
after(() => {
  globalThis.fetch = originalFetch;
  dom?.window.close();
  if (temp) rmSync(temp, { recursive: true, force: true });
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

function input(label) {
  const field = [...host.querySelectorAll('label')].find(element => element.querySelector('span')?.textContent === label)?.querySelector('input');
  assert.ok(field, `input ${label}`); return field;
}
function button(text) {
  const element = [...host.querySelectorAll('button')].find(item => item.textContent === text);
  assert.ok(element, `button ${text}`); return element;
}
async function value(label, text) {
  const field = input(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, text);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
    field.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}
async function click(element) { await act(async () => element.click()); }
async function selectField(label) {
  if (!host.querySelector('details').open) await click(host.querySelector('summary'));
  await click(host.querySelector(`input[aria-label="Remove ${label}"]`));
}
async function dates(end) { await value('Start Date', '2026-11-10'); if (end) await value('End Date', end); }

for (const [labels, fields] of [
  [['Minimum Nights'], ['minimumNights']],
  [['Maximum Nights'], ['maximumNights']],
  [['Minimum Nights', 'Maximum Nights'], ['minimumNights', 'maximumNights']],
]) {
  test(`removes only ${fields.join('+')} after confirmation, without sending rates`, async () => {
    await dates('2026-11-11');
    await value('Nightly Rate', '432');
    await value('Minimum Nights', '4');
    await value('Maximum Nights', '8');
    for (const label of labels) await selectField(label);
    await click(button('Remove Stay Restrictions'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.example.test/api/dashboard/properties/property-1/calendar-overrides');
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].credentials, 'include');
    assert.deepEqual(calls[0].body, { dateKeys: ['2026-11-10', '2026-11-11'], fields });
    assert.match(confirmations[0], /2026-11-10 through 2026-11-11 \(2 dates\)/);
    assert.match(confirmations[0], /Property defaults/);
    assert.equal(input('Nightly Rate').value, '432');
    assert.equal(input('Minimum Nights').value, fields.includes('minimumNights') ? '' : '4');
    assert.equal(input('Maximum Nights').value, fields.includes('maximumNights') ? '' : '8');
    assert.match(host.textContent, /Channel update queued/);
    assert.doesNotMatch(host.textContent, /Channels synchronized/);
  });
}

test('single date needs no end date or new minimum/maximum input', async () => {
  await dates(); await selectField('Minimum Nights'); await click(button('Remove Stay Restrictions'));
  assert.deepEqual(calls[0].body.dateKeys, ['2026-11-10']);
  assert.match(confirmations[0], /1 date\)/);
});

test('cancelled confirmation does not mutate', async () => {
  await dates(); await selectField('Minimum Nights');
  window.confirm = () => false;
  await click(button('Remove Stay Restrictions'));
  assert.equal(calls.length, 0);
  assert.equal(host.querySelector('[role="status"]'), null);
});

test('no restriction is preselected and removal controls start compact', async () => {
  assert.equal(host.querySelector('details').open, false);
  await dates();
  assert.equal(button('Remove Stay Restrictions').disabled, true);
  assert.ok([...host.querySelectorAll('input[type="checkbox"]')].every(item => !item.checked));
});

for (const [name, from, to, expected] of [
  ['no dates', '', '', /valid start date/],
  ['reversed range', '2026-11-11', '2026-11-10', /valid start date/],
  ['oversized range', '2026-11-10', '2029-11-10', /500 dates/],
]) {
  test(`rejects ${name} without confirmation or network`, async () => {
    await value('Start Date', from); await value('End Date', to); await selectField('Minimum Nights');
    await click(button('Remove Stay Restrictions'));
    assert.equal(calls.length, 0); assert.equal(confirmations.length, 0);
    assert.match(host.querySelector('[role="alert"]').textContent, expected);
  });
}

test('a backend conflict preserves input and never displays removal success', async () => {
  globalThis.fetch = async () => response({ ok: false, error: 'Remaining maximum would be lower than the minimum.' }, false);
  await dates(); await value('Minimum Nights', '4'); await selectField('Minimum Nights');
  await click(button('Remove Stay Restrictions'));
  assert.match(host.querySelector('[role="alert"]').textContent, /maximum would be lower/);
  assert.equal(input('Minimum Nights').value, '4');
  assert.equal(host.querySelector('[role="status"]'), null);
});

test('missing server confirmation is not represented as a successful deletion', async () => {
  globalThis.fetch = async () => response({ ok: true });
  await dates(); await selectField('Minimum Nights'); await click(button('Remove Stay Restrictions'));
  assert.match(host.querySelector('[role="alert"]').textContent, /did not confirm/);
  assert.equal(host.querySelector('[role="status"]'), null);
});

test('network failure remains retryable and does not clear existing input', async () => {
  globalThis.fetch = async () => { throw new Error('Test network unavailable'); };
  await dates(); await value('Maximum Nights', '7'); await selectField('Maximum Nights');
  await click(button('Remove Stay Restrictions'));
  assert.match(host.querySelector('[role="alert"]').textContent, /network unavailable/);
  assert.equal(input('Maximum Nights').value, '7');
  assert.equal(button('Remove Stay Restrictions').disabled, false);
});

test('an idempotent no-op is reported as no change, not as removed dates', async () => {
  globalThis.fetch = async () => response({ ok: true, affectedDates: 0, syncQueued: false });
  await dates(); await selectField('Minimum Nights'); await click(button('Remove Stay Restrictions'));
  assert.match(host.querySelector('[role="status"]').textContent, /Nothing was changed/);
  assert.doesNotMatch(host.textContent, /Channel update queued/);
});

test('double clicks produce one deletion and concurrent apply is disabled', async () => {
  let finish;
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Promise(resolve => { finish = resolve; }); };
  await dates(); await selectField('Minimum Nights');
  const remove = button('Remove Stay Restrictions');
  await act(async () => { remove.click(); remove.click(); });
  assert.equal(calls.length, 1);
  assert.equal(button('Apply Stay Restrictions').disabled, true);
  assert.ok([...host.querySelectorAll('input')].every(field => field.disabled));
  await act(async () => finish(response()));
  assert.equal(button('Apply Stay Restrictions').disabled, false);
});

test('existing apply still saves only nonblank fields using PUT', async () => {
  await dates(); await value('Minimum Nights', '3'); await click(button('Apply Stay Restrictions'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(calls[0].body, { overrides: [{ date: '2026-11-10', reason: 'Calendar stay restrictions', minimumNights: 3 }] });
  assert.equal(confirmations.length, 0);
});

test('candidate deployment is disabled without disabling main', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(config.git.deploymentEnabled['agent/stay-restrictions-removal-ui-v1'], false);
  assert.notEqual(config.git.deploymentEnabled.main, false);
});
