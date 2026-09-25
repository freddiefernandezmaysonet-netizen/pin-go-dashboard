import { lazy, Suspense, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));

type ChatMessage = Readonly<{
  id: string;
  role: "guest" | "assistant";
  text: string;
  requiresHumanReview?: boolean;
}>;

type PinAIResponse = Readonly<{
  ok?: boolean;
  reply?: string;
  mode?: "SHADOW";
  requiresHumanReview?: boolean;
  actionsExecuted?: boolean;
  operationalWrites?: boolean;
  error?: string;
}>;

type GuestPinAIChatProps = Readonly<{
  apiBase: string;
  guestToken: string;
}>;

const MAX_MESSAGE_LENGTH = 2_000;
const PIN_AI_MARKDOWN_ELEMENTS = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "br",
];

function uiLanguage(): "es" | "en" {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")) {
    return "es";
  }
  return "en";
}

function requestErrorMessage(
  language: "es" | "en",
  status: number,
  payload: PinAIResponse | null,
) {
  if (status === 409 || payload?.error === "PIN_AI_BUSY") {
    return language === "es"
      ? "Pin AI está atendiendo tu mensaje anterior. Intenta nuevamente en unos segundos."
      : "Pin AI is finishing your previous message. Try again in a few seconds.";
  }

  if (status === 404 || payload?.error === "RESERVATION_NOT_FOUND") {
    return language === "es"
      ? "Esta reservación ya no está disponible para Pin AI."
      : "This reservation is no longer available to Pin AI.";
  }

  if (status === 503 || payload?.error === "PIN_AI_UNAVAILABLE") {
    return language === "es"
      ? "Pin AI no está disponible en este momento. Intenta nuevamente más tarde."
      : "Pin AI is not available right now. Please try again later.";
  }

  return language === "es"
    ? "No pudimos obtener una respuesta de Pin AI. Intenta nuevamente."
    : "We could not get a response from Pin AI. Please try again.";
}

function ChatMessageContent({ message }: Readonly<{ message: ChatMessage }>) {
  if (message.role === "guest") {
    return <>{message.text}</>;
  }

  return (
    <Suspense fallback={null}>
      <ReactMarkdown
        allowedElements={PIN_AI_MARKDOWN_ELEMENTS}
        skipHtml
        unwrapDisallowed
        components={{
          p: ({ children }) => (
            <p style={styles.markdownParagraph}>{children}</p>
          ),
          ul: ({ children }) => <ul style={styles.markdownList}>{children}</ul>,
          ol: ({ children }) => <ol style={styles.markdownList}>{children}</ol>,
        }}
      >
        {message.text}
      </ReactMarkdown>
    </Suspense>
  );
}

export function GuestPinAIChat({ apiBase, guestToken }: GuestPinAIChatProps) {
  const language = useMemo(uiLanguage, []);
  const copy =
    language === "es"
      ? {
          eyebrow: "Pin AI — Beta",
          title: "Asistente de tu estadía",
          intro:
            "Pregúntame sobre tu reservación, acceso, horarios, políticas o solicitudes durante tu estadía.",
          safety:
            "Pin AI puede orientarte y revisar tu reservación. Algunas solicitudes necesitan revisión antes de realizar cambios.",
          placeholder: "Escribe tu pregunta…",
          send: "Enviar",
          sending: "Pensando…",
          you: "Tú",
          assistant: "Pin AI",
          review: "Esta solicitud necesita revisión antes de realizar cualquier cambio.",
          counter: "caracteres",
        }
      : {
          eyebrow: "Pin AI — Beta",
          title: "Your stay assistant",
          intro:
            "Ask me about your reservation, access, schedules, policies, or requests during your stay.",
          safety:
            "Pin AI can guide you and review your reservation. Some requests require review before any change is made.",
          placeholder: "Type your question…",
          send: "Send",
          sending: "Thinking…",
          you: "You",
          assistant: "Pin AI",
          review: "This request needs review before any change is made.",
          counter: "characters",
        };

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || message.length > MAX_MESSAGE_LENGTH || submitting) {
      return;
    }

    const guestMessage: ChatMessage = {
      id: `guest-${Date.now()}`,
      role: "guest",
      text: message,
    };

    setMessages((current) => [...current, guestMessage]);
    setDraft("");
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        `${apiBase}/api/public-booking/manage/${encodeURIComponent(guestToken)}/pin-ai/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      const payload = (await response.json().catch(() => null)) as PinAIResponse | null;

      if (!response.ok || payload?.ok !== true || !payload.reply?.trim()) {
        throw new Error(requestErrorMessage(language, response.status, payload));
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply!.trim(),
          requiresHumanReview: payload.requiresHumanReview === true,
        },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : requestErrorMessage(language, 500, null),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - draft.length;

  return (
    <section style={styles.card} aria-labelledby="pin-ai-chat-title">
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>{copy.eyebrow}</div>
          <h2 id="pin-ai-chat-title" style={styles.title}>
            {copy.title}
          </h2>
          <p style={styles.intro}>{copy.intro}</p>
        </div>
        <div style={styles.statusDot} aria-label="Beta" title="Beta" />
      </div>

      <div style={styles.safetyNotice}>{copy.safety}</div>

      {messages.length > 0 ? (
        <div style={styles.messages} aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                ...styles.messageRow,
                ...(message.role === "guest" ? styles.messageRowGuest : {}),
              }}
            >
              <div
                style={{
                  ...styles.messageBubble,
                  ...(message.role === "guest"
                    ? styles.guestBubble
                    : styles.assistantBubble),
                }}
              >
                <div style={styles.messageLabel}>
                  {message.role === "guest" ? copy.you : copy.assistant}
                </div>
                <div style={styles.messageText}>
                  <ChatMessageContent message={message} />
                </div>
                {message.requiresHumanReview ? (
                  <div style={styles.reviewNotice}>{copy.review}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      ) : null}

      <form onSubmit={sendMessage} style={styles.form}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.placeholder}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={submitting}
          rows={3}
          aria-label={copy.placeholder}
          style={styles.textarea}
        />
        <div style={styles.formFooter}>
          <span style={styles.counter}>
            {remaining} {copy.counter}
          </span>
          <button
            type="submit"
            disabled={submitting || draft.trim().length === 0}
            style={{
              ...styles.sendButton,
              ...(submitting || draft.trim().length === 0
                ? styles.sendButtonDisabled
                : {}),
            }}
          >
            {submitting ? copy.sending : copy.send}
          </button>
        </div>
      </form>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 18px 50px rgba(37, 99, 235, 0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  intro: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 650,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#2563eb",
    boxShadow: "0 0 0 6px #dbeafe",
    flexShrink: 0,
    marginTop: 8,
  },
  safetyNotice: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 750,
  },
  messages: {
    marginTop: 20,
    display: "grid",
    gap: 12,
    maxHeight: 440,
    overflowY: "auto",
  },
  messageRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  messageRowGuest: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    padding: "12px 14px",
    display: "grid",
    gap: 6,
  },
  assistantBubble: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
  },
  guestBubble: {
    background: "#0f172a",
    border: "1px solid #0f172a",
    color: "#ffffff",
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.75,
  },
  messageText: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 650,
  },
  markdownParagraph: {
    margin: 0,
  },
  markdownList: {
    margin: "4px 0 0",
    paddingLeft: 20,
  },
  reviewNotice: {
    marginTop: 4,
    borderTop: "1px solid rgba(37,99,235,0.18)",
    paddingTop: 8,
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 850,
  },
  error: {
    marginTop: 16,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 800,
  },
  form: {
    marginTop: 20,
    display: "grid",
    gap: 10,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 92,
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 13px",
    color: "#0f172a",
    background: "#ffffff",
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.5,
    outline: "none",
  },
  formFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  counter: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  sendButton: {
    border: "none",
    borderRadius: 14,
    background: "#2563eb",
    color: "#ffffff",
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.2)",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
  },
};
