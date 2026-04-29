import { useEffect, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang?: "es" | "en";
};

type Slot = {
  time: string;
  available: boolean;
};

export default function OnboardingBookingModal({
  isOpen,
  onClose,
  lang = "es",
}: Props) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "",
    remoteAssistanceRequested: false,
  });

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  const t =
    lang === "es"
      ? {
          title: "Agendar onboarding",
          subtitle: "Escoge una fecha y horario disponible para tu sesión.",
          name: "Nombre",
          email: "Email",
          phone: "Teléfono",
          topic: "¿Qué necesitas configurar?",
          date: "Fecha",
          remote: "Necesito asistencia remota",
          submit: "Confirmar cita",
          loading: "Agendando...",
          loadingSlots: "Buscando horarios...",
          selectDate: "Selecciona una fecha para ver horarios disponibles.",
          noSlots: "No hay horarios disponibles para esta fecha.",
          successTitle: "Cita agendada",
          successText:
            "Recibirás una invitación de Google Calendar con el link de Google Meet.",
          close: "Cerrar",
        }
      : {
          title: "Book onboarding",
          subtitle: "Choose an available date and time for your session.",
          name: "Name",
          email: "Email",
          phone: "Phone",
          topic: "What do you need help with?",
          date: "Date",
          remote: "I need remote assistance",
          submit: "Confirm booking",
          loading: "Booking...",
          loadingSlots: "Loading availability...",
          selectDate: "Select a date to view available times.",
          noSlots: "No available times for this date.",
          successTitle: "Appointment scheduled",
          successText:
            "You will receive a Google Calendar invitation with the Google Meet link.",
          close: "Close",
        };

  useEffect(() => {
    if (!isOpen || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      return;
    }

    async function loadAvailability() {
      setLoadingSlots(true);
      setSelectedTime("");

      try {
        const res = await fetch(
          `${API_BASE}/api/onboarding/appointments/availability?date=${encodeURIComponent(
            selectedDate
          )}&timezone=${encodeURIComponent(timezone)}`
        );

        const data = await res.json();

        if (data.ok) {
          setSlots(data.slots ?? []);
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error(err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadAvailability();
  }, [API_BASE, isOpen, selectedDate, timezone]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedDate || !selectedTime) {
      alert(lang === "es" ? "Selecciona fecha y hora." : "Select date and time.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/onboarding/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          scheduledAt: `${selectedDate}T${selectedTime}`,
          timezone,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMeetLink(data.googleMeetLink ?? null);
        setSuccess(true);
      } else {
        alert(data.error ?? "Error creating appointment");
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
                type="date"
                aria-label={t.date}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={styles.input}
                required
              />

              {!selectedDate ? (
                <p style={styles.helperText}>{t.selectDate}</p>
              ) : loadingSlots ? (
                <p style={styles.helperText}>{t.loadingSlots}</p>
              ) : slots.filter((slot) => slot.available).length === 0 ? (
                <p style={styles.helperText}>{t.noSlots}</p>
              ) : (
                <div style={styles.slotGrid}>
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      style={{
                        ...styles.slotButton,
                        ...(selectedTime === slot.time
                          ? styles.slotButtonActive
                          : {}),
                        ...(!slot.available ? styles.slotButtonDisabled : {}),
                      }}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}

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
                disabled={loading || !selectedDate || !selectedTime}
                style={{
                  ...styles.primaryButton,
                  opacity: loading || !selectedDate || !selectedTime ? 0.7 : 1,
                  cursor:
                    loading || !selectedDate || !selectedTime
                      ? "not-allowed"
                      : "pointer",
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

            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.meetLink}
              >
                Google Meet
              </a>
            )}

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
    maxWidth: 460,
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
  helperText: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: 13,
  },
  slotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 4,
  },
  slotButton: {
    padding: "10px 8px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  slotButtonActive: {
    background: "#0f172a",
    color: "#fff",
    border: "1px solid #0f172a",
  },
  slotButtonDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
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
  meetLink: {
    display: "inline-block",
    marginTop: 10,
    marginBottom: 12,
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
};