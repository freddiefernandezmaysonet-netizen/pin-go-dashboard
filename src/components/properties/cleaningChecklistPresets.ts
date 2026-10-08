import type { ChecklistTemplate } from "../../api/cleaning-checklist";

const item = (id: string, es: string, en: string, required = true) => ({ id, es, en, required });
const turnover = [
  item("linen", "Cambiar sábanas y preparar las camas", "Replace bed linen and make beds"),
  item("bathrooms", "Limpiar y desinfectar inodoros, duchas y lavamanos", "Clean and disinfect toilets, showers and sinks"),
  item("towels", "Colocar toallas limpias y reponer papel higiénico", "Provide clean towels and replenish toilet paper"),
  item("kitchen", "Limpiar cocina, fregadero, encimeras y utensilios", "Clean kitchen, sink, counters and utensils"),
  item("fridge", "Retirar alimentos dejados por huéspedes y limpiar el refrigerador", "Remove food left by guests and clean the refrigerator"),
  item("surfaces", "Limpiar polvo y superficies de contacto frecuente", "Dust and clean frequently touched surfaces"),
  item("floors", "Barrer o aspirar y limpiar los pisos", "Sweep or vacuum and clean floors"),
  item("trash", "Retirar basura y colocar bolsas nuevas", "Remove trash and replace bin liners"),
  item("supplies", "Reponer los suministros definidos por la propiedad", "Replenish supplies specified by the property"),
  item("inspection", "Revisar presentación final y reportar daños o faltantes", "Check final presentation and report damage or missing items"),
];

export const CLEANING_CHECKLIST_PRESETS = [
  { id: "turnover", name: "Limpieza entre reservas / Turnover cleaning", description: "Preparación completa para el próximo huésped / Full preparation for the next guest", items: turnover },
  { id: "deep", name: "Limpieza profunda / Deep cleaning", description: "Incluye limpieza entre reservas y tareas de mayor detalle / Includes turnover tasks and detailed cleaning", items: [
    ...turnover,
    item("appliances", "Limpiar a fondo horno, microondas y otros electrodomésticos", "Deep clean oven, microwave and other appliances"),
    item("windows", "Limpiar ventanas interiores, marcos y rieles accesibles", "Clean accessible interior windows, frames and tracks"),
    item("hidden", "Limpiar debajo de muebles que se puedan mover de forma segura", "Clean under furniture that can be moved safely"),
    item("details", "Limpiar zócalos, puertas y zonas de difícil acceso", "Clean baseboards, doors and hard-to-reach areas"),
  ] },
  { id: "in_stay", name: "Limpieza durante la estadía / In-stay cleaning", description: "Servicio durante una estadía, respetando las pertenencias del huésped / Service during a stay, respecting guest belongings", items: [
    item("bathrooms", "Limpiar baños y reponer papel higiénico", "Clean bathrooms and replenish toilet paper"),
    item("towels", "Cambiar toallas según el servicio acordado", "Replace towels according to the agreed service"),
    item("trash", "Retirar basura y colocar bolsas nuevas", "Remove trash and replace bin liners"),
    item("surfaces", "Limpiar superficies libres sin mover pertenencias personales", "Clean clear surfaces without moving personal belongings"),
    item("floors", "Barrer o aspirar y limpiar las áreas acordadas", "Sweep or vacuum and clean the agreed areas"),
    item("supplies", "Reponer suministros incluidos en el servicio", "Replenish supplies included in the service"),
  ] },
  { id: "arrival", name: "Inspección de llegada / Arrival inspection", description: "Revisión final de una propiedad ya limpia / Final inspection of an already cleaned property", items: [
    item("cleanliness", "Verificar limpieza de baños, cocina, habitaciones y pisos", "Verify cleanliness of bathrooms, kitchen, bedrooms and floors"),
    item("beds", "Verificar camas preparadas y toallas limpias", "Verify made beds and clean towels"),
    item("supplies", "Verificar los suministros definidos por la propiedad", "Verify supplies specified by the property"),
    item("temperature", "Verificar temperatura y configuración indicada por la propiedad", "Check temperature and settings specified by the property"),
    item("presentation", "Verificar presentación, iluminación y acceso despejado", "Check presentation, lighting and clear access"),
    item("issues", "Reportar cualquier daño, faltante o problema antes de la llegada", "Report damage, missing items or problems before arrival"),
  ] },
] as const;

export function checklistFromPreset(presetId: string, revision: number): ChecklistTemplate {
  const preset = CLEANING_CHECKLIST_PRESETS.find(candidate => candidate.id === presetId);
  if (!preset) throw new Error("UNKNOWN_CHECKLIST_PRESET");
  return { revision, items: preset.items.map(entry => ({ ...entry, id: `${preset.id}_${entry.id}` })) };
}
