import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getMissionControlAvailability,
  MISSION_CONTROL_AVAILABILITY,
  normalizeApmsDecisionHistory,
} from "../lib/apmsMissionControlPresentation.js";
import { sanitizeWhiteLabelText } from "../lib/whiteLabel";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

type PropertyRow = { id: string; name: string };
type AuditEntry = {
  decisionId?: string;
  engine?: string;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  status?: string;
  severity?: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  reason?: string;
  recommendedAction?: string;
};

function formatTime(entry: AuditEntry) {
  const raw = entry.completedAt ?? entry.startedAt;
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatToken(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  const sanitized = sanitizeWhiteLabelText(text);
  return sanitized ? sanitized.replaceAll("_", " ") : fallback;
}

function statusStyle(status: unknown): CSSProperties {
  const value = String(status ?? "").toUpperCase();
  if (value === "SUCCESS" || value === "RESOLVED") {
    return { color: "#166534", background: "#dcfce7", borderColor: "#bbf7d0" };
  }
  if (value === "FAILED" || value === "ERROR") {
    return { color: "#991b1b", background: "#fee2e2", borderColor: "#fecaca" };
  }
  return { color: "#92400e", background: "#fef3c7", borderColor: "#fde68a" };
}

export default function ApmsDecisionHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const selectedPropertyId = searchParams.get("propertyId") ?? "";
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setPropertiesLoading(true);
    setPropertiesError(null);

    fetch(`${API_BASE}/api/dashboard/properties`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data?.items)) {
          throw new Error(data?.error || "Failed to load properties");
        }
        setProperties(data.items);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setProperties([]);
        setPropertiesError(String(error?.message || error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPropertiesLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) {
      setSnapshot(null);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }

    const controller = new AbortController();
    setSnapshot(null);
    setHistoryLoading(true);
    setHistoryError(null);

    fetch(
      `${API_BASE}/api/dashboard/properties/${encodeURIComponent(
        selectedPropertyId
      )}/mission-control`,
      { credentials: "include", signal: controller.signal }
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.item || typeof data.item !== "object") {
          throw new Error(data?.error || "APMS decision history is unavailable");
        }
        setSnapshot(data.item);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSnapshot(null);
        setHistoryError(String(error?.message || error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [selectedPropertyId]);

  const availability = getMissionControlAvailability({
    loading: historyLoading,
    snapshot,
  });
  const entries = normalizeApmsDecisionHistory([
    {
      propertyId: selectedPropertyId,
      propertyName: selectedProperty?.name ?? "",
      snapshot,
    },
  ]) as AuditEntry[];

  function selectProperty(propertyId: string) {
    const next = new URLSearchParams(searchParams);
    if (propertyId) next.set("propertyId", propertyId);
    else next.delete("propertyId");
    setSearchParams(next, { replace: true });
  }

  return (
    <div style={styles.page}>
      <div>
        <div style={styles.eyebrow}>APMS Audit Evidence</div>
        <h1 style={styles.title}>APMS Decision History</h1>
        <p style={styles.subtitle}>
          Latest persisted APMS audit evidence returned by Mission Control for the
          selected property. This is separate from smart-device automation history.
        </p>
      </div>

      <section style={styles.filterCard}>
        <label style={styles.label} htmlFor="apms-history-property">
          Property
        </label>
        <select
          id="apms-history-property"
          value={selectedPropertyId}
          onChange={(event) => selectProperty(event.target.value)}
          disabled={propertiesLoading}
          style={styles.select}
        >
          <option value="">Select a property</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
        {propertiesError ? (
          <div style={styles.errorBox}>
            Property list unavailable: {propertiesError}
          </div>
        ) : null}
      </section>

      {!selectedPropertyId ? (
        <section style={styles.infoBox}>
          Select a property to load its recent persisted APMS decisions.
        </section>
      ) : availability === MISSION_CONTROL_AVAILABILITY.LOADING ? (
        <section style={styles.infoBox}>Loading persisted APMS audit evidence…</section>
      ) : availability === MISSION_CONTROL_AVAILABILITY.UNAVAILABLE ? (
        <section style={styles.unavailableBox}>
          <strong>APMS decision history unavailable.</strong>
          <span>
            Pin&Go could not prove a live Mission Control snapshot for this property,
            so the dashboard will not present an empty history as a successful result.
          </span>
          {historyError ? <span style={styles.errorDetail}>{historyError}</span> : null}
        </section>
      ) : (
        <>
          <section style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Property</span>
              <strong style={styles.summaryValue}>{selectedProperty?.name ?? "Selected property"}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Recent decisions returned</span>
              <strong style={styles.summaryValue}>{entries.length}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Evidence source</span>
              <strong style={styles.summaryValue}>APMS Audit</strong>
            </div>
          </section>

          <section style={styles.historyCard}>
            <div style={styles.historyHeader}>
              <div>
                <div style={styles.historyEyebrow}>Persisted Evidence</div>
                <div style={styles.historyTitle}>Recent APMS decisions</div>
              </div>
              {selectedPropertyId ? (
                <Link
                  to={`/properties/${selectedPropertyId}/calendar`}
                  style={styles.linkButton}
                >
                  Open Mission Control
                </Link>
              ) : null}
            </div>

            {entries.length === 0 ? (
              <div style={styles.emptyState}>
                Mission Control is live, but no recent persisted APMS audit entries were
                returned for this property.
              </div>
            ) : (
              <div style={styles.timeline}>
                {entries.map((entry, index) => (
                  <article
                    key={entry.decisionId ?? `${entry.engine}-${entry.eventType}-${index}`}
                    style={styles.entry}
                  >
                    <div style={styles.entryTopRow}>
                      <div>
                        <div style={styles.contextRow}>
                          <span style={styles.engineBadge}>{formatToken(entry.engine, "APMS")}</span>
                          <span
                            style={{ ...styles.statusBadge, ...statusStyle(entry.status) }}
                          >
                            {formatToken(entry.status, "UNKNOWN")}
                          </span>
                        </div>
                        <h2 style={styles.entryTitle}>
                          {formatToken(entry.eventType, "APMS decision")}
                        </h2>
                      </div>
                      <time style={styles.time}>{formatTime(entry)}</time>
                    </div>

                    <div style={styles.summaryText}>
                      {sanitizeWhiteLabelText(
                        entry.summary || "Persisted APMS decision evidence."
                      )}
                    </div>

                    <dl style={styles.metadataGrid}>
                      <div>
                        <dt style={styles.metaLabel}>Entity</dt>
                        <dd style={styles.metaValue}>
                          {formatToken(entry.entityType)} · {formatToken(entry.entityId)}
                        </dd>
                      </div>
                      <div>
                        <dt style={styles.metaLabel}>Reason</dt>
                        <dd style={styles.metaValue}>{formatToken(entry.reason)}</dd>
                      </div>
                      <div>
                        <dt style={styles.metaLabel}>Decision ID</dt>
                        <dd style={styles.monoValue}>{formatToken(entry.decisionId)}</dd>
                      </div>
                      <div>
                        <dt style={styles.metaLabel}>Duration</dt>
                        <dd style={styles.metaValue}>
                          {Number.isFinite(Number(entry.durationMs))
                            ? `${Number(entry.durationMs)} ms`
                            : "—"}
                        </dd>
                      </div>
                    </dl>

                    {entry.recommendedAction ? (
                      <div style={styles.recommendation}>
                        <strong>Recorded recommendation</strong>
                        <span>{sanitizeWhiteLabelText(entry.recommendedAction)}</span>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: "grid", gap: 20, color: "#0f172a" },
  eyebrow: { fontSize: 11, fontWeight: 900, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.12em" },
  title: { margin: "6px 0 0", fontSize: 30, fontWeight: 900 },
  subtitle: { margin: "8px 0 0", maxWidth: 820, color: "#64748b", lineHeight: 1.6, fontWeight: 600 },
  filterCard: { padding: 18, borderRadius: 18, border: "1px solid #e2e8f0", background: "#fff", display: "grid", gap: 8 },
  label: { fontSize: 12, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em" },
  select: { minHeight: 44, borderRadius: 12, border: "1px solid #cbd5e1", padding: "0 12px", background: "#fff", color: "#0f172a", fontWeight: 700, maxWidth: 460 },
  errorBox: { padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 },
  infoBox: { padding: 18, borderRadius: 16, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", fontWeight: 700 },
  unavailableBox: { padding: 18, borderRadius: 16, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", display: "grid", gap: 8 },
  errorDetail: { fontSize: 12, color: "#64748b", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  summaryCard: { padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", display: "grid", gap: 8 },
  summaryLabel: { fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  summaryValue: { fontSize: 20, color: "#0f172a" },
  historyCard: { borderRadius: 20, border: "1px solid #cbd5e1", background: "#fff", overflow: "hidden" },
  historyHeader: { padding: 18, background: "linear-gradient(135deg, #020617, #1e293b)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" },
  historyEyebrow: { fontSize: 10, fontWeight: 900, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.12em" },
  historyTitle: { marginTop: 6, fontSize: 20, fontWeight: 900 },
  linkButton: { textDecoration: "none", color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "9px 12px", fontWeight: 800, fontSize: 12 },
  emptyState: { margin: 18, padding: 18, borderRadius: 14, background: "#f8fafc", color: "#64748b", fontWeight: 700 },
  timeline: { padding: 18, display: "grid", gap: 12 },
  entry: { padding: 16, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc" },
  entryTopRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  contextRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  engineBadge: { padding: "5px 9px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 900, textTransform: "uppercase" },
  statusBadge: { padding: "5px 9px", borderRadius: 999, border: "1px solid", fontSize: 10, fontWeight: 900, textTransform: "uppercase" },
  entryTitle: { margin: "9px 0 0", fontSize: 16, fontWeight: 900 },
  time: { fontSize: 11, color: "#64748b", fontWeight: 700 },
  summaryText: { marginTop: 12, color: "#334155", lineHeight: 1.5, fontWeight: 650 },
  metadataGrid: { margin: "14px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  metaLabel: { fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" },
  metaValue: { margin: "5px 0 0", color: "#334155", fontWeight: 700, wordBreak: "break-word" },
  monoValue: { margin: "5px 0 0", color: "#334155", fontWeight: 650, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all", fontSize: 11 },
  recommendation: { marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", display: "grid", gap: 5, fontSize: 12 },
};
