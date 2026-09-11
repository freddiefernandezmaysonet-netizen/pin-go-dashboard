import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(
  new URL("../../api/airbnbHostSelfService.ts", import.meta.url),
  "utf8"
);
const callbackPage = readFileSync(
  new URL("./AirbnbConnectionCallbackPage.tsx", import.meta.url),
  "utf8"
);
const centerPage = readFileSync(
  new URL("./ConnectionCenterPage.tsx", import.meta.url),
  "utf8"
);

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test("Airbnb listing client uses the authenticated read-only dashboard GET contract", () => {
  const getHelper = between(api, "async function get(", "function safeAuthorizationUrl");
  assert.match(getHelper, /method: "GET"/);
  assert.match(getHelper, /credentials: "include"/);
  assert.match(getHelper, /cache: "no-store"/);
  assert.match(getHelper, /Accept: "application\/json"/);
  assert.doesNotMatch(getHelper, /Idempotency-Key|body:/);

  assert.match(api, /export async function listAirbnbHostListings/);
  assert.match(
    api,
    /\/api\/dashboard\/distribution\/properties\/\$\{encodeURIComponent\(propertyId\)\}\/channels\/AIRBNB\/listings/
  );
  assert.match(api, /payload\.ok !== true \|\| !Array\.isArray\(payload\.listings\)/);
});

test("Airbnb listing response parser is exact and does not expose a provider channel id", () => {
  assert.match(api, /export type AirbnbHostListing = \{/);
  for (const field of [
    "id: string",
    "title: string | null",
    "type: string | null",
    "occupancies: number[] | null",
    "synchronizationCategory: string | null",
    "city: string | null",
    "countryCode: string | null",
    "qualityStatus: string | null",
  ]) {
    assert.ok(api.includes(field), `missing listing field ${field}`);
  }
  assert.match(api, /typeof value\.id !== "string" \|\| !value\.id/);
  assert.doesNotMatch(api, /AirbnbHostListing[\s\S]*channelId:/);
});

test("successful Airbnb callback returns automatically to the property booking channels", () => {
  assert.match(callbackPage, /verifyAirbnbHostCallback\(\{ success, channelId, token \}\)/);
  assert.match(
    callbackPage,
    /navigate\(`\/properties\/\$\{encodeURIComponent\(result\.propertyId\)\}\/distribution`,\s*\{\s*replace: true,?\s*\}\)/
  );
  assert.doesNotMatch(callbackPage, /Volver al Centro de conexiones|Retorno verificado/);
  assert.doesNotMatch(callbackPage, /listAirbnbHostListings/);
});

test("linked Airbnb performs one automatic listing read per mounted property and never polls", () => {
  assert.match(centerPage, /useRef<string \| null>\(null\)/);
  assert.match(centerPage, /airbnb\?\.channelLinked && airbnb\.status === "NOT_CONNECTED"/);
  assert.match(centerPage, /listingDiscoveryStartedFor\.current === id/);
  assert.match(centerPage, /listingDiscoveryStartedFor\.current = id/);
  assert.equal((centerPage.match(/listAirbnbHostListings\(id\)/g) ?? []).length, 1);
  assert.doesNotMatch(centerPage, /setInterval|setTimeout|requestAnimationFrame/);
  assert.match(centerPage, /Preparing your Airbnb properties…/);
  assert.match(centerPage, /Airbnb properties/);
  assert.match(centerPage, /No Airbnb properties were returned for this account/);
});

test("listing presentation is read-only and stops before mapping activation or reservation import", () => {
  const panel = between(centerPage, "function AirbnbListingsPanel", "function ConnectionFrame");
  assert.doesNotMatch(panel, /<button|onClick|href=/);
  assert.doesNotMatch(api + callbackPage + centerPage, /\/mappings|\/activate|load_future_reservations/);
  assert.doesNotMatch(api + callbackPage + centerPage, /Map listing|Activate channel|Load reservations/);
});
