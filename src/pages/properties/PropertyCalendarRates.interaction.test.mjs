import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
const temp = mkdtempSync(join(process.cwd(), '.calendar-rates-test-'));
await build({ entryPoints: ['src/pages/properties/PropertyCalendarPage.tsx'], outfile: join(temp, 'page.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const { PropertyCalendarPage } = await import(pathToFileURL(join(temp, 'page.mjs')).href);
test('adjacent dates keep real rates and reservations across month navigation; missing rates stay unavailable', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const requests = [];
  globalThis.fetch = async raw => {
    const url = new URL(raw); requests.push(url);
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    let data = { item: { baseNightlyRate: 159 } };
    if (url.pathname.endsWith('nightly-rates')) data = { rates: [{ date: '2027-03-05', rate: 189 }].filter(r => r.date >= from && r.date < to) };
    if (url.pathname.endsWith('/reservations')) data = { items: from <= '2027-03-05' && to > '2027-03-05' ? [{ id: 'r1', checkIn: '2027-03-05', checkOut: '2027-03-06', guestName: 'Test guest' }] : [] };
    if (url.pathname.endsWith('blocked-dates')) data = { items: [] };
    return { ok: true, json: async () => data };
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/calendar?from=2027-02-01'] }, React.createElement(PropertyCalendarPage, { propertyId: 'p1', view: 'single' }))));
    const cell = date => document.querySelector(`[data-calendar-date="${date}"]`);
    assert.match(cell('2027-03-05').getAttribute('aria-label'), /Booked.*\$189/);
    assert.match(cell('2027-03-04').getAttribute('aria-label'), /Nightly rate unavailable/);
    const rateRequest = requests.find(u => u.pathname.endsWith('nightly-rates'));
    assert.equal(rateRequest.searchParams.get('from'), '2027-01-31');
    assert.equal(rateRequest.searchParams.get('to'), '2027-03-07');
    const buttons = document.querySelectorAll('.pgc-calendarToolbar button');
    await act(async () => buttons[2].click());
    assert.match(cell('2027-03-05').getAttribute('aria-label'), /Booked.*\$189/);
    await act(async () => buttons[1].click());
    assert.match(cell('2027-03-05').getAttribute('aria-label'), /Booked.*\$189/);
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); delete globalThis.IS_REACT_ACT_ENVIRONMENT; rmSync(temp, { recursive: true, force: true });
  }
});
