"""Verify the complete integrated delivery, never a broad exemption from OTA guards."""
import hashlib
import json
import subprocess
from pathlib import Path

BASE = "8b3e210eefb44f02553a86a2b6fabc3a860fb9b9"
GROUPS = {
    "280292a27bf76713c73b14debb5f7cb50659e090": [
        "src/pages/distribution/ConnectionCenterPage.tsx",
        "src/pages/distribution/BookingComConnectionFlow.test.js",
        ".github/scripts/booking-com-browser-check.py",
    ],
    "e1fa564425ef8033d7582a1dc088e22c0fcbd5b5": [
        "src/api/distribution.contract.test.js",
        "src/pages/distribution/AirbnbConnectionCallbackPage.test.js",
        "src/pages/distribution/ConnectionCenterPage.enterprise-surface.contract.test.js",
    ],
    "1d462bf27ac1172a57d01c7101d49471d8d33448": [
        "src/api/adminBranding.ts", "src/api/airbnbHostSelfService.ts",
        "src/api/distribution.ts", "src/api/distributionFullSync.ts",
        "src/api/properties.ts", "src/auth/RequireGuest.tsx",
        "src/pages/dashboard/locks/TtlockConnectPage.tsx",
        "src/pages/integrations/TtlockConnectPage.tsx",
        "src/pages/property-detail/PropertyDetailPage.tsx",
        ".github/scripts/dashboard-typescript-zero.test.mjs",
    ],
}
REVIEWED = {
    "src/app/layout/AppShell.tsx": "ccd21438114f88f96f0682d9e13e8e6cd5150f38",
    ".github/scripts/booking-com-responsive.contract.test.mjs": "9b501017abaa5bb81dcffd38cc7e0dbd8890d2c0",
    ".github/scripts/booking-com-responsive-browser-check.py": "1037a13234d7bda7cbdcb38bef3630fb4c4a277b"
}
CONTROLS = {
    "vercel.json",
    ".github/scripts/verify-booking-com-integrated-scope.py",
    ".github/workflows/booking-com-white-label-safe.yml",
    ".github/workflows/airbnb-automatic-listing-discovery.yml",
    ".github/workflows/connection-center-certified-full-sync-restore.yml",
}

def git(*args):
    return subprocess.check_output(["git", *args])

subprocess.run(["git", "merge-base", "--is-ancestor", "9c78a70502d889f5d504efeb722701c93f3efeb5", "HEAD"], check=True)
expected = set(CONTROLS) | set(REVIEWED)
for ref, paths in GROUPS.items():
    for path in paths:
        assert Path(path).read_bytes() == git("show", f"{ref}:{path}"), f"Unreviewed behavior change: {path}"
        expected.add(path)
        print(f"EXACT {ref} {path}")
for path, expected_hash in REVIEWED.items():
    content = Path(path).read_bytes()
    actual_hash = hashlib.sha1(f"blob {len(content)}\0".encode() + content).hexdigest()
    assert actual_hash == expected_hash, f"Unreviewed responsive/test change: {path}"
    print(f"REVIEWED {actual_hash} {path}")
actual = set(git("diff", "--name-only", BASE, "HEAD").decode().splitlines())
assert actual == expected, {"unexpected": sorted(actual - expected), "missing": sorted(expected - actual)}
original = json.loads(git("show", f"{BASE}:vercel.json"))
original["git"]["deploymentEnabled"]["agent/booking-com-white-label-safe"] = False
original["git"]["deploymentEnabled"]["agent/booking-com-integrated-closure"] = False
assert json.loads(Path("vercel.json").read_text()) == original, "CSP, rewrites or deployment settings changed"
# Files outside the exact diff remain byte-identical, including authentication,
# callback, routes, frame-origin policy, dependencies and Full Sync control.
print(f"PASS: exact {len(expected)}-file integrated scope; all business sources and provider boundaries preserved")
