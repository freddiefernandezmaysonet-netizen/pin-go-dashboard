import { api } from "./client";
import type {
  ReviewModerationAction,
  ReviewModerationReason,
  ReviewResponseModerationAction,
  ReviewResponseStatus,
} from "../lib/reviewModerationPolicy";

export type ReviewStatus =
  | "PENDING_MODERATION"
  | "PUBLISHED"
  | "DISPUTED"
  | "HELD_FOR_REVIEW"
  | "REJECTED"
  | "REMOVED";

export type ReviewAverages = Partial<
  Record<
    | "overallRating"
    | "cleanlinessRating"
    | "accuracyRating"
    | "checkInAccessRating"
    | "communicationRating"
    | "locationRating"
    | "valueRating",
    number | null
  >
>;

export type PublicReview = {
  id: string;
  overallRating: number;
  publicComment: string;
  language: string;
  guestDisplayName: string;
  stayMonth: string;
  publishedAt: string;
  response?: { body: string; publishedAt: string | null } | null;
};

export type ReviewModerationEvent = {
  id: string;
  action: string;
  reasonCode: string | null;
  evidence: unknown;
  note: string | null;
  createdAt: string;
};

export type ReviewModerationCase = {
  id: string;
  status: string;
  reasonCode: string;
  evidence: unknown;
  openedAt: string;
  events?: ReviewModerationEvent[];
};

export type DashboardReviewResponse = {
  id: string;
  body: string;
  status: ReviewResponseStatus;
  publishedAt: string | null;
  revision: number;
};

export type DashboardReview = Omit<PublicReview, "publishedAt" | "response"> & {
  status: ReviewStatus;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  privateFeedback: string | null;
  submittedAt: string;
  moderationVersion: number;
  property: { id: string; name: string };
  moderationCases: ReviewModerationCase[];
  response: DashboardReviewResponse | null;
};

export type ReviewOperationalEvidence = {
  kind: "PIN_GO_REVIEW_MODERATION_EVIDENCE";
  version: string;
  generatedAt: string;
  referenceIds: string[];
  reservation: {
    id: string;
    reservationNumber: string | null;
    source: string | null;
    externalProvider: string | null;
    status: string;
    paymentState: string;
    amountCollected: string;
    amountRefunded: string;
    checkIn: string;
    checkOut: string;
    createdAt: string;
  };
  guestJourney: { id: string; currentState: string; stateChangedAt: string; completedAt: string | null; cancelledAt: string | null } | null;
  access: Array<{ id: string; method: string; status: string; startsAt: string; endsAt: string; createdAt: string; lastAppliedAt: string | null; revokedReason: string | null; lastError: string | null }>;
  communications: Array<{ id: string; channel: string; communicationType: string | null; status: string | null; provider: string | null; providerMessageId: string | null; createdAt: string; error: string | null }>;
  apmsAudit: Array<{ id: string; engine: string; eventType: string; status: string; severity: string; summary: string; createdAt: string }>;
  coverage: { communicationsLimited: boolean; apmsAuditLimited: boolean };
};

export type ModerationReview = Omit<DashboardReview, "property"> & {
  property: {
    id: string;
    name: string;
    organization: { id: string; name: string };
  };
  reservation: {
    reservationNumber: string | null;
    checkIn: string;
    checkOut: string;
  };
};

export type PublicReviewsPayload = {
  total: number;
  page: number;
  pageSize: number;
  sort: PublicReviewSort;
  averages: ReviewAverages;
  reviews: PublicReview[];
};

export type PublicReviewSort = "RECENT" | "HIGHEST" | "LOWEST";

const BASE =
  import.meta.env.VITE_REVIEWS_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

async function publicApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "Unable to load reviews.";
    throw Object.assign(new Error(message), {
      code: payload.error,
      status: response.status,
    });
  }
  return payload as T;
}

export const getReviewInvitation = (token: string, signal?: AbortSignal) =>
  publicApi<{
    ok: true;
    invitation: {
      propertyName: string;
      propertyPhoto: string;
      checkIn: string;
      checkOut: string;
      language: string;
      availableAt: string;
      expiresAt: string;
      canSubmit: boolean;
    };
  }>("/api/public-reviews/invitation", {
    signal,
    headers: { Authorization: `ReviewToken ${token}` },
  });

export const submitReview = (token: string, body: unknown) =>
  publicApi<{ ok: true; review: { id: string; status: string } }>(
    "/api/public-reviews/submissions",
    {
      method: "POST",
      headers: { Authorization: `ReviewToken ${token}` },
      body: JSON.stringify(body),
    }
  );

export const getPublicReviews = (
  organizationSlug: string,
  propertySlug: string,
  page = 1,
  pageSize = 10,
  sort: PublicReviewSort = "RECENT",
  signal?: AbortSignal
) =>
  publicApi<{ ok: true } & PublicReviewsPayload>(
    `/api/public-reviews/property/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}?page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sort)}`,
    { signal }
  );

export type ReputationSummary = {
  overallRating: number | null;
  publishedCount: number;
  awaitingResponse: number;
  responseRate: number | null;
  underReview: number;
  ratingTrend: number | null;
};

export const getDashboardReviews = (page = 1, pageSize = 50, signal?: AbortSignal) =>
  api<{ ok: true; reviews: DashboardReview[]; total: number; page: number; pageSize: number; summary: ReputationSummary }>(`/api/dashboard/reviews?page=${page}&pageSize=${pageSize}`, {
    signal,
  });

export const respondToReview = (id: string, body: string) =>
  api(`/api/dashboard/reviews/${encodeURIComponent(id)}/response`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });

export const disputeReview = (id: string, note: string) =>
  api(`/api/dashboard/reviews/${encodeURIComponent(id)}/disputes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export const getModerationQueue = (page = 1, pageSize = 50, signal?: AbortSignal) =>
  api<{ ok: true; reviews: ModerationReview[]; total: number; page: number; pageSize: number }>(
    `/api/internal/reviews/moderation?page=${page}&pageSize=${pageSize}`,
    { signal }
  );

export const getModerationEvidence = (id: string) =>
  api<{ ok: true; evidence: ReviewOperationalEvidence }>(
    `/api/internal/reviews/moderation/${encodeURIComponent(id)}/evidence`
  );

export const moderateReview = (
  id: string,
  action: ReviewModerationAction,
  reasonCode: ReviewModerationReason,
  note: string,
  evidence: Record<string, unknown> | undefined,
  expectedVersion: number
) =>
  api(`/api/dashboard/reviews/${encodeURIComponent(id)}/moderate`, {
    method: "POST",
    body: JSON.stringify({ action, reasonCode, note, evidence, expectedVersion }),
  });

export const moderateReviewResponse = (
  id: string,
  action: ReviewResponseModerationAction,
  reasonCode: ReviewModerationReason,
  note: string,
  expectedRevision: number
) =>
  api(`/api/dashboard/reviews/${encodeURIComponent(id)}/response/moderate`, {
    method: "POST",
    body: JSON.stringify({ action, reasonCode, note, expectedRevision }),
  });
