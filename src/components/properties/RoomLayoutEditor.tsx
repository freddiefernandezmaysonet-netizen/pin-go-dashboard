import type { BedType, SleepingArea } from "./propertyListingDetails.types";

const control: React.CSSProperties = {
  width: "100%", border: "1px solid #d1d5db", borderRadius: 10,
  padding: "9px 10px", fontSize: 13, boxSizing: "border-box", background: "#fff",
};
const TYPES: BedType[] = ["KING","QUEEN","DOUBLE","SINGLE","BUNK","SOFA_BED","FUTON","CRIB","OTHER"];

export function RoomLayoutEditor({ value, onChange }: {
  value: SleepingArea[];
  onChange: (value: SleepingArea[]) => void;
}) {
  const patch = (index: number, next: Partial<SleepingArea>) =>
    onChange(value.map((item, i) => i === index ? { ...item, ...next } : item));

  const add = (kind: SleepingArea["kind"]) =>
    onChange([...value, { kind, nameEn: "", nameEs: "", sortOrder: value.length, beds: [] }]);

  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontWeight: 900 }}>Distribución de habitaciones y camas / Room & bed layout</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
          Mantén los dormitorios separados de otras áreas para dormir. / Keep bedrooms separate from other areas that provide a bed.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => add("BEDROOM")}>+ Dormitorio / Bedroom</button>
        <button type="button" onClick={() => add("SLEEPING_AREA")}>+ Otra área / Other area</button>
      </div>
    </div>

    {value.map((area, ai) => <div key={ai} style={{
      border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
        <select style={control} value={area.kind} onChange={e => patch(ai, { kind: e.target.value as SleepingArea["kind"] })}>
          <option value="BEDROOM">Dormitorio / Bedroom</option>
          <option value="SLEEPING_AREA">Otra área / Other area</option>
        </select>
        <input style={control} value={area.nameEn} placeholder="Name (English)" onChange={e => patch(ai, { nameEn: e.target.value })}/>
        <input style={control} value={area.nameEs} placeholder="Nombre (Español)" onChange={e => patch(ai, { nameEs: e.target.value })}/>
      </div>

      {area.beds.map((bed, bi) => <div key={bi} style={{
        display: "grid", gridTemplateColumns: "minmax(150px,1fr) 90px auto", gap: 8
      }}>
        <select style={control} value={bed.type} onChange={e => patch(ai, {
          beds: area.beds.map((item, i) => i === bi ? { ...item, type: e.target.value as BedType } : item)
        })}>
          {TYPES.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
        <input style={control} type="number" min="1" value={bed.quantity} aria-label="Bed quantity"
          onChange={e => patch(ai, { beds: area.beds.map((item, i) => i === bi ? { ...item, quantity: Number(e.target.value) } : item) })}/>
        <button type="button" onClick={() => patch(ai, { beds: area.beds.filter((_, i) => i !== bi) })}>Eliminar / Remove</button>
      </div>)}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => patch(ai, { beds: [...area.beds, { type: "QUEEN", quantity: 1 }] })}>+ Cama / Bed</button>
        <button type="button" onClick={() => onChange(value.filter((_, i) => i !== ai).map((item, i) => ({ ...item, sortOrder: i })))}>Eliminar área / Remove area</button>
      </div>
    </div>)}
  </div>;
}
