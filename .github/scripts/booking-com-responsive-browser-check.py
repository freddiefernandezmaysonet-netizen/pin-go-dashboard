"""Additional responsive/keyboard checks; reuse the existing local-only API fixtures."""
import asyncio
import importlib.util
import json
import os
import sys
import threading
from pathlib import Path
from playwright.async_api import async_playwright, expect

spec = importlib.util.spec_from_file_location("fixtures", Path(__file__).with_name("booking-com-browser-check.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
OUTPUT = Path("evidence/responsive")
OUTPUT.mkdir(parents=True, exist_ok=True)
RESULTS = []

async def route_request(route):
    path = fixtures.urlparse(route.request.url).path.removeprefix("/backend")
    if path == "/api/dashboard/properties":
        await route.fulfill(status=200, content_type="application/json", body='{"items":[]}')
    else:
        await fixtures.intercept(route)

async def main():
    server = fixtures.ThreadingHTTPServer(("127.0.0.1", 4173), fixtures.StaticHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = await asyncio.create_subprocess_exec(fixtures.CHROME, "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--no-first-run", "--disable-sync", "--remote-debugging-port=9222", f"--user-data-dir={os.environ['RUNNER_TEMP']}/booking-mobile-chrome", "about:blank", stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    try:
        async with async_playwright() as pw:
            for _ in range(80):
                try:
                    browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222")
                    break
                except Exception:
                    await asyncio.sleep(0.1)
            else:
                raise RuntimeError("Browser startup failed")
            context = browser.contexts[0]
            await context.route("**/*", route_request)
            await fixtures.agent("open", fixtures.URL)
            page = next(p for p in context.pages if "/properties/local-property" in p.url)
            page.set_default_timeout(10000)
            page.on("pageerror", lambda e: fixtures.STATE["errors"].append(str(e)))
            page.on("console", lambda m: fixtures.STATE["console"].append(m.text) if m.type == "error" else None)
            await page.emulate_media(reduced_motion="reduce")
            await page.get_by_role("button", name="Connect Booking.com", exact=True).wait_for()
            await fixtures.agent("snapshot", "-i")
            for width in (320, 360, 390, 720, 768, 1440):
                await page.set_viewport_size({"width":width,"height":900})
                await page.wait_for_timeout(80)
                metrics = await page.evaluate("""() => {
                  const main=document.querySelector('.pin-go-app-shell__main');
                  const targets=[...document.querySelectorAll('article, article h2, article button, article a, .pin-go-app-shell__header, section[aria-labelledby="distribution-full-sync-title"], section[aria-labelledby="distribution-full-sync-title"] button')];
                  const outside=targets.filter(el=>{const b=el.getBoundingClientRect();return b.width && (b.left < -1 || b.right > innerWidth+1)}).map(el=>el.tagName+': '+el.textContent.slice(0,50));
                  return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:main.clientWidth,mainScrollWidth:main.scrollWidth,outside,
                    clipping:[document.documentElement,document.body,document.querySelector('.pin-go-app-shell'),main].some(el=>['hidden','clip'].includes(getComputedStyle(el).overflowX))};
                }""")
                passed = metrics["documentWidth"] <= width+1 and metrics["mainScrollWidth"] <= metrics["mainWidth"]+1 and not metrics["outside"] and not metrics["clipping"]
                RESULTS.append({"case":f"unclipped content {width}","passed":passed,**metrics})
                await page.screenshot(path=str(OUTPUT/f"responsive-{width}.png"),full_page=True)
                if width <= 720:
                    await page.get_by_role("button",name="Connect Booking.com",exact=True).click()
                    await expect(page.get_by_role("button",name="Close and refresh",exact=True)).to_be_enabled()
                    controls = await page.get_by_role("dialog").locator("button").evaluate_all("els=>els.map(el=>{const b=el.getBoundingClientRect();return {text:el.textContent,width:b.width,left:b.left,right:b.right,bottom:b.bottom}})")
                    RESULTS.append({"case":f"setup controls fit {width}","passed":all(c["width"]>0 and c["left"]>=0 and c["right"]<=width and c["bottom"]<=900 for c in controls),"controls":controls})
                    await page.screenshot(path=str(OUTPUT/f"setup-{width}.png"))
                    await page.get_by_role("button",name="Close window",exact=True).click()
                    await page.get_by_role("dialog").wait_for(state="hidden")
            await page.set_viewport_size({"width":390,"height":844})
            menu = page.get_by_role("button",name="Open navigation",exact=True)
            navigation = page.get_by_role("dialog",name="Main navigation",exact=True)
            await menu.click()
            await expect(navigation.get_by_role("button",name="Close navigation",exact=True)).to_be_focused()
            await page.keyboard.press("Shift+Tab")
            await expect(navigation.get_by_role("button",name="Log out",exact=True)).to_be_focused()
            await page.keyboard.press("Tab")
            await expect(navigation.get_by_role("button",name="Close navigation",exact=True)).to_be_focused()
            await page.screenshot(path=str(OUTPUT/"mobile-navigation.png"))
            await page.keyboard.press("Escape")
            await navigation.wait_for(state="hidden")
            await expect(menu).to_be_focused()
            assert await page.evaluate("document.body.style.overflow !== 'hidden'")
            RESULTS.append({"case":"focus containment, Escape and focus return","passed":True})
            await menu.click()
            await navigation.get_by_role("button",name="Close navigation",exact=True).click()
            await expect(menu).to_be_focused()
            await menu.click()
            await page.locator('.pin-go-app-shell__backdrop').click(position={"x":380,"y":300})
            await navigation.wait_for(state="hidden")
            await expect(menu).to_be_focused()
            RESULTS.append({"case":"close button and backdrop","passed":True})
            await menu.click()
            await navigation.get_by_role("link",name="Properties",exact=True).click()
            await page.wait_for_url("**/properties")
            await expect(menu).to_have_attribute("aria-expanded","false")
            await page.goto(fixtures.URL)
            await page.get_by_role("button",name="Connect Booking.com",exact=True).wait_for()
            RESULTS.append({"case":"route navigation closes menu","passed":True})
            await menu.click()
            await page.set_viewport_size({"width":1440,"height":1080})
            await navigation.wait_for(state="hidden")
            await expect(page.locator('aside')).to_be_visible()
            assert await page.evaluate("document.body.style.overflow !== 'hidden' && !document.querySelector('aside').inert")
            desktop = await page.locator('aside').bounding_box()
            links = await page.locator('aside nav').inner_text()
            await page.screenshot(path=str(OUTPUT/"desktop-restored.png"),full_page=True)
            RESULTS.append({"case":"resize restores desktop navigation","passed":True})
            fixtures.DIST = fixtures.BASELINE_DIST
            await page.goto(fixtures.URL+"?baseline=1")
            await page.get_by_role("button",name="Connect Booking.com",exact=True).wait_for()
            baseline = await page.locator('aside').bounding_box()
            baseline_links = await page.locator('aside nav').inner_text()
            await page.screenshot(path=str(OUTPUT/"baseline-desktop.png"),full_page=True)
            RESULTS.append({"case":"desktop geometry and items match baseline","passed":desktop==baseline and links==baseline_links,"candidate":desktop,"baseline":baseline})
            RESULTS.append({"case":"no external requests or runtime errors","passed":not fixtures.STATE["unexpected"] and not fixtures.STATE["errors"] and not fixtures.STATE["console"],"unexpected":fixtures.STATE["unexpected"],"errors":fixtures.STATE["errors"],"console":fixtures.STATE["console"]})
            await browser.close()
    except Exception as error:
        RESULTS.append({"case":"runner","passed":False,"error":str(error)})
        try:
            await fixtures.agent("screenshot",str(OUTPUT/"failure.png"),"--full")
        except Exception:
            pass
    finally:
        report={"candidate":os.environ["GITHUB_SHA"],"results":RESULTS}
        (OUTPUT/"results.json").write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2),flush=True)
        server.shutdown()
        if chrome.returncode is None:
            chrome.terminate()
            await chrome.wait()
    return bool(RESULTS) and all(result["passed"] for result in RESULTS)

if __name__ == "__main__":
    sys.exit(0 if asyncio.run(main()) else 1)
