/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readOverviewPage() {
  return readFile(
    new URL("./OverviewPage.tsx", import.meta.url),
    "utf8"
  );
}

test("overview cards use accessible application links", async () => {
  const source = await readOverviewPage();

  assert.match(source, /import \{ Link \} from "react-router-dom"/);
  assert.match(
    source,
    /<Link[\s\S]*to=\{to\}[\s\S]*aria-label=\{label\}/
  );
  assert.match(source, /onFocus=\{\(\) => setFocused\(true\)\}/);
  assert.match(source, /onBlur=\{\(\) => setFocused\(false\)\}/);
  assert.match(source, /cursor:\s*"pointer"/);
});

test("overview metric cards navigate to their operational sections", async () => {
  const source = await readOverviewPage();

  assert.match(
    source,
    /title="Upcoming Arrivals"[\s\S]*?to="\/reservations"/
  );
  assert.match(
    source,
    /title="Guests In House"[\s\S]*?to="\/reservations"/
  );
  assert.match(
    source,
    /title="Checkouts Today"[\s\S]*?to="\/reservations"/
  );
  assert.match(
    source,
    /title="Active Locks"[\s\S]*?to="\/locks"/
  );
  assert.match(
    source,
    /title="Properties"[\s\S]*?to="\/properties"/
  );
});

test("overview operational cards link to locks, integrations and health", async () => {
  const source = await readOverviewPage();

  assert.match(
    source,
    /to="\/locks"[\s\S]*label="Open Locks Capacity"/
  );
  assert.match(
    source,
    /to="\/integrations\/pms"[\s\S]*label="Open PMS integrations"/
  );
  assert.match(
    source,
    /to="\/health"[\s\S]*label="Open Health Center"/
  );
});
