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
          submit: "Confirmar cita",
          loading: "Agendando...",
          successTitle: "Cita agendada",
          successText:
            "Te contactaremos para confirmar tu sesión de onboarding.",
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
          submit: "Confirm booking",
          loading: "Booking...",
          successTitle: "Appointment scheduled",
          successText:
            "We will contact you to confirm your onboarding session.",
          close: "Close",
        };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/appointments", {
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
              <h2 style={styles.title}>{t.title}</h2>
              <button onClick={onClose} style={styles.closeIcon}>
                ×
              </button>
            </div>

            <p style={styles.subtitle}>{t.subtitle}</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                placeholder={t.name}
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                style={styles.input}
                required
              />

              <input
                type="email"
                placeholder={t.email}
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                style={styles.input}
                required
              />

              <input
                placeholder={t.phone}
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                style={styles.input}
              />

              <input
                placeholder={t.topic}
                value={form.topic}
                onChange={(e) =>
                  setForm({ ...form, topic: e.target.value })
                }
                style={styles.input}
              />

              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
                style={styles.input}
                required
              />

              <button
                type="submit"
                disabled={loading}
                style={styles.primaryButton}
              >
                {loading ? t.loading : t.submit}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={styles.title}>✅ {t.successTitle}</h2>
            <p style={styles.subtitle}>{t.successText}</p>

            <button onClick={onClose} style={styles.primaryButton}>
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.6)",
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
    maxWidth: 420,
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  closeIcon: {
    background: "transparent",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    color: "#64748b",
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 20,
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
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
};