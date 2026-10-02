import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('./middleware.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { default: middleware } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const request = (path, method = 'GET') => new Request('https://app.pin-ngo.com' + path, { method });
test('app robots advertises its own sitemap without fetching a custom brand', async () => {
  const result = await middleware(request('/robots.txt'));
  assert.equal(result.status, 200);
  assert.match(await result.text(), /Sitemap: https:\/\/app.pin-ngo.com\/sitemap.xml/);
});
test('app sitemap serves XML and HEAD with correct type', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://api.pin-ngo.com/api/public-booking/sitemap.xml');
    return new Response('<urlset/>', { headers: { 'content-type': 'application/xml' } });
  });
  assert.equal(await (await middleware(request('/sitemap.xml'))).text(), '<urlset/>');
  const head = await middleware(request('/sitemap.xml', 'HEAD'));
  assert.equal(await head.text(), '');
  assert.match(head.headers.get('content-type'), /application\/xml/);
});
test('upstream failure produces uncached 503, never cached empty success', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  const result = await middleware(request('/sitemap.xml'));
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});
test('custom-domain crawler behavior remains scoped to its published discovery', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, discovery: { canonicalHostname: 'stay.example.com', organizationSlug: 'host', propertySlugs: ['suite'] } }));
  const result = await middleware(new Request('https://stay.example.com/sitemap.xml'));
  assert.equal(result.status, 200);
  assert.match(await result.text(), /https:\/\/stay.example.com\/book\/host\/suite/);
});
