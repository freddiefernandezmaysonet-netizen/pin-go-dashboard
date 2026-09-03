import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const landing = readSource("./LandingPage.tsx");
const landingCss = readSource("./LandingPage.css");
const bookingModal = readSource("../components/OnboardingBookingModal.tsx");
const brandProvider = readSource("../branding/BrandProvider.tsx");

test("the first screen positions Pin&Go as an APMS with governed autonomy", () => {
  assert.match(landing, /Pin&Go opera la rutina\./);
  assert.match(landing, /Tú mantienes el control\./);
  assert.match(landing, /Pin&Go runs the routine\./);
  assert.match(landing, /You stay in control\./);
  assert.match(landing, /No necesitas otro PMS para comenzar\./);
  assert.match(landing, /human (?:decision|judgment)|human by exception/i);
});

test("pricing presents the APMS software offer and Puerto Rico tax clearly", () => {
  assert.match(landing, /\$39\.99/);
  assert.match(landing, /11\.5%/);
  assert.match(landing, /\$44\.59/);
  assert.match(landing, /hardware opcional/i);
  assert.match(landing, /optional hardware/i);
});

test("the landing removes the legacy add-on funnel and preserves CTA intent", () => {
  assert.doesNotMatch(
    landing,
    /\$14\.99|Guesty|Hostaway|Lodgify|HaasConfigurator|app\.pin-ngo\.com\/signup/i
  );
  assert.match(landing, /openCall\("demo"\)/);
  assert.match(landing, /openCall\("activation"\)/);
  assert.match(landing, /openCall\("hardware"\)/);
  assert.doesNotMatch(landing, /openCall\("onboarding"\)/);
  assert.match(landing, /key=\{bookingSession\}/);
  assert.match(landing, /initialTopic=\{t\.bookingTopics\[bookingIntent\]\}/);
  assert.match(landing, /previewOnly=\{isVisualPreview\}/);
  assert.match(bookingModal, /if \(previewOnly\)/);
  assert.match(bookingModal, /disabled=\{submitDisabled\}/);
});

test("the APMS operating loop is explicit in Spanish and English", () => {
  for (const step of [
    "Detecta",
    "Decide",
    "Ejecuta",
    "Verifica",
    "Recupera",
    "Registra",
    "Detect",
    "Decide",
    "Execute",
    "Verify",
    "Recover",
    "Record",
  ]) {
    assert.match(landing, new RegExp(`\\b${step}\\b`, "i"), `${step} missing`);
  }
  assert.match(landing, /Mission Control/);
  assert.match(landing, /TTLock/);
});

test("route metadata, branding, modal accessibility and compact landscape are guarded", () => {
  assert.match(landing, /document\.title\s*=\s*t\.metaTitle/);
  assert.match(landing, /document\.documentElement\.lang\s*=\s*lang/);
  assert.match(
    landing,
    /(?:landingDescription|description)\.content\s*=\s*t\.metaDescription/
  );
  assert.match(landing, /return \(\) => \{/);

  assert.match(brandProvider, /brand\.kind === "PIN_GO_STANDARD"/);
  assert.match(brandProvider, /path === "\/home"/);
  assert.match(brandProvider, /brand\.kind === "CUSTOM_BRAND" \|\|/);
  assert.match(brandProvider, /!isStandardLanding/);

  assert.match(bookingModal, /role="dialog"/);
  assert.match(bookingModal, /aria-modal="true"/);
  assert.match(bookingModal, /new AbortController\(\)/);
  assert.match(bookingModal, /signal:\s*controller\.signal/);
  assert.match(bookingModal, /controller\.abort\(\)/);
  assert.match(bookingModal, /addEventListener\("keydown"/);
  assert.match(bookingModal, /event\.key === "Escape"/);
  assert.match(bookingModal, /event\.key !== "Tab"/);
  assert.match(bookingModal, /\.focus\(\)/);
  assert.match(bookingModal, /aria-live="polite"/);
  assert.match(landing, /<main id="pg-main" tabIndex=\{-1\}>/);

  assert.match(
    landingCss,
    /@media[^\n{]*orientation:\s*landscape[^\n{]*\{/i
  );
  assert.match(landingCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
});
