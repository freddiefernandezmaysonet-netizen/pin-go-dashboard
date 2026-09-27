import { isPinAIProposalExpired } from "./pinAIProposalExpiry";
import { createGuestChatSession, readGuestChatHistory } from "./pinAIChatSession";
import type { GuestChatSession } from "./pinAIChatSession";
import { readPinAIActionStatus } from "./pinAIActionStatus";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));

type ReservationActionQuote = Readonly<{
  quotedAt: string;
  quoteExpiresAt: string;
  quoteExpiresAtLocal: string;
  priceGuaranteedUntil: string;
  propertyTimezone: string;
  availabilityCheckedAt: string;
  availabilityHeld: false;
  currentTotalAmount: number;
  proposedTotalAmount: number;
  amountDifference: number;
  amountDifferenceCents: number;
  currency: string;
  financialAction: string;
}>;

type ReservationActionProposal = Readonly<{
  actionType: "RESERVATION_MODIFICATION";
  proposalId: string;
  requiresGuestConfirmation: true;
  confirmationToken: string;
  expiresAt: string;
  quote: ReservationActionQuote;
}>;

type ReservationActionResult = Readonly<{
  actionType: "RESERVATION_MODIFICATION";
  proposalId: string;
  outcome:
    | "EXECUTED"
    | "WAITING_FOR_PAYMENT"
    | "WAITING_FOR_HOST"
    | "REVIEW_REQUIRED";
  actionExecuted: boolean;
  quoteExpiresAt: string | null;
  quoteExpiresAtLocal: string | null;
  propertyTimezone: string | null;
  availabilityHeld: false;
  modificationId: string | null;
  modificationStatus: string | null;
  checkoutUrl: string | null;
  paymentExpiresAt: string | null;
  amountDifference: number | null;
  amountDifferenceCents: number | null;
  currency: string | null;
  reasonCode: string | null;
}>;

export type ChatMessage = Readonly<{
  id: string;
  role: "guest" | "assistant";
  text: string;
  requiresHumanReview?: boolean;
  actionProposal?: ReservationActionProposal;
  actionResult?: ReservationActionResult;
}>;

type PinAIResponse = Readonly<{
  ok?: boolean;
  reply?: string;
  mode?: "SHADOW";
  requiresHumanReview?: boolean;
  actionsExecuted?: boolean;
  operationalWrites?: boolean;
  actionProposal?: ReservationActionProposal;
  error?: string;
}>;

type PinAIActionConfirmationResponse = Readonly<{
  ok?: boolean;
  action?: ReservationActionResult;
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

function actionErrorMessage(
  language: "es" | "en",
  status: number,
  payload: PinAIActionConfirmationResponse | null,
) {
  if (status === 403 || payload?.error === "INVALID_CONFIRMATION") {
    return language === "es"
      ? "Esta confirmación ya no es válida. Pídele a Pin AI una nueva cotización."
      : "This confirmation is no longer valid. Ask Pin AI for a new quote.";
  }

  if (status === 404 || payload?.error === "ACTION_PROPOSAL_NOT_FOUND") {
    return language === "es"
      ? "Esta cotización ya no está disponible. Pídele a Pin AI que la prepare nuevamente."
      : "This quote is no longer available. Ask Pin AI to prepare it again.";
  }

  if (status === 409 || payload?.error === "ACTION_REVIEW_REQUIRED") {
    return language === "es"
      ? "La cotización cambió o necesita revisión. Pídele a Pin AI una cotización actualizada."
      : "The quote changed or needs review. Ask Pin AI for an updated quote.";
  }

  if (status === 503 || payload?.error === "PIN_AI_ACTIONS_UNAVAILABLE") {
    return language === "es"
      ? "La confirmación de cambios no está disponible en este momento."
      : "Reservation-change confirmation is not available right now.";
  }

  return language === "es"
    ? "No pudimos confirmar este cambio. Intenta nuevamente."
    : "We could not confirm this change. Please try again.";
}

function formatCurrency(
  value: number,
  currency: string,
  language: "es" | "en",
) {
  try {
    return new Intl.NumberFormat(language === "es" ? "es-PR" : "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatQuoteExpiry(
  value: string,
  timezone: string,
  language: "es" | "en",
) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(language === "es" ? "es-PR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(parsed);
  } catch {
    return value;
  }
}

function ReservationActionCard({
  language,
  proposal,
  result,
  confirming,
  onConfirm,
  paymentStatusCheck,
  onPayment,
}: Readonly<{
  language: "es" | "en";
  proposal: ReservationActionProposal;
  result?: ReservationActionResult;
  confirming: boolean;
  onConfirm: () => void;
  paymentStatusCheck?: "VERIFIED" | "ERROR";
  onPayment: (proposalId: string, url: string) => Promise<void>;
}>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (result && result.outcome !== "WAITING_FOR_PAYMENT") return;
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [result]);
  const expired = isPinAIProposalExpired(proposal, now);
  const copy =
    language === "es"
      ? {
          title: "Cambio de reservación",
          current: "Total actual",
          proposed: "Nuevo total",
          difference: "Diferencia",
          validUntil: "Cotización válida hasta",
          availability:
            "Las fechas no están retenidas. La disponibilidad se verificará nuevamente al confirmar.",
          confirm: "Confirmar cambio",
          confirming: "Confirmando…",
          expired: "La cotización venció. Pídele a Pin AI una nueva cotización.",
          executed: "Cambio aplicado",
          processing: "Pago en proceso. Estamos verificando la aplicación del cambio; no vuelvas a pagar.",
          checking: "Verificando el estado del pago…",
          statusError: "No se pudo verificar el pago. No repitas el pago; vuelve a esta pestaña para reintentar la consulta.",
          payment: "Pago requerido para completar el cambio",
          pay: "Continuar al pago",
          host: "Pendiente de revisión del anfitrión",
          review: "La cotización debe actualizarse antes de continuar.",
        }
      : {
          title: "Reservation change",
          current: "Current total",
          proposed: "New total",
          difference: "Difference",
          validUntil: "Quote valid until",
          availability:
            "Dates are not held. Availability will be checked again when you confirm.",
          confirm: "Confirm change",
          confirming: "Confirming…",
          expired: "This quote has expired. Ask Pin AI for a new quote.",
          executed: "Change applied",
          processing: "Payment is processing. We are checking the reservation change; do not pay again.",
          checking: "Checking payment status…",
          statusError: "Payment status could not be verified. Do not pay again; return to this tab to retry the check.",
          payment: "Payment is required to complete this change",
          pay: "Continue to payment",
          host: "Waiting for host review",
          review: "The quote must be refreshed before continuing.",
        };

  const outcomeText =
    result?.outcome === "EXECUTED"
      ? copy.executed
      : result?.outcome === "WAITING_FOR_PAYMENT"
        ? paymentStatusCheck !== "VERIFIED" ? (paymentStatusCheck === "ERROR" ? copy.statusError : copy.checking)
          : ["PAYMENT_PROCESSING", "APPLYING"].includes(result.modificationStatus ?? "") ? copy.processing : copy.payment
        : result?.outcome === "WAITING_FOR_HOST"
          ? copy.host
          : result?.outcome === "REVIEW_REQUIRED"
            ? copy.review
            : null;

  return (
    <div style={styles.actionCard}>
      <div style={styles.actionTitle}>{copy.title}</div>
      <div style={styles.actionGrid}>
        <div>
          <span style={styles.actionLabel}>{copy.current}</span>
          <strong>
            {formatCurrency(
              proposal.quote.currentTotalAmount,
              proposal.quote.currency,
              language,
            )}
          </strong>
        </div>
        <div>
          <span style={styles.actionLabel}>{copy.proposed}</span>
          <strong>
            {formatCurrency(
              proposal.quote.proposedTotalAmount,
              proposal.quote.currency,
              language,
            )}
          </strong>
        </div>
        <div>
          <span style={styles.actionLabel}>{copy.difference}</span>
          <strong>
            {formatCurrency(
              proposal.quote.amountDifference,
              proposal.quote.currency,
              language,
            )}
          </strong>
        </div>
      </div>

      {!result && <div style={styles.actionExpiry}>
        <strong>{copy.validUntil}:</strong>{" "}
        {formatQuoteExpiry(
          proposal.quote.quoteExpiresAt,
          proposal.quote.propertyTimezone,
          language,
        )}{" "}
        ({proposal.quote.propertyTimezone})
      </div>}

      {!result && <div style={styles.actionAvailability}>{copy.availability}</div>}

      {outcomeText ? <div style={styles.actionOutcome}>{outcomeText}</div> : null}

      {!result && expired ? <div role="status" style={styles.actionOutcome}>{copy.expired}</div> : null}

      {!result ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming || expired}
          style={{
            ...styles.confirmButton,
            ...(confirming || expired ? styles.sendButtonDisabled : {}),
          }}
        >
          {confirming ? copy.confirming : copy.confirm}
        </button>
      ) : null}

      {result?.outcome === "WAITING_FOR_PAYMENT" && result.modificationStatus === "AWAITING_PAYMENT" &&
        paymentStatusCheck === "VERIFIED" && result.paymentExpiresAt && Date.parse(result.paymentExpiresAt) > now && result.checkoutUrl ? (
        <a
          href={result.checkoutUrl}
          rel="noreferrer"
          onClick={event => { event.preventDefault(); void onPayment(proposal.proposalId, result.checkoutUrl!); }}
          style={styles.paymentLink}
        >
          {copy.pay}
        </a>
      ) : null}
    </div>
  );
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
  return <GuestPinAIChatSession key={JSON.stringify([apiBase, guestToken])} apiBase={apiBase} guestToken={guestToken} />;
}

function GuestPinAIChatSession({ apiBase, guestToken }: GuestPinAIChatProps) {
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
  const [confirmingProposalId, setConfirmingProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<GuestChatSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [historyRecoveryFailed, setHistoryRecoveryFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [paymentChecks, setPaymentChecks] = useState<Record<string, "VERIFIED" | "ERROR">>({});
  const paymentNavigation = useRef<AbortController | null>(null);
  useEffect(() => () => { paymentNavigation.current?.abort(); }, []);
  const pendingProposalIds = JSON.stringify(messages.filter(message =>
    message.actionResult?.outcome === "WAITING_FOR_PAYMENT"
  ).map(message => message.actionResult!.proposalId).sort());

  useEffect(() => {
    if (restoring) return;
    const ids = JSON.parse(pendingProposalIds) as string[];
    if (!ids.length) return;
    let active = true;
    let busy = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (busy || !active || document.visibilityState === "hidden") return;
      busy = true;
      try {
        await Promise.all(ids.map(async proposalId => {
          try {
            const status = await readPinAIActionStatus(apiBase, guestToken, proposalId, controller.signal);
            if (!active) return;
            setPaymentChecks(current => ({ ...current, [proposalId]: "VERIFIED" }));
            setMessages(current => current.map(message => {
              const result = message.actionResult;
              if (result?.proposalId !== proposalId || result.outcome !== "WAITING_FOR_PAYMENT") return message;
              if (!status.modificationId || status.modificationId !== result.modificationId) return {
                ...message, actionResult: { ...result, outcome: "REVIEW_REQUIRED", checkoutUrl: null, reasonCode: "ACTION_STATUS_MISMATCH" },
              };
              const applied = status.modificationStatus === "APPLIED" && Boolean(status.appliedAt);
              const payable = status.proposalStatus === "CONFIRMED" && status.modificationStatus === "AWAITING_PAYMENT" &&
                status.paymentStatus === "unpaid" && status.paymentExpiresAt && Date.parse(status.paymentExpiresAt) > Date.parse(status.checkedAt);
              const processing = ["PAYMENT_PROCESSING", "APPLYING"].includes(status.modificationStatus ?? "") ||
                (status.modificationStatus === "AWAITING_PAYMENT" && status.paymentStatus === "paid");
              return { ...message, actionResult: { ...result,
                outcome: applied ? "EXECUTED" : status.modificationStatus === "HOST_APPROVAL_REQUIRED" ? "WAITING_FOR_HOST" : payable || processing ? "WAITING_FOR_PAYMENT" : "REVIEW_REQUIRED",
                actionExecuted: applied, modificationStatus: processing ? "PAYMENT_PROCESSING" : status.modificationStatus,
                paymentExpiresAt: status.paymentExpiresAt, checkoutUrl: payable ? result.checkoutUrl : null,
              } };
            }));
          } catch {
            if (active) setPaymentChecks(current => ({ ...current, [proposalId]: "ERROR" }));
          }
        }));
      } finally { busy = false; }
    };
    void refresh();
    const onResume = () => { void refresh(); };
    const timer = window.setInterval(onResume, 15_000);
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [apiBase, guestToken, pendingProposalIds, restoring]);

  async function continueToPayment(proposalId: string, url: string) {
    paymentNavigation.current?.abort();
    const controller = new AbortController();
    paymentNavigation.current = controller;
    try {
      const status = await readPinAIActionStatus(apiBase, guestToken, proposalId, controller.signal);
      if (controller.signal.aborted) return;
      const result = messages.find(message => message.actionResult?.proposalId === proposalId)?.actionResult;
      if (!result || status.modificationId !== result.modificationId || status.proposalStatus !== "CONFIRMED" ||
          status.modificationStatus !== "AWAITING_PAYMENT" || status.paymentStatus !== "unpaid" ||
          !status.paymentExpiresAt || Date.parse(status.paymentExpiresAt) <= Date.parse(status.checkedAt)) {
        window.dispatchEvent(new Event("focus"));
        return;
      }
      // Server history and receipts are authoritative; browser storage is only
      // a best-effort fallback and may be unavailable in this tab.
      if (session) await session.save(messages).catch(() => setStorageUnavailable(true));
      if (!controller.signal.aborted) window.location.assign(url);
    } catch {
      if (controller.signal.aborted) return;
      setPaymentChecks(current => ({ ...current, [proposalId]: "ERROR" }));
      setError(language === "es" ? "No se pudo verificar el pago o guardar la conversación. No repitas el pago; intenta consultar el estado nuevamente." : "Payment could not be verified or the conversation saved. Do not pay again; retry the status check.");
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const local = createGuestChatSession(apiBase, guestToken).then(async cache => ({ cache, messages: await cache.load() }));
    void Promise.allSettled([readGuestChatHistory(apiBase, guestToken, controller.signal), local]).then(([server, browser]) => {
      if (!active) return;
      if (server.status === "rejected") {
        setHistoryRecoveryFailed(true);
        return;
      }
      // Existing pre-migration conversations can still use a valid local copy.
      // A nonempty server transcript always wins over stale browser snapshots.
      if (server.value.length === 0 && browser.status === "rejected" &&
          browser.reason instanceof Error && browser.reason.message === "CHAT_HISTORY_RECOVERY_FAILED") {
        setHistoryRecoveryFailed(true);
        return;
      }
      const history = server.value.length > 0 ? server.value : browser.status === "fulfilled" ? browser.value.messages : [];
      setMessages(history);
      setRestored(history.length > 0);
      if (browser.status === "fulfilled") setSession(browser.value.cache);
      else setStorageUnavailable(true);
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => { active = false; controller.abort(); };
  }, [apiBase, guestToken]);

  useEffect(() => {
    if (!session || restoring) return;
    let active = true;
    void session.save(messages).catch(() => {
      if (active) setStorageUnavailable(true);
    });
    return () => { active = false; };
  }, [messages, session, restoring]);

  async function confirmAction(messageId: string, proposal: ReservationActionProposal) {
    if (confirmingProposalId) {
      return;
    }

    if (isPinAIProposalExpired(proposal, Date.now())) {
      setError(language === "es"
        ? "La cotización venció. Pídele a Pin AI una nueva cotización."
        : "This quote has expired. Ask Pin AI for a new quote.");
      return;
    }

    setError(null);
    setConfirmingProposalId(proposal.proposalId);

    try {
      const response = await fetch(
        `${apiBase}/api/public-booking/manage/${encodeURIComponent(
          guestToken,
        )}/pin-ai/action-proposals/${encodeURIComponent(proposal.proposalId)}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationToken: proposal.confirmationToken }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as PinAIActionConfirmationResponse | null;

      if (!response.ok || payload?.ok !== true || !payload.action) {
        throw new Error(actionErrorMessage(language, response.status, payload));
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                actionResult: payload.action,
              }
            : message,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : actionErrorMessage(language, 500, null),
      );
    } finally {
      setConfirmingProposalId(null);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || message.length > MAX_MESSAGE_LENGTH || submitting || restoring || historyRecoveryFailed) {
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
          actionProposal: payload.actionProposal,
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

      {historyRecoveryFailed ? (
        <div role="alert" style={styles.safetyNotice}>
          <p>{language === "es"
            ? "No se pudo recuperar la conversación guardada. No la hemos borrado ni reemplazado. Esto no indica que un pago haya fallado; no repitas el pago."
            : "The saved conversation could not be restored. We have not deleted or replaced it. This does not mean a payment failed; do not pay again."}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {language === "es" ? "Reintentar recuperación" : "Retry recovery"}
          </button>
        </div>
      ) : null}

      {restoring || storageUnavailable || restored ? (
        <div role="status" style={styles.safetyNotice}>
          {restoring
            ? (language === "es" ? "Recuperando conversación…" : "Restoring conversation…")
            : storageUnavailable
              ? (language === "es" ? "La copia local no está disponible. Los nuevos mensajes se guardan con tu reserva."
                : "The local copy is unavailable. New messages are saved with your reservation.")
              : (language === "es" ? "Conversación recuperada. Las cotizaciones conservan su vencimiento original."
                : "Conversation restored. Quotes keep their original expiry.")}
        </div>
      ) : null}

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
                {message.role === "assistant" && message.actionProposal ? (
                  <ReservationActionCard
                    language={language}
                    proposal={message.actionProposal}
                    result={message.actionResult}
                    confirming={confirmingProposalId === message.actionProposal.proposalId}
                    onConfirm={() => confirmAction(message.id, message.actionProposal!)}
                    paymentStatusCheck={paymentChecks[message.actionProposal.proposalId]}
                    onPayment={continueToPayment}
                  />
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
          disabled={submitting || restoring || historyRecoveryFailed}
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
            disabled={submitting || restoring || historyRecoveryFailed || draft.trim().length === 0}
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
  actionCard: {
    marginTop: 8,
    borderTop: "1px solid rgba(37,99,235,0.18)",
    paddingTop: 12,
    display: "grid",
    gap: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#1e3a8a",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  actionLabel: {
    display: "block",
    marginBottom: 3,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  actionExpiry: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 1.5,
  },
  actionAvailability: {
    borderRadius: 12,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: "9px 10px",
    fontSize: 11,
    lineHeight: 1.45,
    fontWeight: 750,
  },
  actionOutcome: {
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "9px 10px",
    fontSize: 12,
    fontWeight: 850,
  },
  confirmButton: {
    border: "none",
    borderRadius: 12,
    background: "#2563eb",
    color: "#ffffff",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  paymentLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 950,
    textDecoration: "none",
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
