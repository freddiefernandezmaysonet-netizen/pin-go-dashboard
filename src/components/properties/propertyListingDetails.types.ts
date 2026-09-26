export type TriState = "YES" | "NO" | "UNKNOWN";
export type PermissionState = "ALLOWED" | "NOT_ALLOWED" | "UNKNOWN";
export type SleepingAreaKind = "BEDROOM" | "SLEEPING_AREA";
export type PropertyType = "HOUSE" | "APARTMENT" | "CONDO" | "CABIN" | "COTTAGE" | "VILLA" | "TOWNHOUSE" | "BUNGALOW" | "LOFT" | "STUDIO" | "GUESTHOUSE" | "FARM_STAY" | "OTHER";
export type ListingFeatureType = "WOOD_CONSTRUCTION" | "OCEAN_VIEW" | "MOUNTAIN_VIEW" | "WATERFRONT" | "BEACH_ACCESS" | "POOL_TABLE" | "GYM" | "FIREPLACE" | "OUTDOOR_GRILL" | "WORKSPACE" | "OTHER";
export type ListingFeature = { type: ListingFeatureType; labelEn: string | null; labelEs: string | null; isActive: boolean; sortOrder: number };
export type ExperienceTag = { label: string; isActive: boolean; sortOrder: number };

export type BedType =
  | "KING" | "QUEEN" | "DOUBLE" | "SINGLE" | "BUNK"
  | "SOFA_BED" | "FUTON" | "CRIB" | "OTHER";

export type SleepingArea = {
  kind: SleepingAreaKind;
  nameEn: string;
  nameEs: string;
  sortOrder: number;
  beds: Array<{ type: BedType; quantity: number }>;
};

export type SharedSpace = {
  type: "POOL" | "HOT_TUB" | "KITCHEN" | "PATIO" | "YARD" | "LIVING_ROOM" | "LAUNDRY" | "OTHER";
  labelEn: string | null;
  labelEs: string | null;
  sortOrder: number;
};

export type SafetyConsideration = {
  type: "POOL" | "HOT_TUB" | "WATERFRONT" | "HEIGHTS" | "STAIRS" | "OTHER";
  descriptionEn: string | null;
  descriptionEs: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdditionalConsideration = {
  titleEn: string | null;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type ListingDetailsForm = {
  accommodationType: "" | "ENTIRE_PLACE" | "PRIVATE_ROOM" | "SHARED_ROOM";
  propertyType: "" | PropertyType;
  bedroomCount: string;
  fullBathroomCount: string;
  halfBathroomCount: string;
  minimumPrimaryBookingGuestAge: string;
  childrenPolicy: PermissionState;
  infantsPolicy: PermissionState;
  adultsOnly: TriState;
  petsPolicy: PermissionState;
  smokingPolicy: PermissionState;
  vapingPolicy: PermissionState;
  eventsPolicy: PermissionState;
  unregisteredVisitorsPolicy: PermissionState;
  quietHoursEnabled: TriState;
  quietHoursStart: string;
  quietHoursEnd: string;
  parkingAvailability: TriState;
  parkingType: "" | "PRIVATE" | "GARAGE" | "DRIVEWAY" | "STREET" | "LOT" | "OTHER";
  parkingFeeType: "" | "FREE" | "PAID" | "UNKNOWN";
  parkingVehicleCapacity: string;
  smokeDetector: TriState;
  carbonMonoxideDetector: TriState;
  exteriorSecurityCameras: TriState;
  exteriorSecurityCamerasDisclosureEn: string;
  exteriorSecurityCamerasDisclosureEs: string;
  animalsOnProperty: TriState;
  animalsOnPropertyDisclosureEn: string;
  animalsOnPropertyDisclosureEs: string;
  stepFreeEntrance: TriState;
  entranceStepCount: string;
  elevatorAvailable: TriState;
  accessibleParking: TriState;
  stepFreeBedroomAccess: TriState;
  stepFreeBathroomAccess: TriState;
  stepFreeShower: TriState;
  sleepingAreas: SleepingArea[];
  // PUT replaces these collections. Preserve them even before their editors exist.
  sharedSpaces: SharedSpace[];
  features: ListingFeature[];
  experienceTags: ExperienceTag[];
  safetyConsiderations: SafetyConsideration[];
  additionalConsiderations: AdditionalConsideration[];
};

export const EMPTY_LISTING_DETAILS: ListingDetailsForm = {
  accommodationType: "",
  propertyType: "",
  bedroomCount: "",
  fullBathroomCount: "",
  halfBathroomCount: "",
  minimumPrimaryBookingGuestAge: "",
  childrenPolicy: "UNKNOWN",
  infantsPolicy: "UNKNOWN",
  adultsOnly: "UNKNOWN",
  petsPolicy: "UNKNOWN",
  smokingPolicy: "UNKNOWN",
  vapingPolicy: "UNKNOWN",
  eventsPolicy: "UNKNOWN",
  unregisteredVisitorsPolicy: "UNKNOWN",
  quietHoursEnabled: "UNKNOWN",
  quietHoursStart: "",
  quietHoursEnd: "",
  parkingAvailability: "UNKNOWN",
  parkingType: "",
  parkingFeeType: "",
  parkingVehicleCapacity: "",
  smokeDetector: "UNKNOWN",
  carbonMonoxideDetector: "UNKNOWN",
  exteriorSecurityCameras: "UNKNOWN",
  exteriorSecurityCamerasDisclosureEn: "",
  exteriorSecurityCamerasDisclosureEs: "",
  animalsOnProperty: "UNKNOWN",
  animalsOnPropertyDisclosureEn: "",
  animalsOnPropertyDisclosureEs: "",
  stepFreeEntrance: "UNKNOWN",
  entranceStepCount: "",
  elevatorAvailable: "UNKNOWN",
  accessibleParking: "UNKNOWN",
  stepFreeBedroomAccess: "UNKNOWN",
  stepFreeBathroomAccess: "UNKNOWN",
  stepFreeShower: "UNKNOWN",
  sleepingAreas: [],
  sharedSpaces: [],
  features: [],
  experienceTags: [],
  safetyConsiderations: [],
  additionalConsiderations: [],
};
