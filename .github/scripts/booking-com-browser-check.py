"""Exercise the compiled dashboard with local fixtures, never live provider data."""
import asyncio
import json
import os
import re
import shutil
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect

ROOT = Path.cwd()
OUTPUT = ROOT / "evidence/browser"
OUTPUT.mkdir(parents=True, exist_ok=True)
DIST = ROOT / "dist"
BASELINE_DIST = Path(os.environ["BASELINE_DIR"]) / "dist"
CLI = os.environ["AGENT_BROWSER_BIN"]
CHROME = os.environ["CHROME_PATH"]
URL = "http://127.0.0.1:4173/properties/local-property/distribution"
STATE = {"case": "new", "role": "ORG_ADMIN", "calls": [], "unexpected": [], "errors": [], "console": []}
RESULTS = []


class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        if not (DIST / urlparse(self.path).path.lstrip("/")).is_file():
            self.path = "/index.html"
        super().do_GET()


def connection_center():
    status = {"existing": "MAPPING_REQUIRED", "active": "ACTIVE", "failed": "FAILED", "disabled": "MAPPING_REQUIRED", "bad-url": "MAPPING_REQUIRED"}.get(STATE["case"], "NOT_CONNECTED")

    def channel(provider, name, availability="AVAILABLE"):
        booking = provider == "BOOKING_COM"
        return {
            "provider": provider, "name": name, "availability": availability,
            "status": status if booking else "NOT_CONNECTED",
            "nextAction": "MANAGE" if booking and status != "NOT_CONNECTED" else "CONNECT",
            "channelLinked": booking and status != "NOT_CONNECTED",
            "readiness": {key: "NOT_STARTED" for key in ["authorization", "mapping", "distribution", "payment", "tax", "content"]},
            "lastReadinessCheckedAt": None, "lastFullSyncConfirmedAt": None,
            "activatedAt": None, "attentionCode": None,
        }

    return {"ok": True, "connectionCenter": {
        "productName": "Distribution by Pin&Go",
        "property": {"id": "local-property", "name": "Booking.com — LOCAL TEST PROPERTY"},
        "status": "SETUP_REQUIRED", "provisioningStatus": "READY",
        "channels": [channel("AIRBNB", "Airbnb"), channel("BOOKING_COM", "Booking.com"), channel("EXPEDIA", "Expedia", "PLANNED"), channel("VRBO", "Vrbo", "ASSISTED_BETA")],
    }}


async def intercept(route):
    request = route.request
    url = urlparse(request.url)
    path = url.path
    payload = None
    status = 200
    if url.hostname == "app.channex.io":
        # The production-looking URL tests the existing client allowlist only.
        # Fulfillment occurs before any network request to Channex.
        STATE["calls"].append({"method": request.method, "path": "LOCAL_FRAME", "synthetic": True})
        await route.fulfill(status=200, content_type="text/html", body='<!doctype html><html lang="en"><body style="font:16px system-ui;padding:28px"><h1>LOCAL TEST FIXTURE</h1><p>This is not Channex. No account or property has been connected.</p><label>Hotel ID <input aria-label="Hotel ID" value="TEST ONLY" readonly></label><p>Closing this test window does not activate a channel.</p></body></html>')
        return
    if url.hostname not in ("127.0.0.1", "localhost"):
        STATE["unexpected"].append(request.url)
        await route.abort()
        return
    if path == "/backend/api/public/brand-context":
        payload = {"ok": True, "data": {"kind": "PIN_GO_STANDARD", "displayName": "Pin&Go", "logoUrl": None, "faviconUrl": None, "primaryColor": None, "onPrimaryColor": None, "organizationSlug": None, "version": None, "poweredByPinGo": True}}
    elif path == "/auth/me":
        payload = {"user": None if STATE["role"] == "NONE" else {"id": "test-user", "email": "test@example.invalid", "orgId": "test-org", "role": STATE["role"], "organizationName": "LOCAL VERIFICATION"}}
    elif path == "/backend/api/org/branding/review":
        payload = {"ok": True, "profile": None, "pendingRevisions": []}
    elif path == "/api/dashboard/distribution/properties/local-property":
        payload = connection_center()
    elif path == "/api/dashboard/properties/local-property":
        payload = {"ok": True, "item": {"id": "local-property", "name": "LOCAL TEST PROPERTY", "distributionEnabled": False, "distributionStatus": "INACTIVE"}}
    elif path.endswith("/channels/BOOKING_COM/prepare") and request.method == "POST":
        payload = {"ok": True, "provisioningStatus": "READY"}
    elif path.endswith("/channels/BOOKING_COM/session") and request.method == "POST":
        if STATE["case"] == "disabled":
            status, payload = 503, {"ok": False, "error": "OTA_CONNECTION_CENTER_RUNTIME_DISABLED"}
        else:
            launch_url = "https://app.channex.io/auth/exchange?oauth_session_key=LOCAL_TEST_NOT_A_CREDENTIAL&app_mode=headless&redirect_to=%2Fchannels&property_id=local-property&group_id=local-group&channels_filter=BDC&available_channels=BDC"
            if STATE["case"] == "bad-url":
                launch_url = "https://example.invalid/disallowed"
            payload = {"ok": True, "session": {"sessionId": "local-session", "launchUrl": launch_url, "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}}
    elif re.fullmatch("/api/dashboard/distribution/sessions/local-session/(opened|completed|cancelled)", path) and request.method == "POST":
        payload = {"ok": True}
    elif request.resource_type in ("fetch", "xhr"):
        STATE["unexpected"].append(request.method + " " + path)
        status, payload = 400, {"ok": False, "error": "NO_LOCAL_FIXTURE"}
    if payload is None:
        await route.continue_()
        return
    STATE["calls"].append({"method": request.method, "path": path, "idempotency": bool(request.headers.get("idempotency-key"))})
    await route.fulfill(status=status, content_type="application/json", body=json.dumps(payload))


async def agent(*args):
    process = await asyncio.create_subprocess_exec(CLI, "--cdp", "9222", "--session", "booking-ci", *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    out, err = await asyncio.wait_for(process.communicate(), 30)
    with (OUTPUT / "agent-browser.log").open("a") as log:
        log.write("$ agent-browser " + " ".join(args) + "\n" + out.decode() + err.decode() + "\n")
    if process.returncode:
        raise RuntimeError(err.decode() or out.decode())


def posts():
    return [call["path"].rsplit("/", 1)[-1] for call in STATE["calls"] if call["method"] == "POST"]


async def main():
    global DIST
    server = ThreadingHTTPServer(("127.0.0.1", 4173), StaticHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = await asyncio.create_subprocess_exec(CHROME, "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking", "--no-first-run", "--disable-sync", "--remote-debugging-port=9222", f"--user-data-dir={os.environ['RUNNER_TEMP']}/booking-chrome", "about:blank", stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    page = None
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

            def attach(target):
                target.on("pageerror", lambda error: STATE["errors"].append(str(error)))
                target.on("console", lambda message: STATE["console"].append({"case": STATE["case"], "text": message.text}) if message.type == "error" else None)

            for target in context.pages:
                attach(target)
            context.on("page", attach)
            await agent("open", URL)
            page = next(target for target in context.pages if "/properties/local-property" in target.url)
            page.set_default_timeout(10000)
            await page.set_viewport_size({"width": 1440, "height": 1080})
            await page.get_by_role("button", name="Connect Booking.com", exact=True).wait_for()
            await agent("snapshot", "-i")
            await agent("screenshot", str(OUTPUT / "01-new-desktop.png"), "--full")
            card = page.locator("article").filter(has=page.get_by_role("heading", name="Booking.com", exact=True))
            assert await card.get_by_text("Before connecting Booking.com", exact=True).count() == 1
            assert await card.locator("input[type=password]").count() == 0
            await page.get_by_role("button", name="Connect Booking.com", exact=True).click()
            refresh = page.get_by_role("button", name="Close and refresh", exact=True)
            await expect(refresh).to_be_enabled()
            await page.frame_locator('iframe[title="Booking.com setup"]').get_by_text("LOCAL TEST FIXTURE", exact=True).wait_for()
            await agent("snapshot", "-i")
            await agent("screenshot", str(OUTPUT / "02-setup-dialog.png"))
            assert posts() == ["prepare", "session", "opened"], posts()
            assert all(call["idempotency"] for call in STATE["calls"] if call["method"] == "POST")
            await refresh.click()
            await page.get_by_role("dialog").wait_for(state="hidden")
            await card.get_by_text("Not connected", exact=True).wait_for()
            assert "closing does not confirm activation" in await page.locator("body").inner_text()
            RESULTS.append({"case": "new connection + frame + refresh", "passed": True, "postActions": posts()})

            for case, label in [("existing", "Setup required"), ("active", "Active"), ("failed", "Error")]:
                STATE["case"], STATE["calls"] = case, []
                await page.goto(URL)
                await page.get_by_role("button", name="Manage Booking.com", exact=True).wait_for()
                assert await card.get_by_text(label, exact=True).count() == 1
                assert await card.get_by_text("Before connecting Booking.com", exact=True).count() == 0
                if case == "existing":
                    await page.screenshot(path=str(OUTPUT / "03-manage-existing.png"), full_page=True)
                await page.get_by_role("button", name="Manage Booking.com", exact=True).click()
                await expect(refresh).to_be_enabled()
                await page.get_by_role("button", name="Close window", exact=True).click()
                await page.get_by_role("dialog").wait_for(state="hidden")
                await page.wait_for_timeout(100)
                assert posts() == ["session", "opened", "cancelled"], posts()
                RESULTS.append({"case": case + " management", "passed": True, "postActions": posts()})

            for case in ("disabled", "bad-url"):
                STATE["case"], STATE["calls"] = case, []
                await page.goto(URL)
                await page.get_by_role("button", name="Manage Booking.com", exact=True).click()
                await page.get_by_text("not yet available for commercial use" if case == "disabled" else "We couldn't start this connection", exact=False).wait_for()
                assert await page.get_by_role("dialog").count() == 0
                assert posts() == ["session"]
                RESULTS.append({"case": case, "passed": True, "noAutomaticRetry": True})

            STATE["case"], STATE["calls"] = "new", []
            await page.goto(URL + "?simulation=1")
            await page.get_by_role("button", name="Connect Booking.com", exact=True).click()
            await page.get_by_role("button", name="Finish simulation", exact=True).click()
            assert not posts()
            RESULTS.append({"case": "simulation", "passed": True, "postCount": 0})

            await page.goto(URL)
            await page.get_by_role("button", name="Connect Booking.com", exact=True).wait_for()
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.screenshot(path=str(OUTPUT / "04-mobile-390.png"), full_page=True)
            mobile = await page.evaluate("({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth})")
            RESULTS.append({"case": "mobile layout 390", "passed": mobile["documentWidth"] <= mobile["viewport"] + 1, **mobile})
            await page.get_by_role("button", name="Connect Booking.com", exact=True).click()
            await expect(refresh).to_be_enabled()
            await page.screenshot(path=str(OUTPUT / "05-mobile-dialog.png"))
            bounds = await page.get_by_role("dialog").bounding_box()
            RESULTS.append({"case": "mobile dialog", "passed": bounds["width"] <= 391, "bounds": bounds})
            await page.get_by_role("button", name="Close window", exact=True).click()

            if BASELINE_DIST.is_dir():
                DIST = BASELINE_DIST
                await page.goto(URL + "?baseline=1")
                await page.get_by_role("button", name="Connect Booking.com", exact=True).wait_for()
                await page.screenshot(path=str(OUTPUT / "06-baseline-mobile-390.png"), full_page=True)
                baseline_mobile = await page.evaluate("({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth})")
                RESULTS.append({"case": "baseline mobile comparison", "passed": mobile["documentWidth"] <= baseline_mobile["documentWidth"] + 1, "candidate": mobile, "baseline": baseline_mobile})
                DIST = ROOT / "dist"

            STATE["role"], STATE["calls"] = "NONE", []
            await page.goto(URL)
            await page.wait_for_url("**/login")
            assert not posts()
            RESULTS.append({"case": "unauthenticated", "passed": True, "redirect": "/login"})
            RESULTS.append({"case": "external request isolation", "passed": not STATE["unexpected"], "unexpectedRequests": STATE["unexpected"]})
            RESULTS.append({"case": "JavaScript runtime", "passed": not STATE["errors"], "pageErrors": STATE["errors"]})
            await browser.close()
    except Exception as error:
        RESULTS.append({"case": "runner", "passed": False, "error": str(error)})
        if page and not page.is_closed():
            try:
                await page.screenshot(path=str(OUTPUT / "failure.png"), full_page=True)
                (OUTPUT / "failure-body.txt").write_text(await page.locator("body").inner_text())
            except Exception:
                pass
    finally:
        report = {"candidate": os.environ["GITHUB_SHA"], "results": RESULTS, "console": STATE["console"], "unexpectedRequests": STATE["unexpected"], "requests": STATE["calls"]}
        (OUTPUT / "results.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2), flush=True)
        server.shutdown()
        if chrome.returncode is None:
            chrome.terminate()
            await chrome.wait()
    return all(result["passed"] for result in RESULTS) and bool(RESULTS)


if __name__ == "__main__":
    sys.exit(0 if asyncio.run(main()) else 1)
