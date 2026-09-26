import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("./PropertyListingDetailsCard.tsx", import.meta.url), "utf8");
const form = await readFile(new URL("./propertyListingDetails.form.ts", import.meta.url), "utf8");
const types = await readFile(new URL("./propertyListingDetails.types.ts", import.meta.url), "utf8");

test("discovery UI exposes canonical property types, features and free-form experience tags", () => {
  assert.match(card, /Tipo de propiedad \/ Property type/);
  assert.match(card, /\["CABIN", "Cabaña \/ Cabin"\]/);
  assert.match(card, /WOOD_CONSTRUCTION/);
  assert.match(card, /OCEAN_VIEW/);
  assert.match(card, /Etiquetas de experiencia \/ Experience tags/);
  assert.match(card, /Romantic retreat, Couples retreat/);
});

test("listing form preserves discovery fields through hydration and payload projection", () => {
  assert.match(types, /propertyType: "" \| PropertyType/);
  assert.match(types, /features: ListingFeature\[\]/);
  assert.match(types, /experienceTags: ExperienceTag\[\]/);
  assert.match(form, /propertyType: \["HOUSE"[\s\S]*"CABIN"/);
  assert.match(form, /features: collection\(source\.features/);
  assert.match(form, /experienceTags: collection\(source\.experienceTags/);
  assert.match(form, /Object\.assign\(result, projectCollections\(source\)\)/);
});
