import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd(), fixture = await mkdtemp(resolve(root, '.landing-browser-'));
const output = resolve(process.env.LANDING_TEST_OUTPUT || '/tmp/landing-browser');
await mkdir(output, { recursive: true });
await writeFile(resolve(fixture, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, 'main.tsx'), `import React from 'react'; import {createRoot} from 'react-dom/client'; import Landing from '../src/pages/LandingPage'; import Haas from '../src/components/HaasConfigurator'; import '../src/index.css'; const legacy=location.search.includes('legacy'); createRoot(document.getElementById('root')!).render(legacy?<Haas lang="es"/>:<Landing/>);`);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 4182, strictPort: true }, define: {'import.meta.env.VITE_API_BASE': JSON.stringify('https://landing-api.example.invalid')} });
let browser; const errors=[];
try {
 await server.listen(); browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const url=`http://127.0.0.1:4182/${basename(fixture)}/index.html`;
 await page.goto(url+'?legacy');
 for(const [name,price,id] of [['Essential Lock',29.99,'essential'],['Pro Lock',39.99,'pro'],['Elite Lock',49.99,'elite']]){
  await page.getByRole('button').filter({has:page.getByRole('heading',{name,exact:true})}).click();
  for(const [label,extra,aid] of [['Sin Automatización',0,'none'],['1 Dispositivo',24.99,'one'],['2 Dispositivos',39.99,'two']]){
   await page.getByRole('button').filter({hasText:label}).click();
   assert((await page.locator('aside').innerText()).includes('$'+(price+extra).toFixed(2)));
   const href=await page.locator('aside a').getAttribute('href');assert(href.includes('lock='+id));assert(href.includes('smartDevices='+aid));
  }
 }
 await page.goto(url);await page.getByRole('heading',{name:'Pin&Go administra. Tú ganas libertad.'}).waitFor();
 await page.frameLocator('iframe').first().getByText('Reservas activas',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.loop-number').allTextContents(),['01 — RESERVA','02 — PROTECCIÓN','03 — OPERACIÓN','04 — CIERRE']);
 assert.deepEqual(await page.locator('#hardware h3').allTextContents(),['1. Escoge el término del contrato','2. Escoge tu cerradura','3. Añade automatización inteligente','Pro Lock']);
 await page.frameLocator('iframe').nth(1).getByText('Asistente de tu estadía',{exact:true}).waitFor();
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page fits '+width);
  await page.screenshot({path:resolve(output,`${width}-hero.png`)});
  for(const img of await page.locator('#hardware img').all())assert(await img.evaluate(n=>n.complete&&n.naturalWidth>0),'Original hardware image loaded');
  await page.locator('.ota-logos').scrollIntoViewIfNeeded();
  for(const img of await page.locator('.ota-logos img').all()){await img.evaluate(n=>{n.loading='eager'});await img.waitFor();await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle());assert(await img.evaluate(n=>n.naturalWidth>0),'OTA logo loaded');}
  await page.screenshot({path:resolve(output,`${width}-channels.png`)});
  await page.locator('#hardware').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,`${width}-hardware.png`),fullPage:false});
 }
 await page.setViewportSize({width:1280,height:900});
 assert.equal(await page.locator('#hardware button[aria-pressed]').count(),2);
 for(const [name,prices] of [['Essential Lock',[54.99,44.99]],['Pro Lock',[74.99,64.99]],['Elite Lock',[84.99,74.99]]]){
  await page.locator('#hardware').getByRole('button').filter({has:page.getByRole('heading',{name,exact:true})}).click();
  for(const auto of ['Sin Automatización','1 Dispositivo','2 Dispositivos']){
   await page.locator('#hardware').getByRole('button').filter({hasText:auto}).click();
   for(const [index,term] of ['12 meses','24 meses'].entries()){
    const b=page.locator('#hardware button[aria-pressed]').filter({hasText:term});await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');
    assert((await page.locator('#hardware aside').innerText()).includes(term));
    const summary=await page.locator('#hardware aside').innerText();
    assert(summary.includes('$'+prices[index].toFixed(2)));
    assert.equal(summary.includes('Por definir'),auto!=='Sin Automatización');
    const card=page.locator('#hardware').getByRole('button').filter({has:page.getByRole('heading',{name,exact:true})});
    assert((await card.innerText()).includes('$'+prices[index].toFixed(2)));
   }
  }
 }
 await page.getByRole('button',{name:'EN',exact:true}).click();
 assert((await page.locator('h1').innerText()).includes('You gain freedom.'));
 await page.frameLocator('iframe').first().getByText('Active reservations',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.loop-number').allTextContents(),['01 — SELL','02 — SECURE','03 — OPERATE','04 — CLOSE']);
 assert.equal(await page.locator('#hardware h3').first().innerText(),'1. Choose the contract term');
 await page.frameLocator('iframe').nth(1).getByText('Your stay assistant',{exact:true}).waitFor();
 assert((await page.locator('#options').innerText()).includes('$39.99 / month'));
 assert.equal(await page.locator('iframe[sandbox=""]').count(),2);
 for(const name of ['Book onboarding','Book a call']){
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'×',exact:true}).click();
 }
 await page.locator('#hardware').getByRole('button',{name:'Discuss this package',exact:true}).click();
 await page.getByRole('button',{name:'×',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('PASS: original hardware totals/signup, 18 rental combinations with approved monthly prices, images, mobile widths, language and both booking flows.');
} finally {await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
