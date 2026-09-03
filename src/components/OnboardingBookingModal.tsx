import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang?: "es" | "en";
  bookingType?: "onboarding" | "demo";
  initialTopic?: string;
  previewOnly?: boolean;
};

type Slot = {
  time: string;
  available: boolean;
};

type AvailabilityResponse = {
  ok?: boolean;
  slots?: Slot[];
};

type BookingResponse = {
  ok?: boolean;
  error?: string;
  googleMeetLink?: string | null;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getLocalDateMinimum() {
  const now = new Date();
  const localNow = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );

  return localNow.toISOString().slice(0, 10);
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    const styles = window.getComputedStyle(element);
    return styles.display !== "none" && styles.visibility !== "hidden";
  });
}

function formatSlotTime(time: string, lang: "es" | "en") {
  const [hour = "0", minute = "0"] = time.split(":");
  const value = new Date(2000, 0, 1, Number(hour), Number(minute));

  return value.toLocaleTimeString(lang === "es" ? "es-PR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OnboardingBookingModal({
  isOpen,
  onClose,
  lang = "es",
  bookingType = "onboarding",
  initialTopic = "",
  previewOnly = false,
}: Props) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Puerto_Rico";
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const isDemo = bookingType === "demo";
  const minDate = getLocalDateMinimum();

  const titleId = useId();
  const descriptionId = useId();
  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const topicId = useId();
  const dateId = useId();
  const remoteId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: initialTopic,
    remoteAssistanceRequested: false,
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  const t =
    lang === "es"
      ? {
          title: isDemo
            ? "Agendar llamada informativa"
            : "Agendar onboarding",
          subtitle: isDemo
            ? "Agenda una llamada para conocer cómo Pin&Go puede ayudarte."
            : "Escoge una fecha y un horario disponible para tu sesión.",
          name: "Nombre",
          email: "Correo electrónico",
          phone: "Teléfono",
          topic: isDemo
            ? "¿Qué te gustaría conocer?"
            : "¿Qué necesitas configurar?",
          date: "Fecha",
          availableTimes: "Horarios disponibles",
          remote: "Necesito asistencia remota",
          submit: isDemo ? "Agendar llamada" : "Confirmar cita",
          loading: isDemo ? "Agendando llamada…" : "Agendando…",
          loadingSlots: "Buscando horarios…",
          selectDate: "Selecciona una fecha para ver los horarios disponibles.",
          noSlots: "No hay horarios disponibles para esta fecha.",
          availabilityError:
            "No pudimos consultar los horarios. Intenta seleccionar la fecha nuevamente.",
          selectDateTime: "Selecciona una fecha y un horario.",
          bookingError: "No pudimos crear la cita. Inténtalo nuevamente.",
          networkError:
            "No pudimos conectar con el servicio de citas. Inténtalo nuevamente.",
          previewNotice:
            "Vista previa visual: este formulario está desactivado y no enviará datos.",
          successTitle: isDemo ? "Llamada agendada" : "Cita agendada",
          successText:
            "Recibirás una invitación de Google Calendar con el enlace de Google Meet.",
          meetLink: "Abrir Google Meet",
          close: "Cerrar",
        }
      : {
          title: isDemo ? "Book an info call" : "Book onboarding",
          subtitle: isDemo
            ? "Schedule a call to learn how Pin&Go works and ask your questions."
            : "Choose an available date and time for your session.",
          name: "Name",
          email: "Email",
          phone: "Phone",
          topic: isDemo
            ? "What would you like to learn?"
            : "What do you need help with?",
          date: "Date",
          availableTimes: "Available times",
          remote: "I need remote assistance",
          submit: isDemo ? "Book info call" : "Confirm booking",
          loading: isDemo ? "Booking call…" : "Booking…",
          loadingSlots: "Loading availability…",
          selectDate: "Select a date to view available times.",
          noSlots: "No available times for this date.",
          availabilityError:
            "We could not load availability. Try selecting the date again.",
          selectDateTime: "Select a date and time.",
          bookingError: "We could not create the booking. Please try again.",
          networkError:
            "We could not connect to the booking service. Please try again.",
          previewNotice:
            "Visual preview: this form is disabled and will not send data.",
          successTitle: isDemo
            ? "Info call scheduled"
            : "Appointment scheduled",
          successText:
            "You will receive a Google Calendar invitation with the Google Meet link.",
          meetLink: "Open Google Meet",
          close: "Close",
        };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      (nameInputRef.current ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const dialog = dialogRef.current;
      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const activeIndex = focusableElements.indexOf(activeElement as HTMLElement);

      // A click can place focus on the dialog or on non-focusable content. Bring
      // the next Tab press back into the ordered, enabled controls.
      if (!dialog.contains(activeElement) || activeIndex === -1) {
        event.preventDefault();
        const destination = event.shiftKey
          ? focusableElements[focusableElements.length - 1]
          : focusableElements[0];
        destination.focus();
        return;
      }

      const isFirst = activeIndex === 0;
      const isLast = activeIndex === focusableElements.length - 1;

      if (event.shiftKey && isFirst) {
        event.preventDefault();
        focusableElements[focusableElements.length - 1].focus();
      } else if (!event.shiftKey && isLast) {
        event.preventDefault();
        focusableElements[0].focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !success) return;

    successHeadingRef.current?.focus();
  }, [isOpen, success]);

  useEffect(() => {
    if (!isOpen || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      setLoadingSlots(false);
      setAvailabilityError("");
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setLoadingSlots(true);
      setSelectedTime("");
      setSlots([]);
      setAvailabilityError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/onboarding/appointments/availability?date=${encodeURIComponent(
            selectedDate,
          )}&timezone=${encodeURIComponent(timezone)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as AvailabilityResponse;

        if (!response.ok || !data.ok) {
          throw new Error("Availability request failed");
        }

        if (!controller.signal.aborted) {
          setSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(error);
        setSlots([]);
        setAvailabilityError(t.availabilityError);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSlots(false);
        }
      }
    }

    void loadAvailability();

    return () => controller.abort();
  }, [API_BASE, isOpen, selectedDate, t.availabilityError, timezone]);

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setSelectedTime("");
    setSlots([]);
    setAvailabilityError("");
    setSubmitError("");
    // Show progress in the same event as the date change, before the request
    // effect begins on the following render.
    setLoadingSlots(Boolean(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (previewOnly) {
      setSubmitError(t.previewNotice);
      return;
    }

    if (!selectedDate || !selectedTime) {
      setSubmitError(t.selectDateTime);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/onboarding/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          scheduledAt: `${selectedDate}T${selectedTime}`,
          timezone,
          bookingType: isDemo ? "DEMO" : "ONBOARDING",
        }),
      });
      const data = (await response.json()) as BookingResponse;

      if (!response.ok || !data.ok) {
        setSubmitError(data.error || t.bookingError);
        return;
      }

      setMeetLink(data.googleMeetLink ?? null);
      setSuccess(true);
    } catch (error) {
      console.error(error);
      setSubmitError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const availableSlots = slots.filter((slot) => slot.available);
  const submitDisabled =
    previewOnly || loading || !selectedDate || !selectedTime;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={styles.modal}
      >
        {!success ? (
          <>
            <div style={styles.header}>
              <div>
                <h2 id={titleId} style={styles.title}>
                  {t.title}
                </h2>
                <p id={descriptionId} style={styles.subtitle}>
                  {t.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={styles.closeIcon}
                aria-label={t.close}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              style={styles.form}
              aria-busy={loading}
            >
              {previewOnly && (
                <p role="status" style={styles.previewNotice}>
                  {t.previewNotice}
                </p>
              )}

              <label htmlFor={nameId} style={styles.field}>
                <span style={styles.label}>{t.name}</span>
                <input
                  ref={nameInputRef}
                  id={nameId}
                  name="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="pg-booking-input"
                  style={styles.input}
                  autoComplete="name"
                  required
                />
              </label>

              <label htmlFor={emailId} style={styles.field}>
                <span style={styles.label}>{t.email}</span>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="pg-booking-input"
                  style={styles.input}
                  autoComplete="email"
                  required
                />
              </label>

              <label htmlFor={phoneId} style={styles.field}>
                <span style={styles.label}>{t.phone}</span>
                <input
                  id={phoneId}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="pg-booking-input"
                  style={styles.input}
                  autoComplete="tel"
                />
              </label>

              <label htmlFor={topicId} style={styles.field}>
                <span style={styles.label}>{t.topic}</span>
                <input
                  id={topicId}
                  name="topic"
                  value={form.topic}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      topic: event.target.value,
                    }))
                  }
                  className="pg-booking-input"
                  style={styles.input}
                  autoComplete="off"
                />
              </label>

              <label htmlFor={dateId} style={styles.field}>
                <span style={styles.label}>{t.date}</span>
                <input
                  id={dateId}
                  name="date"
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                  className="pg-booking-input"
                  style={styles.input}
                  required
                />
              </label>

              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-busy={loadingSlots}
              >
                {!selectedDate ? (
                  <p style={styles.helperText}>{t.selectDate}</p>
                ) : loadingSlots ? (
                  <p style={styles.helperText}>{t.loadingSlots}</p>
                ) : availabilityError ? (
                  <p style={styles.errorText}>{availabilityError}</p>
                ) : availableSlots.length === 0 ? (
                  <p style={styles.helperText}>{t.noSlots}</p>
                ) : (
                  <span style={styles.srOnly}>
                    {t.availableTimes}: {availableSlots.length}
                  </span>
                )}
              </div>

              {selectedDate &&
                !loadingSlots &&
                !availabilityError &&
                availableSlots.length > 0 && (
                  <div role="group" aria-label={t.availableTimes}>
                    <p style={styles.label}>{t.availableTimes}</p>
                    <div style={styles.slotGrid}>
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => {
                            setSelectedTime(slot.time);
                            setSubmitError("");
                          }}
                          aria-pressed={selectedTime === slot.time}
                          style={{
                            ...styles.slotButton,
                            ...(selectedTime === slot.time
                              ? styles.slotButtonActive
                              : {}),
                            ...(!slot.available
                              ? styles.slotButtonDisabled
                              : {}),
                          }}
                        >
                          {formatSlotTime(slot.time, lang)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <label htmlFor={remoteId} style={styles.checkboxRow}>
                <input
                  id={remoteId}
                  name="remoteAssistanceRequested"
                  type="checkbox"
                  checked={form.remoteAssistanceRequested}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      remoteAssistanceRequested: event.target.checked,
                    }))
                  }
                />
                <span>{t.remote}</span>
              </label>

              <p
                role="alert"
                aria-live="assertive"
                style={submitError ? styles.errorText : styles.srOnly}
              >
                {submitError}
              </p>

              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...styles.primaryButton,
                  opacity: submitDisabled ? 0.7 : 1,
                  cursor: submitDisabled ? "not-allowed" : "pointer",
                }}
              >
                {loading ? t.loading : t.submit}
              </button>
            </form>
          </>
        ) : (
          <div>
            <div role="status" aria-live="polite" aria-atomic="true">
              <h2
                id={titleId}
                ref={successHeadingRef}
                tabIndex={-1}
                style={styles.title}
              >
                ✓ {t.successTitle}
              </h2>
              <p id={descriptionId} style={styles.subtitle}>
                {t.successText}
              </p>
            </div>

            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.meetLink}
              >
                {t.meetLink}
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              style={styles.primaryButton}
            >
              {t.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    padding: 16,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  modal: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 28,
    width: "100%",
    maxWidth: 480,
    maxHeight: "calc(100dvh - 32px)",
    overflowY: "auto",
    boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)",
    border: "1px solid #e2e8f0",
    outline: "none",
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
    flex: "0 0 auto",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    width: 38,
    height: 38,
    fontSize: 24,
    cursor: "pointer",
    color: "#475569",
    lineHeight: 1,
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
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "12px 13px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 16,
    color: "#0f172a",
  },
  helperText: {
    margin: "2px 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.5,
  },
  errorText: {
    margin: "2px 0",
    color: "#b42318",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  previewNotice: {
    margin: "0 0 4px",
    padding: "10px 12px",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1e3a5f",
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.5,
  },
  slotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 8,
    marginTop: 4,
  },
  slotButton: {
    minHeight: 42,
    padding: "10px 8px",
    borderRadius: 10,
    border: "1px solid #94a3b8",
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
    gap: 8,
    marginTop: 4,
    fontSize: 14,
    color: "#334155",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    marginTop: 8,
    padding: "13px 18px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
  meetLink: {
    display: "inline-block",
    marginTop: 14,
    marginRight: 12,
    marginBottom: 12,
    color: "#1d4ed8",
    fontWeight: 700,
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
