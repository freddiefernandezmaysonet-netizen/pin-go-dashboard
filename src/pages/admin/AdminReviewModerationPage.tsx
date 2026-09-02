import { useCallback, useEffect, useState } from "react";
import {
  getModerationQueue,
  getModerationEvidence,
  moderateReview,
  moderateReviewResponse,
  type ModerationReview,
  type ReviewOperationalEvidence,
} from "../../api/reviews";
import {
  canOfferReviewRejection,
  isReviewModerationReasonAllowed,
  isReviewResponseModerationReasonAllowed,
  normalizeReviewModerationReason,
  normalizeReviewResponseModerationReason,
  REVIEW_MODERATION_REASON_OPTIONS,
  REVIEW_RESPONSE_MODERATION_REASON_OPTIONS,
  reviewResponseModerationActionsForStatus,
  type ReviewModerationAction,
  type ReviewModerationReason,
  type ReviewResponseModerationAction,
  type ReviewResponseStatus,
} from "../../lib/reviewModerationPolicy";

type DecisionDraft = {
  reason: ReviewModerationReason;
  note: string;
  evidenceReference: string;
};
type ReviewDecisionButtonAction = Exclude<ReviewModerationAction, "UPHOLD">;
type ResponseDecisionDraft = {
  reason: ReviewModerationReason;
  note: string;
};

export default function AdminReviewModerationPage() {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyReviewId, setBusyReviewId] = useState("");
  const [busyResponseReviewId, setBusyResponseReviewId] = useState("");
  const [evidenceLoadingId, setEvidenceLoadingId] = useState("");
  const [operationalEvidence, setOperationalEvidence] = useState<Record<string, ReviewOperationalEvidence>>({});
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});
  const [responseDrafts, setResponseDrafts] = useState<Record<string, ResponseDecisionDraft>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (signal?: AbortSignal, requestedPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const result = await getModerationQueue(requestedPage, 50, signal);
      setReviews((current) => append ? [...current, ...result.reviews] : result.reviews);
      setDrafts((current) => {
        const next = { ...current };
        for (const review of result.reviews) {
          if (!next[review.id]) {
            next[review.id] = {
              reason: normalizeReviewModerationReason(
                review.moderationCases[0]?.reasonCode
              ),
              note: "",
              evidenceReference: "",
            };
          }
        }
        return next;
      });
      setResponseDrafts((current) => {
        const next = { ...current };
        for (const review of result.reviews) {
          if (review.response && !next[review.id]) {
            next[review.id] = defaultResponseDraft(review.response.status);
          }
        }
        return next;
      });
      setPage(result.page);
      setTotal(result.total);
      setError("");
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Unable to load moderation queue.");
    } finally {
      if (!signal?.aborted) setLoading(false);
      if (append) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function draftFor(reviewId: string): DecisionDraft {
    return drafts[reviewId] ?? { reason: "OTHER_POLICY", note: "", evidenceReference: "" };
  }

  function updateDraft(reviewId: string, patch: Partial<DecisionDraft>) {
    setDrafts((current) => ({ ...current, [reviewId]: { ...(current[reviewId] ?? { reason: "OTHER_POLICY", note: "", evidenceReference: "" }), ...patch } }));
  }

  function responseDraftFor(review: ModerationReview): ResponseDecisionDraft {
    return responseDrafts[review.id] ?? defaultResponseDraft(review.response?.status ?? "PUBLISHED");
  }

  function updateResponseDraft(reviewId: string, patch: Partial<ResponseDecisionDraft>) {
    setResponseDrafts((current) => ({
      ...current,
      [reviewId]: {
        ...(current[reviewId] ?? defaultResponseDraft("PUBLISHED")),
        ...patch,
      },
    }));
  }

  async function loadEvidence(reviewId: string) {
    setEvidenceLoadingId(reviewId);
    setError("");
    try {
      const result = await getModerationEvidence(reviewId);
      setOperationalEvidence((current) => ({ ...current, [reviewId]: result.evidence }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to load operational evidence.");
    } finally {
      setEvidenceLoadingId("");
    }
  }

  async function decide(
    review: ModerationReview,
    action: ReviewDecisionButtonAction
  ) {
    const draft = draftFor(review.id);
    if (!isReviewModerationReasonAllowed(action, draft.reason)) {
      setError(
        "Triage, automated and catch-all reasons cannot suppress a review. Choose a concrete evidence-based integrity or content-policy reason."
      );
      return;
    }
    if ((action === "REJECT" || action === "HOLD" || action === "REMOVE") && draft.note.trim().length < 20) {
      setError("Reject, hold and remove decisions require a clear note of at least 20 characters.");
      return;
    }
    if (
      action === "PUBLISH" &&
      review.moderationCases[0]?.reasonCode === "AUTOMATED_SAFETY_SIGNAL" &&
      draft.note.trim().length < 20
    ) {
      setError("Publishing content with a safety signal requires an override note of at least 20 characters.");
      return;
    }
    if (draft.reason === "FACTUALLY_CONTRADICTED" && !draft.evidenceReference.trim()) {
      setError("Factual contradiction requires a positive evidence reference.");
      return;
    }
    setBusyReviewId(review.id);
    setError("");
    try {
      const actionToSend =
        action === "PUBLISH" && review.status === "PUBLISHED"
          ? "UPHOLD"
          : action;
      await moderateReview(
        review.id,
        actionToSend,
        draft.reason,
        draft.note.trim(),
        draft.evidenceReference.trim()
          ? { reference: draft.evidenceReference.trim() }
          : undefined,
        review.moderationVersion
      );
      await load(undefined, 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Moderation failed.");
    } finally {
      setBusyReviewId("");
    }
  }

  async function decideResponse(
    review: ModerationReview,
    action: ReviewResponseModerationAction
  ) {
    const response = review.response;
    if (!response) return;
    if (!reviewResponseModerationActionsForStatus(response.status).includes(action)) {
      setError("This host-response action is no longer valid. Refresh and try again.");
      return;
    }
    const draft = responseDraftFor(review);
    if (!isReviewResponseModerationReasonAllowed(action, draft.reason)) {
      setError("Choose an evidence-based reason allowed for this host-response action.");
      return;
    }
    if (draft.note.trim().length < 20) {
      setError("Host-response moderation requires an evidence summary of at least 20 characters.");
      return;
    }
    setBusyResponseReviewId(review.id);
    setError("");
    try {
      await moderateReviewResponse(
        review.id,
        action,
        draft.reason,
        draft.note.trim(),
        response.revision
      );
      setResponseDrafts((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      await load(undefined, 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Host-response moderation failed.");
    } finally {
      setBusyResponseReviewId("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0 }}>Review Moderation</h1>
        <p style={{ color: "#64748b" }}>
          Evidence-based queue. Negative sentiment alone is never a rejection reason.
        </p>
      </header>
      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
      {loading ? <div style={card}>Loading moderation evidence…</div> : null}
      {!loading && reviews.length === 0 ? <div style={card}>No reviews require moderation.</div> : null}
      {reviews.map((review) => {
        const draft = draftFor(review.id);
        const activeCase = review.moderationCases[0];
        const evidence = operationalEvidence[review.id];
        const evidenceOptions = evidence ? buildEvidenceOptions(evidence) : [];
        const adverseDecisionRestriction =
          !isReviewModerationReasonAllowed("REJECT", draft.reason);
        const responseDraft = responseDraftFor(review);
        const responseActions = review.response
          ? reviewResponseModerationActionsForStatus(review.response.status)
          : [];
        const responseReasonOptions = REVIEW_RESPONSE_MODERATION_REASON_OPTIONS.filter(
          (reason) => responseActions.some((action) =>
            isReviewResponseModerationReasonAllowed(action, reason)
          )
        );
        return (
          <article key={review.id} style={reviewCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{review.property.name}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{review.property.organization.name}</div>
              </div>
              <span style={statusBadge}>{review.status.replaceAll("_", " ")}</span>
            </div>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              Reservation {review.reservation.reservationNumber ?? "—"} · {formatDate(review.reservation.checkIn)}–{formatDate(review.reservation.checkOut)}
            </p>
            <div aria-label={`${review.overallRating} out of 5 stars`} style={{ color: "#c58b25", fontSize: 20 }}>{"★".repeat(review.overallRating)}</div>
            <p style={{ lineHeight: 1.6, overflowWrap: "anywhere" }}>{review.publicComment}</p>
            <small>Verified stay · {review.guestDisplayName}</small>
            {review.response ? (
              <section style={responseModerationPanel} aria-label="Host response moderation">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>Host response</strong>
                  <span style={statusBadge}>
                    {review.response.status.replaceAll("_", " ")} · revision {review.response.revision}
                  </span>
                </div>
                <blockquote style={responseBody}>{review.response.body}</blockquote>
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  Moderation preserves this exact body in the append-only revision. Use the operational evidence below and document the decision.
                </p>
                <div style={decisionGrid}>
                  <label>
                    Response reason code
                    <select
                      value={responseDraft.reason}
                      onChange={(event) => updateResponseDraft(review.id, {
                        reason: normalizeReviewResponseModerationReason(
                          event.target.value,
                          defaultResponseDraft(review.response!.status).reason
                        ),
                      })}
                      style={field}
                    >
                      {responseReasonOptions.map((reason) => <option key={reason}>{reason}</option>)}
                    </select>
                  </label>
                  <label>
                    Evidence / decision note (minimum 20 characters)
                    <textarea
                      value={responseDraft.note}
                      onChange={(event) => updateResponseDraft(review.id, { note: event.target.value })}
                      maxLength={5000}
                      style={{ ...field, minHeight: 86 }}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {responseActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={
                        busyResponseReviewId === review.id ||
                        responseDraft.note.trim().length < 20 ||
                        !isReviewResponseModerationReasonAllowed(action, responseDraft.reason)
                      }
                      onClick={() => void decideResponse(review, action)}
                      style={action === "REMOVE" ? reject : action === "PUBLISH" ? approve : neutral}
                    >
                      {responseActionLabel(review.response!.status, action)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            {activeCase ? (
              <section style={evidencePanel} aria-label="Moderation evidence">
                <strong>Current case: {activeCase.reasonCode.replaceAll("_", " ")}</strong>
                {activeCase.evidence ? <pre style={preStyle}>{safeJson(activeCase.evidence)}</pre> : null}
                {activeCase.events?.map((event) => (
                  <div key={event.id} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                    <strong>{event.action.replaceAll("_", " ")}</strong>
                    {event.note ? <p style={{ margin: "4px 0", overflowWrap: "anywhere" }}>{event.note}</p> : null}
                    {event.evidence ? <pre style={preStyle}>{safeJson(event.evidence)}</pre> : null}
                  </div>
                ))}
              </section>
            ) : null}
            <section style={evidencePanel} aria-label="Pin&Go operational evidence">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong>Pin&Go operational evidence</strong>
                <button type="button" disabled={evidenceLoadingId === review.id} onClick={() => void loadEvidence(review.id)} style={neutral}>
                  {evidenceLoadingId === review.id ? "Loading…" : evidence ? "Refresh evidence" : "Load evidence"}
                </button>
              </div>
              {evidence ? <EvidenceSummary evidence={evidence} /> : <p style={{ color: "#64748b", marginBottom: 0 }}>Load a fresh server-side snapshot before deciding factual claims.</p>}
            </section>
            <div style={decisionGrid}>
              <label>Reason code<select value={draft.reason} onChange={(event) => updateDraft(review.id, { reason: normalizeReviewModerationReason(event.target.value) })} style={field}>{REVIEW_MODERATION_REASON_OPTIONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
              <label>Decision note<textarea value={draft.note} onChange={(event) => updateDraft(review.id, { note: event.target.value })} maxLength={5000} style={{ ...field, minHeight: 86 }} /></label>
              <label>Positive evidence reference<select value={draft.evidenceReference} onChange={(event) => updateDraft(review.id, { evidenceReference: event.target.value })} style={field} disabled={!evidence}><option value="">Select verified evidence</option>{evidenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            {adverseDecisionRestriction ? (
              <p id={`review-${review.id}-adverse-policy`} style={policyNote}>
                This is a triage or catch-all reason. It may support publication
                or further review, but cannot justify rejection or removal.
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button disabled={busyReviewId === review.id} onClick={() => void decide(review, "PUBLISH")} style={approve}>{review.status === "PUBLISHED" ? "Uphold publication" : "Publish"}</button>
              <button disabled={busyReviewId === review.id} onClick={() => void decide(review, "HOLD")} style={neutral}>Keep on hold</button>
              {canOfferReviewRejection(review.status, review.firstPublishedAt) ? <button aria-describedby={adverseDecisionRestriction ? `review-${review.id}-adverse-policy` : undefined} disabled={busyReviewId === review.id || !isReviewModerationReasonAllowed("REJECT", draft.reason)} onClick={() => void decide(review, "REJECT")} style={reject}>Reject with evidence</button> : null}
              {review.status === "HELD_FOR_REVIEW" && review.firstPublishedAt ? <button aria-describedby={adverseDecisionRestriction ? `review-${review.id}-adverse-policy` : undefined} disabled={busyReviewId === review.id || !isReviewModerationReasonAllowed("REMOVE", draft.reason)} onClick={() => void decide(review, "REMOVE")} style={reject}>Remove held review</button> : null}
            </div>
          </article>
        );
      })}
      {reviews.length < total ? (
        <button type="button" disabled={loadingMore} onClick={() => void load(undefined, page + 1, true)} style={loadMoreButton}>
          {loadingMore ? "Loading…" : `Load more (${reviews.length} of ${total})`}
        </button>
      ) : null}
    </div>
  );
}

function buildEvidenceOptions(evidence: ReviewOperationalEvidence) {
  return [
    { value: evidence.reservation.id, label: `Reservation · ${evidence.reservation.reservationNumber ?? evidence.reservation.id}` },
    ...(evidence.guestJourney ? [{ value: evidence.guestJourney.id, label: `Guest journey · ${evidence.guestJourney.currentState}` }] : []),
    ...evidence.access.map((item) => ({ value: item.id, label: `Access · ${item.method} · ${item.status} · ${formatDateTime(item.createdAt)}` })),
    ...evidence.communications.map((item) => ({ value: item.id, label: `Communication · ${item.communicationType ?? item.channel} · ${item.status ?? "UNKNOWN"} · ${formatDateTime(item.createdAt)}` })),
    ...evidence.apmsAudit.map((item) => ({ value: item.id, label: `APMS · ${item.eventType} · ${item.status} · ${formatDateTime(item.createdAt)}` })),
  ];
}

function EvidenceSummary({ evidence }: { evidence: ReviewOperationalEvidence }) {
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, color: "#475569" }}>
        {evidence.reservation.source} / {evidence.reservation.externalProvider} · {evidence.reservation.paymentState} · generated {formatDateTime(evidence.generatedAt)}
      </div>
      {evidence.guestJourney ? <div><strong>Guest journey:</strong> {evidence.guestJourney.currentState}</div> : null}
      <details><summary>Access evidence ({evidence.access.length})</summary><EvidenceList items={evidence.access.map((item) => `${item.method} · ${item.status} · ${formatDateTime(item.createdAt)} · ${item.id}`)} /></details>
      <details><summary>Communications ({evidence.communications.length}{evidence.coverage.communicationsLimited ? "+" : ""})</summary><EvidenceList items={evidence.communications.map((item) => `${item.communicationType ?? item.channel} · ${item.status ?? "UNKNOWN"} · ${formatDateTime(item.createdAt)} · ${item.id}`)} /></details>
      <details><summary>APMS audit ({evidence.apmsAudit.length}{evidence.coverage.apmsAuditLimited ? "+" : ""})</summary><EvidenceList items={evidence.apmsAudit.map((item) => `${item.eventType} · ${item.status} · ${formatDateTime(item.createdAt)} · ${item.id}`)} /></details>
    </div>
  );
}

function EvidenceList({ items }: { items: string[] }) {
  const visible = items.slice(-100).reverse();
  return visible.length ? <ul style={{ marginBottom: 0 }}>{visible.map((item) => <li key={item} style={{ overflowWrap: "anywhere", marginTop: 5 }}>{item}</li>)}</ul> : <p>No records.</p>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)); }
function safeJson(value: unknown) { try { return JSON.stringify(value, null, 2); } catch { return "Evidence unavailable"; } }
function defaultResponseDraft(status: ReviewResponseStatus): ResponseDecisionDraft {
  return {
    reason: status === "HELD_FOR_REVIEW" ? "AUTOMATED_SAFETY_CLEAR" : "AUTOMATED_SAFETY_SIGNAL",
    note: "",
  };
}
function responseActionLabel(status: ReviewResponseStatus, action: ReviewResponseModerationAction) {
  if (action === "PUBLISH") return "Publish host response";
  if (action === "REMOVE") return "Remove host response";
  return status === "REMOVED" ? "Reopen response on hold" : "Hold host response";
}
const card: React.CSSProperties = { padding: 20, border: "1px solid #e2e8f0", borderRadius: 14, background: "white" };
const reviewCard: React.CSSProperties = { ...card, contentVisibility: "auto", containIntrinsicSize: "0 760px" };
const statusBadge: React.CSSProperties = { padding: "5px 9px", borderRadius: 99, background: "#eef2ff", color: "#3730a3", fontSize: 11, fontWeight: 750 };
const evidencePanel: React.CSSProperties = { marginTop: 16, padding: 14, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc" };
const responseModerationPanel: React.CSSProperties = { marginTop: 16, padding: 14, border: "1px solid #a5b4fc", borderRadius: 10, background: "#eef2ff" };
const responseBody: React.CSSProperties = { margin: "12px 0", padding: "10px 12px", borderLeft: "3px solid #6366f1", background: "white", overflowWrap: "anywhere" };
const preStyle: React.CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 };
const decisionGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 };
const policyNote: React.CSSProperties = { margin: "12px 0 0", padding: 10, borderRadius: 8, background: "#fff7ed", color: "#9a3412", fontSize: 13 };
const field: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #cbd5e1", borderRadius: 8 };
const button: React.CSSProperties = { border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const approve = { ...button, background: "#166534", color: "white" };
const neutral = { ...button, background: "#e2e8f0", color: "#334155" };
const reject = { ...button, background: "#991b1b", color: "white" };
const loadMoreButton: React.CSSProperties = { ...button, justifySelf: "center", border: "1px solid #94a3b8", background: "white", color: "#334155" };
