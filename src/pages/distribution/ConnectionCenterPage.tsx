import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import {
  AirbnbHostSelfServiceApiError,
  confirmAirbnbHostMapping,
  issueAirbnbHostConnectionLink,
  listAirbnbHostListings,
  type AirbnbHostListing,
  type AirbnbHostListingDiscovery,
} from "../../api/airbnbHostSelfService";
import {
  DistributionApiError,
  getDistributionConnectionCenter,
  issueDistributionConnectionSession,
  prepareDistributionChannel,
  reconcileDistributionChannel,
  transitionDistributionConnectionSession,
  type DistributionConnectionCenter,
  type DistributionConnectionSession,
  type DistributionProvider,
} from "../../api/distribution";
import { useAuth } from "../../auth/AuthProvider";
import AirbnbActivationPanel from "./AirbnbActivationPanel";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "ADMIN", "PLATFORM_ADMIN"]);
const SELF_SERVICE = new Set<DistributionProvider>(["AIRBNB", "BOOKING_COM"]);
const AIRBNB_LISTING_DISCOVERY_STATUSES = new Set([
  "NOT_CONNECTED",
  "AUTHORIZATION_REQUIRED",
  "MAPPING_REQUIRED",
]);

const SIMULATED_CENTER: DistributionConnectionCenter = {
  productName: "Distribution by Pin&Go",
  property: { id: "simulation", name: "Demo property" },
  status: "SETUP_REQUIRED",
  provisioningStatus: "NOT_PROVISIONED",
  channels: [
    { provider: "AIRBNB", name: "Airbnb", availability: "AVAILABLE", status: "NOT_CONNECTED", nextAction: "CONNECT", channelLinked: false, readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "BOOKING_COM", name: "Booking.com", availability: "AVAILABLE", status: "NOT_CONNECTED", nextAction: "CONNECT", channelLinked: false, readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "EXPEDIA", name: "Expedia", availability: "PLANNED", status: "NOT_CONNECTED", nextAction: "CONNECT", channelLinked: false, readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
    { provider: "VRBO", name: "Vrbo", availability: "ASSISTED_BETA", status: "NOT_CONNECTED", nextAction: "CONNECT", channelLinked: false, readiness: { authorization: "REQUIRED", mapping: "NOT_STARTED", distribution: "NOT_STARTED", payment: "NOT_STARTED", tax: "NOT_STARTED", content: "NOT_STARTED" }, lastReadinessCheckedAt: null, lastFullSyncConfirmedAt: null, activatedAt: null, attentionCode: null },
  ],
};

const SIMULATED_IFRAME_DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px;background:#f8fafc;color:#111827}main{max-width:560px;margin:auto;background:white;border:1px solid #e5e7eb;border-radius:18px;padding:28px}span{display:inline-block;background:#ecfdf5;color:#065f46;padding:6px 10px;border-radius:999px;font-weight:700}h1{font-size:24px}p{line-height:1.6}</style></head><body><main><span>Safe simulation</span><h1>Authorize your channel</h1><p>This view represents the authorization flow. It does not use credentials, contact an OTA, or modify data.</p></main></body></html>`;

const PAGE_STYLE = { display: "grid", gap: 18, maxWidth: 1120, margin: "0 auto" } as const;
const CARD_STYLE = { border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" } as const;
const PRIMARY_BUTTON_STYLE = { minHeight: 42, padding: "0 16px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 } as const;
const SECONDARY_BUTTON_STYLE = { minHeight: 42, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", color: "#111827", cursor: "pointer", fontWeight: 600 } as const;

type ListingDiscoveryStatus = "IDLE" | "LOADING" | "LOADED" | "FAILED";
type AirbnbMappingStatus = "IDLE" | "SUBMITTING" | "SUBMITTED" | "ALREADY_MAPPED";

function isAirbnbListingDiscoveryEligible(
  channel: DistributionConnectionCenter["channels"][number] | undefined
) {
  return Boolean(
    channel &&
      channel.provider === "AIRBNB" &&
      channel.channelLinked &&
      AIRBNB_LISTING_DISCOVERY_STATUSES.has(channel.status)
  );
}

function isBookingComConnectionExisting(
  channel: DistributionConnectionCenter["channels"][number] | undefined
): boolean {
  return Boolean(
    channel?.provider === "BOOKING_COM" &&
      (channel.channelLinked || channel.status === "ACTIVE")
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    NOT_CONNECTED: "Not connected",
    AUTHORIZATION_REQUIRED: "Authorization required",
    MAPPING_REQUIRED: "Setup required",
    READINESS_CHECK: "Checking setup",
    ACTIVATION_PENDING: "Activation pending",
    ACTIVE: "Active",
    DEGRADED: "Needs attention",
    FAILED: "Error",
    DISCONNECTING: "Disconnecting",
    DISCONNECTED: "Disconnected",
  };
  return labels[value] ?? value;
}

function statusBadgeStyle(tone: "neutral" | "progress" | "success" | "warning") {
  if (tone === "success") return { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" } as const;
  if (tone === "progress") return { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" } as const;
  if (tone === "warning") return { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" } as const;
  return { background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#4b5563" } as const;
}

function providerPresentation(channel: DistributionConnectionCenter["channels"][number], airbnbSetupLinked: boolean) {
  if (channel.provider === "AIRBNB" && channel.channelLinked && channel.status !== "ACTIVE") {
    const needsAttention = channel.status === "DEGRADED" || channel.status === "FAILED";
    const description = channel.status === "ACTIVATION_PENDING"
      ? "Airbnb is linked to this property. Pin&Go is verifying activation and commercial readiness."
      : channel.status === "READINESS_CHECK"
        ? "Airbnb is linked to this property. Pin&Go is checking the remaining setup requirements."
        : needsAttention
          ? "Airbnb remains linked to this property, but the connection needs attention before it can become active."
          : "Airbnb is linked to this property. Additional setup is required before the channel becomes active.";
    return {
      status: airbnbSetupLinked ? "Setup in progress" : statusLabel(channel.status),
      tone: needsAttention ? "warning" as const : "progress" as const,
      description,
    };
  }
  if (channel.status === "ACTIVE") {
    return {
      status: "Active",
      tone: "success" as const,
      description: "This booking channel is active for the property.",
    };
  }
  if (channel.availability === "PLANNED") {
    return {
      status: "Coming soon",
      tone: "neutral" as const,
      description: "Self-service connection is not available yet.",
    };
  }
  if (channel.availability === "ASSISTED_BETA") {
    return {
      status: "Assisted setup",
      tone: "warning" as const,
      description: "This channel currently requires assisted setup.",
    };
  }
  if (channel.provider === "BOOKING_COM") {
    const existing = isBookingComConnectionExisting(channel);
    const needsAttention = channel.status === "DEGRADED" || channel.status === "FAILED";
    return {
      status: statusLabel(channel.status),
      tone: needsAttention ? "warning" as const : existing ? "progress" as const : "neutral" as const,
      description: existing
        ? "Booking.com is linked to this property. Review the existing channel setup and its activation status."
        : "Request connectivity in Booking.com, then complete this property's setup in the secure window.",
    };
  }
  return {
    status: statusLabel(channel.status),
    tone: "neutral" as const,
    description: channel.provider === "AIRBNB"
      ? "Authorize your Airbnb account to begin setup. Pin&Go never receives or stores your Airbnb password."
      : "Connect this channel to begin setup for the property.",
  };
}

function listingMeta(listing: AirbnbHostListing): string | null {
  return [listing.city, listing.countryCode].filter(Boolean).join(", ") || null;
}

function reviewReasonMessages(reasons: readonly string[]): string[] {
  const messages: string[] = [];
  const add = (message: string) => {
    if (!messages.includes(message)) messages.push(message);
  };
  const detailsCountryConfirmed =
    reasons.includes("POSTAL_CODE_MATCH") ||
    reasons.includes("POSTAL_CODE_MISMATCH") ||
    reasons.includes("POSTAL_CODE_UNKNOWN");

  if (reasons.includes("AMBIGUOUS_RUNNER_UP")) add("More than one Airbnb property could match this Pin&Go property.");
  if (reasons.includes("LISTING_CONFLICT")) add("This Airbnb property also appears to match another Pin&Go property.");
  if (reasons.includes("DETAILS_UNAVAILABLE")) add("Airbnb property details could not be verified.");
  if (reasons.includes("DETAILS_NAME_NOT_STRONG")) add("Property names are not similar enough for an automatic match.");
  if (reasons.includes("POSTAL_CODE_MISMATCH")) add("ZIP / postal code differs between Pin&Go and Airbnb.");
  else if (reasons.includes("POSTAL_CODE_UNKNOWN")) add("ZIP / postal code could not be confirmed.");
  if (reasons.includes("PERSON_CAPACITY_MISMATCH")) add("Guest capacity differs between Pin&Go and Airbnb.");
  else if (reasons.includes("PERSON_CAPACITY_UNKNOWN")) add("Airbnb did not provide an exact guest capacity.");
  if (reasons.includes("DETAILS_COUNTRY_MISMATCH")) add("Country information differs between Pin&Go and Airbnb.");
  else if (reasons.includes("DETAILS_COUNTRY_UNKNOWN")) add("Country information could not be confirmed.");
  else if (!detailsCountryConfirmed && reasons.includes("COUNTRY_MISMATCH")) add("Country information differs between Pin&Go and Airbnb.");
  else if (!detailsCountryConfirmed && reasons.includes("COUNTRY_UNKNOWN")) add("Country information could not be confirmed.");
  if (reasons.includes("NAME_PARTIAL") || reasons.includes("NAME_WEAK")) add("Property names are not similar enough for an automatic match.");

  if (messages.length === 0 && reasons.includes("CITY_MISMATCH")) add("Airbnb uses a different city or locality name for this property.");
  else if (messages.length === 0 && reasons.includes("CITY_UNKNOWN")) add("City or locality information could not be confirmed.");

  return messages;
}

function AirbnbListingsPanel(props: {
  status: ListingDiscoveryStatus;
  discovery: AirbnbHostListingDiscovery | null;
  mappingStatus: AirbnbMappingStatus;
  onConfirm(listingId: string): void;
}) {
  if (props.status === "LOADING") {
    return (
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, color: "#4b5563", fontSize: 13 }}>
        <LoaderCircle size={16} /> Finding the matching Airbnb property…
      </div>
    );
  }
  if (props.status === "FAILED") {
    return <div role="alert" style={{ color: "#6b7280", fontSize: 13 }}>We couldn't evaluate the Airbnb property match. No changes were made.</div>;
  }
  if (props.status !== "LOADED" || !props.discovery) return null;

  const { listings, match } = props.discovery;
  if (listings.length === 0) {
    return <div style={{ color: "#6b7280", fontSize: 13 }}>No Airbnb properties were returned for this account.</div>;
  }

  const candidate = match.candidateListingId
    ? listings.find((listing) => listing.id === match.candidateListingId) ?? null
    : null;
  const meta = candidate ? listingMeta(candidate) : null;
  const canConfirm = Boolean(
    candidate &&
      match.status !== "UNMATCHED" &&
      !match.reasons.includes("LISTING_CONFLICT")
  );
  const mappingFinished =
    props.mappingStatus === "SUBMITTED" || props.mappingStatus === "ALREADY_MAPPED";

  const confirmationControl = canConfirm && candidate ? (
    <div style={{ display: "grid", gap: 8, paddingTop: 2 }}>
      <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
        Confirm only if this is the Airbnb property that belongs to this Pin&Go property. This submits the property mapping only. It does not activate Airbnb or import reservations.
      </div>
      {mappingFinished ? (
        <div role="status" style={{ border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 12px", background: "#ecfdf5", color: "#065f46", fontSize: 12, lineHeight: 1.5 }}>
          {props.mappingStatus === "ALREADY_MAPPED"
            ? "This Airbnb property was already mapped. No duplicate mapping was created. Airbnb is not activated by this action."
            : "Mapping submitted. Airbnb is not active yet. Activation and reservation import have not been performed."}
        </div>
      ) : (
        <button
          type="button"
          disabled={props.mappingStatus === "SUBMITTING"}
          onClick={() => props.onConfirm(candidate.id)}
          style={{
            ...PRIMARY_BUTTON_STYLE,
            width: "fit-content",
            cursor: props.mappingStatus === "SUBMITTING" ? "not-allowed" : "pointer",
            opacity: props.mappingStatus === "SUBMITTING" ? 0.65 : 1,
          }}
        >
          {props.mappingStatus === "SUBMITTING" ? "Confirming property…" : "Yes, this is my Airbnb property"}
        </button>
      )}
    </div>
  ) : null;

  if (match.status === "AUTO_MATCH") {
    return (
      <div style={{ display: "grid", gap: 8, paddingTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>Airbnb property match</div>
          <span style={{ ...statusBadgeStyle("success"), borderRadius: 999, padding: "4px 7px", fontSize: 11, fontWeight: 700 }}>Matched automatically</span>
        </div>
        {candidate && (
          <div style={{ border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 12px", background: "#f0fdf4" }}>
            <div style={{ color: "#111827", fontSize: 14, fontWeight: 600 }}>{candidate.title ?? "Airbnb listing"}</div>
            {meta && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>{meta}</div>}
          </div>
        )}
        <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>Pin&Go found a high-confidence match. Host confirmation is required before mapping.</div>
        {confirmationControl}
      </div>
    );
  }

  if (match.status === "REVIEW_REQUIRED") {
    const reviewMessages = reviewReasonMessages(match.reasons);
    return (
      <div style={{ display: "grid", gap: 8, paddingTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>Airbnb property match</div>
          <span style={{ ...statusBadgeStyle("warning"), borderRadius: 999, padding: "4px 7px", fontSize: 11, fontWeight: 700 }}>Review required</span>
        </div>
        {candidate && (
          <div style={{ border: "1px solid #fde68a", borderRadius: 12, padding: "10px 12px", background: "#fffbeb" }}>
            <div style={{ color: "#111827", fontSize: 14, fontWeight: 600 }}>{candidate.title ?? "Possible Airbnb property"}</div>
            {meta && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>{meta}</div>}
          </div>
        )}
        {reviewMessages.length > 0 && (
          <div style={{ border: "1px solid #fde68a", borderRadius: 10, padding: "9px 11px", background: "#fffdf5" }}>
            <div style={{ color: "#92400e", fontSize: 12, fontWeight: 700 }}>Why Pin&Go needs review</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
              {reviewMessages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        )}
        <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>Pin&Go found a possible match. Review it and explicitly confirm it before mapping.</div>
        {confirmationControl}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 5, paddingTop: 2 }}>
      <div style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>Airbnb property match</div>
      <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>No confident match was found for this Pin&Go property. No changes were made.</div>
    </div>
  );
}

function BookingComConnectionGuide(props: { simulated: boolean }) {
  return (
    <section aria-label="Before connecting Booking.com" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#f8fafc", color: "#374151", fontSize: 13, lineHeight: 1.55 }}>
      <strong>Before connecting Booking.com</strong>
      <ol style={{ margin: "8px 0", paddingLeft: 20, display: "grid", gap: 6 }}>
        <li>In the Booking.com extranet, open Account → Connectivity Provider. Search for Channex and select Channex.io, Pin&amp;Go's connectivity provider.</li>
        <li>Submit the connection request and accept the agreement in Booking.com. Mapping can begin while the request is pending; activation must wait for acceptance.</li>
        <li>Keep the Hotel ID shown next to your property's name. Enter it in the secure setup window, test the connection, and map the available rooms and rates.</li>
      </ol>
      {props.simulated ? (
        <span>Extranet navigation is disabled in simulation.</span>
      ) : (
        <a href="https://account.booking.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8", fontWeight: 600 }}>Open Booking.com extranet</a>
      )}
      <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 12 }}>Use your password and verification code only on Booking.com. Review rates and restrictions before activating the channel.</p>
    </section>
  );
}

function ConnectionFrame(props: { providerName: string; bookingCom?: boolean; session: DistributionConnectionSession; simulated: boolean; onLoaded(): void; onComplete(): void; onClose(): void; completing: boolean; ready: boolean }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="connection-frame-title" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.65)", display: "grid", placeItems: "center", padding: 20 }}>
      <section style={{ width: "min(920px, 100%)", height: "min(720px, 90vh)", background: "white", borderRadius: 18, overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr auto", boxShadow: "0 24px 60px rgba(15,23,42,.24)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div><strong id="connection-frame-title">{props.bookingCom ? "Booking.com setup" : <>Connect {props.providerName}</>}</strong><div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>{props.bookingCom ? "Closing this window does not undo changes saved here or confirm activation." : "Secure connection session"}</div></div>
          <button type="button" onClick={props.onClose} disabled={props.completing} aria-label="Close connection" style={{ border: 0, background: "transparent", cursor: "pointer", color: "#4b5563" }}><X size={22} /></button>
        </header>
        <iframe title={props.bookingCom ? "Booking.com setup" : `Connect ${props.providerName}`} src={props.simulated ? undefined : props.session.launchUrl} srcDoc={props.simulated ? SIMULATED_IFRAME_DOCUMENT : undefined} sandbox="allow-forms allow-popups allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={props.onLoaded} style={{ width: "100%", height: "100%", border: 0 }} />
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: 16, borderTop: "1px solid #e5e7eb" }}>
          <button type="button" onClick={props.onClose} disabled={props.completing} style={{ ...SECONDARY_BUTTON_STYLE, opacity: props.completing ? 0.6 : 1 }}>{props.bookingCom ? "Close window" : "Cancel"}</button>
          <button type="button" onClick={props.onComplete} disabled={props.completing || !props.ready} style={{ ...PRIMARY_BUTTON_STYLE, cursor: props.completing || !props.ready ? "not-allowed" : "pointer", opacity: props.completing || !props.ready ? 0.6 : 1 }}>{props.completing ? "Saving…" : props.ready ? (props.simulated ? "Finish simulation" : props.bookingCom ? "Close and refresh" : "Finish connection") : "Opening session…"}</button>
        </footer>
      </section>
    </div>
  );
}

export function ConnectionCenterPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const simulated = searchParams.get("simulation") === "1";
  const [center, setCenter] = useState<DistributionConnectionCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<DistributionProvider | null>(null);
  const [session, setSession] = useState<{ provider: DistributionProvider; value: DistributionConnectionSession } | null>(null);
  const [completing, setCompleting] = useState(false);
  const sessionCompletionInFlight = useRef(false);
  const [frameReady, setFrameReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [airbnbDiscovery, setAirbnbDiscovery] = useState<AirbnbHostListingDiscovery | null>(null);
  const [airbnbListingStatus, setAirbnbListingStatus] = useState<ListingDiscoveryStatus>("IDLE");
  const [airbnbMappingStatus, setAirbnbMappingStatus] = useState<AirbnbMappingStatus>("IDLE");
  const [airbnbMappedPropertyId, setAirbnbMappedPropertyId] = useState<string | null>(null);
  const listingDiscoveryStartedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try { setCenter(simulated ? { ...SIMULATED_CENTER, property: { id, name: "Demo property" } } : await getDistributionConnectionCenter(id)); }
    catch { setError("We couldn't load booking channels for this property."); }
    finally { setLoading(false); }
  }, [id, simulated]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!id || simulated || !center) return;
    const airbnb = center.channels.find((channel) => channel.provider === "AIRBNB");
    const shouldDiscover = isAirbnbListingDiscoveryEligible(airbnb);
    if (!shouldDiscover || listingDiscoveryStartedFor.current === id) return;

    listingDiscoveryStartedFor.current = id;
    setAirbnbListingStatus("LOADING");
    setAirbnbDiscovery(null);
    setAirbnbMappingStatus("IDLE");
    void listAirbnbHostListings(id)
      .then((discovery) => {
        setAirbnbDiscovery(discovery);
        setAirbnbListingStatus("LOADED");
      })
      .catch(() => {
        setAirbnbDiscovery(null);
        setAirbnbListingStatus("FAILED");
      });
  }, [center, id, simulated]);

  if (!id) return <Navigate to="/properties" replace />;
  if (!user || !ADMIN_ROLES.has(user.role)) return <Navigate to={`/properties/${id}`} replace />;

  async function connect(provider: "AIRBNB" | "BOOKING_COM") {
    setBusyProvider(provider); setError(null); setNotice(null);
    try {
      if (simulated) {
        setFrameReady(false);
        setSession({ provider, value: { sessionId: `simulation-${provider}`, launchUrl: "https://simulation.invalid/connect", expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } });
        return;
      }
      const existingBookingCom = provider === "BOOKING_COM" && isBookingComConnectionExisting(
        center?.channels.find((channel) => channel.provider === "BOOKING_COM")
      );
      if (!existingBookingCom) await prepareDistributionChannel(id, provider);
      if (provider === "AIRBNB") {
        const link = await issueAirbnbHostConnectionLink(id);
        window.location.assign(link.authorizationUrl);
        return;
      }
      setFrameReady(false);
      setSession({ provider, value: await issueDistributionConnectionSession(id, provider) });
    } catch (caught) {
      if (caught instanceof DistributionApiError && caught.code === "OTA_CONNECTION_CENTER_RUNTIME_DISABLED") setNotice("Booking channel connections are being prepared and are not yet available for commercial use.");
      else setError("We couldn't start this connection. Please try again.");
    } finally { setBusyProvider(null); }
  }

  async function confirmAirbnbCandidate(listingId: string) {
    setError(null);
    setNotice(null);
    setAirbnbMappingStatus("SUBMITTING");
    try {
      const result = await confirmAirbnbHostMapping({ propertyId: id, listingId });
      setAirbnbMappingStatus(result.outcome === "ALREADY_MAPPED" ? "ALREADY_MAPPED" : "SUBMITTED");
    } catch (caught) {
      setAirbnbMappingStatus("IDLE");
      if (caught instanceof AirbnbHostSelfServiceApiError) {
        if (caught.code.includes("CONFIRMATION_MISMATCH")) {
          setError("The Airbnb property match changed before confirmation. Refresh this page and review the property again. No mapping was created by this attempt.");
          return;
        }
        if (caught.code.includes("CONFLICT")) {
          setError("This Airbnb property or Pin&Go rate plan is already mapped differently. No changes were made.");
          return;
        }
        if (caught.code.includes("CHANNEL_STATE_INVALID") || caught.code.includes("CONTEXT_NOT_ELIGIBLE")) {
          setError("The Airbnb connection changed before confirmation. Refresh this page before continuing. No mapping was created by this attempt.");
          return;
        }
        if (caught.code.includes("RECONCILIATION_REQUIRED") || caught.code.includes("RESPONSE_INVALID") || caught.code.includes("RESPONSE_TOO_LARGE")) {
          setError("Pin&Go could not verify the mapping result. Airbnb was not activated. Refresh the page before attempting another action.");
          return;
        }
      }
      setError("We couldn't submit this Airbnb property mapping. Airbnb was not activated and reservations were not imported.");
    }
  }

  async function markOpened() {
    if (!session) return;
    if (simulated) { setFrameReady(true); return; }
    try { await transitionDistributionConnectionSession(session.value.sessionId, "opened"); setFrameReady(true); }
    catch { setError("The connection session opened, but Pin&Go couldn't confirm its state."); }
  }
  async function closeSession() {
    if (sessionCompletionInFlight.current) return;
    const current = session; setSession(null); setFrameReady(false);
    if (!current || simulated) return;
    try { await transitionDistributionConnectionSession(current.value.sessionId, "cancelled"); } catch { /* safe no-op */ }
  }
  async function completeSession() {
    if (!session || sessionCompletionInFlight.current) return;
    sessionCompletionInFlight.current = true;
    const current = session;
    setCompleting(true);
    setError(null);
    setNotice(null);
    try {
      if (!simulated) await transitionDistributionConnectionSession(current.value.sessionId, "completed");
      setSession(null); setFrameReady(false);
      let verificationFailed = false;
      if (!simulated && current.provider === "BOOKING_COM") {
        setBusyProvider("BOOKING_COM");
        try {
          await reconcileDistributionChannel(id, "BOOKING_COM");
        } catch {
          verificationFailed = true;
        }
      }
      await load();
      if (verificationFailed) {
        setError("Setup window closed, but Pin&Go couldn't refresh Booking.com's verified status. Changes saved in Channex are not undone. Reopen Manage Booking.com and use Close and refresh to try again.");
      } else {
        setNotice(simulated ? "Simulation complete. No data was changed." : current.provider === "BOOKING_COM"
          ? "Booking.com status verification completed. The card shows the latest saved status; closing does not confirm activation."
          : "Connection submitted for validation.");
      }
    } catch { setError("We couldn't complete the connection session."); }
    finally {
      sessionCompletionInFlight.current = false;
      setBusyProvider(null);
      setCompleting(false);
    }
  }

  const providerName = center?.channels.find((channel) => channel.provider === session?.provider)?.name ?? "channel";
  return (
    <main style={PAGE_STYLE}>
      <div>
        <Link to={`/properties/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#4b5563", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to property
        </Link>
      </div>

      <section style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0, color: "#111827", fontSize: 26, lineHeight: 1.15, fontWeight: 700 }}>{center?.property.name ?? "Property"}</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", lineHeight: 1.55 }}>Manage where this property receives reservations.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 7, alignItems: "center", padding: "6px 9px", borderRadius: 999, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", fontSize: 12, fontWeight: 700 }}>
          <ShieldCheck size={15} /> Secure connections
        </div>
      </section>

      {simulated && <div role="status" style={{ ...CARD_STYLE, padding: 14, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" }}>Simulation mode is active. No external calls or data changes will be made.</div>}
      {notice && <div role="status" style={{ ...CARD_STYLE, padding: 14, borderColor: "#a7f3d0", background: "#ecfdf5", color: "#065f46" }}>{notice}</div>}
      {error && <div role="alert" style={{ ...CARD_STYLE, padding: 14, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>{error}</div>}
      {loading && <div role="status" style={{ ...CARD_STYLE, display: "flex", alignItems: "center", gap: 10, color: "#6b7280" }}><LoaderCircle size={18} /> Loading booking channels…</div>}

      {!loading && center && (
        <section aria-label="Booking channels" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {center.channels.map((channel) => {
            const airbnbChannelLinked = channel.provider === "AIRBNB" && channel.channelLinked;
            const airbnbDiscoveryEligible = isAirbnbListingDiscoveryEligible(channel);
            const canConnect = channel.availability === "AVAILABLE" && SELF_SERVICE.has(channel.provider) && !airbnbChannelLinked;
            const presentation = providerPresentation(channel, airbnbDiscoveryEligible);
            return (
              <article key={channel.provider} style={{ ...CARD_STYLE, display: "grid", gap: 12, alignContent: "start", minHeight: 168 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.25, color: "#111827" }}>{channel.name}</h2>
                  <span style={{ ...statusBadgeStyle(presentation.tone), borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{presentation.status}</span>
                </div>

                <p style={{ margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.55 }}>{presentation.description}</p>

                {canConnect && channel.provider === "BOOKING_COM" && !isBookingComConnectionExisting(channel) && (
                  <BookingComConnectionGuide simulated={simulated} />
                )}

                {airbnbDiscoveryEligible && airbnbMappedPropertyId !== id && (
                  <AirbnbListingsPanel
                    status={airbnbListingStatus}
                    discovery={airbnbDiscovery}
                    mappingStatus={airbnbMappingStatus}
                    onConfirm={(listingId) => void confirmAirbnbCandidate(listingId)}
                  />
                )}

                {airbnbChannelLinked && !simulated && (
                  <AirbnbActivationPanel key={id} propertyId={id} mappingRevision={airbnbMappingStatus}
                    onMapped={setAirbnbMappedPropertyId} onActivated={load} />
                )}

                {canConnect ? (
                  <div style={{ marginTop: "auto", paddingTop: 2 }}>
                    <button type="button" disabled={busyProvider !== null} onClick={() => void connect(channel.provider as "AIRBNB" | "BOOKING_COM")} style={{ ...PRIMARY_BUTTON_STYLE, cursor: busyProvider !== null ? "not-allowed" : "pointer", opacity: busyProvider !== null ? 0.65 : 1 }}>
                      {busyProvider === channel.provider ? "Preparing…" : <><ExternalLink size={16} /> {isBookingComConnectionExisting(channel) ? "Manage Booking.com" : channel.provider === "AIRBNB" ? "Connect Airbnb" : `Connect ${channel.name}`}</>}
                    </button>
                  </div>
                ) : channel.availability === "ASSISTED_BETA" ? (
                  <div style={{ marginTop: "auto", color: "#6b7280", fontSize: 13 }}>Contact Pin&Go support for setup.</div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      {session && <ConnectionFrame providerName={providerName} bookingCom={session.provider === "BOOKING_COM"} session={session.value} simulated={simulated} onLoaded={() => void markOpened()} onComplete={() => void completeSession()} onClose={() => void closeSession()} completing={completing} ready={frameReady} />}
    </main>
  );
}
