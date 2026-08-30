import test from "node:test";
import assert from "node:assert/strict";
import { MISSION_CONTROL_POLL_INTERVAL_MS, createMissionControlRefreshState } from "./apmsMissionControlFreshness.js";

test("Mission Control polls every 15 seconds", () => { assert.equal(MISSION_CONTROL_POLL_INTERVAL_MS, 15000); });
test("successful refresh accepts only object evidence", () => {
 const at = new Date("2026-08-29T23:30:00Z");
 assert.deepEqual(createMissionControlRefreshState({ok:true,item:{autopilotStatus:"ACTIVE"},refreshedAt:at}), {snapshot:{autopilotStatus:"ACTIVE"},refreshedAt:at});
 assert.equal(createMissionControlRefreshState({ok:true,item:null,refreshedAt:at}).snapshot, null);
});
test("failed refresh is fail-closed and clears stale snapshot", () => {
 const result=createMissionControlRefreshState({ok:false,item:{autopilotStatus:"ACTIVE"}});
 assert.equal(result.snapshot,null); assert.equal(result.refreshedAt,null);
});
