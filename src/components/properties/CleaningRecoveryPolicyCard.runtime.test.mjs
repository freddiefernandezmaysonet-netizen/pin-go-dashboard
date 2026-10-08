import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('host policy card saves limits, preserves revision and reloads a conflict without nested forms', async () => {
 const tmp = await mkdtemp(path.join(process.cwd(), '.recovery-ui-test-'));
 const dom = new JSDOM("<form id='property-form'><div id='root'></div></form>", { url: 'https://app.pin-ngo.com' });
 const originalFetch = globalThis.fetch;
 for (const key of ['window','document','HTMLElement','Event']) globalThis[key] = dom.window[key];
 globalThis.IS_REACT_ACT_ENVIRONMENT = true;
 const { createRoot } = await import('react-dom/client');
 const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 let root; let reads = 0; const writes = [];
 let server = { revision: 0, maxDelayMinutes: 30, maxAccessExtensionMinutes: 0, arrivalSafetyMarginMinutes: 0 };
 const waitFor = async predicate => { for(let i=0;i<40 && !predicate();i++) await act(async()=>{await new Promise(r=>setTimeout(r,10));}); assert.ok(predicate()); };
 const button = label => [...document.querySelectorAll('button')].find(x=>x.textContent===label);
 const change = async (index,value) => { const input=document.querySelectorAll('input')[index]; await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,String(value)); input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}); };
 try {
  const outfile=path.join(tmp,'entry.mjs');
  await build({stdin:{contents:"export { CleaningRecoveryPolicyCard as Card } from './src/components/properties/CleaningRecoveryPolicyCard'; export { AuthProvider } from './src/auth/AuthProvider';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,packages:'external',platform:'node',format:'esm',outfile,jsx:'automatic',define:{'import.meta.env':JSON.stringify({VITE_API_BASE:'https://api.test',DEV:true})}});
  const ui=await import(pathToFileURL(outfile).href);
  globalThis.fetch=async(url,init)=>{
   let data; let status=200; const endpoint=new URL(url).pathname;
   if(endpoint==='/auth/me') data={user:{id:'host',orgId:'org',role:'ORG_ADMIN'}};
   else if(endpoint==='/api/properties/property/cleaning-recovery-policy') {
    if(init?.method==='PUT'){const body=JSON.parse(init.body);writes.push(body); if(writes.length===1){server={...body,revision:1};data=server;}else{status=409;data={error:'CLEANING_RECOVERY_POLICY_CONFLICT'};}}
    else {reads++;data=server;}
   } else throw new Error(endpoint);
   return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  };
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(QueryClientProvider,{client:cache},React.createElement(ui.AuthProvider,null,React.createElement(ui.Card,{propertyId:'property'})))));
  assert.equal(reads,0); const details=document.querySelector('details');
  await act(async()=>{details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});
  await waitFor(()=>document.querySelectorAll('input').length===3);
  assert.equal(document.querySelectorAll('form').length,1);
  assert.equal(button('Guardar límites / Save limits').disabled,true);
  await change(1,60);
  assert.equal(button('Guardar límites / Save limits').disabled,false);
  await act(async()=>button('Guardar límites / Save limits').click());
  await waitFor(()=>writes.length===1 && !document.querySelector('fieldset').disabled);
  assert.deepEqual(writes[0],{revision:0,maxDelayMinutes:30,maxAccessExtensionMinutes:60,arrivalSafetyMarginMinutes:0});
  await change(0,45); await act(async()=>button('Guardar límites / Save limits').click());
  await waitFor(()=>document.body.textContent.includes('Recarga antes de guardar'));
  assert.equal(writes[1].revision,1);
  await act(async()=>button('Recargar / Reload').click());
  await waitFor(()=>document.querySelector('input').value==='30');
  assert.equal(button('Guardar límites / Save limits').disabled,true);
 } finally {
  if(root) await act(async()=>root.unmount());cache.clear();globalThis.fetch=originalFetch;dom.window.close();await rm(tmp,{recursive:true});
 }
});
