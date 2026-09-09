import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./airbnbHostSelfService.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source.replace("import.meta.env.VITE_API_BASE", '"https://api.example.test"'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,
});
assert.equal((compiled.diagnostics ?? []).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
// Internal DTO carrying the literal mapping body from the supplied guide.
const PLAN = { propertyId:"property-1",channelId:"716305c4-561a-4561-a187-7f5b8aeb5920",
  listing:{id:"54843145465465419",title:"Synthetic preview title"},
  ratePlan:{id:"7e9409b4-160b-4412-941f-09c2c205b13b",source:"PIN_GO_PRIMARY_RATE_PLAN"},
  mappingRequest:{mapping:{rate_plan_id:"7e9409b4-160b-4412-941f-09c2c205b13b",settings:{listing_id:"54843145465465419"}}},
  executable:false,nextAction:"MAPPING_EXECUTION_REQUIRES_APPROVAL" };
function harness(payload={ok:true,result:structuredClone(PLAN)},status=200,badJson=false) {
  const exports={},calls=[];
  runInNewContext(compiled.outputText,{exports,URL,crypto:{randomUUID:()=>"test-only"},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:status>=200&&status<300,status,
      async json(){if(badJson)throw Error("synthetic");return payload;}};}
  },{timeout:1000});
  return {calls,run:(property=PLAN.propertyId,channel=PLAN.channelId,listing=PLAN.listing.id)=>exports.prepareAirbnbHostMappingPlan(property,channel,listing)};
}
test("mapping preflight is one scoped credentialed GET, with no body or OAuth token",async()=>{
  const h=harness();assert.deepEqual(JSON.parse(JSON.stringify(await h.run())),PLAN);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.method,"GET");
  assert.equal(h.calls[0].options.credentials,"include");assert.equal(h.calls[0].options.cache,"no-store");
  assert.equal(h.calls[0].options.body,undefined);
  assert.equal(h.calls[0].url,`https://api.example.test/api/dashboard/distribution/properties/property-1/channels/AIRBNB/${PLAN.channelId}/mapping-plan?listingId=54843145465465419`);
});
test("opaque listing query value is encoded and preserved, never numeric-coerced",async()=>{
  const p=structuredClone(PLAN);p.propertyId="property/1";p.listing.id=" 00/x?&ñ ";p.mappingRequest.mapping.settings.listing_id=p.listing.id;
  const h=harness({ok:true,result:p});const result=await h.run(p.propertyId,p.channelId,p.listing.id);
  assert.equal(result.listing.id,p.listing.id);
  assert.ok(h.calls[0].url.includes("property%2F1"));assert.equal(new URL(h.calls[0].url).searchParams.get("listingId"),p.listing.id);
});
for(const [label,mutate] of [
  ["different property",p=>p.propertyId="other"],["different channel",p=>p.channelId="other"],
  ["different listing",p=>p.listing.id="other"],["title missing",p=>delete p.listing.title],
  ["plan missing",p=>p.ratePlan=null],["plan empty",p=>p.ratePlan.id=""],
  ["wrong source",p=>p.ratePlan.source="OTHER"],["execution enabled",p=>p.executable=true],
  ["execution absent",p=>delete p.executable],["phase activation",p=>p.nextAction="ACTIVE"],
  ["body different plan",p=>p.mappingRequest.mapping.rate_plan_id="other"],
  ["body different listing",p=>p.mappingRequest.mapping.settings.listing_id="other"],
  ["extra seeded default",p=>p.mappingRequest.mapping.settings.published=true],
  ["extra request key",p=>p.mappingRequest.activate=true],["extra mapping key",p=>p.mappingRequest.mapping.enabled=true],
  ["missing mapping",p=>delete p.mappingRequest.mapping],
])test(`synthetic invalid preflight DTO: ${label}`,async()=>{
  const p=structuredClone(PLAN);mutate(p);const h=harness({ok:true,result:p});
  await assert.rejects(()=>h.run(),e=>e.message==="INVALID_AIRBNB_MAPPING_PLAN_RESPONSE");assert.equal(h.calls.length,1);
});
for(const payload of [null,[],{}, {ok:false},{ok:true,result:null}])test("malformed preflight envelope fails closed",async()=>{
  await assert.rejects(()=>harness(payload).run(),e=>e.message==="INVALID_AIRBNB_MAPPING_PLAN_RESPONSE");
});
for(const status of [401,403,404,422,503])test(`HTTP ${status} is not retried`,async()=>{
  const h=harness({ok:false,error:"MOCK_ERROR"},status);await assert.rejects(()=>h.run(),e=>e.code==="MOCK_ERROR"&&e.status===status);assert.equal(h.calls.length,1);
});
test("invalid JSON cannot fabricate a plan",async()=>{
  await assert.rejects(()=>harness(null,200,true).run());
});
test("unneeded backend metadata is not propagated",async()=>{
  const p=structuredClone(PLAN);p.privateToken="SYNTHETIC_PRIVATE";p.listing.privateToken="SYNTHETIC_PRIVATE";
  assert.doesNotMatch(JSON.stringify(await harness({ok:true,result:p}).run()),/SYNTHETIC_PRIVATE/);
});
