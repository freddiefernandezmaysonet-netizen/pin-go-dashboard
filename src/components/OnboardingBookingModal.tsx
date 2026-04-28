import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang?: "es" | "en";
};

export default function OnboardingBookingModal({
  isOpen,
  onClose,
  lang = "es",
}: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "",
    scheduledAt: "",
    remoteAssistanceRequested: false,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const t =
    lang === "es"
      ? {
          title: "Agendar onboarding",
          subtitle:
            "Agenda una sesión con nuestro equipo para ayudarte a configurar Pin&Go.",
          name: "Nombre",
          email: "Email",
          phone: "Teléfono",
          topic: "¿Qué necesitas configurar?",
          date: "Fecha y hora",
          remote: "Necesito asistencia remota",
          submit: "Confirmar cita",
          loading: "Agendando...",
          successTitle: "Cita agendada",
          successText:
            "Te contactaremos para confirmar tu sesión. Si solicitaste asistencia remota, te guiaremos durante la llamada.",
          close: "Cerrar",
        }
      : {
          title: "Book onboarding",
          subtitle:
            "Schedule a session with our team to help you set up Pin&Go.",
          name: "Name",
          email: "Email",
          phone: "Phone",
          topic: "What do you need help with?",
          date: "Date & time",
          remote: "I need remote assistance",
          submit: "Confirm booking",
          loading: "Booking...",
          successTitle: "Appointment scheduled",
          successText:
            "We will contact you to confirm your session. If you requested remote assistance, we will guide you during the call.",
          close: "Close",
        };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
     const API_BASE = import.meta.env.VITE_API_BASE ?? "";

     const res = await fetch(`${API_BASE}/api/onboarding/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
      } else {
        alert("Error creating appointment");
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {!success ? (
          <>
            <div style={styles.header}>
              <div>
                <h2 style={styles.title}>{t.title}</h2>
                <p style={styles.subtitle}>{t.subtitle}</p>
              </div>

              <button type="button" onClick={onClose} style={styles.closeIcon}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                placeholder={t.name}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={styles.input}
                required
              />

              <input
                type="email"
                placeholder={t.email}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={styles.input}
                required
              />

              <input
                placeholder={t.phone}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                style={styles.input}
              />

              <input
                placeholder={t.topic}
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                style={styles.input}
              />

              <input
                type="datetime-local"
                aria-label={t.date}
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
                style={styles.input}
                required
              />

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.remoteAssistanceRequested}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      remoteAssistanceRequested: e.target.checked,
                    })
                  }
                />
                <span style={{ marginLeft: 8 }}>{t.remote}</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.primaryButton,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? t.loading : t.submit}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={styles.title}>✅ {t.successTitle}</h2>
            <p style={styles.subtitle}>{t.successText}</p>

            <button type="button" onClick={onClose} style={styles.primaryButton}>
              {t.close}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.62)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    padding: 20,
  },
  modal: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 28,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
    border: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  closeIcon: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    width: 34,
    height: 34,
    fontSize: 22,
    cursor: "pointer",
    color: "#64748b",
    lineHeight: "28px",
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    padding: "12px 13px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    marginTop: 8,
    fontSize: 14,
    color: "#475569",
  },
  primaryButton: {
    marginTop: 12,
    padding: "14px 18px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
};