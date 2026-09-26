const accommodation={ENTIRE_PLACE:{en:"Entire place",es:"Alojamiento completo"},PRIVATE_ROOM:{en:"Private room",es:"Habitación privada"},SHARED_ROOM:{en:"Shared room",es:"Habitación compartida"}};
const propertyType={HOUSE:{en:"House",es:"Casa"},APARTMENT:{en:"Apartment",es:"Apartamento"},CONDO:{en:"Condo",es:"Condominio"},CABIN:{en:"Cabin",es:"Cabaña"},COTTAGE:{en:"Cottage",es:"Casa de campo"},VILLA:{en:"Villa",es:"Villa"},TOWNHOUSE:{en:"Townhouse",es:"Townhouse"},BUNGALOW:{en:"Bungalow",es:"Bungalow"},LOFT:{en:"Loft",es:"Loft"},STUDIO:{en:"Studio",es:"Estudio"},GUESTHOUSE:{en:"Guesthouse",es:"Casa de huéspedes"},FARM_STAY:{en:"Farm stay",es:"Estadía rural"},OTHER:{en:"Property",es:"Propiedad"}};
const featureName={WOOD_CONSTRUCTION:{en:"Wood construction",es:"Construcción en madera"},OCEAN_VIEW:{en:"Ocean view",es:"Vista al mar"},MOUNTAIN_VIEW:{en:"Mountain view",es:"Vista a la montaña"},WATERFRONT:{en:"Waterfront",es:"Frente al agua"},BEACH_ACCESS:{en:"Beach access",es:"Acceso a la playa"},POOL_TABLE:{en:"Pool table",es:"Mesa de billar"},GYM:{en:"Gym",es:"Gimnasio"},FIREPLACE:{en:"Fireplace",es:"Chimenea"},OUTDOOR_GRILL:{en:"Outdoor grill",es:"Parrilla exterior"},WORKSPACE:{en:"Workspace",es:"Espacio de trabajo"},OTHER:{en:"Other feature",es:"Otra característica"}};
export const publicPropertyTypeLabel=(d,l)=>d?.propertyType?propertyType[d.propertyType]?.[l]??null:null;
export const publicFeatureLabels=(d,l)=>(d?.features??[]).map(x=>(l==="es"?x.labelEs||x.labelEn:x.labelEn||x.labelEs)||featureName[x.type]?.[l]).filter(Boolean);

const plural=(n,one,many)=>n===1?one:many;
export const totalPublicBeds=(d)=>(d?.sleepingAreas??[]).reduce((a,r)=>a+r.beds.reduce((x,b)=>x+b.quantity,0),0);
export const publicBathrooms=(d)=>!d||(d.fullBathroomCount==null&&d.halfBathroomCount==null)?null:(d.fullBathroomCount??0)+(d.halfBathroomCount??0)*.5;
export function listingFactLabels(d,maxGuests,l){
 const out=[]; const type=publicPropertyTypeLabel(d,l); if(type)out.push(type); if(d?.accommodationType)out.push(accommodation[d.accommodationType][l]);
 if(maxGuests)out.push(l==="es"?`Hasta ${maxGuests} ${plural(maxGuests,"huésped","huéspedes")}`:`Up to ${maxGuests} ${plural(maxGuests,"guest","guests")}`);
 if(d?.bedroomCount!=null)out.push(l==="es"?`${d.bedroomCount} ${plural(d.bedroomCount,"dormitorio","dormitorios")}`:`${d.bedroomCount} ${plural(d.bedroomCount,"bedroom","bedrooms")}`);
 const beds=totalPublicBeds(d); if(beds)out.push(l==="es"?`${beds} ${plural(beds,"cama","camas")}`:`${beds} ${plural(beds,"bed","beds")}`);
 const baths=publicBathrooms(d); if(baths!=null)out.push(l==="es"?`${baths} ${plural(baths,"baño","baños")}`:`${baths} ${plural(baths,"bathroom","bathrooms")}`); return out;
}
const permission=(v,l,yesEs,noEs,yesEn,noEn)=>v==="UNKNOWN"?null:l==="es"?(v==="ALLOWED"?yesEs:noEs):(v==="ALLOWED"?yesEn:noEn);
export function beforeBookingFacts(d,l){
 if(!d)return[]; const out=[];
 if(d.minimumPrimaryBookingGuestAge!=null)out.push(l==="es"?`El huésped principal debe tener ${d.minimumPrimaryBookingGuestAge} años o más`:`Primary booking guest must be ${d.minimumPrimaryBookingGuestAge} or older`);
 if(d.adultsOnly==="YES")out.push(l==="es"?"Solo adultos":"Adults only");
 out.push(permission(d.childrenPolicy,l,"Se permiten niños","No se permiten niños","Children allowed","Children not allowed"),permission(d.infantsPolicy,l,"Se permiten bebés","No se permiten bebés","Infants allowed","Infants not allowed"),permission(d.petsPolicy,l,"Se permiten mascotas","No se permiten mascotas","Pets allowed","Pets not allowed"),permission(d.smokingPolicy,l,"Se permite fumar","No fumar","Smoking allowed","No smoking"),permission(d.vapingPolicy,l,"Se permite vapear","No vapear","Vaping allowed","No vaping"),permission(d.eventsPolicy,l,"Se permiten fiestas/eventos","No fiestas ni eventos","Parties/events allowed","No parties or events"),permission(d.unregisteredVisitorsPolicy,l,"Se permiten visitantes no registrados","No visitantes no registrados","Unregistered visitors allowed","No unregistered visitors"));
 if(d.quietHoursEnabled==="YES"&&d.quietHoursStart&&d.quietHoursEnd)out.push(l==="es"?`Horario de silencio: ${d.quietHoursStart}–${d.quietHoursEnd}`:`Quiet hours: ${d.quietHoursStart}–${d.quietHoursEnd}`);
 if(d.parkingAvailability==="YES")out.push(l==="es"?"Estacionamiento disponible":"Parking available"); if(d.parkingAvailability==="NO")out.push(l==="es"?"No hay estacionamiento incluido":"No parking included");
 if(d.stepFreeEntrance==="YES")out.push(l==="es"?"Entrada sin escalones":"Step-free entrance"); if(d.stepFreeEntrance==="NO")out.push(d.entranceStepCount!=null?(l==="es"?`${d.entranceStepCount} escalones en la entrada`:`${d.entranceStepCount} entrance steps`):(l==="es"?"La entrada tiene escalones":"Entrance has steps"));
 return out.filter(Boolean);
}
