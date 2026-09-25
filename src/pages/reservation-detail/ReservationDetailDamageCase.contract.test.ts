import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("./ReservationDetailPage.tsx", import.meta.url),
  "utf8"
);

test("checkout eligibility fails closed and respects the exact cutoff and extensions", () => {
  const helper = source.slice(source.indexOf("function isDamageCheckoutComplete("), source.indexOf("export function ReservationDetailPage"));
  const evaluate = runInNewContext(ts.transpile(helper) + ";isDamageCheckoutComplete");
  const checkout = "2026-09-23T11:00:00-04:00";
  const cutoff = Date.parse("2026-09-23T15:00:00Z");
  assert.equal(evaluate(checkout, cutoff - 1), false);
  assert.equal(evaluate(checkout, cutoff), false);
  assert.equal(evaluate(checkout, cutoff + 1), true);
  assert.equal(evaluate("2026-09-24T15:00:00Z", cutoff + 1), false);
  for (const invalid of [undefined, "", "invalid"]) assert.equal(evaluate(invalid, cutoff), false);
  assert.equal(evaluate(checkout, NaN), false);
});

test("approval is disabled and guarded while internal documentation remains available", () => {
  const approval = source.slice(source.indexOf("async function approveDamageCase"), source.indexOf("async function closeDamageCaseNoCharge"));
  assert.ok(approval.indexOf("!isDamageCheckoutComplete(data.checkOut, Date.now())") < approval.indexOf("await damageCaseRequest"));
  assert.match(source, /onClick=\{approveDamageCase\}\s+disabled=\{damageSubmitting \|\| !damageCheckoutComplete\}/);
  assert.match(source, /aria-describedby=\{!damageCheckoutComplete \? "damage-checkout-help" : undefined\}/);
  const documentation = source.slice(source.indexOf("async function createDamageCase"), source.indexOf("async function approveDamageCase"));
  assert.doesNotMatch(documentation, /isDamageCheckoutComplete|damageCheckoutComplete/);
  assert.match(source, /window\.clearInterval\(timer\)/);
});

test("checkout rejection is explained in both languages and refreshes the reservation", () => {
  assert.match(source, /You can document damage now/);
  assert.match(source, /Puedes documentar el daño ahora/);
  assert.match(source, /payload\?\.error === "DAMAGE_CASE_CHECKOUT_REQUIRED"[\s\S]*?setRefreshKey[\s\S]*?throw new Error\(DAMAGE_CHECKOUT_MESSAGE\)/);
});

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

test("UI supports review and approval before the isolated payment action", () => {
  assert.match(source, /\/submit-review/);
  assert.match(source, /\/approve/);
  assert.match(source, /GUEST_NOTIFICATION_PENDING/);
  assert.match(source, /guest notification required before collection/);
  assert.match(source, /No charge has been made/);
  assert.doesNotMatch(source, /paymentIntents/);
  assert.doesNotMatch(source, /charges\./);
  assert.doesNotMatch(source, /paymentIntents|charges\.|capture_method/);
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

test("host payment action is exact, authenticated, bilingual and explicitly confirmed", () => {
  assert.match(source, /\/api\/dashboard\/damage-cases\/\$\{damageCase\.id\}\/charge/);
  assert.match(source, /method: "POST", credentials: "include"/);
  assert.match(source, /authorization\.amountMinor \/ 100/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /not a hold/);
  assert.match(source, /no es una retención/);
  assert.match(source, /Charge authorized amount/);
  assert.match(source, /Cobrar monto autorizado/);
  assert.doesNotMatch(source, /client_secret|stripeDamagePaymentMethodId/);
});

test("payment presentation fails closed for every non-ready state", () => {
  const helper = source.slice(
    source.indexOf("function getDamagePaymentPresentation("),
    source.indexOf("export function ReservationDetailPage")
  );
  const evaluate = runInNewContext(
    ts.transpile(helper) + ";getDamagePaymentPresentation"
  );
  const base = {
    status: "GUEST_NOTIFIED",
    guestResponse: "ACCEPTED",
    paymentAuthorization: { amountMinor: 10025, currency: "usd" },
    paymentAttempt: null,
  };
  assert.deepEqual({ ...evaluate(base, true) }, {
    state: "READY", canCharge: true, canCloseWithoutCharge: true,
  });
  for (const [status, expected] of [
    ["PREPARED", "PROCESSING"],
    ["PROCESSING", "PROCESSING"],
    ["REQUIRES_ACTION", "REQUIRES_ACTION"],
    ["FAILED", "FAILED"],
    ["CANCELED", "CANCELED"],
    ["SUCCEEDED", "SUCCEEDED"],
  ]) {
    const result = evaluate({ ...base, paymentAttempt: { status } }, true);
    assert.equal(result.state, expected);
    assert.equal(result.canCharge, false);
  }
  assert.equal(evaluate({ ...base, paymentAuthorization: null }, true).state, "WAITING_PAYMENT_AUTHORIZATION");
  assert.equal(evaluate({ ...base, guestResponse: "PENDING" }, true).state, "WAITING_GUEST_ACCEPTANCE");
  assert.equal(evaluate(base, false).state, "WAITING_CHECKOUT");
});
