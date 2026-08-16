import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useBrand } from "../../branding/BrandProvider";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

type CancellationRefundRule = {
  minHoursBeforeCheckIn: number;
  refundPercent: number;
  label: string;
  description?: string | null;
};

type CancellationPreviewResponse = {
  ok?: boolean;
  managementPhase?: "PRE_STAY" | "IN_STAY" | "POST_STAY" | "CANCELLED";
  cancellationAllowed?: boolean;
  alreadyCancelled?: boolean;
  reservation?: {
    reservationNumber?: string | null;
    propertyName?: string | null;
    guestName?: string | null;
    guestEmail?: string | null;
    checkIn: string;
    checkOut: string;
    status: string;
    paymentState: string;
    totalAmount?: number | null;
    currency?: string | null;
    cancelledAt?: string | null;
  };

  securePreCheckin?: {
    url?: string | null;
    verificationStatus?: string | null;
    identityVerificationStatus?: string | null;
    guestAgreementSignedAt?: string | null;
    accessReleaseStatus?: string | null;
    completed?: boolean;
  };

  policy?: {
    name: string;
    type: string;
    refundBasis: string;
    refundRules: CancellationRefundRule[];
    nonRefundableScenarios: string[];
    guestFacingSummary?: string | null;
    cancellationTermsAcceptance?: {
      text?: string | null;
      source?: string | null;
      version?: string | null;
      accepted?: boolean | null;
      acceptedAt?: string | null;
      refundBasis?: string | null;
    } | null;
  };
  evaluation?: {
    requestedAt: string;
    checkIn: string;
    freeCancellationDeadline: string;
    hoursBeforeCheckIn: number;
    beforeDeadline: boolean;
    refundPercent: number;
    refundAmount: number;
    refundAmountCents: number;
    usesTieredRules: boolean;
    matchedRefundRule?: CancellationRefundRule | null;
    eligibleForGuestSelfCancellation: boolean;
    eligibleForAutoRefund: boolean;
    requiresHostApproval: boolean;
    reason: string;
    breakdown?: {
      totalAmount: number;
      totalAmountCents: number;
      nightlySubtotal: number;
      nightlySubtotalCents: number;
      cleaningFee: number;
      cleaningFeeCents: number;
      amenitiesTotal: number;
      amenitiesTotalCents: number;
      taxesTotal: number;
      taxesTotalCents: number;
      refundableBase: number;
      refundableBaseCents: number;
    } | null;
  };
  action?: string;
  refundExecution?: string;
  refund?: {
    stripeRefundId?: string | null;
    status?: string | null;
    amount?: number | null;
    amountCents?: number | null;
    currency?: string | null;
    reason?: string | null;
    refundMode?: string | null;
    refundPercent?: number | null;
    isFullRefund?: boolean | null;
    refundedAt?: string | null;
  } | null;
  error?: string;
  message?: string;
  details?: CancellationPreviewResponse;
};

type ModificationAmenity = {
  id: string;
  name: string;
  description?: string | null;
  feeType?: string | null;
  amount: number;
};

type ModificationStay = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalGuests: number;
  selectedAmenityIds: string[];
  totalAmount?: number;
  totalAmountCents?: number;
};

type ModificationOptionsResponse = {
  ok?: boolean;
  managementPhase?: "PRE_STAY";
  modificationAllowed?: boolean;
  constraints?: {
    guestCountEditable?: boolean;
    guestCountLockReason?: string | null;
  };
  reservation?: {
    reservationNumber?: string | null;
    version?: string;
    propertyName?: string | null;
    status?: string;
    paymentState?: string;
    currency?: string | null;
    current: ModificationStay;
  };
  property?: {
    timezone?: string | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    maxGuests?: number | null;
    minimumNights?: number | null;
    maximumNights?: number | null;
    optionalAmenities: ModificationAmenity[];
  };
  error?: string;
  message?: string;
};

type ModificationPreviewResponse = ModificationOptionsResponse & {
  reservation?: NonNullable<ModificationOptionsResponse["reservation"]> & {
    proposed: ModificationStay;
  };
  changes?: {
    datesChanged?: boolean;
    guestsChanged?: boolean;
    amenitiesChanged?: boolean;
    hasChanges?: boolean;
    requiresSecurePreCheckinRefresh?: boolean;
  };
  pricing?: {
    currentTotalAmount: number;
    currentTotalAmountCents: number;
    proposed: {
      currency?: string | null;
      nights?: number;
      nightlySubtotal?: number;
      cleaningFee?: number;
      amenitiesTotal?: number;
      taxesTotal?: number;
      totalAmount: number;
      totalAmountCents: number;
    };
    amountDifference: number;
    amountDifferenceCents: number;
    additionalPaymentAmountCents: number;
    potentialReductionAmountCents: number;
    financialAction:
      | "ADDITIONAL_PAYMENT_REQUIRED"
      | "NO_PAYMENT_REQUIRED"
      | "NO_REFUND_DUE_CONFIRMATION_REQUIRED"
      | "REDUCTION_REVIEW_REQUIRED";
    reductionPolicy?: {
      outcome?: string;
      nonRefundableReasons?: string[];
      requiresHostApproval?: boolean;
      refundableReductionAmountCents?: number | null;
    };
  };
};

type ModificationConfirmResponse = {
  ok?: boolean;
  idempotentReplay?: boolean;
  modification?: {
    id: string;
    status: string;
    financialAction: string;
    currency?: string | null;
    currentTotalAmount?: number;
    proposedTotalAmount?: number;
    amountDifference?: number;
    additionalChargeAmount?: number;
    checkoutExpiresAt?: string | null;
    appliedAt?: string | null;
    nextAction:
      | "CREATE_ADDITIONAL_PAYMENT_CHECKOUT"
      | "WAIT_FOR_HOST_APPROVAL"
      | "APPLY_RESERVATION_CHANGE"
      | "NONE";
  };
  reservation?: {
    checkIn?: string;
    checkOut?: string;
  };
  error?: string;
  message?: string;
};

type ModificationCheckoutResponse = {
  ok?: boolean;
  checkoutUrl?: string | null;
  modificationId?: string;
  modificationStatus?: string;
  error?: string;
  message?: string;
};

type ModificationFormState = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  selectedAmenityIds: string[];
};

function formatMoney(value: number | null | undefined, currency = "usd") {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toPropertyDateInput(
  value: string | null | undefined,
  timeZone: string | null | undefined
) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return year && month && day ? `${year}-${month}-${day}` : "";
  } catch {
    return value.slice(0, 10);
  }
}

function getModificationErrorMessage(payload: {
  message?: string;
  error?: string;
}) {
  return (
    payload.message ||
    payload.error ||
    "Unable to complete this reservation change."
  );
}

function getCaughtErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getAmenityFeeLabel(
  amenity: ModificationAmenity,
  currency: string
) {
  const suffix =
    amenity.feeType === "PER_NIGHT"
      ? " per night"
      : amenity.feeType === "PER_GUEST"
      ? " per guest"
      : amenity.feeType === "PER_GUEST_PER_NIGHT"
      ? " per guest, per night"
      : " per stay";

  return `${formatMoney(amenity.amount, currency)}${suffix}`;
}

function createModificationClientRequestId() {
  const randomValue =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  return `portal_${Date.now()}_${randomValue}`;
}

function getModificationFinancialCopy(
  preview: ModificationPreviewResponse | null
) {
  const financialAction = preview?.pricing?.financialAction;

  if (financialAction === "ADDITIONAL_PAYMENT_REQUIRED") {
    return "This change requires an additional secure payment before it can be applied.";
  }

  if (financialAction === "NO_REFUND_DUE_CONFIRMATION_REQUIRED") {
    return "This change lowers the reservation value, but no refund is due under the accepted booking terms. Your explicit confirmation is required.";
  }

  if (financialAction === "REDUCTION_REVIEW_REQUIRED") {
    return "This change lowers the reservation value and must be reviewed by the host before it can be applied.";
  }

  return "No additional payment is required. Pin&Go can apply this change when you confirm.";
}

function getModificationConfirmLabel(
  preview: ModificationPreviewResponse | null
) {
  const financialAction = preview?.pricing?.financialAction;

  if (financialAction === "ADDITIONAL_PAYMENT_REQUIRED") {
    return "Continue to secure payment";
  }

  if (financialAction === "NO_REFUND_DUE_CONFIRMATION_REQUIRED") {
    return "Confirm change with no refund";
  }

  if (financialAction === "REDUCTION_REVIEW_REQUIRED") {
    return "Request change for host review";
  }

  return "Confirm reservation change";
}

function formatRefundBasis(value: string | null | undefined) {
  if (value === "NIGHTLY_SUBTOTAL") {
    return "Nightly subtotal only";
  }

  if (value === "NIGHTLY_PLUS_CLEANING") {
    return "Nightly subtotal + cleaning fee";
  }

  if (value === "CUSTOM") {
    return "Custom refundable base";
  }

  return "Total reservation amount";
}

function formatScenario(value: string) {
  if (value === "EARLY_DEPARTURE") return "Early departures";
  if (value === "DELAYED_ARRIVAL") return "Delayed arrivals";
  if (value === "REDUCED_NIGHTS") return "Reducing reserved nights";
  if (value === "WEATHER_RE_SCHEDULE") return "Weather-related reschedules";
  return "Other post-booking changes";
}

function getEffectiveRefundExecution(
  preview: CancellationPreviewResponse | null | undefined
) {
  if (preview?.refundExecution) {
    return preview.refundExecution;
  }

  if (preview?.reservation?.paymentState === "REFUNDED") {
    return "FULL_REFUND_EXECUTED";
  }

  if (preview?.reservation?.paymentState === "PARTIALLY_REFUNDED") {
    return "PARTIAL_REFUND_EXECUTED";
  }

  return null;
}

function getDisplayedRefundAmount(
  preview: CancellationPreviewResponse | null | undefined
) {
  const refundAmountCents = Number(preview?.refund?.amountCents ?? NaN);

  if (Number.isFinite(refundAmountCents) && refundAmountCents >= 0) {
    return refundAmountCents / 100;
  }

  const refundAmount = Number(preview?.refund?.amount ?? NaN);

  if (Number.isFinite(refundAmount) && refundAmount >= 0) {
    return refundAmount;
  }

  return Number(preview?.evaluation?.refundAmount ?? 0);
}

function getRefundAmountLabel(
  preview: CancellationPreviewResponse | null | undefined
) {
  const refundExecution = getEffectiveRefundExecution(preview);

  if (refundExecution === "FULL_REFUND_EXECUTED") {
    return "Refund processed";
  }

  if (refundExecution === "PARTIAL_REFUND_EXECUTED") {
    return "Partial refund processed";
  }

  if (
    refundExecution === "NO_REFUND_DUE" ||
    preview?.reservation?.paymentState === "REFUNDED" ||
    preview?.reservation?.status === "CANCELLED"
  ) {
    return Number(preview?.evaluation?.refundAmountCents ?? 0) > 0
      ? "Refund amount"
      : "No refund due";
  }

  return "Estimated refund";
}

function getActionCopy(preview: CancellationPreviewResponse | null) {
  const refundExecution = getEffectiveRefundExecution(preview);

  if (refundExecution === "FULL_REFUND_EXECUTED") {
    return {
      title: "Refund processed",
      text:
        "Pin&Go cancelled the reservation and submitted the eligible refund through Stripe.",
    };
  }

  if (refundExecution === "PARTIAL_REFUND_EXECUTED") {
    return {
      title: "Partial refund processed",
      text:
        "Pin&Go cancelled the reservation and submitted the eligible partial refund through Stripe. Non-refundable charges were handled according to the cancellation terms accepted at booking.",
    };
  }

  if (refundExecution === "REFUND_PENDING_PROPERTY_WORKFLOW") {
    return {
      title: "Cancellation recorded",
      text:
        "The reservation was cancelled. The eligible refund still needs to be handled by the property workflow.",
    };
  }

  if (refundExecution === "GUEST_AUTO_REFUND_FAILED") {
    return {
      title: "Refund needs review",
      text:
        "The cancellation request was recorded, but the automatic refund could not be completed and needs review.",
    };
  }

  if (preview?.action === "HOST_APPROVAL_REQUIRED") {
    return {
      title: "Host approval required",
      text:
        "This cancellation cannot be completed automatically. Pin&Go can record the request for host review.",
    };
  }

  if (preview?.action === "CANCELLATION_ALLOWED_REFUND_PENDING") {
    return {
      title: "Cancellation allowed",
      text:
        "This cancellation is allowed under the policy. The eligible refund is estimated below and may be submitted through Stripe when you confirm.",
    };
  }

  if (preview?.action === "CANCELLATION_ALLOWED_NO_REFUND") {
    return {
      title: "Cancellation allowed with no refund",
      text:
        "This cancellation is allowed under the policy, but no refund is estimated for the selected stay.",
    };
  }

  return {
    title: "Cancellation review",
    text:
      "Pin&Go will evaluate the reservation policy before completing this cancellation.",
  };
}

function getRefundExecutionCopy(
  preview: CancellationPreviewResponse | null | undefined,
  currency: string
) {
  const value = getEffectiveRefundExecution(preview);
  const amount = formatMoney(getDisplayedRefundAmount(preview), currency);

  if (value === "FULL_REFUND_EXECUTED") {
    return `Your eligible refund of ${amount} was submitted through Stripe.`;
  }

  if (value === "PARTIAL_REFUND_EXECUTED") {
    return `Your eligible partial refund of ${amount} was submitted through Stripe. Any non-refundable charges remain subject to the cancellation terms accepted at booking.`;
  }

  if (value === "REFUND_PENDING_PROPERTY_WORKFLOW") {
    return "Your cancellation was recorded. The eligible refund is pending the property refund workflow.";
  }

  if (value === "NOT_EXECUTED_HOST_APPROVAL_REQUIRED") {
    return "This cancellation requires host approval before any refund can be processed.";
  }

  if (value === "GUEST_AUTO_REFUND_FAILED") {
    return "Pin&Go could not complete the automatic refund. The cancellation request was recorded for review.";
  }

  if (value === "REFUND_NOT_EXECUTED_IN_V1") {
    return "Refund has not been processed yet. Pin&Go will follow the property cancellation workflow.";
  }

  if (value === "NO_REFUND_DUE") {
    return "No refund is due according to the current policy evaluation.";
  }

  return "Refund execution will follow the property cancellation workflow.";
}

function getCancellationSubmitMessage(preview: CancellationPreviewResponse) {
  const refundExecution = getEffectiveRefundExecution(preview);

  if (preview.alreadyCancelled) {
    return "This reservation was already cancelled.";
  }

  if (refundExecution === "FULL_REFUND_EXECUTED") {
    return "Your reservation was cancelled and your eligible refund was submitted through Stripe.";
  }

  if (refundExecution === "PARTIAL_REFUND_EXECUTED") {
    return "Your reservation was cancelled and your eligible partial refund was submitted through Stripe.";
  }

  if (refundExecution === "NO_REFUND_DUE") {
    return "Your reservation was cancelled. No refund is due according to the policy.";
  }

  if (refundExecution === "REFUND_PENDING_PROPERTY_WORKFLOW") {
    return "Your reservation was cancelled. The refund remains pending in the property workflow.";
  }

  return "Your reservation cancellation was recorded by Pin&Go.";
}

function getConfirmationCopy(preview: CancellationPreviewResponse | null) {
  if (preview?.evaluation?.requiresHostApproval) {
    return "I understand that this action will request cancellation review from the host and may not cancel my reservation immediately.";
  }

  if (
    preview?.evaluation?.eligibleForAutoRefund &&
    Number(preview.evaluation.refundAmountCents ?? 0) > 0
  ) {
    return "I understand that this action may cancel my reservation and Pin&Go may submit any eligible refund through Stripe according to the cancellation terms accepted at booking.";
  }

  if (Number(preview?.evaluation?.refundAmountCents ?? 0) <= 0) {
    return "I understand that this action may cancel my reservation and no refund is currently estimated under the accepted cancellation terms.";
  }

  return "I understand that this action may cancel my reservation and that any eligible refund will follow the property cancellation workflow.";
}

function getErrorMessage(payload: CancellationPreviewResponse) {
  return (
    payload.message ||
    payload.error ||
    "Unable to complete this cancellation request."
  );
}

function getPreviewPayload(payload: CancellationPreviewResponse) {
  if (payload.details?.reservation && payload.details?.evaluation) {
    return payload.details;
  }

  return payload;
}

function getManagementPhase(
  preview: CancellationPreviewResponse | null | undefined
) {
  if (preview?.managementPhase) {
    return preview.managementPhase;
  }

  if (
    preview?.alreadyCancelled ||
    preview?.reservation?.status === "CANCELLED" ||
    preview?.reservation?.cancelledAt
  ) {
    return "CANCELLED";
  }

  return "PRE_STAY";
}

export default function GuestCancellationPage() {
  const { guestToken } = useParams();
  const { brand, isCustomBrand } = useBrand();
  const brandLogoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";
  const brandHomePath =
    brand.kind === "CUSTOM_BRAND"
      ? `/book/${brand.organizationSlug}`
      : "/home";

  const [preview, setPreview] = useState<CancellationPreviewResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [modificationOptions, setModificationOptions] =
    useState<ModificationOptionsResponse | null>(null);
  const [modificationForm, setModificationForm] =
    useState<ModificationFormState | null>(null);
  const [modificationPreview, setModificationPreview] =
    useState<ModificationPreviewResponse | null>(null);
  const [modificationLoading, setModificationLoading] = useState(true);
  const [modificationSubmitting, setModificationSubmitting] = useState(false);
  const [modificationError, setModificationError] = useState<string | null>(
    null
  );
  const [modificationMessage, setModificationMessage] = useState<string | null>(
    null
  );
  const [acceptNoRefundReduction, setAcceptNoRefundReduction] = useState(false);
  const [modificationClientRequestId, setModificationClientRequestId] =
    useState<string | null>(null);
  const [pendingCheckoutModificationId, setPendingCheckoutModificationId] =
    useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setPageError(null);
      setSubmitMessage(null);

      const token = String(guestToken ?? "").trim();

      if (!token) {
        throw new Error("Missing reservation link.");
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/cancellation-preview`
      );

      const data: CancellationPreviewResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(getErrorMessage(data));
      }

      setPreview(data);
    } catch (err: unknown) {
      setPageError(getCaughtErrorMessage(err, "Unable to load this reservation."));
    } finally {
      setLoading(false);
    }
  }, [guestToken]);

  const loadModificationOptions = useCallback(async () => {
    try {
      setModificationLoading(true);
      setModificationError(null);

      const token = String(guestToken ?? "").trim();

      if (!token) {
        throw new Error("Missing reservation link.");
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/modification-options`
      );
      const data: ModificationOptionsResponse = await res.json();

      if (!res.ok || !data.ok || !data.reservation || !data.property) {
        throw new Error(getModificationErrorMessage(data));
      }

      const current = data.reservation.current;
      const timeZone = data.property.timezone;

      setModificationOptions(data);
      setModificationForm({
        checkIn: toPropertyDateInput(current.checkIn, timeZone),
        checkOut: toPropertyDateInput(current.checkOut, timeZone),
        adults: current.adults,
        children: current.children,
        selectedAmenityIds: current.selectedAmenityIds,
      });
      setModificationPreview(null);
      setAcceptNoRefundReduction(false);
      setModificationClientRequestId(null);
    } catch (err: unknown) {
      setModificationOptions(null);
      setModificationForm(null);
      setModificationError(
        getCaughtErrorMessage(
          err,
          "Online reservation changes are unavailable."
        )
      );
    } finally {
      setModificationLoading(false);
    }
  }, [guestToken]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    loadModificationOptions();

    const searchParams = new URLSearchParams(window.location.search);
    const paymentResult = searchParams.get("modificationPayment");
    const modificationId = searchParams.get("modificationId")?.trim() || "";

    if (paymentResult === "success") {
      setModificationMessage(
        "Payment received. Pin&Go is applying your reservation change. Refresh the reservation shortly if the new details are not visible yet."
      );
    } else if (paymentResult === "cancelled") {
      setModificationMessage(
        "The additional payment was not completed, so the reservation has not been changed."
      );
      setPendingCheckoutModificationId(
        /^[A-Za-z0-9_-]{8,128}$/.test(modificationId)
          ? modificationId
          : null
      );
    }
  }, [loadModificationOptions]);

  const currency = preview?.reservation?.currency || "usd";
  const managementPhase = getManagementPhase(preview);

  const isCancelled =
    managementPhase === "CANCELLED" ||
    Boolean(preview?.reservation?.cancelledAt);

  const actionCopy = useMemo(() => getActionCopy(preview), [preview]);

  const displayedRefundAmount = getDisplayedRefundAmount(preview);
  const refundAmountLabel = getRefundAmountLabel(preview);
  const confirmationCopy = getConfirmationCopy(preview);

  const canSubmit = Boolean(
    preview &&
      managementPhase === "PRE_STAY" &&
      preview.cancellationAllowed !== false &&
      !isCancelled &&
      accepted &&
      !submitting
  );

  const modificationCurrency =
    modificationOptions?.reservation?.currency || currency;
  const guestCountEditable =
    modificationOptions?.constraints?.guestCountEditable !== false;
  const canPreviewModification = Boolean(
    modificationForm &&
      modificationForm.checkIn &&
      modificationForm.checkOut &&
      Number.isInteger(modificationForm.adults) &&
      modificationForm.adults >= 1 &&
      Number.isInteger(modificationForm.children) &&
      modificationForm.children >= 0 &&
      !modificationSubmitting
  );
  const requiresNoRefundConfirmation =
    modificationPreview?.pricing?.financialAction ===
    "NO_REFUND_DUE_CONFIRMATION_REQUIRED";
  const canConfirmModification = Boolean(
    modificationPreview?.changes?.hasChanges &&
      (!requiresNoRefundConfirmation || acceptNoRefundReduction) &&
      !modificationSubmitting
  );

  function updateModificationForm(patch: Partial<ModificationFormState>) {
    setModificationForm((current) =>
      current
        ? {
            ...current,
            ...patch,
          }
        : current
    );
    setModificationPreview(null);
    setModificationError(null);
    setModificationMessage(null);
    setAcceptNoRefundReduction(false);
    setModificationClientRequestId(null);
  }

  function getModificationRequestBody() {
    if (!modificationForm) {
      throw new Error("Reservation change details are unavailable.");
    }

    return {
      checkIn: modificationForm.checkIn,
      checkOut: modificationForm.checkOut,
      adults: modificationForm.adults,
      children: modificationForm.children,
      selectedAmenityIds: modificationForm.selectedAmenityIds,
    };
  }

  async function handlePreviewModification() {
    try {
      setModificationSubmitting(true);
      setModificationError(null);
      setModificationMessage(null);
      setAcceptNoRefundReduction(false);
      setModificationClientRequestId(null);

      const token = String(guestToken ?? "").trim();

      if (!token) {
        throw new Error("Missing reservation link.");
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/modification-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(getModificationRequestBody()),
        }
      );
      const data: ModificationPreviewResponse = await res.json();

      if (!res.ok || !data.ok || !data.pricing || !data.changes) {
        throw new Error(getModificationErrorMessage(data));
      }

      setModificationPreview(data);
    } catch (err: unknown) {
      setModificationPreview(null);
      setModificationError(
        getCaughtErrorMessage(
          err,
          "Unable to preview this reservation change."
        )
      );
    } finally {
      setModificationSubmitting(false);
    }
  }

  async function handleConfirmModification() {
    try {
      setModificationSubmitting(true);
      setModificationError(null);
      setModificationMessage(null);

      const token = String(guestToken ?? "").trim();

      if (!token) {
        throw new Error("Missing reservation link.");
      }

      if (!modificationPreview?.changes?.hasChanges) {
        throw new Error("Preview the reservation change before confirming it.");
      }

      if (requiresNoRefundConfirmation && !acceptNoRefundReduction) {
        throw new Error(
          "Please confirm that you understand this reduction does not include a refund."
        );
      }

      const clientRequestId =
        modificationClientRequestId || createModificationClientRequestId();

      if (!modificationClientRequestId) {
        setModificationClientRequestId(clientRequestId);
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/modification-confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...getModificationRequestBody(),
            clientRequestId,
            acceptNoRefundReduction,
          }),
        }
      );
      const data: ModificationConfirmResponse = await res.json();

      if (!res.ok || !data.ok || !data.modification) {
        throw new Error(getModificationErrorMessage(data));
      }

      if (
        data.modification.nextAction ===
        "CREATE_ADDITIONAL_PAYMENT_CHECKOUT"
      ) {
        const checkoutRes = await fetch(
          `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
            token
          )}/modification-checkout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              modificationId: data.modification.id,
            }),
          }
        );
        const checkoutData: ModificationCheckoutResponse =
          await checkoutRes.json();

        if (
          !checkoutRes.ok ||
          !checkoutData.ok ||
          typeof checkoutData.checkoutUrl !== "string" ||
          !checkoutData.checkoutUrl
        ) {
          throw new Error(getModificationErrorMessage(checkoutData));
        }

        window.location.assign(checkoutData.checkoutUrl);
        return;
      }

      if (data.modification.nextAction === "WAIT_FOR_HOST_APPROVAL") {
        setModificationMessage(
          "Your reservation change was submitted for host review. The current reservation remains active until the request is approved."
        );
        setModificationPreview(null);
        return;
      }

      await Promise.all([loadPreview(), loadModificationOptions()]);
      setModificationMessage(
        "Your reservation was updated successfully. The current reservation details now reflect the confirmed change."
      );
    } catch (err: unknown) {
      setModificationError(
        getCaughtErrorMessage(
          err,
          "Unable to confirm this reservation change."
        )
      );
    } finally {
      setModificationSubmitting(false);
    }
  }

  async function handleResumeModificationCheckout() {
    try {
      setModificationSubmitting(true);
      setModificationError(null);

      const token = String(guestToken ?? "").trim();

      if (!token || !pendingCheckoutModificationId) {
        throw new Error("The pending payment link is unavailable.");
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/modification-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modificationId: pendingCheckoutModificationId,
          }),
        }
      );
      const data: ModificationCheckoutResponse = await res.json();

      if (
        !res.ok ||
        !data.ok ||
        typeof data.checkoutUrl !== "string" ||
        !data.checkoutUrl
      ) {
        throw new Error(getModificationErrorMessage(data));
      }

      window.location.assign(data.checkoutUrl);
    } catch (err: unknown) {
      setModificationError(
        getCaughtErrorMessage(err, "Unable to resume the secure payment.")
      );
    } finally {
      setModificationSubmitting(false);
    }
  }

  async function handleSubmitCancellation() {
    try {
      setSubmitting(true);
      setPageError(null);
      setSubmitMessage(null);

      const token = String(guestToken ?? "").trim();

      if (!token) {
        throw new Error("Missing reservation link.");
      }

      if (!accepted) {
        throw new Error("Please confirm that you understand this cancellation.");
      }

      const res = await fetch(
        `${API_BASE}/api/public-booking/manage/${encodeURIComponent(
          token
        )}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason.trim() || null,
          }),
        }
      );

      const data: CancellationPreviewResponse = await res.json();
      const nextPreview = getPreviewPayload(data);

      if (!res.ok || !data.ok) {
        const terminalPhase =
          data.error === "EARLY_DEPARTURE_REQUIRED" ||
          data.action === "EARLY_DEPARTURE_REQUIRED"
            ? "IN_STAY"
            : data.error === "STAY_ALREADY_COMPLETED" ||
              data.action === "STAY_ALREADY_COMPLETED"
            ? "POST_STAY"
            : null;

        if (terminalPhase) {
          setPreview((currentPreview) => ({
            ...currentPreview,
            ...nextPreview,
            reservation:
              nextPreview.reservation ?? currentPreview?.reservation,
            managementPhase: terminalPhase,
            action:
              terminalPhase === "IN_STAY"
                ? "EARLY_DEPARTURE_REQUIRED"
                : "STAY_ALREADY_COMPLETED",
          }));
          setAccepted(false);
          return;
        }

        if (
          data.error === "CANCELLATION_REQUIRES_HOST_APPROVAL" &&
          nextPreview.reservation
        ) {
          setPreview(nextPreview);
          setSubmitMessage(
            "Your cancellation request was recorded and requires host approval."
          );
          setAccepted(false);
          return;
        }

        throw new Error(getErrorMessage(data));
      }

      setPreview(nextPreview);
      setSubmitMessage(getCancellationSubmitMessage(nextPreview));
      setAccepted(false);
    } catch (err: unknown) {
      setPageError(
        getCaughtErrorMessage(err, "Unable to submit cancellation request.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to={brandHomePath} style={styles.brandWrap}>
            <img
              src={brandLogoUrl}
              alt={`${brand.displayName} logo`}
              style={styles.logo}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <div style={styles.brandName}>{brand.displayName}</div>
              <div style={styles.slogan}>Manage reservation</div>
            </div>
          </Link>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div style={styles.container}>
            <div style={styles.badge}>Guest Reservation Portal</div>
            <h1 style={styles.title}>Manage your reservation</h1>
            <p style={styles.subtitle}>
              Review your stay, request eligible changes, complete secure
              pre-check-in, or evaluate cancellation options in one place.
            </p>
          </div>
        </section>

        <section style={styles.contentSection}>
          <div style={styles.container}>
            {loading ? (
              <div style={styles.card}>
                <div style={styles.loadingTitle}>Loading reservation...</div>
                <p style={styles.mutedText}>
                  Please wait while Pin&Go checks the reservation policy.
                </p>
              </div>
            ) : pageError && !preview ? (
              <div style={styles.errorCard}>
                <strong>Unable to load reservation</strong>
                <p>{pageError}</p>
                <button type="button" style={styles.secondaryButton} onClick={loadPreview}>
                  Try again
                </button>
              </div>
            ) : managementPhase === "IN_STAY" ? (
              <div style={styles.card}>
                <div style={styles.sectionEyebrow}>Reservation management</div>
                <h2 style={styles.cardTitle}>Your stay has already started.</h2>
                <p style={styles.mutedText}>
                  If you need to leave earlier, please contact the property.
                </p>
              </div>
            ) : managementPhase === "POST_STAY" ? (
              <div style={styles.card}>
                <div style={styles.sectionEyebrow}>Reservation management</div>
                <h2 style={styles.cardTitle}>
                  This stay has already been completed.
                </h2>
                <p style={styles.mutedText}>
                  Cancellation is no longer available.
                </p>
              </div>
            ) : preview?.reservation && preview?.policy && preview?.evaluation ? (
              <div style={styles.grid}>
                <div style={styles.leftColumn}>
                  <div style={styles.card}>
                   <div style={styles.sectionEyebrow}>Reservation</div>

<h2 style={styles.cardTitle}>
  {preview.reservation.propertyName || "Your stay"}
</h2>

<div
  style={{
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    marginTop: 10,
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: "0.01em",
  }}
>
  {preview.reservation.reservationNumber
    ? `Reservation #${preview.reservation.reservationNumber}`
    : "Reservation reference pending"}
</div>

<div style={styles.infoGrid}>
                      <div style={styles.infoItem}>
  <span>Reservation Number</span>
  <strong>
    {preview.reservation.reservationNumber
      ? `#${preview.reservation.reservationNumber}`
      : "Pending Reference"}
  </strong>
</div>
                     <div style={styles.infoItem}>
                        <span>Guest</span>
                        <strong>{preview.reservation.guestName || "Guest"}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <span>Status</span>
                        <strong>{preview.reservation.status}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <span>Check-in</span>
                        <strong>{formatDate(preview.reservation.checkIn)}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <span>Check-out</span>
                        <strong>{formatDate(preview.reservation.checkOut)}</strong>
                      </div>

                      <div style={styles.infoItem}>
                        <span>Total paid</span>
                        <strong>
                          {formatMoney(preview.reservation.totalAmount, currency)}
                        </strong>
                      </div>

                      <div style={styles.infoItem}>
                        <span>Payment</span>
                        <strong>{preview.reservation.paymentState}</strong>
                      </div>
                    </div>

                    {isCancelled ? (
                      <div style={styles.successBox}>
                        This reservation is already cancelled.
                        {preview.reservation.cancelledAt ? (
                          <>
                            {" "}
                            Cancelled on{" "}
                            {formatDateTime(preview.reservation.cancelledAt)}.
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {!isCancelled ? (
                    <div style={styles.modificationCard}>
                      <div style={styles.sectionEyebrow}>
                        Modify reservation
                      </div>
                      <h2 style={styles.cardTitle}>Change your stay</h2>
                      <p style={styles.mutedText}>
                        Update eligible dates, guest counts, or optional
                        amenities. Pin&Go will show the exact price impact before
                        you confirm anything.
                      </p>

                      {modificationLoading ? (
                        <div style={styles.modificationStatusBox}>
                          Checking available reservation changes...
                        </div>
                      ) : modificationOptions?.modificationAllowed &&
                        modificationForm &&
                        modificationOptions.property ? (
                        <>
                          <div style={styles.modificationLimits}>
                            <span>
                              Maximum guests: {modificationOptions.property.maxGuests}
                            </span>
                            <span>
                              Stay limits: {modificationOptions.property.minimumNights}–
                              {modificationOptions.property.maximumNights} nights
                            </span>
                          </div>

                          {!guestCountEditable ? (
                            <div style={styles.lockedNotice}>
                              Guest counts are locked because secure pre-check-in
                              information has already been completed. Dates and
                              optional amenities can still be changed.
                            </div>
                          ) : null}

                          <div style={styles.modificationFormGrid}>
                            <label style={styles.modificationField}>
                              <span>Check-in date</span>
                              <input
                                type="date"
                                value={modificationForm.checkIn}
                                onChange={(event) =>
                                  updateModificationForm({
                                    checkIn: event.target.value,
                                  })
                                }
                                style={styles.modificationInput}
                              />
                            </label>

                            <label style={styles.modificationField}>
                              <span>Check-out date</span>
                              <input
                                type="date"
                                value={modificationForm.checkOut}
                                onChange={(event) =>
                                  updateModificationForm({
                                    checkOut: event.target.value,
                                  })
                                }
                                style={styles.modificationInput}
                              />
                            </label>

                            <label style={styles.modificationField}>
                              <span>Adults</span>
                              <input
                                type="number"
                                min={1}
                                max={
                                  modificationOptions.property.maxGuests ??
                                  undefined
                                }
                                disabled={!guestCountEditable}
                                value={modificationForm.adults}
                                onChange={(event) =>
                                  updateModificationForm({
                                    adults: Number(event.target.value),
                                  })
                                }
                                style={{
                                  ...styles.modificationInput,
                                  ...(!guestCountEditable
                                    ? styles.modificationInputDisabled
                                    : {}),
                                }}
                              />
                            </label>

                            <label style={styles.modificationField}>
                              <span>Children</span>
                              <input
                                type="number"
                                min={0}
                                max={
                                  modificationOptions.property.maxGuests ??
                                  undefined
                                }
                                disabled={!guestCountEditable}
                                value={modificationForm.children}
                                onChange={(event) =>
                                  updateModificationForm({
                                    children: Number(event.target.value),
                                  })
                                }
                                style={{
                                  ...styles.modificationInput,
                                  ...(!guestCountEditable
                                    ? styles.modificationInputDisabled
                                    : {}),
                                }}
                              />
                            </label>
                          </div>

                          <div style={styles.amenitiesSection}>
                            <div style={styles.amenitiesTitle}>
                              Optional amenities
                            </div>

                            {modificationOptions.property.optionalAmenities
                              .length > 0 ? (
                              <div style={styles.amenitiesList}>
                                {modificationOptions.property.optionalAmenities.map(
                                  (amenity) => {
                                    const checked =
                                      modificationForm.selectedAmenityIds.includes(
                                        amenity.id
                                      );

                                    return (
                                      <label
                                        key={amenity.id}
                                        style={styles.amenityOption}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(event) => {
                                            const selectedAmenityIds = event.target
                                              .checked
                                              ? [
                                                  ...modificationForm.selectedAmenityIds,
                                                  amenity.id,
                                                ]
                                              : modificationForm.selectedAmenityIds.filter(
                                                  (id) => id !== amenity.id
                                                );

                                            updateModificationForm({
                                              selectedAmenityIds,
                                            });
                                          }}
                                          style={styles.checkbox}
                                        />
                                        <span style={styles.amenityContent}>
                                          <strong>{amenity.name}</strong>
                                          <span>
                                            {getAmenityFeeLabel(
                                              amenity,
                                              modificationCurrency
                                            )}
                                          </span>
                                          {amenity.description ? (
                                            <small>{amenity.description}</small>
                                          ) : null}
                                        </span>
                                      </label>
                                    );
                                  }
                                )}
                              </div>
                            ) : (
                              <p style={styles.mutedText}>
                                This property has no optional amenities.
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={!canPreviewModification}
                            onClick={handlePreviewModification}
                            style={{
                              ...styles.modificationButton,
                              ...(!canPreviewModification
                                ? styles.cancelButtonDisabled
                                : {}),
                            }}
                          >
                            {modificationSubmitting && !modificationPreview
                              ? "Checking change..."
                              : "Preview reservation change"}
                          </button>

                          {modificationPreview?.pricing &&
                          modificationPreview.reservation?.proposed ? (
                            <div style={styles.modificationPreviewBox}>
                              <div style={styles.previewHeader}>
                                <div>
                                  <div style={styles.sectionEyebrow}>
                                    Change preview
                                  </div>
                                  <strong style={styles.previewTitle}>
                                    Review before confirming
                                  </strong>
                                </div>
                                <span style={styles.previewBadge}>
                                  {modificationPreview.pricing.proposed.nights} nights
                                </span>
                              </div>

                              <div style={styles.previewComparisonGrid}>
                                <div style={styles.previewColumn}>
                                  <span>Current reservation</span>
                                  <strong>
                                    {formatDate(
                                      modificationPreview.reservation.current.checkIn
                                    )}
                                    {" – "}
                                    {formatDate(
                                      modificationPreview.reservation.current.checkOut
                                    )}
                                  </strong>
                                  <small>
                                    {modificationPreview.reservation.current.adults} adults,
                                    {" "}
                                    {modificationPreview.reservation.current.children} children
                                  </small>
                                  <strong>
                                    {formatMoney(
                                      modificationPreview.pricing.currentTotalAmount,
                                      modificationCurrency
                                    )}
                                  </strong>
                                </div>

                                <div style={styles.previewColumn}>
                                  <span>Proposed reservation</span>
                                  <strong>
                                    {formatDate(
                                      modificationPreview.reservation.proposed.checkIn
                                    )}
                                    {" – "}
                                    {formatDate(
                                      modificationPreview.reservation.proposed.checkOut
                                    )}
                                  </strong>
                                  <small>
                                    {modificationPreview.reservation.proposed.adults} adults,
                                    {" "}
                                    {modificationPreview.reservation.proposed.children} children
                                  </small>
                                  <strong>
                                    {formatMoney(
                                      modificationPreview.pricing.proposed.totalAmount,
                                      modificationCurrency
                                    )}
                                  </strong>
                                </div>
                              </div>

                              <div style={styles.priceImpactBox}>
                                <span>Price difference</span>
                                <strong>
                                  {modificationPreview.pricing.amountDifference > 0
                                    ? "+"
                                    : ""}
                                  {formatMoney(
                                    modificationPreview.pricing.amountDifference,
                                    modificationCurrency
                                  )}
                                </strong>
                              </div>

                              <div style={styles.financialNotice}>
                                {getModificationFinancialCopy(
                                  modificationPreview
                                )}
                              </div>

                              {modificationPreview.changes
                                ?.requiresSecurePreCheckinRefresh ? (
                                <div style={styles.lockedNotice}>
                                  Because guest counts changed, Pin&Go may require
                                  secure pre-check-in information to be reviewed
                                  again before access is released.
                                </div>
                              ) : null}

                              {requiresNoRefundConfirmation ? (
                                <label style={styles.confirmBox}>
                                  <input
                                    type="checkbox"
                                    checked={acceptNoRefundReduction}
                                    onChange={(event) =>
                                      setAcceptNoRefundReduction(
                                        event.target.checked
                                      )
                                    }
                                    style={styles.checkbox}
                                  />
                                  <span>
                                    I understand that this reservation reduction
                                    does not include a refund under the terms I
                                    accepted at booking.
                                  </span>
                                </label>
                              ) : null}

                              <button
                                type="button"
                                disabled={!canConfirmModification}
                                onClick={handleConfirmModification}
                                style={{
                                  ...styles.confirmModificationButton,
                                  ...(!canConfirmModification
                                    ? styles.cancelButtonDisabled
                                    : {}),
                                }}
                              >
                                {modificationSubmitting
                                  ? "Processing change..."
                                  : getModificationConfirmLabel(
                                      modificationPreview
                                    )}
                              </button>
                            </div>
                          ) : null}

                          {modificationMessage ? (
                            <div style={styles.successBox}>
                              {modificationMessage}
                            </div>
                          ) : null}

                          {pendingCheckoutModificationId ? (
                            <button
                              type="button"
                              disabled={modificationSubmitting}
                              onClick={handleResumeModificationCheckout}
                              style={{
                                ...styles.confirmModificationButton,
                                ...(modificationSubmitting
                                  ? styles.cancelButtonDisabled
                                  : {}),
                              }}
                            >
                              {modificationSubmitting
                                ? "Opening secure payment..."
                                : "Resume secure payment"}
                            </button>
                          ) : null}

                          {modificationError ? (
                            <div style={styles.inlineError}>
                              {modificationError}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={loadModificationOptions}
                            style={styles.secondaryButtonFull}
                          >
                            Refresh reservation details
                          </button>
                        </>
                      ) : (
                        <div style={styles.modificationUnavailableBox}>
                          <strong>Online changes are unavailable</strong>
                          <span>
                            {modificationError ||
                              "This reservation cannot be modified online."}
                          </span>
                          <button
                            type="button"
                            onClick={loadModificationOptions}
                            style={styles.secondaryButton}
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {preview.securePreCheckin ? (
  <div style={styles.securePreCheckinCard}>
    <div style={styles.sectionEyebrow}>
      Secure Pre-check-in
    </div>

    <h2 style={styles.cardTitle}>
      {preview.securePreCheckin.completed
        ? "Secure Pre-check-in completed"
        : "Secure Pre-check-in required"}
    </h2>

    <p style={styles.securePreCheckinText}>
      {preview.securePreCheckin.completed
        ? "Your required pre-arrival steps are complete."
        : "Complete the required pre-arrival process before access credentials can be released."}
    </p>

    <p style={styles.securePreCheckinText}>
      {preview.securePreCheckin.completed
        ? "Sus pasos requeridos antes de la llegada están completados."
        : "Complete el proceso requerido antes de la llegada para que se puedan liberar las credenciales de acceso."}
    </p>

    {!preview.securePreCheckin.completed &&
    preview.securePreCheckin.url ? (
      <a
        href={preview.securePreCheckin.url}
        style={styles.securePreCheckinButton}
      >
        Continue Secure Pre-check-in / Continuar registro seguro
      </a>
    ) : null}
  </div>
) : null}

                  <div style={styles.card}>
                    <div style={styles.sectionEyebrow}>Cancellation policy</div>
                    <h2 style={styles.cardTitle}>{preview.policy.name}</h2>

                    <p style={styles.policySummary}>
                      {preview.policy.guestFacingSummary ||
                        "Cancellation terms apply to this reservation."}
                    </p>

                    <div style={styles.policyMetaGrid}>
                      <div style={styles.policyMetaItem}>
                        <span>Policy type</span>
                        <strong>{preview.policy.type}</strong>
                      </div>

                      <div style={styles.policyMetaItem}>
                        <span>Refund basis</span>
                        <strong>
                          {formatRefundBasis(preview.policy.refundBasis)}
                        </strong>
                      </div>
                    </div>

                    <div style={styles.timeline}>
                      {preview.policy.refundRules.map((rule, index) => (
                        <div
                          key={`${rule.label}-${rule.minHoursBeforeCheckIn}-${index}`}
                          style={styles.timelineItem}
                        >
                          <div style={styles.timelineMarker}>
                            {rule.refundPercent >= 100
                              ? "✓"
                              : rule.refundPercent > 0
                              ? "%"
                              : "×"}
                          </div>

                          <div style={styles.timelineContent}>
                            <div style={styles.timelineTop}>
                              <strong>{rule.label}</strong>
                              <span style={styles.refundBadge}>
                                {rule.refundPercent}%
                              </span>
                            </div>

                            <div style={styles.timelineWindow}>
                              {rule.minHoursBeforeCheckIn > 0
                                ? `${rule.minHoursBeforeCheckIn} hours or more before check-in`
                                : "After the final refund window"}
                            </div>

                            {rule.description ? (
                              <div style={styles.timelineDescription}>
                                {rule.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {preview.policy.nonRefundableScenarios.length > 0 ? (
                      <div style={styles.exceptionsBox}>
                        <div style={styles.exceptionsTitle}>
                          Important non-refundable cases
                        </div>

                        <div style={styles.scenarioGrid}>
                          {preview.policy.nonRefundableScenarios.map((scenario) => (
                            <span key={scenario} style={styles.scenarioPill}>
                              {formatScenario(scenario)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {preview.policy.cancellationTermsAcceptance?.accepted ? (
                      <div style={styles.acceptanceBox}>
                        <strong>Terms accepted at booking</strong>
                        <span>
                          Accepted on{" "}
                          {formatDateTime(
                            preview.policy.cancellationTermsAcceptance.acceptedAt
                          )}
                        </span>
                        {preview.policy.cancellationTermsAcceptance.text ? (
                          <p>
                            {preview.policy.cancellationTermsAcceptance.text}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside style={styles.summaryCard}>
                  <div style={styles.summaryIcon}>↩</div>
                  <div style={styles.sectionEyebrow}>Cancellation result</div>
                  <h2 style={styles.summaryTitle}>{actionCopy.title}</h2>
                  <p style={styles.summaryText}>{actionCopy.text}</p>

                  <div style={styles.refundAmountBox}>
                    <span>{refundAmountLabel}</span>
                    <strong>
                      {formatMoney(displayedRefundAmount, currency)}
                    </strong>
                  </div>

                  <div style={styles.breakdownBox}>
                    <div style={styles.breakdownRow}>
                      <span>Refund percent</span>
                      <strong>{preview.evaluation.refundPercent}%</strong>
                    </div>

                    <div style={styles.breakdownRow}>
                      <span>Refundable base</span>
                      <strong>
                        {formatMoney(
                          preview.evaluation.breakdown?.refundableBase,
                          currency
                        )}
                      </strong>
                    </div>

                    <div style={styles.breakdownRow}>
                      <span>Total paid</span>
                      <strong>
                        {formatMoney(
                          preview.evaluation.breakdown?.totalAmount,
                          currency
                        )}
                      </strong>
                    </div>

                    <div style={styles.breakdownRow}>
                      <span>Nightly subtotal</span>
                      <strong>
                        {formatMoney(
                          preview.evaluation.breakdown?.nightlySubtotal,
                          currency
                        )}
                      </strong>
                    </div>

                    <div style={styles.breakdownRow}>
                      <span>Taxes / non-nightly charges</span>
                      <strong>
                        {formatMoney(
                          (preview.evaluation.breakdown?.taxesTotal ?? 0) +
                            (preview.evaluation.breakdown?.cleaningFee ?? 0) +
                            (preview.evaluation.breakdown?.amenitiesTotal ?? 0),
                          currency
                        )}
                      </strong>
                    </div>
                  </div>

                  {preview.refund ? (
                    <div style={styles.refundProcessedBox}>
                      <strong>
                        {preview.refund.isFullRefund
                          ? "Stripe refund processed"
                          : "Stripe partial refund processed"}
                      </strong>

                      {preview.refund.status ? (
                        <span>Status: {preview.refund.status}</span>
                      ) : null}

                      {preview.refund.refundedAt ? (
                        <span>
                          Submitted on {formatDateTime(preview.refund.refundedAt)}
                        </span>
                      ) : null}

                      {preview.refund.stripeRefundId ? (
                        <span>Refund ID: {preview.refund.stripeRefundId}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {preview.evaluation.matchedRefundRule ? (
                    <div style={styles.matchedRuleBox}>
                      <strong>Matched rule</strong>
                      <span>{preview.evaluation.matchedRefundRule.label}</span>
                      {preview.evaluation.matchedRefundRule.description ? (
                        <p>{preview.evaluation.matchedRefundRule.description}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={styles.refundNotice}>
                    {getRefundExecutionCopy(preview, currency)}
                  </div>

                  {submitMessage ? (
                    <div style={styles.successBox}>{submitMessage}</div>
                  ) : null}

                  {pageError ? (
                    <div style={styles.inlineError}>{pageError}</div>
                  ) : null}

                  {!isCancelled && preview.cancellationAllowed !== false ? (
                    <>
                      <label style={styles.reasonField}>
                        <span>Cancellation reason optional</span>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Add a short note for the host..."
                          style={styles.textarea}
                        />
                      </label>

                      <label style={styles.confirmBox}>
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(e) => setAccepted(e.target.checked)}
                          style={styles.checkbox}
                        />

                        <span>{confirmationCopy}</span>
                      </label>

                      <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSubmitCancellation}
                        style={{
                          ...styles.cancelButton,
                          ...(!canSubmit ? styles.cancelButtonDisabled : {}),
                        }}
                      >
                        {submitting
                          ? "Submitting..."
                          : preview.evaluation.requiresHostApproval
                          ? "Request cancellation review"
                          : "Cancel reservation"}
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={loadPreview}
                    style={styles.secondaryButtonFull}
                  >
                    Refresh evaluation
                  </button>
                </aside>
              </div>
            ) : (
              <div style={styles.errorCard}>
                <strong>Reservation unavailable</strong>
                <p>Pin&Go could not load this reservation.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <div style={styles.container}>
          {isCustomBrand
            ? `© ${brand.displayName}. Reservation management powered by Pin&Go.`
            : "© Pin&Go. Reservation management powered by autonomous property operations."}
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid #e2e8f0",
  },
  headerInner: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "14px 20px",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#0f172a",
    textDecoration: "none",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    borderRadius: 12,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  slogan: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 800,
  },
  main: {
    minHeight: "calc(100vh - 96px)",
  },
  hero: {
    padding: "68px 20px 44px",
    background:
      "radial-gradient(circle at 15% 0%, rgba(37,99,235,0.14), transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  container: {
    maxWidth: 1180,
    margin: "0 auto",
  },
  badge: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "8px 13px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    maxWidth: 780,
    margin: "18px 0 0",
    fontSize: "clamp(2.5rem, 5vw, 4.8rem)",
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.055em",
  },
  subtitle: {
    maxWidth: 760,
    margin: "18px 0 0",
    color: "#475569",
    fontSize: 18,
    lineHeight: 1.7,
    fontWeight: 650,
  },
  contentSection: {
    padding: "34px 20px 76px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(340px, 0.75fr)",
    gap: 24,
    alignItems: "start",
  },
  leftColumn: {
    display: "grid",
    gap: 22,
  },
  securePreCheckinCard: {
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  borderRadius: 20,
  padding: 22,
},

securePreCheckinText: {
  margin: "12px 0 0",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.6,
},

securePreCheckinButton: {
  display: "inline-block",
  marginTop: 18,
  background: "#1d4ed8",
  color: "#ffffff",
  textDecoration: "none",
  padding: "13px 17px",
  borderRadius: 12,
  fontWeight: 850,
  fontSize: 13,
},

  modificationCard: {
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 18px 50px rgba(37, 99, 235, 0.1)",
  },
  modificationStatusBox: {
    marginTop: 20,
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 15,
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: 13,
    fontWeight: 850,
  },
  modificationLimits: {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    color: "#334155",
    fontSize: 12,
    fontWeight: 850,
  },
  lockedNotice: {
    marginTop: 16,
    border: "1px solid #fde68a",
    borderRadius: 16,
    padding: 14,
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  modificationFormGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
  },
  modificationField: {
    display: "grid",
    gap: 7,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  modificationInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 13px",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 750,
    outline: "none",
  },
  modificationInputDisabled: {
    background: "#f1f5f9",
    color: "#64748b",
    cursor: "not-allowed",
  },
  amenitiesSection: {
    marginTop: 22,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 18,
  },
  amenitiesTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },
  amenitiesList: {
    marginTop: 12,
    display: "grid",
    gap: 10,
  },
  amenityOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 14,
    background: "#f8fbff",
    cursor: "pointer",
  },
  amenityContent: {
    display: "grid",
    gap: 3,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.45,
  },
  modificationButton: {
    marginTop: 20,
    width: "100%",
    border: "1px solid #2563eb",
    borderRadius: 18,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "14px 17px",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
  },
  modificationPreviewBox: {
    marginTop: 20,
    border: "1px solid #93c5fd",
    borderRadius: 22,
    padding: 20,
    background: "#f8fbff",
  },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  previewTitle: {
    color: "#0f172a",
    fontSize: 20,
    letterSpacing: "-0.025em",
  },
  previewBadge: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "6px 9px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  previewComparisonGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  previewColumn: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: 14,
    background: "#ffffff",
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 13,
  },
  priceImpactBox: {
    marginTop: 14,
    borderRadius: 16,
    padding: 15,
    background: "#0f172a",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 14,
  },
  financialNotice: {
    marginTop: 14,
    border: "1px solid #bfdbfe",
    borderRadius: 16,
    padding: 14,
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  confirmModificationButton: {
    marginTop: 14,
    width: "100%",
    border: "none",
    borderRadius: 18,
    background: "#2563eb",
    color: "#ffffff",
    padding: "15px 18px",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 32px rgba(37,99,235,0.24)",
  },
  modificationUnavailableBox: {
    marginTop: 20,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    background: "#f8fafc",
    color: "#475569",
    display: "grid",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.5,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  summaryCard: {
    position: "sticky",
    top: 92,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 950,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  mutedText: {
    margin: "10px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
  },
  infoGrid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  infoItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "14px 15px",
    background: "#f8fafc",
    display: "grid",
    gap: 5,
  },
  policyMetaGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  policyMetaItem: {
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: "14px 15px",
    background: "#eff6ff",
    display: "grid",
    gap: 5,
  },
  policySummary: {
    margin: "14px 0 0",
    color: "#475569",
    lineHeight: 1.7,
    fontSize: 15,
    fontWeight: 700,
  },
  timeline: {
    marginTop: 22,
    display: "grid",
    gap: 13,
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: 12,
    alignItems: "start",
  },
  timelineMarker: {
    width: 34,
    height: 34,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    fontSize: 15,
    fontWeight: 950,
  },
  timelineContent: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    padding: "13px 14px",
    display: "grid",
    gap: 5,
  },
  timelineTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  refundBadge: {
    borderRadius: 999,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 950,
  },
  timelineWindow: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
  },
  timelineDescription: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  exceptionsBox: {
    marginTop: 22,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 18,
    display: "grid",
    gap: 12,
  },
  exceptionsTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  scenarioGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  scenarioPill: {
    borderRadius: 999,
    padding: "7px 10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 850,
  },
  acceptanceBox: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    borderRadius: 18,
    padding: 15,
    display: "grid",
    gap: 6,
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 700,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 24,
    fontWeight: 950,
    marginBottom: 16,
  },
  summaryTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  summaryText: {
    margin: "12px 0 0",
    color: "#475569",
    lineHeight: 1.65,
    fontSize: 14,
    fontWeight: 700,
  },
  refundAmountBox: {
    marginTop: 20,
    borderRadius: 22,
    padding: 20,
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 52%, #1d4ed8 100%)",
    color: "#ffffff",
    display: "grid",
    gap: 6,
    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
  },
  breakdownBox: {
    marginTop: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 15,
    display: "grid",
    gap: 10,
    background: "#f8fafc",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#475569",
    fontSize: 13,
  },
  matchedRuleBox: {
    marginTop: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#14532d",
    borderRadius: 18,
    padding: 15,
    display: "grid",
    gap: 5,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
  },
  refundProcessedBox: {
    marginTop: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#14532d",
    borderRadius: 18,
    padding: 15,
    display: "grid",
    gap: 5,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  refundNotice: {
    marginTop: 16,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    borderRadius: 18,
    padding: 14,
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  reasonField: {
    marginTop: 18,
    display: "grid",
    gap: 8,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  textarea: {
    width: "100%",
    minHeight: 92,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 13px",
    fontSize: 14,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
  },
  confirmBox: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#f8fafc",
    color: "#334155",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 750,
    cursor: "pointer",
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    cursor: "pointer",
    flexShrink: 0,
  },
  cancelButton: {
    marginTop: 14,
    width: "100%",
    border: "none",
    borderRadius: 18,
    background: "#dc2626",
    color: "#ffffff",
    padding: "15px 18px",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 32px rgba(220,38,38,0.24)",
  },
  cancelButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButtonFull: {
    marginTop: 12,
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
    padding: "13px 15px",
    fontWeight: 900,
    cursor: "pointer",
  },
  successBox: {
    marginTop: 14,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 13,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 850,
  },
  inlineError: {
    marginTop: 14,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 16,
    padding: 13,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 850,
  },
  errorCard: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 24,
    padding: 26,
    display: "grid",
    gap: 10,
    fontWeight: 800,
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    padding: "24px 20px",
    color: "#64748b",
    fontSize: 14,
    background: "#ffffff",
    textAlign: "center",
  },
};
