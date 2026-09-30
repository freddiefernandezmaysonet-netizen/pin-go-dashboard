import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.pin-ngo.com";

function parseDateKey(value: string) {
  const trimmed = value.trim();
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
  return { key: trimmed, date };
}

function inclusiveDateKeys(from: string, to: string) {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (!start || !end || end.date < start.date) return null;
  const keys: string[] = [];
  const cursor = new Date(start.date);
  while (cursor <= end.date) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function parseOptionalPositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalPositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

export function PropertyCalendarStayRestrictionsPanel() {
  const { id } = useParams();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [minimumNightsInput, setMinimumNightsInput] = useState("");
  const [maximumNightsInput, setMaximumNightsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeMinimum, setRemoveMinimum] = useState(false);
  const [removeMaximum, setRemoveMaximum] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutationPending = useRef(false);
  const propertyIdRef = useRef(id);
  propertyIdRef.current = id;
  const busy = saving || removing;

  const selectedDateCount = useMemo(() => {
    const start = parseDateKey(fromDate);
    const end = parseDateKey(toDate || fromDate);
    return start && end && end.date >= start.date ? Math.round((end.date.getTime() - start.date.getTime()) / 86_400_000) + 1 : 0;
  }, [fromDate, toDate]);

  async function handleApply() {
    if (!id || mutationPending.current) return;
    setMessage(null);
    setError(null);
    const dateKeys = inclusiveDateKeys(fromDate, toDate || fromDate);
    if (!dateKeys?.length) { setError("Select a valid start date and end date."); return; }
    const rate = parseOptionalPositiveNumber(rateInput);
    const minimumNights = parseOptionalPositiveInteger(minimumNightsInput);
    const maximumNights = parseOptionalPositiveInteger(maximumNightsInput);
    if (rate === undefined) { setError("Nightly Rate must be greater than zero."); return; }
    if (minimumNights === undefined) { setError("Minimum Nights must be a whole number greater than or equal to 1."); return; }
    if (maximumNights === undefined) { setError("Maximum Nights must be a whole number greater than or equal to 1."); return; }
    if (rate === null && minimumNights === null && maximumNights === null) { setError("Enter at least one override: Nightly Rate, Minimum Nights, or Maximum Nights."); return; }
    if (minimumNights !== null && maximumNights !== null && maximumNights < minimumNights) { setError("Maximum Nights cannot be lower than Minimum Nights."); return; }

    const overrides = dateKeys.map((date) => {
      const override: Record<string, string | number> = { date, reason: "Calendar stay restrictions" };
      if (rate !== null) override.rate = rate;
      if (minimumNights !== null) override.minimumNights = minimumNights;
      if (maximumNights !== null) override.maximumNights = maximumNights;
      return override;
    });

    try {
      mutationPending.current = true;
      setSaving(true);
      const response = await fetch(`${API_BASE}/api/dashboard/properties/${id}/calendar-overrides`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to apply stay restrictions");
      if (propertyIdRef.current === id) setMessage(`Applied to ${dateKeys.length} date${dateKeys.length === 1 ? "" : "s"}.`);
    } catch (requestError: any) {
      if (propertyIdRef.current === id) setError(String(requestError?.message || requestError));
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!id || mutationPending.current) return;
    setMessage(null);
    setError(null);
    if (selectedDateCount < 1) { setError("Select a valid start date and end date."); return; }
    if (selectedDateCount > 500) { setError("Remove restrictions from no more than 500 dates at a time."); return; }
    const fields = [removeMinimum ? "minimumNights" : null, removeMaximum ? "maximumNights" : null].filter((field): field is string => field !== null);
    if (!fields.length) { setError("Choose Minimum Nights, Maximum Nights, or both to remove."); return; }
    const dateKeys = inclusiveDateKeys(fromDate, toDate || fromDate);
    if (!dateKeys?.length) { setError("Select a valid start date and end date."); return; }
    const fieldLabel = [removeMinimum ? "Minimum Nights" : null, removeMaximum ? "Maximum Nights" : null].filter(Boolean).join(" and ");
    const rangeLabel = dateKeys.length === 1 ? dateKeys[0] : `${dateKeys[0]} through ${dateKeys[dateKeys.length - 1]}`;
    if (!window.confirm(`Remove saved ${fieldLabel} overrides for ${rangeLabel} (${dateKeys.length} date${dateKeys.length === 1 ? "" : "s"})?\n\nProperty defaults will apply to the removed fields. Nightly rates, reservations, blocked dates, and other restrictions will not change.`)) return;

    try {
      mutationPending.current = true;
      setRemoving(true);
      const response = await fetch(`${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}/calendar-overrides`, {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dateKeys, fields }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) throw new Error(data?.error || "Failed to remove stay restrictions");
      if (!Number.isInteger(data.affectedDates) || data.affectedDates < 0 || data.affectedDates > dateKeys.length) throw new Error("The server did not confirm the removal result. Review the dates before retrying.");
      if (propertyIdRef.current !== id) return;
      if (fields.includes("minimumNights")) setMinimumNightsInput("");
      if (fields.includes("maximumNights")) setMaximumNightsInput("");
      setMessage(data.affectedDates === 0
        ? "No matching saved restrictions were found. Nothing was changed."
        : `Removed from ${data.affectedDates} date${data.affectedDates === 1 ? "" : "s"}. Property defaults apply to the removed fields.${data.syncQueued === true ? " Channel update queued." : ""}`);
    } catch (requestError: unknown) {
      if (propertyIdRef.current === id) setError(requestError instanceof Error ? requestError.message : "Failed to remove stay restrictions");
    } finally {
      mutationPending.current = false;
      setRemoving(false);
    }
  }

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Calendar Controls</div>
          <h2 style={styles.title}>Stay Restrictions</h2>
          <p style={styles.subtitle}>Apply a nightly rate, minimum stay, maximum stay, or an exact combination across one date or a date range.</p>
        </div>
        <div style={styles.countBadge}>{selectedDateCount > 0 ? `${selectedDateCount} date${selectedDateCount === 1 ? "" : "s"}` : "No dates selected"}</div>
      </div>
      <div style={styles.grid}>
        <label style={styles.field}><span style={styles.label}>Start Date</span><input type="date" disabled={busy} value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>End Date</span><input type="date" disabled={busy} value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Nightly Rate</span><input type="number" disabled={busy} min="0.01" step="0.01" value={rateInput} onChange={(event) => setRateInput(event.target.value)} placeholder="432.00" style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Minimum Nights</span><input type="number" disabled={busy} min="1" step="1" value={minimumNightsInput} onChange={(event) => setMinimumNightsInput(event.target.value)} placeholder="2" style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Maximum Nights</span><input type="number" disabled={busy} min="1" step="1" value={maximumNightsInput} onChange={(event) => setMaximumNightsInput(event.target.value)} placeholder="4" style={styles.input} /></label>
      </div>
      <div style={styles.footer}>
        <div style={styles.feedback} aria-live="polite">{error ? <span role="alert" style={styles.error}>{error}</span> : !error && message ? <span role="status" style={styles.success}>{message}</span> : <span style={styles.hint}>Blank fields are left unchanged.</span>}</div>
        <button type="button" onClick={handleApply} disabled={busy} style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}>{saving ? "Applying..." : "Apply Stay Restrictions"}</button>
      </div>
      <details style={styles.removalPanel}>
        <summary style={styles.removalSummary}>Remove saved stay restrictions</summary>
        <p style={styles.subtitle}>Use the Start Date and End Date above. Choose which saved limits to remove; property defaults will apply. Nightly rates will not be removed.</p>
        <div style={styles.removalActions}>
          <label style={styles.removalChoice}><input type="checkbox" aria-label="Remove Minimum Nights" disabled={busy} checked={removeMinimum} onChange={(event) => setRemoveMinimum(event.target.checked)} />Minimum Nights</label>
          <label style={styles.removalChoice}><input type="checkbox" aria-label="Remove Maximum Nights" disabled={busy} checked={removeMaximum} onChange={(event) => setRemoveMaximum(event.target.checked)} />Maximum Nights</label>
          <button type="button" onClick={handleRemove} disabled={busy || (!removeMinimum && !removeMaximum)} style={{ ...styles.removeButton, ...(busy || (!removeMinimum && !removeMaximum) ? styles.buttonDisabled : {}) }}>{removing ? "Removing..." : "Remove Stay Restrictions"}</button>
        </div>
      </details>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: { display: "grid", gap: 18, padding: 22, marginBottom: 20, borderRadius: 18, border: "1px solid #dbeafe", background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 60%)", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)" },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" },
  eyebrow: { fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2563eb" },
  title: { margin: "5px 0 6px", fontSize: 22, color: "#0f172a" },
  subtitle: { margin: 0, maxWidth: 760, fontSize: 13, lineHeight: 1.55, color: "#64748b" },
  countBadge: { padding: "8px 11px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#ffffff", color: "#1d4ed8", fontSize: 12, fontWeight: 900 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  field: { display: "grid", gap: 6 }, label: { fontSize: 12, fontWeight: 800, color: "#334155" },
  input: { width: "100%", boxSizing: "border-box", minHeight: 42, padding: "0 11px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontSize: 14 },
  footer: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" },
  feedback: { minHeight: 20, fontSize: 12, fontWeight: 700 }, hint: { color: "#64748b" }, error: { color: "#b91c1c" }, success: { color: "#166534" },
  button: { minHeight: 42, padding: "0 16px", border: 0, borderRadius: 10, background: "#2563eb", color: "#ffffff", fontWeight: 900, cursor: "pointer" },
  buttonDisabled: { opacity: 0.65, cursor: "not-allowed" },
  removalPanel: { borderTop: "1px solid #cbd5e1", paddingTop: 12 },
  removalSummary: { cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#334155", padding: "8px 0", minHeight: 28 },
  removalActions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 12 },
  removalChoice: { display: "flex", alignItems: "center", gap: 7, minHeight: 44, fontSize: 13, color: "#334155" },
  removeButton: { minHeight: 44, padding: "0 16px", border: "1px solid #fca5a5", borderRadius: 10, background: "#ffffff", color: "#b91c1c", fontWeight: 900, cursor: "pointer" },
};
