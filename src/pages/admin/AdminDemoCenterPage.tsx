import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Preparation = { ready: boolean; blockers: string[]; property: { name: string; timezone: string; cleaningStartOffsetMinutes: number; cleaningAccessMinutes: number };
  primaryAdmin: { email: string; fullName: string | null } | null;
  cleaner: { id: string; name: string; phone: string; language: string } | null; lock: { name: string | null } | null };
type Grant = { id: string; type: string; status: string; startsAt: string; endsAt: string; accessCodeMasked: string | null };
type Run = { requestId: string; stage: string; lastError: string | null; timezone: string; propertyName: string;
  reservation: { id: string; reservationNumber: string; guestName: string; checkIn: string; checkOut: string; accessGrants: Grant[];
    NfcAssignment: { id: string; role: string; status: string; startsAt: string; endsAt: string }[] };
  secureReady: boolean; manageReservationUrl: string | null;
  messages: { id: string; channel: string; to: string; communicationType: string | null; delivery: string }[];
  confirmations: { id: string; status: string }[]; cleaningWork: { startConfirmedAt: string | null; completionConfirmedAt: string | null }[];
  cleaningWindow: { startsAt: string; endsAt: string } | null;
  pinAI: { conversationStarted: boolean }; incidents: { reference: string; state: string; publishedReplies: number; url: string }[] };
type Request = { requestId: string; checkIn: string; checkOut: string; guestName: string; guestEmail: string; guestPhone: string;
  preferredLanguage: string; smsConsent: boolean; cleanerId: string; primaryAdminEmail: string; afterHoursAuthorized: boolean };
const API = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.pin-ngo.com").replace(/\/$/, "");
const KEY = "pingo-demo-run-v1";
const card: CSSProperties = { padding: 24, background: "white", border: "1px solid #dbe4ef", borderRadius: 18 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 16 };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", padding: 12, borderRadius: 8, font: "inherit" };
const button: CSSProperties = { background: "#1d4ed8", color: "white", border: 0, padding: "12px 18px", borderRadius: 10, fontWeight: 750, cursor: "pointer" };
function localDate(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
function stored(): Request | null { try { const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); return s?.requestId && s?.checkIn ? s : null; } catch { return null; } }
function errorText(code: string) {
  if (code.includes("RECIPIENTS_CHANGED")) return "Los destinatarios cambiaron. Actualiza la preparación antes de iniciar.";
  if (code.includes("CONFLICT")) return "Esta ejecución conserva sus datos originales. Continúa la misma reserva o prepara una nueva cuando termine.";
  if (code.includes("EMAIL")) return "Un correo necesita revisión. El reintento conserva la reserva y no duplica mensajes.";
  if (code.includes("CLEANER")) return "La invitación del cleaner necesita revisión.";
  if (code.includes("EXPIRED")) return "El horario de esta demostración ya terminó.";
  if (code.includes("PREPARATION")) return "Completa la preparación antes de iniciar la demostración.";
  return "No se pudo completar esta etapa. Puedes consultar el estado y continuar la misma ejecución.";
}
const names: Record<string,string> = { DIRECT_BOOKING_GUEST_CONFIRMATION: "Confirmación del huésped", DIRECT_BOOKING_HOST_NOTIFICATION: "Aviso al administrador",
  CLEANING_CONFIRMATION: "Invitación al cleaner", GUEST_ACCESS_PASSCODE: "Acceso del huésped", PIN_AI_GUEST_INCIDENT_HOST_NOTICE: "Aviso de incidente", CHECKOUT: "Checkout" };
const states: Record<string,string> = { DELIVERED: "Entregado", ACCEPTED: "Aceptado; entrega pendiente", ATTENTION_REQUIRED: "Requiere revisión", QUEUED: "En cola", FAILED: "Falló", SENT: "Aceptado", PENDING: "Pendiente", ACTIVE: "Activo", REVOKED: "Revocado", EXPIRED: "Expirado", CONFIRMED: "Confirmado" };
function preparationText(code: string) {
  const reasons: Record<string, string> = {
    PRIMARY_ADMIN_MISSING: "Falta identificar el administrador que recibirá los avisos de esta demo.",
    CLEANER_MISSING: "Falta un cleaner activo con teléfono asignado a la propiedad Demo.",
    CLEANER_COMPLETION_FLOW_NOT_CONFIGURED: "Falta configurar el tiempo de limpieza del cleaner Demo.",
    CLEANER_CARD_MISSING: "Falta la tarjeta NFC del cleaner en la propiedad Demo.",
    GUEST_CARDS_UNAVAILABLE: "Se necesitan dos tarjetas NFC Guest disponibles en la propiedad Demo.",
    TTLOCK_CONNECTION_MISSING: "Falta conectar TTLock para esta organización.",
    CLEANING_NFC_DISABLED: "El acceso NFC de limpieza está desactivado en la propiedad Demo.",
    AGREEMENT_MISSING: "Falta un acuerdo de huésped activo en la propiedad Demo.",
    DEMO_LOCK_BINDING_REQUIRED: "La propiedad Demo debe tener únicamente su cerradura de demostración asignada.",
    GUEST_SMS_DISABLED: "Los SMS al huésped están desactivados.",
  };
  if (reasons[code]) return reasons[code];
  if (code.startsWith("PIN_AI_") && code.endsWith("_DISABLED")) return "Una función necesaria de Pin AI está desactivada. Requiere revisión de configuración.";
  if (code.endsWith("_MISSING")) return "Falta configurar una conexión necesaria para la demostración.";
  return "Hay un requisito pendiente de revisión antes de iniciar.";
}

export default function AdminDemoCenterPage() {
  const [request, setRequest] = useState<Request | null>(stored);
  const [checkIn, setCheckIn] = useState(() => localDate(new Date(Date.now()+5*60000)));
  const [checkOut, setCheckOut] = useState(() => localDate(new Date(Date.now()+25*60000)));
  const [guestName, setGuestName] = useState("Pin&Go Demo Guest");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [language, setLanguage] = useState("es");
  const [sms, setSms] = useState(false);
  const [consent, setConsent] = useState(false);
  const [prep, setPrep] = useState<Preparation | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const polling = useRef<AbortController | null>(null);
  const prepare = useCallback(async () => {
    try { const res = await fetch(`${API}/api/internal/admin/demo/preparation`, { credentials: "include", cache: "no-store" });
      const data = await res.json(); if (!res.ok || !data.ok) throw new Error(); setPrep(data.data);
    } catch { setError("No se pudo leer la preparación de Demo Center."); }
  }, []);
  useEffect(() => { void prepare(); }, [prepare]);
  const refresh = useCallback(async () => {
    if (!request) return;
    polling.current?.abort();
    const controller = new AbortController(); polling.current = controller;
    try {
      const res = await fetch(`${API}/api/internal/admin/demo/runs/${request.requestId}`, { credentials: "include", cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok && data.ok) setRun(data.data);
      else if (res.status !== 404) throw new Error();
    } catch (error) { if (!controller.signal.aborted) throw error; }
  }, [request]);
  useEffect(() => {
    if (!request) return;
    let active = true;
    const update = () => { if (active && !document.hidden) void refresh().catch(() => setError("La actualización se interrumpió. La reserva conserva su estado.")); };
    update(); const timer = window.setInterval(update, 10000);
    return () => { active = false; window.clearInterval(timer); polling.current?.abort(); };
  }, [refresh, request]);
  const start = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const payload = request ?? { requestId: crypto.randomUUID(), checkIn: new Date(checkIn).toISOString(), checkOut: new Date(checkOut).toISOString(),
        guestName: guestName.trim(), guestEmail: guestEmail.trim(), guestPhone: guestPhone.trim(), preferredLanguage: language,
        smsConsent: sms, cleanerId: prep?.cleaner?.id ?? "", primaryAdminEmail: prep?.primaryAdmin?.email ?? "", afterHoursAuthorized: consent };
      // Persist before the request so a lost response cannot create a second reservation.
      sessionStorage.setItem(KEY, JSON.stringify(payload)); setRequest(payload);
      const res = await fetch(`${API}/api/internal/admin/demo/run`, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json(); if (data.data) setRun(data.data);
      if (!res.ok || !data.ok) {
        setError(errorText(data.error ?? ""));
        if (data.safeToEdit === true && !data.data) {
          sessionStorage.removeItem(KEY); setRequest(null); void prepare();
        }
      }
    } catch { setError("Se interrumpió la solicitud. Consulta el estado o continúa; se conservará la misma ejecución."); }
    finally { submitting.current = false; setBusy(false); }
  };
  const format = (s: string) => new Date(s).toLocaleString("es-PR", { timeZone: run?.timezone ?? prep?.property.timezone ?? "America/Puerto_Rico" });
  const noActiveCredentials = !!run && run.reservation.accessGrants.every(g => ["REVOKED","EXPIRED"].includes(g.status)) &&
    run.reservation.NfcAssignment.every(g => ["REVOKED","EXPIRED","CANCELLED","ENDED"].includes(g.status));
  const canPrepareNext = !!run && new Date(run.reservation.checkOut).getTime() < Date.now() && noActiveCredentials &&
    run.cleaningWork.some(w => !!w.completionConfirmedAt);
  const stage = (title: string, children: React.ReactNode) => <section style={card}><h3 style={{marginTop:0}}>{title}</h3>{children}</section>;
  return <div style={{maxWidth:1100, margin:"0 auto", display:"grid", gap:20, color:"#0f172a"}}>
    <header style={{...card, background:"#0b2248",color:"white",border:0,padding:30}}>
      <div style={{color:"#93c5fd",fontWeight:800}}>PIN&GO · DEMO CENTER</div>
      <h1 style={{fontSize:30,margin:"10px 0"}}>Una reserva. Todo el recorrido.</h1>
      <p style={{margin:0,lineHeight:1.6}}>Reserva, comunicación, acceso, Pin AI y limpieza en la misma presentación.</p>
      <p style={{marginBottom:0,color:"#bfdbfe"}}>Pago e identidad simulados. Los mensajes y accesos requieren evidencia real.</p>
    </header>
    {error || run?.lastError ? <div role="alert" style={{...card,background:"#fff7ed",borderColor:"#fdba74"}}>{error || errorText(run?.lastError ?? "")}</div> : null}
    <section style={card}>
      <h2 style={{marginTop:0}}>Preparación</h2>
      {prep ? <>
        <div style={grid}><div><strong>{prep.property.name}</strong><p>{prep.lock?.name ?? "Cerradura pendiente"}</p></div>
          <div><strong>Administrador principal</strong><p>{prep.primaryAdmin?.email ?? "Pendiente"}</p></div>
          <div><strong>Cleaner de demostración</strong><p>{prep.cleaner?.name ?? "Pendiente"} · {prep.cleaner?.phone}</p></div></div>
        <p>Acceso de limpieza: checkout + {prep.property.cleaningStartOffsetMinutes} minutos; hasta {prep.property.cleaningAccessMinutes} minutos, limitado por la próxima ocupación.</p>
        {!prep.ready ? <div role="status">
          <p>Preparación incompleta: {prep.blockers.length} comprobaciones pendientes. La demo todavía no puede iniciarse.</p>
          <ul>{prep.blockers.map(code => <li key={code} style={{marginBottom:10}}>{preparationText(code)}
            <details><summary>Referencia para soporte</summary><code style={{overflowWrap:"anywhere"}}>{code}</code></details>
          </li>)}</ul>
        </div> : <p style={{color:"#166534"}}>Configuración comprobada. La operación física se verifica durante la presentación.</p>}
      </> : <p>Cargando preparación…</p>}
      <button type="button" onClick={() => void prepare()} style={{...button,background:"#e2e8f0",color:"#0f172a"}}>Actualizar preparación</button>
    </section>
    {!request ? <form style={card} onSubmit={e => {e.preventDefault(); void start();}}>
      <h2 style={{marginTop:0}}>Iniciar presentación</h2>
      <p>Selecciona los horarios en la zona de este dispositivo. El resultado mostrará la hora de la propiedad.</p>
      <div style={grid}>
        <label>Entrada<input required type="datetime-local" value={checkIn} onChange={e=>setCheckIn(e.target.value)} style={inputStyle}/></label>
        <label>Salida<input required type="datetime-local" min={checkIn} value={checkOut} onChange={e=>setCheckOut(e.target.value)} style={inputStyle}/></label>
        <label>Nombre del huésped<input required maxLength={120} value={guestName} onChange={e=>setGuestName(e.target.value)} style={inputStyle}/></label>
        <label>Email del huésped<input required type="email" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} style={inputStyle}/></label>
        <label>Teléfono del huésped<input type="tel" required placeholder="+17875550123" value={guestPhone} onChange={e=>setGuestPhone(e.target.value)} style={inputStyle}/></label>
        <label>Idioma<select value={language} onChange={e=>setLanguage(e.target.value)} style={inputStyle}><option value="es">Español</option><option value="en">English</option></select></label>
      </div>
      <p><label><input required type="checkbox" checked={sms} onChange={e=>setSms(e.target.checked)}/> El huésped autoriza los SMS de esta demostración.</label></p>
      <p><label><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Los destinatarios mostrados participan en la demo y el cleaner autoriza recibir su invitación ahora, incluso fuera del horario habitual.</label></p>
      <button disabled={busy || !prep?.ready || !consent || !sms} style={{...button,opacity:busy || !prep?.ready || !consent || !sms ? .5 : 1}}>Crear reserva Demo</button>
    </form> : <section style={card}>
      <h2 style={{marginTop:0}}>{run ? `Reserva ${run.reservation.reservationNumber}` : "Recuperando la misma ejecución"}</h2>
      {run ? <p>{run.reservation.guestName} · {format(run.reservation.checkIn)} → {format(run.reservation.checkOut)} · {run.timezone}</p> : null}
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <button disabled={busy} onClick={()=>void start()} style={button}>{busy ? "Procesando…" : "Continuar la misma ejecución"}</button>
        <button onClick={()=>void refresh().catch(()=>setError("No se pudo actualizar."))} style={{...button,background:"#475569"}}>Actualizar estado</button>
        {run?.manageReservationUrl ? <a href={run.manageReservationUrl} target="_blank" rel="noreferrer" style={button}>Abrir Manage Reservation</a> : null}
        <button disabled={!canPrepareNext || busy} onClick={()=>{polling.current?.abort();sessionStorage.removeItem(KEY);setRequest(null);setRun(null);setError("");setConsent(false);setCheckIn(localDate(new Date(Date.now()+5*60000)));setCheckOut(localDate(new Date(Date.now()+25*60000)));void prepare();}} style={{...button,background:"#475569",opacity:canPrepareNext ? 1 : .5}}>Preparar siguiente demo</button>
      </div>
      <p>La siguiente presentación se habilita al terminar la limpieza y quedar cerrados los accesos registrados.</p>
    </section>}
    {run ? <div style={grid}>
      {stage("1 · Reserva y registro", <p>{run.secureReady ? "Registro Demo preparado." : "Registro pendiente."} Pago e identidad simulados, sin cobro.</p>)}
      {stage("2 · Comunicaciones", <>{run.messages.length ? run.messages.map(m=><div key={m.id} style={{padding:"10px 0",borderBottom:"1px solid #e2e8f0",overflowWrap:"anywhere"}}><strong>{names[m.communicationType ?? ""] ?? "Mensaje de la reserva"}</strong><div>{m.to}</div><small>{states[m.delivery] ?? "Pendiente de confirmación"}</small></div>) : <p>Sin envíos registrados todavía.</p>}</>)}
      {stage("3 · Acceso real", <>{run.reservation.accessGrants.map(g=><p key={g.id}>{g.type === "GUEST" ? "Huésped" : "Cleaner"}: <strong>{states[g.status] ?? g.status}</strong><br/>{format(g.startsAt)} → {format(g.endsAt)}<br/>{g.accessCodeMasked ?? "Credencial pendiente"}</p>)}<p>Comprobar apertura y expiración en la cerradura Demo. Un estado registrado no sustituye esa prueba.</p></>)}
      {stage("4 · Pin AI", <><p>{run.pinAI.conversationStarted ? "Conversación registrada para esta reserva." : "Abre el portal e inicia la conversación."}</p><p>Pregunta por la propiedad y el horario de acceso. Después reporta un incidente de prueba.</p></>)}
      {stage("5 · Incidente y respuesta", <>{run.incidents.length ? run.incidents.map(i=><p key={i.reference}><a href={i.url} target="_blank" rel="noreferrer">{i.reference}</a> · {i.state === "RESOLVED" ? "Resuelto por el host" : "Abierto"}<br/>{i.publishedReplies} respuestas publicadas al huésped</p>) : <p>Sin incidentes registrados.</p>}</>)}
      {stage("6 · Checkout y limpieza", <><p>{new Date(run.reservation.checkOut).getTime() <= Date.now() ? "Horario de checkout alcanzado." : "Esperando el horario de checkout."}</p><p>Disponibilidad: {run.confirmations.some(c=>c.status === "CONFIRMED") ? "confirmada" : "pendiente"}.</p><p>Inicio: {run.cleaningWork.some(w=>w.startConfirmedAt) ? "registrado" : "pendiente"}. Finalización: {run.cleaningWork.some(w=>w.completionConfirmedAt) ? "registrada" : "pendiente"}.</p>{run.cleaningWindow ? <p>Acceso cleaner: {format(run.cleaningWindow.startsAt)} → {format(run.cleaningWindow.endsAt)}</p> : null}</>)}
    </div> : null}
  </div>;
}
