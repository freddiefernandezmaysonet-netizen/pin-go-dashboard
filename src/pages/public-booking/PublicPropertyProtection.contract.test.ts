import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./PublicPropertyDetailPage.tsx", import.meta.url), "utf8");
const policy = source.slice(source.indexOf('<details id="property-protection-policy">'), source.indexOf('{property.guestAgreementDisclosure ?'));

test("public disclosure sits with cancellation and guest agreement, without requiring cancellation configuration", () => {
  const section = source.indexOf('id="booking-policies"');
  const protection = source.indexOf('id="property-protection-policy"');
  const agreement = source.indexOf('id="guest-agreement-policy"');
  assert.ok(section >= 0 && protection > section && agreement > protection);
  assert.match(source, /cancellationPolicySummary \|\| publicPropertyProtection \? \(/);
  assert.match(source, /publicPropertyProtection \? \([\s\S]*<details id="property-protection-policy">/);
});

test("only enabled Card on File with a finite positive configured limit is disclosed", () => {
  const guard = source.match(/const publicPropertyProtection =([\s\S]*?);/);
  assert.ok(guard);
  const evaluate = (property: unknown) => runInNewContext(`(${guard[1]})`, { property }, { timeout: 1000 });
  for (const property of [undefined, {}, { propertyProtection: null }]) assert.equal(evaluate(property), null);
  for (const amount of [null, undefined, "", 0, -1, "invalid", Infinity]) {
    assert.equal(evaluate({ propertyProtection: { enabled: true, mode: "CARD_ON_FILE", maxDamageLiabilityAmount: amount } }), null);
  }
  for (const enabled of [false, undefined]) {
    assert.equal(evaluate({ propertyProtection: { enabled, mode: "CARD_ON_FILE", maxDamageLiabilityAmount: 500 } }), null);
  }
  assert.equal(evaluate({ propertyProtection: { enabled: true, mode: "OTHER", maxDamageLiabilityAmount: 500 } }), null);
  for (const amount of [500, "750.50"]) {
    const propertyProtection = { enabled: true, mode: "CARD_ON_FILE", maxDamageLiabilityAmount: amount };
    assert.equal(evaluate({ propertyProtection }), propertyProtection);
  }
});

test("disclosure includes bilingual limit and no-deposit/no-hold copy, without case data", () => {
  assert.match(policy, /preferredLanguage === "es"/);
  assert.match(policy, /Protección por daños/);
  assert.match(policy, /Property Protection/);
  assert.match(policy, /formatMoney\(publicPropertyProtection.maxDamageLiabilityAmount\)/);
  assert.match(policy, /No se cobra un depósito ni se retienen fondos/);
  assert.match(policy, /No security deposit is charged and no funds are held/);
  assert.match(policy, /no se añade al precio/);
  assert.match(policy, /not added to the price/);
  assert.doesNotMatch(policy, /<input|damageCase|approvedAmount|evidence|fetch\(/);
});

test("existing explicit checkout consent and accepted-limit payload remain intact", () => {
  assert.match(source, /useState\(false\)/);
  assert.match(source, /checked=\{propertyProtectionConsentAccepted\}/);
  assert.match(source, /!propertyProtectionConsentAccepted/);
  assert.match(source, /guestAcceptedPropertyProtectionConsentVersion:/);
  assert.match(source, /guestAcceptedPropertyProtectionMaxDamageLiabilityAmount:/);
});
