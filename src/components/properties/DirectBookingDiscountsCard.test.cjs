const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildSync } = require('esbuild');
const { JSDOM } = require('jsdom');

test('discount editor loads disabled defaults, adds levels, saves and switches language', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'discount-ui-'));
  const outfile = path.join(dir, 'component.cjs');
  buildSync({ stdin: { contents: `import React, {act} from 'react'; import {createRoot} from 'react-dom/client'; import {DirectBookingDiscountsCard} from './src/components/properties/DirectBookingDiscountsCard'; export {act}; export function mount(el) {const root=createRoot(el);root.render(<DirectBookingDiscountsCard propertyId="p1"/>);return root;}`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, jsx: "automatic", outfile, platform: 'node', format: 'cjs', define: { 'import.meta.env.VITE_API_BASE': '"http://localhost"' } });
  const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
  global.window = dom.window; global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true;
  const config = {enabled:false,combination:'BEST',maxDiscountPercent:100,minimumFinalNightlyRate:0,rules:[]};
  let saved;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    if (options?.method === 'PUT') { saved=JSON.parse(options.body); return {ok:true,json:async()=>({config:saved.config,version:1})}; }
    return {ok:true,json:async()=>({config,version:0})};
  };
  const {mount,act}=require(outfile); let root;
  const click = async label => {const button=[...document.querySelectorAll('button')].find(el=>el.textContent===label); assert.ok(button,label); await act(async()=>button.click());};
  try {
    await act(async()=>{root=mount(document.getElementById('root'));});
    assert.equal(document.querySelector('input[type=checkbox]').checked,false);
    await click('Añadir nivel'); await click('Añadir nivel');
    assert.equal(document.querySelectorAll('legend').length,2);
    await click('Guardar descuentos');
    assert.equal(saved.version,0); assert.equal(saved.config.rules.length,2); assert.equal(saved.config.enabled,false);
    assert.match(document.body.textContent,/Descuentos guardados/);
    const language=document.querySelector('select');
    await act(async()=>{language.value='en';language.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
    assert.match(document.body.textContent,/Direct booking discounts/);
    assert.equal(document.querySelectorAll('legend').length,2);
  } finally {await act(async()=>root?.unmount());global.fetch=originalFetch;dom.window.close();fs.rmSync(dir,{recursive:true,force:true});}
});
