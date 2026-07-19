import { Link } from "react-router-dom";
import "./PublicBookingExperience.css";

export default function PublicBookingCancelPage() {
  const organizationSlug =
    new URLSearchParams(window.location.search).get("organization") || "";
  const isSpanish = (() => {
    try {
      return window.localStorage.getItem("pingo_guest_preferred_language") === "es";
    } catch {
      return false;
    }
  })();

  return (
    <main className="pbe-cancel-page">
      <section className="pbe-cancel-card" aria-labelledby="booking-cancel-title">
        <div className="pbe-cancel-mark" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </div>

        <div className="pbe-cancel-eyebrow">
          {isSpanish ? "PAGO NO COMPLETADO" : "PAYMENT NOT COMPLETED"}
        </div>

        <h1 id="booking-cancel-title">
          {isSpanish ? "Tu estadía todavía puede estar disponible." : "Your stay may still be available."}
        </h1>

        <p className="pbe-cancel-intro">
          {isSpanish
            ? "Saliste del pago seguro antes de finalizar. No se confirmó ninguna reservación y no se realizó ningún cargo."
            : "You left secure checkout before finishing. No reservation was confirmed and no charge was made."}
        </p>

        <div className="pbe-cancel-assurance">
          <div>
            <span aria-hidden="true">✓</span>
            <p>
              <strong>{isSpanish ? "Sin cargos" : "No charges"}</strong>
              <small>
                {isSpanish
                  ? "Stripe no completó el pago."
                  : "Stripe did not complete the payment."}
              </small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">↻</span>
            <p>
              <strong>{isSpanish ? "Puedes intentarlo nuevamente" : "You can try again"}</strong>
              <small>
                {isSpanish
                  ? "Confirmaremos la disponibilidad y el precio actualizados."
                  : "We will recheck current availability and pricing."}
              </small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">⌁</span>
            <p>
              <strong>{isSpanish ? "Pago protegido" : "Protected payment"}</strong>
              <small>
                {isSpanish
                  ? "El pago seguro continuará procesado por Stripe."
                  : "Secure payment will continue to be processed by Stripe."}
              </small>
            </p>
          </div>
        </div>

        <Link className="pbe-cancel-action" to={`/book/${organizationSlug}`}>
          {isSpanish ? "Volver y completar mi reservación" : "Return and complete my booking"}
          <span aria-hidden="true">→</span>
        </Link>

        <p className="pbe-cancel-note">
          {isSpanish
            ? "La disponibilidad no queda retenida hasta confirmar el pago."
            : "Availability is not held until payment is confirmed."}
        </p>
      </section>
    </main>
  );
}
