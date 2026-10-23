import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { default: middleware } = await load('../middleware.ts');
const { resolvePublicBookingOrigin } = await load('../src/lib/publicBookingOrigin.ts');

test('promotional URLs use the apex even with the legacy production environment value', () => {
  for (const host of ['app.pin-ngo.com', 'www.pin-ngo.com', 'pin-ngo.com']) {
    assert.equal(resolvePublicBookingOrigin(`https://${host}`, 'https://app.pin-ngo.com'), 'https://pin-ngo.com');
  }
  for (const origin of ['https://stay.example.com', 'http://localhost:5173', 'https://preview.vercel.app']) {
    assert.equal(resolvePublicBookingOrigin(origin), origin);
  }
  assert.equal(resolvePublicBookingOrigin('http://localhost:5173', 'https://staging.example.com/'), 'https://staging.example.com');
});

function mockBooking(t, brand = { kind: 'PIN_GO_STANDARD' }, status = 200) {
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input);
    if (url.endsWith('/index.html')) return new Response('<html><head></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } });
    assert.match(url, /^https:\/\/api.pin-ngo.com\/api\/public-booking\/serena-studio/);
    if (status !== 200) return new Response('', { status });
    return Response.json({ ok: true, publicBrand: brand, organization: { name: 'Serena Studio', properties: [] }, property: { name: 'Palmas', organization: { name: 'Serena Studio' } } });
  });
}

test('legacy collection/property GET and HEAD preserve every query parameter when redirecting', async t => {
  mockBooking(t);
  for (const host of ['app.pin-ngo.com', 'www.pin-ngo.com']) {
    for (const path of ['/book/serena-studio', '/book/serena-studio/palmasdelmar']) {
      for (const method of ['GET', 'HEAD']) {
        const query = '?checkIn=2026-12-01&checkOut=2026-12-04&adults=2&lang=es&utm_source=a%2Bb';
        const response = await middleware(new Request(`https://${host}${path}${query}`, { method }));
        assert.equal(response.status, 308);
        assert.equal(response.headers.get('location'), `https://pin-ngo.com${path}${query}`);
      }
    }
  }
});

test('apex serves booking HTML with canonical metadata and never redirects to itself', async t => {
  mockBooking(t);
  const response = await middleware(new Request('https://pin-ngo.com/book/serena-studio/palmasdelmar?lang=es'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.match(await response.text(), /rel="canonical" href="https:\/\/pin-ngo.com\/book\/serena-studio\/palmasdelmar"/);
});

test('published custom domains retain priority and never redirect to the platform apex', async t => {
  mockBooking(t, { kind: 'CUSTOM_BRAND', organizationSlug: 'serena-studio', customDomain: 'stay.example.com', displayName: 'Serena' });
  const response = await middleware(new Request('https://app.pin-ngo.com/book/serena-studio?adults=2'));
  assert.equal(response.headers.get('location'), 'https://stay.example.com/book/serena-studio?adults=2');
  const custom = await middleware(new Request('https://stay.example.com/book/serena-studio'));
  assert.equal(custom.status, 200);
  assert.equal(custom.headers.get('location'), null);
});

test('preview stays on preview; authoritative missing listings stay 404', async t => {
  mockBooking(t);
  assert.equal((await middleware(new Request('https://preview.vercel.app/book/serena-studio'))).status, 200);
  mockBooking(t, undefined, 404);
  assert.equal((await middleware(new Request('https://app.pin-ngo.com/book/serena-studio'))).status, 404);
});

test('metadata outage fails open to the existing app instead of blocking booking', async t => {
  mockBooking(t, undefined, 503);
  const response = await middleware(new Request('https://app.pin-ngo.com/book/serena-studio'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});

test('public sitemap migrates standard URLs without touching custom locations', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<urlset><loc>https://app.pin-ngo.com/book/serena-studio/palmasdelmar</loc><loc>https://stay.example.com/book/host/suite</loc></urlset>', { headers: { 'content-type': 'application/xml' } }));
  const response = await middleware(new Request('https://pin-ngo.com/sitemap.xml'));
  const xml = await response.text();
  assert.match(xml, /https:\/\/pin-ngo.com\/book\/serena-studio\/palmasdelmar/);
  assert.match(xml, /https:\/\/stay.example.com\/book\/host\/suite/);
  assert.doesNotMatch(xml, /app.pin-ngo.com/);
});

test('middleware remains limited to public listing and crawler paths', async () => {
  const { config } = await load('../middleware.ts');
  assert.deepEqual(config.matcher, ['/book/:path*', '/robots.txt', '/sitemap.xml']);
});
