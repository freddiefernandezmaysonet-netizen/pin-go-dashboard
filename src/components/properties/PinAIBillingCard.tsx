import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPinAIFeeOverview } from "../../api/pinAIActivation";
import { useOrg } from "../../auth/useOrg";
const labels: Record<string, string> = { PENDING_CONNECT: "Pending Connect debit",
  PENDING_BALANCE: "Pending available balance", PAID: "Paid",
  PENDING_INVOICE: "Legacy record · review required", INVOICED: "Legacy record · review required",
  PENDING_MEMBERSHIP: "Pending membership", ON_MEMBERSHIP: "Added to membership invoice",
  PENDING_DIRECT_EVIDENCE: "Verifying reservation payment", REVERSING: "Reversal in progress",
  REVERSED: "Reversed · net USD 0.00", NEEDS_REVIEW: "Review required" };
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
export function PinAIBillingCard() {
  const { orgId, user, isReady } = useOrg();
  const query = useQuery({ queryKey: ["pin-ai-billing", orgId, user?.id], enabled: isReady,
    queryFn: ({ signal }) => getPinAIFeeOverview(signal), retry: false });
  return <section aria-labelledby="pin-ai-billing-title" style={styles.card}>
    <h2 id="pin-ai-billing-title" style={styles.title}>Pin AI · Reservation charges</h2>
    {query.data?.billingTerms?.collectionMethod === "DIRECT_APPLICATION_FEE_OR_MEMBERSHIP"
      ? <p style={styles.description}>USD $1.00 per new reservation with Pin AI enabled. Direct Booking fees are deducted from the host’s reservation proceeds; OTA and manual reservation fees are included in the next Pin&Go membership invoice. Cancelled reservations have no net Pin AI fee. Exempt properties remain free.</p>
      : <p style={styles.description}>USD $1.00 per reservation with Pin AI enabled, from any source, starting 24 hours before check-in. It is debited from your available Stripe Connect balance. If the balance is insufficient, the charge remains pending.</p>}
    {query.isPending ? <p role="status" style={styles.description}>Loading charges…</p> : null}
    {query.isError ? <p role="alert" style={styles.error}>Pin AI charges could not be loaded.</p> : null}
    {query.data && !query.isError ? <>
      {query.data.serviceReviews > 0 ? <p role="status" style={styles.notice}>Charges for {query.data.serviceReviews} reservations require review. Contact Pin&Go to review them.</p> : null}
      {query.data.totals.length > 0 ? <div><p style={styles.label}>Accumulated totals</p>
      <ul style={styles.totals}>{query.data.totals.map(total => <li key={total.status}>{labels[total.status] ?? "Status pending review"}: {total.count} reservations · {money(total.amountCents)}</li>)}</ul></div> : null}
      {!query.data.recent.length ? <p style={styles.empty}>No charges recorded.</p> : <div style={styles.tableScroll}><table style={styles.table}>
        <caption style={styles.caption}>Latest recorded charges · up to 50 reservations</caption>
        <thead><tr><th scope="col" style={styles.tableHeading}>Reservation</th><th scope="col" style={styles.tableHeading}>Property</th><th scope="col" style={styles.tableHeading}>Amount</th><th scope="col" style={styles.tableHeading}>Status</th></tr></thead>
        <tbody>{query.data.recent.map(row => <tr key={row.reservationId}><td style={styles.cell}>{row.reservationNumber ?? row.reservationId}</td>
          <td style={styles.cell}>{row.propertyName}</td><td style={styles.cell}>{money(row.amountCents)}</td><td style={styles.cell}>{labels[row.status] ?? "Review required"}</td></tr>)}</tbody>
      </table></div>}
    </> : null}
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} style={{ ...styles.button, opacity: query.isFetching ? 0.5 : 1, cursor: query.isFetching ? "wait" : "pointer" }}>Refresh charges</button>
  </section>;
}

// Use the same explicit styling as BillingPage, including when utility CSS is absent.
const styles: Record<string, CSSProperties> = {
  card: { display: "grid", gap: 14, minWidth: 0, padding: 20, borderRadius: 16,
    border: "1px solid #e5e7eb", background: "#ffffff", color: "#111827", fontSize: 14,
    lineHeight: 1.6, overflowWrap: "anywhere" },
  title: { margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.4, color: "#111827" },
  description: { margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.65 },
  label: { margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#374151" },
  totals: { margin: 0, paddingLeft: 20, color: "#374151" },
  empty: { margin: 0, padding: "14px 16px", borderRadius: 10, background: "#f9fafb", color: "#6b7280" },
  error: { margin: 0, padding: 12, borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" },
  notice: { margin: 0, padding: 12, borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" },
  tableScroll: { minWidth: 0, overflowX: "auto" },
  table: { width: "100%", minWidth: 540, borderCollapse: "collapse", textAlign: "left", fontSize: 13 },
  caption: { textAlign: "left", marginBottom: 10, color: "#6b7280", fontSize: 12 },
  tableHeading: { padding: "10px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: 12, fontWeight: 700 },
  cell: { padding: 12, borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "top" },
  button: { justifySelf: "start", minHeight: 40, padding: "8px 14px", borderRadius: 10,
    border: "1px solid #d1d5db", background: "#ffffff", color: "#111827",
    fontFamily: "inherit", fontSize: 13, fontWeight: 700 },
};
