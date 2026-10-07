import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPinAIProperty, setPinAIProperty, PinAIActivationError } from "../../api/pinAIActivation";

// Match the property settings cards without relying on generated utility CSS.
const paragraphStyle: CSSProperties = { margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.6 };
const checkboxStyle: CSSProperties = { width: 20, height: 20, flexShrink: 0, margin: "2px 0 0", accentColor: "#1d4ed8" };
const labelStyle: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, fontSize: 14, lineHeight: 1.6 };
function buttonStyle(disabled: boolean, primary = false): CSSProperties {
  return { minHeight: 44, maxWidth: "100%", padding: "10px 16px", border: `1px solid ${primary ? "#1d4ed8" : "#cbd5e1"}`,
    borderRadius: 8, background: primary ? "#1d4ed8" : "#fff", color: primary ? "#fff" : "#334155",
    fontFamily: "inherit", fontSize: 14, fontWeight: 600, lineHeight: 1.4,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 };
}

export function PinAISettingsCard({ propertyId }: { propertyId: string }) {
  return <PropertySettings key={propertyId} propertyId={propertyId} />;
}
function PropertySettings({ propertyId }: { propertyId: string }) {
  const query = useQuery({ queryKey: ["pin-ai-settings", propertyId],
    queryFn: ({ signal }) => getPinAIProperty(propertyId, signal), retry: false });
  const [draft, setDraft] = useState<boolean | undefined>();
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [acceptedPrice, setAcceptedPrice] = useState(false);
  const busy = useRef(false);
  const view = query.data;
  const needsAcceptance = !!view && (view.billing.acceptedVersion !== view.billing.version || !view.billing.acceptedAt);
  async function reload() {
    if (busy.current) return;
    const result = await query.refetch();
    if (result.isSuccess) { setDraft(undefined); setAcceptedPrice(false); setNeedsReload(false); setNotice(""); }
  }
  async function save() {
    if (!view || busy.current || needsReload || draft === undefined || (draft && needsAcceptance && !acceptedPrice)) return;
    busy.current = true; setSaving(true); setNotice("");
    try {
      await setPinAIProperty(view, draft);
      const result = await query.refetch();
      if (!result.isSuccess) throw new Error("Refresh required");
      setDraft(undefined); setAcceptedPrice(false); setNotice("Settings saved.");
    } catch (error) {
      setNeedsReload(true);
      const messages: Record<string, string> = {
        PIN_AI_CONNECT_ACCOUNT_REQUIRED: "Connect your Stripe account in Payments & Payouts before enabling Pin AI.",
        PIN_AI_CONNECT_ACCOUNT_INCOMPATIBLE: "Your Stripe Connect account is not yet compatible with Pin AI debits. Contact Pin&Go before enabling it.",
        PIN_AI_CONNECT_VERIFICATION_UNAVAILABLE: "We could not verify your Stripe account. Refresh and try again.",
        PIN_AI_ACTIVATION_CONFLICT: "The settings changed. Refresh before saving again.",
      };
      setNotice(error instanceof PinAIActivationError && messages[error.code]
        ? messages[error.code]
        : "We could not confirm the final status. Refresh before trying again.");
    } finally { busy.current = false; setSaving(false); }
  }
  const states = { EXISTING_SCOPE: "Limited availability", DISABLED: "Disabled",
    ENABLED: "Enabled", PENDING_ACTIVATION: "Configured · activation pending" };
  const saveDisabled = saving || query.isFetching || needsReload || draft === undefined || !view ||
    (draft === view.enabled && !needsAcceptance) || !view.organization.enabled || (draft === true && needsAcceptance && !acceptedPrice);
  const refreshDisabled = saving || query.isFetching;
  const renewDisabled = saving || needsReload || query.isFetching;
  return <section aria-labelledby={`pin-ai-title-${propertyId}`} style={{ border: "1px solid #bfdbfe", borderRadius: 18,
    padding: 18, background: "#fff", display: "grid", gap: 16, minWidth: 0, boxSizing: "border-box", color: "#0f172a", overflowWrap: "anywhere" }}>
    <div>
      <h2 id={`pin-ai-title-${propertyId}`} style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600, lineHeight: 1.35 }}>Pin AI · Guest assistance</h2>
      <p style={paragraphStyle}>Answers stay-related questions and lets guests report incidents to the host. These settings apply to eligible reservations at this property, including new ones.</p>
    </div>
    {query.isPending ? <p role="status" style={paragraphStyle}>Loading settings…</p> : null}
    {query.isError ? <p role="alert" style={{ ...paragraphStyle, color: "#991b1b" }}>The settings could not be loaded. Check your permissions and try again.</p> : null}
    {view && !query.isError ? <>
      <p style={{ margin: 0, justifySelf: "start", padding: "6px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
        background: view.state === "ENABLED" ? "#f0fdf4" : "#f1f5f9", color: view.state === "ENABLED" ? "#166534" : "#334155" }}><strong>Status: {states[view.state]}</strong></p>
      {view.state === "PENDING_ACTIVATION" ? <p style={paragraphStyle}>The settings are saved; Pin&Go must complete the rollout to confirm availability.</p> : null}
      {!view.organization.enabled ? <p style={paragraphStyle}>Pin&Go must enable the service for your organization before you can enable it here.</p> : null}
      <label style={{ ...labelStyle, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}><input type="checkbox" style={checkboxStyle} checked={draft ?? view.enabled}
        disabled={saving || query.isFetching || needsReload || !view.organization.enabled}
        onChange={event => { setDraft(event.target.checked); setAcceptedPrice(false); setNotice(""); }} />Enable Pin AI at this property</label>
      {view.enabled && needsAcceptance ? <button type="button" disabled={renewDisabled} style={{ ...buttonStyle(renewDisabled), justifySelf: "start" }}
        onClick={() => { setDraft(true); setAcceptedPrice(false); }}>Review and renew billing authorization</button> : null}
      <p style={{ ...paragraphStyle, padding: 14, border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}>Host fee: USD $1.00 per reservation with Pin AI enabled, regardless of its source, debited from your Stripe Connect account. One charge per reservation, starting 24 hours before check-in; reservations canceled before that window are excluded. {view.billing.collectionReady ? "Eligible charges are collected from your Connect balance." : "Charge collection is pending enablement."}</p>
      {draft === true && needsAcceptance ? <label style={{ ...labelStyle, padding: 14, border: "1px solid #bfdbfe", borderRadius: 12, background: "#eff6ff", color: "#1e40af" }}><input type="checkbox" style={checkboxStyle} checked={acceptedPrice}
        disabled={saving || needsReload || query.isFetching} onChange={event => setAcceptedPrice(event.target.checked)} />
        I authorize Pin&Go to debit USD $1.00 from the available balance of my Stripe Connect account for each reservation with Pin AI enabled at this property, regardless of its source, starting 24 hours before check-in. If the balance is insufficient, I authorize retrying the pending charge when funds become available.</label> : null}
      <p style={paragraphStyle}>Reservation changes and OTA channel replies require separate enablement. Disabling this assistance preserves existing incidents so you can address them.</p>
    </> : null}
    {notice ? <p role={needsReload ? "alert" : "status"} style={{ ...paragraphStyle, padding: 12, borderRadius: 8,
      background: needsReload ? "#fef2f2" : "#f0fdf4", color: needsReload ? "#991b1b" : "#166534" }}>{notice}</p> : null}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {view && !query.isError ? <button type="button" onClick={() => void save()} disabled={saveDisabled}
        style={buttonStyle(saveDisabled, true)}>{saving ? "Saving…" : "Save settings"}</button> : null}
      <button type="button" onClick={() => void reload()} disabled={refreshDisabled}
        style={buttonStyle(refreshDisabled)}>Refresh status</button>
    </div>
  </section>;
}
