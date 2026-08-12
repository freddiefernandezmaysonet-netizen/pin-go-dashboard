import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProperty } from "../../api/properties";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_SCRIPT_ID = "pin-go-google-maps";

type GoogleMapsWindow = Window & {
  google?: any;
};

let googleMapsLoader: Promise<any> | null = null;

function loadGooglePlaces(apiKey: string) {
  const mapsWindow = window as GoogleMapsWindow;

  if (mapsWindow.google?.maps) {
    return mapsWindow.google.maps.importLibrary("places").then(() => mapsWindow.google);
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

        await mapsWindow.google.maps.importLibrary("places");
        resolve(mapsWindow.google);
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

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placesAvailable, setPlacesAvailable] = useState(Boolean(GOOGLE_MAPS_API_KEY));
  const [locationMessage, setLocationMessage] = useState(
    GOOGLE_MAPS_API_KEY ? "" : "Google Places is unavailable. Enter the address manually."
  );

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
              handleCountryChange(nextCountry);
            }

            if (nextRegion) {
              setRegion(nextRegion);
            } else if (nextCountry && nextCountry !== "Puerto Rico") {
              setRegion("");
            }

            if (place.location) {
              setLatitude(String(place.location.lat()));
              setLongitude(String(place.location.lng()));
            }
          } catch {
            autocompleteElement?.remove();
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
                <option value="America/Puerto_Rico">America/Puerto_Rico</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="America/Toronto">America/Toronto</option>
                <option value="America/Mexico_City">America/Mexico_City</option>
                <option value="America/Santo_Domingo">America/Santo_Domingo</option>
                <option value="Europe/Madrid">Europe/Madrid</option>
                <option value="Europe/London">Europe/London</option>
              </select>
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
            disabled={submitting}
            style={{
              height: 46,
              borderRadius: 12,
              border: "none",
              background: submitting ? "#93c5fd" : "#2563eb",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
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
