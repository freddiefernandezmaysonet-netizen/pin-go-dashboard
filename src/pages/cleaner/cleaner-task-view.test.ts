import test from "node:test";
import assert from "node:assert/strict";
import type { CleanerTask } from "../../api/cleaner";
import { belongsToCleanerView } from "./cleaner-task-view";
const now = new Date("2026-10-08T02:00:00Z"); // Still Oct 7 in Puerto Rico.
const task: CleanerTask = { id: "own", property: { id: "p", name: "Property", timezone: "America/Puerto_Rico" }, status: "CONFIRMED", departureAt: "2026-10-06T16:00:00Z", scheduledStartAt: "2026-10-06T17:00:00Z", durationCommitmentMinutes: 60, startedAt: null, completedAt: null, access: null };
test("unfinished prior-day task belongs to Earlier unfinished, not Today or History", () => {
  for (const status of ["PENDING", "CONFIRMED", "IN_PROGRESS"]) {
    assert.equal(belongsToCleanerView({ ...task, status }, "today", now), false);
    assert.equal(belongsToCleanerView({ ...task, status }, "history", now), false);
    assert.equal(belongsToCleanerView({ ...task, status }, "overdue", now), true);
  }
});
test("completed and withdrawn prior-day work belongs to History", () => {
  for (const status of ["COMPLETED", "CANCELLED", "REASSIGNED", "EXPIRED", "DECLINED"]) {
    assert.equal(belongsToCleanerView({ ...task, status }, "today", now), false);
    assert.equal(belongsToCleanerView({ ...task, status }, "history", now), true);
    assert.equal(belongsToCleanerView({ ...task, status }, "overdue", now), false);
  }
});
test("each property decides its own local day across UTC midnight", () => {
  const sameDay = { ...task, scheduledStartAt: "2026-10-08T03:00:00Z" };
  assert.equal(belongsToCleanerView(sameDay, "today", now), true);
  assert.equal(belongsToCleanerView(sameDay, "upcoming", now), false);
  assert.equal(belongsToCleanerView({ ...sameDay, scheduledStartAt: "2026-10-08T16:00:00Z" }, "upcoming", now), true);
});

test("All includes past, current and future tasks regardless of closure", () => {
  for (const status of ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REASSIGNED", "EXPIRED", "DECLINED"]) {
    for (const scheduledStartAt of ["2026-10-06T16:00:00Z", "2026-10-07T16:00:00Z", "2026-10-09T16:00:00Z"]) assert.equal(belongsToCleanerView({ ...task, status, scheduledStartAt }, "all", now), true);
  }
});
