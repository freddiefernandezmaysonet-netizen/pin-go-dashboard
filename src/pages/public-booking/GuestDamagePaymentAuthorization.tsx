import { useEffect, useRef, useState } from "react";

type Language = "en" | "es";
type Props = { apiBase: string; guestToken: string; caseId: string; language: Language };
type Terms = {
  damageCaseId: string; version: string; action: string; claimRevision: string;
  amountMinor: number; currency: "usd"; acceptedMaximumMinor: number;
  reportedAmountMinor: number; description: string; evidenceNotes: string | null;
  language: Language; consentText: string; collectionStatus: "NO_CHARGE_MADE";
};
type Authorization = { id: string; authorizedAt: string; amountMinor: number; currency: string; matchesCurrentTerms: boolean };
type State =
  | { kind: "loading" }
  | { kind: "error"; changed: boolean }
  | { kind: "ready"; terms: Terms; authorization: Authorization | null };
const VERSION = "PROPERTY_PROTECTION_PAYMENT_AUTHORIZATION_V1";
const ACTION = "ACCEPT_AND_AUTHORIZE_PAYMENT";
const copy = {
  en: {
    title: "Authorize the exact damage amount", loading: "Loading authorization terms…",
    separate: "Accepting the report does not authorize payment. Review these terms before giving separate permission to charge your saved payment method.",
    noCharge: "No charge has been made. Recording this authorization does not make a charge.",
    approved: "Amount to authorize", maximum: "Accepted maximum liability", reported: "Reported amount",
    description: "Description", evidence: "Documented evidence", consent: "I have read the terms above and explicitly authorize this exact amount.",
    submit: "Record payment authorization", sending: "Recording authorization…", retry: "Refresh authorization status",
    error: "We could not confirm the authorization status. Refresh to check before trying again.",
    changed: "These terms are no longer available or have changed. Refresh and review them again before authorizing.",
    saved: "Payment authorization recorded", previous: "A previous authorization is on record, but it does not match the current terms. No new authorization can be recorded here.",
  },
  es: {
    title: "Autorizar el importe exacto por daños", loading: "Cargando los términos de autorización…",
    separate: "Aceptar el reporte no autoriza un pago. Revisa estos términos antes de dar permiso por separado para cobrar a tu método de pago guardado.",
    noCharge: "No se ha realizado ningún cargo. Registrar esta autorización no realiza un cargo.",
    approved: "Importe a autorizar", maximum: "Responsabilidad máxima aceptada", reported: "Monto reportado",
    description: "Descripción", evidence: "Evidencia documentada", consent: "He leído los términos anteriores y autorizo expresamente este importe exacto.",
    submit: "Registrar autorización de pago", sending: "Registrando autorización…", retry: "Actualizar estado de autorización",
    error: "No pudimos confirmar el estado de la autorización. Actualiza para verificarlo antes de intentarlo de nuevo.",
    changed: "Estos términos cambiaron o ya no están disponibles. Actualiza y revísalos de nuevo antes de autorizar.",
    saved: "Autorización de pago registrada", previous: "Existe una autorización anterior, pero no coincide con los términos actuales. No se puede registrar una nueva autorización aquí.",
  },
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
function validAuthorization(value: unknown): value is Authorization {
  return record(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.authorizedAt === "string" && Number.isFinite(Date.parse(value.authorizedAt)) &&
    positive(value.amountMinor) && value.currency === "usd" && typeof value.matchesCurrentTerms === "boolean";
}
function parsePreview(value: unknown, caseId: string, language: Language): State {
  if (!record(value) || value.ok !== true || !record(value.terms)) throw new Error("Invalid terms");
  const t = value.terms;
  if (t.damageCaseId !== caseId || t.version !== VERSION || t.action !== ACTION ||
      typeof t.claimRevision !== "string" || !/^[a-f0-9]{64}$/.test(t.claimRevision) ||
      !positive(t.amountMinor) || !positive(t.acceptedMaximumMinor) || !positive(t.reportedAmountMinor) ||
      t.amountMinor > t.acceptedMaximumMinor || t.amountMinor > t.reportedAmountMinor ||
      t.currency !== "usd" || t.language !== language || t.collectionStatus !== "NO_CHARGE_MADE" ||
      typeof t.description !== "string" || (t.evidenceNotes !== null && typeof t.evidenceNotes !== "string") ||
      typeof t.consentText !== "string" || !t.consentText.trim()) throw new Error("Invalid terms");
  if (value.authorization !== null && (!validAuthorization(value.authorization) ||
      (value.authorization.matchesCurrentTerms && value.authorization.amountMinor !== t.amountMinor))) throw new Error("Invalid authorization");
  return { kind: "ready", terms: t as Terms, authorization: value.authorization as Authorization | null };
}

// Reset all consent and requests when the guest, case or displayed language changes.
export function GuestDamagePaymentAuthorization(props: Props) {
  return <AuthorizationForm key={JSON.stringify([props.apiBase, props.guestToken, props.caseId, props.language])} {...props} />;
}
function AuthorizationForm({ apiBase, guestToken, caseId, language }: Props) {
  const text = copy[language];
  const [state, setState] = useState<State>({ kind: "loading" });
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const url = `${apiBase.replace(/\/$/, "")}/api/public-booking/manage/${encodeURIComponent(guestToken)}/property-protection-case/payment-authorization`;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      try {
        const response = await fetch(`${url}?language=${language}`, { cache: "no-store", signal: controller.signal, referrerPolicy: "no-referrer" });
        if (!response.ok) {
          if (current) setState({ kind: "error", changed: response.status === 409 });
          return;
        }
        const next = parsePreview(await response.json(), caseId, language);
        if (current) setState(next);
      } catch {
        if (current) setState({ kind: "error", changed: false });
      }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [url, caseId, language, attempt]);

  function refresh() {
    if (submitting.current) return;
    setChecked(false); setState({ kind: "loading" }); setAttempt(value => value + 1);
  }
  async function authorize() {
    if (submitting.current || !checked || state.kind !== "ready" || state.authorization) return;
    submitting.current = true; setSending(true);
    const terms = state.terms;
    try {
      const { action, version, claimRevision, amountMinor, currency, language: consentLanguage } = terms;
      const response = await fetch(url, {
        method: "POST", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version, claimRevision, amountMinor, currency, language: consentLanguage, consent: true }),
      });
      if (!response.ok) {
        if (mounted.current) setState({ kind: "error", changed: response.status === 409 });
        return;
      }
      const result: unknown = await response.json();
      if (!record(result) || result.ok !== true || result.collectionStatus !== "NO_CHARGE_MADE" ||
          !record(result.authorization) || result.authorization.claimRevision !== claimRevision ||
          result.authorization.amountMinor !== amountMinor || result.authorization.currency !== currency ||
          !validAuthorization({ ...result.authorization, matchesCurrentTerms: true })) throw new Error("Unconfirmed result");
      if (mounted.current) setState({ kind: "ready", terms, authorization: { ...result.authorization, matchesCurrentTerms: true } as Authorization });
    } catch {
      if (mounted.current) setState({ kind: "error", changed: false });
    } finally {
      submitting.current = false;
      if (mounted.current) { setSending(false); setChecked(false); }
    }
  }
  const money = (minor: number) => new Intl.NumberFormat(language === "es" ? "es-PR" : "en-US", { style: "currency", currency: "USD" }).format(minor / 100) + " USD";
  return <section aria-label={text.title} lang={language} style={{ borderTop: "1px solid #dbe2ea", marginTop: 24, paddingTop: 20 }}>
    <h3>{text.title}</h3>
    <p>{text.separate}</p>
    <p style={{ fontWeight: 600 }}>{text.noCharge}</p>
    {state.kind === "loading" ? <p role="status">{text.loading}</p> : state.kind === "error" ? <>
      <p role="alert">{state.changed ? text.changed : text.error}</p>
      <button type="button" onClick={refresh}>{text.retry}</button>
    </> : state.authorization ? <div role="status">
      <p>{state.authorization.matchesCurrentTerms ? text.saved : text.previous}</p>
      <p><strong>{money(state.authorization.amountMinor)}</strong> · {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.authorization.authorizedAt))}</p>
    </div> : <>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {[[text.reported, state.terms.reportedAmountMinor], [text.approved, state.terms.amountMinor], [text.maximum, state.terms.acceptedMaximumMinor]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{money(amount as number)}</dd></div>)}
      </dl>
      <p><strong>{text.description}</strong></p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{state.terms.description}</p>
      {state.terms.evidenceNotes ? <><p><strong>{text.evidence}</strong></p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{state.terms.evidenceNotes}</p></> : null}
      <p style={{ padding: 16, borderRadius: 12, background: "#eff6ff", color: "#1e3a8a" }}>{state.terms.consentText}</p>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "16px 0" }}>
        <input type="checkbox" checked={checked} disabled={sending} onChange={event => setChecked(event.target.checked)} />
        <span>{text.consent}</span>
      </label>
      <button type="button" disabled={!checked || sending} onClick={authorize} style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: checked && !sending ? "#2563eb" : "#64748b", color: "white", cursor: checked && !sending ? "pointer" : "not-allowed" }}>
        {sending ? text.sending : `${text.submit} · ${money(state.terms.amountMinor)}`}
      </button>
    </>}
  </section>;
}
