import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { listingFactLabels, publicFeatureLabels } from "./publicListingDetails.logic.js";

const sections=await readFile(new URL("./PublicListingDetailsSections.tsx",import.meta.url),"utf8");
test("property type joins the public summary and factual features get localized labels",()=>{
 const d={propertyType:"CABIN",accommodationType:"ENTIRE_PLACE",bedroomCount:1,fullBathroomCount:1,halfBathroomCount:0,sleepingAreas:[{beds:[{type:"KING",quantity:1}]}],features:[{type:"OCEAN_VIEW",labelEn:null,labelEs:null},{type:"FIREPLACE",labelEn:null,labelEs:null}]};
 assert.deepEqual(listingFactLabels(d,2,"es").slice(0,2),["Cabaña","Alojamiento completo"]);
 assert.deepEqual(publicFeatureLabels(d,"es"),["Vista al mar","Chimenea"]);
});
test("public detail renders a dedicated factual features section",()=>{
 assert.match(sections,/Lo que destaca este alojamiento/);
 assert.match(sections,/What makes this stay stand out/);
 assert.doesNotMatch(sections,/experienceTags/);
});
