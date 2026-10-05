import { useEffect, useId, useRef, useState } from "react";
import { ConflictReviewApiError, getAvailabilityConflicts, resolveAvailabilityConflict } from "../../api/availabilityConflicts";
import type { ConflictCause, ConflictReview } from "../../api/availabilityConflicts";
import { sanitizeWhiteLabelText } from "../../lib/whiteLabel";

const copy = {
  en: { title: "Availability conflict review", loading: "Loading conflict details…", unavailable: "Unable to load this review. Try again.",
    forbidden: "Only an organization administrator can review and close this alert.", retry: "Reload review", original: "Detected conflict",
    current: "Current availability", clear: "The checked interval is currently available.", blocked: "The checked interval still has a conflict.",
    inactive: "This reservation is no longer active.", meaning: "Closing this alert records your reported solution. It does not change reservations or independently verify that the conflict is resolved.",
    note: "Describe the solution coordinated with guests, the OTA or the cleaner", close: "Record solution and close alert", saving: "Recording…",
    saved: "Solution recorded. Alert closed by the host.", stale: "This alert changed in another session. Reload the review before submitting again.",
    history: "History", missing: "The linked reservation is no longer available.", more: "More alerts exist. Review the reservation history.",
    types: { RESERVATION: "Reservation overlap", RESERVATION_MODIFICATION_HOLD: "Pending reservation change", STAY_TIME_TURNOVER_HOLD: "Protected cleaning interval", BLOCKED_DATE: "Blocked dates" } },
  es: { title: "Revisión del conflicto de disponibilidad", loading: "Cargando detalles del conflicto…", unavailable: "No se pudo cargar la revisión. Intenta nuevamente.",
    forbidden: "Solo un administrador de la organización puede revisar y cerrar esta alerta.", retry: "Recargar revisión", original: "Conflicto detectado",
    current: "Disponibilidad actual", clear: "El intervalo consultado está disponible actualmente.", blocked: "El intervalo consultado todavía tiene un conflicto.",
    inactive: "Esta reserva ya no está activa.", meaning: "Cerrar esta alerta registra la solución que indicas. No cambia las reservas ni verifica de forma independiente que el conflicto esté resuelto.",
    note: "Describe la solución coordinada con huéspedes, la OTA o el cleaner", close: "Registrar solución y cerrar alerta", saving: "Registrando…",
    saved: "Solución registrada. Alerta cerrada por el host.", stale: "Otra sesión cambió esta alerta. Recarga la revisión antes de enviarla nuevamente.",
    history: "Historial", missing: "La reserva relacionada ya no está disponible.", more: "Existen más alertas. Revisa el historial de la reserva.",
    types: { RESERVATION: "Reservas superpuestas", RESERVATION_MODIFICATION_HOLD: "Cambio de reserva pendiente", STAY_TIME_TURNOVER_HOLD: "Intervalo de limpieza protegido", BLOCKED_DATE: "Fechas bloqueadas" } },
};
type Props = { reservationId: string; language?: "en" | "es"; onOpenReservation?: (id: string) => void };
export function AvailabilityConflictReview({ reservationId, language = "en", onOpenReservation }: Props) {
  const text = copy[language], id = useId();
  const [review, setReview] = useState<ConflictReview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const savingRef = useRef(false), epoch = useRef(0);
  useEffect(() => {
    const controller = new AbortController(), current = ++epoch.current;
    setLoading(true); setReview(null); setError("");
    getAvailabilityConflicts(reservationId, controller.signal).then(result => {
      if (epoch.current === current && !controller.signal.aborted) setReview(result);
    }).catch(cause => {
      if (!controller.signal.aborted && epoch.current === current) setError(cause instanceof ConflictReviewApiError && cause.status === 403 ? text.forbidden : text.unavailable);
    }).finally(() => { if (!controller.signal.aborted && epoch.current === current) setLoading(false); });
    return () => { controller.abort(); epoch.current = current + 1; };
  }, [reservationId, reload, text]);
  const format = (value: string | null) => {
    if (!value) return "—";
    try { return new Date(value).toLocaleString(language === "es" ? "es-PR" : "en-US", { timeZone: review?.reservation.property.timezone }); }
    catch { return "—"; }
  };
  const cause = (value: ConflictCause) => <div>
    <strong>{text.types[value.type as keyof typeof text.types] ?? value.label}</strong>
    <div>{format(value.startsAt)} – {format(value.endsAt)}</div>
    {value.reservation ? <button type="button" onClick={() => onOpenReservation?.(value.reservation!.id)} disabled={!onOpenReservation}>
      #{value.reservation.reservationNumber ?? "—"} {value.reservation.guestName}
    </button> : value.type === "RESERVATION" ? <p>{text.missing}</p> : null}
    {value.blockReason ? <p>{sanitizeWhiteLabelText(value.blockReason)}</p> : null}
  </div>;
  const resolve = async (item: ConflictReview["items"][number]) => {
    const summary = (summaries[item.id] ?? "").trim();
    if (!summary || summary.length > 2000 || savingRef.current) return;
    savingRef.current = true; setSaving(item.id); setError("");
    const current = epoch.current;
    try {
      await resolveAvailabilityConflict(item.id, item.updatedAt, summary);
      if (epoch.current !== current) return;
      setReview(previous => previous ? { ...previous, items: previous.items.map(row => row.id === item.id ? { ...row,
        state: "RESOLVED", resolutionSummary: summary } : row) } : null);
      const refreshed = await getAvailabilityConflicts(reservationId);
      if (epoch.current === current) setReview(refreshed);
    } catch (cause) {
      if (epoch.current === current) setError(cause instanceof ConflictReviewApiError && cause.status === 409 ? text.stale :
        cause instanceof ConflictReviewApiError && cause.status === 403 ? text.forbidden : text.unavailable);
    } finally { savingRef.current = false; if (epoch.current === current) setSaving(null); }
  };
  return <section aria-label={text.title} style={{ marginTop: 16, padding: 16, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 12 }}>
    <h4>{text.title}</h4>
    {loading ? <p role="status">{text.loading}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" disabled={Boolean(saving) || loading} onClick={() => setReload(n => n + 1)}>{text.retry}</button>
    {review ? <>
      <p>{review.reservation.property.name} · #{review.reservation.reservationNumber} · {review.reservation.property.timezone}</p>
      <p>{format(review.reservation.checkIn)} – {format(review.reservation.checkOut)}</p>
      <h5>{text.current}</h5>
      <p>{review.currentAvailability === null ? text.inactive : review.currentAvailability.available ? text.clear : text.blocked}</p>
      {review.currentAvailability?.cause ? cause(review.currentAvailability.cause) : null}
      <p>{text.meaning}</p>
      {review.items.map(item => <article key={item.id} style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
        <h5>{text.original} · {format(item.detectedAt)}</h5>
        <p>#{review.reservation.reservationNumber}: {format(item.incomingStartsAt)} – {format(item.incomingEndsAt)}</p>
        {cause(item.detectedCause)}
        {item.state === "RESOLVED" ? <p role="status">{text.saved}<br />{sanitizeWhiteLabelText(item.resolutionSummary)}</p> : <>
          <label htmlFor={`${id}-${item.id}`}>{text.note}</label>
          <textarea id={`${id}-${item.id}`} rows={3} maxLength={2000} value={summaries[item.id] ?? ""} disabled={Boolean(saving)}
            style={{ width: "100%", display: "block", boxSizing: "border-box", margin: "8px 0" }}
            onChange={event => setSummaries(previous => ({ ...previous, [item.id]: event.target.value }))} />
          <button type="button" disabled={Boolean(saving) || !(summaries[item.id] ?? "").trim()} onClick={() => void resolve(item)}>
            {saving === item.id ? text.saving : text.close}
          </button>
        </>}
        <details><summary>{text.history}</summary><ul>{item.history.map((entry, index) => <li key={index}>
          {format(entry.at)} · {entry.actor === "HOST" ? "Host" : "Pin&Go"}: {sanitizeWhiteLabelText(entry.summary)}
        </li>)}</ul></details>
      </article>)}
      {review.hasMore ? <p>{text.more}</p> : null}
    </> : null}
  </section>;
}
