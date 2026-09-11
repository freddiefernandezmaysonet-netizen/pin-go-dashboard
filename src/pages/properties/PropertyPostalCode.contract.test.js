import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const createSource = fs.readFileSync("src/pages/onboarding/CreatePropertyPage.tsx", "utf8");
const editSource = fs.readFileSync("src/pages/properties/PropertyEditPage.tsx", "utf8");
const apiSource = fs.readFileSync("src/api/properties.ts", "utf8");

test("Create Property captures and submits postal code as text", () => {
  assert.match(apiSource, /postalCode\?: string;/);
  assert.match(createSource, /componentValue\("postal_code"\)/);
  assert.match(createSource, /setPostalCode\(nextPostalCode\)/);
  assert.match(createSource, /postalCode,/);
  assert.match(createSource, /ZIP \/ Postal Code/);
  assert.match(createSource, /autoComplete="postal-code"/);
  assert.doesNotMatch(createSource, /Number\(postalCode\)/);
});

test("Property Edit loads, edits, and submits postal code without numeric coercion", () => {
  assert.match(editSource, /postalCode\?: string \| null;/);
  assert.match(editSource, /postalCode: p\.postalCode \?\? ""/);
  assert.match(editSource, /postalCode: form\.postalCode/);
  assert.match(editSource, /value=\{form\.postalCode\}/);
  assert.match(editSource, /ZIP \/ Postal Code/);
  assert.doesNotMatch(editSource, /Number\(form\.postalCode\)/);
});
