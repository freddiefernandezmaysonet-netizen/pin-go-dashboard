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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const url = `${API}/api/dashboard/properties/${encodeURIComponent(propertyId)}/direct-discounts`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { credentials: "include", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to load discounts. Please try again.");
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
      if (!response.ok) throw new Error(response.status === 409 ? "Settings changed. Reload before saving." :
        response.status === 403 ? "Only administrators can edit discounts." :
        "Check percentages, thresholds and dates. Changes were not saved.");
      if (action === "save") { setVersion(data.version); setConfig(data.config); setMessage("Discounts saved."); }
      else setPreview(data.pricing);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setBusy(false); }
  }
  return <section className="property-edit-card" style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h3 style={{ margin: 0 }}>{"Direct booking discounts"}</h3></div>
    <p className="property-edit-help">{"Applied to the accommodation subtotal after calculating nightly rates. Cleaning, amenities and other charges are not discounted. Works with dynamic pricing on or off."}</p>
    {error ? <div role="alert">{error} <button type="button" disabled={busy} onClick={() => setReload(r => r + 1)}>{"Reload"}</button></div> : null}
    {message ? <p role="status">{message}</p> : null}
    {!config ? <p>{"Loading settings…"}</p> : <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0, display: "grid", gap: 16 }}>
      <label><input type="checkbox" checked={config.enabled} onChange={e => change({ ...config, enabled: e.target.checked })} /> {"Enable discounts"}</label>
      <div style={grid}>
        <Field label={"Combining discount types"}><select style={input} value={config.combination} onChange={e => change({ ...config, combination: e.target.value as Config["combination"] })}>
          <option value="BEST">{"Best discount only"}</option><option value="STACK">{"Stack sequentially"}</option></select></Field>
        <Field label={"Maximum total discount (%)"}><input style={input} type="number" min="0" max="100" step="0.01" value={config.maxDiscountPercent} onChange={e => change({ ...config, maxDiscountPercent: Number(e.target.value) })} /></Field>
        <Field label={"Minimum final average per night ($)"}><input style={input} type="number" min="0" step="0.01" value={config.minimumFinalNightlyRate} onChange={e => change({ ...config, minimumFinalNightlyRate: Number(e.target.value) })} /></Field>
      </div>
      <p>{"One level per type applies: the highest qualifying threshold. When stacked, 10% and 5% equal 14.5%. The minimum limits discounts; it never increases the original price."}</p>
      {config.rules.map((r, i) => <fieldset key={r.id} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, minWidth: 0 }}>
        <legend>{"Level"} {i + 1}</legend>
        <label><input type="checkbox" checked={r.enabled} onChange={e => updateRule(i, { enabled: e.target.checked })} /> {"Enabled"}</label>
        <div style={grid}>
          <Field label={"Type"}><select style={input} value={r.type} onChange={e => updateRule(i, { type: e.target.value as Rule["type"] })}><option value="EARLY_BIRD">{"Early booking"}</option><option value="LENGTH_OF_STAY">{"Length of stay"}</option></select></Field>
          <Field label={r.type === "EARLY_BIRD" ? "At least this many days before check-in" : "At least this many nights"}><input style={input} type="number" min="1" max="3650" value={r.threshold} onChange={e => updateRule(i, { threshold: Number(e.target.value) })} /></Field>
          <Field label={"Discount (%)"}><input style={input} type="number" min="0.01" max="100" step="0.01" value={r.percent} onChange={e => updateRule(i, { percent: Number(e.target.value) })} /></Field>
          {(["bookingFrom", "bookingTo", "stayFrom", "stayTo"] as const).map((key, n) => <Field key={key} label={["Book from", "Book through", "First eligible night", "Last eligible night"][n]}><input style={input} type="date" value={r[key] ?? ""} onChange={e => updateRule(i, { [key]: e.target.value || null })} /></Field>)}
        </div>
        <p>{"Blank dates mean no limit. Every night must fall within the period and outside exclusions to discount the entire accommodation subtotal."}</p>
        <Field label={"Exclude nights (one YYYY-MM-DD date per line)"}><textarea style={input} rows={3} value={r.excludedDates.join("\n")} onChange={e => updateRule(i, { excludedDates: e.target.value.split("\n") })} onBlur={() => updateRule(i, { excludedDates: r.excludedDates.map(d => d.trim()).filter(Boolean) })} /></Field>
        <button type="button" onClick={() => change({ ...config, rules: config.rules.filter((_, n) => n !== i) })}>{"Remove level"}</button>
      </fieldset>)}
      <button type="button" disabled={config.rules.length >= 50} onClick={() => change({ ...config, rules: [...config.rules, { id: crypto.randomUUID(), enabled: true, type: "EARLY_BIRD", threshold: 30, percent: 5, bookingFrom: null, bookingTo: null, stayFrom: null, stayTo: null, excludedDates: [] }] })}>{"Add level"}</button>
      <div style={grid}><Field label="Check-in"><input style={input} type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); setPreview(null); }} /></Field><Field label="Check-out"><input style={input} type="date" value={checkOut} onChange={e => { setCheckOut(e.target.value); setPreview(null); }} /></Field></div>
      <button type="button" disabled={!checkIn || !checkOut} onClick={() => void request("preview")}>{"Preview without saving"}</button>
      {preview ? <div role="status"><p>{"Original accommodation"}: {money(preview.accommodationSubtotalBeforeDiscount)}</p><p>{"Discount"}: −{money(preview.accommodationDiscountTotal)}</p><p>{"Discounted accommodation"}: {money(preview.accommodationSubtotalAfterDiscount)}</p><p>{"Cleaning"}: {money(preview.cleaningFee)} · {"Required amenities"}: {money(preview.amenitiesTotal)} · {"Taxes"}: {money(preview.taxesTotal)}</p><strong>Total: {money(preview.totalAmount)}</strong></div> : null}
      <button className="property-edit-primary" type="button" onClick={() => void request("save")}>{busy ? "Processing…" : "Save discounts"}</button>
    </fieldset>}
  </section>;
}
