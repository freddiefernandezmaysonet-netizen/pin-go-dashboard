import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { MessageCircle, RotateCcw, Search, Send, ShieldCheck, Sparkles } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.pin-ngo.com";
const MAX_MESSAGE_LENGTH = 2_000;

type GuestPinAIResponse = {
  ok?: boolean;
  reply?: string;
  mode?: "SHADOW";
  escalationCreated?: boolean;
  requiresHumanReview?: boolean;
  actionsExecuted?: boolean;
  databaseWrites?: boolean;
  webSearch?: { enabled?: boolean; used?: boolean };
};

type Language = "en" | "es";
const copy = {
  en: {
    eyebrow: "Pin AI guest assistance",
    title: "How can I help with your stay?",
    intro: "Ask about this reservation, property information, access status, check-in, checkout, or nearby places.",
    preview: "Shadow preview",
    privacy: "One question at a time. This conversation is not saved yet.",
    placeholder: "Ask Pin AI a question about your stay...",
    send: "Ask Pin AI",
    sending: "Checking...",
    question: "Your question",
    answer: "Pin AI response",
    reset: "Ask another question",
    review: "Host review may be required. Nothing was sent, approved, or changed.",
    searched: "Current public web information was consulted for this response.",
    safety: "Informational shadow mode: Pin AI cannot charge, refund, cancel, change your reservation, create access, or contact the host.",
    unavailable: "Pin AI is not available yet. Please try again later.",
    invalid: "Enter a question between 1 and 2,000 characters.",
    genericError: "Pin AI could not answer this question. Please try again.",
    quickLabel: "Try asking",
    prompts: ["What time is check-in and checkout?", "Can I request a late checkout?", "What should I know about property access?", "Find nearby restaurants."],
  },
  es: {
    eyebrow: "Asistencia al huésped con Pin AI",
    title: "¿Cómo puedo ayudarte con tu estadía?",
    intro: "Pregunta sobre esta reservación, la propiedad, el acceso, check-in, checkout o lugares cercanos.",
    preview: "Vista previa shadow",
    privacy: "Una pregunta a la vez. Esta conversación todavía no se guarda.",
    placeholder: "Hazle a Pin AI una pregunta sobre tu estadía...",
    send: "Preguntar a Pin AI",
    sending: "Verificando...",
    question: "Tu pregunta",
    answer: "Respuesta de Pin AI",
    reset: "Hacer otra pregunta",
    review: "Puede requerir revisión del host. Nada fue enviado, aprobado ni cambiado.",
    searched: "Se consultó información pública actual en la web para esta respuesta.",
    safety: "Modo shadow informativo: Pin AI no puede cobrar, reembolsar, cancelar, cambiar tu reservación, crear accesos ni contactar al host.",
    unavailable: "Pin AI todavía no está disponible. Intenta nuevamente más tarde.",
    invalid: "Escribe una pregunta de 1 a 2,000 caracteres.",
    genericError: "Pin AI no pudo contestar esta pregunta. Intenta nuevamente.",
    quickLabel: "Puedes preguntar",
    prompts: ["¿A qué hora son el check-in y el checkout?", "¿Puedo solicitar un checkout más tarde?", "¿Qué debo saber sobre el acceso a la propiedad?", "Busca restaurantes cercanos."],
  },
} as const;

function resolveLanguage(): Language {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function errorMessage(response: Response, language: Language) {
  const text = copy[language];
  if (response.status === 400) return text.invalid;
  if (response.status === 404 || response.status === 503) return text.unavailable;
  return text.genericError;
}

export function GuestPinAIAssistant({ guestToken }: { guestToken: string }) {
  const language = useMemo(resolveLanguage, []);
  const text = copy[language];
  const [message, setMessage] = useState("");
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [response, setResponse] = useState<GuestPinAIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submitQuestion() {
    const question = message.trim();
    if (!question || question.length > MAX_MESSAGE_LENGTH) {
      setError(text.invalid);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setSubmitting(true);
      setError(null);
      setResponse(null);
      setLastQuestion(question);
      const apiResponse = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(guestToken)}/pin-ai/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question }),
          signal: controller.signal,
        },
      );
      const payload = (await apiResponse.json().catch(() => ({}))) as GuestPinAIResponse;
      if (
        !apiResponse.ok || payload.ok !== true || typeof payload.reply !== "string" ||
        !payload.reply.trim() || payload.mode !== "SHADOW" ||
        payload.actionsExecuted !== false || payload.databaseWrites !== false ||
        payload.escalationCreated !== false
      ) {
        throw new Error(errorMessage(apiResponse, language));
      }
      setResponse(payload);
      setMessage("");
    } catch (caughtError: unknown) {
      if (!controller.signal.aborted) {
        setError(caughtError instanceof Error && caughtError.message ? caughtError.message : text.genericError);
      }
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  function resetAnswer() {
    setLastQuestion(null);
    setResponse(null);
    setError(null);
  }

  return (
    <section style={styles.shell} aria-labelledby="pin-ai-title">
      <div style={styles.header}>
        <div style={styles.iconWrap} aria-hidden="true"><Sparkles size={22} /></div>
        <div style={styles.headerCopy}>
          <div style={styles.eyebrow}>{text.eyebrow}</div>
          <h2 id="pin-ai-title" style={styles.title}>{text.title}</h2>
          <p style={styles.intro}>{text.intro}</p>
        </div>
        <span style={styles.previewBadge}>{text.preview}</span>
      </div>

      <div style={styles.privacyLine}><ShieldCheck size={17} aria-hidden="true" /><span>{text.privacy}</span></div>

      {response?.reply && lastQuestion ? (
        <div style={styles.answerStack} aria-live="polite">
          <div style={styles.questionBubble}>
            <span style={styles.messageLabel}>{text.question}</span>
            <p style={styles.messageText}>{lastQuestion}</p>
          </div>
          <div style={styles.answerBubble}>
            <div style={styles.answerHeading}><MessageCircle size={18} aria-hidden="true" /><span>{text.answer}</span></div>
            <p style={styles.answerText}>{response.reply}</p>
            {response.requiresHumanReview ? <div style={styles.reviewNotice}>{text.review}</div> : null}
            {response.webSearch?.used ? <div style={styles.searchNotice}><Search size={15} aria-hidden="true" /><span>{text.searched}</span></div> : null}
          </div>
          <button type="button" onClick={resetAnswer} style={styles.resetButton}><RotateCcw size={16} aria-hidden="true" />{text.reset}</button>
        </div>
      ) : (
        <>
          <div style={styles.quickArea}>
            <span style={styles.quickLabel}>{text.quickLabel}</span>
            <div style={styles.quickGrid}>
              {text.prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => { setMessage(prompt); setError(null); }} style={styles.quickButton}>{prompt}</button>
              ))}
            </div>
          </div>
          <form onSubmit={handleSubmit} style={styles.form}>
            <textarea value={message} onChange={(event) => { setMessage(event.target.value); setError(null); }} onKeyDown={handleKeyDown} maxLength={MAX_MESSAGE_LENGTH} rows={3} disabled={submitting} placeholder={text.placeholder} aria-label={text.placeholder} style={styles.textarea} />
            <div style={styles.formFooter}>
              <span style={styles.counter}>{message.length}/{MAX_MESSAGE_LENGTH}</span>
              <button type="submit" disabled={submitting || message.trim().length === 0} style={{ ...styles.sendButton, ...(submitting || message.trim().length === 0 ? styles.sendButtonDisabled : {}) }}>
                <Send size={17} aria-hidden="true" />{submitting ? text.sending : text.send}
              </button>
            </div>
          </form>
        </>
      )}

      {error ? <div role="alert" style={styles.errorNotice}>{error}</div> : null}
      <div style={styles.safetyNotice}>{text.safety}</div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: "grid", gap: 18, padding: 24, borderRadius: 22, border: "1px solid #c7d2fe", background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.14), transparent 38%), #ffffff", boxShadow: "0 18px 45px rgba(15,23,42,0.08)" },
  header: { display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  iconWrap: { display: "grid", placeItems: "center", width: 44, height: 44, flex: "0 0 auto", borderRadius: 14, color: "#ffffff", background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 10px 24px rgba(79,70,229,0.25)" },
  headerCopy: { flex: "1 1 320px", minWidth: 0 },
  eyebrow: { color: "#4f46e5", fontSize: 11, fontWeight: 950, letterSpacing: "0.1em", textTransform: "uppercase" },
  title: { margin: "5px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.18, letterSpacing: "-0.025em" },
  intro: { margin: "8px 0 0", color: "#475569", lineHeight: 1.6 },
  previewBadge: { padding: "7px 10px", borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4338ca", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  privacyLine: { display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 13, fontWeight: 750 },
  quickArea: { display: "grid", gap: 10 }, quickLabel: { color: "#64748b", fontSize: 12, fontWeight: 900 },
  quickGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 9 },
  quickButton: { minHeight: 44, padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", textAlign: "left", fontSize: 13, fontWeight: 750, cursor: "pointer" },
  form: { display: "grid", gap: 10 },
  textarea: { width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 94, padding: 14, borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", font: "inherit", lineHeight: 1.5, outline: "none" },
  formFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, counter: { color: "#94a3b8", fontSize: 11, fontWeight: 750 },
  sendButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", border: 0, borderRadius: 12, background: "linear-gradient(135deg, #2563eb, #4f46e5)", color: "#ffffff", fontWeight: 900, cursor: "pointer" },
  sendButtonDisabled: { opacity: 0.55, cursor: "not-allowed" }, answerStack: { display: "grid", gap: 12 },
  questionBubble: { marginLeft: "clamp(0px, 8vw, 72px)", padding: "13px 15px", borderRadius: "16px 16px 4px 16px", background: "#1d4ed8", color: "#ffffff" },
  answerBubble: { marginRight: "clamp(0px, 6vw, 54px)", padding: "16px 17px", borderRadius: "16px 16px 16px 4px", border: "1px solid #dbeafe", background: "#f8fbff" },
  messageLabel: { display: "block", marginBottom: 4, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 },
  messageText: { margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55 },
  answerHeading: { display: "flex", alignItems: "center", gap: 7, color: "#1d4ed8", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.07em" },
  answerText: { margin: "10px 0 0", color: "#1e293b", lineHeight: 1.7, whiteSpace: "pre-wrap" },
  reviewNotice: { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 800 },
  searchNotice: { display: "flex", alignItems: "center", gap: 7, marginTop: 11, color: "#475569", fontSize: 12, fontWeight: 700 },
  resetButton: { display: "inline-flex", alignItems: "center", gap: 7, width: "fit-content", padding: "9px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontWeight: 850, cursor: "pointer" },
  errorNotice: { padding: "11px 13px", borderRadius: 11, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 750 },
  safetyNotice: { paddingTop: 14, borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, lineHeight: 1.55, fontWeight: 700 },
};
