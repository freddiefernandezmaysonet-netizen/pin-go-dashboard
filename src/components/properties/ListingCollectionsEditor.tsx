import type {
  AdditionalConsideration,
  SafetyConsideration,
  SharedSpace,
} from "./propertyListingDetails.types";

const control: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 13,
  boxSizing: "border-box",
  background: "#fff",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 8,
};
const item: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};
const SHARED_TYPES: SharedSpace["type"][] = [
  "POOL","HOT_TUB","KITCHEN","PATIO","YARD","LIVING_ROOM","LAUNDRY","OTHER",
];
const SAFETY_TYPES: SafetyConsideration["type"][] = [
  "POOL","HOT_TUB","WATERFRONT","HEIGHTS","STAIRS","OTHER",
];

export function ListingCollectionsEditor({
  sharedSpaces,
  safetyConsiderations,
  additionalConsiderations,
  onSharedSpacesChange,
  onSafetyConsiderationsChange,
  onAdditionalConsiderationsChange,
}: {
  sharedSpaces: SharedSpace[];
  safetyConsiderations: SafetyConsideration[];
  additionalConsiderations: AdditionalConsideration[];
  onSharedSpacesChange: (value: SharedSpace[]) => void;
  onSafetyConsiderationsChange: (value: SafetyConsideration[]) => void;
  onAdditionalConsiderationsChange: (value: AdditionalConsideration[]) => void;
}) {
  const normalizeOrder = <T extends { sortOrder: number }>(values: T[]) =>
    values.map((value, index) => ({ ...value, sortOrder: index }));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Espacios compartidos / Shared spaces</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
              Añade solo espacios que el huésped realmente compartirá. / Add only spaces the guest will actually share.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onSharedSpacesChange([
                ...sharedSpaces,
                { type: "OTHER", labelEn: null, labelEs: null, sortOrder: sharedSpaces.length },
              ])
            }
          >
            + Añadir / Add
          </button>
        </div>
        {sharedSpaces.map((space, index) => (
          <div key={index} style={item}>
            <div style={grid}>
              <select
                aria-label="Shared space type"
                style={control}
                value={space.type}
                onChange={(event) =>
                  onSharedSpacesChange(
                    sharedSpaces.map((current, i) =>
                      i === index ? { ...current, type: event.target.value as SharedSpace["type"] } : current
                    )
                  )
                }
              >
                {SHARED_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
              <input
                style={control}
                value={space.labelEn ?? ""}
                placeholder="Label (English)"
                maxLength={200}
                onChange={(event) =>
                  onSharedSpacesChange(sharedSpaces.map((current, i) =>
                    i === index ? { ...current, labelEn: event.target.value || null } : current
                  ))
                }
              />
              <input
                style={control}
                value={space.labelEs ?? ""}
                placeholder="Etiqueta (Español)"
                maxLength={200}
                onChange={(event) =>
                  onSharedSpacesChange(sharedSpaces.map((current, i) =>
                    i === index ? { ...current, labelEs: event.target.value || null } : current
                  ))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => onSharedSpacesChange(normalizeOrder(sharedSpaces.filter((_, i) => i !== index)))}
            >
              Eliminar / Remove
            </button>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Consideraciones de seguridad / Safety considerations</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
              Describe riesgos físicos conocidos sin inferir accesibilidad. / Describe known physical considerations without inferring accessibility.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onSafetyConsiderationsChange([
                ...safetyConsiderations,
                { type: "OTHER", descriptionEn: null, descriptionEs: null, isActive: true, sortOrder: safetyConsiderations.length },
              ])
            }
          >
            + Añadir / Add
          </button>
        </div>
        {safetyConsiderations.map((consideration, index) => (
          <div key={index} style={item}>
            <div style={grid}>
              <select
                aria-label="Safety consideration type"
                style={control}
                value={consideration.type}
                onChange={(event) =>
                  onSafetyConsiderationsChange(safetyConsiderations.map((current, i) =>
                    i === index ? { ...current, type: event.target.value as SafetyConsideration["type"] } : current
                  ))
                }
              >
                {SAFETY_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
              <textarea
                style={control}
                value={consideration.descriptionEn ?? ""}
                placeholder="Description (English)"
                maxLength={2000}
                onChange={(event) =>
                  onSafetyConsiderationsChange(safetyConsiderations.map((current, i) =>
                    i === index ? { ...current, descriptionEn: event.target.value || null } : current
                  ))
                }
              />
              <textarea
                style={control}
                value={consideration.descriptionEs ?? ""}
                placeholder="Descripción (Español)"
                maxLength={2000}
                onChange={(event) =>
                  onSafetyConsiderationsChange(safetyConsiderations.map((current, i) =>
                    i === index ? { ...current, descriptionEs: event.target.value || null } : current
                  ))
                }
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={consideration.isActive}
                onChange={(event) =>
                  onSafetyConsiderationsChange(safetyConsiderations.map((current, i) =>
                    i === index ? { ...current, isActive: event.target.checked } : current
                  ))
                }
              />
              Activa / Active
            </label>
            <button
              type="button"
              onClick={() => onSafetyConsiderationsChange(normalizeOrder(safetyConsiderations.filter((_, i) => i !== index)))}
            >
              Eliminar / Remove
            </button>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Condiciones particulares / Additional considerations</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
              Para detalles importantes que no encajan en una regla estándar. / For important property-specific details not covered by a standard rule.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onAdditionalConsiderationsChange([
                ...additionalConsiderations,
                { titleEn: null, titleEs: null, descriptionEn: null, descriptionEs: null, isActive: true, sortOrder: additionalConsiderations.length },
              ])
            }
          >
            + Añadir / Add
          </button>
        </div>
        {additionalConsiderations.map((consideration, index) => (
          <div key={index} style={item}>
            <div style={grid}>
              <input
                style={control}
                value={consideration.titleEn ?? ""}
                placeholder="Title (English)"
                maxLength={200}
                onChange={(event) =>
                  onAdditionalConsiderationsChange(additionalConsiderations.map((current, i) =>
                    i === index ? { ...current, titleEn: event.target.value || null } : current
                  ))
                }
              />
              <input
                style={control}
                value={consideration.titleEs ?? ""}
                placeholder="Título (Español)"
                maxLength={200}
                onChange={(event) =>
                  onAdditionalConsiderationsChange(additionalConsiderations.map((current, i) =>
                    i === index ? { ...current, titleEs: event.target.value || null } : current
                  ))
                }
              />
              <textarea
                style={control}
                value={consideration.descriptionEn ?? ""}
                placeholder="Description (English)"
                maxLength={2000}
                onChange={(event) =>
                  onAdditionalConsiderationsChange(additionalConsiderations.map((current, i) =>
                    i === index ? { ...current, descriptionEn: event.target.value || null } : current
                  ))
                }
              />
              <textarea
                style={control}
                value={consideration.descriptionEs ?? ""}
                placeholder="Descripción (Español)"
                maxLength={2000}
                onChange={(event) =>
                  onAdditionalConsiderationsChange(additionalConsiderations.map((current, i) =>
                    i === index ? { ...current, descriptionEs: event.target.value || null } : current
                  ))
                }
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={consideration.isActive}
                onChange={(event) =>
                  onAdditionalConsiderationsChange(additionalConsiderations.map((current, i) =>
                    i === index ? { ...current, isActive: event.target.checked } : current
                  ))
                }
              />
              Activa / Active
            </label>
            <button
              type="button"
              onClick={() => onAdditionalConsiderationsChange(normalizeOrder(additionalConsiderations.filter((_, i) => i !== index)))}
            >
              Eliminar / Remove
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
