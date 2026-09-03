import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const landing = readSource("./LandingPage.tsx");
const bookingModal = readSource("../components/OnboardingBookingModal.tsx");
const brandProvider = readSource("../branding/BrandProvider.tsx");

test("the existing landing now leads with the APMS value proposition", () => {
  assert.match(landing, /Pin&Go opera tu propiedad\. Tú mantienes el control\./);
  assert.match(landing, /Pin&Go runs your property\. You stay in control\./);
  assert.match(landing, /Reserva a acción/);
  assert.match(landing, /Access and hardware/);
  assert.match(landing, /Control por excepción/);
  assert.match(landing, /sin exigir otro PMS para comenzar/i);
  assert.match(landing, /without requiring another PMS to get started/i);
});
test("hardware pricing and the configurator remain part of the landing", () => {
  assert.match(landing, /import HaasConfigurator/);
  assert.match(landing, /<HaasConfigurator/);
  assert.match(landing, /Access Control/);
  assert.match(landing, /Smart Automation/);
  assert.match(landing, /\$14\.99/);
  assert.match(landing, /2 cerraduras = \$29\.98/);
  assert.match(landing, /TTLock/);
  assert.match(landing, /NFC/);
  assert.match(landing, /hardware compatibles/i);
});

test("PMS integrations are optional instead of a prerequisite", () => {
  assert.doesNotMatch(landing, /app\.lodgify\.com\/signup/i);
  assert.match(landing, /Puedes comenzar directamente con Pin&Go/);
  assert.match(landing, /connect a compatible PMS if you already use one/i);
  assert.match(landing, /No para comenzar/);
});

test("the retained booking flow is safe in visual previews", () => {
  assert.match(landing, /bookingType=\{bookingType\}/);
  assert.match(landing, /initialTopic=/);
  assert.match(landing, /previewOnly=\{isVisualPreview\}/);
  assert.match(bookingModal, /if \(previewOnly\)/);
  assert.match(bookingModal, /disabled=\{submitDisabled\}/);
  assert.match(bookingModal, /role="dialog"/);
  assert.match(bookingModal, /aria-modal="true"/);
  assert.match(bookingModal, /new AbortController\(\)/);
  assert.match(bookingModal, /aria-live="polite"/);
});

test("route metadata and the standard Pin&Go brand remain guarded", () => {
  assert.match(landing, /document\.title\s*=\s*t\.metaTitle/);
  assert.match(landing, /description\.content\s*=\s*t\.metaDescription/);
  assert.match(brandProvider, /brand\.kind === "PIN_GO_STANDARD"/);
  assert.match(brandProvider, /path === "\/home"/);
  assert.match(brandProvider, /brand\.kind === "CUSTOM_BRAND" \|\|/);
});
