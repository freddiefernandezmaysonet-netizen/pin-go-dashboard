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

test("guest response uses the existing token and non-charging response endpoint", () => {
  assert.match(source, /\/property-protection-case\/respond/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /action,/);
  assert.match(source, /note: action === "DISPUTED"/);
  assert.match(source, /loadPropertyProtectionCase\(\)/);
});

test("guest can acknowledge without accepting and then advance", () => {
  assert.match(source, /"ACKNOWLEDGED"/);
  assert.match(source, /Confirmar recibido/);
  assert.match(source, /Acknowledge receipt/);
  assert.match(source, /Esto no significa que lo aceptaste/);
  assert.match(source, /This does not mean you accepted it/);
  assert.match(source, /Aceptar reporte/);
  assert.match(source, /Accept report/);
});

test("acceptance requires explicit confirmation", () => {
  assert.match(source, /action === "ACCEPTED"/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /aceptas el reporte de daños aprobado/);
  assert.match(source, /accept the approved damage report/);
});

test("dispute requires a bounded explanation", () => {
  assert.match(source, /action === "DISPUTED" && !note/);
  assert.match(source, /maxLength=\{2000\}/);
  assert.match(source, /Explicación de la disputa/);
  assert.match(source, /Dispute explanation/);
  assert.match(source, /Disputar reporte/);
  assert.match(source, /Dispute report/);
});

test("accepted and disputed responses are final in the guest UI", () => {
  assert.match(
    source,
    /guestResponse ===\s*"ACCEPTED"[\s\S]*guestResponse ===\s*"DISPUTED"/
  );
  assert.match(source, /Respuesta final/);
  assert.match(source, /Final response/);
  assert.match(source, /guestResponseNote/);
});

test("guest response keeps the explicit non-charging boundary", () => {
  assert.match(source, /Ninguna opción realiza un cargo/);
  assert.match(source, /No option makes a charge/);
  assert.doesNotMatch(source, /Charge damage report/);
  assert.doesNotMatch(source, /createPaymentIntent/);
  assert.doesNotMatch(source, /captureDamage/);
});

