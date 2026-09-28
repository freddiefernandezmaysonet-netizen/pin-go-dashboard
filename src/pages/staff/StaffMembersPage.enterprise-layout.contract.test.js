import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./StaffMembersPage.tsx", import.meta.url), "utf8");

test("Staff cards use one full-width column and compact assignment rows", () => {
  assert.match(source, /gridTemplateColumns: "minmax\(0, 1fr\)"/);
  assert.match(source, /staff-assignment-row/);
  assert.match(source, /"Close"/);
  assert.match(source, /"Configure"/);
});

test("timing editor stays progressive and preserves canonical fields", () => {
  for (const field of [
    "cleaningDurationCommitmentMinutes",
    "cleaningStartConfirmationGraceMinutes",
    "cleaningFollowupGraceMinutes",
  ]) assert.match(source, new RegExp(field));
  assert.match(source, /Start reminder after \(minutes\)/);
  assert.match(source, /Follow-up after \(minutes\)/);
  assert.match(source, /NFC access is unchanged/);
});

test("layout does not add provider or messaging behavior", () => {
  assert.doesNotMatch(source, /sendSms|sendLoggedSms|ttlockApi|\/ttlock\//i);
});
