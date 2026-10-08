import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

export const PROPERTY_EDIT_TABS = [
  { id: "general", label: "General", description: "Datos y ubicación de la propiedad." },
  { id: "cleaning", label: "Limpieza", description: "Horarios, checklist y recuperación de limpiezas." },
  { id: "booking", label: "Reservas", description: "Página pública, alojamiento y políticas de reserva." },
  { id: "access", label: "Accesos y estadía", description: "Acceso del huésped y opciones de llegada y salida." },
  { id: "ai", label: "Pin AI", description: "Asistencia automática para los huéspedes." },
  { id: "pricing", label: "Tarifas", description: "Precios por noche, ajustes, servicios y cargos." },
  { id: "taxes", label: "Impuestos", description: "Impuestos aplicables a la propiedad." },
] as const;
export type PropertyEditTabId = typeof PROPERTY_EDIT_TABS[number]["id"];

export function PropertyEditTabs({ panels }: { panels: Record<PropertyEditTabId, ReactNode> }) {
  const [active, setActive] = useState<PropertyEditTabId>("general");
  const showingValidation = useRef(false);
  const validationPending = useRef(false);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="property-edit-tabs" onInvalidCapture={event => {
    // Native validation dispatches all invalid events in one pass. Keep the first
    // invalid field visible even when later failures belong to another tab.
    if (showingValidation.current) return;
    event.preventDefault();
    if (validationPending.current) return;
    const field = event.target as HTMLElement;
    const panel = field.closest<HTMLElement>("[data-property-tab]");
    if (!panel) return;
    validationPending.current = true;
    flushSync(() => setActive(panel.dataset.propertyTab as PropertyEditTabId));
    queueMicrotask(() => {
      field.focus();
      showingValidation.current = true;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.reportValidity();
      showingValidation.current = false;
      validationPending.current = false;
    });
  }}>
    <div className="property-edit-tablist" role="tablist" aria-label="Configuración de la propiedad">
      {PROPERTY_EDIT_TABS.map((tab, index) => <button key={tab.id} ref={element => { buttons.current[index] = element; }}
        type="button" role="tab" id={`property-tab-${tab.id}`} aria-controls={`property-panel-${tab.id}`}
        aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1}
        onClick={() => setActive(tab.id)} onKeyDown={event => {
          let next: number;
          if (event.key === "ArrowRight") next = (index + 1) % PROPERTY_EDIT_TABS.length;
          else if (event.key === "ArrowLeft") next = (index + PROPERTY_EDIT_TABS.length - 1) % PROPERTY_EDIT_TABS.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = PROPERTY_EDIT_TABS.length - 1;
          else return;
          event.preventDefault(); setActive(PROPERTY_EDIT_TABS[next].id); buttons.current[next]?.focus();
        }}>{tab.label}</button>)}
    </div>
    <p className="property-edit-save-note">Cambiar de pestaña conserva tus cambios. Usa “Save Changes” para guardar los campos de la propiedad; las tarjetas con su propio botón se guardan por separado.</p>
    {PROPERTY_EDIT_TABS.map(tab => <div key={tab.id} role="tabpanel" id={`property-panel-${tab.id}`}
      aria-labelledby={`property-tab-${tab.id}`} data-property-tab={tab.id} hidden={active !== tab.id}
      className="property-edit-panel" tabIndex={0}>
      <div className="property-edit-panel-heading"><h2>{tab.label}</h2><p>{tab.description}</p></div>
      {panels[tab.id]}
    </div>)}
  </div>;
}
