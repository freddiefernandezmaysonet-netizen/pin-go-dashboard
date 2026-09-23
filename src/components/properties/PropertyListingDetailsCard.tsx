import { useEffect, useState } from "react";
import { RoomLayoutEditor } from "./RoomLayoutEditor";
import {
  EMPTY_LISTING_DETAILS,
  type ListingDetailsForm,
  type PermissionState,
  type TriState,
} from "./propertyListingDetails.types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const input: React.CSSProperties = {
  width: "100%", border: "1px solid #d1d5db", borderRadius: 10,
  padding: "10px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff",
};
const grid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12,
};
const section: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "grid", gap: 12,
};
const Field=({label,children}:{label:string;children:React.ReactNode})=>
  <label style={{display:"grid",gap:6}}><span style={{fontSize:12,fontWeight:800,color:"#374151"}}>{label}</span>{children}</label>;
const Tri=({value,onChange}:{value:TriState;onChange:(v:TriState)=>void})=>
  <select style={input} value={value} onChange={e=>onChange(e.target.value as TriState)}>
    <option value="UNKNOWN">Not confirmed</option><option value="YES">Yes</option><option value="NO">No</option>
  </select>;
const Perm=({value,onChange}:{value:PermissionState;onChange:(v:PermissionState)=>void})=>
  <select style={input} value={value} onChange={e=>onChange(e.target.value as PermissionState)}>
    <option value="UNKNOWN">Not confirmed</option><option value="ALLOWED">Allowed</option><option value="NOT_ALLOWED">Not allowed</option>
  </select>;
const n=(v:string)=>v.trim()===""?null:Number(v);

function hydrate(d:any):ListingDetailsForm {
  if(!d) return EMPTY_LISTING_DETAILS;
  const str=(v:any)=>v==null?"":String(v);
  return {...EMPTY_LISTING_DETAILS,...d,
    accommodationType:d.accommodationType??"",
    bedroomCount:str(d.bedroomCount),fullBathroomCount:str(d.fullBathroomCount),
    halfBathroomCount:str(d.halfBathroomCount),minimumPrimaryBookingGuestAge:str(d.minimumPrimaryBookingGuestAge),
    quietHoursStart:d.quietHoursStart??"",quietHoursEnd:d.quietHoursEnd??"",
    parkingType:d.parkingType??"",parkingFeeType:d.parkingFeeType??"",parkingVehicleCapacity:str(d.parkingVehicleCapacity),
    exteriorSecurityCamerasDisclosureEn:d.exteriorSecurityCamerasDisclosureEn??"",
    exteriorSecurityCamerasDisclosureEs:d.exteriorSecurityCamerasDisclosureEs??"",
    animalsOnPropertyDisclosureEn:d.animalsOnPropertyDisclosureEn??"",
    animalsOnPropertyDisclosureEs:d.animalsOnPropertyDisclosureEs??"",
    entranceStepCount:str(d.entranceStepCount),
    sleepingAreas:Array.isArray(d.sleepingAreas)?d.sleepingAreas.map((a:any,i:number)=>({
      kind:a.kind==="SLEEPING_AREA"?"SLEEPING_AREA":"BEDROOM",nameEn:a.nameEn??"",nameEs:a.nameEs??"",
      sortOrder:i,beds:Array.isArray(a.beds)?a.beds.map((b:any)=>({type:b.type??"OTHER",quantity:Number(b.quantity??1)})):[]
    })):[]
  };
}

export function PropertyListingDetailsCard({propertyId,maxGuests}:{propertyId:string;maxGuests?:number|null}) {
  const [form,setForm]=useState<ListingDetailsForm>(EMPTY_LISTING_DETAILS);
  const [version,setVersion]=useState<number|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[message,setMessage]=useState("");
  const set=(key:keyof ListingDetailsForm,value:any)=>{setForm(s=>({...s,[key]:value}));setMessage("")};

  useEffect(()=>{let cancelled=false;setLoading(true);fetch(
    `${API_BASE}/api/dashboard/properties/${propertyId}/listing-details`,{credentials:"include"}
  ).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d?.error||"Failed to load listing details");
    if(!cancelled){setForm(hydrate(d.listingDetails));setVersion(d.listingDetails?.version??null)}
  }).catch(e=>!cancelled&&setError(String(e?.message??e))).finally(()=>!cancelled&&setLoading(false));
    return()=>{cancelled=true}},[propertyId]);

  async function save(){
    setSaving(true);setError("");setMessage("");
    try{
      const payload={...form,
        accommodationType:form.accommodationType||null,
        bedroomCount:n(form.bedroomCount),fullBathroomCount:n(form.fullBathroomCount),
        halfBathroomCount:n(form.halfBathroomCount),minimumPrimaryBookingGuestAge:n(form.minimumPrimaryBookingGuestAge),
        quietHoursStart:form.quietHoursEnabled==="YES"?form.quietHoursStart||null:null,
        quietHoursEnd:form.quietHoursEnabled==="YES"?form.quietHoursEnd||null:null,
        parkingType:form.parkingAvailability==="YES"?form.parkingType||null:null,
        parkingFeeType:form.parkingAvailability==="YES"?form.parkingFeeType||null:null,
        parkingVehicleCapacity:form.parkingAvailability==="YES"?n(form.parkingVehicleCapacity):null,
        exteriorSecurityCamerasDisclosureEn:form.exteriorSecurityCameras==="YES"?form.exteriorSecurityCamerasDisclosureEn||null:null,
        exteriorSecurityCamerasDisclosureEs:form.exteriorSecurityCameras==="YES"?form.exteriorSecurityCamerasDisclosureEs||null:null,
        animalsOnPropertyDisclosureEn:form.animalsOnProperty==="YES"?form.animalsOnPropertyDisclosureEn||null:null,
        animalsOnPropertyDisclosureEs:form.animalsOnProperty==="YES"?form.animalsOnPropertyDisclosureEs||null:null,
        entranceStepCount:form.stepFreeEntrance==="YES"?0:n(form.entranceStepCount),
        sleepingAreas:form.sleepingAreas.map((a,i)=>({...a,sortOrder:i})),
        sharedSpaces:[],safetyConsiderations:[],additionalConsiderations:[]
      };
      const r=await fetch(`${API_BASE}/api/dashboard/properties/${propertyId}/listing-details`,{
        method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
      });const d=await r.json();if(!r.ok)throw new Error(Array.isArray(d?.issues)?d.issues.join(" · "):d?.error||"Failed to save listing details");
      setForm(hydrate(d.listingDetails));setVersion(d.listingDetails?.version??null);setMessage("Listing details saved.");
    }catch(e:any){setError(String(e?.message??e))}finally{setSaving(false)}
  }

  if(loading)return <div style={{padding:18,border:"1px solid #bfdbfe",borderRadius:18}}>Loading accommodation details...</div>;
  const facts:[string,keyof ListingDetailsForm,string][]=[
    ["Bedrooms","bedroomCount","2"],["Full bathrooms","fullBathroomCount","1"],
    ["Half bathrooms","halfBathroomCount","0"],["Minimum primary booking guest age","minimumPrimaryBookingGuestAge","21"]
  ];
  const permissions:[string,keyof ListingDetailsForm][]=[
    ["Children","childrenPolicy"],["Infants","infantsPolicy"],["Pets","petsPolicy"],["Smoking","smokingPolicy"],
    ["Vaping","vapingPolicy"],["Parties / events","eventsPolicy"],["Unregistered visitors","unregisteredVisitorsPolicy"]
  ];
  const safety:[string,keyof ListingDetailsForm][]=[
    ["Smoke detector","smokeDetector"],["Carbon monoxide detector","carbonMonoxideDetector"],
    ["Elevator available","elevatorAvailable"],["Accessible parking","accessibleParking"],
    ["Step-free bedroom access","stepFreeBedroomAccess"],["Step-free bathroom access","stepFreeBathroomAccess"],
    ["Step-free shower","stepFreeShower"]
  ];

  return <div style={{border:"1px solid #bfdbfe",borderRadius:18,padding:18,background:"#fff",display:"grid",gap:18}}>
    <div><div style={{fontSize:17,fontWeight:900}}>Accommodation & guest requirements</div>
      <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>Confirm factual listing information once. Unconfirmed answers remain unknown instead of becoming guest-facing claims.</div>
      <div style={{fontSize:12,color:"#64748b",marginTop:6}}>Capacity: {maxGuests??"not configured"} guests · {version?`Listing details V${version}`:"Not configured yet"}</div>
    </div>
    {error?<div style={{padding:10,borderRadius:10,background:"#fef2f2",color:"#991b1b",fontSize:13}}>{error}</div>:null}
    {message?<div style={{padding:10,borderRadius:10,background:"#f0fdf4",color:"#166534",fontSize:13}}>{message}</div>:null}

    <div style={section}><b>Property facts</b><div style={grid}>
      <Field label="Accommodation type"><select style={input} value={form.accommodationType} onChange={e=>set("accommodationType",e.target.value)}>
        <option value="">Not confirmed</option><option value="ENTIRE_PLACE">Entire place</option><option value="PRIVATE_ROOM">Private room</option><option value="SHARED_ROOM">Shared room</option>
      </select></Field>
      {facts.map(([label,key,placeholder])=><Field key={key} label={label}><input style={input} type="number" min={key==="minimumPrimaryBookingGuestAge"?18:0} placeholder={placeholder} value={String(form[key])} onChange={e=>set(key,e.target.value)}/></Field>)}
    </div></div>

    <div style={section}><RoomLayoutEditor value={form.sleepingAreas} onChange={v=>set("sleepingAreas",v)}/></div>

    <div style={section}><b>Guest eligibility & house rules</b><div style={grid}>
      <Field label="Adults only"><Tri value={form.adultsOnly} onChange={v=>set("adultsOnly",v)}/></Field>
      {permissions.map(([label,key])=><Field key={key} label={label}><Perm value={form[key] as PermissionState} onChange={v=>set(key,v)}/></Field>)}
      <Field label="Quiet hours"><Tri value={form.quietHoursEnabled} onChange={v=>set("quietHoursEnabled",v)}/></Field>
      {form.quietHoursEnabled==="YES"?<><Field label="Quiet hours start"><input style={input} type="time" value={form.quietHoursStart} onChange={e=>set("quietHoursStart",e.target.value)}/></Field><Field label="Quiet hours end"><input style={input} type="time" value={form.quietHoursEnd} onChange={e=>set("quietHoursEnd",e.target.value)}/></Field></>:null}
    </div></div>

    <div style={section}><b>Parking, safety & accessibility</b><div style={grid}>
      <Field label="Parking available"><Tri value={form.parkingAvailability} onChange={v=>set("parkingAvailability",v)}/></Field>
      {form.parkingAvailability==="YES"?<><Field label="Parking type"><select style={input} value={form.parkingType} onChange={e=>set("parkingType",e.target.value)}><option value="">Not confirmed</option>{["PRIVATE","GARAGE","DRIVEWAY","STREET","LOT","OTHER"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Parking fee"><select style={input} value={form.parkingFeeType} onChange={e=>set("parkingFeeType",e.target.value)}><option value="">Not confirmed</option><option value="FREE">Free</option><option value="PAID">Paid</option><option value="UNKNOWN">Unknown</option></select></Field><Field label="Vehicle capacity"><input style={input} type="number" min="0" value={form.parkingVehicleCapacity} onChange={e=>set("parkingVehicleCapacity",e.target.value)}/></Field></>:null}
      <Field label="Step-free entrance"><Tri value={form.stepFreeEntrance} onChange={v=>set("stepFreeEntrance",v)}/></Field>
      {form.stepFreeEntrance==="NO"?<Field label="Entrance step count"><input style={input} type="number" min="0" value={form.entranceStepCount} onChange={e=>set("entranceStepCount",e.target.value)}/></Field>:null}
      {safety.map(([label,key])=><Field key={key} label={label}><Tri value={form[key] as TriState} onChange={v=>set(key,v)}/></Field>)}
      <Field label="Exterior security cameras"><Tri value={form.exteriorSecurityCameras} onChange={v=>set("exteriorSecurityCameras",v)}/></Field>
      <Field label="Animals on property"><Tri value={form.animalsOnProperty} onChange={v=>set("animalsOnProperty",v)}/></Field>
    </div>
    {form.exteriorSecurityCameras==="YES"?<div style={grid}><Field label="Camera disclosure (English)"><textarea style={input} value={form.exteriorSecurityCamerasDisclosureEn} onChange={e=>set("exteriorSecurityCamerasDisclosureEn",e.target.value)}/></Field><Field label="Divulgación de cámaras (Español)"><textarea style={input} value={form.exteriorSecurityCamerasDisclosureEs} onChange={e=>set("exteriorSecurityCamerasDisclosureEs",e.target.value)}/></Field></div>:null}
    {form.animalsOnProperty==="YES"?<div style={grid}><Field label="Animals disclosure (English)"><textarea style={input} value={form.animalsOnPropertyDisclosureEn} onChange={e=>set("animalsOnPropertyDisclosureEn",e.target.value)}/></Field><Field label="Divulgación de animales (Español)"><textarea style={input} value={form.animalsOnPropertyDisclosureEs} onChange={e=>set("animalsOnPropertyDisclosureEs",e.target.value)}/></Field></div>:null}
    </div>

    <div style={{display:"flex",justifyContent:"flex-end"}}>
      <button type="button" disabled={saving} onClick={save} style={{border:0,borderRadius:10,padding:"10px 16px",fontWeight:900,background:"#111827",color:"#fff",cursor:saving?"not-allowed":"pointer",opacity:saving?.7:1}}>
        {saving?"Saving...":"Save accommodation details"}
      </button>
    </div>
  </div>;
}
