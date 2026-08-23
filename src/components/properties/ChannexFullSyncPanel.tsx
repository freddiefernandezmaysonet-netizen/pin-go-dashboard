import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

const FULL_SYNC_RUNTIME_ENABLED =
  String(import.meta.env.VITE_CHANNEX_FULL_SYNC_RUNTIME_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";

type PropertySummary = {
  id: string;
  name?: string | null;
  distributionEnabled?: boolean | null;
  distributionStatus?: string | null;
};

export function ChannexFullSyncPanel() {
  const { id } = useParams();
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;

      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}`,
          { credentials: "include" }
        );
        const payload = await response.json().catch(() => null);

        if (!cancelled && response.ok && payload?.item) {
          setProperty(payload.item as PropertySummary);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return null;
  if (
    !property ||
    property.distributionEnabled !== true ||
    String(property.distributionStatus ?? "").toUpperCase() !== "ACTIVE"
  ) {
    return null;
  }

  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
            Distribution Full Sync
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
            Complete availability and rates/restrictions synchronization for this property.
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Available after Distribution runtime activation"
          style={{
            border: "1px solid #d1d5db",
            background: "#f3f4f6",
            color: "#6b7280",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 700,
            cursor: "not-allowed",
            opacity: 0.8,
          }}
        >
          {FULL_SYNC_RUNTIME_ENABLED ? "Runtime activation pending" : "Not yet available"}
        </button>
      </div>
      <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
        This control will become available after the Distribution runtime is activated and verified.
      </div>
    </div>
  );
}
