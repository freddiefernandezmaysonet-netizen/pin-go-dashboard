import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const card = fs.readFileSync("src/components/properties/PropertyListingDetailsCard.tsx", "utf8");
const editor = fs.readFileSync("src/components/properties/RoomLayoutEditor.tsx", "utf8");
const page = fs.readFileSync("src/pages/properties/PropertyEditPage.tsx", "utf8");

test("property editor mounts canonical listing details card", () => {
  assert.match(page, /PropertyListingDetailsCard/);
  assert.match(page, /maxGuests=/);
});

test("card uses dedicated authenticated listing-details API", () => {
  assert.match(card, /\/api\/dashboard\/properties\/\$\{propertyId\}\/listing-details/);
  assert.match(card, /credentials:"include"/);
  assert.match(card, /method:"PUT"/);
});

test("unknown remains explicit for unconfirmed factual states", () => {
  assert.match(card, /Not confirmed/);
  assert.match(card, /value="UNKNOWN"/);
});

test("minimum primary booking guest age is separate from Adults Only", () => {
  assert.match(card, /Minimum primary booking guest age/);
  assert.match(card, /Adults only/);
});

test("room layout distinguishes bedrooms from other sleeping areas", () => {
  assert.match(editor, /BEDROOM/);
  assert.match(editor, /SLEEPING_AREA/);
  assert.match(editor, /SOFA_BED/);
});
