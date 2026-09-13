import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const page = readFileSync(new URL("./ConnectionCenterPage.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/layout/AppShell.tsx", import.meta.url), "utf8");
const airbnbClient = readFileSync(new URL("../../api/airbnbHostSelfService.ts", import.meta.url), "utf8");
const callbackPage = readFileSync(new URL("./AirbnbConnectionCallbackPage.tsx", import.meta.url), "utf8");

// Execute the actual presentation helpers, not a second implementation of them.
// Discovery/mapping/activation added in merged PRs #68/#73/#75 are legitimate;
// the lasting boundary is that presentation and callback never execute them.
function declaration(source, name) {
  const ast = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === name)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Missing declaration: ${name}`);
  return found.getText(ast);
}

const helpers = ["AIRBNB_LISTING_DISCOVERY_STATUSES", "isAirbnbListingDiscoveryEligible", "statusLabel", "providerPresentation"];
const compiled = ts.transpileModule(helpers.map(name => declaration(page, name)).join("\n"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
});
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const presentation = runInNewContext(`${compiled.outputText}\n({ providerPresentation, isAirbnbListingDiscoveryEligible })`, {}, { timeout: 1000 });

function airbnb(status, channelLinked = true) {
  return { provider: "AIRBNB", name: "Airbnb", availability: "AVAILABLE", status, channelLinked };
}

test("Connection Center uses the established Pin&Go dashboard visual language", () => {
  assert.match(page, /border: "1px solid #e5e7eb"/);
  assert.match(page, /borderRadius: 18/);
  assert.match(page, /background: "#fff"/);
  assert.match(page, /Manage where this property receives reservations/);
  assert.match(page, /Secure connections/);
  assert.match(page, /Back to property/);
  assert.doesNotMatch(page, />Booking channels<\/h1>/);
  assert.doesNotMatch(page, />Booking channel<\/div>/);
});

test("dashboard shell gives distribution its own page title before generic Properties", () => {
  const bookingChannelsIndex = shell.indexOf('return "Booking channels"');
  const propertiesIndex = shell.indexOf('return "Properties"');
  assert.notEqual(bookingChannelsIndex, -1);
  assert.notEqual(propertiesIndex, -1);
  assert.ok(bookingChannelsIndex < propertiesIndex);
  assert.ok(shell.includes('if (/^\\/properties\\/[^/]+\\/distribution(?:\\/|$)/.test(pathname)) return "Booking channels";'));
});

test("Airbnb linked presentation never promotes any pending or failed lifecycle to Active", () => {
  for (const status of ["NOT_CONNECTED", "AUTHORIZATION_REQUIRED", "MAPPING_REQUIRED", "READINESS_CHECK", "ACTIVATION_PENDING", "DEGRADED", "FAILED", "DISCONNECTING", "DISCONNECTED"]) {
    const channel = airbnb(status);
    const result = presentation.providerPresentation(channel, presentation.isAirbnbListingDiscoveryEligible(channel));
    assert.notEqual(result.status, "Active", status);
    assert.notEqual(result.tone, "success", status);
    assert.equal(channel.status, status);
    assert.match(result.description, /linked to this property/);
    assert.doesNotMatch(result.description, /will continue the Airbnb setup|Preparing your Airbnb/);
  }
  const active = airbnb("ACTIVE");
  assert.equal(presentation.providerPresentation(active, false).status, "Active");
});

test("Airbnb discovery remains limited to linked pre-activation states", () => {
  for (const status of ["NOT_CONNECTED", "AUTHORIZATION_REQUIRED", "MAPPING_REQUIRED"]) {
    assert.equal(presentation.isAirbnbListingDiscoveryEligible(airbnb(status)), true);
    assert.equal(presentation.isAirbnbListingDiscoveryEligible(airbnb(status, false)), false);
    assert.equal(presentation.providerPresentation(airbnb(status), true).status, "Setup in progress");
  }
  for (const status of ["READINESS_CHECK", "ACTIVATION_PENDING", "ACTIVE", "DEGRADED", "FAILED", "DISCONNECTING", "DISCONNECTED"]) {
    assert.equal(presentation.isAirbnbListingDiscoveryEligible(airbnb(status)), false, status);
  }
  for (const provider of ["BOOKING_COM", "EXPEDIA", "VRBO"]) {
    assert.equal(presentation.isAirbnbListingDiscoveryEligible({ ...airbnb("NOT_CONNECTED"), provider }), false);
  }
  assert.equal(presentation.isAirbnbListingDiscoveryEligible(undefined), false);
});

test("existing Airbnb and Booking.com connection execution remains in place", () => {
  assert.match(page, /await prepareDistributionChannel\(id, provider\)/);
  assert.match(page, /const link = await issueAirbnbHostConnectionLink\(id\)/);
  assert.match(page, /window\.location\.assign\(link\.authorizationUrl\)/);
  assert.match(page, /issueDistributionConnectionSession\(id, provider\)/);
  assert.match(page, /transitionDistributionConnectionSession\(session\.value\.sessionId, "opened"\)/);
  assert.match(page, /transitionDistributionConnectionSession\(current\.value\.sessionId, "cancelled"\)/);
  assert.match(page, /transitionDistributionConnectionSession\(session\.value\.sessionId, "completed"\)/);
});

test("Expedia and Vrbo presentation remains truthful to current availability contracts", () => {
  assert.equal(presentation.providerPresentation({ provider: "EXPEDIA", availability: "PLANNED", status: "NOT_CONNECTED", channelLinked: false }, false).status, "Coming soon");
  assert.equal(presentation.providerPresentation({ provider: "VRBO", availability: "ASSISTED_BETA", status: "NOT_CONNECTED", channelLinked: false }, false).status, "Assisted setup");
});

test("presentation and mapping remain separate from explicit host activation and reservation import", () => {
  const purePresentation = declaration(page, "providerPresentation");
  assert.doesNotMatch(purePresentation, /listAirbnbHostListings|confirmAirbnbHostMapping|activateAirbnbForHost|verifyAirbnbActivationForHost|fetch\(/);
  const mappingPanel = declaration(page, "AirbnbListingsPanel");
  assert.match(mappingPanel, /props\.onConfirm\(candidate\.id\)/);
  assert.match(mappingPanel, /Host confirmation is required before mapping/);
  assert.match(mappingPanel, /Mapping submitted\. Airbnb is not active yet/);
  assert.doesNotMatch(mappingPanel, /activateAirbnbForHost|verifyAirbnbActivationForHost|load_future_reservations/);
  assert.doesNotMatch(declaration(page, "confirmAirbnbCandidate"), /activateAirbnbForHost|verifyAirbnbActivationForHost|load_future_reservations/);
  assert.match(page, /airbnbChannelLinked && !simulated && \(\s*<AirbnbActivationPanel/);
  assert.doesNotMatch(page, /\/mappings|\/activate|load_future_reservations|user-api-key/);
});

test("Airbnb discovery is a property-scoped read and callback only verifies then returns", () => {
  const listingRead = declaration(airbnbClient, "listAirbnbHostListings");
  assert.match(listingRead, /await get\(/);
  assert.match(listingRead, /encodeURIComponent\(propertyId\)/);
  assert.match(listingRead, /\/channels\/AIRBNB\/listings/);
  assert.doesNotMatch(listingRead, /\bpost\(|activateAirbnbForHost|confirmAirbnbHostMapping/);
  assert.match(callbackPage, /verifyAirbnbHostCallback/);
  assert.match(callbackPage, /navigate\(`\/properties\/\$\{encodeURIComponent\(result\.propertyId\)\}\/distribution`,\s*\{\s*replace: true/);
  assert.doesNotMatch(callbackPage, /listAirbnbHostListings|confirmAirbnbHostMapping|activateAirbnbForHost|verifyAirbnbActivationForHost|load_future_reservations/);
});
