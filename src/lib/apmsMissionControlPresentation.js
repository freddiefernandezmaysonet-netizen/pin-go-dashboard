export const MISSION_CONTROL_AVAILABILITY = Object.freeze({
  LOADING: "LOADING",
  LIVE: "LIVE",
  UNAVAILABLE: "UNAVAILABLE",
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getMissionControlAvailability({ loading = false, snapshot = null } = {}) {
  if (loading) return MISSION_CONTROL_AVAILABILITY.LOADING;
  if (isRecord(snapshot)) return MISSION_CONTROL_AVAILABILITY.LIVE;
  return MISSION_CONTROL_AVAILABILITY.UNAVAILABLE;
}

export function getMissionControlDisplayStatus({ loading = false, snapshot = null } = {}) {
  const availability = getMissionControlAvailability({ loading, snapshot });

  if (availability === MISSION_CONTROL_AVAILABILITY.LOADING) return "LOADING";
  if (availability === MISSION_CONTROL_AVAILABILITY.UNAVAILABLE) return "UNAVAILABLE";

  const status = String(snapshot?.autopilotStatus ?? "UNKNOWN")
    .trim()
    .toUpperCase();

  return status || "UNKNOWN";
}

export function getLiveMissionControlMetric(snapshot, path, fallback = null) {
  if (!isRecord(snapshot)) return fallback;

  let current = snapshot;
  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) return fallback;
    current = current[segment];
  }

  if (current === null || current === undefined || current === "") return fallback;

  const value = Number(current);
  return Number.isFinite(value) ? value : fallback;
}

export function getMissionControlAuditEntries(snapshot) {
  if (!isRecord(snapshot)) return [];
  if (Array.isArray(snapshot.activityHistory)) return snapshot.activityHistory;
  if (Array.isArray(snapshot.recentAuditEntries)) return snapshot.recentAuditEntries;
  return [];
}

export function getApmsAuditTimestamp(entry) {
  if (!isRecord(entry)) return 0;
  const raw = entry.completedAt ?? entry.startedAt ?? entry.generatedAt ?? null;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export function getApmsAuditDedupKey(entry) {
  if (!isRecord(entry)) return "invalid";

  const decisionId = String(entry.decisionId ?? "").trim();
  if (decisionId) return `decision:${decisionId}`;

  return [
    "fallback",
    entry.engine ?? "",
    entry.entityType ?? "",
    entry.entityId ?? "",
    entry.eventType ?? "",
    entry.completedAt ?? entry.startedAt ?? entry.generatedAt ?? "",
  ].join(":");
}

export function normalizeApmsDecisionHistory(propertySnapshots) {
  const rows = Array.isArray(propertySnapshots) ? propertySnapshots : [];
  const byKey = new Map();

  for (const row of rows) {
    if (!isRecord(row)) continue;
    const propertyId = String(row.propertyId ?? "").trim();
    const propertyName = String(row.propertyName ?? "").trim();

    for (const entry of getMissionControlAuditEntries(row.snapshot)) {
      if (!isRecord(entry)) continue;
      const key = getApmsAuditDedupKey(entry);
      const existing = byKey.get(key);
      const candidate = { ...entry, propertyId, propertyName };

      if (!existing || getApmsAuditTimestamp(candidate) > getApmsAuditTimestamp(existing)) {
        byKey.set(key, candidate);
      }
    }
  }

  return [...byKey.values()].sort(
    (left, right) => getApmsAuditTimestamp(right) - getApmsAuditTimestamp(left)
  );
}
