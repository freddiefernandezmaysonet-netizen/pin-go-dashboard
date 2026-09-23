import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RoomLayoutEditor } from "./RoomLayoutEditor";
import { type ListingDetailsForm, type PermissionState, type TriState } from "./propertyListingDetails.types";
import { buildListingDetailsPayload, emptyListingDetails, requestListingDetails } from "./propertyListingDetails.form";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const input: CSSProperties = {
  width: "100%", border: "1px solid #d1d5db", borderRadius: 10,
  padding: "10px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff",
};
const grid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(210px,100%),1fr))", gap: 12,
};
const section: CSSProperties = {
  borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12,
};
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>{label}</span>{children}</label>
);
const Tri = ({ value, onChange }: { value: TriState; onChange: (value: TriState) => void }) => (
  <select style={input} value={value} onChange={(event) => onChange(event.target.value as TriState)}>
    <option value="UNKNOWN">Not confirmed</option><option value="YES">Yes</option><option value="NO">No</option>
  </select>
);
const Perm = ({ value, onChange }: { value: PermissionState; onChange: (value: PermissionState) => void }) => (
  <select style={input} value={value} onChange={(event) => onChange(event.target.value as PermissionState)}>
    <option value="UNKNOWN">Not confirmed</option><option value="ALLOWED">Allowed</option><option value="NOT_ALLOWED">Not allowed</option>
  </select>
);
type Props = { propertyId: string; maxGuests?: number | null };

export function PropertyListingDetailsCard(props: Props) {
  // A different property must never inherit another property's in-memory form or request.
  return <ListingDetailsEditor key={props.propertyId} {...props} />;
}

function ListingDetailsEditor({ propertyId, maxGuests }: Props) {
  const [form, setForm] = useState<ListingDetailsForm>(emptyListingDetails);
  const [version, setVersion] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saveRequest = useRef<AbortController | null>(null);
  const url = `${API_BASE}/api/dashboard/properties/${encodeURIComponent(propertyId)}/listing-details`;

  function set<K extends keyof ListingDetailsForm>(key: K, value: ListingDetailsForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Clear dependent fields only after the host explicitly changes their parent answer.
      if (key === "parkingAvailability" && value !== "YES") {
        next.parkingType = ""; next.parkingFeeType = ""; next.parkingVehicleCapacity = "";
      }
      if (key === "quietHoursEnabled" && value !== "YES") { next.quietHoursStart = ""; next.quietHoursEnd = ""; }
      if (key === "exteriorSecurityCameras" && value !== "YES") {
        next.exteriorSecurityCamerasDisclosureEn = ""; next.exteriorSecurityCamerasDisclosureEs = "";
      }
      if (key === "animalsOnProperty" && value !== "YES") { next.animalsOnPropertyDisclosureEn = ""; next.animalsOnPropertyDisclosureEs = ""; }
      if (key === "stepFreeEntrance" && value === "YES") next.entranceStepCount = "0";
      return next;
    });
    setMessage("");
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading"); setError(""); setMessage("");
    void requestListingDetails(fetch, url, propertyId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setForm(result.form); setVersion(result.version); setLoadState("ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Failed to load listing details.");
        setLoadState("error");
      });
    return () => {
      controller.abort();
      saveRequest.current?.abort();
    };
  }, [propertyId, url, retry]);

  async function save() {
    if (loadState !== "ready" || saveRequest.current) return;
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = buildListingDetailsPayload(form);
      const result = await requestListingDetails(fetch, url, propertyId, controller.signal, payload);
      if (controller.signal.aborted) return;
      setForm(result.form); setVersion(result.version); setMessage("Listing details saved.");
    } catch (cause: unknown) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Failed to save listing details.");
    } finally {
      if (saveRequest.current === controller) saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  if (loadState === "loading") return <div role="status" style={{ padding: 18, border: "1px solid #bfdbfe", borderRadius: 18 }}>Loading accommodation details...</div>;
  if (loadState === "error") return (
    <div style={{ padding: 18, border: "1px solid #fecaca", borderRadius: 18 }}>
      <p role="alert">{error} Existing information has not been changed. Reload before editing.</p>
      <button type="button" onClick={() => setRetry((attempt) => attempt + 1)}>Retry loading listing details</button>
    </div>
  );
  const facts: [string, "bedroomCount" | "fullBathroomCount" | "halfBathroomCount" | "minimumPrimaryBookingGuestAge", string][] = [
    ["Bedrooms", "bedroomCount", "2"], ["Full bathrooms", "fullBathroomCount", "1"],
    ["Half bathrooms", "halfBathroomCount", "0"], ["Minimum primary booking guest age", "minimumPrimaryBookingGuestAge", "21"],
  ];
  const permissions = [
    ["Children", "childrenPolicy"], ["Infants", "infantsPolicy"], ["Pets", "petsPolicy"], ["Smoking", "smokingPolicy"],
    ["Vaping", "vapingPolicy"], ["Parties / events", "eventsPolicy"], ["Unregistered visitors", "unregisteredVisitorsPolicy"],
  ] as const;
  const safety = [
    ["Smoke detector", "smokeDetector"], ["Carbon monoxide detector", "carbonMonoxideDetector"],
    ["Elevator available", "elevatorAvailable"], ["Accessible parking", "accessibleParking"],
    ["Step-free bedroom access", "stepFreeBedroomAccess"], ["Step-free bathroom access", "stepFreeBathroomAccess"],
    ["Step-free shower", "stepFreeShower"],
  ] as const;

  return <div style={{ border: "1px solid #bfdbfe", borderRadius: 18, padding: 18, background: "#fff", display: "grid", gap: 18 }}>
    <div><div style={{ fontSize: 17, fontWeight: 900 }}>Accommodation & guest requirements</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Confirm factual listing information once. Unconfirmed answers remain unknown instead of becoming guest-facing claims.</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Capacity: {maxGuests ?? "not configured"} guests · {version ? `Listing details V${version}` : "Not configured yet"}</div>
      <p style={{ fontSize: 12, color: "#64748b" }}>Use “Save accommodation details” for this section. Other property settings are saved separately.</p>
    </div>
    {error ? <div role="alert" style={{ padding: 10, borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{error}</div> : null}
    {message ? <div role="status" style={{ padding: 10, borderRadius: 10, background: "#f0fdf4", color: "#166534", fontSize: 13 }}>{message}</div> : null}
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 18 }} onKeyDown={(event) => {
      const target = event.target as HTMLElement;
      if (event.key === "Enter" && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
        event.preventDefault(); event.stopPropagation();
      }
    }}>
      <legend style={{ fontSize: 13, fontWeight: 700 }}>Edit listing details</legend>
      <div style={section}><b>Property facts</b><div style={grid}>
        <Field label="Accommodation type"><select style={input} value={form.accommodationType} onChange={(e) => set("accommodationType", e.target.value as ListingDetailsForm["accommodationType"])}>
          <option value="">Not confirmed</option><option value="ENTIRE_PLACE">Entire place</option><option value="PRIVATE_ROOM">Private room</option><option value="SHARED_ROOM">Shared room</option>
        </select></Field>
        {facts.map(([label, key, placeholder]) => <Field key={key} label={label}><input style={input} type="number" min={key === "minimumPrimaryBookingGuestAge" ? 18 : 0} max={key === "minimumPrimaryBookingGuestAge" ? 99 : 100} step="1" placeholder={placeholder} value={form[key]} onChange={(e) => set(key, e.target.value)} /></Field>)}
      </div></div>
      <div style={section}><RoomLayoutEditor value={form.sleepingAreas} onChange={(value) => set("sleepingAreas", value)} /></div>
      <div style={section}><b>Guest eligibility & house rules</b><div style={grid}>
        <Field label="Adults only"><Tri value={form.adultsOnly} onChange={(value) => set("adultsOnly", value)} /></Field>
        {permissions.map(([label, key]) => <Field key={key} label={label}><Perm value={form[key]} onChange={(value) => set(key, value)} /></Field>)}
        <Field label="Quiet hours"><Tri value={form.quietHoursEnabled} onChange={(value) => set("quietHoursEnabled", value)} /></Field>
        {form.quietHoursEnabled === "YES" ? <><Field label="Quiet hours start"><input style={input} type="time" value={form.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} /></Field><Field label="Quiet hours end"><input style={input} type="time" value={form.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} /></Field></> : null}
      </div></div>
      <div style={section}><b>Parking, safety & accessibility</b><div style={grid}>
        <Field label="Parking available"><Tri value={form.parkingAvailability} onChange={(value) => set("parkingAvailability", value)} /></Field>
        {form.parkingAvailability === "YES" ? <><Field label="Parking type"><select style={input} value={form.parkingType} onChange={(e) => set("parkingType", e.target.value as ListingDetailsForm["parkingType"])}><option value="">Not confirmed</option>{["PRIVATE", "GARAGE", "DRIVEWAY", "STREET", "LOT", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Parking fee"><select style={input} value={form.parkingFeeType} onChange={(e) => set("parkingFeeType", e.target.value as ListingDetailsForm["parkingFeeType"])}><option value="">Not confirmed</option><option value="FREE">Free</option><option value="PAID">Paid</option><option value="UNKNOWN">Unknown</option></select></Field><Field label="Vehicle capacity"><input style={input} type="number" min="0" max="100" step="1" value={form.parkingVehicleCapacity} onChange={(e) => set("parkingVehicleCapacity", e.target.value)} /></Field></> : null}
        <Field label="Step-free entrance"><Tri value={form.stepFreeEntrance} onChange={(value) => set("stepFreeEntrance", value)} /></Field>
        {form.stepFreeEntrance === "NO" ? <Field label="Entrance step count"><input style={input} type="number" min="0" max="1000" step="1" value={form.entranceStepCount} onChange={(e) => set("entranceStepCount", e.target.value)} /></Field> : null}
        {safety.map(([label, key]) => <Field key={key} label={label}><Tri value={form[key]} onChange={(value) => set(key, value)} /></Field>)}
        <Field label="Exterior security cameras"><Tri value={form.exteriorSecurityCameras} onChange={(value) => set("exteriorSecurityCameras", value)} /></Field>
        <Field label="Animals on property"><Tri value={form.animalsOnProperty} onChange={(value) => set("animalsOnProperty", value)} /></Field>
      </div>
      {form.exteriorSecurityCameras === "YES" ? <div style={grid}><Field label="Camera disclosure (English)"><textarea style={input} maxLength={2000} value={form.exteriorSecurityCamerasDisclosureEn} onChange={(e) => set("exteriorSecurityCamerasDisclosureEn", e.target.value)} /></Field><Field label="Divulgación de cámaras (Español)"><textarea style={input} maxLength={2000} value={form.exteriorSecurityCamerasDisclosureEs} onChange={(e) => set("exteriorSecurityCamerasDisclosureEs", e.target.value)} /></Field></div> : null}
      {form.animalsOnProperty === "YES" ? <div style={grid}><Field label="Animals disclosure (English)"><textarea style={input} maxLength={2000} value={form.animalsOnPropertyDisclosureEn} onChange={(e) => set("animalsOnPropertyDisclosureEn", e.target.value)} /></Field><Field label="Divulgación de animales (Español)"><textarea style={input} maxLength={2000} value={form.animalsOnPropertyDisclosureEs} onChange={(e) => set("animalsOnPropertyDisclosureEs", e.target.value)} /></Field></div> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" disabled={saving || loadState !== "ready"} onClick={() => void save()} style={{ border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 900, background: "#111827", color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save accommodation details"}
        </button>
      </div>
    </fieldset>
  </div>;
}
