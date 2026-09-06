import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./distribution.ts", import.meta.url), "utf8");
const framePolicy = readFileSync(
  new URL("../lib/distributionFramePolicy.ts", import.meta.url),
  "utf8"
);
const vercel = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")
);
const propertyEditor = readFileSync(
  new URL("../pages/properties/PropertyEditPage.tsx", import.meta.url),
  "utf8"
);
const router = readFileSync(
  new URL("../app/routes/router.tsx", import.meta.url),
  "utf8"
);
const connectionCenterPage = readFileSync(
  new URL("../pages/distribution/ConnectionCenterPage.tsx", import.meta.url),
  "utf8"
);
const propertyDetail = readFileSync(
  new URL("../pages/property-detail/PropertyDetailPage.tsx", import.meta.url),
  "utf8"
);

test("Connection Center client is property-scoped and credentialed", () => {
  assert.match(
    source,
    /\/api\/dashboard\/distribution\/properties\/\$\{encodeURIComponent\(propertyId\)\}/
  );
  assert.match(source, /credentials:\s*"include"/);
  assert.match(source, /cache:\s*"no-store"/);
});

test("Connection Center client uses Pin&Go white-label contract", () => {
  assert.match(source, /Distribution by Pin&Go/);
  assert.doesNotMatch(source.toLowerCase(), /channex/);
});

test("Connection Center parser rejects unknown lifecycle values", () => {
  for (const catalog of [
    "DISTRIBUTION_PROVIDERS",
    "DISTRIBUTION_CHANNEL_STATUSES",
    "DISTRIBUTION_READINESS_STATUSES",
    "DISTRIBUTION_NEXT_ACTIONS",
  ]) {
    assert.match(source, new RegExp(`isMember\\(${catalog}`));
  }
  assert.match(source, /INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE/);
});

test("legacy property controls cannot bypass the commercial lifecycle", () => {
  assert.doesNotMatch(propertyEditor, /\/distribution\/enable/);
  assert.doesNotMatch(propertyEditor, /\/channex\/(?:provision|sync-availability)/i);
  assert.doesNotMatch(propertyEditor, /distributionEnabled:\s*form\.distributionEnabled/);
  assert.doesNotMatch(router, /ChannexFullSyncPanel/);
});

test("mutations are tenant-route scoped and carry fresh idempotency keys", () => {
  assert.match(source, /channels\/\$\{encodeURIComponent\(provider\)\}\/prepare/);
  assert.match(source, /channels\/\$\{encodeURIComponent\(provider\)\}\/session/);
  assert.match(source, /"Idempotency-Key":\s*createIdempotencyKey/);
  assert.match(source, /crypto\?\.randomUUID/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("Connection Center is routed from property detail and restricted to administrators", () => {
  assert.match(router, /properties\/:id\/distribution/);
  assert.match(propertyDetail, /Abrir centro de conexiones/);
  assert.match(connectionCenterPage, /ADMIN_ROLES\.has\(user\.role\)/);
});

test("iframe is ephemeral, sandboxed and only rendered after a session exists", () => {
  assert.match(connectionCenterPage, /\{session && <ConnectionFrame/);
  assert.match(connectionCenterPage, /sandbox="allow-forms allow-popups allow-scripts allow-same-origin"/);
  assert.match(connectionCenterPage, /referrerPolicy="no-referrer"/);
  assert.match(connectionCenterPage, /srcDoc=\{props\.simulated/);
  assert.doesNotMatch(connectionCenterPage, /localStorage|sessionStorage/);
});

test("connection session is restricted to exact frame origins without a duplicated token field", () => {
  assert.doesNotMatch(source, /typeof session\.token/);
  assert.match(source, /isAllowedDistributionFrameUrl\(session\.launchUrl\)/);
  assert.match(framePolicy, /https:\/\/app\.channex\.io/);
  assert.match(framePolicy, /https:\/\/staging\.channex\.io/);
  assert.match(framePolicy, /DISTRIBUTION_FRAME_ORIGINS\.has\(parsed\.origin\)/);

  const csp = vercel.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  assert.match(csp, /frame-src 'self' https:\/\/app\.channex\.io https:\/\/staging\.channex\.io/);
  assert.match(csp, /object-src 'none'/);
});

test("simulation is explicit and states that it makes no external calls or data changes", () => {
  assert.match(connectionCenterPage, /searchParams\.get\("simulation"\) === "1"/);
  assert.match(connectionCenterPage, /no se harán llamadas externas ni cambios de datos/i);
});
