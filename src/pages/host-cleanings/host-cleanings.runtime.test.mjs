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
import { MemoryRouter } from 'react-router-dom';
test('host work timeline, filtering and failure state are read-only', async () => {
 const tmp=await mkdtemp(path.join(process.cwd(),'.host-test-'));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://app.pin-ngo.com'});
 const originalFetch=globalThis.fetch, requests=[]; let fail=false, root;
 for(const key of ['window','document','HTMLElement','Event']) globalThis[key]=dom.window[key];
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const outfile=path.join(tmp,'entry.mjs');
 try {
  await build({stdin:{contents:`export {default as Page} from './src/pages/host-cleanings/HostCleaningsPage'; export {AuthProvider} from './src/auth/AuthProvider';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,packages:'external',platform:'node',format:'esm',outfile,jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_API_BASE:'https://api.test',DEV:true})}});
  const ui=await import(pathToFileURL(outfile).href);
  globalThis.fetch=async(url,init)=>{
   requests.push({url:String(url),method:init?.method??'GET'});
   if(new URL(url).pathname==='/auth/me') return Response.json({user:{id:'user',orgId:'org',role:'ORG_ADMIN'}});
   assert.equal(new URL(url).pathname,'/api/host/cleanings');
   if(fail) return Response.json({error:'UNAVAILABLE'},{status:503});
   return Response.json({properties:[{id:'p',name:'Demo'}],staff:[{id:'s',fullName:'Cleaner'}],nextCursor:null,items:[{id:'c',property:{id:'p',name:'Demo',timezone:'America/Puerto_Rico'},cleaner:{id:'s',fullName:'Cleaner'},reservation:{id:'r',number:'PG-2026-000068'},status:'COMPLETED',scheduledStartAt:'2026-10-16T17:41Z',committedEndAt:'2026-10-16T18:11Z',startedAt:'2026-10-16T17:42Z',completedAt:'2026-10-16T18:09Z',actualDurationMinutes:27,checklist:[{id:'t',labelEs:'Limpiar cocina',required:true,checked:true,checkedAt:null}],reports:[{id:'i',kind:'MORE_TIME',reason:'Revisión adicional',reportedAt:'2026-10-16T18:00Z',estimatedAt:null}]}]});
  };
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(QueryClientProvider,{client:cache},React.createElement(ui.AuthProvider,null,React.createElement(MemoryRouter,{initialEntries:['/cleanings?reservationId=r&view=all']},React.createElement(ui.Page))))));
  const settle=async()=>{for(let i=0;i<15;i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});}; await settle();
  assert.match(document.body.textContent,/Completada/); assert.match(document.body.textContent,/Inicio real/); assert.match(document.body.textContent,/Finalización real/); assert.match(document.body.textContent,/27 min/); assert.match(document.body.textContent,/Limpiar cocina/); assert.match(document.body.textContent,/Revisión adicional/);
  assert.ok(document.querySelector('a[href="/reservations/r"]')); assert.ok(requests.some(r=>r.url.includes('reservationId=r')));
  await act(async()=>{const select=document.querySelector('select');select.value='p';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await settle();assert.ok(requests.some(r=>r.url.includes('propertyId=p')));
  const button=text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);
  await act(async()=>button('Historial').click());await settle();assert.ok(requests.some(r=>r.url.includes('view=history')));
  fail=true;await act(async()=>button('Actualizar').click());await settle();assert.match(document.querySelector('[role="alert"]').textContent,/No se pudieron actualizar/);assert.equal(document.querySelectorAll('article').length,0);assert.ok(requests.every(r=>r.method==='GET'));
 }finally{if(root)await act(async()=>root.unmount());cache.clear();globalThis.fetch=originalFetch;dom.window.close();await rm(tmp,{recursive:true});}
});
