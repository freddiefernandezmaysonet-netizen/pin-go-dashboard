export type TriState = "YES" | "NO" | "UNKNOWN";
export type PermissionState = "ALLOWED" | "NOT_ALLOWED" | "UNKNOWN";
export type SleepingAreaKind = "BEDROOM" | "SLEEPING_AREA";
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

export type ListingDetailsForm = {
  accommodationType: "" | "ENTIRE_PLACE" | "PRIVATE_ROOM" | "SHARED_ROOM";
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
};

export const EMPTY_LISTING_DETAILS: ListingDetailsForm = {
  accommodationType: "",
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
};
