import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./StaffMembersPage.tsx", import.meta.url), "utf8");

test("Staff property assignments expose all Cleaning Follow-up timing fields", () => {
  for (const field of [
    "cleaningDurationCommitmentMinutes",
    "cleaningStartConfirmationGraceMinutes",
    "cleaningFollowupGraceMinutes",
  ]) assert.match(source, new RegExp(field));
  assert.match(source, /Standard cleaning time \(minutes\)/);
  assert.match(source, /Start confirmation grace \(minutes\)/);
  assert.match(source, /Follow-up grace \(minutes\)/);
});

test("timings are sent only for active property roles and NFC copy remains unchanged", () => {
  assert.match(source, /\.\.\.\(p\.assignment\?\.role/);
  assert.match(source, /NFC access is unchanged/);
  assert.doesNotMatch(source, /sendSms|sendLoggedSms|ttlockApi|\/ttlock\//i);
});
