import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPinAIOrganizations, setPinAIOrganization, type PinAIOrganization } from "../../api/pinAIActivation";

export default function AdminPinAIActivationPage() {
  const [input, setInput] = useState(""), [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PinAIOrganization | null>(null);
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const busy = useRef(false);
  const query = useQuery({ queryKey: ["admin-pin-ai-organizations", search],
    queryFn: ({ signal }) => listPinAIOrganizations(search, signal), retry: false });
  async function save() {
    if (!selected || busy.current) return;
    busy.current = true; setSaving(true); setNotice("");
    try {
      await setPinAIOrganization(selected);
      setNotice("Configuración guardada. Cada propiedad se activa desde su configuración.");
    } catch { setNotice("No se pudo confirmar el cambio. Actualiza la lista antes de intentarlo nuevamente."); }
    finally { setSelected(null); await query.refetch(); busy.current = false; setSaving(false); }
  }
  return <main className="max-w-3xl space-y-5">
    <h1 className="text-2xl font-semibold">Pin AI · Habilitación de organizaciones</h1>
    <p>Habilita la asistencia para una organización. Sus administradores eligen las propiedades y aceptan la tarifa de USD $1.00 por reservación de cualquier origen (Direct Booking, OTA o manual) al activarlas. Habilitar la organización no genera un cargo inmediato ni activa cambios de reserva o mensajería OTA.</p>
    {query.data && !query.data.rolloutActive ? <p role="status">La aplicación de estos controles está pendiente. Puedes guardar la configuración; hasta su puesta en marcha se conserva la disponibilidad anterior del portal.</p> : null}
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setSelected(null); setSearch(input.trim()); }}>
      <label>Organización <input value={input} maxLength={80} disabled={saving} onChange={e => setInput(e.target.value)}
        className="ml-2 rounded-lg border border-slate-300 p-2" /></label>
      <button disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2">Buscar</button>
      <button type="button" disabled={saving || query.isFetching} onClick={() => { setSelected(null); void query.refetch(); }}
        className="rounded-lg border border-slate-300 px-4 py-2">Actualizar</button>
    </form>
    {query.isPending ? <p role="status">Cargando…</p> : null}
    {query.isError ? <p role="alert">No se pudo cargar la lista. Se requiere acceso de administrador de Pin&Go.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!query.isError ? query.data?.items.map(row => <section key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{row.name}</h2>
      <p>{row.pinAIRevision === 0 ? "Configuración actual conservada" : row.pinAIEnabled ? "Organización habilitada" : "Organización deshabilitada"}</p>
      <button disabled={saving || query.isFetching} onClick={() => { setSelected(row); setNotice(""); }} className="mt-2 rounded-lg border border-blue-700 px-4 py-2 text-blue-800">
        {row.pinAIEnabled ? "Deshabilitar organización" : "Habilitar organización"}</button>
    </section>) : null}
    {query.data?.items.length === 0 ? <p>No hay organizaciones que coincidan.</p> : null}
    {query.data?.items.length === 30 ? <p>Se muestran hasta 30 resultados. Usa un nombre más específico.</p> : null}
    {selected ? <section aria-label="Confirmar cambio" className="rounded-xl border border-blue-300 bg-blue-50 p-5 space-y-3">
      <p><strong>{selected.pinAIEnabled ? "Deshabilitar" : "Habilitar"} Pin AI para {selected.name}</strong></p>
      <p>{!query.data?.rolloutActive ? "Este cambio quedará guardado y se aplicará cuando se pongan en marcha estos controles." : selected.pinAIEnabled ? "Se detendrá la nueva asistencia del portal en sus propiedades. Los casos registrados se conservan." : "Las propiedades deberán estar activadas individualmente para recibir la asistencia. Se sustituye la disponibilidad limitada anterior del portal."}</p>
      <button disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-700 px-4 py-2 text-white">{saving ? "Guardando…" : "Confirmar cambio"}</button>
      <button disabled={saving} onClick={() => setSelected(null)} className="ml-3 rounded-lg border border-slate-300 px-4 py-2">Cancelar</button>
    </section> : null}
  </main>;
}
