import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPinAIProperty, setPinAIProperty, PinAIActivationError } from "../../api/pinAIActivation";

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
  return <section aria-labelledby={`pin-ai-title-${propertyId}`} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <h2 id={`pin-ai-title-${propertyId}`} className="text-lg font-semibold">Pin AI · Guest assistance</h2>
    <p>Answers stay-related questions and lets guests report incidents to the host. These settings apply to eligible reservations at this property, including new ones.</p>
    {query.isPending ? <p role="status">Loading settings…</p> : null}
    {query.isError ? <p role="alert">The settings could not be loaded. Check your permissions and try again.</p> : null}
    {view && !query.isError ? <>
      <p><strong>Status: {states[view.state]}</strong></p>
      {view.state === "PENDING_ACTIVATION" ? <p>The settings are saved; Pin&Go must complete the rollout to confirm availability.</p> : null}
      {!view.organization.enabled ? <p>Pin&Go must enable the service for your organization before you can enable it here.</p> : null}
      <label className="flex items-center gap-3"><input type="checkbox" checked={draft ?? view.enabled}
        disabled={saving || query.isFetching || needsReload || !view.organization.enabled}
        onChange={event => { setDraft(event.target.checked); setAcceptedPrice(false); setNotice(""); }} />Enable Pin AI at this property</label>
      {view.enabled && needsAcceptance ? <button type="button" disabled={saving || needsReload || query.isFetching}
        onClick={() => { setDraft(true); setAcceptedPrice(false); }}>Review and renew billing authorization</button> : null}
      <p className="text-sm text-slate-600">Host fee: USD $1.00 per reservation with Pin AI enabled, regardless of its source, debited from your Stripe Connect account. One charge per reservation, starting 24 hours before check-in; reservations canceled before that window are excluded. {view.billing.collectionReady ? "Eligible charges are collected from your Connect balance." : "Charge collection is pending enablement."}</p>
      {draft === true && needsAcceptance ? <label className="flex items-start gap-3"><input type="checkbox" checked={acceptedPrice}
        disabled={saving || needsReload || query.isFetching} onChange={event => setAcceptedPrice(event.target.checked)} />
        I authorize Pin&Go to debit USD $1.00 from the available balance of my Stripe Connect account for each reservation with Pin AI enabled at this property, regardless of its source, starting 24 hours before check-in. If the balance is insufficient, I authorize retrying the pending charge when funds become available.</label> : null}
      <p className="text-sm text-slate-600">Reservation changes and OTA channel replies require separate enablement. Disabling this assistance preserves existing incidents so you can address them.</p>
      <button type="button" onClick={() => void save()} disabled={saving || query.isFetching || needsReload || draft === undefined || (draft === view.enabled && !needsAcceptance) || !view.organization.enabled || (draft === true && needsAcceptance && !acceptedPrice)}
        className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>
    </> : null}
    {notice ? <p role={needsReload ? "alert" : "status"}>{notice}</p> : null}
    <button type="button" onClick={() => void reload()} disabled={saving || query.isFetching}
      className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Refresh status</button>
  </section>;
}
