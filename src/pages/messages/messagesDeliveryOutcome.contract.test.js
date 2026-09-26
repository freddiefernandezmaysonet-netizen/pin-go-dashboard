import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./MessagesPage.tsx", import.meta.url);

async function readPage() {
  return readFile(pageUrl, "utf8");
}

test("MessagesPage consumes provider delivery outcome fields", async () => {
  const source = await readPage();

  for (const field of [
    "providerDeliveryStatus",
    "providerStatusUpdatedAt",
    "providerErrorCode",
    "providerErrorMessage",
    "deliveredAt",
  ]) {
    assert.match(source, new RegExp(field));
  }

  assert.match(source, /function DeliveryBadge/);
  assert.match(source, /Provider Issues/);
  assert.match(source, /Accepted \/ Sent/);
  assert.match(source, /Delivered/);
});

test("provider terminal outcomes are shown as issues without manual email retry", async () => {
  const source = await readPage();

  for (const status of [
    "FAILED",
    "BOUNCED",
    "SUPPRESSED",
    "COMPLAINED",
    "UNDELIVERED",
    "CANCELED",
  ]) {
    assert.match(source, new RegExp(`"${status}"`));
  }

  assert.match(
    source,
    /String\(m\.channel \|\| ""\)\.toLowerCase\(\) === "sms"/
  );
  assert.match(
    source,
    /String\(m\.status \|\| ""\)\.toUpperCase\(\) === "FAILED"/
  );
  assert.doesNotMatch(
    source,
    /String\(m\.providerDeliveryStatus[^\n]+=== "FAILED"[\s\S]{0,200}retryMessage/
  );
});

test("send status and provider delivery are separate table columns", async () => {
  const source = await readPage();

  const sendStatus = source.indexOf(">Send Status<");
  const delivery = source.indexOf(">Delivery<");
  const retries = source.indexOf(">Retries<");

  assert.ok(sendStatus >= 0);
  assert.ok(delivery > sendStatus);
  assert.ok(retries > delivery);
});
