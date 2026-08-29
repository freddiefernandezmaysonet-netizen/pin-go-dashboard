import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSION_CONTROL_AVAILABILITY,
  getMissionControlAvailability,
  getMissionControlDisplayStatus,
  getLiveMissionControlMetric,
  getMissionControlAuditEntries,
  normalizeApmsDecisionHistory,
} from "./apmsMissionControlPresentation.js";

test("missing Mission Control evidence is fail-closed", () => {
  assert.equal(
    getMissionControlAvailability({ loading: false, snapshot: null }),
    MISSION_CONTROL_AVAILABILITY.UNAVAILABLE
  );
  assert.equal(
    getMissionControlDisplayStatus({ loading: false, snapshot: null }),
    "UNAVAILABLE"
  );
});

test("loading Mission Control never renders ACTIVE", () => {
  assert.equal(
    getMissionControlDisplayStatus({ loading: true, snapshot: null }),
    "LOADING"
  );
});

test("live ACTIVE is rendered only from a real snapshot", () => {
  const snapshot = { autopilotStatus: "ACTIVE" };
  assert.equal(
    getMissionControlAvailability({ loading: false, snapshot }),
    MISSION_CONTROL_AVAILABILITY.LIVE
  );
  assert.equal(
    getMissionControlDisplayStatus({ loading: false, snapshot }),
    "ACTIVE"
  );
});

test("missing live metric stays unknown instead of fabricating 100 or 0", () => {
  assert.equal(getLiveMissionControlMetric(null, ["autonomyScore", "score"]), null);
  assert.equal(
    getLiveMissionControlMetric({ autonomyScore: { score: null } }, ["autonomyScore", "score"]),
    null
  );
  assert.equal(
    getLiveMissionControlMetric({ autonomyScore: { score: 97 } }, ["autonomyScore", "score"]),
    97
  );
});

test("APMS history prefers activityHistory and falls back to recentAuditEntries", () => {
  assert.deepEqual(getMissionControlAuditEntries({ activityHistory: [{ decisionId: "a" }] }), [
    { decisionId: "a" },
  ]);
  assert.deepEqual(
    getMissionControlAuditEntries({ recentAuditEntries: [{ decisionId: "b" }] }),
    [{ decisionId: "b" }]
  );
  assert.deepEqual(getMissionControlAuditEntries(null), []);
});

test("APMS decision history deduplicates decision IDs and sorts newest first", () => {
  const rows = normalizeApmsDecisionHistory([
    {
      propertyId: "p1",
      propertyName: "One",
      snapshot: {
        activityHistory: [
          { decisionId: "old", engine: "Revenue", completedAt: "2026-08-29T10:00:00Z" },
          { decisionId: "dup", engine: "Revenue", completedAt: "2026-08-29T11:00:00Z" },
        ],
      },
    },
    {
      propertyId: "p1",
      propertyName: "One",
      snapshot: {
        activityHistory: [
          { decisionId: "dup", engine: "Revenue", completedAt: "2026-08-29T11:00:00Z" },
          { decisionId: "new", engine: "Access", completedAt: "2026-08-29T12:00:00Z" },
        ],
      },
    },
  ]);

  assert.deepEqual(rows.map((row) => row.decisionId), ["new", "dup", "old"]);
  assert.equal(rows[0].propertyId, "p1");
});
