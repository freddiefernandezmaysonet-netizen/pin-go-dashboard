import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const router = fs.readFileSync(
  new URL("../app/routes/router.tsx", import.meta.url),
  "utf8"
);
const authApi = fs.readFileSync(new URL("../api/auth.ts", import.meta.url), "utf8");
const authProvider = fs.readFileSync(
  new URL("./AuthProvider.tsx", import.meta.url),
  "utf8"
);
const requireAuth = fs.readFileSync(
  new URL("./RequireAuth.tsx", import.meta.url),
  "utf8"
);
const guestPortal = fs.readFileSync(
  new URL("../pages/public-booking/GuestCancellationPage.tsx", import.meta.url),
  "utf8"
);

test("guest manage reservation remains a public router surface", () => {
  assert.match(
    router,
    /path:\s*"\/booking\/manage\/:guestToken"[\s\S]*?element:\s*<GuestCancellationPage\s*\/>/
  );

  const publicManageIndex = router.indexOf('path: "/booking/manage/:guestToken"');
  const protectedBoundaryIndex = router.indexOf("<RequireAuth>\n        <AppShell />");

  assert.ok(publicManageIndex >= 0);
  assert.ok(protectedBoundaryIndex >= 0);
  assert.ok(
    publicManageIndex < protectedBoundaryIndex,
    "Manage Reservation must be declared outside the protected AppShell boundary"
  );
});

test("direct-booking public routes remain outside the protected AppShell boundary", () => {
  const protectedBoundaryIndex = router.indexOf("<RequireAuth>\n        <AppShell />");
  assert.ok(protectedBoundaryIndex >= 0);

  for (const route of [
    'path: "/book/:organizationSlug"',
    'path: "/book/:organizationSlug/:propertySlug"',
    'path: "/booking/success"',
    'path: "/booking/cancel"',
    'path: "/booking/manage/:guestToken"',
  ]) {
    const routeIndex = router.indexOf(route);
    assert.ok(routeIndex >= 0, `Missing public route: ${route}`);
    assert.ok(
      routeIndex < protectedBoundaryIndex,
      `Public route crossed into RequireAuth: ${route}`
    );
  }

  assert.match(router, /path:\s*"\/review"/);
});

test("guest portal uses guest-token public booking endpoints directly", () => {
  assert.match(
    guestPortal,
    /\/api\/public-booking\/manage\/\$\{encodeURIComponent\(/
  );
  assert.match(guestPortal, /\/cancellation-preview/);
  assert.match(guestPortal, /\/modification-options/);
  assert.match(guestPortal, /\/cancel/);
  assert.doesNotMatch(guestPortal, /RequireAuth/);
});

test("global auth discovery never redirects a public page to login", () => {
  assert.match(authApi, /export async function fetchMeState/);
  assert.match(authApi, /sessionError:/);
  assert.doesNotMatch(authApi, /window\.location\.(assign|href)/);
  assert.match(authProvider, /fetchMeState/);
  assert.match(authProvider, /setSessionError/);
});

test("protected routes preserve session-expiry and reauthentication redirects", () => {
  assert.match(requireAuth, /loginPathForSessionError/);
  assert.match(requireAuth, /sessionError/);
  assert.match(
    requireAuth,
    /to=\{loginPathForSessionError\(sessionError\) \?\? "\/login"\}/
  );
});
