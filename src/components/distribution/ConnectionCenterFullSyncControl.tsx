import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";

import { getDistributionConnectionCenter, type DistributionConnectionCenter } from "../../api/distribution";
import {
  DistributionFullSyncApiError,
  getDistributionRuntimeState,
  requestDistributionFullSync,
  type DistributionRuntimeState,
  type DistributionFullSyncResult,
} from "../../api/distributionFullSync";
import { useAuth } from "../../auth/AuthProvider";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "ADMIN", "PLATFORM_ADMIN"]);
const CARD_STYLE = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  maxWidth: 1120,
  width: "100%",
  margin: "18px auto 0",
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
  const [queued, setQueued] = useState<DistributionFullSyncResult | null>(null);
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

  const lastConfirmed = useMemo(() => latestConfirmedAt(center), [center]);
  const runtimeActive = Boolean(
    runtimeState?.distributionEnabled === true &&
      runtimeState.distributionStatus.toUpperCase() === "ACTIVE"
  );
  const ready = Boolean(center?.provisioningStatus === "READY" && runtimeActive);
  const canRequest = Boolean(id && isAdmin && !simulated && ready && !running && !queued);

  if (!isAdmin) return null;
  if (!simulated && loading) return null;

  async function runFullSync() {
    if (!id || !canRequest) return;
    try {
      setRunning(true);
      setError(null);
      setQueued(await requestDistributionFullSync(id));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
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
              ? `Last confirmed Full Sync: ${new Date(lastConfirmed).toLocaleString()}`
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
          {running ? "Queuing Full Sync…" : queued ? "Full Sync queued" : "Sync availability & rates"}
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
      ) : queued ? (
        <div role="status" style={{ marginTop: 14, border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 12px", background: "#ecfdf5", color: "#065f46", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} /> Full Sync queued successfully. Pin&Go will process availability and rates/restrictions through the existing distribution runtime.
        </div>
      ) : error ? (
        <div role="alert" style={{ marginTop: 14, border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", background: "#fef2f2", color: "#991b1b", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <TriangleAlert size={15} /> {error}
        </div>
      ) : null}
    </section>
  );
}
