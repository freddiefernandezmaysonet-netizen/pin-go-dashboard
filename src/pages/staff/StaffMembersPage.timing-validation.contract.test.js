import assert from "node:assert/strict";import fs from "node:fs";import test from "node:test";
const source=fs.readFileSync(new URL("./StaffMembersPage.tsx",import.meta.url),"utf8");
test("Dashboard blocks zero-width start reminder configuration",()=>{assert.match(source,/cleaningStartConfirmationGraceMinutes >= assignment\.cleaningDurationCommitmentMinutes/);assert.match(source,/Start reminder must be earlier than the standard cleaning time/);assert.match(source,/aria-invalid=\{Boolean\(timingError\)\}/);});
test("mobile assignment layout remains explicit",()=>{assert.match(source,/@media \(max-width: 620px\)/);assert.match(source,/staff-assignment-row/);assert.match(source,/grid-template-columns: minmax\(0, 1fr\) !important/);});
