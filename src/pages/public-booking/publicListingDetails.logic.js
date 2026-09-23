const accommodation={ENTIRE_PLACE:{en:"Entire place",es:"Alojamiento completo"},PRIVATE_ROOM:{en:"Private room",es:"Habitación privada"},SHARED_ROOM:{en:"Shared room",es:"Habitación compartida"}};
const plural=(n,one,many)=>n===1?one:many;
export const totalPublicBeds=(d)=>(d?.sleepingAreas??[]).reduce((a,r)=>a+r.beds.reduce((x,b)=>x+b.quantity,0),0);
export const publicBathrooms=(d)=>!d||(d.fullBathroomCount==null&&d.halfBathroomCount==null)?null:(d.fullBathroomCount??0)+(d.halfBathroomCount??0)*.5;
export function listingFactLabels(d,maxGuests,l){
 const out=[]; if(d?.accommodationType)out.push(accommodation[d.accommodationType][l]);
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
