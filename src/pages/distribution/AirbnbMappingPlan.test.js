import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source=readFileSync(new URL("./AirbnbConnectionCallbackPage.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{fileName:"AirbnbConnectionCallbackPage.tsx",compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
assert.equal((compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const CHANNEL="716305c4-561a-4561-a187-7f5b8aeb5920";
const LISTING={id:"42544559",title:"Test Property · Test Channex Property"};
const PLAN={propertyId:"property-1",channelId:CHANNEL,listing:LISTING,ratePlan:{id:"7e9409b4-160b-4412-941f-09c2c205b13b",source:"PIN_GO_PRIMARY_RATE_PLAN"},mappingRequest:{mapping:{rate_plan_id:"7e9409b4-160b-4412-941f-09c2c205b13b",settings:{listing_id:LISTING.id}}},executable:false,nextAction:"MAPPING_EXECUTION_REQUIRES_APPROVAL"};
function page({query=`?success=true&channel_id=${CHANNEL}&token=test-only`,user={role:"ORG_ADMIN"},values=[LISTING],planCall=async()=>PLAN}={}){
  const states=[],refs=[],effects=[],calls=[],exports={};let si=0,ri=0,initial=true;
  const modules={
    "react/jsx-runtime":{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    react:{useState(x){const i=si++;if(initial)states[i]=x;return [states[i],v=>{states[i]=v;}];},useRef(x){const i=ri++;if(initial)refs[i]={current:x};return refs[i];},useEffect(f){if(initial)effects.push(f);}},
    "lucide-react":{CheckCircle2:"check",LoaderCircle:"loader",ShieldCheck:"shield",TriangleAlert:"alert"},
    "react-router-dom":{Navigate:"Navigate",useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams(query)]},
    "../../auth/AuthProvider":{useAuth:()=>({user})},
    "../../api/airbnbHostSelfService":{
      AirbnbHostSelfServiceApiError:class extends Error{},
      async verifyAirbnbHostCallback(){calls.push("callback");return {success:true,propertyId:"property-1",channelId:CHANNEL,airbnbAccountVerified:false,nextAction:"LISTING_DISCOVERY_REQUIRED"};},
      async discoverAirbnbHostListings(){calls.push("listings");return {listings:values};},
      async prepareAirbnbHostMappingPlan(...args){calls.push(["plan",...args]);return planCall();},
    },
  };
  runInNewContext(compiled.outputText,{exports,require(n){assert.ok(n in modules,n);return modules[n];},window:{history:{replaceState(){}}},document:{title:"Test"}},{timeout:1000});
  function render(){si=0;ri=0;const node=exports.AirbnbConnectionCallbackPage();initial=false;return node;}
  return {calls,states,render,async start(){render();effects.forEach(f=>f());await tick();return render();}};
}
const tick=()=>new Promise(setImmediate);
function text(node){if(typeof node==="string"||typeof node==="number")return String(node);if(Array.isArray(node))return node.map(text).join(" ");return node&&typeof node==="object"?text(node.props?.children):"";}
function nodes(node,type){if(!node)return [];if(Array.isArray(node))return node.flatMap(n=>nodes(n,type));return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
function button(node,label){return nodes(node,"button").find(n=>text(n).includes(label));}
async function discover(p){let n=await p.start();button(n,"Consultar anuncios").props.onClick();await tick();return p.render();}
function select(p,id=LISTING.id){nodes(p.render(),"select")[0].props.onChange({currentTarget:{value:id}});return p.render();}
function planCount(p){return p.calls.filter(c=>Array.isArray(c)&&c[0]==="plan").length;}
test("proposal requires explicit selection and review; no automatic mapping or activation",async()=>{
  const p=page();const n=await discover(p);assert.equal(planCount(p),0);
  assert.equal(nodes(n,"select")[0].props.value,"");assert.equal(button(n,"Revisar propuesta").props.disabled,true);
  button(select(p),"Revisar propuesta").props.onClick();await tick();const done=p.render();
  assert.equal(planCount(p),1);assert.deepEqual(p.calls.at(-1),["plan","property-1",CHANNEL,LISTING.id]);
  assert.match(text(done),/Propuesta de mapeo — no ejecutada/);assert.match(text(done),/ejecución permanece deshabilitada/);
  assert.match(text(done),/Aún falta verificar el plan en Channex/);assert.match(text(done),/sincronización ARI/);
  assert.ok(nodes(done,"button").every(b=>!/Crear|Activar|Ejecutar/.test(text(b))));
});
test("empty discovery provides no proposal controls",async()=>{
  const p=page({values:[]});assert.equal(nodes(await discover(p),"select").length,0);assert.equal(planCount(p),0);
});
for(const query of ["?success=false","?success=true",""])test("unverified return has no mapping preview",async()=>{
  const p=page({query});assert.equal(nodes(await p.start(),"select").length,0);assert.equal(planCount(p),0);
});
for(const user of [null,{role:"MEMBER"}])test("existing auth and role boundaries still prevent proposal access",async()=>{
  const p=page({user});assert.equal((await p.start()).type,"Navigate");assert.deepEqual(p.calls,[]);
});
test("double click emits one in-flight preflight",async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const p=page({planCall:()=>pending});await discover(p);
  const b=button(select(p),"Revisar propuesta");b.props.onClick();b.props.onClick();assert.equal(planCount(p),1);
  resolve(PLAN);await tick();assert.match(text(p.render()),/Propuesta de mapeo — no ejecutada/);
});
test("rediscovery discards stale in-flight preview and prior selection",async()=>{
  let resolve;const p=page({planCall:()=>new Promise(r=>resolve=r)});await discover(p);
  button(select(p),"Revisar propuesta").props.onClick();button(p.render(),"Consultar anuncios").props.onClick();await tick();
  resolve(PLAN);await tick();const n=p.render();assert.doesNotMatch(text(n),/Propuesta de mapeo — no ejecutada/);
  assert.equal(nodes(n,"select")[0].props.value,"");
});
test("selection change invalidates a completed preview",async()=>{
  const p=page();await discover(p);button(select(p),"Revisar propuesta").props.onClick();await tick();
  assert.doesNotMatch(text(select(p,"")),/Propuesta de mapeo — no ejecutada/);
});
test("preflight failure displays no provider internals or fabricated success",async()=>{
  const p=page({planCall:async()=>{throw Error("SYNTHETIC_PRIVATE test-only");}});await discover(p);
  button(select(p),"Revisar propuesta").props.onClick();await tick();const n=p.render();
  assert.match(text(n),/No pudimos preparar la propuesta/);assert.doesNotMatch(text(n),/SYNTHETIC_PRIVATE|Propuesta de mapeo — no ejecutada/);
});
test("provider strings remain text nodes, never HTML or external URLs",async()=>{
  const listing={id:" 00/x?&ñ ",title:"<img onerror=synthetic>"};const plan={...PLAN,listing};
  const p=page({values:[listing],planCall:async()=>plan});await discover(p);
  button(select(p,listing.id),"Revisar propuesta").props.onClick();await tick();const n=p.render();
  assert.match(text(n),/<img onerror=synthetic>/);assert.equal(nodes(n,"img").length,0);assert.equal(nodes(n,"a").length,0);
  assert.ok(!JSON.stringify(n).includes("dangerouslySetInnerHTML"));
});
