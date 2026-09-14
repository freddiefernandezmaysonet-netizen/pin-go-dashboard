"""Compiled UI acceptance only. Every API and provider response is a local fixture."""
import asyncio
import importlib.util
import json
import os
import threading
from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect

spec = importlib.util.spec_from_file_location("booking_base", Path(__file__).with_name("booking-com-browser-check.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
OUTPUT = Path("evidence/reconciliation-browser")
OUTPUT.mkdir(parents=True, exist_ok=True)
base.OUTPUT = OUTPUT
scenario = {"mode": "success", "verified": False}
results = []
requests_by_case = []


async def intercept(route):
    request = route.request
    parsed = urlparse(request.url)
    path = parsed.path.removeprefix("/backend")
    local = parsed.hostname in ("127.0.0.1", "localhost")
    if local and path == "/api/dashboard/distribution/properties/local-property":
        payload = base.connection_center()
        booking = next(c for c in payload["connectionCenter"]["channels"] if c["provider"] == "BOOKING_COM")
        booking.update(channelLinked=True, status="READINESS_CHECK" if scenario["verified"] else "AUTHORIZATION_REQUIRED")
        booking["readiness"].update(authorization="READY" if scenario["verified"] else "IN_PROGRESS", mapping="READY", distribution="IN_PROGRESS")
        base.STATE["calls"].append({"method": "GET", "path": path})
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
        return
    if local and request.method == "POST" and path.endswith("/channels/BOOKING_COM/reconcile"):
        base.STATE["calls"].append({"method": "POST", "path": path, "idempotency": bool(request.headers.get("idempotency-key"))})
        await asyncio.sleep(0.15)
        if scenario["mode"] == "reconcile-failure":
            await route.fulfill(status=503, content_type="application/json", body=json.dumps({"ok": False, "error": "OTA_READONLY_PROVIDER_UNAVAILABLE"}))
        else:
            scenario["verified"] = True
            await route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "readiness": {"authorizationReadiness": "READY", "mappingReadiness": "READY", "distributionReadiness": "IN_PROGRESS", "reasons": ["FULL_SYNC_NOT_QUALIFIED:PROPERTY_STATE_MISSING", "TRANSPORT_SCOPE_POLICY_NOT_APPLIED:PROVIDER_NOT_SUPPORTED"]}}))
        return
    if local and request.method == "POST" and path.endswith("/local-session/completed") and scenario["mode"] == "completion-failure":
        base.STATE["calls"].append({"method": "POST", "path": path})
        await route.fulfill(status=409, content_type="application/json", body=json.dumps({"ok": False, "error": "OTA_SESSION_CONFLICT"}))
        return
    await base.intercept(route)


async def run():
    server = ThreadingHTTPServer(("127.0.0.1", 4173), base.StaticHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = await asyncio.create_subprocess_exec(base.CHROME, "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--no-first-run", "--disable-sync", "--remote-debugging-port=9222", f"--user-data-dir={os.environ['RUNNER_TEMP']}/booking-reconcile-browser", "about:blank", stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    try:
        async with async_playwright() as playwright:
            for _ in range(80):
                try:
                    browser = await playwright.chromium.connect_over_cdp("http://127.0.0.1:9222")
                    break
                except Exception:
                    await asyncio.sleep(0.1)
            else:
                raise RuntimeError("Browser startup failed")
            context = browser.contexts[0]
            await context.route("**/*", intercept)
            page = context.pages[0]
            page.set_default_timeout(12000)
            errors = []
            console = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: console.append(message.text) if message.type == "error" else None)
            for width in (390, 1440):
                await page.set_viewport_size({"width": width, "height": 900})
                for mode in ("success", "reconcile-failure", "completion-failure", "close-only", "simulation"):
                    scenario.update(mode=mode, verified=False)
                    base.STATE.update(case="existing", role="ORG_ADMIN", calls=[], unexpected=[])
                    suffix = "?simulation=1" if mode == "simulation" else ""
                    await page.goto(base.URL + suffix)
                    button_name = "Connect Booking.com" if mode == "simulation" else "Manage Booking.com"
                    await page.get_by_role("button", name=button_name, exact=True).click()
                    finish = page.get_by_role("button", name="Finish simulation" if mode == "simulation" else "Close and refresh", exact=True)
                    await expect(finish).to_be_enabled()
                    if mode == "close-only":
                        await page.get_by_role("button", name="Close window", exact=True).click()
                    else:
                        await finish.click()
                    card = page.locator("article").filter(has=page.get_by_role("heading", name="Booking.com", exact=True))
                    if mode == "success":
                        await card.get_by_text("Checking setup", exact=True).wait_for()
                        await page.get_by_text("Booking.com status verification completed", exact=False).wait_for()
                        assert await card.get_by_text("Active", exact=True).count() == 0
                        assert base.posts() == ["session", "opened", "completed", "reconcile"], base.posts()
                        tail = base.STATE["calls"]
                        reconcile_index = next(i for i, item in enumerate(tail) if item["path"].endswith("/reconcile"))
                        assert any(item["method"] == "GET" and item["path"].endswith("/properties/local-property") for item in tail[reconcile_index+1:])
                        assert tail[reconcile_index]["idempotency"]
                    elif mode == "reconcile-failure":
                        await page.get_by_role("alert").filter(has_text="couldn't refresh Booking.com").wait_for()
                        assert await page.get_by_role("dialog").count() == 0
                        assert base.posts() == ["session", "opened", "completed", "reconcile"]
                        await card.get_by_text("Authorization required", exact=True).wait_for()
                        assert "status verification completed" not in await page.locator("body").inner_text()
                    elif mode == "completion-failure":
                        await page.get_by_role("alert").filter(has_text="couldn't complete").wait_for()
                        assert base.posts() == ["session", "opened", "completed"]
                        assert await page.get_by_role("dialog").count() == 1
                    elif mode == "close-only":
                        await page.get_by_role("dialog").wait_for(state="hidden")
                        await page.wait_for_timeout(100)
                        assert base.posts() == ["session", "opened", "cancelled"]
                    else:
                        await page.get_by_text("Simulation complete. No data was changed.", exact=True).wait_for()
                        assert base.posts() == []
                    assert not base.STATE["unexpected"], base.STATE["unexpected"]
                    assert not errors, errors
                    geometry = await page.evaluate("({viewport:innerWidth,width:document.documentElement.scrollWidth})")
                    assert geometry["width"] <= geometry["viewport"] + 1, geometry
                    await page.screenshot(path=str(OUTPUT / f"{width}-{mode}.png"), full_page=True)
                    results.append({"case": mode, "width": width, "passed": True, "posts": base.posts(), "geometry": geometry})
                    requests_by_case.append({"case": mode, "width": width, "requests": list(base.STATE["calls"])})
            # Both clients inspect the same persistent context and the same app page.
            assert "Booking channels" in await page.locator("body").inner_text()
            await base.agent("snapshot", "-i")
            await base.agent("screenshot", str(OUTPUT / "agent-browser-verification.png"), "--full")
            (OUTPUT / "console.json").write_text(json.dumps({"pageErrors": errors, "console": console, "note": "HTTP 409/503 errors are intentionally injected negative cases."}, indent=2))
            await browser.close()
    except Exception as error:
        results.append({"case": "runner", "passed": False, "error": str(error)})
        try:
            await base.agent("snapshot", "-i")
            await base.agent("screenshot", str(OUTPUT / "failure.png"), "--full")
        except Exception:
            pass
    finally:
        (OUTPUT / "results.json").write_text(json.dumps({"head": os.environ["GITHUB_SHA"], "results": results, "cases": requests_by_case, "liveProviderCalls": False}, indent=2))
        print(json.dumps(results, indent=2))
        if chrome.returncode is None:
            chrome.terminate()
            await chrome.wait()
        server.shutdown()
    return len(results) == 10 and all(item["passed"] for item in results)


if __name__ == "__main__":
    raise SystemExit(0 if asyncio.run(run()) else 1)
