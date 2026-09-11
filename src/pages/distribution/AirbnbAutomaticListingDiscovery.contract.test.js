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
  assert.match(api, /payload\.ok !== true/);
  assert.match(api, /!Array\.isArray\(payload\.listings\)/);
});

test("Airbnb discovery parser accepts listing and match evidence but no provider channel id", () => {
  const listingType = between(
    api,
    "export type AirbnbHostListing = {",
    "export type AirbnbPropertyMatchStatus"
  );
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
    assert.ok(listingType.includes(field), `missing listing field ${field}`);
  }
  assert.doesNotMatch(listingType, /channelId:/);
  assert.match(
    api,
    /value === "AUTO_MATCH" \|\| value === "REVIEW_REQUIRED" \|\| value === "UNMATCHED"/
  );
  assert.match(api, /candidateListingId: nullableText\(value\.candidateListingId\)/);
  assert.match(api, /match: parseMatch\(payload\.match\)/);
  assert.match(api, /reasons: \[\.\.\.value\.reasons\] as string\[\]/);
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

test("linked Airbnb performs one pre-activation discovery read and never polls", () => {
  const discoveryStatuses = between(
    centerPage,
    "const AIRBNB_LISTING_DISCOVERY_STATUSES = new Set([",
    "]);"
  );
  for (const status of ["NOT_CONNECTED", "AUTHORIZATION_REQUIRED", "MAPPING_REQUIRED"]) {
    assert.ok(discoveryStatuses.includes(`"${status}"`), `missing eligible status ${status}`);
  }
  for (const status of [
    "READINESS_CHECK",
    "ACTIVATION_PENDING",
    "ACTIVE",
    "DEGRADED",
    "FAILED",
    "DISCONNECTING",
    "DISCONNECTED",
  ]) {
    assert.ok(!discoveryStatuses.includes(`"${status}"`), `unexpected eligible status ${status}`);
  }

  assert.match(centerPage, /channel\.channelLinked &&\s*AIRBNB_LISTING_DISCOVERY_STATUSES\.has\(channel\.status\)/);
  assert.match(centerPage, /listingDiscoveryStartedFor\.current === id/);
  assert.match(centerPage, /listingDiscoveryStartedFor\.current = id/);
  assert.equal((centerPage.match(/listAirbnbHostListings\(id\)/g) ?? []).length, 1);
  assert.doesNotMatch(centerPage, /setInterval|requestAnimationFrame/);
});

test("property presentation shows only the current match decision instead of rendering the full account portfolio", () => {
  const panel = between(centerPage, "function AirbnbListingsPanel", "function ConnectionFrame");
  assert.match(panel, /Matched automatically/);
  assert.match(panel, /Review required/);
  assert.match(panel, /No confident match/);
  assert.match(panel, /listings\.find\(\(listing\) => listing\.id === match\.candidateListingId\)/);
  assert.doesNotMatch(panel, /listings\.map\(/);
  assert.doesNotMatch(panel, /candidateListingId\}/);
});

test("review-required presentation explains host-facing blockers without exposing raw reason codes", () => {
  const reasons = between(centerPage, "function reviewReasonMessages", "function AirbnbListingsPanel");
  const panel = between(centerPage, "function AirbnbListingsPanel", "function ConnectionFrame");

  assert.match(panel, /reviewReasonMessages\(match\.reasons\)/);
  assert.match(panel, /Why Pin&Go needs review/);
  assert.match(reasons, /Guest capacity differs between Pin&Go and Airbnb\./);
  assert.match(reasons, /ZIP \/ postal code differs between Pin&Go and Airbnb\./);
  assert.match(reasons, /Airbnb property details could not be verified\./);
  assert.match(reasons, /More than one Airbnb property could match this Pin&Go property\./);
  assert.match(reasons, /This Airbnb property also appears to match another Pin&Go property\./);
  assert.match(reasons, /Airbnb uses a different city or locality name for this property\./);
  assert.doesNotMatch(panel, /\{match\.reasons\}|\{reason\}/);
});

test("listing metadata does not infer guest capacity from Airbnb occupancy options", () => {
  const meta = between(centerPage, "function listingMeta", "function reviewReasonMessages");
  assert.match(meta, /listing\.city/);
  assert.match(meta, /listing\.countryCode/);
  assert.doesNotMatch(meta, /occupancies|Math\.max|Up to|guests/);
});

test("linked Airbnb is not offered a second connection action while discovery is pending", () => {
  assert.match(
    centerPage,
    /const airbnbChannelLinked = channel\.provider === "AIRBNB" && channel\.channelLinked/
  );
  assert.match(centerPage, /const canConnect = [^;]+&& !airbnbChannelLinked/);
  assert.match(centerPage, /const airbnbDiscoveryEligible = isAirbnbListingDiscoveryEligible\(channel\)/);
});

test("host-confirmed mapping client uses the protected mapping POST contract", () => {
  assert.match(api, /export const AIRBNB_HOST_MAPPING_CONFIRMATION =\s*"CONFIRM_AIRBNB_PROPERTY_MAPPING"/);
  assert.match(api, /export async function confirmAirbnbHostMapping/);
  assert.match(
    api,
    /\/api\/dashboard\/distribution\/properties\/\$\{encodeURIComponent\(args\.propertyId\)\}\/channels\/AIRBNB\/mapping/
  );
  assert.match(api, /"mapping-confirm"/);
  assert.match(api, /listingId: args\.listingId/);
  assert.match(api, /confirmation: AIRBNB_HOST_MAPPING_CONFIRMATION/);
  assert.match(api, /"MAPPING_SUBMITTED"/);
  assert.match(api, /"ALREADY_MAPPED"/);
});

test("mapping is explicit host confirmation for both automatic and review candidates", () => {
  const panel = between(centerPage, "function AirbnbListingsPanel", "function ConnectionFrame");
  assert.match(panel, /Yes, this is my Airbnb property/);
  assert.match(panel, /Host confirmation is required before mapping\./);
  assert.match(panel, /Review it and explicitly confirm it before mapping\./);
  assert.match(panel, /props\.onConfirm\(candidate\.id\)/);
  assert.match(panel, /match\.status !== "UNMATCHED"/);
  assert.match(panel, /!match\.reasons\.includes\("LISTING_CONFLICT"\)/);
  assert.doesNotMatch(panel, /useEffect\([^]*onConfirm/);
});

test("mapping UI stops after mapping and never claims activation or reservation import", () => {
  const panel = between(centerPage, "function AirbnbListingsPanel", "function ConnectionFrame");
  assert.match(panel, /Mapping submitted\. Airbnb is not active yet\./);
  assert.match(panel, /Activation and reservation import have not been performed\./);
  assert.match(panel, /No duplicate mapping was created\./);
  assert.match(centerPage, /confirmAirbnbHostMapping\(\{ propertyId: id, listingId \}\)/);
  assert.doesNotMatch(api + callbackPage + centerPage, /\/activate|load_future_reservations|Activate channel|Load reservations/);
  assert.doesNotMatch(api + centerPage, /app\.channex\.io|staging\.channex\.io|user-api-key/);
});
