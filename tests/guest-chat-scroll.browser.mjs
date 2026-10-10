import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

// Render the real guest chat with synthetic HTTP only, on desktop and mobile.
const root = process.cwd();
const fixture = await mkdtemp(resolve(root, ".guest-scroll-"));
await writeFile(resolve(fixture, "index.html"), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await writeFile(resolve(fixture, "main.tsx"), `import React from 'react'; import {createRoot} from 'react-dom/client'; import {GuestPinAIChat} from '../src/pages/public-booking/GuestPinAIChat'; createRoot(document.getElementById('root')).render(<GuestPinAIChat apiBase="https://api.example.test" guestToken="synthetic-scroll"/>);`);
const server = await createServer({ root, server: { host: "127.0.0.1", port: 4186, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    let pending;
    const history = Array.from({ length: 8 }, (_, i) => ({ id: `history-${i}`, role: i % 2 ? "assistant" : "guest", text: `Previous message ${i}. `.repeat(12) }));
    await page.route("https://api.example.test/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const reply = body => route.fulfill({ json: body });
      if (path.endsWith("/availability")) return reply({ ok: true, available: true, opensAt: "2026-10-09T00:00:00Z", closesAt: "2026-10-12T00:00:00Z", checkedAt: "2026-10-10T12:00:00Z" });
      if (path.endsWith("/history")) return reply({ ok: true, version: 1, messages: history });
      if (path.endsWith("/messages")) { pending = reply; return; }
      throw new Error(`Unexpected request: ${path}`);
    });
    await page.goto(`http://127.0.0.1:4186/${basename(fixture)}/index.html`);
    const list = page.locator('[aria-live="polite"]');
    await page.locator("textarea:enabled").waitFor();
    assert.equal(await list.evaluate(node => node.scrollTop), 0, "history restoration preserves position");
    async function send(text) {
      pending = null;
      await page.locator("textarea").fill(text);
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('button[type="submit"]').disabled);
      for (let i = 0; !pending && i < 100; i++) await page.waitForTimeout(10);
      assert.ok(pending, "synthetic request was received");
    }
    await send("First question");
    assert.ok(await list.evaluate(node => node.scrollTop > 0), "sending follows latest guest message");
    await pending({ ok: true, reply: "Long reply start.\n\n" + "Safe troubleshooting explanation. ".repeat(100) });
    await page.getByText(/Long reply start/).waitFor();
    await page.waitForTimeout(150);
    const startOffset = await list.evaluate(node => node.lastElementChild.getBoundingClientRect().top - node.getBoundingClientRect().top);
    assert.ok(Math.abs(startOffset) < 3, `long reply starts at top: ${startOffset}`);
    await send("Second question");
    await list.evaluate(node => { node.scrollTop = 0; });
    await page.waitForTimeout(100);
    await pending({ ok: true, reply: "Second answer with new information." });
    await page.getByText("Second answer with new information.").waitFor();
    assert.equal(await list.evaluate(node => node.scrollTop), 0, "reading older messages is not interrupted");
    await send("Third question");
    await pending({ ok: true, reply: "Third answer." });
    await page.getByText("Third answer.").waitFor();
    assert.ok(await list.evaluate(node => node.scrollTop > 0), "new guest message resumes following");
    console.log(`Guest chat scrolling passed at ${width}px`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
  await rm(fixture, { recursive: true, force: true });
}
