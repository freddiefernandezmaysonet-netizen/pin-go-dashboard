import { useCallback, useEffect, useState } from "react";
import {
  disputeReview,
  getDashboardReviews,
  respondToReview,
  type DashboardReview,
  type ReputationSummary,
} from "../../api/reviews";
import { canOfferReviewDispute } from "../../lib/reviewModerationPolicy";

export default function ReputationPage() {
  const [reviews, setReviews] = useState<DashboardReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyReviewId, setBusyReviewId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<ReputationSummary>({ overallRating: null, publishedCount: 0, awaitingResponse: 0, responseRate: null, underReview: 0, ratingTrend: null });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [disputeReviewId, setDisputeReviewId] = useState("");
  const [disputeNote, setDisputeNote] = useState("");
  const [editingResponseId, setEditingResponseId] = useState("");

  const load = useCallback(async (signal?: AbortSignal, requestedPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const result = await getDashboardReviews(requestedPage, 50, signal);
      setReviews((current) => append ? [...current, ...result.reviews] : result.reviews);
      setSummary(result.summary);
      setPage(result.page);
      setTotal(result.total);
      setError("");
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(
        caught instanceof Error ? caught.message : "Unable to load reputation."
      );
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

  async function reply(reviewId: string) {
    const body = (drafts[reviewId] ?? "").trim();
    if (!body) {
      setError("Write a response before publishing it.");
      return;
    }
    setBusyReviewId(reviewId);
    setError("");
    try {
      await respondToReview(reviewId, body);
      setDrafts((current) => ({ ...current, [reviewId]: "" }));
      setEditingResponseId("");
      await load(undefined, 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to respond.");
    } finally {
      setBusyReviewId("");
    }
  }

  async function submitDispute(reviewId: string) {
    if (disputeNote.trim().length < 20) {
      setError("A dispute needs an evidence summary of at least 20 characters.");
      return;
    }
    setBusyReviewId(reviewId);
    setError("");
    try {
      await disputeReview(reviewId, disputeNote.trim());
      setDisputeReviewId("");
      setDisputeNote("");
      await load(undefined, 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to dispute.");
    } finally {
      setBusyReviewId("");
    }
  }

  if (loading) return <p>Loading reputation…</p>;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header>
        <h1 style={{ margin: 0 }}>Reputation</h1>
        <p style={{ color: "#64748b" }}>
          Verified guest reviews, private feedback and evidence-based moderation.
        </p>
      </header>
      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
      <section style={stats} aria-label="Reputation summary">
        <Stat label="Overall rating" value={summary.overallRating !== null ? `${Number(summary.overallRating).toFixed(1)} ★` : "—"} />
        <Stat label="Published reviews" value={summary.publishedCount} />
        <Stat label="Awaiting response" value={summary.awaitingResponse} />
        <Stat label="Response rate" value={summary.responseRate === null ? "—" : `${summary.responseRate.toFixed(1)}%`} />
        <Stat label="Under review" value={summary.underReview} />
        <Stat label="30-day rating trend" value={summary.ratingTrend === null ? "—" : `${summary.ratingTrend > 0 ? "+" : ""}${summary.ratingTrend.toFixed(2)}`} />
      </section>
      <section style={{ display: "grid", gap: 14 }} aria-label="Guest reviews">
        {reviews.length === 0 ? <article style={card}>No guest reviews yet.</article> : null}
        {reviews.map((review) => {
          const evidenceSubmitted = review.moderationCases[0]?.status === "DISPUTED";
          const canDispute = canOfferReviewDispute(review.status);
          return <article key={review.id} style={reviewCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{review.property.name}</strong>
                <div aria-label={`${review.overallRating} out of 5 stars`} style={{ color: "#d28e17", fontSize: 20 }}>
                  {"★".repeat(review.overallRating)}
                </div>
              </div>
              <span style={badge}>{review.status.replaceAll("_", " ")}</span>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, overflowWrap: "anywhere" }}>{review.publicComment}</p>
            <small style={{ color: "#64748b" }}>Verified stay · {review.guestDisplayName}</small>
            {review.privateFeedback ? (
              <aside style={privateFeedbackStyle}>
                <strong>Private guest feedback</strong>
                <p style={{ marginBottom: 0, overflowWrap: "anywhere" }}>{review.privateFeedback}</p>
              </aside>
            ) : null}
            {review.response && editingResponseId !== review.id ? (
              <aside style={responseStyle}>
                <strong>Host response</strong>
                <p style={{ overflowWrap: "anywhere" }}>{review.response.body}</p>
                <button type="button" onClick={() => { setEditingResponseId(review.id); setDrafts((current) => ({ ...current, [review.id]: review.response?.body ?? "" })); }} style={linkButton}>Edit public response</button>
              </aside>
            ) : review.status === "PUBLISHED" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <input
                  aria-label="Public response"
                  maxLength={2000}
                  placeholder="Write a public response"
                  value={drafts[review.id] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                  style={{ flex: "1 1 280px", padding: 11, border: "1px solid #cbd5e1", borderRadius: 9 }}
                />
                <button disabled={busyReviewId === review.id} onClick={() => void reply(review.id)} style={primary}>
                  {review.response ? "Save response" : "Respond"}
                </button>
                {review.response ? <button type="button" disabled={busyReviewId === review.id} onClick={() => { setEditingResponseId(""); setDrafts((current) => ({ ...current, [review.id]: "" })); }} style={secondary}>Cancel</button> : null}
              </div>
            ) : null}
            {canDispute ? (
              <button disabled={busyReviewId === review.id || evidenceSubmitted} onClick={() => { setDisputeReviewId(review.id); setDisputeNote(""); setError(""); }} style={linkButton}>
                {evidenceSubmitted ? "Evidence submitted" : "Provide evidence / dispute"}
              </button>
            ) : null}
            {canDispute && disputeReviewId === review.id ? (
              <aside style={disputePanel}>
                <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>
                  Evidence or context for the moderation team
                  <textarea
                    autoFocus
                    value={disputeNote}
                    onChange={(event) => setDisputeNote(event.target.value)}
                    maxLength={5000}
                    placeholder="Describe specific facts, dates and the Pin&Go records that can verify them."
                    style={{ minHeight: 110, padding: 11, border: "1px solid #cbd5e1", borderRadius: 9, resize: "vertical" }}
                  />
                </label>
                <small style={{ color: disputeNote.trim().length >= 20 ? "#166534" : "#64748b" }}>{disputeNote.trim().length}/5000 · minimum 20 characters</small>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" disabled={busyReviewId === review.id || disputeNote.trim().length < 20} onClick={() => void submitDispute(review.id)} style={primary}>Submit evidence</button>
                  <button type="button" disabled={busyReviewId === review.id} onClick={() => { setDisputeReviewId(""); setDisputeNote(""); }} style={secondary}>Cancel</button>
                </div>
              </aside>
            ) : null}
          </article>;
        })}
      </section>
      {reviews.length < total ? (
        <button type="button" disabled={loadingMore} onClick={() => void load(undefined, page + 1, true)} style={loadMore}>
          {loadingMore ? "Loading…" : `Load more (${reviews.length} of ${total})`}
        </button>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <article style={card}><span style={{ color: "#64748b", fontSize: 13 }}>{label}</span><strong style={{ display: "block", fontSize: 28, marginTop: 5 }}>{value}</strong></article>;
}

const stats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 };
const card: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 };
const reviewCard: React.CSSProperties = { ...card, contentVisibility: "auto", containIntrinsicSize: "0 420px" };
const badge: React.CSSProperties = { background: "#eef4f0", color: "#28513f", padding: "5px 9px", borderRadius: 99, fontSize: 11, fontWeight: 750 };
const primary: React.CSSProperties = { border: 0, borderRadius: 9, padding: "10px 15px", background: "var(--brand-primary-color,#2563eb)", color: "white", fontWeight: 700 };
const secondary: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 15px", background: "white", color: "#334155", fontWeight: 700 };
const linkButton: React.CSSProperties = { marginTop: 12, border: 0, background: "none", padding: 0, color: "#475569", textDecoration: "underline", cursor: "pointer" };
const loadMore: React.CSSProperties = { justifySelf: "center", border: "1px solid #94a3b8", borderRadius: 999, padding: "10px 18px", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" };
const responseStyle: React.CSSProperties = { marginTop: 14, padding: 14, background: "#f8fafc", borderRadius: 10 };
const privateFeedbackStyle: React.CSSProperties = { marginTop: 14, padding: 14, background: "#fff7e6", border: "1px solid #f2d28b", borderRadius: 10 };
const disputePanel: React.CSSProperties = { marginTop: 14, padding: 14, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10 };
