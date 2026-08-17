import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readDemoCenterPage() {
  return readFile(
    new URL("./AdminDemoCenterPage.tsx", import.meta.url),
    "utf8"
  );
}

test("Demo Center submits the production delivery recipient contract", async () => {
  const source = await readDemoCenterPage();

  assert.match(
    source,
    /guestName:\s*guestName\.trim\(\)[\s\S]*guestEmail:\s*guestEmail\.trim\(\)[\s\S]*guestPhone:\s*guestPhone\.trim\(\) \|\| null[\s\S]*preferredLanguage,[\s\S]*smsConsent,/
  );
  assert.match(
    source,
    /if \(!guestEmail\.trim\(\)\)[\s\S]*Enter the email that should receive the access code/
  );
});

test("Demo Center requires a phone only when SMS consent is enabled", async () => {
  const source = await readDemoCenterPage();

  assert.match(
    source,
    /if \(smsConsent && !guestPhone\.trim\(\)\)/
  );
  assert.match(
    source,
    /checked=\{smsConsent\}[\s\S]*setSmsConsent\(event\.target\.checked\)/
  );
  assert.match(
    source,
    /authorized[\s\S]*transactional messages[\s\S]*controlled internal demo/
  );
});

test("Demo Center no longer contains fixed delivery contacts", async () => {
  const source = await readDemoCenterPage();

  assert.doesNotMatch(
    source,
    /demo@pingo\.com|\+17876768198/
  );
  assert.match(
    source,
    /Email will be sent through the production delivery flow/
  );
  assert.match(
    source,
    /SMS follows the same flow[\s\S]*only when the confirmation[\s\S]*above is selected/
  );
});
