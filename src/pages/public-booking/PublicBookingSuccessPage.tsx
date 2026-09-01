import React from "react";
import { Link } from "react-router-dom";
import "./PublicBookingExperience.css";

export default function PublicBookingSuccessPage() {
  const query = new URLSearchParams(
    window.location.search
  );
  const organizationSlug =
    query.get("organization") || "";
  const identityVerificationRequired =
    query.get("identityCheck") !== "optional";
  const language = (() => {
    try {
      return window.localStorage.getItem("pingo_guest_preferred_language") === "es"
        ? "es"
        : "en";
    } catch {
      return "en";
    }
  })();
  const isSpanish = language === "es";

  return (
    <main
      className="pbe-success-page"
      style={{
        "--pbe-ink": "#17241f",
        "--pbe-forest": "#173d31",
        "--pbe-forest-deep": "#0f2f27",
        "--pbe-sage": "#849a89",
        "--pbe-sand": "#e9dfc9",
        "--pbe-ivory": "#f8f5ed",
        "--pbe-paper": "#fffdf8",
        "--pbe-line": "rgba(23, 61, 49, 0.17)",
        "--pbe-muted": "#647069",
      } as React.CSSProperties}
    >
      <section className="pbe-success-card" aria-labelledby="booking-success-title">
        <div className="pbe-success-mark" aria-hidden="true">
          <svg
            width="31"
            height="31"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div className="pbe-success-eyebrow">
          {isSpanish ? "PAGO RECIBIDO" : "PAYMENT RECEIVED"}
        </div>

        <h1 id="booking-success-title">
          {isSpanish ? "Tu estadía está confirmada." : "Your stay is confirmed."}
        </h1>

        <p className="pbe-success-intro">
          {isSpanish
            ? "Todo está en orden. Pin&Go está preparando una llegada segura y sin llaves."
            : "Everything is in order. Pin&Go is preparing your secure, keyless arrival."}
        </p>

        <div className="pbe-success-journey">
          <div className="pbe-success-journey-heading">
            <div className="pbe-success-lock" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </div>

            <div>
              <span>{isSpanish ? "PRÓXIMOS PASOS" : "WHAT HAPPENS NEXT"}</span>
              <h2>
                {isSpanish ? "Pre-check-in seguro" : "Secure pre-check-in"}
              </h2>
            </div>
          </div>

          <div className="pbe-success-steps">
            <div className="pbe-success-step is-complete">
              <span>✓</span>
              <div>
                <strong>{isSpanish ? "Reservación confirmada" : "Reservation confirmed"}</strong>
                <small>{isSpanish ? "El pago fue recibido correctamente." : "Your payment was received successfully."}</small>
              </div>
            </div>
            {identityVerificationRequired ? (
              <div className="pbe-success-step">
                <span>2</span>
                <div>
                  <strong>Identity Check</strong>
                  <small>{isSpanish ? "Completa la verificación desde el enlace seguro." : "Complete verification from your secure link."}</small>
                </div>
              </div>
            ) : null}
            <div className="pbe-success-step">
              <span>{identityVerificationRequired ? "3" : "2"}</span>
              <div>
                <strong>{isSpanish ? "Acuerdo del huésped" : "Guest agreement"}</strong>
                <small>{isSpanish ? "Revisa y firma los requisitos de la estadía." : "Review and sign your stay requirements."}</small>
              </div>
            </div>
            <div className="pbe-success-step">
              <span>{identityVerificationRequired ? "4" : "3"}</span>
              <div>
                <strong>{isSpanish ? "Acceso automático" : "Automatic access"}</strong>
                <small>{isSpanish ? "Las credenciales se liberarán cuando corresponda." : "Credentials will be released when the access window opens."}</small>
              </div>
            </div>
          </div>

          <div className="pbe-success-automation">
            {isSpanish
              ? "Tu reservación ya está confirmada. El acceso permanecerá protegido hasta completar los pasos requeridos."
              : "Your reservation is confirmed. Access remains protected until the required steps are complete."}
          </div>
        </div>

        <div className="pbe-success-email">
          <span aria-hidden="true">✉</span>
          <div>
            <strong>{isSpanish ? "Revisa tu correo electrónico" : "Check your email"}</strong>
            <p>
              {isSpanish
                ? "Allí encontrarás el enlace seguro para administrar la reservación y completar el pre-check-in."
                : "It contains your secure link to manage the reservation and complete pre-check-in."}
            </p>
          </div>
        </div>

        <Link
          to={`/book/${organizationSlug}`}
          className="pbe-success-action"
        >
          {isSpanish ? "Volver a la página de reservaciones" : "Return to booking page"}
          <span aria-hidden="true">→</span>
        </Link>

        <p className="pbe-success-signature">Pin&amp;Go Guest Services</p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "linear-gradient(180deg, #eff6ff 0%, #f8fafc 42%, #ffffff 100%)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  card: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: 28,
    padding: 40,
    maxWidth: 720,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
  },

  confirmationIcon: {
    width: 72,
    height: 72,
    margin: "0 auto",
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#15803d",
  },

  eyebrow: {
    marginTop: 22,
    color: "#15803d",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  title: {
    marginTop: 8,
    marginBottom: 0,
    color: "#0f172a",
    fontSize: 38,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  spanishTitle: {
    marginTop: 6,
    color: "#334155",
    fontSize: 20,
    fontWeight: 850,
  },

  introText: {
    margin: "14px auto 0",
    maxWidth: 580,
    color: "#475569",
    lineHeight: 1.65,
    fontSize: 15,
  },

  accessStatusCard: {
    marginTop: 30,
    padding: 24,
    borderRadius: 22,
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    textAlign: "left",
  },

  accessStatusHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },

  lockIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    background: "#dbeafe",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
  },

  accessStatusEyebrow: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
  },

  accessStatusTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 21,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  accessStatusSpanishTitle: {
    marginTop: 3,
    color: "#1e3a8a",
    fontSize: 15,
    fontWeight: 850,
  },

  accessStatusText: {
    margin: "14px 0 0",
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.6,
  },

  requirements: {
    marginTop: 20,
    display: "grid",
    gap: 12,
  },

  requirement: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #bfdbfe",
  },

  requirementNumber: {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 950,
  },

  requirementTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },

  requirementText: {
    display: "block",
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  automationNotice: {
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 12,
    lineHeight: 1.65,
    fontWeight: 750,
  },

  nextStepCard: {
    marginTop: 22,
    padding: 20,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  nextStepTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
  },

  nextStepSpanishTitle: {
    display: "block",
    marginTop: 3,
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },

  nextStepText: {
    margin: "10px auto 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  button: {
    display: "inline-block",
    marginTop: 26,
    background: "#1d4ed8",
    color: "#ffffff",
    textDecoration: "none",
    padding: "14px 22px",
    borderRadius: 14,
    fontWeight: 850,
    boxShadow: "0 12px 26px rgba(29, 78, 216, 0.24)",
  },

  footerNote: {
    margin: "22px 0 0",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.03em",
  },
};

// Kept temporarily for a file-by-file migration audit; the premium experience
// now consumes the shared public-booking stylesheet.
void styles;
