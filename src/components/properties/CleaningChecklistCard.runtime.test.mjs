import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('host edits property checklist with revision protection and explicit conflict reload', async () => {
  const tmp = await mkdtemp(path.join(process.cwd(), '.checklist-ui-test-'));
  const dom = new JSDOM("<div id='root'></div>", { url: 'https://app.pin-ngo.com' });
  const originalFetch = globalThis.fetch;
  for (const key of ['window', 'document', 'HTMLElement', 'Event']) globalThis[key] = dom.window[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let root;
  let server = { revision: 1, items: [{ id: 'bath', es: 'Limpiar baño', en: 'Clean bathroom', required: true }] };
  let reads = 0;
  const writes = [];
  const waitFor = async predicate => {
    for (let i = 0; i < 40 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.ok(predicate());
  };
  const clickButton = async name => {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent === name);
    assert.ok(button); assert.equal(button.disabled, false);
    await act(async () => button.click());
  };
  try {
    const outfile = path.join(tmp, 'entry.mjs');
    await build({ stdin: { contents: "export { CleaningChecklistCard as Card } from './src/components/properties/CleaningChecklistCard'; export { AuthProvider } from './src/auth/AuthProvider';", resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE: 'https://api.test', DEV: true }) } });
    const ui = await import(pathToFileURL(outfile).href);
    globalThis.fetch = async (url, init) => {
      const endpoint = new URL(url).pathname;
      let data; let status = 200;
      if (endpoint === '/auth/me') data = { user: { id: 'host', orgId: 'org', role: 'ORG_ADMIN' } };
      else if (endpoint === '/api/properties/property/cleaning-checklist') {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body); writes.push(body);
          if (writes.length === 1) { server = { ...body, revision: 2 }; data = server; }
          else { status = 409; data = { error: 'CHECKLIST_REVISION_CONFLICT' }; }
        } else { reads++; data = server; }
      } else throw new Error(`Unexpected endpoint: ${endpoint}`);
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    };
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(ui.AuthProvider, null, React.createElement(ui.Card, { propertyId: 'property' })))));
    assert.equal(reads, 0);
    const details = document.querySelector('details');
    await act(async () => { details.open = true; details.dispatchEvent(new dom.window.Event('toggle')); });
    await waitFor(() => document.querySelector('input[type="checkbox"]'));
    await act(async () => document.querySelector('input[type="checkbox"]').click());
    await clickButton('Save checklist');
    await waitFor(() => writes.length === 1 && !document.querySelector('fieldset').disabled);
    assert.deepEqual(writes[0], { revision: 1, items: [{ id: 'bath', es: 'Limpiar baño', en: 'Clean bathroom', required: false }] });
    assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
    await act(async () => document.querySelector('input[type="checkbox"]').click());
    await clickButton('Save checklist');
    await waitFor(() => document.querySelector('[role="alert"]'));
    assert.equal(writes[1].revision, 2);
    assert.match(document.querySelector('[role="alert"]').textContent, /Reload before saving/);
    assert.equal(document.querySelector('input[type="checkbox"]').checked, true);
    await clickButton('Reload');
    await waitFor(() => !document.querySelector('[role="alert"]') && !document.querySelector('input[type="checkbox"]').checked);
    assert.ok(reads >= 2);
  } finally {
    if (root) await act(async () => root.unmount());
    cache.clear(); globalThis.fetch = originalFetch; dom.window.close();
    await rm(tmp, { recursive: true });
  }
});
