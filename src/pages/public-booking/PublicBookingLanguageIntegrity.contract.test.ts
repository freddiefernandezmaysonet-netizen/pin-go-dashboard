import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readSource(name: string) {
  return readFile(new URL(`./${name}`, import.meta.url), "utf8");
}

test("public booking selects an independent description for each language", async () => {
  const [site, detail, propertyEdit] = await Promise.all([
    readSource("PublicBookingSitePage.tsx"),
    readSource("PublicPropertyDetailPage.tsx"),
    readFile(
      new URL("../properties/PropertyEditPage.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(site, /publicDescriptionEs\?: string \| null/);
  assert.match(site, /property\.publicDescriptionEs \|\|/);
  assert.match(detail, /publicDescriptionEs\?: string \| null/);
  assert.match(
    detail,
    /preferredLanguage === "es"[\s\S]*property\?\.publicDescriptionEs \|\| copy\.defaultPropertyDescription/
  );
  assert.match(propertyEdit, /Public Description \(English\)/);
  assert.match(propertyEdit, /Public Description \(Spanish\)/);
  assert.match(propertyEdit, /publicDescriptionEs: form\.publicDescriptionEs/);
});

test("visible booking copy follows the selected language", async () => {
  const [site, detail] = await Promise.all([
    readSource("PublicBookingSitePage.tsx"),
    readSource("PublicPropertyDetailPage.tsx"),
  ]);

  assert.match(site, /isSpanish \? "Cargando propiedades\.\.\." : "Loading properties\.\.\."/);
  assert.match(site, /isSpanish \? "Tarifa disponible pronto" : "Rate available soon"/);
  assert.match(
    detail,
    /buildSecurePreCheckinDisclosureText\([\s\S]*language: GuestLanguage/
  );
  assert.match(
    detail,
    /SERVICIOS PARA HUÉSPEDES DE PIN&Go|SERVICIOS PARA HUÉSPEDES DE PIN&GO/
  );
  assert.match(
    detail,
    /preferredLanguage === "es"[\s\S]*Reservación directa impulsada por operaciones autónomas de propiedades/
  );
});
