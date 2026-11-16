import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
type Summary = { from: string; to: string; bookings: number; cancelled: number;
  currencies: Array<{ currency: string; bookings: number; cancelled: number; collected: string; refunded: string; retained: string }> };
const number = (value: string) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

export function PrecheckinCampaignCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    fetch(`${API}/api/dashboard/metrics/precheckin-campaign`, { credentials: "include", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Metrics unavailable"); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return <section aria-labelledby="precheckin-campaign-heading" style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 20, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <h2 id="precheckin-campaign-heading" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Bookings from pre-check-in emails</h2>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", background: "#fff", color: "#111827", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>Refresh</button>
    </div>
    <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 16px" }}>Direct bookings attributed to pre-check-in emails · Last 30 days</p>
    {loading ? <p role="status">Loading campaign results…</p> : error ? <p role="alert" style={{ color: "#b91c1c" }}>Campaign results could not be loaded. Please refresh to try again.</p> : summary ? <>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", marginBottom: 16 }}>
        {[
          { title: "Paid reservations", value: summary.bookings },
          { title: "Cancelled reservations", value: summary.cancelled },
        ].map(metric => <div key={metric.title} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff" }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{metric.title}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{metric.value}</div>
        </div>)}
      </div>
      {summary.bookings === 0 ? <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px" }}>No paid reservations have been attributed to this email campaign in this period.</p> : <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
          <caption style={{ textAlign: "left", paddingBottom: 10, fontWeight: 600 }}>Current amounts for these reservations</caption>
          <thead><tr>{["Currency", "Paid reservations", "Collected", "Refunded", "Collected less refunds"].map(label => <th key={label} scope="col" style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
          <tbody>{summary.currencies.map(row => <tr key={row.currency}>
            <th scope="row" style={{ padding: "10px 12px" }}>{row.currency}</th>
            {[row.bookings, number(row.collected), number(row.refunded), number(row.retained)].map((value, index) => <td key={index} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}
      <details style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 14, color: "#6b7280", fontSize: 13 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>How these results are calculated</summary>
        <p style={{ lineHeight: 1.6 }}>Paid reservations created in the last 30 days using the tagged booking link. All properties in your organization; test properties excluded.</p>
        <p style={{ lineHeight: 1.6 }}>Includes cancelled reservations and current refunds. Amounts include charges and are before fees and host payouts; currencies are not combined. Attribution reflects the tagged link, not verified email clicks or repeat guests. Earlier untagged bookings are not included.</p>
      </details>
      <p style={{ color: "#6b7280", fontSize: 12 }}>Updated: {new Date(summary.to).toLocaleString("en-US")}</p>
    </> : null}
  </section>;
}
