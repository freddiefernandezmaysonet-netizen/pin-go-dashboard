import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";

import { getDistributionConnectionCenter, reconcileDistributionChannel, type DistributionConnectionCenter } from "../../api/distribution";
import {
  DistributionFullSyncApiError,
  getDistributionRuntimeState,
  requestDistributionFullSync,
  type DistributionRuntimeState,
  type DistributionFullSyncResult,
} from "../../api/distributionFullSync";
import { useAuth } from "../../auth/AuthProvider";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "ADMIN", "PLATFORM_ADMIN"]);
const VERIFICATION_DELAYS_MS = [10_000, 20_000, 30_000] as const;
type QueuedSync = DistributionFullSyncResult & { propertyId: string; verifyAirbnb: boolean };
type VerificationStatus = "IDLE" | "CHECKING" | "CONFIRMED" | "PENDING" | "FAILED";
const CARD_STYLE = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  maxWidth: 1120,
  width: "100%",
  margin: "0 auto",
} as const;

function latestConfirmedAt(center: DistributionConnectionCenter | null): string | null {
  if (!center) return null;
  const timestamps = center.channels
    .map((channel) => channel.lastFullSyncConfirmedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  return timestamps[0]?.toISOString() ?? null;
}

function friendlyError(error: unknown): string {
  if (error instanceof DistributionFullSyncApiError && error.status === 409) {
    if (error.providerMessage.toLowerCase().includes("already in progress")) {
      return "A Full Sync is already in progress for this property.";
    }
    return "Distribution is not ready for a Full Sync yet. No mapping or activation changes were made.";
  }
  return "Full Sync could not be queued. No mapping or channel activation changes were made.";
}

export function ConnectionCenterFullSyncControl() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const simulated = searchParams.get("simulation") === "1";
  const isAdmin = Boolean(user?.role && ADMIN_ROLES.has(user.role));
  const [center, setCenter] = useState<DistributionConnectionCenter | null>(null);
  const [runtimeState, setRuntimeState] = useState<DistributionRuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [queued, setQueued] = useState<QueuedSync | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("IDLE");
  const [verificationRun, setVerificationRun] = useState(0);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id || !isAdmin || simulated) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [nextCenter, nextRuntime] = await Promise.all([
          getDistributionConnectionCenter(id),
          getDistributionRuntimeState(id),
        ]);
        if (!cancelled) {
          setCenter(nextCenter);
          setRuntimeState(nextRuntime);
        }
      } catch {
        if (!cancelled) setError("Pin&Go could not verify Full Sync readiness.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, simulated]);

  useEffect(() => {
    if (!id || !isAdmin || simulated || !queued || queued.propertyId !== id || !queued.verifyAirbnb) return;
    const propertyId = id;
    const syncRequest = queued;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const notify = () => window.dispatchEvent(new CustomEvent("pin-go:distribution-status-updated", { detail: { propertyId } }));
    async function verify() {
      if (cancelled) return;
      let failed = false;
      try {
        // Reconciliation verifies existing evidence. It never submits another Full Sync.
        await reconcileDistributionChannel(propertyId, "AIRBNB");
        if (cancelled) return;
        const nextCenter = await getDistributionConnectionCenter(propertyId);
        if (cancelled) return;
        setCenter(nextCenter);
        const airbnb = nextCenter.channels.find(channel => channel.provider === "AIRBNB");
        const confirmedAt = Date.parse(airbnb?.lastFullSyncConfirmedAt ?? "");
        const requestedAt = Date.parse(syncRequest.requestedAt);
        if (airbnb?.status === "ACTIVE" && Number.isFinite(confirmedAt) && Number.isFinite(requestedAt) && confirmedAt >= requestedAt) {
          setVerificationStatus("CONFIRMED");
          notify();
          return;
        }
      } catch {
        if (cancelled) return;
        failed = true;
      }
      attempt++;
      if (attempt < VERIFICATION_DELAYS_MS.length) {
        timer = setTimeout(() => void verify(), VERIFICATION_DELAYS_MS[attempt]);
      } else {
        setVerificationStatus(failed ? "FAILED" : "PENDING");
        notify();
      }
    }
    timer = setTimeout(() => void verify(), verificationRun > 0 ? 0 : VERIFICATION_DELAYS_MS[0]);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [id, isAdmin, simulated, queued, verificationRun]);

  const lastConfirmed = useMemo(() => latestConfirmedAt(center), [center]);
  const runtimeActive = Boolean(
    runtimeState?.distributionEnabled === true &&
      runtimeState.distributionStatus.toUpperCase() === "ACTIVE"
  );
  const ready = Boolean(center?.provisioningStatus === "READY" && runtimeActive);
  const currentSync = queued?.propertyId === id ? queued : null;
  const canRequest = Boolean(id && isAdmin && !simulated && ready && !running && (!currentSync || verificationStatus === "CONFIRMED"));

  if (!id || !isAdmin) return null;
  if (!simulated && loading) return null;

  async function runFullSync() {
    if (!id || !canRequest || submitting.current) return;
    submitting.current = true;
    try {
      setRunning(true);
      setError(null);
      const result = await requestDistributionFullSync(id);
      const verifyAirbnb = Boolean(center?.channels.some(channel => channel.provider === "AIRBNB" && channel.channelLinked));
      setVerificationStatus(verifyAirbnb ? "CHECKING" : "IDLE");
      setVerificationRun(0);
      setQueued({ ...result, propertyId: id, verifyAirbnb });
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      submitting.current = false;
      setRunning(false);
    }
  }

  return (
    <section style={CARD_STYLE} aria-labelledby="distribution-full-sync-title">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 5, maxWidth: 720 }}>
          <div id="distribution-full-sync-title" style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
            Availability & rates sync
          </div>
          <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.55 }}>
            Send a complete availability and rates/restrictions refresh for this property through Distribution by Pin&Go. This action does not map or activate any OTA channel.
          </div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            {lastConfirmed
              ? `Most recent verified channel sync: ${new Date(lastConfirmed).toLocaleString()}`
              : "No confirmed Full Sync is recorded yet."}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runFullSync()}
          disabled={!canRequest}
          style={{
            minHeight: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: ready ? "1px solid #111827" : "1px solid #d1d5db",
            background: ready ? "#111827" : "#f3f4f6",
            color: ready ? "#fff" : "#6b7280",
            cursor: canRequest ? "pointer" : "not-allowed",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: canRequest ? 1 : 0.75,
          }}
        >
          {running ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}
          {running ? "Queuing Full Sync…" : currentSync && verificationStatus !== "CONFIRMED" ? "Full Sync queued" : "Sync availability & rates"}
        </button>
      </div>

      {simulated ? (
        <div role="status" style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", background: "#f9fafb", color: "#4b5563", fontSize: 12 }}>
          Safe simulation: no Full Sync request will be sent.
        </div>
      ) : !ready && !error ? (
        <div role="status" style={{ marginTop: 14, border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", background: "#fffbeb", color: "#92400e", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <TriangleAlert size={15} /> Distribution setup and runtime must both be active before a Full Sync can be requested.
        </div>
      ) : currentSync && !error ? (
        <div role="status" style={{ marginTop: 14,
          border: verificationStatus === "CONFIRMED" ? "1px solid #a7f3d0" : verificationStatus === "PENDING" || verificationStatus === "FAILED" ? "1px solid #fde68a" : "1px solid #bfdbfe",
          borderRadius: 10, padding: "10px 12px",
          background: verificationStatus === "CONFIRMED" ? "#ecfdf5" : verificationStatus === "PENDING" || verificationStatus === "FAILED" ? "#fffbeb" : "#eff6ff",
          color: verificationStatus === "CONFIRMED" ? "#065f46" : verificationStatus === "PENDING" || verificationStatus === "FAILED" ? "#92400e" : "#1d4ed8",
          fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          {verificationStatus === "CHECKING" ? <LoaderCircle size={15} /> : verificationStatus === "PENDING" || verificationStatus === "FAILED" ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
          <div style={{ display: "grid", gap: 8 }}>
            {verificationStatus === "CONFIRMED"
              ? "Availability and rates sync verified for Airbnb. The connection status has been updated."
              : verificationStatus === "CHECKING"
                ? "Full Sync queued successfully. Pin&Go is checking Airbnb's verified connection status."
                : verificationStatus === "PENDING"
                  ? "Airbnb's sync is not verified yet. Review the Airbnb connection checks above, then check status again."
                  : verificationStatus === "FAILED"
                    ? "Pin&Go could not verify the sync result yet. The queued request has not been repeated. Check status again."
                    : "Full Sync queued successfully. Pin&Go will process availability and rates/restrictions through the existing distribution runtime."}
            {(verificationStatus === "PENDING" || verificationStatus === "FAILED") && <button type="button" onClick={() => { setVerificationStatus("CHECKING"); setVerificationRun(value => value + 1); }} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", background: "#fff", color: "#111827", fontWeight: 600, cursor: "pointer" }}>Check sync status</button>}
          </div>
        </div>
      ) : error ? (
        <div role="alert" style={{ marginTop: 14, border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", background: "#fef2f2", color: "#991b1b", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <TriangleAlert size={15} /> {error}
        </div>
      ) : null}
    </section>
  );
}
