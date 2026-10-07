import { useQuery } from "@tanstack/react-query";
import { getPinAIFeeOverview } from "../../api/pinAIActivation";
import { useOrg } from "../../auth/useOrg";
const labels: Record<string, string> = { PENDING_CONNECT: "Pending Connect debit",
  PENDING_BALANCE: "Pending available balance", PAID: "Paid",
  PENDING_INVOICE: "Legacy record · review required", INVOICED: "Legacy record · review required",
  NEEDS_REVIEW: "Review required" };
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
export function PinAIBillingCard() {
  const { orgId, user, isReady } = useOrg();
  const query = useQuery({ queryKey: ["pin-ai-billing", orgId, user?.id], enabled: isReady,
    queryFn: ({ signal }) => getPinAIFeeOverview(signal), retry: false });
  return <section aria-labelledby="pin-ai-billing-title" className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <h2 id="pin-ai-billing-title" className="text-lg font-semibold">Pin AI · Reservation charges</h2>
    <p>USD $1.00 per reservation with Pin AI enabled, from any source, starting 24 hours before check-in. It is debited from your available Stripe Connect balance. If the balance is insufficient, the charge remains pending.</p>
    {query.isPending ? <p role="status">Loading charges…</p> : null}
    {query.isError ? <p role="alert">Pin AI charges could not be loaded.</p> : null}
    {query.data && !query.isError ? <>
      {query.data.serviceReviews > 0 ? <p role="status">Charges for {query.data.serviceReviews} reservations require review. Contact Pin&Go to review them.</p> : null}
      <p>Accumulated totals</p>
      <ul>{query.data.totals.map(total => <li key={total.status}>{labels[total.status] ?? "Status pending review"}: {total.count} reservations · {money(total.amountCents)}</li>)}</ul>
      {!query.data.recent.length ? <p>No charges recorded.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="text-left mb-2">Latest recorded charges · up to 50 reservations</caption>
        <thead><tr><th className="p-2">Reservation</th><th className="p-2">Property</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
        <tbody>{query.data.recent.map(row => <tr key={row.reservationId}><td className="p-2">{row.reservationNumber ?? row.reservationId}</td>
          <td className="p-2">{row.propertyName}</td><td className="p-2">{money(row.amountCents)}</td><td className="p-2">{labels[row.status] ?? "Review required"}</td></tr>)}</tbody>
      </table></div>}
    </> : null}
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Refresh charges</button>
  </section>;
}
