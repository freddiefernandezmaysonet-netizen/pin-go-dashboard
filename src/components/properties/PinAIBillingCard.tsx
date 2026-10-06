import { useQuery } from "@tanstack/react-query";
import { getPinAIFeeOverview } from "../../api/pinAIActivation";
import { useOrg } from "../../auth/useOrg";
const labels: Record<string, string> = { PENDING_CONNECT: "Pendiente de descuento Connect",
  PENDING_BALANCE: "Pendiente de saldo disponible", PAID: "Cobrado",
  PENDING_INVOICE: "Registro anterior · requiere revisión", INVOICED: "Registro anterior · requiere revisión",
  NEEDS_REVIEW: "Requiere revisión" };
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
export function PinAIBillingCard() {
  const { orgId, user, isReady } = useOrg();
  const query = useQuery({ queryKey: ["pin-ai-billing", orgId, user?.id], enabled: isReady,
    queryFn: ({ signal }) => getPinAIFeeOverview(signal), retry: false });
  return <section aria-labelledby="pin-ai-billing-title" className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <h2 id="pin-ai-billing-title" className="text-lg font-semibold">Pin AI · Cargos por reservación</h2>
    <p>USD $1.00 por reservación con Pin AI activado, de cualquier origen, desde 24 horas antes del check-in. Se descuenta del saldo disponible de tu cuenta Stripe Connect. Si falta saldo, el cargo queda pendiente.</p>
    {query.isPending ? <p role="status">Cargando cargos…</p> : null}
    {query.isError ? <p role="alert">No se pudieron cargar los cargos de Pin AI.</p> : null}
    {query.data && !query.isError ? <>
      {query.data.serviceReviews > 0 ? <p role="status">Hay {query.data.serviceReviews} reservas cuyo cargo requiere revisión. Contacta a Pin&Go para revisarlas.</p> : null}
      <p>Totales acumulados</p>
      <ul>{query.data.totals.map(total => <li key={total.status}>{labels[total.status] ?? "Estado pendiente de revisión"}: {total.count} reservas · {money(total.amountCents)}</li>)}</ul>
      {!query.data.recent.length ? <p>No hay cargos registrados.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="text-left mb-2">Últimos cargos registrados · hasta 50 reservas</caption>
        <thead><tr><th className="p-2">Reserva</th><th className="p-2">Propiedad</th><th className="p-2">Importe</th><th className="p-2">Estado</th></tr></thead>
        <tbody>{query.data.recent.map(row => <tr key={row.reservationId}><td className="p-2">{row.reservationNumber ?? row.reservationId}</td>
          <td className="p-2">{row.propertyName}</td><td className="p-2">{money(row.amountCents)}</td><td className="p-2">{labels[row.status] ?? "Requiere revisión"}</td></tr>)}</tbody>
      </table></div>}
    </> : null}
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Actualizar cargos</button>
  </section>;
}
