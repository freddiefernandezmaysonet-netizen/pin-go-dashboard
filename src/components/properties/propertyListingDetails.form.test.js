import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Execute the actual pure TypeScript boundary with strict type checking, using
// the repository's existing compiler. No new test dependency or network needed.
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "pingo-listing-details-"));
process.on("exit", () => fs.rmSync(outDir, { recursive: true, force: true }));
fs.writeFileSync(path.join(outDir, "package.json"), '{"type":"commonjs"}');
const entry = path.resolve("src/components/properties/propertyListingDetails.form.ts");
const program = ts.createProgram([entry], {
  strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
  types: [], outDir,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
assert.equal(program.emit().emitSkipped, false);
const require = createRequire(import.meta.url);
const { emptyListingDetails, hydrateListingDetails, buildListingDetailsPayload, parseListingDetailsResponse, requestListingDetails } = require(path.join(outDir, "propertyListingDetails.form.js"));

function fixture() {
  return {
    ...buildListingDetailsPayload(emptyListingDetails()),
    id: "listing-test", propertyId: "property-test", version: 7,
    createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
    accommodationType: "ENTIRE_PLACE", bedroomCount: 1, fullBathroomCount: 1, halfBathroomCount: 0,
    minimumPrimaryBookingGuestAge: 21, childrenPolicy: "ALLOWED", adultsOnly: "NO",
    sleepingAreas: [
      { id: "room-id", listingDetailsId: "listing-test", kind: "BEDROOM", nameEn: "Main", nameEs: "Principal", sortOrder: 4,
        beds: [{ id: "bed-id", sleepingAreaId: "room-id", type: "QUEEN", quantity: 1, createdAt: "internal" }] },
      { id: "area-id", kind: "SLEEPING_AREA", nameEn: "Living room", nameEs: "Sala", sortOrder: 8,
        beds: [{ type: "SOFA_BED", quantity: 1 }] },
    ],
    sharedSpaces: [{ id: "shared-id", listingDetailsId: "listing-test", type: "POOL", labelEn: "Shared pool", labelEs: "Piscina compartida", sortOrder: 12 }],
    safetyConsiderations: [{ id: "safety-id", type: "STAIRS", descriptionEn: "Eight stairs", descriptionEs: "Ocho escalones", isActive: false, sortOrder: 9 }],
    additionalConsiderations: [{ id: "note-id", titleEn: "Road", titleEs: null, descriptionEn: "Narrow road", descriptionEs: "Carretera estrecha", isActive: true, sortOrder: 16 }],
  };
}
function envelope(details = fixture()) { return { ok: true, maxGuests: 4, listingDetails: details }; }
function noMetadata(value) {
  if (Array.isArray(value)) return value.forEach(noMetadata);
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!["id", "propertyId", "version", "createdAt", "updatedAt", "listingDetailsId", "sleepingAreaId", "organizationId", "maxGuests"].includes(key), key);
    noMetadata(item);
  }
}

test("explicit null means an unconfigured property, not false or zero facts", () => {
  const { form, version } = parseListingDetailsResponse(envelope(null), "property-test");
  assert.equal(version, null); assert.equal(form.minimumPrimaryBookingGuestAge, "");
  assert.equal(form.bedroomCount, ""); assert.equal(form.smokeDetector, "UNKNOWN");
});
test("fresh empty forms do not share mutable arrays", () => {
  const a = emptyListingDetails(); a.sleepingAreas.push({});
  assert.equal(emptyListingDetails().sleepingAreas.length, 0);
});
test("load excludes internal root and nested metadata", () => noMetadata(hydrateListingDetails(fixture())));
test("GET to PUT preserves shared spaces with bilingual labels", () => {
  const payload = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  assert.deepEqual(payload.sharedSpaces, [{ type: "POOL", labelEn: "Shared pool", labelEs: "Piscina compartida", sortOrder: 12 }]);
});
test("GET to PUT preserves inactive safety disclosures and ordering", () => {
  const payload = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  assert.deepEqual(payload.safetyConsiderations, [{ type: "STAIRS", descriptionEn: "Eight stairs", descriptionEs: "Ocho escalones", isActive: false, sortOrder: 9 }]);
});
test("GET to PUT preserves additional conditions, including null translations", () => {
  const payload = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  assert.deepEqual(payload.additionalConsiderations, [{ titleEn: "Road", titleEs: null, descriptionEn: "Narrow road", descriptionEs: "Carretera estrecha", isActive: true, sortOrder: 16 }]);
});
test("second save does not leak database metadata into the strict write schema", () => {
  const first = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  const reloaded = hydrateListingDetails({ ...first, id: "listing-test", propertyId: "property-test", version: 8, createdAt: "internal" });
  const second = buildListingDetailsPayload(reloaded);
  noMetadata(second); assert.deepEqual(second, first);
});
test("payload whitelist also rejects accidental spread-through from a polluted form", () => {
  const form = { ...hydrateListingDetails(fixture()), id: "bad", version: 7, organizationId: "other", maxGuests: 99 };
  const payload = buildListingDetailsPayload(form); noMetadata(payload);
  assert.deepEqual(Object.keys(payload).sort(), Object.keys(emptyListingDetails()).sort());
});
test("editing the primary age preserves rooms, conditions and children policy", () => {
  const form = hydrateListingDetails(fixture()); const before = buildListingDetailsPayload(form);
  form.minimumPrimaryBookingGuestAge = "23"; const after = buildListingDetailsPayload(form);
  assert.deepEqual(after, { ...before, minimumPrimaryBookingGuestAge: 23 });
});
test("unknown, no and zero remain distinct on a round trip", () => {
  const db = fixture(); db.bedroomCount = 0; db.sleepingAreas = []; db.smokeDetector = "NO";
  const result = buildListingDetailsPayload(hydrateListingDetails(db));
  assert.equal(result.bedroomCount, 0); assert.equal(result.smokeDetector, "NO");
  assert.equal(result.carbonMonoxideDetector, "UNKNOWN"); assert.equal(result.parkingVehicleCapacity, null);
});
test("sleeping areas preserve bedroom distinction, bed types and ordering", () => {
  const payload = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  assert.equal(payload.bedroomCount, 1); assert.deepEqual(payload.sleepingAreas.map((area) => [area.kind, area.sortOrder]), [["BEDROOM", 4], ["SLEEPING_AREA", 8]]);
  assert.deepEqual(payload.sleepingAreas[1].beds, [{ type: "SOFA_BED", quantity: 1 }]);
});
for (const field of ["sharedSpaces", "safetyConsiderations", "additionalConsiderations", "sleepingAreas"]) {
  test(`missing ${field} blocks loading instead of silently erasing data`, () => {
    const db = fixture(); delete db[field]; assert.throws(() => hydrateListingDetails(db), /Invalid listing details/);
  });
}
test("malformed nested data cannot fall back to invented OTHER, BEDROOM or quantity", () => {
  const db = fixture(); db.sleepingAreas[0].beds[0].type = "INVALID";
  assert.throws(() => hydrateListingDetails(db), /bed.type/);
});
test("wrong-property response cannot hydrate a form", () => {
  assert.throws(() => parseListingDetailsResponse(envelope(), "another-property"), /propertyId/);
});
test("missing envelope data is not interpreted as first-time configuration", () => {
  for (const response of [{ ok: true }, { ok: false, listingDetails: null }, [], null]) {
    assert.throws(() => parseListingDetailsResponse(response, "property-test"));
  }
});
test("a successful save must return an existing row with a valid version", () => {
  assert.throws(() => parseListingDetailsResponse(envelope(null), "property-test", true));
  assert.throws(() => parseListingDetailsResponse(envelope({ ...fixture(), version: 0 }), "property-test", true));
});
for (const value of ["not-a-number", "NaN", "Infinity", "-1", "1.5"]) {
  test(`invalid number ${value} cannot become null in JSON`, () => {
    const form = hydrateListingDetails(fixture()); form.fullBathroomCount = value;
    assert.throws(() => buildListingDetailsPayload(form), /fullBathroomCount/);
  });
}
test("primary age 21 does not prohibit children", () => {
  const payload = buildListingDetailsPayload(hydrateListingDetails(fixture()));
  assert.equal(payload.minimumPrimaryBookingGuestAge, 21); assert.equal(payload.childrenPolicy, "ALLOWED");
});
test("Adults Only contradiction is blocked before a write", () => {
  const form = hydrateListingDetails(fixture()); form.adultsOnly = "YES";
  assert.throws(() => buildListingDetailsPayload(form), /Adults Only/);
});
test("unknown enum does not masquerade as a confirmed answer", () => {
  const db = fixture(); db.smokeDetector = false; assert.throws(() => hydrateListingDetails(db), /smokeDetector/);
});
test("quiet hours support an overnight range and reject incomplete hours", () => {
  const form = hydrateListingDetails(fixture()); form.quietHoursEnabled = "YES";
  form.quietHoursStart = "22:00"; assert.throws(() => buildListingDetailsPayload(form), /Quiet hours/);
  form.quietHoursEnd = "08:00"; assert.equal(buildListingDetailsPayload(form).quietHoursEnd, "08:00");
});
test("camera and animal disclosures are required when the features are present", () => {
  const form = hydrateListingDetails(fixture()); form.exteriorSecurityCameras = "YES";
  assert.throws(() => buildListingDetailsPayload(form), /exterior cameras/);
  form.exteriorSecurityCamerasDisclosureEs = "Solo en la entrada exterior";
  form.animalsOnProperty = "YES"; assert.throws(() => buildListingDetailsPayload(form), /animals/);
});
test("HTTP read/write round trip uses credentials, safe payload and returned version", async () => {
  let stored = fixture(); const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, ...init });
    if (init.method === "PUT") { const data = JSON.parse(init.body); noMetadata(data); stored = { ...stored, ...data, version: stored.version + 1 }; }
    return new Response(JSON.stringify(envelope(stored)), { status: 200 });
  };
  const signal = new AbortController().signal;
  const first = await requestListingDetails(fakeFetch, "/mock/listing-details", "property-test", signal);
  first.form.minimumPrimaryBookingGuestAge = "22";
  const saved = await requestListingDetails(fakeFetch, "/mock/listing-details", "property-test", signal, buildListingDetailsPayload(first.form));
  const reloaded = await requestListingDetails(fakeFetch, "/mock/listing-details", "property-test", signal);
  const second = await requestListingDetails(fakeFetch, "/mock/listing-details", "property-test", signal, buildListingDetailsPayload(reloaded.form));
  assert.equal(saved.version, 8); assert.equal(second.version, 9);
  assert.equal(reloaded.form.minimumPrimaryBookingGuestAge, "22"); assert.equal(second.form.sharedSpaces.length, 1);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "PUT", "GET", "PUT"]);
  assert.ok(calls.every((call) => call.credentials === "include"));
});
for (const status of [401, 403, 404, 500]) {
  test(`HTTP ${status} never produces a writable empty form`, async () => {
    await assert.rejects(requestListingDetails(async () => new Response("failure", { status }), "/mock", "property-test", new AbortController().signal), new RegExp(`HTTP ${status}`));
  });
}
test("non-JSON success response is rejected", async () => {
  await assert.rejects(requestListingDetails(async () => new Response("<html>error</html>"), "/mock", "property-test", new AbortController().signal));
});
test("an aborted late response cannot apply another property's data", async () => {
  const controller = new AbortController(); let release;
  const pending = requestListingDetails(() => new Promise((resolve) => { release = resolve; }), "/mock", "property-test", controller.signal);
  controller.abort(); release(new Response(JSON.stringify(envelope())));
  await assert.rejects(pending, { name: "AbortError" });
});
