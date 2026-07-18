import React from "react";
import { Link } from "react-router-dom";

export default function PublicBookingSuccessPage() {
  const organizationSlug =
    new URLSearchParams(window.location.search).get("organization") || "";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.confirmationIcon} aria-hidden="true">
          <svg
            width="34"
            height="34"
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

        <div style={styles.eyebrow}>
          Payment received / Pago recibido
        </div>

        <h1 style={styles.title}>
          Reservation Confirmed
        </h1>

        <div style={styles.spanishTitle}>
          Reservación confirmada
        </div>

        <p style={styles.introText}>
          Your payment was received successfully and Pin&amp;Go is now
          preparing your stay.
        </p>

        <p style={styles.introText}>
          Su pago fue recibido correctamente y Pin&amp;Go está preparando su
          estadía.
        </p>

        <div style={styles.accessStatusCard}>
          <div style={styles.accessStatusHeader}>
            <div style={styles.lockIcon} aria-hidden="true">
              <svg
                width="22"
                height="22"
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
              <div style={styles.accessStatusEyebrow}>
                Access status / Estado del acceso
              </div>

              <h2 style={styles.accessStatusTitle}>
                Secure Pre-check-in Required
              </h2>

              <div style={styles.accessStatusSpanishTitle}>
                Registro seguro requerido
              </div>
            </div>
          </div>

          <p style={styles.accessStatusText}>
            Your reservation is confirmed, but access credentials remain
            pending until the primary guest completes Secure Pre-check-in.
          </p>

          <p style={styles.accessStatusText}>
            Su reservación está confirmada, pero las credenciales de acceso
            permanecerán pendientes hasta que el huésped principal complete el
            Registro Seguro.
          </p>

          <div style={styles.requirements}>
            <div style={styles.requirement}>
              <span style={styles.requirementNumber}>1</span>

              <div>
                <strong style={styles.requirementTitle}>
                  Identity Check
                </strong>

                <span style={styles.requirementText}>
                  Verificación de identidad
                </span>
              </div>
            </div>

            <div style={styles.requirement}>
              <span style={styles.requirementNumber}>2</span>

              <div>
                <strong style={styles.requirementTitle}>
                  Guest Agreement
                </strong>

                <span style={styles.requirementText}>
                  Acuerdo del huésped
                </span>
              </div>
            </div>
          </div>

          <div style={styles.automationNotice}>
            Pin&amp;Go will automatically deliver access credentials after all
            required steps are completed and the access window becomes
            available.
            <br />
            Pin&amp;Go entregará automáticamente las credenciales de acceso
            después de completar todos los requisitos y cuando la ventana de
            acceso esté disponible.
          </div>
        </div>

        <div style={styles.nextStepCard}>
          <strong style={styles.nextStepTitle}>
            Check your email to continue
          </strong>

          <span style={styles.nextStepSpanishTitle}>
            Revise su correo electrónico para continuar
          </span>

          <p style={styles.nextStepText}>
            Your confirmation email includes the secure link to Manage
            Reservation and complete Secure Pre-check-in.
          </p>

          <p style={styles.nextStepText}>
            Su correo de confirmación incluye el enlace seguro para administrar
            la reservación y completar el Registro Seguro.
          </p>
        </div>

        <Link
          to={`/book/${organizationSlug}`}
          style={styles.button}
        >
          Return to booking page / Volver a reservaciones
        </Link>

        <p style={styles.footerNote}>
          Pin&amp;Go Guest Services
        </p>
      </div>
    </div>
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