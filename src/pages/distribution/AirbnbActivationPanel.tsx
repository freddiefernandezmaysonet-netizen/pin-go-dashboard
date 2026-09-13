import { useEffect, useRef, useState } from "react";
import { activateAirbnbForHost, inspectAirbnbActivation, verifyAirbnbActivationForHost, AirbnbHostSelfServiceApiError, type AirbnbActivationState } from "../../api/airbnbHostSelfService";

export default function AirbnbActivationPanel(props: {
  propertyId: string;
  mappingRevision: string;
  onMapped(propertyId: string): void;
  onActivated(): Promise<void>;
}) {
  const { propertyId, mappingRevision, onMapped, onActivated } = props;
  const [state, setState] = useState<AirbnbActivationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);
    inspectAirbnbActivation(propertyId).then(result => {
      if (cancelled) return;
      setState(result);
      if (result.mappingId) onMapped(propertyId);
    }).catch(caught => {
      if (cancelled) return;
      setError(caught instanceof AirbnbHostSelfServiceApiError && caught.code.includes("SHARED_CHANNEL_SCOPE")
        ? "This Airbnb connection includes other properties or rates. Contact support to review activation for the whole connection."
        : "We couldn't verify Airbnb activation. Check the connection status before continuing.");
    });
    return () => { cancelled = true; };
  }, [propertyId, mappingRevision, onMapped, refresh]);

  async function activate() {
    if (!state || state.status !== "READY" || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await activateAirbnbForHost(propertyId, state);
      if (!mounted.current) return;
      setState({ ...state, status: "ACTIVE" });
      await onActivated();
    } catch {
      if (!mounted.current) return;
      setState(null);
      setError("Activation could not be confirmed. Check status before taking another action.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function verifyActivation() {
    if (!state || state.status !== "CHECK_REQUIRED" || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyAirbnbActivationForHost(propertyId, state);
      if (!mounted.current) return;
      setState({ ...state, status: "ACTIVE" });
      await onActivated();
    } catch {
      if (!mounted.current) return;
      setState(null);
      setError("Airbnb activation is not confirmed yet. Check the status again before taking another action.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const buttonStyle = { border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 600, background: "#111827", color: "white", cursor: busy ? "wait" : "pointer" };
  return <section aria-label="Airbnb activation" style={{ display: "grid", gap: 10 }}>
    {!state && !error && <p role="status">Checking Airbnb connection…</p>}
    {error && <p role="alert">{error}</p>}
    {state?.status === "READY" && <>
      <p style={{ margin: 0 }}>Your Airbnb property mapping is verified. Activation starts sending availability, rates and restrictions to Airbnb and receiving reservations.</p>
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => void activate()}>{busy ? "Activating Airbnb…" : "Activate Airbnb"}</button>
    </>}
    {state?.status === "ACTIVE" && <p role="status" style={{ color: "#065f46" }}>Airbnb activation confirmed.</p>}
    {state?.status === "NOT_READY" && <p>{state.reason === "FULL_SYNC_REQUIRED"
      ? "Sync availability & rates and wait for confirmation before activating Airbnb."
      : state.reason === "MAPPING_REQUIRED"
        ? "Airbnb is still processing the property mapping. Wait a moment, then check the connection status."
        : "Airbnb activation is not ready yet. Check the connection status before continuing."}</p>}
    {state?.status === "CHECK_REQUIRED" && <p role="status">An activation request is awaiting verification. Check status to verify the result.</p>}
    {state?.status === "CHECK_REQUIRED" &&
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => void verifyActivation()}>{busy ? "Checking activation…" : "Check activation status"}</button>}
    {((error && state?.status !== "CHECK_REQUIRED") || state?.status === "NOT_READY") &&
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => setRefresh(n => n + 1)}>Check connection status</button>}
  </section>;
}
