import { EMPTY_LISTING_DETAILS, type ListingDetailsForm } from "./propertyListingDetails.types";

const truth = ["YES", "NO", "UNKNOWN"] as const;
const permission = ["ALLOWED", "NOT_ALLOWED", "UNKNOWN"] as const;
const choices = {
  accommodationType: ["ENTIRE_PLACE", "PRIVATE_ROOM", "SHARED_ROOM"],
  childrenPolicy: permission, infantsPolicy: permission, adultsOnly: truth,
  petsPolicy: permission, smokingPolicy: permission, vapingPolicy: permission,
  eventsPolicy: permission, unregisteredVisitorsPolicy: permission,
  quietHoursEnabled: truth, parkingAvailability: truth,
  parkingType: ["PRIVATE", "GARAGE", "DRIVEWAY", "STREET", "LOT", "OTHER"],
  parkingFeeType: ["FREE", "PAID", "UNKNOWN"],
  smokeDetector: truth, carbonMonoxideDetector: truth, exteriorSecurityCameras: truth,
  animalsOnProperty: truth, stepFreeEntrance: truth, elevatorAvailable: truth,
  accessibleParking: truth, stepFreeBedroomAccess: truth,
  stepFreeBathroomAccess: truth, stepFreeShower: truth,
} as const;
const nullableChoices = new Set(["accommodationType", "parkingType", "parkingFeeType"]);
const numbers = {
  bedroomCount: [0, 100], fullBathroomCount: [0, 100], halfBathroomCount: [0, 100],
  minimumPrimaryBookingGuestAge: [18, 99], parkingVehicleCapacity: [0, 100],
  entranceStepCount: [0, 1000],
} as const;
const texts = {
  quietHoursStart: 5, quietHoursEnd: 5,
  exteriorSecurityCamerasDisclosureEn: 2000, exteriorSecurityCamerasDisclosureEs: 2000,
  animalsOnPropertyDisclosureEn: 2000, animalsOnPropertyDisclosureEs: 2000,
} as const;
const bedTypes = ["KING", "QUEEN", "DOUBLE", "SINGLE", "BUNK", "SOFA_BED", "FUTON", "CRIB", "OTHER"];
const spaceTypes = ["POOL", "HOT_TUB", "KITCHEN", "PATIO", "YARD", "LIVING_ROOM", "LAUNDRY", "OTHER"];
const safetyTypes = ["POOL", "HOT_TUB", "WATERFRONT", "HEIGHTS", "STAIRS", "OTHER"];

function fail(field: string): never {
  throw new Error(`Invalid listing details: ${field}. Reload or correct this value before saving.`);
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(field);
  return value as Record<string, unknown>;
}
function choice(value: unknown, allowed: readonly string[], field: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) fail(field);
  return value;
}
function text(value: unknown, field: string, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) fail(field);
  return value;
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(field);
  return value;
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(field);
  return value;
}
function collection(value: unknown, field: string, max = 100): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > max) fail(field);
  return value.map((item, index) => record(item, `${field}[${index}]`));
}

// Explicit projections exclude database IDs, relation IDs, timestamps and response metadata.
// A missing/malformed collection is an error, never an instruction to erase it.
function projectCollections(source: Record<string, unknown>) {
  return {
    sleepingAreas: collection(source.sleepingAreas, "sleepingAreas").map((area) => ({
      kind: choice(area.kind, ["BEDROOM", "SLEEPING_AREA"], "area.kind"),
      nameEn: text(area.nameEn, "area.nameEn", 200),
      nameEs: text(area.nameEs, "area.nameEs", 200),
      sortOrder: integer(area.sortOrder, "area.sortOrder", 0, 1000),
      beds: collection(area.beds, "area.beds", 20).map((bed) => ({
        type: choice(bed.type, bedTypes, "bed.type"),
        quantity: integer(bed.quantity, "bed.quantity", 1, 20),
      })),
    })),
    sharedSpaces: collection(source.sharedSpaces, "sharedSpaces").map((space) => ({
      type: choice(space.type, spaceTypes, "space.type"),
      labelEn: text(space.labelEn, "space.labelEn", 200),
      labelEs: text(space.labelEs, "space.labelEs", 200),
      sortOrder: integer(space.sortOrder, "space.sortOrder", 0, 1000),
    })),
    safetyConsiderations: collection(source.safetyConsiderations, "safetyConsiderations").map((item) => ({
      type: choice(item.type, safetyTypes, "safety.type"),
      descriptionEn: text(item.descriptionEn, "safety.descriptionEn", 2000),
      descriptionEs: text(item.descriptionEs, "safety.descriptionEs", 2000),
      isActive: boolean(item.isActive, "safety.isActive"),
      sortOrder: integer(item.sortOrder, "safety.sortOrder", 0, 1000),
    })),
    additionalConsiderations: collection(source.additionalConsiderations, "additionalConsiderations").map((item) => ({
      titleEn: text(item.titleEn, "consideration.titleEn", 200),
      titleEs: text(item.titleEs, "consideration.titleEs", 200),
      descriptionEn: text(item.descriptionEn, "consideration.descriptionEn", 2000),
      descriptionEs: text(item.descriptionEs, "consideration.descriptionEs", 2000),
      isActive: boolean(item.isActive, "consideration.isActive"),
      sortOrder: integer(item.sortOrder, "consideration.sortOrder", 0, 1000),
    })),
  };
}

export function emptyListingDetails(): ListingDetailsForm {
  return structuredClone(EMPTY_LISTING_DETAILS);
}

export function hydrateListingDetails(value: unknown): ListingDetailsForm {
  if (value === null) return emptyListingDetails();
  const source = record(value, "response");
  const result: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(choices)) {
    result[key] = source[key] === null && nullableChoices.has(key)
      ? "" : choice(source[key], allowed, key);
  }
  for (const [key, [min, max]] of Object.entries(numbers)) {
    result[key] = source[key] === null ? "" : String(integer(source[key], key, min, max));
  }
  for (const [key, max] of Object.entries(texts)) result[key] = text(source[key], key, max) ?? "";
  const lists = projectCollections(source);
  return {
    ...result,
    ...lists,
    sleepingAreas: lists.sleepingAreas.map((area) => ({ ...area, nameEn: area.nameEn ?? "", nameEs: area.nameEs ?? "" })),
  } as ListingDetailsForm;
}

export function buildListingDetailsPayload(form: ListingDetailsForm): Record<string, unknown> {
  const source = record(form, "form");
  const result: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(choices)) {
    result[key] = source[key] === "" && nullableChoices.has(key)
      ? null : choice(source[key], allowed, key);
  }
  for (const [key, [min, max]] of Object.entries(numbers)) {
    const value = source[key];
    if (typeof value !== "string") fail(key);
    // Reject invalid input before JSON serialization can silently turn NaN into null.
    result[key] = value.trim() === "" ? null : integer(Number(value), key, min, max);
  }
  for (const [key, max] of Object.entries(texts)) result[key] = text(source[key], key, max)?.trim() || null;
  Object.assign(result, projectCollections(source));

  if (result.adultsOnly === "YES" && (result.childrenPolicy === "ALLOWED" || result.infantsPolicy === "ALLOWED")) {
    throw new Error("Adults Only cannot allow children or infants.");
  }
  if (result.quietHoursEnabled === "YES") {
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(String(result.quietHoursStart ?? "")) || !time.test(String(result.quietHoursEnd ?? ""))) {
      throw new Error("Quiet hours require valid start and end times (HH:MM).");
    }
  }
  if (result.parkingAvailability !== "YES" && (result.parkingType !== null || result.parkingFeeType !== null || result.parkingVehicleCapacity !== null)) {
    throw new Error("Parking details require confirmed parking availability.");
  }
  if (result.exteriorSecurityCameras === "YES" && !result.exteriorSecurityCamerasDisclosureEn && !result.exteriorSecurityCamerasDisclosureEs) {
    throw new Error("Describe the exterior cameras in at least one language.");
  }
  if (result.animalsOnProperty === "YES" && !result.animalsOnPropertyDisclosureEn && !result.animalsOnPropertyDisclosureEs) {
    throw new Error("Describe animals on the property in at least one language.");
  }
  if (result.stepFreeEntrance === "YES" && Number(result.entranceStepCount) > 0) {
    throw new Error("A step-free entrance cannot have a positive entrance step count.");
  }
  if (form.bedroomCount !== "" && form.sleepingAreas.length > 0 && Number(form.bedroomCount) !== form.sleepingAreas.filter((area) => area.kind === "BEDROOM").length) {
    throw new Error("Bedroom count must match the bedroom areas in the room layout.");
  }
  return result;
}

export type ListingDetailsResponse = { form: ListingDetailsForm; version: number | null };
export function parseListingDetailsResponse(body: unknown, propertyId: string, saved = false): ListingDetailsResponse {
  const source = record(body, "response");
  if (source.ok !== true || !("listingDetails" in source)) fail("response envelope");
  if (source.listingDetails === null) {
    if (saved) fail("saved listing details");
    return { form: emptyListingDetails(), version: null };
  }
  const details = record(source.listingDetails, "listingDetails");
  if (details.propertyId !== propertyId) fail("response propertyId");
  const version = integer(details.version, "version", 1, Number.MAX_SAFE_INTEGER);
  return { form: hydrateListingDetails(details), version };
}

// The component uses this boundary for both the initial load and every write.
// Requests are injected for tests; no test needs a host session or production API.
export async function requestListingDetails(
  fetcher: typeof fetch,
  url: string,
  propertyId: string,
  signal: AbortSignal,
  payload?: Record<string, unknown>,
): Promise<ListingDetailsResponse> {
  const response = await fetcher(url, {
    method: payload === undefined ? "GET" : "PUT",
    credentials: "include",
    signal,
    ...(payload === undefined ? {} : {
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
  });
  signal.throwIfAborted();
  if (!response.ok) throw new Error(`Unable to ${payload === undefined ? "load" : "save"} listing details (HTTP ${response.status}).`);
  const body: unknown = await response.json();
  signal.throwIfAborted();
  return parseListingDetailsResponse(body, propertyId, payload !== undefined);
}
