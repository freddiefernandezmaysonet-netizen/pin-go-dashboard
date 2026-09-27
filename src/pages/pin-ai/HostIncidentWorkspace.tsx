import { useCallback, useEffect, useRef, useState } from "react";
import { IncidentApiError, incidentError, type HostCommand, type HostIncident, type HostOperation, type HostThread, type IncidentApi } from "../../api/hostIncidents";
import "./hostIncidents.css";

const labels: Record<HostOperation, string> = { NOTE: "Nota privada / Private note", ACKNOWLEDGE: "Atención confirmada / Acknowledged", PUBLISH: "Actualización al huésped / Guest update", RESOLVE: "Resolución del anfitrión / Host resolution" };
const stateLabel = (state: string) => state === "RESOLVED" ? "Resuelto por el anfitrión / Host resolved" : "Pendiente de resolución / Unresolved";
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function HostIncidentWorkspace({ api, reference, onSelect }: { api: IncidentApi; reference?: string; onSelect: (ref: string) => void }) {
  const [items, setItems] = useState<HostIncident[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [filter, setFilter] = useState("");
  const listLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]); setCursor(null);
    api.list(undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) { setItems(result.items); setCursor(result.nextCursor); }
    }).catch(e => { if (!controller.signal.aborted) setError(incidentError(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, generation]);
  async function more() {
    if (!cursor || listLock.current) return;
    listLock.current = true; setLoading(true); setError("");
    try { const result = await api.list(cursor); setItems(old => [...old, ...result.items.filter(x => !old.some(y => y.reference === x.reference))]); setCursor(result.nextCursor); }
    catch (e) { setError(incidentError(e)); if (e instanceof IncidentApiError && [401, 403, 404].includes(e.status)) setItems([]); }
    finally { listLock.current = false; setLoading(false); }
  }
  const shown = items.filter(x => `${x.reference} ${x.propertyName} ${x.reservationNumber ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return <main className="host-incidents">
    <header className="hi-heading"><div><span className="hi-eyebrow">PIN AI · GUEST OPERATIONS</span><h1>Incidentes de huéspedes</h1><p>Guest incidents · Un hilo por caso, dentro de tu organización.</p></div><button disabled={loading} onClick={() => setGeneration(x => x + 1)}>Actualizar / Refresh</button></header>
    <div className="hi-layout"><aside className="hi-panel" aria-label="Incidentes / Incidents">
      <h2>Bandeja de la organización</h2><label>Buscar en los casos cargados / Search loaded cases<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Reserva, propiedad o incidente" /></label>
      {error && <p role="alert" className="hi-error">{error}</p>}
      {loading && <p role="status">Cargando / Loading…</p>}
      {!loading && !error && shown.length === 0 && <p>No hay casos en esta vista. / No cases in this view.</p>}
      <ul className="hi-cases">{shown.map(item => <li key={item.reference}><button aria-current={reference === item.reference ? "page" : undefined} onClick={() => onSelect(item.reference)}><strong>{item.reservationNumber ?? "Reserva / Reservation"}</strong><span>{item.propertyName}</span><small>{item.reference}</small><span className="hi-badge">{stateLabel(item.state)}</span></button></li>)}</ul>
      {cursor && <button disabled={loading} onClick={() => void more()}>Cargar más / Load more</button>}
    </aside>
    {reference ? <IncidentThread key={reference} api={api} reference={reference} onChanged={() => setGeneration(x => x + 1)} /> : <section className="hi-panel hi-empty"><h2>Selecciona un incidente</h2><p>Revisa el reporte, registra notas privadas y comparte únicamente las actualizaciones que apruebes.</p><p>Select a case to review the report and coordinate the response.</p></section>}
    </div>
  </main>;
}

function IncidentThread({ api, reference, onChanged }: { api: IncidentApi; reference: string; onChanged: () => void }) {
  const [thread, setThread] = useState<HostThread | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [operation, setOperation] = useState<HostOperation>("NOTE");
  const [review, setReview] = useState<HostCommand | null>(null);
  const [uncertain, setUncertain] = useState<HostCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const mounted = useRef(true);
  const readController = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    setLoading(true); setError(""); setThread(null);
    try { const result = await api.read(reference, controller.signal); if (!controller.signal.aborted) setThread(result); }
    catch (e) { if (!controller.signal.aborted) setError(incidentError(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [api, reference]);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; readController.current?.abort(); }; }, [refresh]);
  function prepare(action: HostOperation) {
    if (!thread || busy || loading || uncertain || review || lock.current) return;
    if (action !== "ACKNOWLEDGE" && !text.trim()) return;
    setReview({ requestId: crypto.randomUUID(), expectedVersion: thread.version, operation: action, text: action === "ACKNOWLEDGE" ? "" : text.trim() });
    setNotice("");
  }
  async function submit(command: HostCommand) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await api.command(reference, command);
      if (!mounted.current) return;
      setReview(null); setUncertain(null); if (command.operation !== "ACKNOWLEDGE") setText("");
      setNotice(command.operation === "PUBLISH" ? "Actualización publicada en el portal del huésped. No confirma lectura ni envío de email. / Published in the guest portal; delivery by email and reading are not confirmed." : "Acción registrada. / Action recorded.");
      await refresh(); if (mounted.current) onChanged();
    } catch (e) {
      if (!mounted.current) return;
      setReview(null); setError(incidentError(e));
      if (e instanceof IncidentApiError && e.status >= 400 && e.status < 500) {
        setUncertain(null); setThread(null);
      } else { setUncertain(command); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const disabled = busy || loading || !!uncertain || !!review || !thread || thread.state === "RESOLVED";
  return <section className="hi-panel hi-thread" aria-label="Conversación del incidente / Incident thread">
    <header className="hi-thread-heading"><div><span className="hi-eyebrow">{reference}</span><h2>{thread?.propertyName ?? "Conversación / Conversation"}</h2><p>{thread?.reservationNumber}</p></div><button disabled={busy || loading || !!review || !!uncertain} onClick={() => void refresh()}>Actualizar caso / Refresh case</button></header>
    {loading && <p role="status">Recuperando historial / Restoring history…</p>}
    {error && <p className="hi-error" role="alert">{error}</p>}
    {notice && <p className="hi-notice" role="status">{notice}</p>}
    {uncertain && <div className="hi-warning"><p>El resultado es incierto. Reintenta la misma acción para verificarla sin duplicarla. No cierres esta página durante la verificación. / Retry the same action to verify its result without duplication.</p><button disabled={busy} onClick={() => void submit(uncertain)}>Verificar misma acción / Retry same action</button></div>}
    {thread && <>
      <div className="hi-case-status"><span className="hi-badge">{stateLabel(thread.state)}</span><p>{thread.acknowledgedAt ? `Atención confirmada / Acknowledged · ${date(thread.acknowledgedAt)}` : "Sin acuse de atención / Not acknowledged"}</p></div>
      <div className="hi-report"><strong>Reporte del huésped · Sin verificar / Guest report · Unverified</strong><p>{thread.reportedFacts}</p></div>
      {!thread.acknowledgedAt && thread.state !== "RESOLVED" && <button disabled={disabled} onClick={() => prepare("ACKNOWLEDGE")}>Confirmar atención / Acknowledge</button>}
      <ol className="hi-events" aria-label="Historial / History">{thread.messages.map(event => <li key={event.id} className={event.audience === "GUEST" ? "hi-event hi-public" : "hi-event"}><div><strong>{labels[event.kind]}</strong><time dateTime={event.createdAt}>{date(event.createdAt)}</time></div><small>{event.audience === "GUEST" ? "Visible para el huésped / Guest-visible" : "Solo organización / Organization only"}</small><p>{event.text || labels[event.kind]}</p></li>)}</ol>
      {thread.messages.length === 0 && <p>Aún no hay actividad del anfitrión. / No host activity yet.</p>}
      {thread.state === "RESOLVED" ? <p className="hi-notice">El anfitrión registró la resolución. Esto no verifica una reparación física. / Host-reported resolution; physical repair is not independently verified.</p> : <form className="hi-composer" onSubmit={e => { e.preventDefault(); prepare(operation); }}>
        <label>Tipo de acción / Action<select disabled={disabled} value={operation} onChange={e => setOperation(e.target.value as HostOperation)}><option value="NOTE">Nota privada / Private note</option><option value="PUBLISH">Publicar al huésped / Publish to guest</option><option value="RESOLVE">Marcar resuelto / Mark resolved</option></select></label>
        <p>{operation === "PUBLISH" ? "Este texto exacto será visible en el portal del huésped. / This exact text will be guest-visible." : "Esta nota es privada para la organización. / This note stays within the organization."}</p>
        <label>{operation === "RESOLVE" ? "Resultado de la revisión / Review outcome" : "Mensaje / Message"}<textarea rows={5} maxLength={4000} value={text} disabled={disabled} onChange={e => setText(e.target.value)} /></label>
        <div className="hi-composer-footer"><small>{text.length}/4000</small><button className="hi-primary" disabled={disabled || !text.trim()}>Revisar acción / Review action</button></div>
      </form>}
    </>}
    {review && <section className="hi-review" aria-label="Revisar acción / Review action"><h3>{labels[review.operation]}</h3><p>{review.operation === "PUBLISH" ? "Confirma la publicación de este texto exacto al huésped. / Confirm this exact guest-visible text." : review.operation === "RESOLVE" ? "Se cerrará únicamente este incidente. La nota quedará privada; el huésped podrá consultar el estado resuelto. / Only this incident will close. The note is private; resolved status is guest-visible." : "La acción quedará registrada en este incidente. / This action will be recorded for this incident."}</p>{review.text && <blockquote>{review.text}</blockquote>}<div className="hi-actions"><button disabled={busy} onClick={() => setReview(null)}>Volver / Back</button><button className="hi-primary" disabled={busy} onClick={() => void submit(review)}>{busy ? "Guardando / Saving…" : "Confirmar acción / Confirm action"}</button></div></section>}
  </section>;
}
