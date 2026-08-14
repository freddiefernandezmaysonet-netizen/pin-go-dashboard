import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readReservationDetailPage() {
  return readFile(
    new URL("./ReservationDetailPage.tsx", import.meta.url),
    "utf8"
  );
}

test("host cancellation action is limited to active host-created manual reservations", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /const canCancelManualReservation =[\s\S]*?data\?\.status[\s\S]*?=== "ACTIVE"[\s\S]*?data\?\.source[\s\S]*?=== "MANUAL"[\s\S]*?data\?\.externalProvider[\s\S]*?"PIN_GO_MANUAL"/
  );
  assert.match(
    source,
    /\{canCancelManualReservation \? \([\s\S]*?Cancel manual reservation/
  );
  assert.doesNotMatch(source, /DIRECT_BOOKING[\s\S]*?cancelManualReservation/);
});

test("manual cancellation requires a bounded host reason", async () => {
  const source = await readReservationDetailPage();

  assert.match(source, /const reason = cancellationReason\.trim\(\)/);
  assert.match(source, /if \(!reason\)/);
  assert.match(source, /A cancellation reason is required\./);
  assert.match(source, /maxLength=\{1000\}/);
  assert.match(source, /Cancellation reason/);
});

test("manual cancellation calls only the authenticated host endpoint", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /`\$\{API_BASE\}\/api\/dashboard\/reservations\/\$\{id\}\/cancel-manual`/
  );
  assert.match(source, /method:\s*"POST"/);
  assert.match(source, /credentials:\s*"include"/);
  assert.match(source, /body:\s*JSON\.stringify\(\{ reason \}\)/);
  assert.doesNotMatch(source, /\/api\/booking\/manage/);
  assert.doesNotMatch(source, /\/refund`/);
});

test("manual cancellation prevents duplicate submission", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /!id \|\| !canCancelManualReservation \|\| cancellationSubmitting/
  );
  assert.match(source, /setCancellationSubmitting\(true\)/);
  assert.match(source, /setCancellationSubmitting\(false\)/);
  assert.match(
    source,
    /disabled=\{[\s\S]*?cancellationSubmitting \|\| !cancellationReason\.trim\(\)/
  );
});

test("confirmation explains communications access and unchanged manual payment", async () => {
  const source = await readReservationDetailPage();

  assert.match(source, /close its access lifecycle/);
  assert.match(source, /guest and the related cleaner will be notified/);
  assert.match(source, /manually recorded payment remains unchanged/);
  assert.match(source, /No Stripe refund\s+will be processed/);
  assert.match(source, /Keep reservation/);
});

test("successful cancellation reloads reservation detail from the backend", async () => {
  const source = await readReservationDetailPage();

  assert.match(source, /\}, \[id, refreshKey\]\)/);
  assert.match(source, /setRefreshKey\(\(current\) => current \+ 1\)/);
  assert.match(source, /Manual reservation cancelled successfully\./);
});

test("partial operational finalization is surfaced without denying persisted cancellation", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /payload\.operationalFinalization\?\.ok === false/
  );
  assert.match(
    source,
    /Reservation cancelled\. Some follow-up operations need attention in Mission Control\./
  );
  assert.match(
    source,
    /tone: followUpNeedsAttention \? "warning" : "success"/
  );
});
