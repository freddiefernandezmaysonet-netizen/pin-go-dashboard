import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
type Rule = { id: string; enabled: boolean; type: "EARLY_BIRD" | "LENGTH_OF_STAY"; threshold: number; percent: number;
  bookingFrom: string | null; bookingTo: string | null; stayFrom: string | null; stayTo: string | null; excludedDates: string[] };
type Config = { enabled: boolean; combination: "BEST" | "STACK"; maxDiscountPercent: number; minimumFinalNightlyRate: number; rules: Rule[] };
type Preview = { accommodationSubtotalBeforeDiscount: number; accommodationDiscountTotal: number; accommodationSubtotalAfterDiscount: number; cleaningFee: number; amenitiesTotal: number; taxesTotal: number; totalAmount: number };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(190px,100%),1fr))", gap: 12 };
const input: CSSProperties = { width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" };
function Field({ label, children }: { label: string; children: ReactNode }) { return <label style={{ display: "grid", gap: 5 }}>{label}{children}</label>; }
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function DirectBookingDiscountsCard({ propertyId }: { propertyId: string }) {
  return <Editor key={propertyId} propertyId={propertyId} />;
}
function Editor({ propertyId }: { propertyId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [version, setVersion] = useState(0);
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const t = (es: string, en: string) => language === "es" ? es : en;
  const url = `${API}/api/dashboard/properties/${encodeURIComponent(propertyId)}/direct-discounts`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { credentials: "include", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to load discounts / No se pudieron cargar los descuentos");
      return response.json();
    }).then(data => { setConfig(data.config); setVersion(data.version); setError(""); })
      .catch(err => { if (!controller.signal.aborted) setError(String(err.message)); });
    return () => controller.abort();
  }, [url, reload]);
  function change(next: Config) { setConfig(next); setPreview(null); setMessage(""); }
  function updateRule(index: number, patch: Partial<Rule>) {
    if (config) change({ ...config, rules: config.rules.map((r, i) => i === index ? { ...r, ...patch } : r) });
  }
  async function request(action: "save" | "preview") {
    if (!config) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url + (action === "preview" ? "/preview" : ""), { method: action === "save" ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "save" ? { config, version } : { config, checkIn, checkOut }) });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? t("La configuración cambió. Recarga antes de guardar.", "Settings changed. Reload before saving.") :
        response.status === 403 ? t("Solo el administrador puede editar descuentos.", "Only administrators can edit discounts.") :
        t("Revisa porcentajes, umbrales y fechas. No se guardaron cambios.", "Check percentages, thresholds and dates. Changes were not saved."));
      if (action === "save") { setVersion(data.version); setConfig(data.config); setMessage(t("Descuentos guardados.", "Discounts saved.")); }
      else setPreview(data.pricing);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setBusy(false); }
  }
  return <section className="property-edit-card" style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h3>{t("Descuentos de reservas directas", "Direct booking discounts")}</h3>
      <label>{t("Idioma", "Language")} <select value={language} onChange={e => setLanguage(e.target.value as "es" | "en")}><option value="es">Español</option><option value="en">English</option></select></label></div>
    <p>{t("Se aplican al subtotal del alojamiento, después de calcular las noches. Limpieza, amenidades y otros cargos no reciben descuento. Funcionan con precios dinámicos encendidos o apagados.", "Applied to the accommodation subtotal after calculating nightly rates. Cleaning, amenities and other charges are not discounted. Works with dynamic pricing on or off.")}</p>
    {error ? <div role="alert">{error} <button type="button" disabled={busy} onClick={() => setReload(r => r + 1)}>{t("Recargar", "Reload")}</button></div> : null}
    {message ? <p role="status">{message}</p> : null}
    {!config ? <p>{t("Cargando configuración…", "Loading settings…")}</p> : <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0, display: "grid", gap: 16 }}>
      <label><input type="checkbox" checked={config.enabled} onChange={e => change({ ...config, enabled: e.target.checked })} /> {t("Activar descuentos", "Enable discounts")}</label>
      <div style={grid}>
        <Field label={t("Combinación entre tipos", "Combining discount types")}><select style={input} value={config.combination} onChange={e => change({ ...config, combination: e.target.value as Config["combination"] })}>
          <option value="BEST">{t("Solo el mayor descuento", "Best discount only")}</option><option value="STACK">{t("Combinar sucesivamente", "Stack sequentially")}</option></select></Field>
        <Field label={t("Descuento máximo total (%)", "Maximum total discount (%)")}><input style={input} type="number" min="0" max="100" step="0.01" value={config.maxDiscountPercent} onChange={e => change({ ...config, maxDiscountPercent: Number(e.target.value) })} /></Field>
        <Field label={t("Mínimo final promedio por noche ($)", "Minimum final average per night ($)")}><input style={input} type="number" min="0" step="0.01" value={config.minimumFinalNightlyRate} onChange={e => change({ ...config, minimumFinalNightlyRate: Number(e.target.value) })} /></Field>
      </div>
      <p>{t("Se usa un nivel por tipo: el mayor umbral alcanzado. Al combinar, 10% y 5% equivalen a 14.5%. El mínimo limita el descuento; nunca aumenta el precio original.", "One level per type applies: the highest qualifying threshold. When stacked, 10% and 5% equal 14.5%. The minimum limits discounts; it never increases the original price.")}</p>
      {config.rules.map((r, i) => <fieldset key={r.id} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, minWidth: 0 }}>
        <legend>{t("Nivel", "Level")} {i + 1}</legend>
        <label><input type="checkbox" checked={r.enabled} onChange={e => updateRule(i, { enabled: e.target.checked })} /> {t("Habilitado", "Enabled")}</label>
        <div style={grid}>
          <Field label={t("Tipo", "Type")}><select style={input} value={r.type} onChange={e => updateRule(i, { type: e.target.value as Rule["type"] })}><option value="EARLY_BIRD">{t("Reserva anticipada", "Early booking")}</option><option value="LENGTH_OF_STAY">{t("Duración de estadía", "Length of stay")}</option></select></Field>
          <Field label={r.type === "EARLY_BIRD" ? t("Al menos estos días antes del check-in", "At least this many days before check-in") : t("Al menos esta cantidad de noches", "At least this many nights")}><input style={input} type="number" min="1" max="3650" value={r.threshold} onChange={e => updateRule(i, { threshold: Number(e.target.value) })} /></Field>
          <Field label={t("Descuento (%)", "Discount (%)")}><input style={input} type="number" min="0.01" max="100" step="0.01" value={r.percent} onChange={e => updateRule(i, { percent: Number(e.target.value) })} /></Field>
          {(["bookingFrom", "bookingTo", "stayFrom", "stayTo"] as const).map((key, n) => <Field key={key} label={[t("Reservar desde", "Book from"), t("Reservar hasta", "Book through"), t("Primera noche permitida", "First eligible night"), t("Última noche permitida", "Last eligible night")][n]}><input style={input} type="date" value={r[key] ?? ""} onChange={e => updateRule(i, { [key]: e.target.value || null })} /></Field>)}
        </div>
        <p>{t("Fechas vacías: sin límite. Todas las noches deben estar dentro del período y fuera de las exclusiones para descontar el alojamiento completo.", "Blank dates mean no limit. Every night must fall within the period and outside exclusions to discount the entire accommodation subtotal.")}</p>
        <Field label={t("Excluir noches (una fecha YYYY-MM-DD por línea)", "Exclude nights (one YYYY-MM-DD date per line)")}><textarea style={input} rows={3} value={r.excludedDates.join("\n")} onChange={e => updateRule(i, { excludedDates: e.target.value.split("\n") })} onBlur={() => updateRule(i, { excludedDates: r.excludedDates.map(d => d.trim()).filter(Boolean) })} /></Field>
        <button type="button" onClick={() => change({ ...config, rules: config.rules.filter((_, n) => n !== i) })}>{t("Eliminar nivel", "Remove level")}</button>
      </fieldset>)}
      <button type="button" disabled={config.rules.length >= 50} onClick={() => change({ ...config, rules: [...config.rules, { id: crypto.randomUUID(), enabled: true, type: "EARLY_BIRD", threshold: 30, percent: 5, bookingFrom: null, bookingTo: null, stayFrom: null, stayTo: null, excludedDates: [] }] })}>{t("Añadir nivel", "Add level")}</button>
      <div style={grid}><Field label="Check-in"><input style={input} type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); setPreview(null); }} /></Field><Field label="Check-out"><input style={input} type="date" value={checkOut} onChange={e => { setCheckOut(e.target.value); setPreview(null); }} /></Field></div>
      <button type="button" disabled={!checkIn || !checkOut} onClick={() => void request("preview")}>{t("Vista previa sin guardar", "Preview without saving")}</button>
      {preview ? <div role="status"><p>{t("Alojamiento original", "Original accommodation")}: {money(preview.accommodationSubtotalBeforeDiscount)}</p><p>{t("Descuento", "Discount")}: −{money(preview.accommodationDiscountTotal)}</p><p>{t("Alojamiento con descuento", "Discounted accommodation")}: {money(preview.accommodationSubtotalAfterDiscount)}</p><p>{t("Limpieza", "Cleaning")}: {money(preview.cleaningFee)} · {t("Amenidades obligatorias", "Required amenities")}: {money(preview.amenitiesTotal)} · {t("Impuestos", "Taxes")}: {money(preview.taxesTotal)}</p><strong>Total: {money(preview.totalAmount)}</strong></div> : null}
      <button type="button" onClick={() => void request("save")}>{busy ? t("Procesando…", "Processing…") : t("Guardar descuentos", "Save discounts")}</button>
    </fieldset>}
  </section>;
}
