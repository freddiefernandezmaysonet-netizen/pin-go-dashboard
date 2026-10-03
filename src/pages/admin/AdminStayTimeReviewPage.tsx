import { useEffect, useRef, useState } from "react";
import { createStayTimeReviewApi, StayTimeReviewApiError } from "../../api/stayTimeReviews";
import type { StayTimeReviewApi, StayTimeReviewCommand, StayTimeReviewDetail, StayTimeReviewItem } from "../../api/stayTimeReviews";

const copy = {
  es: { title: "Revisión de horarios · Pin AI", intro: "Incidentes de entrada anticipada y salida tardía que requieren atención de Pin&Go.",
    open: "Pendientes", closed: "Resueltos", refresh: "Actualizar", more: "Siguiente página", first: "Primera página", empty: "No hay incidentes en esta vista.",
    loading: "Cargando…", error: "No se pudo completar la solicitud. Intenta nuevamente.", forbidden: "Tu sesión no tiene acceso. Inicia sesión como administrador de plataforma.",
    stale: "El incidente cambió. Actualiza antes de guardar; tu nota se conservará.", choose: "Selecciona un incidente para revisar su evidencia e historial.",
    note: "Nota interna de revisión", save: "Registrar revisión", saving: "Guardando…", saved: "Revisión registrada. El incidente conserva su estado.",
    meaning: "Registrar una revisión no cierra el incidente ni ejecuta cobros, devoluciones o cambios de acceso. El sistema lo cierra al confirmar la recuperación.",
    access: "El estado de este cambio no certifica el funcionamiento del acceso físico.", history: "Historial", recent: "Se muestran las últimas 50 entradas.",
    early: "Entrada anticipada", late: "Salida tardía", schedule: "Cambio de horario", paid: "Cobro verificado", refunded: "Devolución confirmada", unverified: "Pago sin verificar",
    payment: "Evidencia de pago", charge: "Cargo adicional", attempts: "Intentos de recuperación", next: "Próximo intento", reconciliation: "Conciliación completada", yes: "Sí", no: "Pendiente",
    state: "Estado del cambio", review: "Revisión del operador", event: "Estado de recuperación", time: "Zona horaria", resolved: "Resuelto", pending: "Requiere revisión" },
  en: { title: "Stay-time review · Pin AI", intro: "Early check-in and late checkout incidents requiring Pin&Go attention.",
    open: "Pending", closed: "Resolved", refresh: "Refresh", more: "Next page", first: "First page", empty: "No incidents in this view.",
    loading: "Loading…", error: "The request could not be completed. Please try again.", forbidden: "Your session cannot access this page. Sign in as a platform administrator.",
    stale: "The incident changed. Refresh before saving; your note will be kept.", choose: "Select an incident to review its evidence and history.",
    note: "Internal review note", save: "Record review", saving: "Saving…", saved: "Review recorded. The incident retains its state.",
    meaning: "Recording a review does not close the incident or execute payments, refunds or access changes. The system closes it after confirmed recovery.",
    access: "This change's status does not certify physical access operation.", history: "History", recent: "Showing the latest 50 entries.",
    early: "Early check-in", late: "Late checkout", schedule: "Schedule change", paid: "Payment verified", refunded: "Refund confirmed", unverified: "Payment unverified",
    payment: "Payment evidence", charge: "Additional charge", attempts: "Recovery attempts", next: "Next attempt", reconciliation: "Reconciliation completed", yes: "Yes", no: "Pending",
    state: "Change status", review: "Operator review", event: "Recovery state", time: "Timezone", resolved: "Resolved", pending: "Review required" },
};
type Language = keyof typeof copy;
const statuses: Record<Language, Record<string, string>> = {
  es: { APPLIED: "Aplicado", AWAITING_PAYMENT: "Esperando pago", PAYMENT_PROCESSING: "Procesando pago", PAYMENT_FAILED: "Pago fallido", HOST_APPROVAL_REQUIRED: "Requiere aprobación del anfitrión", APPLYING: "Aplicando cambio", EXPIRED: "Vencido", CANCELLED: "Cancelado", FAILED: "Fallido", DRAFT: "Borrador", READY: "Listo" },
  en: { APPLIED: "Applied", AWAITING_PAYMENT: "Awaiting payment", PAYMENT_PROCESSING: "Processing payment", PAYMENT_FAILED: "Payment failed", HOST_APPROVAL_REQUIRED: "Host approval required", APPLYING: "Applying change", EXPIRED: "Expired", CANCELLED: "Cancelled", FAILED: "Failed", DRAFT: "Draft", READY: "Ready" },
};
const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50";
const api = createStayTimeReviewApi(import.meta.env.VITE_API_BASE ?? "http://localhost:3000");
export default function AdminStayTimeReviewPage() {
  const [language, setLanguage] = useState<Language>("es");
  return <div className="space-y-5"><label className="block text-sm">Idioma / Language <select value={language}
    onChange={e => setLanguage(e.target.value as Language)} className={button}><option value="es">Español</option><option value="en">English</option></select></label>
    <StayTimeReviewWorkspace api={api} language={language} /></div>;
}
function message(error: unknown, text: typeof copy[Language]) {
  return error instanceof StayTimeReviewApiError && [401, 403].includes(error.status) ? text.forbidden :
    error instanceof StayTimeReviewApiError && error.status === 409 ? text.stale : text.error;
}
export function StayTimeReviewWorkspace({ api, language = "es" }: { api: StayTimeReviewApi; language?: Language }) {
  const text = copy[language];
  const [state, setState] = useState<"OPEN" | "RESOLVED">("OPEN"), [after, setAfter] = useState<string | null>(null);
  const [data, setData] = useState<{ items: StayTimeReviewItem[]; nextCursor: string | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [reload, setReload] = useState(0);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    api.list(state, after, controller.signal).then(v => { if (!controller.signal.aborted) setData(v); })
      .catch(e => { if (!controller.signal.aborted) setError(message(e, text)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, state, after, reload, text]);
  return <section className="space-y-5">
    <header><h1 className="text-2xl font-semibold text-slate-900">{text.title}</h1><p className="mt-2 text-slate-600">{text.intro}</p></header>
    <div className="flex flex-wrap gap-3"><select aria-label="View" value={state} className={button} onChange={e => {
      setLoading(true); setError(""); setData(null); setState(e.target.value as "OPEN" | "RESOLVED"); setAfter(null); setSelected(null);
    }}><option value="OPEN">{text.open}</option><option value="RESOLVED">{text.closed}</option></select>
      <button className={button} disabled={loading} onClick={() => { setLoading(true); setError(""); setReload(v => v + 1); }}>{text.refresh}</button>
      {after && <button className={button} onClick={() => { setLoading(true); setError(""); setData(null); setAfter(null); setSelected(null); }}>{text.first}</button>}
    </div>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">{text.loading}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]"><div className="space-y-3">
      {data?.items.length === 0 && <p className={panel}>{text.empty}</p>}
      {data?.items.map(item => <button key={item.id} aria-pressed={selected === item.id}
        className={`${panel} w-full text-left ${selected === item.id ? "ring-2 ring-blue-500" : ""}`} onClick={() => setSelected(item.id)}>
        <span className="block text-xs font-semibold uppercase text-blue-700">{item.state === "RESOLVED" ? text.resolved : text.pending}</span>
        <strong className="mt-2 block">{item.property}</strong><span className="block text-sm text-slate-600">{item.organization}</span>
        <span className="mt-2 block">{item.reservationNumber ?? "—"}</span>
      </button>)}
      {data?.nextCursor && <button className={button} onClick={() => { setLoading(true); setError(""); setData(null); setAfter(data.nextCursor); setSelected(null); }}>{text.more}</button>}
    </div><div>{selected ? <ReviewDetail key={selected} id={selected} api={api} language={language} /> : <p className={panel}>{text.choose}</p>}</div></div>
  </section>;
}
function ReviewDetail({ id, api, language }: { id: string; api: StayTimeReviewApi; language: Language }) {
  const text = copy[language];
  const [data, setData] = useState<StayTimeReviewDetail | null>(null), [note, setNote] = useState("");
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false), [stale, setStale] = useState(false), [reload, setReload] = useState(0);
  const pending = useRef<StayTimeReviewCommand | null>(null), busy = useRef(false), active = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); active.current = controller; return () => controller.abort(); }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    api.read(id, controller.signal).then(v => { if (!controller.signal.aborted) { setData(v); setStale(false); } })
      .catch(e => { if (!controller.signal.aborted) { setData(null); setError(message(e, text)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, api, reload, text]);
  const format = (value: string | null) => {
    if (!value) return "—";
    try { return new Date(value).toLocaleString(language === "es" ? "es-PR" : "en-US", { timeZone: data?.item.timezone ?? "UTC" }); }
    catch { return "—"; }
  };
  async function save() {
    if (busy.current || !data || stale || loading || !note.trim()) return;
    busy.current = true; setSaving(true); setSaved(false); setError("");
    const controller = active.current!;
    if (!pending.current || pending.current.note !== note.trim()) pending.current = {
      requestId: crypto.randomUUID(), expectedUpdatedAt: data.item.updatedAt, note: note.trim(),
    };
    try {
      await api.review(id, pending.current, controller.signal);
      if (!controller.signal.aborted) { pending.current = null; setNote(""); setSaved(true); setLoading(true); setReload(v => v + 1); }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(message(e, text));
        if (e instanceof StayTimeReviewApiError && e.status === 409) { pending.current = null; setStale(true); }
      }
    } finally { busy.current = false; if (!controller.signal.aborted) setSaving(false); }
  }
  const item = data?.item;
  return <article className={`${panel} space-y-4`}>
    <button className={button} disabled={saving || loading} onClick={() => { setLoading(true); setError(""); setReload(v => v + 1); }}>{text.refresh}</button>
    {loading && <p role="status">{text.loading}</p>}{error && <p role="alert">{error}</p>}{saved && <p role="status" className="text-green-700">{text.saved}</p>}
    {item && <>
      <h2 className="text-xl font-semibold">{item.operation === "EARLY_CHECKIN" ? text.early : item.operation === "LATE_CHECKOUT" ? text.late : text.schedule}</h2>
      <p>{item.property} · {item.reservationNumber ?? "—"}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm"><dt>{text.state}</dt><dd>{statuses[language][item.modificationStatus] ?? text.no}</dd>
        <dt>{text.charge}</dt><dd>{item.currency.toUpperCase()} {item.additionalChargeAmount}</dd>
        <dt>{text.payment}</dt><dd>{item.paymentEvidence === "PAID" ? text.paid : item.paymentEvidence === "REFUNDED" ? text.refunded : text.unverified}</dd>
        <dt>{text.reconciliation}</dt><dd>{item.reconciliationCompleted ? text.yes : text.no}</dd>
        <dt>{text.attempts}</dt><dd>{item.attempts}</dd><dt>{text.next}</dt><dd>{format(item.nextAttemptAt)}</dd><dt>{text.time}</dt><dd>{item.timezone ?? "UTC"}</dd></dl>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{text.access}</p>
      {item.state === "ACTION_REQUIRED" && <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3">
        <p className="text-sm text-slate-600">{text.meaning}</p><label className="block">{text.note}<textarea value={note} maxLength={2000}
          disabled={saving} onChange={e => setNote(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3" /></label>
        <button className={`${button} bg-blue-700 text-white`} disabled={saving || loading || stale || !note.trim()}>{saving ? text.saving : text.save}</button>
      </form>}
      <h3 className="font-semibold">{text.history}</h3>{data?.historyHasMore && <p>{text.recent}</p>}
      <ol className="space-y-3">{data?.history.map(row => <li key={row.id} className="border-l-2 border-blue-200 pl-3 text-sm">
        <time>{format(row.at)}</time><strong className="block">{row.kind === "OPERATOR_REVIEW" ? text.review : text.event}</strong>
        <p className="whitespace-pre-wrap break-words">{row.note ?? (row.state === "RESOLVED" ? text.resolved : text.pending)}</p>
      </li>)}</ol>
    </>}
  </article>;
}
