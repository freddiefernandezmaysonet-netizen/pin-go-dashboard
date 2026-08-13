import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProperty } from "../../api/properties";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const GOOGLE_MAPS_SCRIPT_ID = "pin-go-google-maps";
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const TIMEZONE_OPTIONS = [
  "America/Puerto_Rico",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Santo_Domingo",
  "Europe/Madrid",
  "Europe/London",
];

type GoogleMapsWindow = Window & {
  google?: any;
};

let googleMapsLoader: Promise<any> | null = null;

async function importGoogleMapsLibraries(google: any) {
  await Promise.all([
    google.maps.importLibrary("places"),
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("marker"),
  ]);

  return google;
}

function loadGooglePlaces(apiKey: string) {
  const mapsWindow = window as GoogleMapsWindow;

  if (mapsWindow.google?.maps) {
    return importGoogleMapsLibraries(mapsWindow.google);
  }

  if (googleMapsLoader) {
    return googleMapsLoader;
  }

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

        resolve(
          await importGoogleMapsLibraries(
            mapsWindow.google
          )
        );
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

export default function CreatePropertyPage() {
  const navigate = useNavigate();
  const autocompleteMountRef = useRef<HTMLDivElement>(null);
  const mapMountRef = useRef<HTMLDivElement>(null);
  const googleMapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);
  const timezoneLookupIdRef = useRef(0);

  const [name, setName] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("America/Puerto_Rico");
  const [checkInTime, setCheckInTime] = useState<"15:00" | "16:00">("15:00");
  const [cleaningStartOffsetMinutes, setCleaningStartOffsetMinutes] = useState("30");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placesAvailable, setPlacesAvailable] = useState(Boolean(GOOGLE_MAPS_API_KEY));
  const [locationMessage, setLocationMessage] = useState(
    GOOGLE_MAPS_API_KEY ? "" : "Google Places is unavailable. Enter the address manually."
  );
  const [timezoneLookupMessage, setTimezoneLookupMessage] = useState("");

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);

    if (nextCountry === "Puerto Rico") {
      setRegion("Puerto Rico");
      setTimezone("America/Puerto_Rico");
    } else if (nextCountry === "Dominican Republic") {
      setTimezone("America/Santo_Domingo");
    } else if (nextCountry === "Spain") {
      setTimezone("Europe/Madrid");
    } else if (nextCountry === "United Kingdom") {
      setTimezone("Europe/London");
    }
  }

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      return;
    }

    let cancelled = false;
    let autocompleteElement: HTMLElement | null = null;
    let selectHandler: ((event: Event) => void) | null = null;

    loadGooglePlaces(GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (cancelled || !autocompleteMountRef.current) {
          return;
        }

        googleMapsRef.current = google;

        autocompleteElement = new google.maps.places.PlaceAutocompleteElement();
        (autocompleteElement as any).placeholder = "Search for the property address";
        autocompleteElement.style.width = "100%";

        selectHandler = async (event: Event) => {
          try {
            const placePrediction = (event as any).placePrediction;
            const place = placePrediction.toPlace();

            await place.fetchFields({
              fields: ["formattedAddress", "addressComponents", "location"],
            });

            if (cancelled) {
              return;
            }

            setLocationConfirmed(false);

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

            if (place.formattedAddress) {
              setAddress1(place.formattedAddress);
            }

            setCity(nextCity);

            if (nextCountry) {
              setCountry(nextCountry);
            }

            if (nextCountry === "Puerto Rico") {
              setRegion("Puerto Rico");
            } else if (nextRegion) {
              setRegion(nextRegion);
            } else if (nextCountry) {
              setRegion("");
            }

            if (place.location) {
              const nextLatitude = place.location.lat();
              const nextLongitude = place.location.lng();
              const lookupId = ++timezoneLookupIdRef.current;

              setLatitude(String(nextLatitude));
              setLongitude(String(nextLongitude));
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
                  setTimezone(resolvedTimezone);
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
            } else {
              setLatitude("");
              setLongitude("");
            }
          } catch {
            autocompleteElement?.remove();
            setLatitude("");
            setLongitude("");
            setLocationConfirmed(false);
            setPlacesAvailable(false);
            setLocationMessage(
              "Google Places could not load this location. Enter the address manually."
            );
          }
        };

        autocompleteElement.addEventListener("gmp-select", selectHandler);
        autocompleteMountRef.current.replaceChildren(autocompleteElement);
      })
      .catch(() => {
        if (!cancelled) {
          setPlacesAvailable(false);
          setLocationMessage(
            "Google Places is unavailable. Enter the address manually."
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
  }, []);

  useEffect(() => {
    const google = googleMapsRef.current;
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !google?.maps ||
      !GOOGLE_MAPS_MAP_ID ||
      !mapMountRef.current ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      latitude.trim() === "" ||
      longitude.trim() === ""
    ) {
      return;
    }

    const position = { lat, lng };

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(
        mapMountRef.current,
        {
          center: position,
          zoom: 18,
          mapId: GOOGLE_MAPS_MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }
      );

      mapMarkerRef.current =
        new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position,
          title: address1 || "Property location",
        });

      return;
    }

    mapRef.current.setCenter(position);
    mapRef.current.setZoom(18);

    if (mapMarkerRef.current) {
      mapMarkerRef.current.position = position;
      mapMarkerRef.current.title =
        address1 || "Property location";
    }
  }, [address1, latitude, longitude]);

  const hasSelectedLocation =
    latitude.trim() !== "" && longitude.trim() !== "";
  const requiresLocationConfirmation =
    placesAvailable && hasSelectedLocation;
  const submitDisabled =
    submitting ||
    (requiresLocationConfirmation && !locationConfirmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const lat = latitude.trim() === "" ? null : Number(latitude);
      const lng = longitude.trim() === "" ? null : Number(longitude);

      if ((lat === null) !== (lng === null)) {
        throw new Error("Latitude and longitude must be provided together");
      }

      if (lat !== null && !Number.isFinite(lat)) {
        throw new Error("Latitude must be a valid number");
      }

      if (lng !== null && !Number.isFinite(lng)) {
        throw new Error("Longitude must be a valid number");
      }

      if (
        lat !== null &&
        lng !== null &&
        !locationConfirmed
      ) {
        throw new Error(
          "Confirm the property location on the map before continuing"
        );
      }

      await createProperty({
        name,
        address1,
        city,
        region,
        country,
        timezone,
        checkInTime,
        cleaningStartOffsetMinutes: Number(cleaningStartOffsetMinutes),
        latitude: lat,
        longitude: lng,
      });

      navigate("/integrations/ttlock");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
          padding: 28,
          display: "grid",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 6,
            }}
          >
            Create property
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            Add a property to Pin&Go.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Property name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beach Villa"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            {placesAvailable ? (
              <div ref={autocompleteMountRef} />
            ) : (
              <input
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder="Optional"
                style={inputStyle}
              />
            )}
            {locationMessage ? (
              <div style={locationMessageStyle}>{locationMessage}</div>
            ) : null}
          </div>

          <div
            style={{
              display:
                requiresLocationConfirmation
                  ? "grid"
                  : "none",
              gap: 12,
              border: "1px solid #dbeafe",
              borderRadius: 16,
              background: "#f8fbff",
              padding: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: "#111827",
                  fontSize: 15,
                  fontWeight: 750,
                }}
              >
                Confirm property location
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginTop: 3,
                }}
              >
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

            <div
              style={{
                color: "#374151",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {address1}
            </div>

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
                ✓ Location confirmed
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setLocationConfirmed(true)
                }
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #2563eb",
                  background: "#ffffff",
                  color: "#1d4ed8",
                  fontSize: 13,
                  fontWeight: 750,
                  cursor: "pointer",
                }}
              >
                Confirm location
              </button>
            )}
          </div>

          <div style={twoColGridStyle}>
            <div>
              <label style={labelStyle}>City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Region</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={twoColGridStyle}>
            <div>
              <label style={labelStyle}>Country</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a country</option>
                <option value="United States">United States</option>
                <option value="Puerto Rico">Puerto Rico</option>
                <option value="Canada">Canada</option>
                <option value="Mexico">Mexico</option>
                <option value="Spain">Spain</option>
                <option value="Dominican Republic">Dominican Republic</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={inputStyle}
              >
                {!TIMEZONE_OPTIONS.includes(timezone) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {timezoneLookupMessage ? (
                <div style={locationMessageStyle}>{timezoneLookupMessage}</div>
              ) : null}
            </div>
          </div>

          <div style={twoColGridStyle}>
            <div>
              <label style={labelStyle}>Guest check-in time</label>
              <select
                value={checkInTime}
                onChange={(e) =>
                  setCheckInTime(e.target.value as "15:00" | "16:00")
                }
                style={inputStyle}
              >
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Cleaning start offset (minutes)</label>
              <select
                value={cleaningStartOffsetMinutes}
                onChange={(e) => setCleaningStartOffsetMinutes(e.target.value)}
                style={inputStyle}
              >
                <option value="0">0 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>
          </div>

          <div style={infoBoxStyle}>
            {checkInTime === "15:00"
              ? "Check-in at 3:00 PM sets cleaning duration to 180 minutes."
              : "Check-in at 4:00 PM sets cleaning duration to 240 minutes."}
          </div>

          {error ? <div style={errorBoxStyle}>{error}</div> : null}

          <button
            type="submit"
            disabled={submitDisabled}
            style={{
              height: 46,
              borderRadius: 12,
              border: "none",
              background: submitDisabled ? "#93c5fd" : "#2563eb",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitDisabled ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {submitting ? "Creating..." : "Create Property"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  background: "#ffffff",
};

const twoColGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
};

const infoBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#4b5563",
  fontSize: 13,
};

const errorBoxStyle: React.CSSProperties = {
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontSize: 13,
  padding: "10px 12px",
};

const locationMessageStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 12,
};
