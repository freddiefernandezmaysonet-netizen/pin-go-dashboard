import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

test('property tabs preserve drafts, keyboard navigation and first invalid field across hidden panels', async () => {
  const tmp = await mkdtemp(path.join(process.cwd(), '.property-tabs-test-'));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.pin-ngo.com' });
  const originals = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Event']) {
    originals.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  let root, mounted = 0, unmounted = 0, submitted = 0, independentSaves = 0;
  try {
    const outfile = path.join(tmp, 'entry.mjs');
    await build({ entryPoints: ['src/components/properties/PropertyEditTabs.tsx'], bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile, jsx: 'automatic' });
    const { PropertyEditTabs, PROPERTY_EDIT_TABS } = await import(pathToFileURL(outfile).href);
    function Draft() {
      const [value, setValue] = React.useState('Initial');
      React.useEffect(() => { mounted++; return () => { unmounted++; }; }, []);
      return React.createElement('div', null,
        React.createElement('input', { id: 'draft', value, onChange: event => setValue(event.target.value) }),
        React.createElement('button', { type: 'button', onClick: () => setValue('Edited') }, 'Edit draft'),
        React.createElement('button', { type: 'button', onClick: () => independentSaves++ }, 'Save card'));
    }
    const panels = Object.fromEntries(PROPERTY_EDIT_TABS.map(tab => [tab.id, React.createElement('input', { id: `field-${tab.id}`, required: tab.id === 'booking' || tab.id === 'taxes' })]));
    panels.cleaning = React.createElement(Draft);
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement('form', { onSubmit: event => { event.preventDefault(); submitted++; } },
      React.createElement(PropertyEditTabs, { panels }), React.createElement('button', { type: 'submit' }, 'Save property'))));
    const tab = id => document.getElementById(`property-tab-${id}`);
    const click = async element => act(async () => element.click());
    assert.equal(document.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
    assert.equal(tab('general').getAttribute('aria-selected'), 'true');
    await click(tab('cleaning'));
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Edit draft'));
    await click(tab('pricing')); await click(tab('cleaning'));
    assert.equal(document.getElementById('draft').value, 'Edited');
    assert.equal(mounted, 1); assert.equal(unmounted, 0); assert.equal(submitted, 0);
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Save card'));
    assert.equal(independentSaves, 1); assert.equal(submitted, 0);
    await act(async () => tab('cleaning').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    assert.equal(document.activeElement, tab('taxes'));
    await act(async () => tab('taxes').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.equal(document.activeElement, tab('general'));
    // A single native validation pass reports failures in multiple hidden tabs.
    await act(async () => document.querySelector('form').checkValidity());
    assert.equal(tab('booking').getAttribute('aria-selected'), 'true');
    assert.equal(document.activeElement.id, 'field-booking');
    assert.equal(submitted, 0);
    document.getElementById('field-booking').value = 'Valid'; document.getElementById('field-taxes').value = 'Valid';
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Save property'));
    assert.equal(submitted, 1);
    assert.equal(document.getElementById('draft').value, 'Edited');
  } finally {
    if (root) await act(async () => root.unmount());
    for (const [key, original] of originals) { if (original === undefined) delete globalThis[key]; else globalThis[key] = original; }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT; dom.window.close(); await rm(tmp, { recursive: true, force: true });
  }
});
