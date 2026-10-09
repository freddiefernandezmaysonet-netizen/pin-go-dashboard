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
let browser;const errors=[];let saved;let empty=false;let lastListUrl;
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
  }else {lastListUrl=url;const low=url.searchParams.get('battery')==='low';const battery=row.lock?.deviceHealth?.battery;result={ok:true,items:empty || (low && !(battery!=null && battery>=0 && battery<=30))?[]:[row],nextCursor:null};}
  return route.fulfill({json:result});
 });
 await page.goto(`http://127.0.0.1:4183/${basename(fixture)}/index.html`);
 await page.getByText('Confirmado por Stripe',{exact:false}).waitFor();
 assert.equal(await page.locator('.pg-haas h1').evaluate(el=>getComputedStyle(el).fontSize),'28px');
 assert.equal(await page.locator('.pg-haas-card').evaluate(el=>getComputedStyle(el).borderRadius),'18px');
 await page.getByRole('button',{name:'Gestionar instalación',exact:true}).click();
 await page.getByLabel('Estado',{exact:true}).selectOption('COMPLETED');
 assert(await page.getByRole('button',{name:'Guardar',exact:true}).isDisabled());
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Installation form fits '+width);}
 await page.setViewportSize({width:1280,height:900});
 await page.getByLabel('Cerradura alquilada',{exact:true}).selectOption('lock');
 await page.getByLabel('Notas',{exact:true}).fill('Installation complete');
 await page.getByLabel('Dirección de instalación',{exact:true}).fill('Demo address · Suite 2');
 await page.getByLabel('Número de serie de la cerradura',{exact:false}).fill('SERIAL-DEMO');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await page.getByText('85%',{exact:true}).waitFor();assert.equal(saved.expectedUpdatedAt,'2026-10-09T12:00:00Z');assert.equal(saved.lockId,'lock');assert.equal(saved.installationAddress,'Demo address · Suite 2');assert.equal(saved.serialNumber,'SERIAL-DEMO');
 await page.getByText('Demo address · Suite 2',{exact:true}).waitFor();await page.getByText('SERIAL-DEMO',{exact:true}).waitFor();
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page fits '+width);
 }
 await page.getByLabel('Batería',{exact:true}).selectOption('low');
 await page.getByRole('heading',{name:'No hay baterías de 30 % o menos con estos filtros',exact:true}).waitFor();assert.equal(lastListUrl.searchParams.get('battery'),'low');assert.equal(lastListUrl.searchParams.has('cursor'),false);
 row.lock.deviceHealth.battery=30;await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByText('30%',{exact:true}).waitFor();
 await Promise.all([page.waitForResponse(response=>response.url().includes('battery=all')),page.getByLabel('Batería',{exact:true}).selectOption('all')]);await page.getByText('30%',{exact:true}).waitFor();
 empty=true;await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('heading',{name:'Tus contrataciones aparecerán aquí',exact:true}).waitFor();
 assert.equal(await page.locator('.pg-haas-empty').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
 assert.deepEqual(errors,[]);console.log('PASS: confirmed payment, installation form, required lock, revision, battery and mobile layout');
}finally{await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
