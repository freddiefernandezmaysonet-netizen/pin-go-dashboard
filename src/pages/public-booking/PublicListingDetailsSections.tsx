import type { PublicListingDetails } from "./publicListingDetails.types";
type Lang="en"|"es";
const accommodation={ENTIRE_PLACE:{en:"Entire place",es:"Alojamiento completo"},PRIVATE_ROOM:{en:"Private room",es:"Habitación privada"},SHARED_ROOM:{en:"Shared room",es:"Habitación compartida"}} as const;
const bedName={KING:{en:"king bed",es:"cama king"},QUEEN:{en:"queen bed",es:"cama queen"},DOUBLE:{en:"double bed",es:"cama doble"},SINGLE:{en:"single bed",es:"cama individual"},BUNK:{en:"bunk bed",es:"litera"},SOFA_BED:{en:"sofa bed",es:"sofá cama"},FUTON:{en:"futon",es:"futón"},CRIB:{en:"crib",es:"cuna"},OTHER:{en:"bed",es:"cama"}} as const;
const plural=(n:number,one:string,many:string)=>n===1?one:many;
export const totalPublicBeds=(d?:PublicListingDetails|null)=>(d?.sleepingAreas??[]).reduce((a,r)=>a+r.beds.reduce((x,b)=>x+b.quantity,0),0);
export const publicBathrooms=(d?:PublicListingDetails|null)=>!d||(d.fullBathroomCount==null&&d.halfBathroomCount==null)?null:(d.fullBathroomCount??0)+(d.halfBathroomCount??0)*.5;
export function listingFactLabels(d:PublicListingDetails|null|undefined,maxGuests:number|null|undefined,l:Lang){
 const out:string[]=[];
 if(d?.accommodationType)out.push(accommodation[d.accommodationType][l]);
 if(maxGuests)out.push(l==="es"?`Hasta ${maxGuests} ${plural(maxGuests,"huésped","huéspedes")}`:`Up to ${maxGuests} ${plural(maxGuests,"guest","guests")}`);
 if(d?.bedroomCount!=null)out.push(l==="es"?`${d.bedroomCount} ${plural(d.bedroomCount,"dormitorio","dormitorios")}`:`${d.bedroomCount} ${plural(d.bedroomCount,"bedroom","bedrooms")}`);
 const beds=totalPublicBeds(d); if(beds)out.push(l==="es"?`${beds} ${plural(beds,"cama","camas")}`:`${beds} ${plural(beds,"bed","beds")}`);
 const baths=publicBathrooms(d); if(baths!=null)out.push(l==="es"?`${baths} ${plural(baths,"baño","baños")}`:`${baths} ${plural(baths,"bathroom","bathrooms")}`);
 return out;
}
const permission=(v:string,l:Lang,yesEs:string,noEs:string,yesEn:string,noEn:string)=>v==="UNKNOWN"?null:l==="es"?(v==="ALLOWED"?yesEs:noEs):(v==="ALLOWED"?yesEn:noEn);
export function beforeBookingFacts(d:PublicListingDetails|null|undefined,l:Lang){
 if(!d)return[]; const out:(string|null)[]=[];
 if(d.minimumPrimaryBookingGuestAge!=null)out.push(l==="es"?`El huésped principal debe tener ${d.minimumPrimaryBookingGuestAge} años o más`:`Primary booking guest must be ${d.minimumPrimaryBookingGuestAge} or older`);
 if(d.adultsOnly==="YES")out.push(l==="es"?"Solo adultos":"Adults only");
 out.push(
  permission(d.childrenPolicy,l,"Se permiten niños","No se permiten niños","Children allowed","Children not allowed"),
  permission(d.infantsPolicy,l,"Se permiten bebés","No se permiten bebés","Infants allowed","Infants not allowed"),
  permission(d.petsPolicy,l,"Se permiten mascotas","No se permiten mascotas","Pets allowed","Pets not allowed"),
  permission(d.smokingPolicy,l,"Se permite fumar","No fumar","Smoking allowed","No smoking"),
  permission(d.vapingPolicy,l,"Se permite vapear","No vapear","Vaping allowed","No vaping"),
  permission(d.eventsPolicy,l,"Se permiten fiestas/eventos","No fiestas ni eventos","Parties/events allowed","No parties or events"),
  permission(d.unregisteredVisitorsPolicy,l,"Se permiten visitantes no registrados","No visitantes no registrados","Unregistered visitors allowed","No unregistered visitors")
 );
 if(d.quietHoursEnabled==="YES"&&d.quietHoursStart&&d.quietHoursEnd)out.push(l==="es"?`Horario de silencio: ${d.quietHoursStart}–${d.quietHoursEnd}`:`Quiet hours: ${d.quietHoursStart}–${d.quietHoursEnd}`);
 if(d.parkingAvailability==="YES")out.push(l==="es"?"Estacionamiento disponible":"Parking available");
 if(d.parkingAvailability==="NO")out.push(l==="es"?"No hay estacionamiento incluido":"No parking included");
 if(d.stepFreeEntrance==="YES")out.push(l==="es"?"Entrada sin escalones":"Step-free entrance");
 if(d.stepFreeEntrance==="NO")out.push(d.entranceStepCount!=null?(l==="es"?`${d.entranceStepCount} escalones en la entrada`:`${d.entranceStepCount} entrance steps`):(l==="es"?"La entrada tiene escalones":"Entrance has steps"));
 return out.filter((x):x is string=>Boolean(x));
}
function bedText(b:PublicListingDetails["sleepingAreas"][number]["beds"][number],l:Lang){return `${b.quantity} ${bedName[b.type][l]}`;}
export function PublicListingDetailsSections({details,language}:{details?:PublicListingDetails|null;language:Lang}){
 if(!details)return null; const sleep=details.sleepingAreas.filter(a=>a.beds.length); const facts=beforeBookingFacts(details,language);
 const disclosures=[
  details.exteriorSecurityCameras==="YES"?(language==="es"?details.exteriorSecurityCamerasDisclosureEs||details.exteriorSecurityCamerasDisclosureEn:details.exteriorSecurityCamerasDisclosureEn||details.exteriorSecurityCamerasDisclosureEs):null,
  details.animalsOnProperty==="YES"?(language==="es"?details.animalsOnPropertyDisclosureEs||details.animalsOnPropertyDisclosureEn:details.animalsOnPropertyDisclosureEn||details.animalsOnPropertyDisclosureEs):null,
  ...details.safetyConsiderations.map(x=>language==="es"?x.descriptionEs||x.descriptionEn:x.descriptionEn||x.descriptionEs),
 ].filter((x):x is string=>Boolean(x));
 return <>{sleep.length?<section className="pbe-section pbe-listing-details" aria-labelledby="pbe-sleep-title"><div className="pbe-section-heading"><p className="pbe-kicker">{language==="es"?"DISTRIBUCIÓN":"SLEEPING ARRANGEMENTS"}</p><h2 id="pbe-sleep-title">{language==="es"?"Dónde dormirás":"Where you'll sleep"}</h2></div><div className="pbe-listing-card-grid">{sleep.map((a,i)=><article className="pbe-listing-card" key={`${a.kind}-${a.sortOrder}-${i}`}><span aria-hidden="true">🛏</span><h3>{(language==="es"?a.nameEs||a.nameEn:a.nameEn||a.nameEs)||(a.kind==="BEDROOM"?(language==="es"?`Dormitorio ${i+1}`:`Bedroom ${i+1}`):(language==="es"?"Área para dormir":"Sleeping area"))}</h3><p>{a.beds.map(b=>bedText(b,language)).join(" · ")}</p></article>)}</div></section>:null}
 {(facts.length||details.sharedSpaces.length||disclosures.length||details.additionalConsiderations.length)?<section className="pbe-section pbe-listing-details" aria-labelledby="pbe-know-title"><div className="pbe-section-heading"><p className="pbe-kicker">{language==="es"?"ANTES DE RESERVAR":"BEFORE YOU BOOK"}</p><h2 id="pbe-know-title">{language==="es"?"Lo que debes saber":"Things to know"}</h2></div><div className="pbe-listing-know-grid">{facts.length?<div><h3>{language==="es"?"Requisitos y reglas":"Requirements & rules"}</h3><ul>{facts.map((x,i)=><li key={i}>{x}</li>)}</ul></div>:null}{details.sharedSpaces.length?<div><h3>{language==="es"?"Espacios compartidos":"Shared spaces"}</h3><ul>{details.sharedSpaces.map((x,i)=><li key={i}>{(language==="es"?x.labelEs||x.labelEn:x.labelEn||x.labelEs)||x.type.replaceAll("_"," ")}</li>)}</ul></div>:null}{disclosures.length?<div><h3>{language==="es"?"Seguridad":"Safety"}</h3><ul>{disclosures.map((x,i)=><li key={i}>{x}</li>)}</ul></div>:null}{details.additionalConsiderations.length?<div><h3>{language==="es"?"Detalles importantes":"Additional details"}</h3><ul>{details.additionalConsiderations.map((x,i)=><li key={i}><strong>{language==="es"?x.titleEs||x.titleEn:x.titleEn||x.titleEs}</strong>{(language==="es"?x.descriptionEs||x.descriptionEn:x.descriptionEn||x.descriptionEs)?` — ${language==="es"?x.descriptionEs||x.descriptionEn:x.descriptionEn||x.descriptionEs}`:""}</li>)}</ul></div>:null}</div></section>:null}</>;
}
