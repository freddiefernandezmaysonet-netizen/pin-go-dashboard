import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPinAIProperty, setPinAIProperty, PinAIActivationError } from "../../api/pinAIActivation";

export function PinAISettingsCard({ propertyId }: { propertyId: string }) {
  return <PropertySettings key={propertyId} propertyId={propertyId} />;
}
function PropertySettings({ propertyId }: { propertyId: string }) {
  const query = useQuery({ queryKey: ["pin-ai-settings", propertyId],
    queryFn: ({ signal }) => getPinAIProperty(propertyId, signal), retry: false });
  const [draft, setDraft] = useState<boolean | undefined>();
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [acceptedPrice, setAcceptedPrice] = useState(false);
  const busy = useRef(false);
  const view = query.data;
  const needsAcceptance = !!view && view.billing.acceptedVersion !== view.billing.version;
  async function reload() {
    if (busy.current) return;
    const result = await query.refetch();
    if (result.isSuccess) { setDraft(undefined); setAcceptedPrice(false); setNeedsReload(false); setNotice(""); }
  }
  async function save() {
    if (!view || busy.current || needsReload || draft === undefined || (draft && !acceptedPrice)) return;
    busy.current = true; setSaving(true); setNotice("");
    try {
      await setPinAIProperty(view, draft);
      const result = await query.refetch();
      if (!result.isSuccess) throw new Error("Refresh required");
      setDraft(undefined); setAcceptedPrice(false); setNotice("Configuración guardada.");
    } catch (error) {
      setNeedsReload(true);
      const messages: Record<string, string> = {
        PIN_AI_CONNECT_ACCOUNT_REQUIRED: "Conecta tu cuenta de Stripe en Payments & Payouts antes de activar Pin AI.",
        PIN_AI_CONNECT_ACCOUNT_INCOMPATIBLE: "Tu cuenta Stripe Connect todavía no es compatible con el descuento de Pin AI. Contacta a Pin&Go antes de activarlo.",
        PIN_AI_CONNECT_VERIFICATION_UNAVAILABLE: "No pudimos verificar tu cuenta Stripe. Actualiza e intenta nuevamente.",
        PIN_AI_ACTIVATION_CONFLICT: "La configuración cambió. Actualiza antes de guardar nuevamente.",
      };
      setNotice(error instanceof PinAIActivationError && messages[error.code]
        ? messages[error.code]
        : "No pudimos confirmar el estado final. Actualiza antes de intentar otra vez.");
    } finally { busy.current = false; setSaving(false); }
  }
  const states = { EXISTING_SCOPE: "Disponibilidad limitada", DISABLED: "Desactivado",
    ENABLED: "Activado", PENDING_ACTIVATION: "Configurado · activación pendiente" };
  return <section aria-labelledby={`pin-ai-title-${propertyId}`} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <h2 id={`pin-ai-title-${propertyId}`} className="text-lg font-semibold">Pin AI · Asistencia al huésped</h2>
    <p>Responde consultas de la estadía y permite reportar incidentes al anfitrión. La configuración se aplica a las reservas elegibles de esta propiedad, incluidas las nuevas.</p>
    {query.isPending ? <p role="status">Cargando configuración…</p> : null}
    {query.isError ? <p role="alert">No se pudo cargar la configuración. Comprueba tus permisos e intenta nuevamente.</p> : null}
    {view && !query.isError ? <>
      <p><strong>Estado: {states[view.state]}</strong></p>
      {view.state === "PENDING_ACTIVATION" ? <p>La configuración está guardada; Pin&Go debe completar su puesta en marcha para confirmar la disponibilidad.</p> : null}
      {!view.organization.enabled ? <p>Pin&Go debe habilitar el servicio para tu organización antes de activarlo aquí.</p> : null}
      <label className="flex items-center gap-3"><input type="checkbox" checked={draft ?? view.enabled}
        disabled={saving || query.isFetching || needsReload || !view.organization.enabled}
        onChange={event => { setDraft(event.target.checked); setAcceptedPrice(false); setNotice(""); }} />Activar Pin AI en esta propiedad</label>
      {view.enabled && needsAcceptance ? <button type="button" disabled={saving || needsReload || query.isFetching}
        onClick={() => { setDraft(true); setAcceptedPrice(false); }}>Revisar y renovar autorización de cobro</button> : null}
      <p className="text-sm text-slate-600">Tarifa para el anfitrión: USD $1.00 por reservación con Pin AI activado, sin importar su origen, descontado de su cuenta Stripe Connect. Un cargo por reserva, desde 24 horas antes del check-in; las canceladas antes de esa ventana quedan excluidas. {view.billing.collectionReady ? "Los cargos elegibles se procesan desde tu saldo Connect." : "El mecanismo de cobro está pendiente de habilitación."}</p>
      {draft === true ? <label className="flex items-start gap-3"><input type="checkbox" checked={acceptedPrice}
        disabled={saving || needsReload || query.isFetching} onChange={event => setAcceptedPrice(event.target.checked)} />
        Autorizo a Pin&Go a descontar USD $1.00 del saldo disponible de mi cuenta Stripe Connect por cada reservación con Pin AI activado en esta propiedad, sin importar su origen, desde 24 horas antes del check-in. Si falta saldo, autorizo el reintento del cargo pendiente cuando haya fondos disponibles.</label> : null}
      <p className="text-sm text-slate-600">Los cambios de reserva y las respuestas en canales OTA tienen su propia habilitación. Desactivar esta asistencia conserva los incidentes ya registrados para que puedas atenderlos.</p>
      <button type="button" onClick={() => void save()} disabled={saving || query.isFetching || needsReload || draft === undefined || (draft === view.enabled && !needsAcceptance) || !view.organization.enabled || (draft === true && !acceptedPrice)}
        className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar configuración"}</button>
    </> : null}
    {notice ? <p role={needsReload ? "alert" : "status"}>{notice}</p> : null}
    <button type="button" onClick={() => void reload()} disabled={saving || query.isFetching}
      className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Actualizar estado</button>
  </section>;
}
