import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./GuestCancellationPage.tsx", import.meta.url),
  "utf8"
);

test("Manage Reservation loads Property Protection case with existing guest token", () => {
  assert.match(source, /\/property-protection-case/);
  assert.match(source, /encodeURIComponent\(\s*token\s*\)/);
  assert.match(source, /cache: "no-store"/);
});

test("guest only sees the Damage Case when backend marks it available", () => {
  assert.match(source, /propertyProtectionCase\?\.available/);
  assert.match(source, /propertyProtectionCase\.damageCase/);
  assert.match(source, /propertyProtectionCase\.propertyProtection/);
});

test("guest sees approved case details and accepted liability limit", () => {
  assert.match(source, /Reported amount/);
  assert.match(source, /Approved amount/);
  assert.match(source, /Accepted maximum liability/);
  assert.match(source, /Description/);
  assert.match(source, /Documented evidence/);
});

test("Damage Case guest presentation follows reservation preferred language", () => {
  assert.match(source, /preferredLanguage === "es"/);
  assert.match(source, /Protección de la propiedad/);
  assert.match(source, /Reporte de daños/);
  assert.match(source, /Responsabilidad máxima aceptada/);
  assert.match(source, /Evidencia documentada/);
});

test("Manage Reservation explicitly states collection status without financial controls", () => {
  assert.match(source, /No charge has been made for this report/);
  assert.match(source, /No se ha realizado ningún cargo por este reporte/);
  assert.match(source, /This case was closed without a charge/);
  assert.doesNotMatch(source, /Charge guest/);
  assert.doesNotMatch(source, /paymentIntents/);
  assert.doesNotMatch(source, /stripeDamageCustomerId/);
  assert.doesNotMatch(source, /stripeDamagePaymentMethodId/);
});


test("approved Damage Case is rendered independently of cancellation management phase", () => {
  const protectionIndex = source.indexOf("propertyProtectionCase?.available");
  const phaseIndex = source.indexOf('managementPhase === "IN_STAY"');
  const preStayReservationIndex = source.indexOf(
    "preview?.reservation && preview?.policy && preview?.evaluation"
  );

  assert.ok(protectionIndex > 0);
  assert.ok(phaseIndex > protectionIndex);
  assert.ok(preStayReservationIndex > protectionIndex);
});
