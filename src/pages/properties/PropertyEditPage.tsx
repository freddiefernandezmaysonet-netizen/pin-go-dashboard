import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { useNavigate, useParams } from "react-router-dom";
import { CancellationPolicyCard } from "../../components/properties/CancellationPolicyCard";
import { GuestAccessSettingsCard } from "../../components/properties/GuestAccessSettingsCard";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const GOOGLE_MAPS_SCRIPT_ID = "pin-go-google-maps";

type GoogleMapsWindow = Window & { google?: any };

type GooglePlacesLoaderResult = {
  google: any;
  PlaceAutocompleteElement: any;
};

let googleMapsLoader: Promise<GooglePlacesLoaderResult> | null = null;

async function importGoogleMapsLibraries(google: any) {
  const [placesLibrary] = await Promise.all([
    google.maps.importLibrary("places"),
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("marker"),
  ]);

  return {
    google,
    PlaceAutocompleteElement: placesLibrary.PlaceAutocompleteElement,
  };
}

function loadGooglePlaces(apiKey: string) {
  const mapsWindow = window as GoogleMapsWindow;

  if (mapsWindow.google?.maps) {
    return importGoogleMapsLibraries(mapsWindow.google);
  }

  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const existingScript =
      document.getElementById(GOOGLE_MAPS_SCRIPT_ID) ??
      document.querySelector<HTMLScriptElement>(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );

    const handleLoad = async () => {
      try {
        if (!mapsWindow.google?.maps) {
          throw new Error("Google Maps did not initialize");
        }
        resolve(await importGoogleMapsLibraries(mapsWindow.google));
      } catch (error) {
        googleMapsLoader = null;
        reject(error);
      }
    };

    const handleError = () => {
      googleMapsLoader = null;
      reject(new Error("Google Maps failed to load"));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async`;
    script.async = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value?: string | null) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

type AmenityChargeMode = "INCLUDED" | "REQUIRED" | "OPTIONAL";
type AmenityFeeType = "PER_STAY" | "PER_NIGHT";

type PropertyAmenityItem = {
  id: string;
  name: string;
  description?: string | null;
  chargeMode: AmenityChargeMode;
  feeType: AmenityFeeType;
  amount: string | number;
  isActive: boolean;
};

type NearbyPlaceCategory =
  | "BEACH"
  | "RESTAURANT"
  | "ATTRACTION"
  | "NATURE"
  | "SHOPPING"
  | "NIGHTLIFE"
  | "CULTURE"
  | "OTHER";

type PropertyNearbyPlaceItem = {
  id: string;
  name: string;
  nameEs?: string | null;
  category: NearbyPlaceCategory;
  description?: string | null;
  descriptionEs?: string | null;
  distanceText?: string | null;
  travelTimeMinutes?: number | null;
  googleMapsUrl?: string | null;
  photoUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type PropertyTaxItem = {
  id: string;
  name: string;
  percentage: string | number;
  isActive: boolean;
};

type PropertyBlockedDateItem = {
  id: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
};

type PropertySeasonType = "PEAK" | "SHOULDER" | "LOW";

type PropertySeasonItem = {
  id: string;
  name: string;
  type: PropertySeasonType;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  adjustmentPercent: number;
  isActive: boolean;
  source: string;
};

type PropertyHolidayPricingItem = {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  adjustmentPercent: number;
  isActive: boolean;
  source: string;
};

type MarketPricingStrategy = "OCCUPANCY" | "BALANCED" | "REVENUE";
type MarketPricingPosition = "VALUE" | "COMPETITIVE" | "PREMIUM";
type MarketPricingAggressiveness =
  | "CONSERVATIVE"
  | "MODERATE"
  | "AGGRESSIVE";

type MarketPricingFormState = {
  configured: boolean;
  providerAssigned: boolean;
  enabled: boolean;
  currency: string;
  strategy: MarketPricingStrategy;
  position: MarketPricingPosition;
  aggressiveness: MarketPricingAggressiveness;
  minimumConfidence: string;
  maximumIncreasePercent: string;
  maximumDecreasePercent: string;
  marketRadiusKm: string;
  maximumComparables: string;
  lastSuccessfulRefreshAt: string | null;
  nextRefreshAt: string | null;
  lastErrorCode: string | null;
};

const DEFAULT_MARKET_PRICING_FORM: MarketPricingFormState = {
  configured: false,
  providerAssigned: false,
  enabled: false,
  currency: "",
  strategy: "BALANCED",
  position: "COMPETITIVE",
  aggressiveness: "MODERATE",
  minimumConfidence: "70",
  maximumIncreasePercent: "20",
  maximumDecreasePercent: "15",
  marketRadiusKm: "",
  maximumComparables: "10",
  lastSuccessfulRefreshAt: null,
  nextRefreshAt: null,
  lastErrorCode: null,
};

type PropertyItem = {
  id: string;
  name: string;
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone?: string | null;
  status: string;
  cleaningDurationMinutes: number;
  cleaningStartOffsetMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
  isPublicBookable?: boolean;
  distributionEnabled?: boolean;
  distributionStatus?: string | null;
  distributionEnabledAt?: string | null;
  distributionLastSyncedAt?: string | null;
  distributionLastError?: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicDescriptionEs?: string | null;
  publicPhotos?: string[] | null;
  organization?: {
  slug?: string | null;
  } | null;
  amenities?: PropertyAmenityItem[];
  taxes?: PropertyTaxItem[];
  baseNightlyRate?: number | null;
  minimumNightlyRate?: number | null;
  maximumNightlyRate?: number | null;
  dynamicPricingEnabled?: boolean | null;
  seasonalPricingEnabled?: boolean | null;
  holidayPricingEnabled?: boolean | null;
  weekendMarkupPercent?: number | null;

  leadTimePricingEnabled?: boolean | null;
  leadTimeLastMinuteDays?: number | null;
  leadTimeLastMinutePercent?: number | null;

  occupancyPricingEnabled?: boolean | null;
  occupancyLookaheadDays?: number | null;
  occupancyLowThresholdPercent?: number | null;
  occupancyLowAdjustmentPercent?: number | null;
  occupancyHighThresholdPercent?: number | null;
  occupancyHighAdjustmentPercent?: number | null;
  cleaningFee?: number | null;
  propertyProtectionEnabled?: boolean;
  propertyProtectionMode?: "CARD_ON_FILE";
  maxDamageLiabilityAmount?: number | null;
  maxGuests?: number | null;
  minimumNights?: number | null;
  maximumNights?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

export function PropertyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const autocompleteMountRef = useRef<HTMLDivElement>(null);
  const mapMountRef = useRef<HTMLDivElement>(null);
  const googleMapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);
  const timezoneLookupIdRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingNearbyPlacePhoto, setUploadingNearbyPlacePhoto] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [placesAvailable, setPlacesAvailable] = useState(Boolean(GOOGLE_MAPS_API_KEY));
  const [locationMessage, setLocationMessage] = useState(
    GOOGLE_MAPS_API_KEY ? "" : "Google Places is unavailable. Enter the address manually."
  );
  const [locationDirty, setLocationDirty] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [timezoneLookupMessage, setTimezoneLookupMessage] = useState("");

  const [amenities, setAmenities] = useState<PropertyAmenityItem[]>([]);
  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
  const [editingAmenity, setEditingAmenity] =
    useState<PropertyAmenityItem | null>(null);

  const [newAmenity, setNewAmenity] = useState({
    name: "",
    description: "",
    chargeMode: "INCLUDED" as AmenityChargeMode,
    feeType: "PER_STAY" as AmenityFeeType,
    amount: "",
  });

  const [nearbyPlaces, setNearbyPlaces] = useState<PropertyNearbyPlaceItem[]>([]);
  const [editingNearbyPlaceId, setEditingNearbyPlaceId] = useState<string | null>(null);
  const [editingNearbyPlace, setEditingNearbyPlace] = useState<PropertyNearbyPlaceItem | null>(null);
  const [newNearbyPlace, setNewNearbyPlace] = useState({
    name: "",
    nameEs: "",
    category: "OTHER" as NearbyPlaceCategory,
    description: "",
    descriptionEs: "",
    distanceText: "",
    travelTimeMinutes: "",
    googleMapsUrl: "",
    photoUrl: "",
    isActive: true,
  });

  const [taxes, setTaxes] = useState<PropertyTaxItem[]>([]);
  const [seasons, setSeasons] = useState<PropertySeasonItem[]>([]);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingSeason, setEditingSeason] = useState<PropertySeasonItem | null>(null);
  const [savingSeason, setSavingSeason] = useState(false);
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null);
  const [editingRecommendedSeasonId, setEditingRecommendedSeasonId] =
    useState<string | null>(null);
  const [recommendedSeasonAdjustmentInput, setRecommendedSeasonAdjustmentInput] =
    useState("");
  const [savingRecommendedSeasonId, setSavingRecommendedSeasonId] =
    useState<string | null>(null);
  const [holidayPricing, setHolidayPricing] = useState<PropertyHolidayPricingItem[]>([]);
  const [editingHolidayPricingId, setEditingHolidayPricingId] =
    useState<string | null>(null);
  const [holidayPricingAdjustmentInput, setHolidayPricingAdjustmentInput] =
    useState("");
  const [savingHolidayPricingId, setSavingHolidayPricingId] =
    useState<string | null>(null);
  const [marketPricing, setMarketPricing] = useState<MarketPricingFormState>(
    DEFAULT_MARKET_PRICING_FORM
  );
  const [marketPricingLoading, setMarketPricingLoading] = useState(false);
  const [marketPricingSaving, setMarketPricingSaving] = useState(false);
  const [marketPricingAdvancedOpen, setMarketPricingAdvancedOpen] =
    useState(false);
  const [marketPricingMessage, setMarketPricingMessage] = useState("");
  const [newSeason, setNewSeason] = useState({
  name: "",
  type: "SHOULDER" as PropertySeasonType,
  startMonth: "",
  startDay: "",
  endMonth: "",
  endDay: "",
  adjustmentPercent: "",
});
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editingTax, setEditingTax] = useState<PropertyTaxItem | null>(null);

  const [newTax, setNewTax] = useState({
    name: "",
    percentage: "",
  });

 const [form, setForm] = useState({
    name: "",
    address1: "",
    city: "",
    region: "",
    country: "",
    postalCode: "",
    timezone: "",
    cleaningDurationMinutes: 180,
    cleaningStartOffsetMinutes: 30,
    latitude: "",
    longitude: "",
    slug: "",
    baseNightlyRate: "",
    minimumNightlyRate: "",
    maximumNightlyRate: "",
    dynamicPricingEnabled: false,
    seasonalPricingEnabled: false,
    holidayPricingEnabled: false,
    weekendMarkupPercent: "",

    leadTimePricingEnabled: false,
    leadTimeLastMinuteDays: "3",
    leadTimeLastMinutePercent: "",

    occupancyPricingEnabled: false,
    occupancyLookaheadDays: "30",
    occupancyLowThresholdPercent: "",
    occupancyLowAdjustmentPercent: "",
    occupancyHighThresholdPercent: "",
    occupancyHighAdjustmentPercent: "",
    cleaningFee: "",
    propertyProtectionEnabled: false,
    propertyProtectionMode: "CARD_ON_FILE" as const,
    maxDamageLiabilityAmount: "",
    maxGuests: "",
    minimumNights: "1",
    maximumNights: "",
    isPublicBookable: false,
    distributionEnabled: false,
    distributionStatus: "DISABLED",
    distributionEnabledAt: "",
    distributionLastSyncedAt: "",
    distributionLastError: "",
    publicTitle: "",
    publicDescription: "",
    publicDescriptionEs: "",
    publicPhotosText: "",
 });

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || loading) return;

    let cancelled = false;
    let autocompleteElement: HTMLElement | null = null;
    let selectHandler: ((event: Event) => void) | null = null;

    loadGooglePlaces(GOOGLE_MAPS_API_KEY)
      .then(({ google, PlaceAutocompleteElement }) => {
        if (cancelled || !autocompleteMountRef.current) return;
        if (typeof PlaceAutocompleteElement !== "function") {
          throw new Error("Google Places autocomplete is unavailable");
        }

        googleMapsRef.current = google;
        const nextAutocompleteElement = new PlaceAutocompleteElement() as HTMLElement;
        autocompleteElement = nextAutocompleteElement;
        (nextAutocompleteElement as any).placeholder = "Search for a new property address";
        nextAutocompleteElement.style.width = "100%";

        selectHandler = async (event: Event) => {
          try {
            const placePrediction = (event as any).placePrediction;
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ["formattedAddress", "addressComponents", "location"],
            });
            if (cancelled) return;

            const components = place.addressComponents ?? [];
            const componentValue = (type: string) =>
              components.find((component: any) => component.types?.includes(type))
                ?.longText ?? "";
            const nextCity =
              componentValue("locality") ||
              componentValue("postal_town") ||
              componentValue("administrative_area_level_2");
            const nextRegion = componentValue("administrative_area_level_1");
            const nextCountry = componentValue("country");
            const nextPostalCode = componentValue("postal_code");

            if (!place.formattedAddress || !place.location) {
              throw new Error("Google Places did not return a complete location");
            }

            const nextLatitude = place.location.lat();
            const nextLongitude = place.location.lng();

            setForm((s) => ({
              ...s,
              address1: place.formattedAddress,
              city: nextCity,
              region: nextCountry === "Puerto Rico" ? "Puerto Rico" : nextRegion,
              country: nextCountry,
              postalCode: nextPostalCode,
              latitude: String(nextLatitude),
              longitude: String(nextLongitude),
            }));
            setLocationDirty(true);
            setLocationConfirmed(false);

            const lookupId = ++timezoneLookupIdRef.current;
            setTimezoneLookupMessage("Detecting timezone...");
            try {
              const params = new URLSearchParams({
                lat: String(nextLatitude),
                lng: String(nextLongitude),
              });
              const response = await fetch(
                `${API_BASE}/api/dashboard/location/timezone?${params.toString()}`,
                { credentials: "include" }
              );
              const result = await response.json();
              const resolvedTimezone =
                typeof result?.timezone === "string" && result.timezone.trim()
                  ? result.timezone
                  : null;

              if (
                !cancelled &&
                lookupId === timezoneLookupIdRef.current &&
                response.ok &&
                result?.ok === true &&
                resolvedTimezone
              ) {
                setForm((s) => ({ ...s, timezone: resolvedTimezone }));
                setTimezoneLookupMessage("");
              } else if (!cancelled && lookupId === timezoneLookupIdRef.current) {
                setTimezoneLookupMessage(
                  "Timezone could not be detected automatically. Please confirm it manually."
                );
              }
            } catch {
              if (!cancelled && lookupId === timezoneLookupIdRef.current) {
                setTimezoneLookupMessage(
                  "Timezone could not be detected automatically. Please confirm it manually."
                );
              }
            }
          } catch {
            setLocationMessage(
              "Google Places could not load this location. The existing property location was not changed."
            );
          }
        };

        nextAutocompleteElement.addEventListener("gmp-select", selectHandler);
        autocompleteMountRef.current.replaceChildren(nextAutocompleteElement);
      })
      .catch(() => {
        if (!cancelled) {
          setPlacesAvailable(false);
          setLocationMessage(
            "Google Places is unavailable. The existing property location can still be saved unchanged."
          );
        }
      });

    return () => {
      cancelled = true;
      if (autocompleteElement && selectHandler) {
        autocompleteElement.removeEventListener("gmp-select", selectHandler);
      }
      autocompleteElement?.remove();
    };
  }, [loading]);

  useEffect(() => {
    if (!locationDirty) return;
    const google = googleMapsRef.current;
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);

    if (
      !google?.maps ||
      !GOOGLE_MAPS_MAP_ID ||
      !mapMountRef.current ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      form.latitude.trim() === "" ||
      form.longitude.trim() === ""
    ) {
      return;
    }

    const position = { lat, lng };
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapMountRef.current, {
        center: position,
        zoom: 18,
        mapId: GOOGLE_MAPS_MAP_ID,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      mapMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        title: form.address1 || "Property location",
      });
      return;
    }

    mapRef.current.setCenter(position);
    mapRef.current.setZoom(18);
    if (mapMarkerRef.current) {
      mapMarkerRef.current.position = position;
      mapMarkerRef.current.title = form.address1 || "Property location";
    }
  }, [form.address1, form.latitude, form.longitude, locationDirty]);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    fetch(`${API_BASE}/api/dashboard/properties/${id}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${t || res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        const p: PropertyItem = data.item;

        setOrganizationSlug(p.organization?.slug ?? "");
        setAmenities((p.amenities ?? []).filter((a) => a.isActive !== false));
        setTaxes((p.taxes ?? []).filter((t) => t.isActive !== false));

        fetch(`${API_BASE}/api/properties/${id}/nearby-places`, {
          credentials: "include",
        })
          .then((r) => r.json())
          .then((nearbyData) => {
            setNearbyPlaces(Array.isArray(nearbyData.items) ? nearbyData.items : []);
          })
          .catch(() => {
            setNearbyPlaces([]);
          });

        fetch(`${API_BASE}/api/dashboard/properties/${id}/seasons`, {
  credentials: "include",
})
  .then((r) => r.json())
  .then((seasonData) => {
    setSeasons(Array.isArray(seasonData.items) ? seasonData.items : []);
  })
  .catch(() => {
    setSeasons([]);
  });

fetch(`${API_BASE}/api/dashboard/properties/${id}/holiday-pricing`, {
  credentials: "include",
})
  .then((r) => r.json())
  .then((holidayData) => {
    setHolidayPricing(
      Array.isArray(holidayData.items) ? holidayData.items : []
    );
  })
  .catch(() => {
    setHolidayPricing([]);
  });

        setMarketPricingLoading(true);
        fetch(`${API_BASE}/api/dashboard/properties/${id}/market-pricing`, {
          credentials: "include",
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(
                data?.error || "Market Competition configuration is unavailable"
              );
            }
            return data?.marketPricing;
          })
          .then((profile) => {
            if (!profile?.configured) {
              setMarketPricing(DEFAULT_MARKET_PRICING_FORM);
              return;
            }

            setMarketPricing({
              configured: true,
              providerAssigned: Boolean(profile.providerAssigned),
              enabled: Boolean(profile.enabled),
              currency: String(profile.currency ?? ""),
              strategy: (profile.strategy ?? "BALANCED") as MarketPricingStrategy,
              position: (profile.position ?? "COMPETITIVE") as MarketPricingPosition,
              aggressiveness: (profile.aggressiveness ??
                "MODERATE") as MarketPricingAggressiveness,
              minimumConfidence: String(profile.minimumConfidence ?? 70),
              maximumIncreasePercent: String(
                profile.maximumIncreasePercent ?? 20
              ),
              maximumDecreasePercent: String(
                profile.maximumDecreasePercent ?? 15
              ),
              marketRadiusKm:
                profile.marketRadiusKm === null ||
                profile.marketRadiusKm === undefined
                  ? ""
                  : String(profile.marketRadiusKm),
              maximumComparables: String(profile.maximumComparables ?? 10),
              lastSuccessfulRefreshAt: profile.lastSuccessfulRefreshAt ?? null,
              nextRefreshAt: profile.nextRefreshAt ?? null,
              lastErrorCode: profile.lastErrorCode ?? null,
            });
            setMarketPricingMessage("");
          })
          .catch((error: any) => {
            setMarketPricing(DEFAULT_MARKET_PRICING_FORM);
            setMarketPricingMessage(
              String(
                error?.message ??
                  "Market Competition configuration is unavailable"
              )
            );
          })
          .finally(() => setMarketPricingLoading(false));

        setForm({
          name: p.name ?? "",
          address1: p.address1 ?? "",
          city: p.city ?? "",
          region: p.region ?? "",
          country: p.country ?? "",
          postalCode: p.postalCode ?? "",
          timezone: p.timezone ?? "",
          cleaningDurationMinutes: p.cleaningDurationMinutes ?? 180,
          cleaningStartOffsetMinutes: p.cleaningStartOffsetMinutes ?? 30,
          latitude:
            p.latitude !== null && p.latitude !== undefined
              ? String(p.latitude)
              : "",
          longitude:
            p.longitude !== null && p.longitude !== undefined
              ? String(p.longitude)
              : "",
         baseNightlyRate:
  p.baseNightlyRate !== null && p.baseNightlyRate !== undefined
    ? String(p.baseNightlyRate)
    : "",
minimumNightlyRate:
  p.minimumNightlyRate !== null && p.minimumNightlyRate !== undefined
    ? String(p.minimumNightlyRate)
    : "",
maximumNightlyRate:
  p.maximumNightlyRate !== null && p.maximumNightlyRate !== undefined
    ? String(p.maximumNightlyRate)
    : "",
dynamicPricingEnabled: Boolean(p.dynamicPricingEnabled),
seasonalPricingEnabled: Boolean(p.seasonalPricingEnabled),
holidayPricingEnabled: Boolean(p.holidayPricingEnabled),
weekendMarkupPercent:
  p.weekendMarkupPercent !== null &&
  p.weekendMarkupPercent !== undefined
    ? String(p.weekendMarkupPercent)
    : "",

leadTimePricingEnabled:
  Boolean(p.leadTimePricingEnabled),

leadTimeLastMinuteDays:
  p.leadTimeLastMinuteDays !== null &&
  p.leadTimeLastMinuteDays !== undefined
    ? String(p.leadTimeLastMinuteDays)
    : "3",

leadTimeLastMinutePercent:
  p.leadTimeLastMinutePercent !== null &&
  p.leadTimeLastMinutePercent !== undefined
    ? String(p.leadTimeLastMinutePercent)
    : "",

occupancyPricingEnabled:
  Boolean(p.occupancyPricingEnabled),

occupancyLookaheadDays:
  p.occupancyLookaheadDays !== null &&
  p.occupancyLookaheadDays !== undefined
    ? String(p.occupancyLookaheadDays)
    : "30",

occupancyLowThresholdPercent:
  p.occupancyLowThresholdPercent !== null &&
  p.occupancyLowThresholdPercent !== undefined
    ? String(p.occupancyLowThresholdPercent)
    : "",

occupancyLowAdjustmentPercent:
  p.occupancyLowAdjustmentPercent !== null &&
  p.occupancyLowAdjustmentPercent !== undefined
    ? String(p.occupancyLowAdjustmentPercent)
    : "",

occupancyHighThresholdPercent:
  p.occupancyHighThresholdPercent !== null &&
  p.occupancyHighThresholdPercent !== undefined
    ? String(p.occupancyHighThresholdPercent)
    : "",

occupancyHighAdjustmentPercent:
  p.occupancyHighAdjustmentPercent !== null &&
  p.occupancyHighAdjustmentPercent !== undefined
    ? String(p.occupancyHighAdjustmentPercent)
    : "",

cleaningFee:
            p.cleaningFee !== null && p.cleaningFee !== undefined
              ? String(p.cleaningFee)
              : "",
          propertyProtectionEnabled: Boolean(p.propertyProtectionEnabled),
          propertyProtectionMode: "CARD_ON_FILE",
          maxDamageLiabilityAmount:
            p.maxDamageLiabilityAmount !== null && p.maxDamageLiabilityAmount !== undefined
              ? String(p.maxDamageLiabilityAmount)
              : "",
          maxGuests:
            p.maxGuests !== null && p.maxGuests !== undefined
              ? String(p.maxGuests)
              : "",
          minimumNights: String(p.minimumNights ?? 1),
          maximumNights:
            p.maximumNights !== null && p.maximumNights !== undefined
              ? String(p.maximumNights)
              : "",
          slug: p.slug ?? "",
          publicTitle: p.publicTitle ?? "",
          publicDescription: p.publicDescription ?? "",
          publicDescriptionEs: p.publicDescriptionEs ?? "",
          publicPhotosText: Array.isArray(p.publicPhotos)
          ? p.publicPhotos.join("\n")
          : "",
          isPublicBookable: Boolean(p.isPublicBookable),
          distributionEnabled: Boolean(p.distributionEnabled),
          distributionStatus: p.distributionStatus ?? "DISABLED",
          distributionEnabledAt: p.distributionEnabledAt ?? "",
          distributionLastSyncedAt: p.distributionLastSyncedAt ?? "",
          distributionLastError: p.distributionLastError ?? "",
       });
      })
      .catch((e: any) => {
        setErr(String(e?.message ?? e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setErr(null);

    try {
      if (locationDirty && !locationConfirmed) {
        throw new Error("Confirm the new property location on the map before saving");
      }

      const latitude = form.latitude.trim() === "" ? null : Number(form.latitude);
      const longitude =
        form.longitude.trim() === "" ? null : Number(form.longitude);

      if ((latitude === null) !== (longitude === null)) {
        throw new Error("Latitude and longitude must be provided together");
      }

      if (latitude !== null && !Number.isFinite(latitude)) {
        throw new Error("Latitude must be a valid number");
      }

      if (longitude !== null && !Number.isFinite(longitude)) {
        throw new Error("Longitude must be a valid number");
      }

      const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          address1: form.address1,
          city: form.city,
          region: form.region,
          country: form.country,
          postalCode: form.postalCode,
          timezone: form.timezone,
          publicTitle: form.publicTitle,
          publicDescription: form.publicDescription,
          publicDescriptionEs: form.publicDescriptionEs,
          publicPhotos: form.publicPhotosText
             .split("\n")
             .map((url) => url.trim())
             .filter(Boolean),
          cleaningDurationMinutes: Number(form.cleaningDurationMinutes),
          cleaningStartOffsetMinutes: Number(form.cleaningStartOffsetMinutes),
          latitude,
          longitude,
          slug: form.slug,
         baseNightlyRate:
  form.baseNightlyRate.trim() === ""
    ? null
    : Number(form.baseNightlyRate),
minimumNightlyRate:
  form.minimumNightlyRate.trim() === ""
    ? null
    : Number(form.minimumNightlyRate),
maximumNightlyRate:
  form.maximumNightlyRate.trim() === ""
    ? null
    : Number(form.maximumNightlyRate),
dynamicPricingEnabled: form.dynamicPricingEnabled,
seasonalPricingEnabled: form.seasonalPricingEnabled,
holidayPricingEnabled: form.holidayPricingEnabled,
weekendMarkupPercent:
  form.weekendMarkupPercent.trim() === ""
    ? null
    : Number(form.weekendMarkupPercent),

leadTimePricingEnabled:
  form.leadTimePricingEnabled,

leadTimeLastMinuteDays:
  form.leadTimeLastMinuteDays.trim() === ""
    ? 3
    : Number(form.leadTimeLastMinuteDays),
leadTimeLastMinutePercent:
  form.leadTimeLastMinutePercent.trim() === ""
    ? null
    : Number(form.leadTimeLastMinutePercent),

occupancyPricingEnabled:
  form.occupancyPricingEnabled,

occupancyLookaheadDays:
  form.occupancyLookaheadDays.trim() === ""
    ? 30
    : Number(form.occupancyLookaheadDays),

occupancyLowThresholdPercent:
  form.occupancyLowThresholdPercent.trim() === ""
    ? null
    : Number(form.occupancyLowThresholdPercent),

occupancyLowAdjustmentPercent:
  form.occupancyLowAdjustmentPercent.trim() === ""
    ? null
    : Number(form.occupancyLowAdjustmentPercent),

occupancyHighThresholdPercent:
  form.occupancyHighThresholdPercent.trim() === ""
    ? null
    : Number(form.occupancyHighThresholdPercent),

occupancyHighAdjustmentPercent:
  form.occupancyHighAdjustmentPercent.trim() === ""
    ? null
    : Number(form.occupancyHighAdjustmentPercent),

cleaningFee:
       form.cleaningFee.trim() === "" ? null : Number(form.cleaningFee),
          propertyProtectionEnabled: form.propertyProtectionEnabled,
          propertyProtectionMode: "CARD_ON_FILE",
          maxDamageLiabilityAmount:
            form.maxDamageLiabilityAmount.trim() === ""
              ? null
              : Number(form.maxDamageLiabilityAmount),
          maxGuests: form.maxGuests.trim() === "" ? null : Number(form.maxGuests),
          minimumNights: Number(form.minimumNights || 1),
          maximumNights:
            form.maximumNights.trim() === ""
              ? null
              : Number(form.maximumNights),
          isPublicBookable: form.isPublicBookable,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      navigate("/properties");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

async function handleSaveMarketPricing() {
  if (!id) return;

  const currency = marketPricing.currency.trim().toUpperCase();
  const minimumConfidence = Number(marketPricing.minimumConfidence);
  const maximumIncreasePercent = Number(
    marketPricing.maximumIncreasePercent
  );
  const maximumDecreasePercent = Number(
    marketPricing.maximumDecreasePercent
  );
  const maximumComparables = Number(marketPricing.maximumComparables);
  const marketRadiusKm =
    marketPricing.marketRadiusKm.trim() === ""
      ? null
      : Number(marketPricing.marketRadiusKm);

  if (!/^[A-Z]{3}$/.test(currency)) {
    setMarketPricingMessage("Enter a valid three-letter currency code.");
    return;
  }

  if (
    !Number.isFinite(minimumConfidence) ||
    minimumConfidence < 0 ||
    minimumConfidence > 100
  ) {
    setMarketPricingMessage("Minimum confidence must be between 0 and 100.");
    return;
  }

  if (
    !Number.isFinite(maximumIncreasePercent) ||
    maximumIncreasePercent < 0 ||
    maximumIncreasePercent > 100 ||
    !Number.isFinite(maximumDecreasePercent) ||
    maximumDecreasePercent < 0 ||
    maximumDecreasePercent > 100
  ) {
    setMarketPricingMessage(
      "Maximum increase and decrease must be between 0 and 100."
    );
    return;
  }

  if (
    !Number.isInteger(maximumComparables) ||
    maximumComparables < 1 ||
    maximumComparables > 50
  ) {
    setMarketPricingMessage("Maximum comparables must be between 1 and 50.");
    return;
  }

  if (
    marketRadiusKm !== null &&
    (!Number.isFinite(marketRadiusKm) ||
      marketRadiusKm < 0.1 ||
      marketRadiusKm > 100)
  ) {
    setMarketPricingMessage("Market radius must be between 0.1 and 100 km.");
    return;
  }

  setMarketPricingSaving(true);
  setMarketPricingMessage("");

  try {
    const response = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/market-pricing`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Provider assignment is intentionally outside the host dashboard.
          // Until a provider exists, configuration can be saved but cannot
          // activate Market Competition.
          enabled: marketPricing.providerAssigned
            ? marketPricing.enabled
            : false,
          currency,
          strategy: marketPricing.strategy,
          position: marketPricing.position,
          aggressiveness: marketPricing.aggressiveness,
          minimumConfidence,
          maximumIncreasePercent,
          maximumDecreasePercent,
          marketRadiusKm,
          maximumComparables,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error || "Failed to save Market Competition configuration"
      );
    }

    const profile = data?.marketPricing;
    setMarketPricing((current) => ({
      ...current,
      configured: Boolean(profile?.configured),
      providerAssigned: Boolean(profile?.providerAssigned),
      enabled: Boolean(profile?.enabled),
      currency: String(profile?.currency ?? currency),
      strategy: (profile?.strategy ?? current.strategy) as MarketPricingStrategy,
      position: (profile?.position ?? current.position) as MarketPricingPosition,
      aggressiveness: (profile?.aggressiveness ??
        current.aggressiveness) as MarketPricingAggressiveness,
      minimumConfidence: String(
        profile?.minimumConfidence ?? minimumConfidence
      ),
      maximumIncreasePercent: String(
        profile?.maximumIncreasePercent ?? maximumIncreasePercent
      ),
      maximumDecreasePercent: String(
        profile?.maximumDecreasePercent ?? maximumDecreasePercent
      ),
      marketRadiusKm:
        profile?.marketRadiusKm === null ||
        profile?.marketRadiusKm === undefined
          ? ""
          : String(profile.marketRadiusKm),
      maximumComparables: String(
        profile?.maximumComparables ?? maximumComparables
      ),
      lastSuccessfulRefreshAt: profile?.lastSuccessfulRefreshAt ?? null,
      nextRefreshAt: profile?.nextRefreshAt ?? null,
      lastErrorCode: profile?.lastErrorCode ?? null,
    }));
    setMarketPricingMessage(
      profile?.providerAssigned
        ? "Market Competition configuration saved."
        : "Configuration saved. Data provider pending."
    );
  } catch (error: any) {
    setMarketPricingMessage(
      String(
        error?.message || "Failed to save Market Competition configuration"
      )
    );
  } finally {
    setMarketPricingSaving(false);
  }
}

async function handleUploadPhotos(
  e: React.ChangeEvent<HTMLInputElement>
) {
  const files = e.target.files;

  if (!files || files.length === 0) {
    return;
  }

  setUploadingPhoto(true);
  setErr(null);

  try {
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();

      formData.append("photo", file);

      const res = await fetch(
        `${API_BASE}/api/uploads/property-photo`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to upload property photo"
        );
      }

      uploadedUrls.push(data.url);
    }

    setForm((s) => {
      const existing = s.publicPhotosText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      return {
        ...s,
        publicPhotosText: [...existing, ...uploadedUrls].join("\n"),
      };
    });
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setUploadingPhoto(false);
  }
}

  async function handleCreateAmenity() {
    if (!id) return;

    const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}/amenities`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newAmenity.name,
        description: newAmenity.description,
        chargeMode: newAmenity.chargeMode,
        feeType: newAmenity.feeType,
        amount: Number(newAmenity.amount || 0),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to create amenity");
    }

    setAmenities((prev) => [...prev, data.item]);

    setNewAmenity({
      name: "",
      description: "",
      chargeMode: "INCLUDED",
      feeType: "PER_STAY",
      amount: "",
    });
  }

  async function handleDeleteAmenity(amenityId: string) {
    if (!id) return;

    if (!window.confirm("Delete this amenity?")) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/amenities/${amenityId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to delete amenity");
    }

    setAmenities((prev) => prev.filter((a) => a.id !== amenityId));
  }

  async function handleSaveAmenity() {
    if (!id || !editingAmenityId || !editingAmenity) return;

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/amenities/${editingAmenityId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingAmenity.name,
          description: editingAmenity.description,
          chargeMode: editingAmenity.chargeMode,
          feeType: editingAmenity.feeType,
          amount: Number(editingAmenity.amount || 0),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update amenity");
    }

    setAmenities((prev) =>
      prev.map((a) => (a.id === editingAmenityId ? data.item : a))
    );

    setEditingAmenityId(null);
    setEditingAmenity(null);
  }

  async function handleUploadNearbyPlacePhoto(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingNearbyPlacePhoto(true);
    setErr(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`${API_BASE}/api/uploads/property-photo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to upload Things to Do photo");
      setNewNearbyPlace((current) => ({ ...current, photoUrl: data.url }));
    } catch (error: any) {
      setErr(String(error?.message ?? error));
    } finally {
      setUploadingNearbyPlacePhoto(false);
      e.target.value = "";
    }
  }

  async function handleCreateNearbyPlace() {
    if (!id || !newNearbyPlace.name.trim()) return;

    const res = await fetch(`${API_BASE}/api/properties/${id}/nearby-places`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newNearbyPlace,
        travelTimeMinutes: newNearbyPlace.travelTimeMinutes.trim()
          ? Number(newNearbyPlace.travelTimeMinutes)
          : null,
        sortOrder: nearbyPlaces.length,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to create nearby place");

    setNearbyPlaces((prev) => [...prev, data.item]);
    setNewNearbyPlace({
      name: "",
      nameEs: "",
      category: "OTHER",
      description: "",
      descriptionEs: "",
      distanceText: "",
      travelTimeMinutes: "",
      googleMapsUrl: "",
      photoUrl: "",
      isActive: true,
    });
  }

  async function handleSaveNearbyPlace() {
    if (!id || !editingNearbyPlaceId || !editingNearbyPlace) return;

    const res = await fetch(
      `${API_BASE}/api/properties/${id}/nearby-places/${editingNearbyPlaceId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingNearbyPlace),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to update nearby place");

    setNearbyPlaces((prev) =>
      prev.map((item) => (item.id === editingNearbyPlaceId ? data.item : item))
    );
    setEditingNearbyPlaceId(null);
    setEditingNearbyPlace(null);
  }

  async function handleDeleteNearbyPlace(placeId: string) {
    if (!id || !window.confirm("Delete this Things to Do place?")) return;

    const res = await fetch(
      `${API_BASE}/api/properties/${id}/nearby-places/${placeId}`,
      { method: "DELETE", credentials: "include" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to delete nearby place");

    setNearbyPlaces((prev) => prev.filter((item) => item.id !== placeId));
  }

  async function handleCreateTax() {
    if (!id) return;

    const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}/taxes`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newTax.name,
        percentage: Number(newTax.percentage || 0),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to create tax");
    }

    setTaxes((prev) => [...prev, data.item]);

    setNewTax({
      name: "",
      percentage: "",
    });
  }

  async function handleDeleteTax(taxId: string) {
    if (!id) return;

    if (!window.confirm("Delete this tax?")) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/taxes/${taxId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to delete tax");
    }

    setTaxes((prev) => prev.filter((t) => t.id !== taxId));
  }

  async function handleSaveTax() {
    if (!id || !editingTaxId || !editingTax) return;

    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/taxes/${editingTaxId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingTax.name,
          percentage: Number(editingTax.percentage || 0),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update tax");
    }

    setTaxes((prev) =>
      prev.map((t) => (t.id === editingTaxId ? data.item : t))
    );

    setEditingTaxId(null);
    setEditingTax(null);
  }

async function handleSaveSeason() {
  if (!id || !editingSeasonId || !editingSeason) return;

  const cleanName = editingSeason.name.trim();
  const startMonth = Number(editingSeason.startMonth);
  const startDay = Number(editingSeason.startDay);
  const endMonth = Number(editingSeason.endMonth);
  const endDay = Number(editingSeason.endDay);
  const adjustmentPercent = Number(editingSeason.adjustmentPercent);

  if (!cleanName) {
    throw new Error("Season name is required");
  }

  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new Error("Start month must be between 1 and 12");
  }

  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) {
    throw new Error("End month must be between 1 and 12");
  }

  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new Error("Start day must be between 1 and 31");
  }

  if (!Number.isInteger(endDay) || endDay < 1 || endDay > 31) {
    throw new Error("End day must be between 1 and 31");
  }

  if (
    !Number.isFinite(adjustmentPercent) ||
    adjustmentPercent < -100 ||
    adjustmentPercent > 300
  ) {
    throw new Error("Adjustment percent must be between -100 and 300");
  }

  setSavingSeason(true);
  setErr(null);

  try {
    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/seasons/${editingSeasonId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
  body: JSON.stringify({
  name: cleanName,
  type: editingSeason.type ?? "SHOULDER",
  startMonth,
  startDay,
  endMonth,
  endDay,
  adjustmentPercent,
  isActive: true,
}),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update custom season");
    }

    setSeasons((prev) =>
      prev.map((season) =>
        season.id === editingSeasonId ? data.item : season
      )
    );

    setEditingSeasonId(null);
    setEditingSeason(null);
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setSavingSeason(false);
  }
}

async function handleDeleteSeason(seasonId: string) {
  if (!id) return;

  if (!window.confirm("Delete this custom season?")) {
    return;
  }

  setDeletingSeasonId(seasonId);
  setErr(null);

  try {
    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/seasons/${seasonId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to delete custom season");
    }

    setSeasons((prev) =>
      prev.map((season) =>
        season.id === seasonId ? { ...season, isActive: false } : season
      )
    );

    if (editingSeasonId === seasonId) {
      setEditingSeasonId(null);
      setEditingSeason(null);
    }
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setDeletingSeasonId(null);
  }
}

async function handleSaveHolidayPricingAdjustment(
  holiday: PropertyHolidayPricingItem
) {
  if (!id) return;

  const adjustmentPercent = Number(holidayPricingAdjustmentInput);

  if (
    !Number.isFinite(adjustmentPercent) ||
    adjustmentPercent < -100 ||
    adjustmentPercent > 300
  ) {
    throw new Error("Holiday adjustment percent must be between -100 and 300");
  }

  setSavingHolidayPricingId(holiday.id);
  setErr(null);

  try {
    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/holiday-pricing/${holiday.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adjustmentPercent,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update holiday pricing");
    }

    setHolidayPricing((prev) =>
      prev.map((item) =>
        item.id === holiday.id ? { ...item, ...data.item } : item
      )
    );

    setEditingHolidayPricingId(null);
    setHolidayPricingAdjustmentInput("");
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setSavingHolidayPricingId(null);
  }
}

async function handleSaveRecommendedSeasonAdjustment(
  season: PropertySeasonItem
) {
  if (!id) return;

  const adjustmentPercent = Number(recommendedSeasonAdjustmentInput);

  if (
    !Number.isFinite(adjustmentPercent) ||
    adjustmentPercent < -100 ||
    adjustmentPercent > 300
  ) {
    throw new Error("Adjustment percent must be between -100 and 300");
  }

  setSavingRecommendedSeasonId(season.id);
  setErr(null);

  try {
    const res = await fetch(
      `${API_BASE}/api/dashboard/properties/${id}/seasons/${season.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adjustmentPercent,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error || "Failed to update Pin&Go recommended season"
      );
    }

    setSeasons((prev) =>
      prev.map((item) =>
        item.id === season.id ? { ...item, ...data.item } : item
      )
    );

    setEditingRecommendedSeasonId(null);
    setRecommendedSeasonAdjustmentInput("");
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setSavingRecommendedSeasonId(null);
  }
}

  async function handleCreateSeason() {
  if (!id) return;

  const cleanName = newSeason.name.trim();
  const startMonth = Number(newSeason.startMonth);
  const startDay = Number(newSeason.startDay);
  const endMonth = Number(newSeason.endMonth);
  const endDay = Number(newSeason.endDay);
  const adjustmentPercent = Number(newSeason.adjustmentPercent);

  if (!cleanName) {
    throw new Error("Season name is required");
  }

  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new Error("Start month must be between 1 and 12");
  }

  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) {
    throw new Error("End month must be between 1 and 12");
  }

  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new Error("Start day must be between 1 and 31");
  }

  if (!Number.isInteger(endDay) || endDay < 1 || endDay > 31) {
    throw new Error("End day must be between 1 and 31");
  }

  if (
    !Number.isFinite(adjustmentPercent) ||
    adjustmentPercent < -100 ||
    adjustmentPercent > 300
  ) {
    throw new Error("Adjustment percent must be between -100 and 300");
  }

  setCreatingSeason(true);
  setErr(null);

  try {
    const res = await fetch(`${API_BASE}/api/dashboard/properties/${id}/seasons`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
   body: JSON.stringify({
  name: cleanName,
  type: newSeason.type ?? "SHOULDER",
  startMonth,
  startDay,
  endMonth,
  endDay,
  adjustmentPercent,
}),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to create custom season");
    }

    setSeasons((prev) => [...prev, data.item]);

    setNewSeason({
      name: "",
      type: "SHOULDER",
      startMonth: "",
      startDay: "",
      endMonth: "",
      endDay: "",
      adjustmentPercent: "",
    });
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  } finally {
    setCreatingSeason(false);
  }
}

  const derivedCheckInTime =
    Number(form.cleaningDurationMinutes) === 240 ? "4:00 PM" : "3:00 PM";

  const publicBaseUrl =
    import.meta.env.VITE_PUBLIC_SITE_URL ?? window.location.origin;

  const publicPropertyUrl =
    organizationSlug && form.slug
      ? `${publicBaseUrl}/book/${organizationSlug}/${form.slug}`
      : "";
const recommendedSeasons = seasons.filter(
  (season) => season.source === "PIN_GO_DEFAULT" && season.isActive
);

const customSeasons = seasons.filter(
  (season) => season.source === "CUSTOM" && season.isActive
);

function getSeasonTypeLabel(type?: PropertySeasonType) {
  if (type === "PEAK") return "Peak Season";
  if (type === "LOW") return "Low Season";
  return "Shoulder Season";
}

function getSeasonTypeStyle(type?: PropertySeasonType): React.CSSProperties {
  if (type === "PEAK") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (type === "LOW") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };
}

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
            Edit Property
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Update the operational settings and location details for this property.
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/properties")}
          style={secondaryButtonStyle}
        >
          Back
        </button>
      </div>

      {err ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <b>Error:</b> {err.replace(/CHANNEX/gi, "Pin&Go Connect")}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: "#666" }}>Loading property...</div>
      ) : (
        <form
          onSubmit={handleSave}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 20,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>Property Name</div>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Property name"
              style={inputStyle}
              required
            />
          </div>


          <div style={{ display: "grid", gap: 8 }}>
            <div style={labelStyle}>Address</div>
            <input
              value={form.address1}
              readOnly
              placeholder="Address"
              style={{ ...inputStyle, background: "#f9fafb" }}
            />
            {placesAvailable ? (
              <div ref={autocompleteMountRef} />
            ) : null}
            {locationMessage ? (
              <div style={helperTextStyle}>{locationMessage}</div>
            ) : null}
            {timezoneLookupMessage ? (
              <div style={helperTextStyle}>{timezoneLookupMessage}</div>
            ) : null}
          </div>

          {locationDirty ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                border: "1px solid #dbeafe",
                borderRadius: 16,
                background: "#f8fbff",
                padding: 14,
              }}
            >
              <div>
                <div style={{ ...labelStyle, fontSize: 15 }}>
                  Confirm new property location
                </div>
                <div style={helperTextStyle}>
                  Make sure the pin marks the exact property guests should navigate to.
                </div>
              </div>
              <div
                ref={mapMountRef}
                aria-label="Selected property location map"
                style={{
                  width: "100%",
                  height: 280,
                  borderRadius: 14,
                  border: "1px solid #dbe3ee",
                  overflow: "hidden",
                  background: "#e5e7eb",
                }}
              />
              <div style={helperTextStyle}>{form.address1}</div>
              {locationConfirmed ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    color: "#166534",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "11px 12px",
                  }}
                >
                  Location confirmed
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLocationConfirmed(true)}
                  style={secondaryButtonStyle}
                >
                  Confirm location
                </button>
              )}
            </div>
          ) : null}

          <div style={responsiveGridStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>City</div>
              <input
                value={form.city}
                onChange={(e) =>
                  setForm((s) => ({ ...s, city: e.target.value }))
                }
                placeholder="City"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Region</div>
              <input
                value={form.region}
                onChange={(e) =>
                  setForm((s) => ({ ...s, region: e.target.value }))
                }
                placeholder="Region"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={labelStyle}>ZIP / Postal Code</div>
            <input
              value={form.postalCode}
              onChange={(e) =>
                setForm((s) => ({ ...s, postalCode: e.target.value }))
              }
              autoComplete="postal-code"
              placeholder="00771"
              style={inputStyle}
            />
          </div>

          <div style={responsiveGridStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Country</div>
              <input
                value={form.country}
                onChange={(e) =>
                  setForm((s) => ({ ...s, country: e.target.value }))
                }
                placeholder="Country"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Timezone</div>
              <input
                value={form.timezone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, timezone: e.target.value }))
                }
                placeholder="Timezone"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={responsiveGridStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Latitude</div>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, latitude: e.target.value }))
                }
                placeholder="18.4655"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Longitude</div>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, longitude: e.target.value }))
                }
                placeholder="-66.1057"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={responsiveGridStyle}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Cleaning Duration (minutes)</div>
              <input
                type="number"
                value={form.cleaningDurationMinutes}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    cleaningDurationMinutes: Number(e.target.value || 0),
                  }))
                }
                placeholder="180"
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Derived check-in time:{" "}
                <b style={{ color: "#111827" }}>{derivedCheckInTime}</b>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>Cleaning Start Offset (minutes)</div>
              <input
                type="number"
                value={form.cleaningStartOffsetMinutes}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    cleaningStartOffsetMinutes: Number(e.target.value || 0),
                  }))
                }
                placeholder="30"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 18,
              padding: 18,
              background: "#eff6ff",
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Direct Booking Settings
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Configure how this property appears and prices reservations on your
                public booking page.
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              <input
                type="checkbox"
                checked={form.isPublicBookable}
                onChange={(e) =>
                  setForm((s) => ({ ...s, isPublicBookable: e.target.checked }))
                }
              />
              Public Booking Enabled
            </label>
<div
  style={{
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: 16,
    background: "#ffffff",
    display: "grid",
    gap: 14,
  }}
>
  <div>
    <div style={{ ...labelStyle, fontSize: 16 }}>Property Protection</div>
    <div style={helperTextStyle}>
      Optional damage responsibility protection for Direct Booking. This does not place a deposit or hold on the guest&apos;s funds.
    </div>
  </div>

  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 700 }}>
    <input
      type="checkbox"
      checked={form.propertyProtectionEnabled}
      onChange={(e) =>
        setForm((s) => ({ ...s, propertyProtectionEnabled: e.target.checked }))
      }
    />
    <span>
      Enable damage responsibility protection
      <span style={{ ...helperTextStyle, display: "block", fontWeight: 400 }}>
        When the Card on File payment phase is enabled, the guest will authorize a compatible payment method to be securely retained by Stripe for eligible, documented damage claims.
      </span>
    </span>
  </label>

  {form.propertyProtectionEnabled ? (
    <>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Protection method</div>
        <input value="Card on File" disabled style={{ ...inputStyle, background: "#f8fafc" }} />
        <div style={helperTextStyle}>No funds are held at booking.</div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Maximum damage responsibility</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800 }}>$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.maxDamageLiabilityAmount}
            onChange={(e) =>
              setForm((s) => ({ ...s, maxDamageLiabilityAmount: e.target.value }))
            }
            placeholder="500.00"
            style={inputStyle}
          />
        </div>
        <div style={helperTextStyle}>
          Maximum amount the guest can authorize for an eligible, documented damage claim under the accepted policy.
        </div>
      </div>
    </>
  ) : (
    <div style={helperTextStyle}>
      Property Protection is off. No payment method is retained for damage responsibility.
    </div>
  )}
</div>

<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Property URL Slug</div>

  <input
    value={form.slug}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        slug: e.target.value,
      }))
    }
    placeholder="casa-collores"
    style={inputStyle}
  />

  <div style={{ fontSize: 12, color: "#6b7280" }}>
    Used for your public booking URL.
  </div>

  {publicPropertyUrl ? (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #dbeafe",
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#6b7280",
          }}
        >
          Public Property URL
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(publicPropertyUrl);
              setCopiedPublicUrl(true);

              window.setTimeout(() => {
                setCopiedPublicUrl(false);
              }, 1800);
            } catch {
              setErr("Unable to copy public property URL.");
            }
          }}
          style={secondarySmallButtonStyle}
        >
          {copiedPublicUrl ? "Copied!" : "Copy URL"}
        </button>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#111827",
          wordBreak: "break-all",
        }}
      >
        {publicPropertyUrl}
      </div>
    </div>
  ) : null}
</div>


<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Public Title</div>

  <input
    value={form.publicTitle}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        publicTitle: e.target.value,
      }))
    }
    placeholder="Luxury Beachfront Villa"
    style={inputStyle}
  />
</div>

<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Public Description (English)</div>

  <textarea
    value={form.publicDescription}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        publicDescription: e.target.value,
      }))
    }
    placeholder="Describe the guest experience, location, amenities and unique features of the property."
    style={{
      ...inputStyle,
      height: 120,
      padding: 14,
      resize: "vertical",
    }}
  />
</div>

<div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Public Description (Spanish)</div>

  <textarea
    value={form.publicDescriptionEs}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        publicDescriptionEs: e.target.value,
      }))
    }
    placeholder="Describa la experiencia, ubicación, amenidades y características únicas de la propiedad."
    style={{
      ...inputStyle,
      height: 120,
      padding: 14,
      resize: "vertical",
    }}
  />
</div>
          
<div style={{ display: "grid", gap: 8 }}>
  <div style={labelStyle}>Property Photos</div>

  <input
    type="file"
    accept="image/*"
    multiple
    onChange={handleUploadPhotos}
  />

  <div style={{ fontSize: 12, color: "#6b7280" }}>
    Upload guest-facing property photos. The first photo will be used as the main gallery image.
  </div>
</div>
{uploadingPhoto ? (
  <div
    style={{
      fontSize: 13,
      color: "#2563eb",
      fontWeight: 700,
    }}
  >
    Uploading photos...
  </div>
) : null}

          <div
  style={{
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 12,
  }}
>
 {form.publicPhotosText
  .split("\n")
  .map((url) => url.trim())
  .filter(Boolean)
  .map((url, index) => (
    <div
      key={`${url}-${index}`}
      style={{
        position: "relative",
        width: 120,
        height: 90,
      }}
    >
      <img
        src={url}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 12,
          border: "1px solid #d1d5db",
        }}
      />

      <button
        type="button"
        onClick={() => {
          const remaining = form.publicPhotosText
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .filter((x, i) => !(x === url && i === index));

          setForm((s) => ({
            ...s,
            publicPhotosText: remaining.join("\n"),
          }));
        }}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 26,
          height: 26,
          borderRadius: 999,
          border: "none",
          background: "rgba(17, 24, 39, 0.82)",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 900,
          cursor: "pointer",
          lineHeight: "26px",
        }}
        aria-label="Remove photo"
        title="Remove photo"
      >
        ×
      </button>
    </div>
  ))}

</div>   

       <div
  style={{
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 16,
    background: "#f8fbff",
    display: "grid",
    gap: 14,
  }}
>
  <div>
    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
      Things to Do
    </div>
    <div style={helperTextStyle}>
      Recommend nearby places guests can discover during their stay.
    </div>
    <div style={{ ...helperTextStyle, fontWeight: 800 }}>
      {nearbyPlaces.length} of 5 places
    </div>
  </div>

  <div style={responsiveGridStyle}>
    <input
      value={newNearbyPlace.name}
      onChange={(e) => setNewNearbyPlace((s) => ({ ...s, name: e.target.value }))}
      placeholder="Place name (English)"
      style={inputStyle}
    />
    <input
      value={newNearbyPlace.nameEs}
      onChange={(e) => setNewNearbyPlace((s) => ({ ...s, nameEs: e.target.value }))}
      placeholder="Nombre del lugar (Español)"
      style={inputStyle}
    />
    <select
      value={newNearbyPlace.category}
      onChange={(e) =>
        setNewNearbyPlace((s) => ({
          ...s,
          category: e.target.value as NearbyPlaceCategory,
        }))
      }
      style={inputStyle}
    >
      {["BEACH","RESTAURANT","ATTRACTION","NATURE","SHOPPING","NIGHTLIFE","CULTURE","OTHER"].map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
    </select>
  </div>

  <textarea
    value={newNearbyPlace.description}
    onChange={(e) => setNewNearbyPlace((s) => ({ ...s, description: e.target.value }))}
    placeholder="Short guest-facing description"
    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
  />
  <textarea
    value={newNearbyPlace.descriptionEs}
    onChange={(e) => setNewNearbyPlace((s) => ({ ...s, descriptionEs: e.target.value }))}
    placeholder="Descripción breve para huéspedes (Español)"
    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
  />

  <div style={responsiveGridStyle}>
    <input
      value={newNearbyPlace.distanceText}
      onChange={(e) => setNewNearbyPlace((s) => ({ ...s, distanceText: e.target.value }))}
      placeholder="Distance, e.g. 3.2 mi"
      style={inputStyle}
    />
    <input
      type="number"
      min="0"
      value={newNearbyPlace.travelTimeMinutes}
      onChange={(e) => setNewNearbyPlace((s) => ({ ...s, travelTimeMinutes: e.target.value }))}
      placeholder="Travel time (minutes)"
      style={inputStyle}
    />
  </div>

  <input
    value={newNearbyPlace.googleMapsUrl}
    onChange={(e) => setNewNearbyPlace((s) => ({ ...s, googleMapsUrl: e.target.value }))}
    placeholder="Google Maps URL"
    style={inputStyle}
  />
  <div style={{ display: "grid", gap: 8 }}>
    <div style={labelStyle}>Photo</div>
    <input type="file" accept="image/*" onChange={handleUploadNearbyPlacePhoto} />
    {uploadingNearbyPlacePhoto ? <div style={helperTextStyle}>Uploading photo...</div> : null}
    {newNearbyPlace.photoUrl ? (
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <img
          src={newNearbyPlace.photoUrl}
          alt=""
          style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 12 }}
        />
        <button
          type="button"
          onClick={() => setNewNearbyPlace((s) => ({ ...s, photoUrl: "" }))}
          style={secondarySmallButtonStyle}
        >
          Remove photo
        </button>
      </div>
    ) : null}
  </div>

  <button
    type="button"
    onClick={() => handleCreateNearbyPlace().catch((e) => setErr(String(e?.message ?? e)))}
    style={secondaryButtonStyle}
    disabled={!newNearbyPlace.name.trim() || nearbyPlaces.length >= 5}
  >
    {nearbyPlaces.length >= 5 ? "Maximum 5 places" : "Add Things to Do place"}
  </button>

  {nearbyPlaces.length === 0 ? (
    <div style={helperTextStyle}>No Things to Do places added yet.</div>
  ) : (
    <div style={{ display: "grid", gap: 10 }}>
      {nearbyPlaces.map((place) => {
        const editing = editingNearbyPlaceId === place.id && editingNearbyPlace;
        const item = editing || place;

        return (
          <div
            key={place.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "#ffffff",
              display: "grid",
              gap: 10,
            }}
          >
            {editing ? (
              <>
                <div style={responsiveGridStyle}>
                  <input
                    value={item.name}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) => s ? ({ ...s, name: e.target.value }) : s)
                    }
                    style={inputStyle}
                  />
                  <input
                    value={item.nameEs ?? ""}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) => s ? ({ ...s, nameEs: e.target.value }) : s)
                    }
                    placeholder="Nombre (Español)"
                    style={inputStyle}
                  />
                  <select
                    value={item.category}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) =>
                        s ? ({ ...s, category: e.target.value as NearbyPlaceCategory }) : s
                      )
                    }
                    style={inputStyle}
                  >
                    {["BEACH","RESTAURANT","ATTRACTION","NATURE","SHOPPING","NIGHTLIFE","CULTURE","OTHER"].map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={item.description ?? ""}
                  onChange={(e) =>
                    setEditingNearbyPlace((s) => s ? ({ ...s, description: e.target.value }) : s)
                  }
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                />
                <textarea
                  value={item.descriptionEs ?? ""}
                  onChange={(e) =>
                    setEditingNearbyPlace((s) => s ? ({ ...s, descriptionEs: e.target.value }) : s)
                  }
                  placeholder="Descripción (Español)"
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                />
                <div style={responsiveGridStyle}>
                  <input
                    value={item.distanceText ?? ""}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) => s ? ({ ...s, distanceText: e.target.value }) : s)
                    }
                    placeholder="Distance"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.travelTimeMinutes ?? ""}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) =>
                        s ? ({ ...s, travelTimeMinutes: e.target.value === "" ? null : Number(e.target.value) }) : s
                      )
                    }
                    placeholder="Minutes"
                    style={inputStyle}
                  />
                </div>
                <input
                  value={item.googleMapsUrl ?? ""}
                  onChange={(e) =>
                    setEditingNearbyPlace((s) => s ? ({ ...s, googleMapsUrl: e.target.value }) : s)
                  }
                  placeholder="Google Maps URL"
                  style={inputStyle}
                />
                <input
                  value={item.photoUrl ?? ""}
                  onChange={(e) =>
                    setEditingNearbyPlace((s) => s ? ({ ...s, photoUrl: e.target.value }) : s)
                  }
                  placeholder="Photo URL"
                  style={inputStyle}
                />
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(e) =>
                      setEditingNearbyPlace((s) => s ? ({ ...s, isActive: e.target.checked }) : s)
                    }
                  />
                  Active on Direct Booking
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => handleSaveNearbyPlace().catch((e) => setErr(String(e?.message ?? e)))} style={secondarySmallButtonStyle}>
                    Save
                  </button>
                  <button type="button" onClick={() => { setEditingNearbyPlaceId(null); setEditingNearbyPlace(null); }} style={secondarySmallButtonStyle}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#111827" }}>{place.name}</div>
                    <div style={helperTextStyle}>
                      {place.category}
                      {place.travelTimeMinutes != null ? ` · ${place.travelTimeMinutes} min` : ""}
                      {place.distanceText ? ` · ${place.distanceText}` : ""}
                      {!place.isActive ? " · Hidden" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => { setEditingNearbyPlaceId(place.id); setEditingNearbyPlace({ ...place }); }} style={secondarySmallButtonStyle}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDeleteNearbyPlace(place.id).catch((e) => setErr(String(e?.message ?? e)))} style={secondarySmallButtonStyle}>
                      Delete
                    </button>
                  </div>
                </div>
                {place.description ? <div style={helperTextStyle}>{place.description}</div> : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>

<div style={responsiveGridStyle}>
  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Nightly Rate</div>
    <input
      type="number"
      min="0"
      step="0.01"
      value={form.baseNightlyRate}
      onChange={(e) =>
        setForm((s) => ({ ...s, baseNightlyRate: e.target.value }))
      }
      placeholder="150.00"
      style={inputStyle}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Minimum Nightly Rate</div>
    <input
      type="number"
      min="0"
      step="0.01"
      value={form.minimumNightlyRate}
      onChange={(e) =>
        setForm((s) => ({ ...s, minimumNightlyRate: e.target.value }))
      }
      placeholder="100.00"
      style={inputStyle}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Maximum Nightly Rate</div>
    <input
      type="number"
      min="0"
      step="0.01"
      value={form.maximumNightlyRate}
      onChange={(e) =>
        setForm((s) => ({ ...s, maximumNightlyRate: e.target.value }))
      }
      placeholder="300.00"
      style={inputStyle}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Cleaning Fee</div>
    <input
      type="number"
      min="0"
      step="0.01"
      value={form.cleaningFee}
      onChange={(e) =>
        setForm((s) => ({ ...s, cleaningFee: e.target.value }))
      }
      placeholder="75.00"
      style={inputStyle}
    />
  </div>
</div>

<div style={responsiveGridStyle}>
  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Max Guests</div>
    <input
      type="number"
      min="1"
      value={form.maxGuests}
      onChange={(e) =>
        setForm((s) => ({ ...s, maxGuests: e.target.value }))
      }
      placeholder="4"
      style={inputStyle}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Minimum Nights</div>
    <input
      type="number"
      min="1"
      value={form.minimumNights}
      onChange={(e) =>
        setForm((s) => ({ ...s, minimumNights: e.target.value }))
      }
      placeholder="1"
      style={inputStyle}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <div style={labelStyle}>Maximum Nights</div>
    <input
      type="number"
      min="1"
      value={form.maximumNights}
      onChange={(e) =>
        setForm((s) => ({ ...s, maximumNights: e.target.value }))
      }
      placeholder="Optional"
      style={inputStyle}
    />
  </div>
</div>

{id ? <CancellationPolicyCard propertyId={id} /> : null}

{id ? <GuestAccessSettingsCard propertyId={id} /> : null}

<div
  style={{
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    padding: 18,
    background: "#ffffff",
    display: "grid",
    gap: 16,
  }}
>
  <div>
    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
      Dynamic Pricing
    </div>
    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
      Automatically adjust rates using simple pricing rules.
    </div>
  </div>

  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 14,
      fontWeight: 800,
      color: "#111827",
    }}
  >
    <input
      type="checkbox"
      checked={form.dynamicPricingEnabled}
      onChange={(e) =>
        setForm((s) => ({
          ...s,
          dynamicPricingEnabled: e.target.checked,
        }))
      }
    />
    Enable Dynamic Pricing
  </label>

  <div
    style={{
      borderTop: "1px solid #dbeafe",
      paddingTop: 16,
      display: "grid",
      gap: 14,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
          Market Competition
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Configure once. Pin&Go can compare similar listings and adjust rates
          within the limits you choose.
        </div>
      </div>

      <div
        style={{
          padding: "5px 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 900,
          background:
            marketPricing.enabled && marketPricing.providerAssigned
              ? "#dcfce7"
              : marketPricing.configured
                ? "#fef3c7"
                : "#f3f4f6",
          color:
            marketPricing.enabled && marketPricing.providerAssigned
              ? "#166534"
              : marketPricing.configured
                ? "#92400e"
                : "#4b5563",
        }}
      >
        {marketPricing.enabled && marketPricing.providerAssigned
          ? "Active"
          : marketPricing.configured && !marketPricing.providerAssigned
            ? "Configured · Data provider pending"
            : marketPricing.configured
              ? "Configured · Not active"
              : "Not configured"}
      </div>
    </div>

    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        fontWeight: 800,
        color: "#111827",
      }}
    >
      <input
        type="checkbox"
        checked={marketPricing.enabled}
        onChange={(e) =>
          setMarketPricing((current) => ({
            ...current,
            enabled: e.target.checked,
          }))
        }
        disabled={
          marketPricingLoading ||
          !form.dynamicPricingEnabled ||
          !marketPricing.providerAssigned
        }
      />
      Use Market Competition
    </label>

    {!marketPricing.providerAssigned ? (
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: "#fffbeb",
          border: "1px solid #fde68a",
          color: "#92400e",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        You can save the initial strategy now. Market Competition will remain
        off until Pin&Go has a competitive-data provider assigned.
      </div>
    ) : null}

    <div style={responsiveGridStyle}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Pricing Goal</div>
        <select
          value={marketPricing.strategy}
          onChange={(e) =>
            setMarketPricing((current) => ({
              ...current,
              strategy: e.target.value as MarketPricingStrategy,
            }))
          }
          style={inputStyle}
          disabled={marketPricingLoading}
        >
          <option value="OCCUPANCY">Maximize Occupancy</option>
          <option value="BALANCED">Balanced</option>
          <option value="REVENUE">Maximize Revenue</option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Market Position</div>
        <select
          value={marketPricing.position}
          onChange={(e) =>
            setMarketPricing((current) => ({
              ...current,
              position: e.target.value as MarketPricingPosition,
            }))
          }
          style={inputStyle}
          disabled={marketPricingLoading}
        >
          <option value="VALUE">Value</option>
          <option value="COMPETITIVE">Competitive</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Adjustment Style</div>
        <select
          value={marketPricing.aggressiveness}
          onChange={(e) =>
            setMarketPricing((current) => ({
              ...current,
              aggressiveness: e.target.value as MarketPricingAggressiveness,
            }))
          }
          style={inputStyle}
          disabled={marketPricingLoading}
        >
          <option value="CONSERVATIVE">Conservative</option>
          <option value="MODERATE">Moderate</option>
          <option value="AGGRESSIVE">Aggressive</option>
        </select>
      </div>
    </div>

    <button
      type="button"
      onClick={() => setMarketPricingAdvancedOpen((current) => !current)}
      style={{
        border: 0,
        background: "transparent",
        padding: 0,
        color: "#2563eb",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
        justifySelf: "start",
      }}
    >
      {marketPricingAdvancedOpen ? "Hide advanced settings" : "Advanced settings"}
    </button>

    {marketPricingAdvancedOpen ? (
      <div style={responsiveGridStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Currency</div>
          <input
            value={marketPricing.currency}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                currency: e.target.value.toUpperCase().slice(0, 3),
              }))
            }
            placeholder="USD"
            maxLength={3}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Minimum Confidence (%)</div>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={marketPricing.minimumConfidence}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                minimumConfidence: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Maximum Increase (%)</div>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={marketPricing.maximumIncreasePercent}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                maximumIncreasePercent: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Maximum Decrease (%)</div>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={marketPricing.maximumDecreasePercent}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                maximumDecreasePercent: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Market Radius (km)</div>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={marketPricing.marketRadiusKm}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                marketRadiusKm: e.target.value,
              }))
            }
            placeholder="Optional"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Maximum Comparables</div>
          <input
            type="number"
            min="1"
            max="50"
            step="1"
            value={marketPricing.maximumComparables}
            onChange={(e) =>
              setMarketPricing((current) => ({
                ...current,
                maximumComparables: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </div>
      </div>
    ) : null}

    {marketPricing.lastErrorCode ? (
      <div style={{ fontSize: 12, color: "#b91c1c" }}>
        Market data status: {marketPricing.lastErrorCode}
      </div>
    ) : null}

    {marketPricingMessage ? (
      <div
        style={{
          fontSize: 12,
          color: marketPricingMessage.toLowerCase().includes("saved")
            ? "#166534"
            : "#6b7280",
        }}
      >
        {marketPricingMessage}
      </div>
    ) : null}

    <button
      type="button"
      onClick={handleSaveMarketPricing}
      disabled={marketPricingLoading || marketPricingSaving}
      style={{
        ...primarySmallButtonStyle,
        justifySelf: "start",
        opacity: marketPricingLoading || marketPricingSaving ? 0.65 : 1,
        cursor:
          marketPricingLoading || marketPricingSaving
            ? "not-allowed"
            : "pointer",
      }}
    >
      {marketPricingSaving
        ? "Saving Market Competition..."
        : "Save Market Competition"}
    </button>
  </div>

  <div style={responsiveGridStyle}>
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Weekend Markup (%)</div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={form.weekendMarkupPercent}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            weekendMarkupPercent: e.target.value,
          }))
        }
        placeholder="15"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled}
      />
    </div>
  </div>
 <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  }}
>
  <input
    type="checkbox"
    checked={form.seasonalPricingEnabled}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        seasonalPricingEnabled: e.target.checked,
      }))
    }
    disabled={!form.dynamicPricingEnabled}
  />
  Enable Seasonal Pricing
</label>

<label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  }}
>
  <input
    type="checkbox"
    checked={form.holidayPricingEnabled}
    onChange={(e) =>
      setForm((s) => ({
        ...s,
        holidayPricingEnabled: e.target.checked,
      }))
    }
    disabled={!form.dynamicPricingEnabled}
  />
  Enable Holiday Pricing
</label>

{form.seasonalPricingEnabled ? (
  <div
    style={{
      borderTop: "1px solid #dbeafe",
      paddingTop: 16,
      display: "grid",
      gap: 14,
    }}
  >
    <div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
        Pin&Go Recommended Seasons
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
        Market-based seasons automatically applied by Pin&Go.
      </div>
    </div>

    {recommendedSeasons.length === 0 ? (
      <div style={{ fontSize: 13, color: "#6b7280" }}>
        No recommended seasons applied yet.
      </div>
    ) : (
      <div style={{ display: "grid", gap: 8 }}>
        {recommendedSeasons.map((season) => (
          <div
            key={season.id}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #dbeafe",
              background: "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                {season.name}
              </div>
             <div
  style={{
    display: "inline-flex",
    marginTop: 6,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    ...getSeasonTypeStyle(season.type),
  }}
>
  {getSeasonTypeLabel(season.type)}
</div>

            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {season.startMonth}/{season.startDay} → {season.endMonth}/
                {season.endDay}
              </div>
            </div>
            {editingRecommendedSeasonId === season.id ? (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    }}
  >
    <input
      type="number"
      step="0.01"
      value={recommendedSeasonAdjustmentInput}
      onChange={(e) =>
        setRecommendedSeasonAdjustmentInput(e.target.value)
      }
      style={{
        ...inputStyle,
        width: 110,
      }}
    />

    <button
      type="button"
      disabled={savingRecommendedSeasonId === season.id}
      onClick={async () => {
        try {
          await handleSaveRecommendedSeasonAdjustment(season);
        } catch (e: any) {
          setErr(String(e?.message ?? e));
        }
      }}
      style={{
        ...primarySmallButtonStyle,
        opacity: savingRecommendedSeasonId === season.id ? 0.7 : 1,
        cursor:
          savingRecommendedSeasonId === season.id
            ? "not-allowed"
            : "pointer",
      }}
    >
      {savingRecommendedSeasonId === season.id ? "Saving..." : "Save"}
    </button>

    <button
      type="button"
      onClick={() => {
        setEditingRecommendedSeasonId(null);
        setRecommendedSeasonAdjustmentInput("");
      }}
      style={secondarySmallButtonStyle}
    >
      Cancel
    </button>
  </div>
) : (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 14, fontWeight: 900, color: "#2563eb" }}>
      {season.adjustmentPercent > 0 ? "+" : ""}
      {season.adjustmentPercent}%
    </div>

    <button
      type="button"
      onClick={() => {
        setEditingRecommendedSeasonId(season.id);
        setRecommendedSeasonAdjustmentInput(
          String(season.adjustmentPercent)
        );
      }}
      style={iconButtonStyle}
      title="Edit recommended season adjustment"
    >
      ✏️
    </button>
  </div>
)}
            
          </div>
        ))}
      </div>
    )}

    <div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
        Custom Seasons
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
        Property-specific seasons created by the host.
      </div>
    </div>

    <div
  style={{
    display: "grid",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  }}
>
  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>
    Add Custom Season
  </div>

  <div
    style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      alignItems: "end",
    }}
  >
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Season Name</div>
      <input
        value={newSeason.name}
        onChange={(e) =>
          setNewSeason((s) => ({ ...s, name: e.target.value }))
        }
        placeholder="Summer Peak"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Season Type</div>
  <select
    value={newSeason.type}
    onChange={(e) =>
      setNewSeason((s) => ({
        ...s,
        type: e.target.value as PropertySeasonType,
      }))
    }
    style={inputStyle}
  >
    <option value="PEAK">Peak Season</option>
    <option value="SHOULDER">Shoulder Season</option>
    <option value="LOW">Low Season</option>
  </select>
</div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Start Month</div>
      <input
        type="number"
        min="1"
        max="12"
        value={newSeason.startMonth}
        onChange={(e) =>
          setNewSeason((s) => ({ ...s, startMonth: e.target.value }))
        }
        placeholder="6"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Start Day</div>
      <input
        type="number"
        min="1"
        max="31"
        value={newSeason.startDay}
        onChange={(e) =>
          setNewSeason((s) => ({ ...s, startDay: e.target.value }))
        }
        placeholder="1"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>End Month</div>
      <input
        type="number"
        min="1"
        max="12"
        value={newSeason.endMonth}
        onChange={(e) =>
          setNewSeason((s) => ({ ...s, endMonth: e.target.value }))
        }
        placeholder="8"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>End Day</div>
      <input
        type="number"
        min="1"
        max="31"
        value={newSeason.endDay}
        onChange={(e) =>
          setNewSeason((s) => ({ ...s, endDay: e.target.value }))
        }
        placeholder="31"
        style={inputStyle}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Adjustment (%)</div>
      <input
        type="number"
        step="0.01"
        value={newSeason.adjustmentPercent}
        onChange={(e) =>
          setNewSeason((s) => ({
            ...s,
            adjustmentPercent: e.target.value,
          }))
        }
        placeholder="20"
        style={inputStyle}
      />
    </div>

    <button
      type="button"
      disabled={creatingSeason}
      onClick={async () => {
        try {
          await handleCreateSeason();
        } catch (e: any) {
          setErr(String(e?.message ?? e));
        }
      }}
      style={{
        ...primaryButtonStyle,
        opacity: creatingSeason ? 0.7 : 1,
        cursor: creatingSeason ? "not-allowed" : "pointer",
      }}
    >
      {creatingSeason ? "Adding..." : "Add"}
    </button>
  </div>
</div>

   {customSeasons.length === 0 ? (
  <div style={{ fontSize: 13, color: "#6b7280" }}>
    No custom seasons yet.
  </div>
) : (
  <div style={{ display: "grid", gap: 8 }}>
    {customSeasons.map((season) => (
      <div
        key={season.id}
        style={{
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          display: "grid",
          gap: 12,
        }}
      >
        {editingSeasonId === season.id ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={responsiveGridStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Season Name</div>
                <input
                  value={editingSeason?.name ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s ? { ...s, name: e.target.value } : s
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
  <div style={labelStyle}>Season Type</div>
  <select
    value={editingSeason?.type ?? "SHOULDER"}
    onChange={(e) =>
      setEditingSeason((s) =>
        s
          ? {
              ...s,
              type: e.target.value as PropertySeasonType,
            }
          : s
      )
    }
    style={inputStyle}
  >
    <option value="PEAK">Peak Season</option>
    <option value="SHOULDER">Shoulder Season</option>
    <option value="LOW">Low Season</option>
  </select>
</div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Start Month</div>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={editingSeason?.startMonth ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s
                        ? {
                            ...s,
                            startMonth: Number(e.target.value || 0),
                          }
                        : s
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Start Day</div>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editingSeason?.startDay ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s
                        ? {
                            ...s,
                            startDay: Number(e.target.value || 0),
                          }
                        : s
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>End Month</div>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={editingSeason?.endMonth ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s
                        ? {
                            ...s,
                            endMonth: Number(e.target.value || 0),
                          }
                        : s
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>End Day</div>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editingSeason?.endDay ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s
                        ? {
                            ...s,
                            endDay: Number(e.target.value || 0),
                          }
                        : s
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Adjustment (%)</div>
                <input
                  type="number"
                  step="0.01"
                  value={editingSeason?.adjustmentPercent ?? ""}
                  onChange={(e) =>
                    setEditingSeason((s) =>
                      s
                        ? {
                            ...s,
                            adjustmentPercent: Number(e.target.value || 0),
                          }
                        : s
                    )
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={savingSeason}
                onClick={async () => {
                  try {
                    await handleSaveSeason();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  }
                }}
                style={{
                  ...primarySmallButtonStyle,
                  opacity: savingSeason ? 0.7 : 1,
                  cursor: savingSeason ? "not-allowed" : "pointer",
                }}
              >
                {savingSeason ? "Saving..." : "Save"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSeasonId(null);
                  setEditingSeason(null);
                }}
                style={secondarySmallButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                {season.name}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  marginTop: 6,
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 900,
                  ...getSeasonTypeStyle(season.type),
                }}
              >
                {getSeasonTypeLabel(season.type)}
              </div>

              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {season.startMonth}/{season.startDay} → {season.endMonth}/
                {season.endDay}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#7c3aed" }}>
                {season.adjustmentPercent > 0 ? "+" : ""}
                {season.adjustmentPercent}%
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSeasonId(season.id);
                  setEditingSeason({ ...season });
                }}
                style={iconButtonStyle}
                title="Edit custom season"
              >
                ✏️
              </button>

              <button
                type="button"
                disabled={deletingSeasonId === season.id}
                onClick={async () => {
                  try {
                    await handleDeleteSeason(season.id);
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  }
                }}
                style={{
                  ...iconButtonStyle,
                  opacity: deletingSeasonId === season.id ? 0.5 : 1,
                  cursor:
                    deletingSeasonId === season.id
                      ? "not-allowed"
                      : "pointer",
                }}
                title="Delete custom season"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
)} 
  </div>
) : null}

 {form.holidayPricingEnabled ? (
  <div
    style={{
      borderTop: "1px solid #dbeafe",
      paddingTop: 16,
      display: "grid",
      gap: 14,
    }}
  >
    <div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
        Holiday Pricing
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
        Holiday windows automatically applied by Pin&Go.
      </div>
    </div>

    {holidayPricing.filter((holiday) => holiday.isActive).length === 0 ? (
      <div style={{ fontSize: 13, color: "#6b7280" }}>
        No holiday pricing applied yet.
      </div>
    ) : (
      <div style={{ display: "grid", gap: 8 }}>
        {holidayPricing
          .filter((holiday) => holiday.isActive)
          .map((holiday) => (
            <div
              key={holiday.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                  {holiday.name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {holiday.startMonth}/{holiday.startDay} → {holiday.endMonth}/
                  {holiday.endDay}
                </div>
              </div>
              {editingHolidayPricingId === holiday.id ? (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    }}
  >
    <input
      type="number"
      step="0.01"
      value={holidayPricingAdjustmentInput}
      onChange={(e) =>
        setHolidayPricingAdjustmentInput(e.target.value)
      }
      style={{
        ...inputStyle,
        width: 110,
      }}
    />

    <button
      type="button"
      disabled={savingHolidayPricingId === holiday.id}
      onClick={async () => {
        try {
          await handleSaveHolidayPricingAdjustment(holiday);
        } catch (e: any) {
          setErr(String(e?.message ?? e));
        }
      }}
      style={{
        ...primarySmallButtonStyle,
        opacity: savingHolidayPricingId === holiday.id ? 0.7 : 1,
        cursor:
          savingHolidayPricingId === holiday.id
            ? "not-allowed"
            : "pointer",
      }}
    >
      {savingHolidayPricingId === holiday.id ? "Saving..." : "Save"}
    </button>

    <button
      type="button"
      onClick={() => {
        setEditingHolidayPricingId(null);
        setHolidayPricingAdjustmentInput("");
      }}
      style={secondarySmallButtonStyle}
    >
      Cancel
    </button>
  </div>
) : (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 14, fontWeight: 900, color: "#b45309" }}>
      {holiday.adjustmentPercent > 0 ? "+" : ""}
      {holiday.adjustmentPercent}%
    </div>

    <button
      type="button"
      onClick={() => {
        setEditingHolidayPricingId(holiday.id);
        setHolidayPricingAdjustmentInput(
          String(holiday.adjustmentPercent)
        );
      }}
      style={iconButtonStyle}
      title="Edit holiday pricing adjustment"
    >
      ✏️
    </button>
  </div>
)}
              
            </div>
          ))}
      </div>
    )}
  </div>
) : null}

  <div
    style={{
      borderTop: "1px solid #dbeafe",
      paddingTop: 16,
      display: "grid",
      gap: 14,
    }}
  >
    <div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
        Lead Time Rule
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
        Adjust prices automatically when arrival is close.
      </div>
    </div>

    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        fontWeight: 800,
        color: "#111827",
      }}
    >
      <input
        type="checkbox"
        checked={form.leadTimePricingEnabled}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            leadTimePricingEnabled: e.target.checked,
          }))
        }
        disabled={!form.dynamicPricingEnabled}
      />
      Enable Lead Time Rule
    </label>

    <div style={responsiveGridStyle}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Last Minute Window</div>
        <input
          type="number"
          min="1"
          value={form.leadTimeLastMinuteDays}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              leadTimeLastMinuteDays: e.target.value,
            }))
          }
          placeholder="3"
          style={inputStyle}
          disabled={!form.dynamicPricingEnabled || !form.leadTimePricingEnabled}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={labelStyle}>Adjustment (%)</div>
        <input
          type="number"
          step="0.01"
          value={form.leadTimeLastMinutePercent}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              leadTimeLastMinutePercent: e.target.value,
            }))
          }
          placeholder="-15"
          style={inputStyle}
          disabled={!form.dynamicPricingEnabled || !form.leadTimePricingEnabled}
        />
      </div>
    </div>
  </div>
<div
  style={{
    borderTop: "1px solid #dbeafe",
    paddingTop: 16,
    display: "grid",
    gap: 14,
  }}
>
  <div>
    <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
      Occupancy Rule
    </div>
    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
      Adjust prices based on upcoming occupancy.
    </div>
  </div>

  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 14,
      fontWeight: 800,
      color: "#111827",
    }}
  >
    <input
      type="checkbox"
      checked={form.occupancyPricingEnabled}
      onChange={(e) =>
        setForm((s) => ({
          ...s,
          occupancyPricingEnabled: e.target.checked,
        }))
      }
      disabled={!form.dynamicPricingEnabled}
    />
    Enable Occupancy Rule
  </label>

  <div style={responsiveGridStyle}>
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Lookahead Window</div>
      <input
        type="number"
        min="1"
        value={form.occupancyLookaheadDays}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            occupancyLookaheadDays: e.target.value,
          }))
        }
        placeholder="30"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled || !form.occupancyPricingEnabled}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Low Occupancy Threshold (%)</div>
      <input
        type="number"
        step="0.01"
        value={form.occupancyLowThresholdPercent}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            occupancyLowThresholdPercent: e.target.value,
          }))
        }
        placeholder="35"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled || !form.occupancyPricingEnabled}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>Low Occupancy Adjustment (%)</div>
      <input
        type="number"
        step="0.01"
        value={form.occupancyLowAdjustmentPercent}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            occupancyLowAdjustmentPercent: e.target.value,
          }))
        }
        placeholder="-10"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled || !form.occupancyPricingEnabled}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>High Occupancy Threshold (%)</div>
      <input
        type="number"
        step="0.01"
        value={form.occupancyHighThresholdPercent}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            occupancyHighThresholdPercent: e.target.value,
          }))
        }
        placeholder="85"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled || !form.occupancyPricingEnabled}
      />
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>High Occupancy Adjustment (%)</div>
      <input
        type="number"
        step="0.01"
        value={form.occupancyHighAdjustmentPercent}
        onChange={(e) =>
          setForm((s) => ({
            ...s,
            occupancyHighAdjustmentPercent: e.target.value,
          }))
        }
        placeholder="10"
        style={inputStyle}
        disabled={!form.dynamicPricingEnabled || !form.occupancyPricingEnabled}
      />
    </div>
  </div>
</div>

</div>
          <div
            style={{
              borderTop: "1px solid #bfdbfe",
              paddingTop: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                Amenities & Fees
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Add included amenities or configurable fees such as pet fees,
                parking, or resort fees.
              </div>
            </div>

            {amenities.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No amenities or fees configured yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {amenities.map((amenity) => (
                  <div
                    key={amenity.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #dbeafe",
                    }}
                  >
                    {editingAmenityId === amenity.id ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <input
                          value={editingAmenity?.name ?? ""}
                          onChange={(e) =>
                            setEditingAmenity((s) =>
                              s ? { ...s, name: e.target.value } : s
                            )
                          }
                          placeholder="Amenity name"
                          style={inputStyle}
                        />

                        <input
                          value={editingAmenity?.description ?? ""}
                          onChange={(e) =>
                            setEditingAmenity((s) =>
                              s ? { ...s, description: e.target.value } : s
                            )
                          }
                          placeholder="Description"
                          style={inputStyle}
                        />

                        <div style={responsiveGridStyle}>
                          <select
                            value={editingAmenity?.chargeMode ?? "INCLUDED"}
                            onChange={(e) =>
                              setEditingAmenity((s) =>
                                s
                                  ? {
                                      ...s,
                                      chargeMode:
                                        e.target.value as AmenityChargeMode,
                                    }
                                  : s
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="INCLUDED">Included</option>
                            <option value="REQUIRED">Required</option>
                            <option value="OPTIONAL">Optional</option>
                          </select>

                          <select
                            value={editingAmenity?.feeType ?? "PER_STAY"}
                            onChange={(e) =>
                              setEditingAmenity((s) =>
                                s
                                  ? {
                                      ...s,
                                      feeType: e.target.value as AmenityFeeType,
                                    }
                                  : s
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="PER_STAY">Per stay</option>
                            <option value="PER_NIGHT">Per night</option>
                          </select>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingAmenity?.amount ?? ""}
                            onChange={(e) =>
                              setEditingAmenity((s) =>
                                s ? { ...s, amount: e.target.value } : s
                              )
                            }
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleSaveAmenity();
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={primarySmallButtonStyle}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingAmenityId(null);
                              setEditingAmenity(null);
                            }}
                            style={secondarySmallButtonStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            {amenity.name}
                          </div>

                          {amenity.description ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                marginTop: 2,
                              }}
                            >
                              {amenity.description}
                            </div>
                          ) : null}

                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginTop: 2,
                            }}
                          >
                            {amenity.chargeMode === "INCLUDED"
                              ? "Included"
                              : amenity.chargeMode === "REQUIRED"
                              ? "Required"
                              : "Optional"}{" "}
                            •{" "}
                            {amenity.feeType === "PER_NIGHT"
                              ? "Per night"
                              : "Per stay"}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            ${Number(amenity.amount ?? 0).toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingAmenityId(amenity.id);
                              setEditingAmenity({ ...amenity });
                            }}
                            style={iconButtonStyle}
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleDeleteAmenity(amenity.id);
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={iconButtonStyle}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns:
                  "minmax(180px, 1fr) minmax(180px, 1fr) 160px 160px 140px auto",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Amenity / Fee Name</div>
                <input
                  value={newAmenity.name}
                  onChange={(e) =>
                    setNewAmenity((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Pet Fee"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Description</div>
                <input
                  value={newAmenity.description}
                  onChange={(e) =>
                    setNewAmenity((s) => ({ ...s, description: e.target.value }))
                  }
                  placeholder="Shown to guests"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Charge Mode</div>
                <select
                  value={newAmenity.chargeMode}
                  onChange={(e) =>
                    setNewAmenity((s) => ({
                      ...s,
                      chargeMode: e.target.value as AmenityChargeMode,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="INCLUDED">Included</option>
                  <option value="REQUIRED">Required</option>
                  <option value="OPTIONAL">Optional</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Type</div>
                <select
                  value={newAmenity.feeType}
                  onChange={(e) =>
                    setNewAmenity((s) => ({
                      ...s,
                      feeType: e.target.value as AmenityFeeType,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="PER_STAY">Per stay</option>
                  <option value="PER_NIGHT">Per night</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Amount</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newAmenity.amount}
                  onChange={(e) =>
                    setNewAmenity((s) => ({ ...s, amount: e.target.value }))
                  }
                  placeholder="75.00"
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleCreateAmenity();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  }
                }}
                style={primaryButtonStyle}
              >
                Add
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #bfdbfe",
              paddingTop: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                Property Taxes
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Add tax percentages that should be applied to direct booking
                reservations.
              </div>
            </div>

            {taxes.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No taxes configured yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {taxes.map((tax) => (
                  <div
                    key={tax.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #dbeafe",
                    }}
                  >
                    {editingTaxId === tax.id ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={responsiveGridStyle}>
                          <input
                            value={editingTax?.name ?? ""}
                            onChange={(e) =>
                              setEditingTax((s) =>
                                s ? { ...s, name: e.target.value } : s
                              )
                            }
                            placeholder="Tax name"
                            style={inputStyle}
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingTax?.percentage ?? ""}
                            onChange={(e) =>
                              setEditingTax((s) =>
                                s ? { ...s, percentage: e.target.value } : s
                              )
                            }
                            placeholder="11.5"
                            style={inputStyle}
                          />
                        </div>
                          

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleSaveTax();
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={primarySmallButtonStyle}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaxId(null);
                              setEditingTax(null);
                            }}
                            style={secondarySmallButtonStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            {tax.name}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginTop: 2,
                            }}
                          >
                            Applied to direct booking pricing
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#111827",
                            }}
                          >
                            {Number(tax.percentage ?? 0).toFixed(2)}%
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaxId(tax.id);
                              setEditingTax({ ...tax });
                            }}
                            style={iconButtonStyle}
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleDeleteTax(tax.id);
                              } catch (e: any) {
                                setErr(String(e?.message ?? e));
                              }
                            }}
                            style={iconButtonStyle}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "minmax(180px, 1fr) 180px auto",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Tax Name</div>
                <input
                  value={newTax.name}
                  onChange={(e) =>
                    setNewTax((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Room Tax"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelStyle}>Percentage</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTax.percentage}
                  onChange={(e) =>
                    setNewTax((s) => ({ ...s, percentage: e.target.value }))
                  }
                  placeholder="11.5"
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleCreateTax();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  }
                }}
                style={primaryButtonStyle}
              >
                Add Tax
              </button>
            </div>
         


          </div>

          </div>
<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 4,
  }}
>
  <button
    type="button"
    onClick={() => navigate("/properties")}
    style={secondaryButtonStyle}
  >
    Cancel
  </button>

  
  <button
    type="submit"
    disabled={saving}
    style={{
      ...primaryButtonStyle,
      opacity: saving ? 0.7 : 1,
      cursor: saving ? "not-allowed" : "pointer",
    }}
  >
    {saving ? "Saving..." : "Save Changes"}
  </button>
</div>
      
        </form>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  display: "grid",
  gap: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginTop: 4,
  lineHeight: 1.5,
};

const statusBadgeStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  cursor: "pointer",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
};

const responsiveGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const primarySmallButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const iconButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
};
