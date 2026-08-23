import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

type PropertySummary = {
  id: string;
  name?: string | null;
  distributionEnabled?: boolean | null;
  distributionStatus?: string | null;
};

type FullSyncResponse = {
  ok?: boolean;
  result?: {
    queued?: boolean;
    syncMode?: string;
    correlationId?: string;
    requestedAt?: string;
    messageKinds?: string[];
  };
  error?: string;
  retryAt?: string | null;
};

export function ChannexFullSyncPanel() {
  const { id } = useParams();
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}`, { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && payload?.item) setProperty(payload.item as PropertySummary);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return null;
  if (!property || property.distributionEnabled !== true || String(property.distributionStatus ?? "").toUpperCase() !== "ACTIVE") return null;

  async function runFullSync() {
    if (!id || running) return;
    try {
      setRunning(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}/channex/sync-availability`, { method: "POST", credentials: "include" });
      const payload = (await response.json().catch(() => ({}))) as FullSyncResponse;
      if (!response.ok || payload.ok !== true) {
        const retryCopy = payload.retryAt ? ` Retry available after ${new Date(payload.retryAt).toLocaleString()}.` : "";
        throw new Error(`${payload.error || "Unable to request Full Sync."}${retryCopy}`);
      }
      const kinds = payload.result?.messageKinds?.join(" + ") || "AVAILABILITY + RATES_RESTRICTIONS";
      setMessage(`Full Sync queued successfully: ${kinds}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request Full Sync.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ border: "1px solid #dbeafe", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Distribution Full Sync</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>Send a complete availability and rates/restrictions sync for this property.</div>
        </div>
        <button type="button" disabled={running} onClick={runFullSync} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: running ? "default" : "pointer", opacity: running ? 0.65 : 1 }}>
          {running ? "Queuing..." : "Run Full Sync"}
        </button>
      </div>
      {message ? <div style={{ marginTop: 12, color: "#065f46", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}
      {error ? <div style={{ marginTop: 12, color: "#991b1b", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
    </div>
  );
}
