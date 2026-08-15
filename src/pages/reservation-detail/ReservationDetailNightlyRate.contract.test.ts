import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readReservationDetailPage() {
  return readFile(
    new URL("./ReservationDetailPage.tsx", import.meta.url),
    "utf8"
  );
}

test("reservation detail prefers the canonical nightly rate when present", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /nightlyRate !== null[\s\S]*?nightlyRate !== undefined[\s\S]*?Number\.isFinite\(Number\(nightlyRate\)\)[\s\S]*?title: "Nightly Rate"[\s\S]*?amount: Number\(nightlyRate\)/
  );
});

test("historical fallback is isolated to host-created manual reservations", async () => {
  const source = await readReservationDetailPage();

  assert.match(
    source,
    /function isHostCreatedManualReservation[\s\S]*?=== "MANUAL"[\s\S]*?"PIN_GO_MANUAL"/
  );
  assert.match(
    source,
    /if \(!isHostCreatedManualReservation\(reservation\)\)[\s\S]*?amount: null/
  );
  assert.match(
    source,
    /title: "Average Nightly Rate"[\s\S]*?amount: Number\(nightlySubtotal\) \/ Number\(nights\)/
  );
});

test("missing nightly pricing is never presented as a zero-dollar rate", async () => {
  const source = await readReservationDetailPage();

  assert.doesNotMatch(source, /pricingBreakdown\.nightlyRate \?\? 0/);
  assert.match(
    source,
    /nightlyRatePresentation\.amount === null[\s\S]*?\? "—"[\s\S]*?: money\(nightlyRatePresentation\.amount, reservationCurrency\)/
  );
});
