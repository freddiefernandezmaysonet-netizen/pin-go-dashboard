import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const card = fs.readFileSync("src/components/properties/PropertyListingDetailsCard.tsx", "utf8");
const boundary = fs.readFileSync("src/components/properties/propertyListingDetails.form.ts", "utf8");
const editor = fs.readFileSync("src/components/properties/RoomLayoutEditor.tsx", "utf8");
const collections = fs.readFileSync("src/components/properties/ListingCollectionsEditor.tsx", "utf8");
const page = fs.readFileSync("src/pages/properties/PropertyEditPage.tsx", "utf8");

test("property editor mounts canonical listing details card", () => {
  assert.match(page, /PropertyListingDetailsCard/);
  assert.match(page, /maxGuests=/);
});
test("card uses the tested authenticated GET/PUT boundary", () => {
  assert.match(card, /\/listing-details/);
  assert.match(card, /requestListingDetails\(fetch/);
  assert.match(boundary, /credentials:\s*"include"/);
  assert.match(boundary, /\? "GET" : "PUT"/);
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
test("failed loading cannot expose the save action and offers a retry", () => {
  assert.match(card, /if \(loadState === "error"\) return/);
  assert.match(card, /if \(loadState !== "ready" \|\| saveRequest.current\) return/);
  assert.match(card, /Retry loading listing details/);
});
test("each property has isolated form state and cancellable requests", () => {
  assert.match(card, /key=\{props.propertyId\}/);
  assert.match(card, /controller.abort\(\)/);
  assert.match(card, /saveRequest.current\?\.abort\(\)/);
});
test("an in-flight save disables the section, not just its save button", () => {
  assert.match(card, /<fieldset disabled=\{saving\}/);
  assert.match(card, /saveRequest.current = controller/);
});
test("Enter in a listing input cannot submit the outer property form", () => {
  assert.match(card, /event.key === "Enter"/);
  assert.match(card, /event.preventDefault\(\); event.stopPropagation\(\)/);
});

test("shared spaces, safety and additional considerations are editable", () => {
  assert.match(card, /ListingCollectionsEditor/);
  assert.match(collections, /Espacios compartidos \/ Shared spaces/);
  assert.match(collections, /Consideraciones de seguridad \/ Safety considerations/);
  assert.match(collections, /Condiciones particulares \/ Additional considerations/);
});
test("host listing configuration presents bilingual section labels", () => {
  assert.match(card, /Información del alojamiento y requisitos \/ Accommodation & guest requirements/);
  assert.match(editor, /Distribución de habitaciones y camas \/ Room & bed layout/);
});
