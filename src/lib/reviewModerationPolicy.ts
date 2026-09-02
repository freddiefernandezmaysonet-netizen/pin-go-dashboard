export const REVIEW_MODERATION_REASON_OPTIONS = [
  "AUTOMATED_SAFETY_CLEAR",
  "OTHER_POLICY",
  "ROUTINE_LOW_RATING_REVIEW",
  "AUTOMATED_SAFETY_SIGNAL",
  "UNVERIFIED_STAY",
  "DUPLICATE",
  "ABUSE_HARASSMENT",
  "THREAT",
  "EXTORTION",
  "PII",
  "SPAM",
  "IRRELEVANT",
  "FACTUALLY_CONTRADICTED",
  "MANIPULATION",
] as const;

export type ReviewModerationReason =
  (typeof REVIEW_MODERATION_REASON_OPTIONS)[number];

export type ReviewModerationAction =
  | "PUBLISH"
  | "UPHOLD"
  | "REJECT"
  | "REMOVE"
  | "HOLD";

export const REVIEW_RESPONSE_MODERATION_REASON_OPTIONS = [
  "AUTOMATED_SAFETY_CLEAR",
  "AUTOMATED_SAFETY_SIGNAL",
  "ABUSE_HARASSMENT",
  "THREAT",
  "EXTORTION",
  "PII",
  "SPAM",
  "IRRELEVANT",
  "FACTUALLY_CONTRADICTED",
  "MANIPULATION",
] as const satisfies readonly ReviewModerationReason[];

export type ReviewResponseModerationAction = "PUBLISH" | "HOLD" | "REMOVE";
export type ReviewResponseStatus = "PUBLISHED" | "HELD_FOR_REVIEW" | "REMOVED";

const CONCRETE_ADVERSE_REASONS = new Set<ReviewModerationReason>([
  "UNVERIFIED_STAY",
  "DUPLICATE",
  "ABUSE_HARASSMENT",
  "THREAT",
  "EXTORTION",
  "PII",
  "SPAM",
  "IRRELEVANT",
  "FACTUALLY_CONTRADICTED",
  "MANIPULATION",
]);

export function normalizeReviewModerationReason(
  value: string | null | undefined
): ReviewModerationReason {
  return REVIEW_MODERATION_REASON_OPTIONS.includes(
    value as ReviewModerationReason
  )
    ? (value as ReviewModerationReason)
    : "OTHER_POLICY";
}

export function isReviewModerationReasonAllowed(
  action: ReviewModerationAction,
  reason: ReviewModerationReason
): boolean {
  return action !== "REJECT" && action !== "REMOVE"
    ? true
    : CONCRETE_ADVERSE_REASONS.has(reason);
}

export function canOfferReviewRejection(
  status: string,
  firstPublishedAt: string | null
): boolean {
  return (
    (status === "PENDING_MODERATION" ||
      status === "HELD_FOR_REVIEW" ||
      status === "DISPUTED") &&
    firstPublishedAt === null
  );
}

export function canOfferReviewDispute(status: string): boolean {
  return status !== "REJECTED" && status !== "REMOVED";
}

const REVIEW_RESPONSE_REASON_MATRIX = {
  PUBLISH: new Set<ReviewModerationReason>(["AUTOMATED_SAFETY_CLEAR"]),
  HOLD: new Set<ReviewModerationReason>([
    "AUTOMATED_SAFETY_SIGNAL",
    "ABUSE_HARASSMENT",
    "THREAT",
    "EXTORTION",
    "PII",
    "SPAM",
    "IRRELEVANT",
    "FACTUALLY_CONTRADICTED",
    "MANIPULATION",
  ]),
  REMOVE: new Set<ReviewModerationReason>([
    "ABUSE_HARASSMENT",
    "THREAT",
    "EXTORTION",
    "PII",
    "SPAM",
    "IRRELEVANT",
    "FACTUALLY_CONTRADICTED",
    "MANIPULATION",
  ]),
} as const;

const REVIEW_RESPONSE_TRANSITIONS = {
  PUBLISHED: ["HOLD"],
  HELD_FOR_REVIEW: ["PUBLISH", "REMOVE"],
  REMOVED: ["HOLD"],
} as const satisfies Readonly<
  Record<ReviewResponseStatus, readonly ReviewResponseModerationAction[]>
>;

export function reviewResponseModerationActionsForStatus(
  status: ReviewResponseStatus
): readonly ReviewResponseModerationAction[] {
  return REVIEW_RESPONSE_TRANSITIONS[status];
}

export function isReviewResponseModerationReasonAllowed(
  action: ReviewResponseModerationAction,
  reason: ReviewModerationReason
): boolean {
  return REVIEW_RESPONSE_REASON_MATRIX[action].has(reason);
}

export function normalizeReviewResponseModerationReason(
  value: string | null | undefined,
  fallback: ReviewModerationReason
): ReviewModerationReason {
  return REVIEW_RESPONSE_MODERATION_REASON_OPTIONS.includes(
    value as (typeof REVIEW_RESPONSE_MODERATION_REASON_OPTIONS)[number]
  )
    ? (value as ReviewModerationReason)
    : fallback;
}
