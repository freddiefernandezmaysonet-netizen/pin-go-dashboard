import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import "react-day-picker/style.css";
import { Link, useParams } from "react-router-dom";

type PublicProperty = {
  id: string;
  organizationId: string;
  name: string;
  slug: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicPhotos?: unknown;
  baseNightlyRate?: string | number | null;
  cleaningFee?: string | number | null;
  maxGuests?: number | null;
  minimumNights?: number | null;
  maximumNights?: number | null;
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  timezone?: string | null;
  cancellationPolicy?: PublicCancellationPolicy | null;
  amenities?: Array<{
  id: string;
  name: string;
  description?: string | null;
  chargeMode: "INCLUDED" | "REQUIRED" | "OPTIONAL";
  feeType: "PER_STAY" | "PER_NIGHT";
  amount: string | number;
  }>;
  taxes?: Array<{
    id: string;
    name: string;
    percentage: string | number;
  }>;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type PublicCancellationRefundRule = {
  minHoursBeforeCheckIn: number;
  refundPercent: number;
  label: string;
  description?: string | null;
};

type PublicNonRefundableScenario =
  | "EARLY_DEPARTURE"
  | "DELAYED_ARRIVAL"
  | "REDUCED_NIGHTS"
  | "WEATHER_RE_SCHEDULE"
  | "OTHER";

type PublicCancellationPolicy = {
  policyId: string | null;
  name: string;
  type:
    | "FLEXIBLE"
    | "MODERATE"
    | "FIRM"
    | "STRICT"
    | "CUSTOM"
    | "NON_REFUNDABLE";
  source: string;
  guestSelfCancellationEnabled: boolean;
  autoRefundEligibleCancellations: boolean;
  requireHostApprovalOutsidePolicy: boolean;
  freeCancellationHoursBeforeCheckIn: number;
  refundBasis:
    | "TOTAL_AMOUNT"
    | "NIGHTLY_SUBTOTAL"
    | "NIGHTLY_PLUS_CLEANING"
    | "CUSTOM";
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  refundRules?: PublicCancellationRefundRule[] | null;
  nonRefundableScenarios?: PublicNonRefundableScenario[] | null;
  guestFacingSummary?: string | null;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string | null;
  snapshotAt: string;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

function getPhotoUrls(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "$0";

 return new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(n);
}

function formatNightlyDisplayMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "$0";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatCancellationWindow(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "after the last refund window";
  }

  const days = hours / 24;

  if (Number.isInteger(days) && days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function formatRefundPercent(value: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "0%";

  return `${Math.max(0, Math.min(100, n))}%`;
}

function getCancellationDeadlineDate(checkIn: string, hours: number) {
  if (!checkIn || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  const date = new Date(`${checkIn}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(date.getHours() - hours);

  return format(date, "MMM d, yyyy");
}

function getScenarioLabel(scenario: PublicNonRefundableScenario) {
  if (scenario === "EARLY_DEPARTURE") return "Early departures";
  if (scenario === "DELAYED_ARRIVAL") return "Delayed arrivals";
  if (scenario === "REDUCED_NIGHTS") return "Reducing reserved nights";
  if (scenario === "WEATHER_RE_SCHEDULE") return "Weather-related reschedules";
  return "Other post-booking changes";
}

function normalizeCancellationRefundRules(
  policy: PublicCancellationPolicy
): PublicCancellationRefundRule[] {
  if (Array.isArray(policy.refundRules) && policy.refundRules.length > 0) {
    return policy.refundRules
      .map((rule) => ({
        minHoursBeforeCheckIn: Math.max(
          0,
          Math.round(Number(rule.minHoursBeforeCheckIn ?? 0))
        ),
        refundPercent: Math.max(
          0,
          Math.min(100, Number(rule.refundPercent ?? 0))
        ),
        label: rule.label || `${rule.refundPercent}% refund`,
        description: rule.description ?? null,
      }))
      .sort((a, b) => b.minHoursBeforeCheckIn - a.minHoursBeforeCheckIn);
  }

  if (policy.type === "NON_REFUNDABLE") {
    return [
      {
        minHoursBeforeCheckIn: 0,
        refundPercent: 0,
        label: "No refund",
        description: "This reservation is non-refundable after booking.",
      },
    ];
  }

  return [
    {
      minHoursBeforeCheckIn: policy.freeCancellationHoursBeforeCheckIn,
      refundPercent: policy.refundPercentBeforeDeadline,
      label:
        policy.refundPercentBeforeDeadline >= 100
          ? "Full refund"
          : "Refund before deadline",
      description: `${formatRefundPercent(
        policy.refundPercentBeforeDeadline
      )} refund before the cancellation deadline.`,
    },
    {
      minHoursBeforeCheckIn: 0,
      refundPercent: policy.refundPercentAfterDeadline,
      label:
        policy.refundPercentAfterDeadline > 0
          ? "Partial refund"
          : "No refund",
      description: `${formatRefundPercent(
        policy.refundPercentAfterDeadline
      )} refund after the cancellation deadline.`,
    },
  ].sort((a, b) => b.minHoursBeforeCheckIn - a.minHoursBeforeCheckIn);
}

function getRuleWindowLabel(
  rule: PublicCancellationRefundRule,
  index: number,
  rules: PublicCancellationRefundRule[]
) {
  const previousRule = index > 0 ? rules[index - 1] : null;

  if (index === 0 && rule.minHoursBeforeCheckIn > 0) {
    return `${formatCancellationWindow(
      rule.minHoursBeforeCheckIn
    )}+ before check-in`;
  }

  if (rule.minHoursBeforeCheckIn > 0 && previousRule) {
    return `${formatCancellationWindow(
      rule.minHoursBeforeCheckIn
    )} to ${formatCancellationWindow(
      previousRule.minHoursBeforeCheckIn
    )} before check-in`;
  }

  if (previousRule) {
    return `Less than ${formatCancellationWindow(
      previousRule.minHoursBeforeCheckIn
    )} before check-in`;
  }

  return "After booking confirmation";
}

function getRuleDateLabel({
  rule,
  index,
  rules,
  checkIn,
}: {
  rule: PublicCancellationRefundRule;
  index: number;
  rules: PublicCancellationRefundRule[];
  checkIn: string;
}) {
  if (!checkIn) return null;

  const previousRule = index > 0 ? rules[index - 1] : null;

  if (rule.minHoursBeforeCheckIn > 0) {
    const dateLabel = getCancellationDeadlineDate(
      checkIn,
      rule.minHoursBeforeCheckIn
    );

    return dateLabel ? `Until ${dateLabel}` : null;
  }

  if (previousRule) {
    const dateLabel = getCancellationDeadlineDate(
      checkIn,
      previousRule.minHoursBeforeCheckIn
    );

    return dateLabel ? `After ${dateLabel}` : null;
  }

  return null;
}

function getPolicyTypeLabel(type: PublicCancellationPolicy["type"]) {
  if (type === "NON_REFUNDABLE") {
    return "Non-refundable reservation";
  }

  return "Refund terms for this stay";
}

function formatDateLabelForSentence(label?: string | null) {
  if (!label) return "";

  return label
    .replace(/^Until\s+/i, "until ")
    .replace(/^After\s+/i, "after ");
}

function getCancellationPolicySummary(
  policy: PublicCancellationPolicy | null | undefined,
  checkIn: string
) {
  if (!policy) return null;

  const rules = normalizeCancellationRefundRules(policy);
  const scenarios = Array.isArray(policy.nonRefundableScenarios)
    ? policy.nonRefundableScenarios
    : [];

  const displayRules = rules.map((rule, index) => ({
    ...rule,
    windowLabel: getRuleWindowLabel(rule, index, rules),
    dateLabel: getRuleDateLabel({
      rule,
      index,
      rules,
      checkIn,
    }),
    tone:
      rule.refundPercent >= 100
        ? "success"
        : rule.refundPercent > 0
        ? "warning"
        : "danger",
  }));

  const firstRefundRule = displayRules.find((rule) => rule.refundPercent > 0);
  const firstNoRefundRule = displayRules.find((rule) => rule.refundPercent <= 0);

  const headline =
    policy.type === "NON_REFUNDABLE"
      ? "This reservation is non-refundable."
      : firstRefundRule?.dateLabel
      ? `${formatRefundPercent(
          firstRefundRule.refundPercent
        )} refund ${formatDateLabelForSentence(firstRefundRule.dateLabel)}.`
      : firstRefundRule
      ? `${formatRefundPercent(firstRefundRule.refundPercent)} refund ${
          firstRefundRule.windowLabel
        }.`
      : "Cancellation terms apply to this reservation.";

  const selectedDateSummary =
    checkIn && displayRules.some((rule) => rule.dateLabel)
      ? `For your selected dates: ${displayRules
          .filter((rule) => rule.dateLabel)
          .map((rule) => {
            const dateLabel = formatDateLabelForSentence(rule.dateLabel);

            if (rule.refundPercent >= 100) {
              return `full refund ${dateLabel}`;
            }

            if (rule.refundPercent > 0) {
              return `${formatRefundPercent(rule.refundPercent)} refund ${dateLabel}`;
            }

            return `no refund ${dateLabel}`;
          })
          .join("; ")}.`
      : "";

  return {
    title: getPolicyTypeLabel(policy.type),
    headline,
    summaryText:
      selectedDateSummary ||
      policy.guestFacingSummary?.trim() ||
      policy.description ||
      "Review the refund windows below before completing your reservation.",
    rules: displayRules,
    scenarios,
    approvalNote: policy.requireHostApprovalOutsidePolicy
      ? "Cancellations outside the refund policy may require host approval."
      : "Eligible cancellations can be processed automatically by Pin&Go.",
    noRefundLabel: firstNoRefundRule ? firstNoRefundRule.windowLabel : null,
  };
}

function getRefundBasisDisclosure(
  policy: PublicCancellationPolicy | null | undefined
) {
  if (!policy) return null;

  if (policy.refundBasis === "NIGHTLY_SUBTOTAL") {
    return "Refund percentages apply to the nightly subtotal only. Other charges such as cleaning fees, service fees, taxes, add-ons, or other non-nightly charges may not be refundable unless required by law or specifically stated in this policy.";
  }

  if (policy.refundBasis === "NIGHTLY_PLUS_CLEANING") {
    return "Refund percentages apply to the nightly subtotal plus cleaning fee. Taxes, add-ons, service fees, or other non-nightly charges may not be refundable unless required by law or specifically stated in this policy.";
  }

  if (policy.refundBasis === "TOTAL_AMOUNT") {
    return "Refund percentages apply to the eligible reservation amount according to the cancellation policy shown for this stay.";
  }

  if (policy.refundBasis === "CUSTOM") {
    return "Refund eligibility is calculated using the custom refund basis configured for this property and shown in this policy.";
  }

  return null;
}

function buildCancellationTermsAcceptanceText(
  policy: PublicCancellationPolicy | null | undefined,
  summary: ReturnType<typeof getCancellationPolicySummary>
) {
  if (!policy || !summary) return "";

  const refundBasisDisclosure = getRefundBasisDisclosure(policy);

  const refundTimelineText = summary.rules
    .map((rule) => {
      const ruleWindow = rule.dateLabel || rule.windowLabel;

      return `${rule.label}: ${formatRefundPercent(
        rule.refundPercent
      )} refund - ${ruleWindow}`;
    })
    .join(" | ");

  const scenarioText =
    summary.scenarios.length > 0
      ? `Important non-refundable cases: ${summary.scenarios
          .map((scenario) => getScenarioLabel(scenario))
          .join(", ")}.`
      : "";

  return [
    "I understand and agree to the cancellation terms shown above, including how any eligible refund is calculated.",
    `Cancellation policy: ${summary.title}.`,
    summary.headline,
    summary.summaryText,
    refundBasisDisclosure ? `Refund basis: ${refundBasisDisclosure}` : "",
    refundTimelineText ? `Refund timeline: ${refundTimelineText}.` : "",
    scenarioText,
    summary.approvalNote,
  ]
    .filter(Boolean)
    .join("\n");
}

function diffNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  const nights = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}


function toDateInputValue(date: Date | undefined) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function fromDateInputValue(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

function toLocalDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function calculateAmenityAmount(
  amenity: NonNullable<PublicProperty["amenities"]>[number],
  nights: number
) {
  const amount = Number(amenity.amount ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amenity.feeType === "PER_NIGHT" ? amount * nights : amount;
}

type AmenityIconKey =
  | "wifi"
  | "parking"
  | "pool"
  | "beach"
  | "hotTub"
  | "bath"
  | "grill"
  | "outdoor"
  | "kitchen"
  | "coffee"
  | "gym"
  | "tv"
  | "ac"
  | "laundry"
  | "pet"
  | "workspace"
  | "fireplace"
  | "bike"
  | "boat"
  | "games"
  | "elevator"
  | "lock"
  | "baby"
  | "bed"
  | "breakfast"
  | "camera"
  | "ev"
  | "default";

const AMENITY_ICONS: Array<[string[], AmenityIconKey]> = [
  [["wifi", "wi-fi", "internet"], "wifi"],
  [["parking", "garage"], "parking"],
  [["pool", "swimming"], "pool"],
  [["beach", "beachfront", "ocean"], "beach"],
  [["bath", "bathroom", "shower", "tub"], "bath"],
  [["hot tub", "jacuzzi", "spa"], "hotTub"],
  [["bbq", "grill", "barbecue"], "grill"],
  [["outdoor", "patio", "terrace", "deck", "balcony", "yard", "garden"], "outdoor"],
  [["kitchen", "cook"], "kitchen"],
  [["coffee", "espresso"], "coffee"],
  [["gym", "fitness"], "gym"],
  [["smart tv", "tv", "television"], "tv"],
  [["air conditioning", "a/c", "air conditioner"], "ac"],
  [["washer", "dryer", "laundry", "washing machine"], "laundry"],
  [["pet", "dog", "cat"], "pet"],
  [["workspace", "desk", "office"], "workspace"],
  [["fireplace"], "fireplace"],
  [["bike", "bicycle"], "bike"],
  [["dock", "marina", "boat"], "boat"],
  [["game room", "games", "arcade", "pool table", "billiard"], "games"],
  [["elevator", "lift"], "elevator"],
  [["smart lock", "self check-in", "keyless", "safe"], "lock"],
  [["crib", "baby", "infant"], "baby"],
  [["king bed", "queen bed", "bed"], "bed"],
  [["breakfast"], "breakfast"],
  [["security camera", "camera"], "camera"],
  [["ev charger", "electric vehicle"], "ev"],
];

function getAmenityIconKey(name: string): AmenityIconKey {
  const value = name.toLowerCase();

  for (const [keywords, icon] of AMENITY_ICONS) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return icon;
    }
  }

  return "default";
}

function AmenityIcon({ name }: { name: string }) {
  const icon = getAmenityIconKey(name);

  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const shellStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    flexShrink: 0,
  };

  return (
    <span style={shellStyle} aria-hidden="true">
      {icon === "wifi" ? (
        <svg {...common}>
          <path d="M5 13a10 10 0 0 1 14 0" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M12 20h.01" />
        </svg>
      ) : icon === "parking" ? (
        <svg {...common}>
          <path d="M9 19V5h5a4 4 0 0 1 0 8H9" />
          <path d="M9 13h5" />
        </svg>
      ) : icon === "pool" || icon === "beach" || icon === "hotTub" ? (
        <svg {...common}>
          <path d="M3 16c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 2-1" />
          <path d="M3 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 2-1" />
          <path d="M7 12V5h10v7" />
        </svg>
      ) : icon === "bath" ? (
        <svg {...common}>
          <path d="M4 11h16" />
          <path d="M5 11v3a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-3" />
          <path d="M7 19l-1 2" />
          <path d="M18 19l1 2" />
          <path d="M8 11V6a3 3 0 0 1 3-3h1" />
          <path d="M12 4h4" />
          <path d="M16 4v3" />
        </svg>
      ) : icon === "grill" || icon === "fireplace" ? (
        <svg {...common}>
          <path d="M8 14a4 4 0 0 1 8 0" />
          <path d="M6 14h12" />
          <path d="M8 18h8" />
          <path d="M9 22l1-4" />
          <path d="M15 22l-1-4" />
          <path d="M12 3c1.5 1.5 1.5 3 0 4.5" />
        </svg>
      ) : icon === "outdoor" ? (
        <svg {...common}>
          <path d="M12 22V12" />
          <path d="M12 12c-4 0-7-2.5-8-7 4 0 7 2.5 8 7Z" />
          <path d="M12 12c4 0 7-2.5 8-7-4 0-7 2.5-8 7Z" />
        </svg>
      ) : icon === "kitchen" ? (
        <svg {...common}>
          <path d="M7 3v18" />
          <path d="M4 3v6a3 3 0 0 0 6 0V3" />
          <path d="M17 3v18" />
          <path d="M14 7h6" />
        </svg>
      ) : icon === "coffee" || icon === "breakfast" ? (
        <svg {...common}>
          <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
          <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
          <path d="M6 3v2" />
          <path d="M10 3v2" />
          <path d="M14 3v2" />
        </svg>
      ) : icon === "gym" ? (
        <svg {...common}>
          <path d="M6 6v12" />
          <path d="M18 6v12" />
          <path d="M3 9v6" />
          <path d="M21 9v6" />
          <path d="M6 12h12" />
        </svg>
      ) : icon === "tv" || icon === "workspace" ? (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 16v5" />
        </svg>
      ) : icon === "ac" ? (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 6l14 12" />
          <path d="M19 6L5 18" />
          <path d="M8 3l4 4 4-4" />
          <path d="M8 21l4-4 4 4" />
        </svg>
      ) : icon === "laundry" ? (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <circle cx="12" cy="13" r="4" />
          <path d="M9 7h.01" />
        </svg>
      ) : icon === "pet" ? (
        <svg {...common}>
          <circle cx="6" cy="9" r="2" />
          <circle cx="18" cy="9" r="2" />
          <circle cx="9" cy="5" r="2" />
          <circle cx="15" cy="5" r="2" />
          <path d="M8 16c0-2 2-4 4-4s4 2 4 4c0 1.5-1 3-4 3s-4-1.5-4-3Z" />
        </svg>
      ) : icon === "bike" ? (
        <svg {...common}>
          <circle cx="6" cy="17" r="3" />
          <circle cx="18" cy="17" r="3" />
          <path d="M8.5 17 12 9l3.5 8" />
          <path d="M10 9h4" />
          <path d="M14 6h2" />
        </svg>
      ) : icon === "boat" ? (
        <svg {...common}>
          <path d="M4 17h16l-2 4H6l-2-4Z" />
          <path d="M12 3v14" />
          <path d="M12 5 7 13h5" />
          <path d="M12 5l5 8h-5" />
        </svg>
      ) : icon === "games" ? (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="9" rx="4" />
          <path d="M8 12h4" />
          <path d="M10 10v4" />
          <path d="M16 12h.01" />
          <path d="M18 14h.01" />
        </svg>
      ) : icon === "elevator" ? (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M10 8l2-2 2 2" />
          <path d="M10 16l2 2 2-2" />
        </svg>
      ) : icon === "lock" ? (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M12 14v2" />
        </svg>
      ) : icon === "baby" ? (
        <svg {...common}>
          <path d="M7 10h10l-1 9H8l-1-9Z" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" />
          <path d="M9 19l-2 2" />
          <path d="M15 19l2 2" />
        </svg>
      ) : icon === "bed" ? (
        <svg {...common}>
          <path d="M4 11V5" />
          <path d="M20 19v-6a2 2 0 0 0-2-2H4v8" />
          <path d="M4 15h16" />
          <path d="M8 11V9h4v2" />
        </svg>
      ) : icon === "camera" ? (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <circle cx="12" cy="13" r="3" />
          <path d="M9 7l1.5-2h3L15 7" />
        </svg>
      ) : icon === "ev" ? (
        <svg {...common}>
          <path d="M7 2v8" />
          <path d="M11 2v8" />
          <path d="M7 10h4a3 3 0 0 1 3 3v1" />
          <path d="M14 14h3a3 3 0 0 1 3 3v5" />
          <path d="M6 22h8" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        </svg>
      )}
    </span>
  );
}

type PublicFeatureIconType =
  | "access"
  | "confirmation"
  | "checkout"
  | "communication";

function PublicFeatureIcon({ type }: { type: PublicFeatureIconType }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.trustIcon} aria-hidden="true">
      <svg {...common}>
        {type === "access" ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v2" />
          </>
        ) : type === "confirmation" ? (
          <>
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
          </>
        ) : type === "checkout" ? (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
            <path d="M7 15h3" />
            <path d="M14 15h3" />
          </>
        ) : (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        )}
      </svg>
    </span>
  );
}

type PinGoPanelIconType =
  | "access"
  | "updates"
  | "flow"
  | "property";

function PinGoPanelIcon({ type }: { type: PinGoPanelIconType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.pinGoFeatureIcon} aria-hidden="true">
      <svg {...common}>
        {type === "access" ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v2" />
          </>
        ) : type === "updates" ? (
          <>
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </>
        ) : type === "flow" ? (
          <>
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
          </>
        ) : (
          <>
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </>
        )}
      </svg>
    </span>
  );
}

type StayDetailIconType = "checkIn" | "checkOut";

function StayDetailIcon({ type }: { type: StayDetailIconType }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.stayDetailIcon} aria-hidden="true">
      <svg {...common}>
        {type === "checkIn" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        ) : (
          <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </>
        )}
      </svg>
    </span>
  );
}

function SmartStayIcon() {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span style={styles.smartStayIcon} aria-hidden="true">
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
        <path d="M9 6h6" />
        <path d="M9.5 11.5 11.5 13.5 15 10" />
      </svg>
    </span>
  );
}

export default function PublicPropertyDetailPage() {
  const { organizationSlug, propertySlug } = useParams();

  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [stayNotificationsConsent, setStayNotificationsConsent] = useState(false);  
  const [cancellationTermsAccepted, setCancellationTermsAccepted] = useState(false);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

 
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  const photos = useMemo(() => getPhotoUrls(property?.publicPhotos), [property]);
  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);

const cancellationPolicySummary = useMemo(
  () => getCancellationPolicySummary(property?.cancellationPolicy, checkIn),
  [property?.cancellationPolicy, checkIn]
);

const cancellationRefundBasisDisclosure = useMemo(
  () => getRefundBasisDisclosure(property?.cancellationPolicy),
  [property?.cancellationPolicy]
);

const cancellationTermsAcceptanceText = useMemo(
  () =>
    buildCancellationTermsAcceptanceText(
      property?.cancellationPolicy,
      cancellationPolicySummary
    ),
  [property?.cancellationPolicy, cancellationPolicySummary]
);

const requiresCancellationTermsAcceptance = Boolean(cancellationPolicySummary);

const reserveButtonDisabled =
  submitting ||
  !checkIn ||
  !checkOut ||
  (requiresCancellationTermsAcceptance && !cancellationTermsAccepted);

  const blockedDateObjects = useMemo(
    () =>
      blockedDates
      .map((dateKey) => fromDateInputValue(dateKey))
      .filter((date): date is Date => Boolean(date)),
  [blockedDates]
);

  const nightlyRate = Number(property?.baseNightlyRate ?? 0);
  const cleaningFee = Number(property?.cleaningFee ?? 0);
  const subtotal = nights * nightlyRate;
  const totalGuests = adults + children;

  const optionalAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "OPTIONAL") ?? [];

  const requiredAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "REQUIRED") ?? [];

  const includedAmenities =
    property?.amenities?.filter((a) => a.chargeMode === "INCLUDED") ?? [];

  const requiredAmenitiesTotal = requiredAmenities.reduce(
    (sum, amenity) => sum + calculateAmenityAmount(amenity, nights),
    0
  );

 const optionalAmenitiesTotal = optionalAmenities.reduce((sum, amenity) => {
  if (!selectedAmenityIds.includes(amenity.id)) {
    return sum;
  }

  return sum + calculateAmenityAmount(amenity, nights);
}, 0);

const taxableSubtotal =
  subtotal +
  cleaningFee +
  requiredAmenitiesTotal +
  optionalAmenitiesTotal;

const taxesTotal = (property?.taxes ?? []).reduce((sum, tax) => {
  const percentage = Number(tax.percentage ?? 0);

  if (!Number.isFinite(percentage) || percentage <= 0) {
    return sum;
  }

  return sum + taxableSubtotal * (percentage / 100);
}, 0);

const total =
  pricing?.totalAmount ??
  taxableSubtotal + taxesTotal;
  
const displayNightlySubtotal = pricing?.nightlySubtotal ?? subtotal;
const displayCleaningFee = pricing?.cleaningFee ?? cleaningFee;
const displayTotal = pricing?.totalAmount ?? total;

const location = [
    property?.address1,
    property?.city,
    property?.region,
    property?.country,
  ]
    .filter(Boolean)
    .join(", ");

  function updateAdults(nextValue: number) {
    const maxGuests = property?.maxGuests ?? 99;
    const safeValue = Math.max(1, Math.min(nextValue, maxGuests - children));
    setAdults(safeValue);
  }

  function updateChildren(nextValue: number) {
    const maxGuests = property?.maxGuests ?? 99;
    const safeValue = Math.max(0, Math.min(nextValue, maxGuests - adults));
    setChildren(safeValue);
  }

function formatDisplayTime(time?: string | null) {
  if (!time) return null;

  const parts = time.split(":");

  if (parts.length < 2) {
    return time;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setPageError(null);

        const res = await fetch(
          `${API_BASE}/api/public-booking/${organizationSlug}/${propertySlug}`
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Property not found");
        }

        if (active) {
          setProperty(data.property ?? data.item);
        }
      } catch (err: any) {
        if (active) {
          setPageError(err?.message || "Failed to load property");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (organizationSlug && propertySlug) {
      load();
    }

    return () => {
      active = false;
    };
  }, [organizationSlug, propertySlug]);

useEffect(() => {
  if (!property?.id) return;

  let active = true;

  async function loadBlockedDates() {
    try {
      const today = new Date();
      const from = toDateInputValue(today);
      const to = toDateInputValue(addDays(today, 365));

      const res = await fetch(`${API_BASE}/api/public-booking/blocked-dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property?.id,
          from,
          to,
        }),
      });

      const data = await res.json();

      if (!active) return;

      if (!res.ok || !data.ok) {
        setBlockedDates([]);
        return;
      }

      setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
    } catch (err) {
  console.error("[blocked dates frontend error]", err);
  if (active) {
    setBlockedDates([]);
  }
}

  }

  loadBlockedDates();

  return () => {
    active = false;
  };
}, [property?.id]);

useEffect(() => {
  let active = true;

  async function loadPricing() {
    try {
      if (!property?.id || !checkIn || !checkOut || nights <= 0) {
        setPricing(null);
        return;
      }

      const res = await fetch(`${API_BASE}/api/public-booking/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
          selectedAmenityIds,
        }),
      });

      const data = await res.json();

      if (!active) return;

      if (!res.ok || !data.ok) {
        setPricing(null);
        return;
      }

      setPricing(data.pricing);
    } catch (err) {
      console.error("[pricing quote error]", err);

      if (active) {
        setPricing(null);
      }
    }
  }

  loadPricing();

  return () => {
    active = false;
  };
}, [
  property?.id,
  checkIn,
  checkOut,
  selectedAmenityIds,
  nights,
]);

useEffect(() => {
  setCancellationTermsAccepted(false);
}, [
  checkIn,
  checkOut,
  property?.cancellationPolicy?.policyId,
  property?.cancellationPolicy?.snapshotAt,
  property?.cancellationPolicy?.refundBasis,
]); 
 
  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setBookingError(null);

      if (!property) {
        throw new Error("Property not loaded");
      }

      if (!checkIn || !checkOut || !guestName.trim() || !guestEmail.trim()) {
        throw new Error("Please complete check-in, check-out, name and email.");
      }

      if (nights <= 0) {
        throw new Error("Check-out must be after check-in.");
      }

      if (
        requiresCancellationTermsAcceptance &&
        !cancellationTermsAccepted
      ) {
        throw new Error(
          "Please review and accept the cancellation terms to continue."
        );
      }

      if (nights < (property.minimumNights ?? 1)) {
        throw new Error(
          `Minimum stay is ${property.minimumNights ?? 1} night(s).`
        );
      }

      if (property.maximumNights && nights > property.maximumNights) {
        throw new Error(`Maximum stay is ${property.maximumNights} night(s).`);
      }

      const res = await fetch(`${API_BASE}/api/public-booking/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
  propertyId: property.id,
  checkIn,
  checkOut,
  guestName: guestName.trim(),
  adults,
  children,
  guestEmail: guestEmail.trim(),
  guestPhone: guestPhone.trim(),
  stayNotificationsConsent,
  guestAcceptedCancellationTerms: cancellationTermsAccepted,
  guestAcceptedCancellationTermsAt: cancellationTermsAccepted
    ? new Date().toISOString()
    : null,
  guestAcceptedCancellationTermsText: cancellationTermsAcceptanceText,
  cancellationPolicyRefundBasis: property.cancellationPolicy?.refundBasis ?? null,
  selectedAmenityIds,
}),
      });

      const data = await res.json();

      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to create checkout.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setBookingError(err?.message || "Unable to reserve this property.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to={`/book/${organizationSlug}`} style={styles.brandWrap}>
            <img
              src="/pin-go-logo.png"
              alt="Pin&Go logo"
              style={styles.logo}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <div style={styles.brandName}>Pin&Go</div>
              <div style={styles.slogan}>Direct Booking</div>
            </div>
          </Link>
        </div>
      </header>

      <main>
        {loading ? (
          <section style={styles.heroSection}>
            <div style={styles.heroContainer}>
              <h1 style={styles.heroTitle}>Loading property...</h1>
            </div>
          </section>
        ) : pageError || !property ? (
          <section style={styles.sectionAlt}>
            <div style={styles.container}>
              <div style={styles.errorBox}>{pageError || "Property not found"}</div>
            </div>
          </section>
        ) : (
          <>
            <section style={styles.heroSection}>
              <div style={styles.heroContainer}>
                <div style={styles.badge}>{property.organization.name}</div>

                <h1 style={styles.heroTitle}>
                  {property.publicTitle || property.name}
                </h1>

                <div style={styles.heroMeta}>
                  {location ? <span>📍 {location}</span> : null}

                  {property.maxGuests ? (
                    <span>👥 Up to {property.maxGuests} guests</span>
                  ) : null}

                  <span>🌙 Minimum {property.minimumNights ?? 1} night(s)</span>
                </div>

                             </div>
            </section>
<section style={styles.sectionAlt}>
  <div style={styles.container}>
    <div style={styles.topBookingGrid}>
      <div style={styles.topBookingLeft}>
        <div style={styles.enterpriseGallery}>
          {photos.length > 1 ? (
            <button
              type="button"
              style={styles.showAllPhotosButton}
              onClick={() => setSelectedPhotoIndex(0)}
            >
              📷 Show all {photos.length} photos
            </button>
          ) : null}

          {photos.length > 0 ? (
            <>
              <img
         
  src={photos[0]}
  alt={property.publicTitle || property.name}
  style={{
    ...styles.galleryMainImage,
    cursor: "pointer",
  }}
  onClick={() => setSelectedPhotoIndex(0)}
/>
                      <div style={styles.gallerySideGrid}>
                        {photos.slice(1, 5).map((photo, index) => (
  <img
    key={photo}
    src={photo}
    alt={property.publicTitle || property.name}
    style={{
      ...styles.gallerySideImage,
      cursor: "pointer",
    }}
    onClick={() => setSelectedPhotoIndex(index + 1)}
  />
))}
                        {photos.length === 1 ? (
                          <div style={styles.galleryEmpty}>Pin&Go Stay</div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div style={styles.photoPlaceholder}>
  <div style={styles.placeholderContent}>
    <div style={styles.placeholderBadge}>Direct Booking</div>
    <div>Premium stay powered by Pin&Go</div>
    <span style={styles.placeholderText}>
      Add property photos.
    </span>
  </div>
</div>
                  )}
                </div>
      </div>

      {/* aquí va el form bookingCard movido */}
    </div>

                <div style={styles.detailGrid}>
                     <div style={styles.leftColumn}>
  <div style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>Property Overview</div>

    <h2 style={styles.sectionTitle}>
      {property.publicTitle || property.name}
    </h2>

    <p style={styles.overviewText}>
      {property.publicDescription ||
        "This property offers a modern and comfortable stay powered by Pin&Go."}
    </p>
  </div>

  <div style={styles.infoCard}>
    <div style={styles.sectionEyebrow}>Stay Details</div>

    <div style={styles.stayDetailsGrid}>
      <div style={styles.stayDetailItem}>
        <StayDetailIcon type="checkIn" />

        <div>
          <strong>Check-In</strong>
          <div>
            {formatDisplayTime(property.checkInTime) || "Configured by host"}
          </div>
        </div>
      </div>

      <div style={styles.stayDetailItem}>
        <StayDetailIcon type="checkOut" />

        <div>
          <strong>Check-Out</strong>
          <div>
            {formatDisplayTime(property.checkOutTime) || "11:00 AM"}
          </div>
        </div>
      </div>
    </div>
  </div>
                  
<div style={styles.securePreCheckinDisclosure}>
  <div style={styles.securePreCheckinDisclosureHeader}>
    <div style={styles.securePreCheckinDisclosureIcon} aria-hidden="true">
      🛡️
    </div>

    <div>
      <div style={styles.securePreCheckinDisclosureEyebrow}>
        Required before access is released
      </div>

      <h3 style={styles.securePreCheckinDisclosureTitle}>
        Secure Pre-check-in Required
      </h3>

      <div style={styles.securePreCheckinDisclosureSpanishTitle}>
        Registro seguro requerido
      </div>
    </div>
  </div>

  <div style={styles.securePreCheckinDisclosureText}>
    <p style={styles.securePreCheckinDisclosureParagraph}>
      After booking, the primary guest must complete Identity Check and accept
      the Guest Agreement before Pin&amp;Go releases access credentials.
    </p>

    <p style={styles.securePreCheckinDisclosureParagraph}>
      Después de reservar, el huésped principal deberá completar la
      Verificación de Identidad y aceptar el Acuerdo del Huésped antes de que
      Pin&amp;Go libere las credenciales de acceso.
    </p>
  </div>

  <div style={styles.securePreCheckinSteps}>
    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>1</span>
      <span>Reservation confirmed / Reservación confirmada</span>
    </div>

    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>2</span>
      <span>Identity Check / Verificación de identidad</span>
    </div>

    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>3</span>
      <span>Guest Agreement / Acuerdo del huésped</span>
    </div>

    <div style={styles.securePreCheckinStep}>
      <span style={styles.securePreCheckinStepNumber}>4</span>
      <span>Access released / Acceso liberado</span>
    </div>
  </div>

  <div style={styles.securePreCheckinDisclosureNotice}>
    Your reservation is confirmed after payment, but access remains pending
    until Secure Pre-check-in is completed.
    <br />
    Su reservación queda confirmada después del pago, pero el acceso permanece
    pendiente hasta completar el Registro Seguro.
  </div>
</div>

  <div style={styles.trustSection}>
    <div style={styles.sectionEyebrow}>Property Highlights</div>

  <h3 style={styles.trustTitle}>Designed for a smoother stay</h3>

 <div style={styles.trustGrid}>
  <div style={styles.trustCard}>
    <PublicFeatureIcon type="access" />
    <strong>Smart access</strong>
    <span>Digital access prepared for your stay.</span>
  </div>

  <div style={styles.trustCard}>
    <PublicFeatureIcon type="confirmation" />
    <strong>Instant confirmation</strong>
    <span>Booking details delivered after payment.</span>
  </div>

  <div style={styles.trustCard}>
    <PublicFeatureIcon type="checkout" />
    <strong>Secure checkout</strong>
    <span>Protected payment through Stripe.</span>
  </div>

  <div style={styles.trustCard}>
    <PublicFeatureIcon type="communication" />
    <strong>Direct communication</strong>
    <span>Stay connected with the host.</span>
  </div>
</div>
 {includedAmenities.length > 0 ? (
    <div style={styles.includedAmenitiesBox}>
      <div style={styles.includedAmenitiesTitle}>Included with your stay</div>

      <div style={styles.includedAmenitiesGrid}>
        {includedAmenities.map((amenity) => (
         <div key={amenity.id} style={styles.includedAmenityPill}>
  <AmenityIcon name={amenity.name} />
  <span>{amenity.name}</span>
</div>
       
        ))}
      </div>
    </div>
  ) : null}
</div>

                    
                    <div style={styles.pinGoPanel}>
                      <div>
                        <div style={styles.sectionEyebrow}>Powered by Pin&Go</div>
                        <h3 style={styles.pinGoTitle}>
                          Smart hospitality behind every stay
                        </h3>
                        <p style={styles.pinGoText}>
                          This reservation experience is powered by Pin&Go,
                          connecting secure payments, smart access, guest
                          messaging, and property automation into one seamless
                          stay.
                        </p>
                      </div>
                       <div style={styles.pinGoFeatureGrid}>
  <div style={styles.pinGoFeature}>
    <PinGoPanelIcon type="access" />
    <span>Smart access</span>
  </div>

  <div style={styles.pinGoFeature}>
    <PinGoPanelIcon type="updates" />
    <span>Guest updates</span>
  </div>

  <div style={styles.pinGoFeature}>
    <PinGoPanelIcon type="flow" />
    <span>Contactless flow</span>
  </div>

  <div style={styles.pinGoFeature}>
    <PinGoPanelIcon type="property" />
    <span>Smart property</span>
  </div>
</div>
                     
                    </div>
                  </div>

                  <form onSubmit={handleReserve} style={styles.bookingCard}>
                    <div style={styles.bookingHeader}>
                      <div>
                        <div style={styles.bookingPrice}>
  <div style={styles.bookingPricePrefix}>
    Starting at
  </div>

  {formatNightlyDisplayMoney(property.baseNightlyRate)}

  <span style={styles.bookingPriceUnit}>
    / night
  </span>
</div>
                        <div style={styles.bookingSubtitle}>
                          Book your stay securely
                        </div>
                      </div>

                      <div style={styles.bookingBadge}>Direct</div>
                    </div>

                  <div style={styles.calendarBox}>
  <div style={styles.calendarHeader}>
    <div style={styles.calendarDatePanel}>
      <div style={styles.calendarLabel}>Check-in</div>
      <div style={styles.calendarValue}>
        {checkIn ? format(fromDateInputValue(checkIn)!, "MMM d, yyyy") : "Add date"}
      </div>
    </div>

    <div style={styles.calendarDatePanel}>
      <div style={styles.calendarLabel}>Check-out</div>
      <div style={styles.calendarValue}>
        {checkOut ? format(fromDateInputValue(checkOut)!, "MMM d, yyyy") : "Add date"}
      </div>
    </div>
  </div>

 <div style={styles.calendarShell}>
    <DayPicker     
      mode="range"
      numberOfMonths={2}
      selected={{
        from: fromDateInputValue(checkIn),
        to: fromDateInputValue(checkOut),
      }}
      onSelect={(range: DateRange | undefined) => {
        setCheckIn(toDateInputValue(range?.from));
        setCheckOut(toDateInputValue(range?.to));
      }}  
      disabled={(date) =>
        date < new Date(new Date().setHours(0, 0, 0, 0)) ||
        blockedDates.includes(toLocalDateKey(date))
      }

     />
  </div>
</div>
                        <div style={styles.guestSelector}>
                      <div style={styles.guestRow}>
                        <div>
                          <div style={styles.guestLabel}>Adults</div>
                          <div style={styles.guestHint}>Ages 13 or above</div>
                        </div>

                        <div style={styles.stepper}>
                          <button
                            type="button"
                            onClick={() => updateAdults(adults - 1)}
                            disabled={adults <= 1}
                            style={{
                              ...styles.stepperButton,
                              ...(adults <= 1 ? styles.stepperButtonDisabled : {}),
                            }}
                          >
                            −
                          </button>

                          <strong style={styles.stepperValue}>{adults}</strong>

                          <button
                            type="button"
                            onClick={() => updateAdults(adults + 1)}
                            disabled={
                              property.maxGuests
                                ? totalGuests >= property.maxGuests
                                : false
                            }
                            style={{
                              ...styles.stepperButton,
                              ...(property.maxGuests &&
                              totalGuests >= property.maxGuests
                                ? styles.stepperButtonDisabled
                                : {}),
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div style={styles.guestRowLast}>
                        <div>
                          <div style={styles.guestLabel}>Children</div>
                          <div style={styles.guestHint}>Ages 2–12</div>
                        </div>

                        <div style={styles.stepper}>
                          <button
                            type="button"
                            onClick={() => updateChildren(children - 1)}
                            disabled={children <= 0}
                            style={{
                              ...styles.stepperButton,
                              ...(children <= 0 ? styles.stepperButtonDisabled : {}),
                            }}
                          >
                            −
                          </button>

                          <strong style={styles.stepperValue}>{children}</strong>

                          <button
                            type="button"
                            onClick={() => updateChildren(children + 1)}
                            disabled={
                              property.maxGuests
                                ? totalGuests >= property.maxGuests
                                : false
                            }
                            style={{
                              ...styles.stepperButton,
                              ...(property.maxGuests &&
                              totalGuests >= property.maxGuests
                                ? styles.stepperButtonDisabled
                                : {}),
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                  
                    <label style={styles.field}>
                      <span>Full name</span>
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Guest name"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span>Email</span>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="guest@email.com"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span>Phone</span>
                      <input
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+1..."
                        style={styles.input}
                      />
                    </label>

                <div style={styles.stayNotificationsCard}>
  <label style={styles.stayNotificationsLabel}>
    <input
      type="checkbox"
      checked={stayNotificationsConsent}
      onChange={(e) => setStayNotificationsConsent(e.target.checked)}
      style={styles.stayNotificationsCheckbox}
    />

    <div>
      <div style={styles.stayNotificationsTitle}>
        <SmartStayIcon />
        <span>Pin&Go Smart Stay SMS Updates (Optional)</span>
      </div>

      <div style={styles.stayNotificationsText}>
        Receive important updates about your stay, including your booking
        confirmation, smart lock access code, check-in instructions,
        check-out reminders, and important property alerts.
      </div>

      <div style={styles.stayNotificationsLegal}>
        Message frequency varies. Message &amp; data rates may apply.
        Reply STOP to opt out and HELP for assistance.
      </div>

      {/* NUEVO BLOQUE */}
      <div style={styles.stayNotificationsLegal}>
        SMS consent is optional and is not required to complete this reservation.
        Reservation confirmation and check-in instructions will also be delivered by email.
      </div>

    </div>
  </label>
</div>
                    {optionalAmenities.length > 0 ? (
                      <div style={styles.addOnsBox}>
                        <div style={styles.addOnsTitle}>Optional add-ons</div>

                        {optionalAmenities.map((amenity) => {
                          const amenityAmount = calculateAmenityAmount(amenity, nights);
                          const checked = selectedAmenityIds.includes(amenity.id);

                          return (
                            <label key={amenity.id} style={styles.addOnItem}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAmenityIds((prev) =>
                                      prev.includes(amenity.id)
                                        ? prev
                                        : [...prev, amenity.id]
                                    );
                                  } else {
                                    setSelectedAmenityIds((prev) =>
                                      prev.filter((id) => id !== amenity.id)
                                    );
                                  }
                                }}
                                style={styles.addOnCheckbox}
                              />

                              <div style={{ flex: 1 }}>
                                <div style={styles.addOnHeader}>
                                  <strong>{amenity.name}</strong>
                                  <span>{formatMoney(amenityAmount)}</span>
                                </div>

                                {amenity.description ? (
                                  <div style={styles.addOnDescription}>
                                    {amenity.description}
                                  </div>
                                ) : null}

                                <div style={styles.addOnMeta}>
                                  {amenity.feeType === "PER_NIGHT"
                                    ? "Per night"
                                    : "Per stay"}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}

                    <div style={styles.priceBox}>
                      <div style={styles.priceBoxTitle}>Price details</div>

                      <div style={styles.priceRow}>
                        <span>Guests</span>
                        <strong>{totalGuests}</strong>
                      </div>

                      <div style={styles.priceRow}>
                        <span>
  {pricing?.nightlyRates?.length
    ? "Nightly rates"
    : `${formatMoney(property.baseNightlyRate)} × ${nights || 0} nights`}
</span>
  <strong>{formatNightlyDisplayMoney(displayNightlySubtotal)}</strong>
                      </div>
{pricing?.nightlyRates?.length ? (
  <div style={styles.nightlyRatesBreakdown}>
    {pricing.nightlyRates.map((item: any) => (
      <div key={item.date} style={styles.nightlyRateItem}>
        <span>{format(fromDateInputValue(item.date)!, "MMM d, yyyy")}</span>
        <strong>{formatNightlyDisplayMoney(item.rate)}</strong>
      </div>
    ))}
  </div>
) : null}

                      <div style={styles.priceRow}>
                        <span>Cleaning fee</span>
                        <strong>{formatMoney(displayCleaningFee)}</strong>
                      </div>

                      {requiredAmenities.map((amenity) => (
                        <div key={amenity.id} style={styles.priceRow}>
                          <span>{amenity.name}</span>
                          <strong>
                            {formatMoney(calculateAmenityAmount(amenity, nights))}
                          </strong>
                        </div>
                      ))}

                      {optionalAmenities
                        .filter((amenity) => selectedAmenityIds.includes(amenity.id))
                        .map((amenity) => (
                          <div key={amenity.id} style={styles.priceRow}>
                            <span>{amenity.name}</span>
                            <strong>
                              {formatMoney(calculateAmenityAmount(amenity, nights))}
                            </strong>
                          </div>
                        ))}

                      
                       {(property?.taxes ?? []).map((tax) => {
  const percentage = Number(tax.percentage ?? 0);

  const amount = taxableSubtotal * (percentage / 100);

  return (
    <div key={tax.id} style={styles.priceRow}>
      <span>
        {tax.name} ({percentage}%)
      </span>
      <strong>{formatMoney(amount)}</strong>
    </div>
  );
})}

                      <div style={styles.totalRow}>
                        <span>Total</span>
                        <strong>{formatMoney(displayTotal)}</strong>
                      </div>
                    </div>

                  {cancellationPolicySummary ? (
  <div style={styles.cancellationPolicyBox}>
    <div style={styles.cancellationPolicyHeader}>
      <span style={styles.cancellationPolicyIcon}>↩</span>

      <div>
        <div style={styles.cancellationPolicyEyebrow}>
          Cancellation policy
        </div>
        <div style={styles.cancellationPolicyTitle}>
          {cancellationPolicySummary.title}
        </div>
      </div>
    </div>

    <div style={styles.cancellationPolicyHeadline}>
      {cancellationPolicySummary.headline}
    </div>

    <p style={styles.cancellationPolicyText}>
      {cancellationPolicySummary.summaryText}
    </p>

    <div style={styles.cancellationTimeline}>
      {cancellationPolicySummary.rules.map((rule, index) => (
        <div
          key={`${rule.label}-${rule.minHoursBeforeCheckIn}-${index}`}
          style={styles.cancellationTimelineItem}
        >
          <div
            style={{
              ...styles.cancellationTimelineMarker,
              ...(rule.tone === "success"
                ? styles.cancellationTimelineMarkerSuccess
                : rule.tone === "warning"
                ? styles.cancellationTimelineMarkerWarning
                : styles.cancellationTimelineMarkerDanger),
            }}
          >
            {rule.refundPercent >= 100
              ? "✓"
              : rule.refundPercent > 0
              ? "%"
              : "×"}
          </div>

          <div style={styles.cancellationTimelineContent}>
            <div style={styles.cancellationTimelineTopRow}>
              <strong>{rule.label}</strong>

              <span
                style={{
                  ...styles.cancellationRefundBadge,
                  ...(rule.tone === "success"
                    ? styles.cancellationRefundBadgeSuccess
                    : rule.tone === "warning"
                    ? styles.cancellationRefundBadgeWarning
                    : styles.cancellationRefundBadgeDanger),
                }}
              >
                {formatRefundPercent(rule.refundPercent)}
              </span>
            </div>

            <div style={styles.cancellationTimelineWindow}>
              {rule.windowLabel}
            </div>

            {rule.dateLabel ? (
              <div style={styles.cancellationTimelineDate}>
                {rule.dateLabel}
              </div>
            ) : null}

            {rule.description ? (
              <div style={styles.cancellationTimelineDescription}>
                {rule.description}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>

    {cancellationPolicySummary.scenarios.length > 0 ? (
      <div style={styles.cancellationExceptionsBox}>
        <div style={styles.cancellationExceptionsTitle}>
          Important non-refundable cases
        </div>

        <div style={styles.cancellationScenarioGrid}>
          {cancellationPolicySummary.scenarios.map((scenario) => (
            <span key={scenario} style={styles.cancellationScenarioPill}>
              {getScenarioLabel(scenario)}
            </span>
          ))}
        </div>
      </div>
    ) : null}

    <div style={styles.cancellationPolicyNote}>
      {cancellationPolicySummary.approvalNote}
    </div>
  </div>
) : null}

                    {cancellationPolicySummary ? (
                      <div style={styles.cancellationTermsAcknowledgmentCard}>
                        <label style={styles.cancellationTermsAcknowledgmentLabel}>
                          <input
                            type="checkbox"
                            checked={cancellationTermsAccepted}
                            onChange={(e) =>
                              setCancellationTermsAccepted(e.target.checked)
                            }
                            style={styles.cancellationTermsCheckbox}
                          />

                          <div>
                            <div style={styles.cancellationTermsTitle}>
                              I have reviewed and agree to the cancellation terms.
                            </div>

                            <div style={styles.cancellationTermsText}>
                              I understand that any eligible refund will be
                              calculated according to the policy shown above.
                            </div>

                            {cancellationRefundBasisDisclosure ? (
                              <div style={styles.refundBasisDisclosure}>
                                <strong style={styles.refundBasisDisclosureTitle}>
                                  Refund calculation
                                </strong>

                                <span style={styles.refundBasisDisclosureText}>
                                  {cancellationRefundBasisDisclosure}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </label>
                      </div>
                    ) : null}

                    {bookingError ? (
                      <div style={styles.inlineError}>{bookingError}</div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={reserveButtonDisabled}
                      style={{
                        ...styles.reserveButton,
                        ...(reserveButtonDisabled
  ? styles.reserveButtonDisabled
  : {}),

                      }}
                    >
                      {submitting ? "Preparing checkout..." : "Reserve now"}
                    </button>

                 <div style={styles.paymentMethods}>
  <div style={styles.paymentTrustRow}>
    <span style={styles.paymentTrustIcon}>🔒</span>
    <span>
      Secure payments powered by{" "}
      <strong style={styles.stripeText}>Stripe</strong>
    </span>
  </div>
<div style={styles.paymentLogosRow}>
  <img src="/payments/visa.svg" alt="Visa" style={styles.paymentLogo} />
  <img src="/payments/mastercard.svg" alt="Mastercard" style={styles.paymentLogo} />
  <img src="/payments/amex.svg" alt="American Express" style={styles.paymentLogo} />
  <img src="/payments/apple-pay.svg" alt="Apple Pay" style={styles.paymentLogo} />
  <img src="/payments/google-pay.svg" alt="Google Pay" style={styles.paymentLogo} />
  <img src="/payments/klarna.svg" alt="Klarna" style={styles.paymentLogo} />
  <img src="/payments/amazon-pay.svg" alt="Amazon Pay" style={styles.paymentLogo} />
</div>
</div>


                    <p style={styles.disclaimer}>
                      You will be redirected to Stripe Checkout to complete your
                      payment.
                    </p>
                 <div style={styles.legalLinks}>
  <span>
    By completing your reservation, you agree to Pin&amp;Go&apos;s{" "}
    <Link to="/legal/terms" style={styles.legalLink}>
      Terms of Service
    </Link>{" "}
    and{" "}
    <Link to="/legal/privacy" style={styles.legalLink}>
      Privacy Policy
    </Link>
    .
  </span>
</div>
                 </form>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
{selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
  <div
    style={styles.lightboxOverlay}
    onClick={() => setSelectedPhotoIndex(null)}
  >
    <div
      style={styles.lightboxContent}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        style={styles.lightboxClose}
        onClick={() => setSelectedPhotoIndex(null)}
      >
        ✕
      </button>

      <img
        src={photos[selectedPhotoIndex]}
        alt="Property"
        style={styles.lightboxImage}
      />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            style={styles.lightboxPrev}
            onClick={() =>
              setSelectedPhotoIndex(
                selectedPhotoIndex === 0
                  ? photos.length - 1
                  : selectedPhotoIndex - 1
              )
            }
          >
            ‹
          </button>

          <button
            type="button"
            style={styles.lightboxNext}
            onClick={() =>
              setSelectedPhotoIndex(
                selectedPhotoIndex === photos.length - 1
                  ? 0
                  : selectedPhotoIndex + 1
              )
            }
          >
            ›
          </button>
        </>
      )}
    </div>
  </div>
)}

      <footer style={styles.footer}>
        <div style={styles.container}>
          © Pin&Go. Direct booking powered by autonomous property operations.
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#0f172a",
    backgroundColor: "#ffffff",
    minHeight: "100vh",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.92)",
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
    textDecoration: "none",
    color: "#0f172a",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    borderRadius: 10,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  slogan: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    fontWeight: 700,
  },
  heroSection: {
    padding: "76px 20px 56px",
    background:
      "radial-gradient(circle at 20% 0%, rgba(37,99,235,0.12), transparent 32%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  heroContainer: {
     maxWidth: 1100,
     margin: "0 auto",
     textAlign: "center",
     padding: "0 20px",
    },
  badge: {
    display: "inline-block",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 18,
    border: "1px solid #bfdbfe",
  },
  heroTitle: {
    fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.055em",
    maxWidth: 900,
    margin: "0 auto",
  },
  heroMeta: {
    margin: "18px auto 0",
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    color: "#334155",
    fontSize: 14,
    fontWeight: 850,
  },
  heroSubtitle: {
    maxWidth: 850,
    margin: "20px auto 0",
    fontSize: 20,
    lineHeight: 1.7,
    color: "#475569",
  },
  sectionAlt: {
    padding: "42px 20px 72px",
    background: "#f8fafc",
  },
  container: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  enterpriseGallery: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.85fr)",
    gap: 14,
    marginBottom: 26,
    alignItems: "stretch",
  },
  galleryMainImage: {
    width: "100%",
    height: 440,
    objectFit: "cover",
    borderRadius: 28,
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.10)",
  },
  gallerySideGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  gallerySideImage: {
    width: "100%",
    height: 213,
    objectFit: "cover",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
  },
  galleryEmpty: {
    minHeight: 213,
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontWeight: 900,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.08), rgba(59,130,246,0.12))",
    border: "1px solid #e2e8f0",
  },

 photoPlaceholder: {
  minHeight: "clamp(260px, 38vw, 430px)",
  borderRadius: 32,
  display: "grid",
  placeItems: "center",
  color: "#ffffff",
  fontWeight: 950,
  fontSize: 28,
  letterSpacing: "-0.04em",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(29,78,216,0.78)), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28), transparent 28%)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 24px 70px rgba(15,23,42,0.22)",
  gridColumn: "1 / -1",
},

placeholderContent: {
  textAlign: "center",
  display: "grid",
  gap: 12,
  padding: 24,
},

placeholderBadge: {
  justifySelf: "center",
  borderRadius: 999,
  padding: "8px 13px",
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
},

placeholderText: {
  maxWidth: 520,
  color: "rgba(255,255,255,0.76)",
  fontSize: 15,
  lineHeight: 1.6,
  fontWeight: 700,
},

detailGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
  gap: 24,
  alignItems: "start",
},  
  leftColumn: {
    display: "grid",
    gap: 20,
  },
  infoCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#2563eb",
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  
  infoList: {
    marginTop: 24,
    display: "grid",
    gap: 14,
  },
  infoItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 14,
    color: "#334155",
    fontSize: 15,
  },
  trustSection: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 30,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },
  trustTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    color: "#0f172a",
  },
 
 trustGrid: {
  marginTop: 22,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
},

trustCard: {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  color: "#0f172a",
},
   
trustIcon: {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",

},

overviewText: {
  marginTop: 20,
  color: "#475569",
  lineHeight: 1.8,
  fontSize: 16,
},

stayDetailsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 16,
  marginTop: 20,
},

stayDetailItem: {
  display: "flex",
  gap: 14,
  alignItems: "center",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
},

stayDetailIcon: {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  flexShrink: 0,
},

pinGoPanel: {
  background:
    "radial-gradient(circle at 15% 20%, rgba(96,165,250,0.45), transparent 28%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #1d4ed8 100%)",
  color: "#fff",
  borderRadius: 32,
  padding: 34,
  display: "grid",
  gap: 26,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  overflow: "hidden",
  position: "relative",
},

  pinGoTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  pinGoText: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 1.7,
    fontSize: 15,
  },
 pinGoFeatureGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
},

 pinGoFeature: {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.20)",
  borderRadius: 20,
  padding: "14px 15px",
  fontSize: 14,
  fontWeight: 950,
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
},

pinGoFeatureIcon: {
  width: 32,
  height: 32,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "#ffffff",
  flexShrink: 0,
},
 
  securePreCheckinDisclosure: {
  marginTop: 24,
  padding: 24,
  borderRadius: 22,
  border: "1px solid #bfdbfe",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96), rgba(248,250,252,0.98))",
  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.07)",
},

securePreCheckinDisclosureHeader: {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
},

securePreCheckinDisclosureIcon: {
  width: 46,
  height: 46,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "#dbeafe",
  border: "1px solid #bfdbfe",
  fontSize: 22,
},

securePreCheckinDisclosureEyebrow: {
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
},

securePreCheckinDisclosureTitle: {
  margin: "5px 0 0",
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.025em",
},

securePreCheckinDisclosureSpanishTitle: {
  marginTop: 4,
  color: "#334155",
  fontSize: 16,
  fontWeight: 850,
},

securePreCheckinDisclosureText: {
  marginTop: 18,
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.65,
},

securePreCheckinDisclosureParagraph: {
  margin: "0 0 10px",
},

securePreCheckinSteps: {
  marginTop: 18,
  display: "grid",
  gap: 10,
},

securePreCheckinStep: {
  display: "flex",
  alignItems: "center",
  gap: 11,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
},

securePreCheckinStepNumber: {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background: "#ffffff",
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 950,
},

securePreCheckinDisclosureNotice: {
  marginTop: 18,
  paddingTop: 16,
  borderTop: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 800,
},

 bookingCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.14)",
    position: "static",
    top: "auto",
  },
  bookingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 22,
    paddingBottom: 18,
    borderBottom: "1px solid #e2e8f0",
  },
  bookingPrice: {
    fontSize: 38,
    fontWeight: 950,
    color: "#0f172a",
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
  },
  bookingPriceUnit: {
    fontSize: 16,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 0,
  },
 bookingPricePrefix: {
  display: "block",
  fontSize: 13,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.02em",
  marginBottom: 4,
},
bookingSubtitle: {
  marginTop: 6,
  fontSize: 14,
  color: "#64748b",
  fontWeight: 700,
},

  bookingBadge: {
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid #bfdbfe",
  },
  field: {
    marginTop: 16,
    display: "grid",
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 15,
    outline: "none",
    background: "#fff",
  },
  guestSelector: {
    marginTop: 16,
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    overflow: "hidden",
    background: "#fff",
  },
  guestRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 14px",
    borderBottom: "1px solid #e2e8f0",
  },
  guestRowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "16px 14px",
  },
  guestLabel: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },
  guestHint: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    lineHeight: 1,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  stepperValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 16,
    color: "#0f172a",
  },
  secondaryButton: {
     marginTop: 16,
     width: "100%",
     border: "1px solid #16a34a",
     borderRadius: 18,
     background: "#16a34a",
    color: "#fff",
    padding: "14px 16px",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 10px 24px rgba(22,163,74,0.25)",
    },
  secondaryButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  availabilityBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  availabilityBoxSuccess: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
  },
  availabilityBoxError: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
  },
  addOnsBox: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
    background: "#eff6ff",
  },
  addOnsTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    marginBottom: 2,
  },
  addOnItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
  },
  addOnCheckbox: {
    marginTop: 3,
  },
  addOnHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#0f172a",
    fontSize: 14,
  },
  addOnDescription: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  addOnMeta: {
    marginTop: 4,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 900,
  },
  priceBox: {
    marginTop: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
    background: "#f8fafc",
  },
  priceBoxTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    marginBottom: 2,
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#475569",
    fontSize: 14,
  },
  nightlyRatesBreakdown: {
  display: "grid",
  gap: 8,
  padding: "10px 0 4px",
  borderBottom: "1px solid #e2e8f0",
},

nightlyRateItem: {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#64748b",
  fontSize: 13,
},

includedAmenitiesRow: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },
 includedAmenitiesBox: {
  marginTop: 22,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 18,
},

includedAmenitiesTitle: {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 14,
},

includedAmenitiesGrid: {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
},

includedAmenityPill: {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 18,
  padding: "9px 13px 9px 9px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
},
 
 reserveButton: {
    marginTop: 18,
    width: "100%",
    border: "none",
    borderRadius: 18,
    background: "#1d4ed8",
    color: "#fff",
    padding: "15px 18px",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
     boxShadow: "0 12px 28px rgba(29,78,216,0.28)",
  },
  reserveButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    textAlign: "center",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 18,
    padding: 24,
    textAlign: "center",
    fontWeight: 800,
  },
  inlineError: {
    marginTop: 14,
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: 800,
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    padding: "24px 20px",
    color: "#64748b",
    fontSize: 14,
    background: "#fff",
    textAlign: "center",
  },
lightboxOverlay: {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
},

lightboxContent: {
  position: "relative",
  width: "100%",
  maxWidth: 1400,
},

lightboxImage: {
  width: "100%",
  maxHeight: "90vh",
  objectFit: "contain",
  borderRadius: 20,
},

lightboxClose: {
  position: "absolute",
  top: -50,
  right: 0,
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "none",
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 900,
},

lightboxPrev: {
  position: "absolute",
  left: 20,
  top: "50%",
  transform: "translateY(-50%)",
  width: 54,
  height: 54,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  fontSize: 34,
  fontWeight: 900,
},

lightboxNext: {
  position: "absolute",
  right: 20,
  top: "50%",
  transform: "translateY(-50%)",
  width: 54,
  height: 54,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  fontSize: 34,
  fontWeight: 900,
},

showAllPhotosButton: {
  position: "absolute",
  right: 24,
  bottom: 24,
  zIndex: 5,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
},

cancellationTermsAcknowledgmentCard: {
  marginTop: 14,
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 15,
  background: "#eff6ff",
},

cancellationTermsAcknowledgmentLabel: {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
},

cancellationTermsCheckbox: {
  marginTop: 4,
  width: 18,
  height: 18,
  cursor: "pointer",
  flexShrink: 0,
},

cancellationTermsTitle: {
  fontSize: 14,
  fontWeight: 950,
  color: "#0f172a",
  lineHeight: 1.35,
},

cancellationTermsText: {
  marginTop: 5,
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 750,
},

refundBasisDisclosure: {
  marginTop: 11,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "10px 11px",
  background: "#ffffff",
  display: "grid",
  gap: 4,
},

refundBasisDisclosureTitle: {
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
},

refundBasisDisclosureText: {
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 700,
},

paymentMethods: {
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #e2e8f0",
},

paymentTrustRow: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
},
paymentTrustIcon: {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 16,
},

stripeText: {
  color: "#1d4ed8",
  fontWeight: 950,
},

paymentLogosRow: {
  marginTop: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
},

paymentLogo: {
  maxHeight: 45,
  maxWidth: 150,
  objectFit: "contain",
},
calendarBox: {
  marginTop: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
  overflow: "hidden",
},

calendarHeader: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 14,
},

calendarDatePanel: {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: "13px 14px",
  background: "#f8fafc",
},

calendarLabel: {
  fontSize: 11,
  fontWeight: 950,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
},

calendarValue: {
  marginTop: 5,
  fontSize: 15,
  fontWeight: 950,
  color: "#0f172a",
},

calendarShell: {
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: "12px 8px",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  overflowX: "auto",
  maxWidth: "100%",
},
calendarInner: {
  minWidth: 0,
  width: "max-content",
  maxWidth: "100%",
  margin: "0 auto",
},
stayNotificationsCard: {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 16,
  background: "#eff6ff",
},

stayNotificationsLabel: {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  cursor: "pointer",
},

stayNotificationsCheckbox: {
  marginTop: 4,
  width: 18,
  height: 18,
  cursor: "pointer",
},

stayNotificationsTitle: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 15,
  fontWeight: 950,
  color: "#0f172a",
  marginBottom: 6,
},

smartStayIcon: {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  flexShrink: 0,
},
stayNotificationsText: {
  fontSize: 13,
  lineHeight: 1.55,
  color: "#334155",
  fontWeight: 700,
},

stayNotificationsLegal: {
  marginTop: 8,
  fontSize: 11,
  lineHeight: 1.5,
  color: "#64748b",
  fontWeight: 700,
},

legalLinks: {
  marginTop: 14,
  textAlign: "center",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.6,
},

legalLink: {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
},

cancellationPolicyBox: {
  marginTop: 18,
  border: "1px solid #bbf7d0",
  borderRadius: 20,
  padding: 16,
  background:
    "linear-gradient(135deg, rgba(240,253,244,0.94), rgba(255,255,255,0.96))",
  display: "grid",
  gap: 12,
},

cancellationPolicyHeader: {
  display: "flex",
  alignItems: "center",
  gap: 12,
},

cancellationPolicyIcon: {
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  border: "1px solid #bbf7d0",
  color: "#15803d",
  fontSize: 20,
  fontWeight: 950,
  flexShrink: 0,
},

cancellationPolicyEyebrow: {
  fontSize: 11,
  fontWeight: 950,
  color: "#15803d",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
},

cancellationPolicyTitle: {
  marginTop: 3,
  fontSize: 16,
  fontWeight: 950,
  color: "#0f172a",
},

cancellationPolicyHeadline: {
  fontSize: 14,
  fontWeight: 950,
  color: "#14532d",
  lineHeight: 1.45,
},

cancellationPolicyText: {
  margin: 0,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
},

cancellationPolicyGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
},

cancellationPolicyMetric: {
  border: "1px solid #dcfce7",
  background: "#ffffff",
  borderRadius: 14,
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
},

cancellationPolicyNote: {
  borderTop: "1px solid #dcfce7",
  paddingTop: 10,
  color: "#166534",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 850,
},

cancellationTimeline: {
  display: "grid",
  gap: 12,
},

cancellationTimelineItem: {
  display: "grid",
  gridTemplateColumns: "38px 1fr",
  gap: 12,
  alignItems: "start",
},

cancellationTimelineMarker: {
  width: 34,
  height: 34,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  fontSize: 15,
  fontWeight: 950,
  border: "1px solid",
},

cancellationTimelineMarkerSuccess: {
  background: "#dcfce7",
  borderColor: "#bbf7d0",
  color: "#15803d",
},

cancellationTimelineMarkerWarning: {
  background: "#fef3c7",
  borderColor: "#fde68a",
  color: "#92400e",
},

cancellationTimelineMarkerDanger: {
  background: "#fee2e2",
  borderColor: "#fecaca",
  color: "#991b1b",
},

cancellationTimelineContent: {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: "12px 13px",
  background: "#ffffff",
  display: "grid",
  gap: 5,
},

cancellationTimelineTopRow: {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  color: "#0f172a",
  fontSize: 14,
},

cancellationRefundBadge: {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 950,
  border: "1px solid",
  whiteSpace: "nowrap",
},

cancellationRefundBadgeSuccess: {
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
  color: "#15803d",
},

cancellationRefundBadgeWarning: {
  background: "#fffbeb",
  borderColor: "#fde68a",
  color: "#92400e",
},

cancellationRefundBadgeDanger: {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
},

cancellationTimelineWindow: {
  color: "#334155",
  fontSize: 13,
  fontWeight: 850,
},

cancellationTimelineDate: {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 900,
},

cancellationTimelineDescription: {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
},

cancellationExceptionsBox: {
  borderTop: "1px solid #dcfce7",
  paddingTop: 12,
  display: "grid",
  gap: 10,
},

cancellationExceptionsTitle: {
  color: "#14532d",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
},

cancellationScenarioGrid: {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
},

cancellationScenarioPill: {
  borderRadius: 999,
  padding: "6px 9px",
  background: "#ffffff",
  border: "1px solid #dcfce7",
  color: "#166534",
  fontSize: 11,
  fontWeight: 900,
},

};