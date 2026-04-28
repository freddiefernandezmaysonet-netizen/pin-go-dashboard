import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function OnboardingBookingModal({ isOpen, onClose }: Props) {
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
            <h2 style={styles.title}>Agendar onboarding</h2>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                placeholder="Nombre"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                style={styles.input}
                required
              />

              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                style={styles.input}
                required
              />

              <input
                placeholder="Teléfono"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                style={styles.input}
              />

              <input
                placeholder="¿Qué necesitas configurar?"
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
                {loading ? "Agendando..." : "Confirmar cita"}
              </button>
            </form>

            <button onClick={onClose} style={styles.closeButton}>
              Cerrar
            </button>
          </>
        ) : (
          <>
            <h2 style={styles.title}>✅ Cita agendada</h2>
            <p style={{ textAlign: "center", marginTop: 10 }}>
              Te contactaremos para confirmar tu onboarding.
            </p>

            <button onClick={onClose} style={styles.primaryButton}>
              Cerrar
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
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  modal: {
    background: "#fff",
    padding: 30,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  primaryButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  closeButton: {
    marginTop: 10,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#555",
  },
};