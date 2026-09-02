import { useEffect, useId, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getReviewInvitation, submitReview } from "../../api/reviews";
import { usePublicNoIndex } from "../../lib/publicDocumentMetadata";

const categories = [
  ["cleanlinessRating", "Cleanliness", "Limpieza"],
  ["accuracyRating", "Accuracy", "Exactitud"],
  ["checkInAccessRating", "Check-in & access", "Check-in y acceso"],
  ["communicationRating", "Communication", "Comunicación"],
  ["locationRating", "Location", "Ubicación"],
  ["valueRating", "Value", "Valor"],
] as const;

type Invitation = {
  propertyName: string;
  propertyPhoto: string;
  checkIn: string;
  checkOut: string;
  language: string;
  availableAt: string;
  expiresAt: string;
  canSubmit: boolean;
};

function Stars({ value, onChange, label, language }: { value: number; onChange: (value: number) => void; label: string; language: "en" | "es" }) {
  const groupId = useId().replaceAll(":", "");
  function select(star: number) {
    onChange(star);
    document.getElementById(`${groupId}-${star}`)?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          id={`${groupId}-${star}`}
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={language === "es" ? `${star} de 5` : `${star} of 5`}
          tabIndex={value === star || (!value && star === 1) ? 0 : -1}
          onClick={() => onChange(star)}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(5, (value || 1) + 1) : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(1, (value || 1) - 1) : event.key === "Home" ? 1 : event.key === "End" ? 5 : null;
            if (next !== null) { event.preventDefault(); select(next); }
          }}
          style={{ border: 0, background: "none", color: star <= value ? "#d79b28" : "#cbd5e1", fontSize: 30, cursor: "pointer", padding: 6, minWidth: 44, minHeight: 44 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function GuestReviewPage() {
  usePublicNoIndex({ noReferrer: true });
  const { hash } = useLocation();
  const reviewToken = useMemo(
    () => new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "",
    [hash]
  );
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<"en" | "es">(() => browserLanguage());
  const [ratings, setRatings] = useState<Record<string, number>>({ overallRating: 0 });
  const [publicComment, setPublicComment] = useState("");
  const [privateFeedback, setPrivateFeedback] = useState("");
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  useEffect(() => {
    if (!reviewToken || typeof window === "undefined") return;
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [reviewToken]);

  useEffect(() => {
    const controller = new AbortController();
    if (!reviewToken) {
      setError(reviewErrorMessage({ code: "REVIEW_TOKEN_INVALID" }, browserLanguage()));
      return () => controller.abort();
    }
    getReviewInvitation(reviewToken, controller.signal)
      .then(({ invitation: data }) => {
        setInvitation(data);
        setError("");
        setLanguage(String(data.language).toLowerCase().startsWith("es") ? "es" : "en");
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (reviewErrorCode(caught) === "REVIEW_TOKEN_CONSUMED") {
          setError("");
          setDone(true);
          return;
        }
        setError(reviewErrorMessage(caught, browserLanguage()));
      });
    return () => controller.abort();
  }, [reviewToken, refreshAttempt]);

  useEffect(() => {
    if (!reviewToken || !invitation || invitation.canSubmit) return;

    const availableAt = new Date(invitation.availableAt).getTime();
    if (!Number.isFinite(availableAt)) return;

    const refresh = () => setRefreshAttempt((current) => current + 1);
    const remaining = availableAt - Date.now();
    const refreshDelay = remaining > 0
      ? Math.min(remaining + 1_000, 24 * 60 * 60 * 1_000)
      : 60_000;
    const timer = window.setTimeout(refresh, refreshDelay);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [invitation, refreshAttempt, reviewToken]);

  useEffect(() => {
    const originalTitle = document.title;
    const originalLanguage = document.documentElement.getAttribute("lang");
    document.title = language === "es" ? "Evalúa tu estadía | Pin&Go" : "Review your stay | Pin&Go";
    document.documentElement.setAttribute("lang", language);
    return () => {
      document.title = originalTitle;
      if (originalLanguage) document.documentElement.setAttribute("lang", originalLanguage);
      else document.documentElement.removeAttribute("lang");
    };
  }, [language]);

  const copy = language === "es"
    ? { title: "¿Cómo estuvo tu estadía?", verified: "Estadía verificada por Pin&Go", overall: "Experiencia general", public: "Cuéntales a futuros huéspedes sobre tu estadía", private: "Comentarios privados para el anfitrión (opcional)", submit: "Enviar evaluación", thanks: "Gracias por compartir tu experiencia.", received: "Tu evaluación ha sido recibida.", unavailable: "Evaluación no disponible", loading: "Cargando…", retry: "Intentar nuevamente", ratingsRequired: "Selecciona todas las calificaciones.", failed: "No pudimos enviar la evaluación.", earlyTitle: "Tu evaluación se habilitará después del checkout", earlyBody: "Podrás compartir tu experiencia a partir del", saveLink: "Conserva este correo de confirmación para volver cuando desees.", openUntil: "El enlace estará disponible hasta el", reopenTitle: "Reabre tu correo de confirmación", reopenBody: "Por tu seguridad, esta página no conserva el enlace privado después de abrirlo. Busca el correo de confirmación de tu reservación de Pin&Go y selecciona “Evaluar tu estadía” para regresar.", emailReminder: "Conserva el correo de confirmación de tu reservación. Si actualizas o cierras esta página, vuelve a abrir la evaluación desde ese correo." }
    : { title: "How was your stay?", verified: "Stay verified by Pin&Go", overall: "Overall experience", public: "Tell future guests about your stay", private: "Private feedback for the host (optional)", submit: "Submit review", thanks: "Thank you for sharing your experience.", received: "Your review has been received.", unavailable: "Review unavailable", loading: "Loading…", retry: "Try again", ratingsRequired: "Please select every rating.", failed: "Unable to submit review.", earlyTitle: "Your review will open after checkout", earlyBody: "You can share your experience starting", saveLink: "Keep this confirmation email so you can return whenever you like.", openUntil: "The link will remain available until", reopenTitle: "Reopen your confirmation email", reopenBody: "For your security, this page does not retain the private link after you open it. Find your Pin&Go reservation confirmation email and select “Review your stay” to return.", emailReminder: "Keep your reservation confirmation email. If you refresh or close this page, reopen the review from that email." };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!invitation?.canSubmit) return;
    if (["overallRating", ...categories.map((category) => category[0])].some((key) => !ratings[key])) { setError(copy.ratingsRequired); return; }
    setBusy(true);
    try {
      await submitReview(reviewToken, { ...ratings, publicComment, privateFeedback, language });
      setDone(true);
    } catch (caught: unknown) {
      if (reviewErrorCode(caught) === "REVIEW_TOKEN_CONSUMED") {
        setDone(true);
        return;
      }
      setError(reviewErrorMessage(caught, language, copy.failed));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <main style={page}><section style={{ ...card, textAlign: "center" }}><div aria-hidden="true" style={{ fontSize: 48 }}>✓</div><h1>{copy.thanks}</h1><p>{copy.received}</p></section></main>;
  if (!reviewToken && !invitation) {
    return (
      <main style={page}>
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setLanguage(language === "es" ? "en" : "es")} style={languageButton}>{language === "es" ? "English" : "Español"}</button>
          </div>
          <div aria-hidden="true" style={{ fontSize: 44, marginTop: 18 }}>✉</div>
          <h1>{copy.reopenTitle}</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>{copy.reopenBody}</p>
        </section>
      </main>
    );
  }
  if (error && !invitation) return <main style={page}><section style={card}><h1>{copy.unavailable}</h1><p role="alert">{error}</p>{reviewToken ? <button type="button" onClick={() => setRefreshAttempt((current) => current + 1)} style={secondaryAction}>{copy.retry}</button> : null}</section></main>;
  if (!invitation) return <main style={page}><section style={card}>{copy.loading}</section></main>;

  if (!invitation.canSubmit) {
    return (
      <main style={page}>
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#527260", fontWeight: 700 }}>✓ {copy.verified}</span>
            <button type="button" onClick={() => setLanguage(language === "es" ? "en" : "es")} style={languageButton}>{language === "es" ? "English" : "Español"}</button>
          </div>
          {invitation.propertyPhoto ? <img src={invitation.propertyPhoto} alt="" style={propertyPhoto} /> : null}
          <div aria-hidden="true" style={{ fontSize: 44, marginTop: 26 }}>🔒</div>
          <h1 style={{ fontSize: 36, marginBottom: 8 }}>{copy.earlyTitle}</h1>
          <p style={{ color: "#475569", fontSize: 18 }}>{invitation.propertyName} · {formatStay(invitation, language)}</p>
          <p style={{ color: "#334155" }}>{copy.earlyBody} <strong>{formatDate(invitation.availableAt, language)}</strong>.</p>
          <p style={{ color: "#64748b" }}>{copy.saveLink} {copy.openUntil} <strong>{formatDate(invitation.expiresAt, language)}</strong>.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      <form onSubmit={handleSubmit} style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#527260", fontWeight: 700 }}>✓ {copy.verified}</span>
          <button type="button" onClick={() => setLanguage(language === "es" ? "en" : "es")} style={languageButton}>{language === "es" ? "English" : "Español"}</button>
        </div>
        {invitation.propertyPhoto ? <img src={invitation.propertyPhoto} alt="" style={propertyPhoto} /> : null}
        <h1 style={{ fontSize: 40, marginBottom: 4 }}>{copy.title}</h1>
        <p style={{ color: "#64748b" }}>{invitation.propertyName} · {formatStay(invitation, language)}</p>
        <p style={{ color: "#64748b", fontSize: 14 }}>{copy.openUntil} {formatDate(invitation.expiresAt, language)}.</p>
        <aside style={emailReminder}>{copy.emailReminder}</aside>
        <section style={ratingRow}><strong>{copy.overall}</strong><Stars label={copy.overall} language={language} value={ratings.overallRating} onChange={(value) => setRatings((current) => ({ ...current, overallRating: value }))} /></section>
        {categories.map(([key, en, es]) => { const labelText = language === "es" ? es : en; return <section key={key} style={ratingRow}><span>{labelText}</span><Stars label={labelText} language={language} value={ratings[key] ?? 0} onChange={(value) => setRatings((current) => ({ ...current, [key]: value }))} /></section>; })}
        <label style={label}>{copy.public}<textarea required maxLength={5000} value={publicComment} onChange={(event) => setPublicComment(event.target.value)} style={textarea} /></label>
        <label style={label}>{copy.private}<textarea maxLength={5000} value={privateFeedback} onChange={(event) => setPrivateFeedback(event.target.value)} style={textarea} /></label>
        {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
        <button disabled={busy} aria-busy={busy} style={{ ...submit, opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>{busy ? "…" : copy.submit}</button>
      </form>
    </main>
  );
}

function formatStay(invitation: Invitation, language: "en" | "es") {
  const formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
  return `${formatter.format(new Date(invitation.checkIn))} – ${formatter.format(new Date(invitation.checkOut))}`;
}

function formatDate(value: string, language: "en" | "es") {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

function browserLanguage(): "en" | "es" {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function reviewErrorCode(caught: unknown) {
  return typeof caught === "object" && caught !== null && "code" in caught
    ? String((caught as { code?: unknown }).code ?? "")
    : "";
}

function reviewErrorMessage(caught: unknown, language: "en" | "es", fallback?: string) {
  const code = reviewErrorCode(caught);
  const messages: Record<string, [string, string]> = {
    REVIEW_TOKEN_INVALID: ["This review link is invalid.", "Este enlace de evaluación no es válido."],
    REVIEW_TOKEN_CONSUMED: ["This review was already submitted.", "Esta evaluación ya fue enviada."],
    REVIEW_TOKEN_EXPIRED: ["This review link has expired.", "Este enlace de evaluación expiró."],
    REVIEW_TOKEN_RECIPIENT_CHANGED: ["This link is no longer assigned to the current guest.", "Este enlace ya no está asignado al huésped actual."],
    REVIEW_CHECKOUT_NOT_COMPLETED: ["Your review will open after checkout.", "Tu evaluación se habilitará después del checkout."],
    REVIEW_STAY_NOT_ELIGIBLE: ["This stay is not eligible for a review.", "Esta estadía no es elegible para una evaluación."],
    REVIEW_RATE_LIMITED: ["Too many attempts. Please wait and try again.", "Demasiados intentos. Espera un momento e inténtalo de nuevo."],
  };
  const translated = messages[code];
  if (translated) return translated[language === "es" ? 1 : 0];
  if (fallback) return fallback;
  return caught instanceof Error
    ? caught.message
    : language === "es"
      ? "Evaluación no disponible."
      : "Review unavailable.";
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#f3f5f1", padding: "48px 18px", color: "#17241f", fontFamily: '"Avenir Next", "Segoe UI", sans-serif' };
const card: React.CSSProperties = { maxWidth: 720, margin: "0 auto", background: "#fff", padding: "clamp(24px,5vw,54px)", borderRadius: 24, boxShadow: "0 18px 60px rgba(23,61,49,.10)" };
const ratingRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" };
const label: React.CSSProperties = { display: "grid", gap: 10, marginTop: 24, fontWeight: 650 };
const textarea: React.CSSProperties = { minHeight: 110, border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, resize: "vertical" };
const submit: React.CSSProperties = { width: "100%", marginTop: 24, padding: 16, border: 0, borderRadius: 12, background: "#173d31", color: "white", fontWeight: 750, cursor: "pointer" };
const languageButton: React.CSSProperties = { border: "1px solid #cbd5e1", background: "white", borderRadius: 99, padding: "7px 12px", cursor: "pointer" };
const secondaryAction: React.CSSProperties = { border: "1px solid #94a3b8", background: "white", borderRadius: 10, padding: "10px 15px", color: "#334155", fontWeight: 700, cursor: "pointer" };
const propertyPhoto: React.CSSProperties = { width: "100%", maxHeight: 220, marginTop: 24, borderRadius: 16, objectFit: "cover" };
const emailReminder: React.CSSProperties = { margin: "18px 0 8px", padding: "11px 13px", border: "1px solid #dbe5df", borderRadius: 10, background: "#f7faf8", color: "#52645b", fontSize: 13, lineHeight: 1.5 };
