import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./ReservationDetailPage.tsx", import.meta.url),
  "utf8"
);

test("Property Protection UI is reservation-snapshot gated", () => {
  assert.match(source, /data\.propertyProtection\?\.required/);
  assert.match(source, /Maximum liability/);
  assert.match(source, /Card on File/);
  assert.match(source, /cardOnFileStatus/);
});

test("host can create a documented Damage Case only through authenticated API", () => {
  assert.match(source, /\/api\/dashboard\/reservations\/\$\{id\}\/damage-case/);
  assert.match(source, /credentials: "include"/);
  assert.match(source, /requestedAmount/);
  assert.match(source, /evidence: \{ notes: damageEvidenceNotes\.trim\(\) \}/);
  assert.match(source, /Create damage case/);
});

test("UI supports review and approval but makes no financial request", () => {
  assert.match(source, /\/submit-review/);
  assert.match(source, /\/approve/);
  assert.match(source, /GUEST_NOTIFICATION_PENDING/);
  assert.match(source, /guest notification required before collection/);
  assert.match(source, /No charge has been made/);
  assert.doesNotMatch(source, /paymentIntents/);
  assert.doesNotMatch(source, /charges\./);
  assert.doesNotMatch(source, /Charge guest/);
});

test("UI supports explicit close without charge", () => {
  assert.match(source, /\/close-no-charge/);
  assert.match(source, /Close without charge/);
  assert.match(source, /Damage case closed without a charge/);
});

test("Card on File must be READY before creating a Damage Case", () => {
  assert.match(
    source,
    /data\.propertyProtection\.cardOnFileStatus !== "READY"/
  );
});
