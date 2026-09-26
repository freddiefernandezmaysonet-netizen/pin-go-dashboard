import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildListingDetailsPayload, hydrateListingDetails } from "./propertyListingDetails.form";

const card = await readFile(new URL("./PropertyListingDetailsCard.tsx", import.meta.url), "utf8");

test("discovery UI exposes canonical property types, features and free-form experience tags", () => {
  assert.match(card, /Tipo de propiedad \/ Property type/);
  assert.match(card, /value="CABIN"|\["CABIN", "Cabaña \/ Cabin"\]/);
  assert.match(card, /WOOD_CONSTRUCTION/);
  assert.match(card, /OCEAN_VIEW/);
  assert.match(card, /Etiquetas de experiencia \/ Experience tags/);
  assert.match(card, /Romantic retreat, Couples retreat/);
});

test("listing form round-trips discovery fields without dropping replace-all collections", () => {
  const raw = {
    accommodationType: "ENTIRE_PLACE", propertyType: "CABIN",
    bedroomCount: 1, fullBathroomCount: 1, halfBathroomCount: 0,
    minimumPrimaryBookingGuestAge: 21,
    childrenPolicy: "NOT_ALLOWED", infantsPolicy: "NOT_ALLOWED", adultsOnly: "YES",
    petsPolicy: "NOT_ALLOWED", smokingPolicy: "NOT_ALLOWED", vapingPolicy: "NOT_ALLOWED",
    eventsPolicy: "NOT_ALLOWED", unregisteredVisitorsPolicy: "NOT_ALLOWED",
    quietHoursEnabled: "NO", quietHoursStart: null, quietHoursEnd: null,
    parkingAvailability: "NO", parkingType: null, parkingFeeType: null, parkingVehicleCapacity: null,
    smokeDetector: "YES", carbonMonoxideDetector: "YES", exteriorSecurityCameras: "NO",
    exteriorSecurityCamerasDisclosureEn: null, exteriorSecurityCamerasDisclosureEs: null,
    animalsOnProperty: "NO", animalsOnPropertyDisclosureEn: null, animalsOnPropertyDisclosureEs: null,
    stepFreeEntrance: "UNKNOWN", entranceStepCount: null, elevatorAvailable: "UNKNOWN",
    accessibleParking: "UNKNOWN", stepFreeBedroomAccess: "UNKNOWN", stepFreeBathroomAccess: "UNKNOWN", stepFreeShower: "UNKNOWN",
    sleepingAreas: [], sharedSpaces: [],
    features: [{ type: "OCEAN_VIEW", labelEn: null, labelEs: null, isActive: true, sortOrder: 0 }],
    experienceTags: [{ label: "Romantic Retreat", isActive: true, sortOrder: 0 }],
    safetyConsiderations: [], additionalConsiderations: [],
  };
  const form = hydrateListingDetails(raw);
  assert.equal(form.propertyType, "CABIN");
  assert.equal(form.features[0]?.type, "OCEAN_VIEW");
  assert.equal(form.experienceTags[0]?.label, "Romantic Retreat");
  const payload = buildListingDetailsPayload(form);
  assert.equal(payload.propertyType, "CABIN");
  assert.deepEqual(payload.features, raw.features);
  assert.deepEqual(payload.experienceTags, raw.experienceTags);
});
