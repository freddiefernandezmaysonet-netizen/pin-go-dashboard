import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),fixture=await mkdtemp(resolve(root,'.haas-browser-'));
await writeFile(resolve(fixture,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture,'main.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Page from '../src/pages/admin/AdminHaasPage';import '../src/index.css';createRoot(document.getElementById('root')).render(<Page/>);`);
const server=await createServer({root,server:{host:'127.0.0.1',port:4183,strictPort:true},define:{'import.meta.env.VITE_API_BASE':JSON.stringify('https://haas-api.example.invalid')}});
const row={id:'order',organizationName:'Demo Organization',fullName:'Demo Customer',email:'demo@example.invalid',phone:'0000000000',updatedAt:'2026-10-09T12:00:00Z',completedAt:'2026-10-09T12:00:00Z',selection:{model:'pro',termMonths:24},payment:{status:'paid',amountPaidCents:6499,currency:'usd'},installation:{status:'PENDING',lockId:null,scheduledAt:null,notes:''},lock:null};
let browser;const errors=[];let saved;
try{
 await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='haas-api.example.invalid')return route.abort();
  let result;
  if(url.pathname.endsWith('/locks'))result={ok:true,items:[{id:'lock',displayName:'Rental Lock',ttlockLockName:null,property:{name:'Demo Property'}}]};
  else if(request.method()==='PATCH'){
   saved=request.postDataJSON();row.installation={...saved};row.lock={id:'lock',displayName:'Rental Lock',property:{name:'Demo Property'},isActive:true,deviceHealth:{battery:85,batteryProviderResponseAt:'2026-10-09T12:30:00Z',gatewayConnected:true}};result={ok:true};
  }else result={ok:true,items:[row],nextCursor:null};
  return route.fulfill({json:result});
 });
 await page.goto(`http://127.0.0.1:4183/${basename(fixture)}/index.html`);
 await page.getByText('Confirmado por Stripe',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Gestionar instalación',exact:true}).click();
 await page.getByLabel('Estado',{exact:true}).selectOption('COMPLETED');
 assert(await page.getByRole('button',{name:'Guardar',exact:true}).isDisabled());
 await page.getByLabel('Cerradura alquilada',{exact:true}).selectOption('lock');
 await page.getByLabel('Notas',{exact:true}).fill('Installation complete');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await page.getByText('Batería: 85%',{exact:true}).waitFor();assert.equal(saved.expectedUpdatedAt,'2026-10-09T12:00:00Z');assert.equal(saved.lockId,'lock');
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page fits '+width);
 }
 assert.deepEqual(errors,[]);console.log('PASS: confirmed payment, installation form, required lock, revision, battery and mobile layout');
}finally{await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
