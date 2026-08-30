export const MISSION_CONTROL_POLL_INTERVAL_MS = 15_000;

export function createMissionControlRefreshState({ ok, item, refreshedAt = new Date() } = {}) {
  return {
    snapshot: ok && item && typeof item === "object" && !Array.isArray(item) ? item : null,
    refreshedAt: ok ? refreshedAt : null,
  };
}
