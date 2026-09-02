import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  INITIAL_PUBLIC_REVIEWS_PAGINATION,
  publicReviewsPaginationReducer,
} from "./lib/publicReviewsPagination.ts";
import {
  canOfferReviewDispute,
  canOfferReviewRejection,
  isReviewModerationReasonAllowed,
  isReviewResponseModerationReasonAllowed,
  reviewResponseModerationActionsForStatus,
} from "./lib/reviewModerationPolicy.ts";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const config = read("./lib/reviewsConfig.ts");
const router = read("./app/routes/router.tsx");
const shell = read("./app/layout/AppShell.tsx");
const api = read("./api/reviews.ts");
const guest = read("./pages/public-booking/GuestReviewPage.tsx");
const property = read("./pages/public-booking/PublicPropertyDetailPage.tsx");
const reputation = read("./pages/reputation/ReputationPage.tsx");
const moderation = read("./pages/admin/AdminReviewModerationPage.tsx");
const publicReviews = read("./components/reviews/PublicReviewsSection.tsx");

test("Reviews E1 presentation is explicitly default-off", () => {
  assert.match(config, /VITE_PINGO_REVIEWS_E1_ENABLED \?\? "false"/);
  assert.match(router, /\.\.\.\(reviewsE1Enabled[\s\S]*?\/review/);
  assert.match(router, /\.\.\.\(reviewsE1Enabled[\s\S]*?\/reputation/);
  assert.match(shell, /reviewsE1Enabled[\s\S]*?Reputation/);
});

test("review secrets stay in the browser fragment and authorization header", () => {
  assert.match(guest, /URLSearchParams\(hash\.replace/);
  assert.match(guest, /window\.history\.replaceState\(window\.history\.state, "", cleanUrl\)/);
  assert.match(api, /Authorization: `ReviewToken \$\{token\}`/);
  assert.match(api, /\/api\/public-reviews\/invitation/);
  assert.match(api, /\/api\/public-reviews\/submissions/);
  assert.doesNotMatch(router, /review\/:reviewToken/);
  assert.doesNotMatch(api, /public-reviews\/\$\{encodeURIComponent\(token\)\}/);
  assert.doesNotMatch(guest, /\b(?:localStorage|sessionStorage)\b/);
});

test("guest review page is private, bilingual and locked until checkout", () => {
  assert.match(guest, /usePublicNoIndex\(\{ noReferrer: true \}\)/);
  assert.match(guest, /if \(!invitation\.canSubmit\)/);
  assert.match(guest, /availableAt/);
  assert.match(guest, /expiresAt/);
  assert.match(guest, /Estadía verificada por Pin&Go/);
  assert.match(guest, /Stay verified by Pin&Go/);
  assert.match(guest, /setRefreshAttempt\(\(current\) => current \+ 1\)/);
  assert.match(guest, /Math\.min\(remaining \+ 1_000, 24 \* 60 \* 60 \* 1_000\)/);
  assert.match(guest, /window\.addEventListener\("focus", refresh\)/);
  assert.match(guest, /Conserva este correo de invitación a evaluar/);
  assert.match(guest, /Keep this review invitation email/);
  assert.match(guest, /setRefreshAttempt\(\(current\) => current \+ 1\)/);
  assert.match(guest, /Intentar nuevamente/);
  assert.match(guest, /Try again/);
  assert.match(guest, /reviewErrorCode\(caught\) === "REVIEW_TOKEN_CONSUMED"/);
  assert.match(guest, /if \(!reviewToken && !invitation\)/);
  assert.match(guest, /Reabre tu correo de invitación a evaluar/);
  assert.match(guest, /Reopen your review invitation email/);
  assert.match(guest, /Si actualizas o cierras esta página/);
  assert.match(guest, /If you refresh or close this page/);
  assert.match(guest, /<aside style=\{emailReminder\}>\{copy\.emailReminder\}<\/aside>/);
});

test("review UI is conditionally lazy-loaded", () => {
  assert.match(router, /lazy\(\(\) => import\("\.\.\/\.\.\/pages\/public-booking\/GuestReviewPage"\)\)/);
  assert.match(router, /lazy\(\(\) => import\("\.\.\/\.\.\/pages\/reputation\/ReputationPage"\)\)/);
  assert.match(property, /const PublicReviewsSection = lazy/);
  assert.match(property, /reviewsE1Enabled && organizationSlug && propertySlug/);
});

test("host and moderator surfaces expose the enterprise controls", () => {
  assert.match(reputation, /Private guest feedback/);
  assert.match(reputation, /minimum 20 characters/);
  assert.match(reputation, /Load more/);
  assert.match(moderation, /getModerationEvidence/);
  assert.match(moderation, /review\.moderationVersion/);
  assert.match(moderation, /FACTUALLY_CONTRADICTED/);
  assert.match(moderation, /Remove held review/);
  assert.match(moderation, /Host response/);
  assert.match(moderation, /revision \{review\.response\.revision\}/);
  assert.match(moderation, /Evidence \/ decision note/);
  assert.match(moderation, /response\.revision/);
  assert.match(api, /\/response\/moderate/);
  assert.match(api, /expectedRevision/);
});

test("host-response moderation exposes only valid transitions and objective reasons", () => {
  assert.deepEqual(reviewResponseModerationActionsForStatus("PUBLISHED"), ["HOLD"]);
  assert.deepEqual(reviewResponseModerationActionsForStatus("HELD_FOR_REVIEW"), ["PUBLISH", "REMOVE"]);
  assert.deepEqual(reviewResponseModerationActionsForStatus("REMOVED"), ["HOLD"]);

  assert.equal(isReviewResponseModerationReasonAllowed("PUBLISH", "AUTOMATED_SAFETY_CLEAR"), true);
  assert.equal(isReviewResponseModerationReasonAllowed("PUBLISH", "OTHER_POLICY"), false);
  assert.equal(isReviewResponseModerationReasonAllowed("HOLD", "AUTOMATED_SAFETY_SIGNAL"), true);
  assert.equal(isReviewResponseModerationReasonAllowed("HOLD", "ROUTINE_LOW_RATING_REVIEW"), false);
  assert.equal(isReviewResponseModerationReasonAllowed("REMOVE", "PII"), true);
  assert.equal(isReviewResponseModerationReasonAllowed("REMOVE", "AUTOMATED_SAFETY_SIGNAL"), false);
  assert.match(moderation, /reviewResponseModerationActionsForStatus\(review\.response\.status\)/);
  assert.match(moderation, /isReviewResponseModerationReasonAllowed\(action, responseDraft\.reason\)/);
});

test("low rating triage cannot justify rejection or removal", () => {
  assert.equal(
    isReviewModerationReasonAllowed("REJECT", "ROUTINE_LOW_RATING_REVIEW"),
    false
  );
  assert.equal(
    isReviewModerationReasonAllowed("REMOVE", "ROUTINE_LOW_RATING_REVIEW"),
    false
  );
  assert.equal(
    isReviewModerationReasonAllowed("PUBLISH", "ROUTINE_LOW_RATING_REVIEW"),
    true
  );
  assert.equal(
    isReviewModerationReasonAllowed("HOLD", "ROUTINE_LOW_RATING_REVIEW"),
    true
  );
  assert.equal(
    isReviewModerationReasonAllowed("REJECT", "AUTOMATED_SAFETY_SIGNAL"),
    false
  );
  assert.equal(
    isReviewModerationReasonAllowed("REMOVE", "OTHER_POLICY"),
    false
  );
  assert.equal(isReviewModerationReasonAllowed("REJECT", "PII"), true);
  assert.match(moderation, /isReviewModerationReasonAllowed\("REJECT"/);
  assert.match(moderation, /isReviewModerationReasonAllowed\("REMOVE"/);
});

test("previously published reviews cannot be offered rejection", () => {
  assert.equal(canOfferReviewRejection("HELD_FOR_REVIEW", null), true);
  assert.equal(
    canOfferReviewRejection(
      "HELD_FOR_REVIEW",
      "2026-09-02T00:00:00.000Z"
    ),
    false
  );
  assert.equal(canOfferReviewRejection("PUBLISHED", null), false);
  assert.equal(canOfferReviewRejection("REJECTED", null), false);
  assert.equal(canOfferReviewRejection("REMOVED", null), false);
  assert.match(moderation, /canOfferReviewRejection\(review\.status, review\.firstPublishedAt\)/);
});

test("rejected and removed reviews cannot offer a host dispute", () => {
  assert.equal(canOfferReviewDispute("PUBLISHED"), true);
  assert.equal(canOfferReviewDispute("PENDING_MODERATION"), true);
  assert.equal(canOfferReviewDispute("REJECTED"), false);
  assert.equal(canOfferReviewDispute("REMOVED"), false);
  assert.match(reputation, /canOfferReviewDispute\(review\.status\)/);
});

test("a failed load-more retries the same page instead of skipping it", () => {
  const firstPageLoaded = publicReviewsPaginationReducer(
    INITIAL_PUBLIC_REVIEWS_PAGINATION,
    { type: "SUCCEEDED", page: 1 }
  );
  const pageTwoRequested = publicReviewsPaginationReducer(firstPageLoaded, {
    type: "REQUEST_NEXT",
  });
  assert.equal(pageTwoRequested.request.page, 2);

  const pageTwoFailed = publicReviewsPaginationReducer(pageTwoRequested, {
    type: "FAILED",
    message: "LOAD_MORE_FAILED",
  });
  assert.equal(pageTwoFailed.loadedPage, 1);
  assert.equal(pageTwoFailed.loadMoreError, "LOAD_MORE_FAILED");

  const pageTwoRetried = publicReviewsPaginationReducer(pageTwoFailed, {
    type: "REQUEST_NEXT",
  });
  assert.equal(pageTwoRetried.request.page, 2);
  assert.ok(
    pageTwoRetried.request.attempt > pageTwoRequested.request.attempt
  );
  assert.equal(pageTwoRetried.loadMoreError, "");
  assert.match(publicReviews, /role="alert"/);
  assert.match(publicReviews, /Retry reviews/);
});

test("Most relevant remains deferred until an auditable server signal exists", () => {
  assert.match(api, /PublicReviewSort = "RECENT" \| "HIGHEST" \| "LOWEST"/);
  assert.doesNotMatch(api, /"RELEVANT"/);
  assert.doesNotMatch(publicReviews, /value="RELEVANT"/);
});
