import assert from "node:assert/strict";
import test from "node:test";
import {
  beforeBookingFacts,
  listingFactLabels,
  publicBathrooms,
  totalPublicBeds,
} from "./PublicListingDetailsSections";
import type { PublicListingDetails } from "./publicListingDetails.types";

function fixture(): PublicListingDetails {
  return {
    version: 2, accommodationType: "ENTIRE_PLACE", bedroomCount: 2,
    fullBathroomCount: 1, halfBathroomCount: 1, minimumPrimaryBookingGuestAge: 21,
    childrenPolicy: "ALLOWED", infantsPolicy: "UNKNOWN", adultsOnly: "NO",
    petsPolicy: "NOT_ALLOWED", smokingPolicy: "NOT_ALLOWED", vapingPolicy: "NOT_ALLOWED",
    eventsPolicy: "NOT_ALLOWED", unregisteredVisitorsPolicy: "UNKNOWN",
    quietHoursEnabled: "YES", quietHoursStart: "22:00", quietHoursEnd: "08:00",
    parkingAvailability: "YES", parkingType: "PRIVATE", parkingFeeType: "FREE", parkingVehicleCapacity: 2,
    smokeDetector: "YES", carbonMonoxideDetector: "YES",
    exteriorSecurityCameras: "NO", exteriorSecurityCamerasDisclosureEn: null, exteriorSecurityCamerasDisclosureEs: null,
    animalsOnProperty: "NO", animalsOnPropertyDisclosureEn: null, animalsOnPropertyDisclosureEs: null,
    stepFreeEntrance: "NO", entranceStepCount: 8, elevatorAvailable: "UNKNOWN", accessibleParking: "UNKNOWN",
    stepFreeBedroomAccess: "UNKNOWN", stepFreeBathroomAccess: "UNKNOWN", stepFreeShower: "UNKNOWN",
    sleepingAreas: [
      { kind:"BEDROOM", nameEn:"Bedroom 1", nameEs:"Dormitorio 1", sortOrder:0, beds:[{type:"QUEEN",quantity:1}] },
      { kind:"BEDROOM", nameEn:"Bedroom 2", nameEs:"Dormitorio 2", sortOrder:1, beds:[{type:"SINGLE",quantity:2}] },
    ],
    sharedSpaces: [], safetyConsiderations: [], additionalConsiderations: [],
  };
}

test("enterprise summary derives factual accommodation counts", () => {
  const d=fixture();
  assert.equal(totalPublicBeds(d),3);
  assert.equal(publicBathrooms(d),1.5);
  assert.deepEqual(listingFactLabels(d,4,"es"),[
    "Alojamiento completo","Hasta 4 huéspedes","2 dormitorios","3 camas","1.5 baños"
  ]);
});

test("21+ rule is shown as primary booking guest requirement, not Adults Only", () => {
  const facts=beforeBookingFacts(fixture(),"es");
  assert.ok(facts.includes("El huésped principal debe tener 21 años o más"));
  assert.ok(!facts.includes("Solo adultos"));
});

test("UNKNOWN policies are omitted instead of being presented as No", () => {
  const facts=beforeBookingFacts(fixture(),"en");
  assert.ok(!facts.some(x=>x.toLowerCase().includes("infant")));
  assert.ok(!facts.some(x=>x.toLowerCase().includes("unregistered visitor")));
});

test("confirmed practical facts are visible before booking", () => {
  const facts=beforeBookingFacts(fixture(),"es");
  assert.ok(facts.includes("Estacionamiento disponible"));
  assert.ok(facts.includes("8 escalones en la entrada"));
  assert.ok(facts.includes("Horario de silencio: 22:00–08:00"));
});
