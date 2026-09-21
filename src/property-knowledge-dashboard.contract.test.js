import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const api = read("./api/propertyKnowledge.ts");
const client = read("./api/client.ts");
const page = read("./pages/properties/PropertyKnowledgePage.tsx");
const propertyDetail = read("./pages/property-detail/PropertyDetailPage.tsx");
const router = read("./app/routes/router.tsx");
const shell = read("./app/layout/AppShell.tsx");

test("Property Knowledge requests stay credentialed and property-scoped", () => {
  assert.match(api, /encodeURIComponent\(\s*propertyId\s*\)/);
  assert.match(api, /\/api\/dashboard\/properties\/\$\{/);
  assert.match(api, /property-knowledge/);
  assert.match(api, /includeInactive=true/);
  assert.match(client, /credentials:\s*"include"/);
  assert.doesNotMatch(api, /localStorage|sessionStorage/);
});

test("editing and deactivation require optimistic revisions", () => {
  assert.match(api, /method:\s*"PATCH"/);
  assert.match(api, /JSON\.stringify\(\{ \.\.\.draft, expectedRevision \}\)/);
  assert.match(api, /method:\s*"DELETE"/);
  assert.match(api, /JSON\.stringify\(\{ expectedRevision \}\)/);
  assert.match(page, /editing\.revision/);
  assert.match(page, /entry\.revision/);
});

test("the dashboard exposes only administrative Property Knowledge navigation", () => {
  assert.match(router, /function PropertyAdminRoute/);
  assert.match(router, /user\?\.role === "ORG_ADMIN"/);
  assert.match(router, /user\?\.role === "ADMIN"/);
  assert.match(router, /user\?\.role === "PLATFORM_ADMIN"/);
  assert.match(router, /properties\/:id\/knowledge/);
  assert.match(propertyDetail, /Manage Property Knowledge/);
  assert.match(shell, /return "Property Knowledge"/);
});

test("the editor is bilingual and communicates its security boundary", () => {
  assert.match(page, /English/);
  assert.match(page, /Español/);
  assert.match(page, /Access Engine/);
  assert.match(page, /door codes, lock PINs, access credentials, payment data/);
  assert.match(page, /At least one language must include guest-facing content/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
});

test("deactivation remains an explicit soft-delete interaction", () => {
  assert.match(page, /window\.confirm/);
  assert.match(page, /No data was physically deleted/);
  assert.match(page, /Pin AI will no longer receive this entry/);
});
