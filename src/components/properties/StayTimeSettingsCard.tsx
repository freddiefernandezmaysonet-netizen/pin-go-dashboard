import { useEffect, useRef, useState } from "react";
import { getStayTimeSettings, saveStayTimeSettings, StayTimeSettingsApiError } from "../../api/stayTimeSettings";
import type { StayTimeSettingsResponse } from "../../api/stayTimeSettings";
import { formToSettings, settingsToForm } from "./stayTimeSettingsForm";
import type { StayTimeRuleForm, StayTimeSettingsForm } from "./stayTimeSettingsForm";

type Props = { propertyId: string; language?: "en" | "es" };
const copy = {
  en: {
    title: "Early check-in & late checkout", description: "Set a time limit and price for each service. Times use the property's timezone.",
    early: "Early check-in", late: "Late checkout", enabled: "Allow this service", earliest: "Earliest arrival", latest: "Latest departure",
    fee: "Pricing", free: "Free", fixed: "Fixed fee", hourly: "Per hour", amount: "Amount (USD, before tax)",
    rounding: "Hourly prices are prorated by minute and rounded to the nearest cent.",
    availability: "Requests must meet availability, cleaning and access requirements.",
    pending: "You can save your preferences. Automatic guest requests are not available yet.",
    save: "Save time preferences", saving: "Saving…", saved: "Time preferences saved.", loading: "Loading time preferences…",
    error: "Unable to load or save these preferences. Try again.", forbidden: "Only an organization administrator can manage these preferences.",
    conflict: "These preferences or property hours changed in another session. Reload before saving again; your unsaved edits will be replaced.",
    invalid: "Check the time limits and enter a positive amount with no more than two decimal places for paid services.",
    hours: "Early arrival must be before standard check-in, and late departure after standard checkout.",
    timezone: "Set a valid property timezone before allowing these services.", reload: "Reload saved preferences", retry: "Retry",
    standard: "Standard hours", timezoneMissing: "Timezone not configured",
  },
  es: {
    title: "Entrada anticipada y salida tardía", description: "Configura el horario límite y precio de cada servicio. Se usa la zona horaria de la propiedad.",
    early: "Entrada anticipada", late: "Salida tardía", enabled: "Permitir este servicio", earliest: "Entrada más temprana", latest: "Salida más tardía",
    fee: "Precio", free: "Gratis", fixed: "Tarifa fija", hourly: "Por hora", amount: "Importe (USD, antes de impuestos)",
    rounding: "La tarifa por hora se calcula proporcionalmente a los minutos y se redondea al centavo.",
    availability: "Las solicitudes deben cumplir los requisitos de disponibilidad, limpieza y acceso.",
    pending: "Puedes guardar tus preferencias. Las solicitudes automáticas de huéspedes aún no están disponibles.",
    save: "Guardar preferencias de horario", saving: "Guardando…", saved: "Preferencias de horario guardadas.", loading: "Cargando preferencias de horario…",
    error: "No se pudieron cargar o guardar las preferencias. Intenta nuevamente.", forbidden: "Solo un administrador de la organización puede gestionar estas preferencias.",
    conflict: "Otra sesión cambió estas preferencias o el horario de la propiedad. Recarga antes de guardar; se reemplazarán tus cambios sin guardar.",
    invalid: "Revisa los límites de horario e indica un importe positivo con hasta dos decimales para servicios con costo.",
    hours: "La entrada anticipada debe ser antes de la entrada habitual, y la salida tardía después de la salida habitual.",
    timezone: "Configura una zona horaria válida en la propiedad antes de permitir estos servicios.", reload: "Recargar preferencias guardadas", retry: "Reintentar",
    standard: "Horario habitual", timezoneMissing: "Zona horaria sin configurar",
  },
};
const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box" as const, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a" };

export function StayTimeSettingsCard(props: Props) {
  return <StayTimeSettingsFormCard key={props.propertyId} {...props} />;
}
function StayTimeSettingsFormCard({ propertyId, language }: Props) {
  const locale = language ?? (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en");
  const text = copy[locale];
  const [view, setView] = useState<StayTimeSettingsResponse | null>(null);
  const [form, setForm] = useState<StayTimeSettingsForm | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error" | "conflict">("loading");
  const [message, setMessage] = useState<keyof typeof text | null>(null);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    getStayTimeSettings(propertyId, abort.signal).then(result => {
      if (abort.signal.aborted) return;
      setView(result); setForm(settingsToForm(result.settings)); setPhase("ready"); setMessage(null);
    }).catch(error => {
      if (abort.signal.aborted) return;
      setPhase("error"); setMessage(error instanceof StayTimeSettingsApiError && error.status === 403 ? "forbidden" : "error");
    });
    return () => abort.abort();
  }, [propertyId, attempt]);

  function update(key: keyof StayTimeSettingsForm, patch: Partial<StayTimeRuleForm>) {
    setMessage(null);
    setForm(current => current ? { ...current, [key]: { ...current[key], ...patch } } : current);
  }
  async function save() {
    if (!view || !form || busy.current || phase !== "ready") return;
    let settings;
    try { settings = formToSettings(form); } catch { setMessage("invalid"); return; }
    if ((settings.earlyCheckin.enabled && settings.earlyCheckin.limitLocalTime >= view.checkInTime) ||
        (settings.lateCheckout.enabled && settings.lateCheckout.limitLocalTime <= view.checkOutTime)) {
      setMessage("hours"); return;
    }
    busy.current = true; setPhase("saving"); setMessage(null);
    const signal = controller.current?.signal;
    try {
      const result = await saveStayTimeSettings(propertyId, view.revision, settings, signal);
      if (signal?.aborted) return;
      setView(result); setForm(settingsToForm(result.settings)); setPhase("ready"); setMessage("saved");
    } catch (error) {
      if (signal?.aborted) return;
      const code = error instanceof StayTimeSettingsApiError ? error.code : "";
      const conflict = code === "STAY_TIME_SETTINGS_CONFLICT";
      setPhase(conflict ? "conflict" : "ready");
      setMessage(conflict ? "conflict" : code === "STAY_TIME_LIMIT_OUTSIDE_PROPERTY_HOURS" ? "hours" :
        code === "STAY_TIME_PROPERTY_TIMEZONE_REQUIRED" ? "timezone" :
        error instanceof StayTimeSettingsApiError && error.status === 403 ? "forbidden" :
        error instanceof StayTimeSettingsApiError && error.status === 400 ? "invalid" : "error");
    } finally { busy.current = false; }
  }
  function reload() { setPhase("loading"); setMessage(null); setAttempt(value => value + 1); }

  return <section aria-label={text.title} onKeyDown={event => {
    // This card lives inside the property's main form: Enter saves only this card.
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault(); void save();
    }
  }} style={{ border: "1px solid #bfdbfe", borderRadius: 18, padding: 18, background: "#fff", display: "grid", gap: 16 }}>
    <div><h2 style={{ margin: "0 0 6px", fontSize: 20 }}>{text.title}</h2><p style={{ margin: 0, color: "#475569" }}>{text.description}</p></div>
    {phase === "loading" && <p role="status">{text.loading}</p>}
    {view && form && phase !== "loading" && phase !== "error" && <>
      <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{text.standard}: {view.checkInTime} / {view.checkOutTime} · {view.timezone ?? text.timezoneMissing}</p>
      {!view.executionAvailable && <p style={{ margin: 0, padding: 12, background: "#eff6ff", borderRadius: 8, color: "#1e40af" }}>{text.pending}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16 }}>
        {(["earlyCheckin", "lateCheckout"] as const).map(key => {
          const rule = form[key];
          const prefix = `${propertyId}-${key}`;
          return <fieldset key={key} disabled={phase !== "ready"} style={{ minWidth: 0, margin: 0, border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, display: "grid", gap: 12 }}>
            <legend style={{ fontWeight: 600 }}>{key === "earlyCheckin" ? text.early : text.late}</legend>
            <label htmlFor={`${prefix}-enabled`}><input id={`${prefix}-enabled`} type="checkbox" checked={rule.enabled} onChange={event => update(key, { enabled: event.target.checked })} /> {text.enabled}</label>
            <label htmlFor={`${prefix}-time`}>{key === "earlyCheckin" ? text.earliest : text.latest}
              <input id={`${prefix}-time`} type="time" step="60" disabled={!rule.enabled} value={rule.limitLocalTime} onChange={event => update(key, { limitLocalTime: event.target.value })} style={inputStyle} />
            </label>
            <label htmlFor={`${prefix}-fee`}>{text.fee}
              <select id={`${prefix}-fee`} disabled={!rule.enabled} value={rule.mode} onChange={event => update(key, { mode: event.target.value as StayTimeRuleForm["mode"], ...(event.target.value === "FREE" ? { amount: "0.00" } : {}) })} style={inputStyle}>
                <option value="FREE">{text.free}</option><option value="FIXED">{text.fixed}</option><option value="PER_HOUR">{text.hourly}</option>
              </select>
            </label>
            {rule.mode !== "FREE" && <label htmlFor={`${prefix}-amount`}>{text.amount}
              <input id={`${prefix}-amount`} type="text" inputMode="decimal" disabled={!rule.enabled} value={rule.amount} onChange={event => update(key, { amount: event.target.value })} style={inputStyle} />
            </label>}
          </fieldset>;
        })}
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{text.rounding} {text.availability}</p>
      <button type="button" onClick={() => void save()} disabled={phase !== "ready"} style={{ justifySelf: "start", padding: "10px 16px", border: 0, borderRadius: 8, background: "#1d4ed8", color: "#fff", cursor: phase === "ready" ? "pointer" : "default", opacity: phase === "ready" ? 1 : 0.6 }}>{phase === "saving" ? text.saving : text.save}</button>
    </>}
    {message && <p role={message === "saved" ? "status" : "alert"} style={{ margin: 0, color: message === "saved" ? "#166534" : "#991b1b" }}>{text[message]}</p>}
    {(phase === "conflict" || (phase === "error" && message !== "forbidden")) && <button type="button" onClick={reload} style={{ justifySelf: "start" }}>{phase === "conflict" ? text.reload : text.retry}</button>}
  </section>;
}
