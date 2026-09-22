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


test("UI surfaces recorded evidence and mirrors liability bounds before server enforcement", () => {
  assert.match(source, /Evidence notes:/);
  assert.match(source, /Damage amount cannot exceed the reservation liability limit/);
  assert.match(source, /Approved amount cannot exceed the reported damage or reservation liability limit/);
  assert.match(source, /maxDamageLiabilityAmount/);
});

test("host sees every guest Damage Case response state", () => {
  assert.match(source, /Guest response/);
  assert.match(source, /Response status:/);
  assert.match(source, /"PENDING"/);
  assert.match(source, /"ACKNOWLEDGED"/);
  assert.match(source, /"ACCEPTED"/);
  assert.match(source, /"DISPUTED"/);
  assert.match(source, /guestAcknowledgedAt/);
  assert.match(source, /guestRespondedAt/);
  assert.match(source, /Guest explanation:/);
  assert.match(source, /guestResponseNote/);
});

test("acknowledgement is not presented as acceptance", () => {
  assert.match(source, /confirmed receipt of the report/);
  assert.match(source, /This is not an[\s\S]*acceptance of the approved report/);
  assert.match(source, /Acknowledged:/);
});

test("guest response presentation remains explicitly non-charging", () => {
  assert.match(source, /Awaiting the guest&apos;s response\. No charge has been made\./);
  assert.match(source, /Acceptance did not[\s\S]*execute a charge/);
  assert.match(source, /disputed the approved report\. No charge has been[\s\S]*made/);
  assert.doesNotMatch(source, /Charge accepted case/);
  assert.doesNotMatch(source, /Capture payment/);
  assert.doesNotMatch(source, /Create PaymentIntent/);
});

