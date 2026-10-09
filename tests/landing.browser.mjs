import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd(), fixture = await mkdtemp(resolve(root, '.landing-browser-'));
const output = resolve(process.env.LANDING_TEST_OUTPUT || '/tmp/landing-browser');
await mkdir(output, { recursive: true });
await writeFile(resolve(fixture, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, 'main.tsx'), `import React from 'react'; import {createRoot} from 'react-dom/client'; import Landing from '../src/pages/LandingPage'; import Haas from '../src/components/HaasConfigurator'; import Signup from '../src/pages/auth/SignupPage'; import {BrowserRouter} from 'react-router-dom'; import '../src/index.css'; const legacy=location.search.includes('legacy'); createRoot(document.getElementById('root')!).render(location.search.includes("signupFixture")?<BrowserRouter><Signup/></BrowserRouter>:legacy?<Haas lang="es"/>:<Landing/>);`);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 4182, strictPort: true }, define: {'import.meta.env.VITE_API_BASE': JSON.stringify('https://landing-api.example.invalid')} });
let browser; const errors=[];
try {
 await server.listen(); browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 let checkoutBody;
 await page.route('**/*',route=>{
  const req=route.request(),host=new URL(req.url()).hostname;
  if(host==='127.0.0.1')return route.continue();
  if(host==='landing-api.example.invalid' && req.method()==='POST'){checkoutBody=req.postDataJSON();return route.fulfill({json:{ok:true,url:'https://checkout.stripe.com/fixture'}});}
  if(host==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<h1>Fixture checkout</h1>'});
  return route.abort();
 });
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
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page fits '+width);
  await page.screenshot({path:resolve(output,`${width}-hero.png`)});
  for(const img of await page.locator('#hardware img').all())assert(await img.evaluate(n=>n.complete&&n.naturalWidth>0),'Original hardware image loaded');
  await page.locator('#hardware').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,`${width}-hardware.png`),fullPage:false});
 }
 await page.setViewportSize({width:1280,height:900});
 assert.equal(await page.locator('#hardware button').filter({hasText:'6 meses'}).count(),0);
 assert.equal(await page.locator('#hardware button').filter({hasText:'1 Dispositivo'}).count(),0);
 assert.equal(await page.locator('.ota-logos img').count(),4);
 for(const img of await page.locator('.ota-logos img').all())assert(await img.evaluate(n=>n.complete&&n.naturalWidth>0),'OTA logo loads');
 assert((await page.locator('#cleaning').innerText()).includes('03 · FINALIZACIÓN'));
 assert((await page.locator('#options').getByRole('link',{name:'Activar',exact:true}).getAttribute('href')).includes('plan=platform'));
 for(const [model,values] of Object.entries({essential:{12:54.99,24:44.99},pro:{12:74.99,24:64.99},elite:{12:84.99,24:74.99}})){
  const name=model.charAt(0).toUpperCase()+model.slice(1)+' Lock';
  await page.locator('#hardware').getByRole('button').filter({has:page.getByRole('heading',{name,exact:true})}).click();
  for(const term of [12,24]){
   await page.locator('#hardware button[aria-pressed]').filter({hasText:term+' meses'}).click();
   assert((await page.locator('#hardware aside').innerText()).includes('$'+values[term].toFixed(2)));
   const href=await page.locator('#hardware').getByRole('link',{name:'Activar y pagar',exact:true}).getAttribute('href');
   assert(href.includes('lock='+model));assert(href.includes('termMonths='+term));assert(href.includes('smartDevices=none'));assert(href.includes('lang=es'));
  }
 }
 await page.getByRole('button',{name:'EN',exact:true}).click();
 assert((await page.locator('h1').innerText()).includes('You gain freedom.'));
 assert((await page.locator('#options').innerText()).includes('$39.99 / month'));
 assert.equal(await page.locator('iframe[sandbox=""]').count(),2);
 for(const name of ['Book onboarding','Book a call']){
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'×',exact:true}).click();
 }
assert((await page.locator('#hardware').getByRole('link',{name:'Activate and pay',exact:true}).getAttribute('href')).includes('lang=en'));
 for(const [model,values] of Object.entries({essential:{12:54.99,24:44.99},pro:{12:74.99,24:64.99},elite:{12:84.99,24:74.99}}))for(const term of [12,24]){
  await page.goto(url+`?signupFixture&plan=haas&lock=${model}&termMonths=${term}&lang=es&smartDevices=none`);
  await page.getByRole('heading',{name:'Crear cuenta',exact:true}).waitFor();assert((await page.locator('main').innerText()).includes('$'+values[term].toFixed(2)));
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Signup fits '+width);}
  for(const [label,value] of [['Nombre de la organización','Rental Demo'],['Nombre completo','Demo Host'],['Correo electrónico','fixture@example.invalid'],['Teléfono','0000000000'],['Contraseña','Jade!Clouds7Fence']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'Continuar al pago seguro',exact:true}).click();await page.getByRole('heading',{name:'Fixture checkout',exact:true}).waitFor();
  assert.equal(checkoutBody.haasSelection.lock,model);assert.equal(checkoutBody.haasSelection.termMonths,term);assert.equal(checkoutBody.locks,1);assert.equal(checkoutBody.billingInterval,'monthly');assert.equal(checkoutBody.contractOption,`contract_${term}_lock`);
 }
 await page.goto(url+'?signupFixture&plan=platform&lang=en');await page.getByRole('heading',{name:'Create your account',exact:true}).waitFor();assert((await page.locator('main').innerText()).includes('$39.99'));
 await page.getByLabel('Billing frequency',{exact:true}).selectOption('yearly');assert((await page.locator('main').innerText()).includes('$399.90'));
 for(const [label,value] of [['Organization name','Rental Demo'],['Full name','Demo Host'],['Email','fixture@example.invalid'],['Phone','0000000000'],['Password','Jade!Clouds7Fence']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Continue to secure checkout',exact:true}).click();await page.getByRole('heading',{name:'Fixture checkout',exact:true}).waitFor();assert.equal(checkoutBody.billingInterval,'yearly');assert.equal(checkoutBody.plan,'platform');assert.equal(checkoutBody.haasSelection,null);
 await page.goto(url+'?signupFixture&plan=haas&lock=pro&termMonths=6');assert(await page.getByRole('button',{name:'Continuar al pago seguro',exact:true}).isDisabled());
 assert.deepEqual(errors,[]);
 console.log('PASS: original hardware totals/signup, six approved priced packages, images, mobile widths, language and both booking flows.');
} finally {await browser?.close();await server.close();await rm(fixture,{recursive:true,force:true});}
