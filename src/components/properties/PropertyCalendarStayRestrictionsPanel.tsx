import { useMemo, useState, type CSSProperties } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDateCount = useMemo(() => inclusiveDateKeys(fromDate, toDate || fromDate)?.length ?? 0, [fromDate, toDate]);

  async function handleApply() {
    if (!id) return;
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
      setSaving(true);
      const response = await fetch(`${API_BASE}/api/dashboard/properties/${id}/calendar-overrides`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to apply stay restrictions");
      setMessage(`Applied to ${dateKeys.length} date${dateKeys.length === 1 ? "" : "s"}.`);
    } catch (requestError: any) {
      setError(String(requestError?.message || requestError));
    } finally {
      setSaving(false);
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
        <label style={styles.field}><span style={styles.label}>Start Date</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>End Date</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Nightly Rate</span><input type="number" min="0.01" step="0.01" value={rateInput} onChange={(event) => setRateInput(event.target.value)} placeholder="432.00" style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Minimum Nights</span><input type="number" min="1" step="1" value={minimumNightsInput} onChange={(event) => setMinimumNightsInput(event.target.value)} placeholder="2" style={styles.input} /></label>
        <label style={styles.field}><span style={styles.label}>Maximum Nights</span><input type="number" min="1" step="1" value={maximumNightsInput} onChange={(event) => setMaximumNightsInput(event.target.value)} placeholder="4" style={styles.input} /></label>
      </div>
      <div style={styles.footer}>
        <div style={styles.feedback}>{error ? <span style={styles.error}>{error}</span> : !error && message ? <span style={styles.success}>{message}</span> : <span style={styles.hint}>Blank fields are left unchanged.</span>}</div>
        <button type="button" onClick={handleApply} disabled={saving} style={{ ...styles.button, ...(saving ? styles.buttonDisabled : {}) }}>{saving ? "Applying..." : "Apply Stay Restrictions"}</button>
      </div>
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
};
