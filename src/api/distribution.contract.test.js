import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import "./airbnbHostSelfService.test.js";

const source = readFileSync(new URL("./distribution.ts", import.meta.url), "utf8");
const airbnbSource = readFileSync(new URL("./airbnbHostSelfService.ts", import.meta.url), "utf8");
const framePolicy = readFileSync(new URL("../lib/distributionFramePolicy.ts", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const propertyEditor = readFileSync(new URL("../pages/properties/PropertyEditPage.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../app/routes/router.tsx", import.meta.url), "utf8");
const connectionCenterPage = readFileSync(new URL("../pages/distribution/ConnectionCenterPage.tsx", import.meta.url), "utf8");
const callbackPage = readFileSync(new URL("../pages/distribution/AirbnbConnectionCallbackPage.tsx", import.meta.url), "utf8");
const propertyDetail = readFileSync(new URL("../pages/property-detail/PropertyDetailPage.tsx", import.meta.url), "utf8");

test("Connection Center client is property-scoped and credentialed", () => {
  assert.match(source, /\/api\/dashboard\/distribution\/properties\/\$\{encodeURIComponent\(propertyId\)\}/);
  assert.match(source, /credentials:\s*"include"/);
  assert.match(source, /cache:\s*"no-store"/);
});

test("Connection Center client uses Pin&Go white-label contract", () => {
  assert.match(source, /Distribution by Pin&Go/);
  assert.doesNotMatch(source.toLowerCase(), /channex/);
});

test("Connection Center parser rejects unknown lifecycle values", () => {
  for (const catalog of ["DISTRIBUTION_PROVIDERS", "DISTRIBUTION_CHANNEL_STATUSES", "DISTRIBUTION_READINESS_STATUSES", "DISTRIBUTION_NEXT_ACTIONS"]) assert.match(source, new RegExp(`isMember\\(${catalog}`));
  assert.match(source, /INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE/);
});

test("legacy property controls cannot bypass the commercial lifecycle", () => {
  assert.doesNotMatch(propertyEditor, /\/distribution\/enable/);
  assert.doesNotMatch(propertyEditor, /\/channex\/(?:provision|sync-availability)/i);
  assert.doesNotMatch(propertyEditor, /distributionEnabled:\s*form\.distributionEnabled/);
  assert.doesNotMatch(router, /ChannexFullSyncPanel/);
});

test("Connection Center is routed from property detail and restricted to administrators", () => {
  assert.match(router, /properties\/:id\/distribution/);
  assert.match(propertyDetail, /Abrir centro de conexiones/);
  assert.match(connectionCenterPage, /ADMIN_ROLES\.has\(user\.role\)/);
});

test("Booking.com session fallback remains sandboxed", () => {
  assert.match(connectionCenterPage, /<ConnectionFrame/);
  assert.match(connectionCenterPage, /sandbox="allow-forms allow-popups allow-scripts allow-same-origin"/);
  assert.match(connectionCenterPage, /referrerPolicy="no-referrer"/);
  assert.match(connectionCenterPage, /srcDoc=\{props\.simulated/);
  assert.doesNotMatch(connectionCenterPage, /localStorage|sessionStorage/);
});

test("Airbnb real flow uses connection-link and top-level navigation, never the legacy session handoff", () => {
  assert.match(airbnbSource, /channels\/AIRBNB\/connection-link/);
  assert.match(connectionCenterPage, /provider === "AIRBNB"/);
  assert.match(connectionCenterPage, /issueAirbnbHostConnectionLink\(id\)/);
  assert.match(connectionCenterPage, /window\.location\.assign\(link\.authorizationUrl\)/);
  assert.doesNotMatch(connectionCenterPage, /AirbnbExternalHandoff/);
  assert.doesNotMatch(connectionCenterPage, /Ya terminé en Airbnb/);
  assert.doesNotMatch(connectionCenterPage, /reconcileDistributionChannel/);
});

test("Airbnb authorization handoff remains credentialed and separate from frame policy", () => {
  // Executable document-derived URL cases run in airbnbHostSelfService.test.js.
  // Other channels retain the exact-origin frame policy asserted below.
  assert.match(airbnbSource, /credentials:\s*"include"/);
  assert.match(airbnbSource, /cache:\s*"no-store"/);
});

test("Airbnb callback is authenticated, strips OAuth artifacts, and verifies server-side", () => {
  assert.match(router, /distribution\/airbnb\/callback/);
  assert.match(router, /<RequireAuth>\s*<AppShell\s*\/>\s*<\/RequireAuth>/);
  assert.match(callbackPage, /searchParams\.get\("channel_id"\)/);
  assert.match(callbackPage, /searchParams\.get\("token"\)/);
  assert.match(callbackPage, /history\.replaceState/);
  assert.match(callbackPage, /verifyAirbnbHostCallback/);
  assert.match(airbnbSource, /airbnb\/callback\/verify/);
  assert.doesNotMatch(callbackPage, /localStorage|sessionStorage/);
});

test("Airbnb callback never represents authorization as activation", () => {
  assert.match(callbackPage, /La activación del canal permanece separada de esta autorización/);
  assert.match(callbackPage, /continuará con la preparación del mapeo antes de cualquier activación/);
  assert.doesNotMatch(callbackPage, /activar|activation endpoint/i);
});

test("connection session remains restricted to exact frame origins", () => {
  assert.match(source, /isAllowedDistributionFrameUrl\(session\.launchUrl\)/);
  assert.match(framePolicy, /https:\/\/app\.channex\.io/);
  assert.match(framePolicy, /https:\/\/staging\.channex\.io/);
  const csp = vercel.headers.flatMap((entry) => entry.headers).find((header) => header.key === "Content-Security-Policy")?.value;
  assert.match(csp, /frame-src 'self' https:\/\/app\.channex\.io https:\/\/staging\.channex\.io/);
  assert.match(csp, /object-src 'none'/);
});

test("simulation remains explicit and makes no external calls or data changes", () => {
  assert.match(connectionCenterPage, /searchParams\.get\("simulation"\) === "1"/);
  assert.match(connectionCenterPage, /no se harán llamadas externas ni cambios de datos/i);
});
