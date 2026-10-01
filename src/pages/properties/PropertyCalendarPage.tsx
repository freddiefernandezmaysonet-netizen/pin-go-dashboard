import { validDate } from "../../calendar/model";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  format,
  addMonths,
  addDays,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  OperationalIntelligencePanel,
  type OperationalIntelligenceItem,
} from "../../components/properties/OperationalIntelligencePanel";
import {
  getVisibleReservationSourceLabel,
  sanitizeWhiteLabelText,
} from "../../lib/whiteLabel";
import {
  getLiveMissionControlMetric,
} from "../../lib/apmsMissionControlPresentation.js";
import {
  MISSION_CONTROL_POLL_INTERVAL_MS,
  createMissionControlRefreshState,
} from "../../lib/apmsMissionControlFreshness.js";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

export function PropertyCalendarPage({ view = "combined", propertyId }: { view?: "combined" | "mission" | "actions" | "single"; propertyId?: string }) {
  const [searchParams] = useSearchParams();
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const safeDate = (value: string | null) => validDate(value) ? new Date(value + "T12:00:00") : null;
  const initialDay = safeDate(initialFrom);
  const candidateEnd = safeDate(initialTo);
  const initialEnd = initialDay && candidateEnd && candidateEnd >= initialDay && candidateEnd.getTime() - initialDay.getTime() <= 30 * 86400000 ? candidateEnd : initialDay;
  const { id: routeId } = useParams();
  const id = propertyId || routeId;
  const navigate = useNavigate();

  const [month, setMonth] = useState(() => startOfMonth(initialDay || new Date()));
  const [nightlyRates, setNightlyRates] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [property, setProperty] = useState<any | null>(null);
  const [missionControlSnapshot, setMissionControlSnapshot] =
    useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(view === "single" ? null : initialDay);
  const [showCreateReservationForm, setShowCreateReservationForm] =
    useState(false);
  const [manualGuestName, setManualGuestName] = useState("");
  const [manualGuestEmail, setManualGuestEmail] = useState("");
  const [manualGuestPhone, setManualGuestPhone] = useState("");
  const [manualGuestLanguage, setManualGuestLanguage] =
    useState<"en" | "es">("en");
  const [manualPaymentState, setManualPaymentState] = useState("NONE");
  const [manualReservationQuote, setManualReservationQuote] =
    useState<any | null>(null);
  const [loadingManualReservationQuote, setLoadingManualReservationQuote] =
    useState(false);
  const [manualReservationQuoteError, setManualReservationQuoteError] =
    useState<string | null>(null);
  const [savingManualReservation, setSavingManualReservation] = useState(false);
  
  const [selectedRange, setSelectedRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: view === "single" ? null : initialDay, end: view === "single" ? null : initialEnd || initialDay });

  const [rateInput, setRateInput] = useState("");
  const [showSetRateForm, setShowSetRateForm] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingUnblock, setSavingUnblock] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  
  const today = startOfDay(new Date());

  const from = view === "actions" && selectedRange.start ? format(selectedRange.start, "yyyy-MM-dd") : format(startOfMonth(month), "yyyy-MM-dd");
  const to = view === "actions" && selectedRange.start ? format(addDays(selectedRange.end || selectedRange.start, 1), "yyyy-MM-dd") : format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd");

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month]
  );

  useEffect(() => {
    if (!id) return;

    let active = true;

    async function loadCalendarData() {
      try {
        setLoading(true);

        const propertyRes = await fetch(
          `${API_BASE}/api/dashboard/properties/${id}`,
          { credentials: "include" }
        );
        const propertyData = await propertyRes.json();

        const ratesRes = await fetch(
          `${API_BASE}/api/dashboard/properties/${id}/nightly-rates?from=${from}&to=${to}`,
          { credentials: "include" }
        );
        const ratesData = await ratesRes.json();

        const reservationsRes = await fetch(
          `${API_BASE}/api/dashboard/reservations?propertyId=${id}&from=${from}&to=${to}&pageSize=100&sort=checkIn_asc`,
          { credentials: "include" }
        );
        const reservationsData = await reservationsRes.json();
              const blockedRes = await fetch(
          `${API_BASE}/api/dashboard/properties/${id}/blocked-dates`,
          { credentials: "include" }
        );
        const blockedData = await blockedRes.json();

        if (!active) return;

        setProperty(propertyRes.ok ? propertyData.item : null);

        setNightlyRates(
          ratesRes.ok && Array.isArray(ratesData.rates) ? ratesData.rates : []
        );
        setReservations(
          Array.isArray(reservationsData.items) ? reservationsData.items : []
        );
        setBlockedDates(
          blockedRes.ok && Array.isArray(blockedData.items)
            ? blockedData.items
            : []
        );
      } catch (error) {
        console.error("Failed to load calendar data", error);
        if (active) {
          setNightlyRates([]);
          setReservations([]);
          setBlockedDates([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCalendarData();

    return () => {
      active = false;
    };
  }, [id, from, to]);

  useEffect(() => {
    if (!id || view === "actions" || view === "single") return;

    let active = true;
    let requestSequence = 0;

    async function refreshMissionControl() {
      const sequence = ++requestSequence;

      try {
        const response = await fetch(
          `${API_BASE}/api/dashboard/properties/${id}/mission-control?from=${from}&to=${to}`,
          { credentials: "include" }
        );
        const data = await response.json().catch(() => ({}));

        if (!active || sequence !== requestSequence) return;

        const next = createMissionControlRefreshState({
          ok: response.ok,
          item: data?.item,
          refreshedAt: new Date(),
        });
        setMissionControlSnapshot(next.snapshot);
      } catch (error) {
        console.error("Failed to refresh Mission Control", error);
        if (!active || sequence !== requestSequence) return;
        const next = createMissionControlRefreshState({ ok: false });
        setMissionControlSnapshot(next.snapshot);
      }
    }

    setMissionControlSnapshot(null);
    void refreshMissionControl();
    const intervalId = window.setInterval(
      () => void refreshMissionControl(),
      MISSION_CONTROL_POLL_INTERVAL_MS
    );

    return () => {
      active = false;
      requestSequence += 1;
      window.clearInterval(intervalId);
    };
  }, [id, from, to, view]);

  const rateByDate = useMemo(() => {
    return new Map(nightlyRates.map((item) => [item.date, item]));
  }, [nightlyRates]);

  function getDateKey(date: Date) {
    return format(date, "yyyy-MM-dd");
  }

  function getIsoDateKey(value: string) {
    return String(value).slice(0, 10);
  }

  function getReservationForDay(day: Date) {
    const dayKey = getDateKey(day);

    return reservations.find((reservation) => {
      const checkInKey = getIsoDateKey(reservation.checkIn);
      const checkOutKey = getIsoDateKey(reservation.checkOut);

      return dayKey >= checkInKey && dayKey < checkOutKey;
    });
  }

  function getBlockedDateForDay(day: Date) {
    const dayKey = getDateKey(day);

    return blockedDates.find((blockedDate) => {
      const startKey = getIsoDateKey(blockedDate.startDate);
      const endKey = getIsoDateKey(blockedDate.endDate);

      return dayKey >= startKey && dayKey < endKey;
    });
  }

  function handleDayClick(day: Date) {
    if (startOfDay(day) < today) return;

    setSelectedDay(day);

    setSelectedRange((current) => {
      if (!current.start || current.end) {
        return { start: day, end: null };
      }

      if (day < current.start) {
        return { start: day, end: current.start };
      }

      return { start: current.start, end: day };
    });
  }

  function isDayInSelectedRange(day: Date) {
    if (!selectedRange.start) return false;

    const dayKey = getDateKey(day);
    const startKey = getDateKey(selectedRange.start);
    const endKey = selectedRange.end
      ? getDateKey(selectedRange.end)
      : startKey;

    return dayKey >= startKey && dayKey <= endKey;
  }

  const hasSelectedRange = Boolean(selectedRange.start);

  const selectedRangeLabel = selectedRange.start
    ? selectedRange.end
      ? `${format(selectedRange.start, "MMM d, yyyy")} - ${format(
          selectedRange.end,
          "MMM d, yyyy"
        )}`
      : `${format(selectedRange.start, "MMM d, yyyy")}`
    : "";

const manualReservationDateKeys = useMemo(() => {
  if (!selectedRange.start) return null;

  const checkOutDate = addDays(
    selectedRange.end ?? selectedRange.start,
    1
  );

  return {
    checkIn: format(selectedRange.start, "yyyy-MM-dd"),
    checkOut: format(checkOutDate, "yyyy-MM-dd"),
  };
}, [selectedRange.start, selectedRange.end]);
  
useEffect(() => {
  if (!id || !showCreateReservationForm || !manualReservationDateKeys) {
    setManualReservationQuote(null);
    setManualReservationQuoteError(null);
    setLoadingManualReservationQuote(false);
    return;
  }

  let active = true;

  async function loadManualReservationQuote() {
    try {
      setLoadingManualReservationQuote(true);
      setManualReservationQuoteError(null);

      const quoteRes = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/manual-reservations/quote?checkIn=${manualReservationDateKeys.checkIn}&checkOut=${manualReservationDateKeys.checkOut}`,
        { credentials: "include" }
      );

      const quoteData = await quoteRes.json().catch(() => ({}));

      if (!quoteRes.ok) {
        throw new Error(
          quoteData?.error || "Failed to calculate reservation total"
        );
      }

      if (!active) return;

      setManualReservationQuote(quoteData.item ?? null);
    } catch (error: any) {
      if (!active) return;

      setManualReservationQuote(null);
      setManualReservationQuoteError(String(error?.message || error));
    } finally {
      if (active) {
        setLoadingManualReservationQuote(false);
      }
    }
  }

  loadManualReservationQuote();

  return () => {
    active = false;
  };
}, [
  id,
  showCreateReservationForm,
  manualReservationDateKeys?.checkIn,
  manualReservationDateKeys?.checkOut,
]);

  const baseNightlyRate = Number(property?.baseNightlyRate ?? 0);
  const minimumNightlyRate = Number(property?.minimumNightlyRate ?? 0);
  const maximumNightlyRate = Number(property?.maximumNightlyRate ?? 0);

  const dynamicPricingEnabled = Boolean(property?.dynamicPricingEnabled);
  const weekendMarkupPercent = Number(property?.weekendMarkupPercent ?? 0);

  function isWeekendNight(date: Date) {
    const day = date.getDay();
    return day === 5 || day === 6;
  }

  function getDisplayRateForDay(day: Date, rate: any) {
    const finalRate = rate ? Number(rate.rate ?? 0) : baseNightlyRate;

    if (!finalRate || finalRate <= 0) {
      return null;
    }

    return Math.round(finalRate);
  }

function formatAppliedRule(rule: string) {
  if (rule === "SEASONAL_RULE") return "Seasonal";
  if (rule === "HOLIDAY_RULE") return "Holiday";
  if (rule === "LEAD_TIME_RULE") return "Last Minute";
  if (rule === "OCCUPANCY_LOW_RULE") return "Low Demand";
  if (rule === "OCCUPANCY_HIGH_RULE") return "High Demand";
  if (rule === "CUSTOM_RATE") return "Manual Override";
  if (rule === "Calendar override") return "Manual Override";
  if (rule === "WEEKEND_RULE") return "Weekend Boost";
  if (rule === "BASE_RATE") return "Base Rate";

  return rule;
}

function getRateReasonForDay(day: Date, rate: any) {
  const appliedRules = Array.isArray(rate?.appliedRules)
    ? rate.appliedRules
    : [];

  if (appliedRules.length > 0) {
    return appliedRules.map(formatAppliedRule).join(" + ");
  }

  const reason = rate?.reason;

  if (reason) {
    return formatAppliedRule(reason);
  }

  if (
    dynamicPricingEnabled &&
    weekendMarkupPercent > 0 &&
    isWeekendNight(day)
  ) {
    return "Weekend Boost";
  }

  return "Base Rate";
}
  
function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
}

function formatAdjustmentAmount(value: unknown) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  if (amount > 0) {
    return `+${formatMoney(amount)}`;
  }

  if (amount < 0) {
    return `-${formatMoney(Math.abs(amount))}`;
  }

  return "$0.00";
}

function getSelectedDayRate() {
  if (!selectedDay) return null;

  return rateByDate.get(getDateKey(selectedDay)) ?? null;
}

function getSelectedPricingBreakdown() {
  const selectedRate = getSelectedDayRate();

  return Array.isArray(selectedRate?.pricingBreakdown)
    ? selectedRate.pricingBreakdown
    : [];
}

 function getStatusForDay(day: Date) {
    const reservation = getReservationForDay(day);
    const blockedDate = getBlockedDateForDay(day);

    if (reservation) return "Booked";
    if (blockedDate) return "Blocked";
    return "Available";
  }

  const visibleMonthDays = useMemo(() => {
    return calendarDays.filter((day) => isSameMonth(day, month));
  }, [calendarDays, month]);

const revenueSummary = useMemo(() => {
  let seasonalAdjustments = 0;
  let weekendBoosts = 0;
  let lastMinuteDiscounts = 0;
  let highDemandAdjustments = 0;
  let lowDemandAdjustments = 0;
  let manualOverrides = 0;

  for (const day of visibleMonthDays) {
    const rate = rateByDate.get(getDateKey(day));
    const appliedRules = Array.isArray(rate?.appliedRules)
      ? rate.appliedRules
      : rate?.reason
      ? [rate.reason]
      : [];

    if (appliedRules.includes("SEASONAL_RULE")) seasonalAdjustments += 1;
    if (appliedRules.includes("WEEKEND_RULE")) weekendBoosts += 1;
    if (appliedRules.includes("LEAD_TIME_RULE")) lastMinuteDiscounts += 1;
    if (appliedRules.includes("OCCUPANCY_HIGH_RULE")) highDemandAdjustments += 1;
    if (appliedRules.includes("OCCUPANCY_LOW_RULE")) lowDemandAdjustments += 1;

    if (
      appliedRules.includes("CUSTOM_RATE") ||
      appliedRules.includes("Calendar override")
    ) {
      manualOverrides += 1;
    }
  }

  return {
    seasonalAdjustments,
    weekendBoosts,
    lastMinuteDiscounts,
    highDemandAdjustments,
    lowDemandAdjustments,
    manualOverrides,
    totalOptimizations:
      seasonalAdjustments +
      weekendBoosts +
      lastMinuteDiscounts +
      highDemandAdjustments +
      lowDemandAdjustments,
  };
}, [visibleMonthDays, rateByDate]);
 
const hasLiveMissionControlSnapshot = Boolean(missionControlSnapshot);



const guestJourneyMetrics =
  missionControlSnapshot?.guestJourneyMetrics ?? null;

const guestJourneyActiveReservations = Number(
  guestJourneyMetrics?.activeReservations ?? 0
);

const guestJourneyReservationConfirmed = Number(
  guestJourneyMetrics?.reservationConfirmed ?? 0
);

const guestJourneyVerificationPending = Number(
  guestJourneyMetrics?.verificationPending ?? 0
);

const guestJourneyVerificationCompleted = Number(
  guestJourneyMetrics?.verificationCompleted ?? 0
);

const guestJourneyAccessScheduled = Number(
  guestJourneyMetrics?.accessScheduled ?? 0
);

const guestJourneyReadyForArrival = Number(
  guestJourneyMetrics?.readyForArrival ?? 0
);

const guestJourneyCompletionRate = Number(
  guestJourneyMetrics?.completionRate ?? 100
);

const guestJourneyHostInterventionRequired = Number(
  guestJourneyMetrics?.hostInterventionRequired ?? 0
);





const hasOperationalIntelligenceContract = Array.isArray(
  missionControlSnapshot?.operationalItems
);

const missionControlOperationalItems: OperationalIntelligenceItem[] =
  hasOperationalIntelligenceContract
    ? missionControlSnapshot.operationalItems
    : [];

const missionControlRecommendedActions = Array.isArray(
  missionControlSnapshot?.recommendedActions
)
  ? missionControlSnapshot.recommendedActions
  : [];

const primaryMissionControlAction =
  missionControlRecommendedActions[0] ?? null;

const hasOperationalHostAction =
  missionControlOperationalItems.some(
    (item) =>
      item.workflowState === "ACTION_REQUIRED" &&
      item.actionRequired === true &&
      item.responsibleActor === "HOST"
  );

const primaryLegacyPriority = String(
  primaryMissionControlAction?.priority ?? ""
).toUpperCase();

const shouldShowLegacyCriticalFallback =
  !hasOperationalHostAction &&
  primaryMissionControlAction?.requiresHumanAction === true &&
  (
    primaryLegacyPriority === "CRITICAL" ||
    primaryLegacyPriority === "HIGH"
  );

const secondaryMissionControlActions =
  missionControlRecommendedActions.slice(1, 3);

const hiddenMissionControlActionCount = Math.max(
  missionControlRecommendedActions.length - 3,
  0
);

function getMissionActionVisualStatus(action: any) {
  if (!action?.requiresHumanAction) {
    return "SUCCESS";
  }

  const priority = String(action?.priority ?? "").toUpperCase();

  if (priority === "CRITICAL" || priority === "HIGH") {
    return "ERROR";
  }

  return "WARNING";
}

function getMissionActionBadgeLabel(action: any) {
  if (!action?.requiresHumanAction) {
    return "All clear";
  }

  const priority = String(action?.priority ?? "").toUpperCase();

  if (priority === "CRITICAL" || priority === "HIGH") {
    return "Review now";
  }

  return "Review";
}

function getMissionActionFooterLabel(action: any) {
  if (!action?.requiresHumanAction) {
    return "Pin&Go handled this automatically.";
  }

  if (action?.canAutoResolve) {
    return "Auto-repair available.";
  }

  return "Host attention required.";
}

function getMissionActionBoxStyle(action: any): CSSProperties {
  const visualStatus = getMissionActionVisualStatus(action);

  if (visualStatus === "ERROR") {
    return {
      ...styles.missionActionBox,
      borderColor: "#fecaca",
      background:
        "linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)",
    };
  }

  if (visualStatus === "WARNING") {
    return {
      ...styles.missionActionBox,
      borderColor: "#fde68a",
      background:
        "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)",
    };
  }

  return styles.missionActionBox;
}

function getMissionActionTitleStyle(action: any): CSSProperties {
  const visualStatus = getMissionActionVisualStatus(action);

  if (visualStatus === "ERROR") {
    return {
      ...styles.missionActionTitle,
      color: "#991b1b",
    };
  }

  if (visualStatus === "WARNING") {
    return {
      ...styles.missionActionTitle,
      color: "#92400e",
    };
  }

  return styles.missionActionTitle;
}

function getMissionActionEngineDisplayLabel(engine: unknown) {
  const engineName = String(engine ?? "MissionControl");

  if (engineName === "MissionControl") {
    return "APMS Command Center";
  }

  return getMissionActivityEngineLabel(engineName);
}

function getMissionActionReservationLabel(action: any) {
  const reservationNumber = String(
    action?.reservationNumber ?? ""
  ).trim();

  if (reservationNumber) {
    return `#${reservationNumber}`;
  }

  if (action?.reservationId) {
    return "Pending Reference";
  }

  return null;
}

function renderMissionActionDetails(action: any) {
  const hasReservationContext = Boolean(
    action?.reservationId || action?.reservationNumber
  );

  if (!hasReservationContext) {
    return (
      <div style={getMissionActionMetaStyle(action)}>
        {sanitizeWhiteLabelText(
          action?.issue ??
            action?.description ??
            getMissionActionFooterLabel(action)
        )}
      </div>
    );
  }

  const reservationLabel =
    getMissionActionReservationLabel(action) ?? "Pending Reference";

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        marginTop: 14,
        padding: 16,
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "rgba(255, 255, 255, 0.82)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px minmax(0, 1fr)",
          gap: "9px 14px",
          alignItems: "start",
          fontSize: 13,
        }}
      >
        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Reservation
        </div>

        <div
          style={{
            color: "#1d4ed8",
            fontWeight: 900,
            wordBreak: "break-word",
          }}
        >
          {reservationLabel}
        </div>

        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Guest
        </div>

        <div style={{ color: "#0f172a", fontWeight: 800 }}>
          {action?.guestName || "Guest"}
        </div>

        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Issue
        </div>

        <div
          style={{
            color: "#334155",
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {sanitizeWhiteLabelText(
            action?.issue ??
              action?.description ??
              "Pin&Go detected an operational issue that needs review."
          )}
        </div>

        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Engine
        </div>

        <div style={{ color: "#0f172a", fontWeight: 800 }}>
          {getMissionActionEngineDisplayLabel(action?.engine)}
        </div>

        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Last Signal
        </div>

        <div style={{ color: "#475569", fontWeight: 700 }}>
          {getMissionActionLastSignalLabel(action)}
        </div>

        <div style={{ color: "#64748b", fontWeight: 800 }}>
          Resolution
        </div>

        <div
          style={{
            color: action?.canAutoResolve ? "#166534" : "#92400e",
            fontWeight: 900,
          }}
        >
          {action?.canAutoResolve
            ? "Auto-repair available"
            : "Host review required"}
        </div>
      </div>

      {action?.reservationId ? (
        <button
          type="button"
          onClick={() => {
            const reservationId = String(
              action.reservationId ?? ""
            ).trim();

            if (!reservationId) return;

            navigate(`/reservations/${reservationId}`);
          }}
          style={{
            justifySelf: "start",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 38,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Open Reservation
        </button>
      ) : null}
    </div>
  );
}

function getMissionActionLastSignalLabel(action: any) {
  const rawDate = action?.lastSignalAt ?? missionControlSnapshot?.generatedAt;
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) return "Signal time unavailable";
  const formattedDate = date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return action?.lastSignalAt
    ? `Last operational signal: ${formattedDate}`
    : `Snapshot updated: ${formattedDate}`;
}

function getMissionActionMetaStyle(action: any): CSSProperties {
  const visualStatus = getMissionActionVisualStatus(action);

  if (visualStatus === "ERROR") {
    return {
      ...styles.missionActionMeta,
      color: "#991b1b",
    };
  }

  if (visualStatus === "WARNING") {
    return {
      ...styles.missionActionMeta,
      color: "#92400e",
    };
  }

  return styles.missionActionMeta;
}

function getMissionActionFooterStyle(action: any): CSSProperties {
  const visualStatus = getMissionActionVisualStatus(action);

  if (visualStatus === "ERROR") {
    return {
      ...styles.missionActionFooter,
      color: "#991b1b",
      background: "#fee2e2",
      borderColor: "#fecaca",
    };
  }

  if (visualStatus === "WARNING") {
    return {
      ...styles.missionActionFooter,
      color: "#92400e",
      background: "#fef3c7",
      borderColor: "#fde68a",
    };
  }

  return styles.missionActionFooter;
}

const autonomyScore = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["autonomyScore", "score"]
);

const interventionsAvoided = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["freedomMetrics", "interventionsAvoided"]
);

const autonomousDecisions = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["freedomMetrics", "autonomousDecisions"]
);

const missionControlRecentAuditEntries = Array.isArray(
  missionControlSnapshot?.recentAuditEntries
)
  ? missionControlSnapshot.recentAuditEntries
  : [];

function getMissionActivityTimestamp(entry: any) {
  const rawDate = entry?.completedAt ?? entry?.startedAt ?? entry?.generatedAt;
  const date = rawDate ? new Date(rawDate) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function formatMissionActivityTime(entry: any) {
  const rawDate = entry?.completedAt ?? entry?.startedAt ?? entry?.generatedAt;
  const date = rawDate ? new Date(rawDate) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMissionActivityEngineLabel(engine: string) {
  if (engine === "Reservation") return "Reservation Auto Pilot";
  if (engine === "Revenue") return "Revenue Engine";
  if (engine === "Access") return "Access Engine";
  if (engine === "Cleaning") return "Cleaning Engine";
  if (engine === "Messaging") return "Messaging Engine";
  if (engine === "Distribution") return "Distribution Engine";

  return `${engine} Engine`;
}

function getMissionStatusPillStyle(status: string) {
  const normalizedStatus = String(status ?? "").toUpperCase();

  if (
    normalizedStatus === "ACTIVE" ||
    normalizedStatus === "HEALTHY" ||
    normalizedStatus === "SUCCESS"
  ) {
    return {
      color: "#166534",
      background: "#dcfce7",
      borderColor: "#bbf7d0",
    };
  }

  if (
    normalizedStatus === "NEEDS_ATTENTION" ||
    normalizedStatus === "WARNING"
  ) {
    return {
      color: "#92400e",
      background: "#fef3c7",
      borderColor: "#fde68a",
    };
  }

  if (normalizedStatus === "ERROR" || normalizedStatus === "FAILED") {
    return {
      color: "#991b1b",
      background: "#fee2e2",
      borderColor: "#fecaca",
    };
  }

  return {
    color: "#334155",
    background: "#f1f5f9",
    borderColor: "#e2e8f0",
  };
}

function formatMissionMetadataPercent(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return `${amount > 0 ? "+" : ""}${amount}%`;
}

function getMissionActivityReasonLabel(entry: any) {
  const reason = String(entry?.reason ?? "").toUpperCase();
  const trigger = String(entry?.metadata?.trigger ?? "").toUpperCase();

  if (
    reason.includes("HOLIDAY_PRICING_UPDATE") ||
    trigger === "HOLIDAY_PRICING_UPDATE"
  ) {
    return "Holiday pricing updated";
  }

  if (reason.includes("SEASON_CREATE") || trigger === "SEASON_CREATE") {
    return "Season created";
  }

  if (reason.includes("SEASON_UPDATE") || trigger === "SEASON_UPDATE") {
    return "Season updated";
  }

  if (reason.includes("SEASON_DELETE") || trigger === "SEASON_DELETE") {
    return "Season removed";
  }

  if (
    reason.includes("NIGHTLY_RATE") ||
    trigger === "NIGHTLY_RATE_UPDATE"
  ) {
    return "Nightly rate synced";
  }

  if (
    reason.includes("BLOCKED_DATE_CREATE") ||
    trigger === "BLOCKED_DATE_CREATE"
  ) {
    return "Dates blocked";
  }

  if (
    reason.includes("BLOCKED_DATE_DELETE") ||
    trigger === "BLOCKED_DATE_DELETE"
  ) {
    return "Dates unblocked";
  }

  if (
    reason.includes("MANUAL_RESERVATION") ||
    trigger === "MANUAL_RESERVATION"
  ) {
    return "Manual reservation synced";
  }

  if (reason.includes("DIRECT_BOOKING") || trigger === "DIRECT_BOOKING") {
    return "Direct booking synced";
  }

  if (
    reason.includes("DYNAMIC_PRICING_WORKER") ||
    trigger === "DYNAMIC_PRICING_WORKER"
  ) {
    return "Autonomous pricing sync";
  }

  if (reason) {
    return sanitizeWhiteLabelText(
      reason
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^\w/, (letter) => letter.toUpperCase())
    );
  }

  return "Autonomous action completed";
}

function getMissionActivityDetail(entry: any) {
  const metadata = entry?.metadata ?? {};
  const trigger = String(metadata.trigger ?? "").toUpperCase();

  if (trigger === "HOLIDAY_PRICING_UPDATE") {
    const percent = formatMissionMetadataPercent(metadata.adjustmentPercent);
    return [
      metadata.holidayName ?? "Holiday pricing",
      percent,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (
    trigger === "SEASON_CREATE" ||
    trigger === "SEASON_UPDATE" ||
    trigger === "SEASON_DELETE"
  ) {
    const percent = formatMissionMetadataPercent(metadata.adjustmentPercent);
    return [
      metadata.seasonName ?? "Season",
      metadata.seasonType,
      percent,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (trigger === "NIGHTLY_RATE_UPDATE") {
    const ratesCount = metadata.ratesCount;
    const changedRateDates = Array.isArray(metadata.changedRateDates)
      ? metadata.changedRateDates.join(", ")
      : null;

    return [
      ratesCount ? `${ratesCount} rate${Number(ratesCount) === 1 ? "" : "s"}` : null,
      changedRateDates,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (
    trigger === "BLOCKED_DATE_CREATE" ||
    trigger === "BLOCKED_DATE_DELETE"
  ) {
    return [
      metadata.blockedStartDate,
      metadata.blockedEndDate,
    ]
      .filter(Boolean)
      .join(" → ");
  }

  if (metadata.pushedToChannex === true) {
    return "Pushed to Pin&Go Connect";
  }

  return null;
}

function formatMissionStatusLabel(status: string) {
  return String(status ?? "PENDING").replaceAll("_", " ");
}


function isAutoResolutionEntry(entry: any) {
  const status = String(entry?.status ?? "").toUpperCase();
  const severity = String(entry?.severity ?? "").toUpperCase();

  if (status !== "SUCCESS") return false;
  if (severity === "WARNING" || severity === "CRITICAL") return false;
  if (!entry?.engine || !entry?.summary) return false;

  return true;
}

function getAutoResolutionTitle(entry: any) {
  const engine = String(entry?.engine ?? "");
  const reason = String(entry?.reason ?? "").toUpperCase();
  const trigger = String(entry?.metadata?.trigger ?? "").toUpperCase();

  if (
    trigger === "HOLIDAY_PRICING_UPDATE" ||
    reason.includes("HOLIDAY_PRICING_UPDATE")
  ) {
    return "Holiday pricing synchronized";
  }

  if (
    trigger === "SEASON_CREATE" ||
    trigger === "SEASON_UPDATE" ||
    trigger === "SEASON_DELETE" ||
    reason.includes("SEASON")
  ) {
    return "Seasonal pricing synchronized";
  }

  if (
    trigger === "NIGHTLY_RATE_UPDATE" ||
    reason.includes("NIGHTLY_RATE")
  ) {
    return "Nightly rates synchronized";
  }

  if (
    trigger === "BLOCKED_DATE_CREATE" ||
    reason.includes("BLOCKED_DATE_CREATE")
  ) {
    return "Availability block synchronized";
  }

  if (
    trigger === "BLOCKED_DATE_DELETE" ||
    reason.includes("BLOCKED_DATE_DELETE")
  ) {
    return "Availability reopened";
  }

  if (
    trigger === "MANUAL_RESERVATION" ||
    reason.includes("MANUAL_RESERVATION")
  ) {
    return "Manual reservation synchronized";
  }

  if (
    trigger === "DIRECT_BOOKING" ||
    reason.includes("DIRECT_BOOKING")
  ) {
    return "Direct booking processed";
  }

  if (
    trigger === "DYNAMIC_PRICING_WORKER" ||
    reason.includes("DYNAMIC_PRICING_WORKER")
  ) {
    return "Autonomous pricing sync completed";
  }

  if (engine === "Revenue") return "Pricing decision completed";
  if (engine === "Distribution") return "Channel operation completed";
  if (engine === "Reservation") return "Reservation workflow completed";
  if (engine === "Access") return "Access workflow completed";
  if (engine === "Cleaning") return "Cleaning workflow completed";
  if (engine === "Messaging") return "Message workflow completed";

  return "APMS operation completed";
}

function getAutoResolutionDescription(entry: any) {
  const engine = String(entry?.engine ?? "");
  const metadata = entry?.metadata ?? {};

  if (engine === "Distribution" && metadata.pushedToChannex === true) {
    return "Pin&Go confirmed the latest property update was pushed to Pin&Go Connect.";
  }

  if (engine === "Distribution") {
    return "Pin&Go completed the latest channel operation successfully.";
  }

  if (engine === "Revenue") {
    return "Pin&Go recalculated pricing using the active rules and guardrails.";
  }

  if (engine === "Reservation") {
    return "Pin&Go processed the reservation workflow and kept the property timeline updated.";
  }

  if (engine === "Access") {
    return "Pin&Go completed the access workflow for this operational step.";
  }

  if (engine === "Cleaning") {
    return "Pin&Go completed the cleaning workflow for this reservation window.";
  }

  if (engine === "Messaging") {
    return "Pin&Go completed the communication workflow successfully.";
  }

  return (
    sanitizeWhiteLabelText(entry?.summary) ||
    "Pin&Go completed this APMS operation successfully."
  );
}

function getAutoResolutionDedupKey(entry: any) {
  return [
    entry?.engine ?? "APMS",
    entry?.metadata?.trigger ?? entry?.reason ?? "",
    getAutoResolutionTitle(entry),
    getMissionActivityDetail(entry) ?? "",
  ]
    .join(":")
    .toLowerCase();
}

const autoResolutionLogItems = [...missionControlRecentAuditEntries]
  .filter(isAutoResolutionEntry)
  .sort(
    (a: any, b: any) =>
      getMissionActivityTimestamp(b) - getMissionActivityTimestamp(a)
  )
  .reduce((items: any[], entry: any) => {
    const dedupKey = getAutoResolutionDedupKey(entry);

    const alreadyIncluded = items.some(
      (item) => getAutoResolutionDedupKey(item) === dedupKey
    );

    if (alreadyIncluded) {
      return items;
    }

    return [...items, entry];
  }, [])
  .slice(0, 5);

const recentApmsActivities = [...missionControlRecentAuditEntries]
  .filter((entry: any) => entry?.engine && entry?.summary)
  .sort(
    (a: any, b: any) =>
      getMissionActivityTimestamp(b) - getMissionActivityTimestamp(a)
  )
  .reduce(
    (items: any[], entry: any) => {
      const revenueCount = items.filter(
        (item) => item.engine === "Revenue"
      ).length;

      if (entry.engine === "Revenue" && revenueCount >= 2) {
        return items;
      }

      return [...items, entry];
    },
    []
  )
  .slice(0, 8);


 
const occupancySummary = useMemo(() => {
  const totalDays = visibleMonthDays.length || 1;

  let bookedDays = 0;
  let blockedDays = 0;

  for (const day of visibleMonthDays) {
    if (getReservationForDay(day)) {
      bookedDays += 1;
    } else if (getBlockedDateForDay(day)) {
      blockedDays += 1;
    }
  }

  const availableDays = totalDays - bookedDays - blockedDays;
  const occupancyPercent = Math.round((bookedDays / totalDays) * 100);

  return {
    totalDays,
    bookedDays,
    blockedDays,
    availableDays,
    occupancyPercent,
  };
}, [visibleMonthDays, reservations, blockedDates]);
 
   async function handleApplyRate() {
    if (!id || !selectedRange.start) return;

    if (startOfDay(selectedRange.start) < today) {
      alert("Past dates cannot be modified.");
      return;
    }

    const rate = Number(rateInput);

    if (!Number.isFinite(rate) || rate < 0) {
      alert("Enter a valid nightly rate.");
      return;
    }

    try {
      setSavingRate(true);

      const res = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/nightly-rates`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rates: eachDayOfInterval({
              start: selectedRange.start,
              end: selectedRange.end ?? selectedRange.start,
            }).map((date) => ({
              date: getDateKey(date),
              rate,
              reason: "Calendar override",
            })),
          }),
        }
      );

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Apply Rate returned non-JSON. Status ${
            res.status
          }. Response: ${text.slice(0, 160)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to apply nightly rate");
      }

      const ratesRes = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/nightly-rates?from=${from}&to=${to}`,
        { credentials: "include" }
      );

      const ratesData = await ratesRes.json();

      setNightlyRates(
        ratesRes.ok && Array.isArray(ratesData.rates) ? ratesData.rates : []
      );

      setRateInput("");
      setShowSetRateForm(false);
      setSelectedRange({ start: null, end: null });
      setSelectedDay(null);
    } catch (error: any) {
      alert(String(error?.message || error));
    } finally {
      setSavingRate(false);
    }
  }

  async function handleBlockDates() {
    if (!id || !selectedRange.start) return;

    if (startOfDay(selectedRange.start) < today) {
      alert("Past dates cannot be modified.");
      return;
    }

    const startDate = getDateKey(selectedRange.start);
    const selectedEndDate = selectedRange.end ?? selectedRange.start;
    const endDate = getDateKey(addDays(selectedEndDate, 1));

    try {
      setSavingBlock(true);

      const res = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/blocked-dates`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate,
            endDate,
            reason: blockReason.trim() || "Calendar block",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to block dates");
      }

      const blockedRes = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/blocked-dates`,
        { credentials: "include" }
      );

      const blockedData = await blockedRes.json();

      setBlockedDates(
        blockedRes.ok && Array.isArray(blockedData.items)
          ? blockedData.items
          : []
      );

      setSelectedRange({ start: null, end: null });
      setShowSetRateForm(false);
      setRateInput("");
    } catch (error: any) {
      alert(String(error?.message || error));
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleUnblockDates() {
    if (!id || !selectedRange.start) return;

    if (startOfDay(selectedRange.start) < today) {
      alert("Past dates cannot be modified.");
      return;
    }

    const startKey = getDateKey(selectedRange.start);
    const endKey = getDateKey(selectedRange.end ?? selectedRange.start);

    const matchingBlockedDates = blockedDates.filter((blockedDate) => {
      const blockedStartKey = getIsoDateKey(blockedDate.startDate);
      const blockedEndExclusiveKey = getIsoDateKey(blockedDate.endDate);

      return blockedStartKey <= endKey && blockedEndExclusiveKey > startKey;
    });

    if (matchingBlockedDates.length === 0) {
      alert("No blocked dates found in the selected range.");
      return;
    }

    try {
      setSavingUnblock(true);

      for (const blockedDate of matchingBlockedDates) {
        const res = await fetch(
          `${API_BASE}/api/dashboard/properties/${id}/blocked-dates/${blockedDate.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to unblock dates");
        }
      }

      const blockedRes = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/blocked-dates`,
        { credentials: "include" }
      );

      const blockedData = await blockedRes.json();

      setBlockedDates(
        blockedRes.ok && Array.isArray(blockedData.items)
          ? blockedData.items
          : []
      );

      setSelectedRange({ start: null, end: null });
      setShowSetRateForm(false);
      setRateInput("");
      setBlockReason("");
   } catch (error: any) {
      alert(String(error?.message || error));
    } finally {
      setSavingUnblock(false);
    }
  }

  async function handleCreateManualReservation() {
    if (!id || !selectedRange.start) return;

    if (!manualGuestName.trim()) {
      alert("Guest name is required");
      return;
    }

if (!manualReservationDateKeys) {
  alert("Select valid reservation dates.");
  return;
}

if (manualPaymentState === "PAID" && loadingManualReservationQuote) {
  alert("Pin&Go is still calculating the reservation total.");
  return;
}

if (manualPaymentState === "PAID" && !manualReservationQuote) {
  alert("Pin&Go must calculate the reservation total before marking it as paid.");
  return;
}

    try {
      setSavingManualReservation(true);

      const res = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/manual-reservations`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  guestName: manualGuestName.trim(),
  guestEmail: manualGuestEmail.trim() || null,
  guestPhone: manualGuestPhone.trim() || null,
  preferredLanguage: manualGuestLanguage,
 checkIn: manualReservationDateKeys.checkIn,
checkOut: manualReservationDateKeys.checkOut,
paymentState: manualPaymentState,
}),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create reservation");
      }

      alert("Reservation created successfully");

      setManualGuestName("");
      setManualGuestEmail("");
      setManualGuestPhone("");
      setManualGuestLanguage("en");
      setManualPaymentState("NONE");
      setShowCreateReservationForm(false);
      setSelectedRange({ start: null, end: null });
    } catch (error: any) {
      alert(String(error?.message || error));
    } finally {
      setSavingManualReservation(false);
    }
  }

  return (
    <div className="pgc-page" style={styles.page}>
      <div className="pgc-header" style={styles.header}>
        <div>
          <h1 className="pgc-title" style={styles.title}>{view === "mission" ? "Mission Control" : view === "actions" ? "Manage dates" : "Property Calendar"}</h1>
          {view !== "combined" && view !== "single" && <Link to={`/calendar?propertyId=${id}`}>← Calendar</Link>}
          <p className="pgc-subtitle" style={styles.subtitle}>
            {loading
              ? "Loading calendar intelligence..."
              : `${nightlyRates.length} rate signal(s), ${reservations.length} reservation(s), and ${blockedDates.length} blocked date(s) loaded.`}
          </p>
        </div>
      </div>

      {view === "combined" && <>
      <div className="pgc-summaryGrid" style={styles.summaryGrid}>
        <div className="pgc-summaryCard" style={styles.summaryCard}>
          <div>
            <div className="pgc-summaryLabel" style={styles.summaryLabel}>Occupancy</div>
            <div className="pgc-summaryValue" style={styles.summaryValue}>
              {occupancySummary.occupancyPercent}%
            </div>
            <div className="pgc-summaryHint" style={styles.summaryHint}>
 {format(month, "MMMM yyyy")} ·{" "}
{occupancySummary.bookedDays} booked ·{" "}
{occupancySummary.blockedDays} blocked
</div>
          </div>
          <div className="pgc-summaryIcon" style={styles.summaryIcon}>◔</div>
        </div>

        <div className="pgc-summaryCard" style={styles.summaryCard}>
          <div>
            <div className="pgc-summaryLabel" style={styles.summaryLabel}>Revenue Optimizations</div>
            <div className="pgc-summaryValue" style={styles.summaryValue}>
              {revenueSummary.totalOptimizations}
            </div>
            <div className="pgc-summaryHint" style={styles.summaryHint}>Pricing engine actions this month</div>
          </div>
          <div className="pgc-summaryIconGreen" style={styles.summaryIconGreen}>⌁</div>
        </div>

        <div className="pgc-summaryCard" style={styles.summaryCard}>
          <div>
            <div className="pgc-summaryLabel" style={styles.summaryLabel}>Blocked Dates</div>
            <div className="pgc-summaryValue" style={styles.summaryValue}>{occupancySummary.blockedDays}</div>
            <div className="pgc-summaryHint" style={styles.summaryHint}>Owner stay or maintenance</div>
          </div>
          <div className="pgc-summaryIconRed" style={styles.summaryIconRed}>▣</div>
        </div>

        <div className="pgc-summaryCard" style={styles.summaryCard}>
          <div>
            <div className="pgc-summaryLabel" style={styles.summaryLabel}>Manual Overrides</div>
            <div className="pgc-summaryValue" style={styles.summaryValue}>{revenueSummary.manualOverrides}</div>
            <div className="pgc-summaryHint" style={styles.summaryHint}>Human pricing adjustments</div>
          </div>
          <div className="pgc-summaryIconPurple" style={styles.summaryIconPurple}>✎</div>
        </div>
      </div>
    

       <div className="pgc-controlCenterCard" style={styles.controlCenterCard}>
        <div className="pgc-legendColumn" style={styles.legendColumn}>
          <div className="pgc-sectionTitle" style={styles.sectionTitle}>Calendar Intelligence</div>

          <div className="pgc-legendList" style={styles.legendList}>
            <div className="pgc-legendItem" style={styles.legendItem}>
              <span className="pgc-legendDot" style={{ ...styles.legendDot, background: "#16a34a" }} />
              Available
            </div>

            <div className="pgc-legendItem" style={styles.legendItem}>
              <span className="pgc-legendDot" style={{ ...styles.legendDot, background: "#2563eb" }} />
              Booked
            </div>

            <div className="pgc-legendItem" style={styles.legendItem}>
              <span className="pgc-legendDot" style={{ ...styles.legendDot, background: "#dc2626" }} />
              Blocked
            </div>

            <div className="pgc-legendItem" style={styles.legendItem}>
              <span className="pgc-legendDot" style={{ ...styles.legendDot, background: "#8b5cf6" }} />
              Selected range
            </div>

            <div className="pgc-legendItem" style={styles.legendItem}>
              <span className="pgc-legendDot" style={{ ...styles.legendDot, background: "#94a3b8" }} />
              Past or inactive
            </div>
          </div>
        </div>

        <div className="pgc-aiColumn" style={styles.aiColumn}>
          <div className="pgc-aiHeader" style={styles.aiHeader}>
            <div>
              <div className="pgc-sectionTitle" style={styles.sectionTitle}>AI Revenue Summary</div>
              <div className="pgc-sectionSubtitle" style={styles.sectionSubtitle}>
                Pin&Go pricing activity for {format(month, "MMMM yyyy")}
              </div>
            </div>

            <div className="pgc-liveBadge" style={styles.liveBadge}>Live</div>
          </div>

          <div className="pgc-aiMetricsRow" style={styles.aiMetricsRow}>
            <div className="pgc-aiMetricCard" style={styles.aiMetricCard}>
              <div className="pgc-aiIconUp" style={styles.aiIconUp}>↑</div>
              <div>
                <div className="pgc-aiMetricValue" style={styles.aiMetricValue}>
                  {revenueSummary.seasonalAdjustments}
                </div>
                <div className="pgc-aiMetricLabel" style={styles.aiMetricLabel}>Seasonal</div>
              </div>
            </div>

           <div className="pgc-aiMetricCard" style={styles.aiMetricCard}>
  <div className="pgc-aiIconUp" style={styles.aiIconUp}>↑</div>
  <div>
    <div className="pgc-aiMetricValue" style={styles.aiMetricValue}>
      {revenueSummary.weekendBoosts}
    </div>
    <div className="pgc-aiMetricLabel" style={styles.aiMetricLabel}>Weekend Boosts</div>
  </div>
</div>

            <div className="pgc-aiMetricCard" style={styles.aiMetricCard}>
              <div className="pgc-aiIconDown" style={styles.aiIconDown}>↓</div>
              <div>
                <div className="pgc-aiMetricValue" style={styles.aiMetricValue}>
                  {revenueSummary.lastMinuteDiscounts}
                </div>
                <div className="pgc-aiMetricLabel" style={styles.aiMetricLabel}>Last Minute</div>
              </div>
            </div>

            <div className="pgc-aiMetricCard" style={styles.aiMetricCard}>
              <div className="pgc-aiIconUpWarm" style={styles.aiIconUpWarm}>↑</div>
              <div>
                <div className="pgc-aiMetricValue" style={styles.aiMetricValue}>
                  {revenueSummary.highDemandAdjustments}
                </div>
                <div className="pgc-aiMetricLabel" style={styles.aiMetricLabel}>High Demand</div>
              </div>
            </div>

            <div className="pgc-aiMetricCard" style={styles.aiMetricCard}>
              <div className="pgc-aiIconDownBlue" style={styles.aiIconDownBlue}>↓</div>
              <div>
                <div className="pgc-aiMetricValue" style={styles.aiMetricValue}>
                  {revenueSummary.lowDemandAdjustments}
                </div>
                <div className="pgc-aiMetricLabel" style={styles.aiMetricLabel}>Low Demand</div>
              </div>
            </div>
          </div>

          <div className="pgc-aiFooter" style={styles.aiFooter}>
            🦾 Pin&Go is monitoring demand and applying pricing rules automatically.
          </div>
        </div>

        <div className="pgc-guardrailsColumn" style={styles.guardrailsColumn}>
          <div className="pgc-sectionTitle" style={styles.sectionTitle}>Pricing Guardrails</div>

          <div className="pgc-guardrailsBox" style={styles.guardrailsBox}>
            <div>
              <div className="pgc-guardrailLabel" style={styles.guardrailLabel}>Base</div>
              <div className="pgc-guardrailValue" style={styles.guardrailValue}>${baseNightlyRate.toFixed(0)}</div>
            </div>

            <div>
              <div className="pgc-guardrailLabel" style={styles.guardrailLabel}>Min</div>
              <div className="pgc-guardrailValue" style={styles.guardrailValue}>
                ${minimumNightlyRate.toFixed(0)}
              </div>
            </div>

            <div>
              <div className="pgc-guardrailLabel" style={styles.guardrailLabel}>Max</div>
              <div className="pgc-guardrailValue" style={styles.guardrailValue}>
                ${maximumNightlyRate.toFixed(0)}
              </div>
            </div>
          </div>

          <div className="pgc-guardrailsActive" style={styles.guardrailsActive}>● Guardrails are active</div>
        </div>
      </div>

      </>}
      {(view === "combined" || view === "single") && <>
      <div className="pgc-calendarToolbar" style={styles.calendarToolbar}>
        <button
          type="button"
          className="pgc-todayButton" style={styles.todayButton}
          onClick={() => setMonth(startOfMonth(new Date()))}
        >
          Today
        </button>

        <button
          type="button"
          className="pgc-iconButton" style={styles.iconButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
        >
          ‹
        </button>

        <button
          type="button"
          className="pgc-iconButton" style={styles.iconButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
        >
          ›
        </button>

        <div className="pgc-monthTitle" style={styles.monthTitle}>{format(month, "MMMM yyyy")}⌄</div>

        <div className="pgc-viewButtons" style={styles.viewButtons}>
          <button type="button" className="pgc-viewButtonActive" style={styles.viewButtonActive}>
            Month
          </button>
               </div>
              </div>
      <div className="pgc-calendarGrid" style={styles.calendarGrid}>
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((weekday) => (
          <div key={weekday} className="pgc-weekday" style={styles.weekday}>
            {weekday}
          </div>
        ))}

        {calendarDays.map((day) => {
          const dateKey = getDateKey(day);
          const rate = rateByDate.get(dateKey);
          const reservation = getReservationForDay(day);
          const blockedDate = getBlockedDateForDay(day);
          const isPastDay = startOfDay(day) < today;
          const status = getStatusForDay(day);
          const rateReason = getRateReasonForDay(day, rate);
          const displayRate = getDisplayRateForDay(day, rate);
          const selected = isDayInSelectedRange(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                if (reservation?.id) {
                  navigate(`/reservations/${reservation.id}`);
                  return;
                }

                handleDayClick(day);
              }}
              className="pgc-dayCard" data-calendar-date={dateKey} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${format(day, "EEEE, MMMM d, yyyy")}. ${status}. Nightly rate ${status === "Blocked" ? "$0" : displayRate !== null ? `$${displayRate.toFixed(0)}` : "unavailable"}. ${reservation?.guestName || blockedDate?.reason || rateReason || ""}${reservation?.reservationNumber ? `. ${reservation.reservationNumber}` : ""}`} title={`${dateKey} · ${status} · ${status === "Blocked" ? "$0" : displayRate !== null ? `$${displayRate.toFixed(0)}` : "—"} · ${reservation?.guestName || blockedDate?.reason || rateReason || ""}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }} style={{
                ...styles.dayCard,
                opacity: !isSameMonth(day, month) || isPastDay ? 0.45 : 1,
                borderColor: selected
                  ? "#8b5cf6"
                  : status === "Blocked"
                  ? "#fca5a5"
                  : "#e2e8f0",
                background:
                  status === "Blocked"
                    ? "#fff1f2"
                    : selected
                    ? "#f5f3ff"
                    : "#ffffff",
              }}
            >
              <div className="pgc-dayTopRow" style={styles.dayTopRow}>
                <div className="pgc-dayNumber" style={styles.dayNumber}>{format(day, "d")}</div>
                <span
                  className="pgc-statusDot" style={{
                    ...styles.statusDot,
                    background:
                      status === "Booked"
                        ? "#2563eb"
                        : status === "Blocked"
                        ? "#dc2626"
                        : "#16a34a",
                  }}
                />
              </div>

              <div
                className="pgc-dayRate" style={{
                  ...styles.dayRate,
                  color: status === "Blocked" ? "#dc2626" : "#2563eb",
                }}
              >
                {status === "Blocked"
                  ? "$0"
                  : displayRate !== null
                  ? `$${displayRate.toFixed(0)}`
                  : "—"}
              </div>

              <div
                className="pgc-dayStatus" data-compact-status={status === "Available" ? "Open" : status} style={{
                  ...styles.dayStatus,
                  color:
                    status === "Booked"
                      ? "#2563eb"
                      : status === "Blocked"
                      ? "#dc2626"
                      : "#16a34a",
                }}
              >
                {status}
              </div>

              {reservation ? (
                <div className="pgc-dayMeta" style={styles.dayMeta}>
                  {reservation.guestName || "Guest"}
                </div>
              ) : blockedDate ? (
                <div className="pgc-dayMeta" style={styles.dayMeta}>
                  {blockedDate.reason || "Owner Stay"}
                </div>
              ) : (
                <div
                  className="pgc-reasonPill" style={{
                    ...styles.reasonPill,
                    color:
                      rateReason === "High Demand"
                        ? "#ea580c"
                        : rateReason === "Weekend Boost"
                        ? "#166534"
                        : "#475569",
                    background:
                      rateReason === "High Demand"
                        ? "#ffedd5"
                        : rateReason === "Weekend Boost"
                        ? "#dcfce7"
                        : "#f1f5f9",
                  }}
                >
                  {rateReason}
                </div>
              )}

              {reservation ? (
  <div className="pgc-dayMetaMuted" style={styles.dayMetaMuted}>
    {reservation.reservationNumber
      ? `#${reservation.reservationNumber}`
      : "Pending Reference"}
    {" · "}
    {getVisibleReservationSourceLabel(reservation)}
  </div>
) : null}
            </div>
          );
        })}
      </div>

      </>}
      {view !== "mission" && <>
      {hasSelectedRange && (
        <div className="pgc-rangeActionPanel" style={styles.rangeActionPanel}>
          <div>
            <div className="pgc-rangeActionTitle" style={styles.rangeActionTitle}>Range selected</div>
            <div className="pgc-rangeActionSubtitle" style={styles.rangeActionSubtitle}>{selectedRangeLabel}</div>
          </div>

          <div className="pgc-inlineActionForm" style={styles.inlineActionForm}>
  <div className="pgc-inlineActionLabel" style={styles.inlineActionLabel}>Block reason</div>

  <input
    type="text"
    value={blockReason}
    onChange={(e) => setBlockReason(e.target.value)}
    placeholder="Owner stay, maintenance, personal use..."
    className="pgc-inlineActionInput" style={{
      ...styles.inlineActionInput,
      width: 280,
    }}
  />
</div>

          <div className="pgc-rangeActionButtons" style={styles.rangeActionButtons}>
            <button
              type="button"
              className="pgc-primaryActionButton" style={styles.primaryActionButton}
              onClick={() => {
                setShowCreateReservationForm((value) => !value);
                setShowSetRateForm(false);
              }}
            >
              Create Reservation
            </button>

            <button
              type="button"
              onClick={handleBlockDates}
              disabled={savingBlock}
              className="pgc-actionButton" style={styles.actionButton}
            >
              {savingBlock ? "Blocking..." : "Block Dates"}
            </button>

            <button
              type="button"
              onClick={handleUnblockDates}
              disabled={savingUnblock}
              className="pgc-secondaryActionButton" style={styles.secondaryActionButton}
            >
              {savingUnblock ? "Unblocking..." : "Unblock Dates"}
            </button>

            <button
              type="button"
              className="pgc-secondaryActionButton" style={styles.secondaryActionButton}
              onClick={() => setShowSetRateForm((value) => !value)}
            >
              Manual Rate
            </button>

            <button
              type="button"
              className="pgc-clearButton" style={styles.clearButton}
              onClick={() => {
                setSelectedRange({ start: null, end: null });
                setShowSetRateForm(false);
                setShowCreateReservationForm(false);
                setRateInput("");
              }}
            >
              Clear
            </button>
          </div>

          {showSetRateForm && (
            <div className="pgc-inlineActionForm" style={styles.inlineActionForm}>
              <div className="pgc-inlineActionLabel" style={styles.inlineActionLabel}>
                Manual nightly rate override
              </div>

              <input
                type="number"
                min="0"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="199.00"
                className="pgc-inlineActionInput" style={styles.inlineActionInput}
              />

              <button
                type="button"
                onClick={handleApplyRate}
                disabled={savingRate}
                className="pgc-actionButton" style={styles.actionButton}
              >
                {savingRate ? "Applying..." : "Apply Manual Rate"}
              </button>
            </div>
          )}

          {showCreateReservationForm && (
            <div className="pgc-inlineActionForm" style={styles.inlineActionForm}>
              <div className="pgc-inlineActionLabel" style={styles.inlineActionLabel}>Create manual reservation</div>

              <input
                type="text"
                value={manualGuestName}
                onChange={(e) => setManualGuestName(e.target.value)}
                placeholder="Guest name"
                className="pgc-inlineActionInput" style={styles.inlineActionInput}
              />

              <input
                type="email"
                value={manualGuestEmail}
                onChange={(e) => setManualGuestEmail(e.target.value)}
                placeholder="Guest email"
                className="pgc-inlineActionInput" style={styles.inlineActionInput}
              />

              <input
                type="tel"
                value={manualGuestPhone}
                onChange={(e) => setManualGuestPhone(e.target.value)}
                placeholder="Guest phone"
                className="pgc-inlineActionInput" style={styles.inlineActionInput}
              />

              <label className="pgc-manualQuoteLabel" style={styles.manualQuoteLabel}>
                Guest communication language
              </label>

              <select
                value={manualGuestLanguage}
                onChange={(e) =>
                  setManualGuestLanguage(e.target.value === "es" ? "es" : "en")
                }
                className="pgc-inlineActionInput" style={styles.inlineActionInput}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>

             <select
  value={manualPaymentState}
  onChange={(e) => setManualPaymentState(e.target.value)}
  className="pgc-inlineActionInput" style={styles.inlineActionInput}
>
  <option value="NONE">Payment not recorded</option>
  <option value="PAID">Payment collected manually</option>
</select>

<div className="pgc-manualQuoteCard" style={styles.manualQuoteCard}>
  <div className="pgc-manualQuoteHeader" style={styles.manualQuoteHeader}>
    <div>
      <div className="pgc-manualQuoteLabel" style={styles.manualQuoteLabel}>
        Pin&Go calculated total
      </div>

      <div className="pgc-manualQuoteHint" style={styles.manualQuoteHint}>
        Based on selected dates, pricing rules, fees, amenities, and taxes.
      </div>
    </div>

    <div className="pgc-manualQuoteBadge" style={styles.manualQuoteBadge}>Pricing Engine</div>
  </div>

  {loadingManualReservationQuote ? (
    <div className="pgc-manualQuoteMuted" style={styles.manualQuoteMuted}>
      Calculating reservation total...
    </div>
  ) : manualReservationQuoteError ? (
    <div className="pgc-manualQuoteError" style={styles.manualQuoteError}>
      {manualReservationQuoteError}
    </div>
  ) : manualReservationQuote ? (
    <>
      <div className="pgc-manualQuoteTotal" style={styles.manualQuoteTotal}>
        {formatMoney(manualReservationQuote.totalAmount)}
      </div>

      <div className="pgc-manualQuoteBreakdown" style={styles.manualQuoteBreakdown}>
        <span>{manualReservationQuote.nights ?? 0} night(s)</span>
        <span>
          Nightly: {formatMoney(manualReservationQuote.nightlySubtotal)}
        </span>
        <span>
          Cleaning: {formatMoney(manualReservationQuote.cleaningFee)}
        </span>
        <span>
          Amenities: {formatMoney(manualReservationQuote.amenitiesTotal)}
        </span>
        <span>
          Taxes: {formatMoney(manualReservationQuote.taxesTotal)}
        </span>
      </div>

      <div className="pgc-manualQuoteMuted" style={styles.manualQuoteMuted}>
        {manualPaymentState === "PAID"
          ? "Host should collect this calculated amount from the guest."
          : "This amount is calculated, but payment is not marked as collected."}
      </div>
    </>
  ) : (
    <div className="pgc-manualQuoteMuted" style={styles.manualQuoteMuted}>
      Select dates to calculate the reservation total.
    </div>
  )}
</div>

              <button
                type="button"
                onClick={handleCreateManualReservation}
                disabled={savingManualReservation}
                className="pgc-primaryActionButton" style={styles.primaryActionButton}
              >
                {savingManualReservation ? "Creating..." : "Create Reservation"}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedDay && (
        <div className="pgc-selectedDayPanel" style={styles.selectedDayPanel}>
          <h3 className="pgc-selectedDayTitle" style={styles.selectedDayTitle}>
            {format(selectedDay, "MMMM d, yyyy")}
          </h3>

          <div className="pgc-detailLine" style={styles.detailLine}>
            Status: {getStatusForDay(selectedDay)}
          </div>

          <div className="pgc-detailLine" style={styles.detailLine}>
            Rate:{" "}
            {getDisplayRateForDay(
              selectedDay,
              rateByDate.get(getDateKey(selectedDay))
            ) !== null
              ? `$${getDisplayRateForDay(
                  selectedDay,
                  rateByDate.get(getDateKey(selectedDay))
                )?.toFixed(0)}`
              : "—"}
          </div>

                   {getSelectedPricingBreakdown().length > 0 ? (

                          <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "grid",
                gap: 12,
                maxWidth: 760,
                width: "100%",
                boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 950,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Revenue Decision
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: 750,
                    color: "#64748b",
                  }}
                >
                  How Pin&Go calculated this nightly rate.
                </div>
              </div>

                              <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    APMS Decision
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    Revenue Engine
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#475569",
                      border: "1px solid #e2e8f0",
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    Explainable Pricing
                  </span>
                </div>

              <div style={{ display: "grid", gap: 8 }}>
                {getSelectedPricingBreakdown().map((step: any, index: number) => {
                  const isFinal = step.rule === "FINAL_RATE";
                  const isBase =
                    step.rule === "BASE_RATE" ||
                    step.rule === "CUSTOM_RATE";

                  return (
                    <div
                      key={`${step.rule}-${index}`}
                      style={{
                        padding: isFinal ? "12px 0 0" : "8px 10px",
                        marginTop: isFinal ? 6 : 0,
                        borderTop: isFinal ? "1px solid #cbd5e1" : "none",
                        borderRadius: isFinal ? 0 : 12,
                        background: isFinal ? "transparent" : "#ffffff",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >

                      <div>
                        <div
                          style={{
                            fontSize: isFinal ? 14 : 13,
                            fontWeight: isFinal ? 950 : 850,
                            color: "#0f172a",
                          }}
                        >
                          {step.label}
                        </div>

                        {step.adjustmentPercent !== null &&
                        step.adjustmentPercent !== undefined ? (
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 11,
                              fontWeight: 800,
                              color:
                                Number(step.adjustmentPercent) >= 0
                                  ? "#166534"
                                  : "#2563eb",
                            }}
                          >
                            {Number(step.adjustmentPercent) > 0 ? "+" : ""}
                            {Number(step.adjustmentPercent)}%
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          textAlign: "right",
                          fontSize: isFinal ? 15 : 13,
                          fontWeight: isFinal ? 950 : 900,
                          color: isFinal
                            ? "#0f172a"
                            : isBase
                            ? "#2563eb"
                            : Number(step.adjustment ?? 0) >= 0
                            ? "#166534"
                            : "#dc2626",
                        }}
                      >
                        {isFinal || isBase
                          ? formatMoney(step.newValue)
                          : formatAdjustmentAmount(step.adjustment)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

         {getReservationForDay(selectedDay) && (
  <>
    <div className="pgc-detailLine" style={styles.detailLine}>
      Reservation:{" "}
      {getReservationForDay(selectedDay)?.reservationNumber
        ? `#${getReservationForDay(selectedDay)?.reservationNumber}`
        : "Pending Reference"}
    </div>

    <div className="pgc-detailLine" style={styles.detailLine}>
      Guest: {getReservationForDay(selectedDay)?.guestName || "Guest"}
    </div>

    <button
                type="button"
                className="pgc-primaryActionButton" style={styles.primaryActionButton}
                onClick={() => {
                  const reservation = getReservationForDay(selectedDay);
                  if (!reservation?.id) return;
                  navigate(`/reservations/${reservation.id}`);
                }}
              >
                Open Reservation
              </button>
            </>
          )}
        </div>
      )}

      </>}
      {(view === "combined" || view === "mission") && <>
       <div className="pgc-missionControlCard" style={styles.missionControlCard}>
  <div className="pgc-missionEnterpriseHeader" style={styles.missionEnterpriseHeader}>
    <div>
      <div className="pgc-missionEyebrow" style={styles.missionEyebrow}>Mission Control</div>
      <div className="pgc-missionEnterpriseTitle" style={styles.missionEnterpriseTitle}>
        Property operations overview
      </div>
      <div className="pgc-missionEnterpriseSubtitle" style={styles.missionEnterpriseSubtitle}>
        Reservation readiness, operational alerts, and recorded activity for this property.
      </div>
      <div role="note" className="pgc-missionEnterpriseSubtitle" style={styles.missionEnterpriseSubtitle}>
        Global engine health is not assessed in this view.
      </div>
    </div>

    <div className="pgc-missionStatusCluster" style={styles.missionStatusCluster}>
      <div className="pgc-missionGeneratedLabel" style={styles.missionGeneratedLabel}>
        {loading
          ? "Verifying live snapshot"
          : hasLiveMissionControlSnapshot
          ? "Live snapshot"
          : "Live snapshot unavailable"}
      </div>
    </div>
  </div>

  {!hasLiveMissionControlSnapshot && !loading ? (
    <div className="pgc-missionUnavailableState" style={styles.missionUnavailableState}>
      <strong>Mission Control live state is unavailable.</strong>
      <span>
        Operational data is unavailable for this property. No activity or
        readiness metrics are inferred while the snapshot is unavailable.
      </span>
    </div>
  ) : null}

  <div className="pgc-missionHeroGrid" style={styles.missionHeroGrid}>
    <div className="pgc-missionHeroCard" style={styles.missionHeroCard}>
      <div className="pgc-missionHeroLabel" style={styles.missionHeroLabel}>Autonomy Score</div>
      <div className="pgc-missionHeroValue" style={styles.missionHeroValue}>
        {autonomyScore === null ? "—" : `${autonomyScore}%`}
      </div>
      <div className="pgc-missionProgressShell" style={styles.missionProgressShell}>
        <div
          className="pgc-missionProgressFill" style={{
            ...styles.missionProgressFill,
            width: `${
              autonomyScore === null
                ? 0
                : Math.min(Math.max(autonomyScore, 0), 100)
            }%`,
          }}
        />
      </div>
      <div className="pgc-missionHeroHint" style={styles.missionHeroHint}>
        Operations completed without manual intervention
      </div>
    </div>

    <div className="pgc-missionHeroCard" style={styles.missionHeroCard}>
      <div className="pgc-missionHeroLabel" style={styles.missionHeroLabel}>Interventions Avoided</div>
      <div className="pgc-missionHeroValue" style={styles.missionHeroValue}>
        {interventionsAvoided === null ? "—" : interventionsAvoided}
      </div>
      <div className="pgc-missionHeroHint" style={styles.missionHeroHint}>
        Host actions avoided in this APMS window
      </div>
    </div>

    <div className="pgc-missionHeroCard" style={styles.missionHeroCard}>
      <div className="pgc-missionHeroLabel" style={styles.missionHeroLabel}>Autonomous Decisions</div>
      <div className="pgc-missionHeroValue" style={styles.missionHeroValue}>
        {autonomousDecisions === null ? "—" : autonomousDecisions}
      </div>
      <div className="pgc-missionHeroHint" style={styles.missionHeroHint}>
        Decisions executed by Pin&Go engines
      </div>
    </div>

  </div>

     {guestJourneyMetrics ? (
    <div className="pgc-guestJourneyPanel" style={styles.guestJourneyPanel}>
      <div className="pgc-guestJourneyHeader" style={styles.guestJourneyHeader}>
        <div>
          <div className="pgc-guestJourneyEyebrow" style={styles.guestJourneyEyebrow}>
            Guest Journey Engine
          </div>

          <div className="pgc-guestJourneyTitle" style={styles.guestJourneyTitle}>
            Arrival readiness pipeline
          </div>

          <div className="pgc-guestJourneySubtitle" style={styles.guestJourneySubtitle}>
            Live progress from reservation confirmation through secure
            verification and digital access readiness.
          </div>
        </div>

        <div className="pgc-guestJourneyCompletion" style={styles.guestJourneyCompletion}>
          <div className="pgc-guestJourneyCompletionValue" style={styles.guestJourneyCompletionValue}>
            {guestJourneyCompletionRate}%
          </div>
          <div className="pgc-guestJourneyCompletionLabel" style={styles.guestJourneyCompletionLabel}>
            Completion rate
          </div>
        </div>
      </div>

      <div className="pgc-guestJourneyMetricGrid" style={styles.guestJourneyMetricGrid}>
        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyActiveReservations}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Active reservations
          </div>
        </div>

        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyReservationConfirmed}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Reservation confirmed
          </div>
        </div>

        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyVerificationPending}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Verification pending
          </div>
        </div>

        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyVerificationCompleted}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Verification completed
          </div>
        </div>

        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyAccessScheduled}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Access scheduled
          </div>
        </div>

        <div className="pgc-guestJourneyMetricCard" style={styles.guestJourneyMetricCard}>
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyReadyForArrival}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Ready for arrival
          </div>
        </div>

        <div
          className="pgc-guestJourneyMetricCard" style={{
            ...styles.guestJourneyMetricCard,
            ...(guestJourneyHostInterventionRequired > 0
              ? styles.guestJourneyAttentionCard
              : styles.guestJourneyClearCard),
          }}
        >
          <div className="pgc-guestJourneyMetricValue" style={styles.guestJourneyMetricValue}>
            {guestJourneyHostInterventionRequired}
          </div>
          <div className="pgc-guestJourneyMetricLabel" style={styles.guestJourneyMetricLabel}>
            Host intervention required
          </div>
        </div>
      </div>
    </div>
  ) : null}

  {hasOperationalIntelligenceContract ? (
    <OperationalIntelligencePanel
      items={missionControlOperationalItems}
      onOpenReservation={(reservationId) => {
        navigate(`/reservations/${reservationId}`);
      }}
    />
  ) : null}


  {recentApmsActivities.length > 0 ? (
    <div className="pgc-missionPanel" style={styles.missionPanel}>
      <div className="pgc-missionPanelHeader" style={styles.missionPanelHeader}>
        <div>
          <div className="pgc-missionPanelTitle" style={styles.missionPanelTitle}>Recent APMS Activity</div>
          <div className="pgc-missionPanelMeta" style={styles.missionPanelMeta}>
            Latest autonomous actions completed by Pin&Go
          </div>
        </div>
      </div>

      <div className="pgc-missionActivityTimeline" style={styles.missionActivityTimeline}>
        {recentApmsActivities.map((entry: any) => (
          <div
            key={entry.decisionId ?? `${entry.engine}-${entry.summary}`}
            className="pgc-missionActivityRow" style={styles.missionActivityRow}
          >
            <div className="pgc-missionActivityMarker" style={styles.missionActivityMarker} />

            <div className="pgc-missionActivityContent" style={styles.missionActivityContent}>
              <div className="pgc-missionActivityTopRow" style={styles.missionActivityTopRow}>
                <div className="pgc-missionActivityEngine" style={styles.missionActivityEngine}>
                  {getMissionActivityEngineLabel(entry.engine)}
                </div>

                <div
                  className="pgc-missionStatusPill" style={{
                    ...styles.missionStatusPill,
                    ...getMissionStatusPillStyle(entry.status ?? "SUCCESS"),
                  }}
                >
                  {entry.status ?? "SUCCESS"}
                </div>
              </div>
               <div className="pgc-missionActivityReason" style={styles.missionActivityReason}>
  {getMissionActivityReasonLabel(entry)}
</div>

{getMissionActivityDetail(entry) ? (
  <div className="pgc-missionActivityDetail" style={styles.missionActivityDetail}>
    {getMissionActivityDetail(entry)}
  </div>
) : null}

<div className="pgc-missionActivitySummary" style={styles.missionActivitySummary}>
  {sanitizeWhiteLabelText(entry.summary)}
</div>

<div className="pgc-missionActivityMeta" style={styles.missionActivityMeta}>
  {formatMissionActivityTime(entry)}
</div>

            </div>
          </div>
        ))}
      </div>
    </div>
   ) : null}

  {(
  !hasOperationalIntelligenceContract ||
  shouldShowLegacyCriticalFallback
) && primaryMissionControlAction ? (
  <div style={getMissionActionBoxStyle(primaryMissionControlAction)}>
    <div className="pgc-missionActionHeader" style={styles.missionActionHeader}>
      <div>
        <div style={getMissionActionTitleStyle(primaryMissionControlAction)}>
          Recommended Action
        </div>

        <div className="pgc-missionActionTopMeta" style={styles.missionActionTopMeta}>
          <span className="pgc-missionActionEngineBadge" style={styles.missionActionEngineBadge}>
            {getMissionActionEngineDisplayLabel(
              primaryMissionControlAction.engine
            )}
          </span>

          <span className="pgc-missionActionSignal" style={styles.missionActionSignal}>
            {getMissionActionLastSignalLabel(primaryMissionControlAction)}
          </span>
        </div>

        <div className="pgc-missionActionText" style={styles.missionActionText}>
          {sanitizeWhiteLabelText(primaryMissionControlAction.title)}
        </div>
      </div>

      <div
        className="pgc-missionStatusPill" style={{
          ...styles.missionStatusPill,
          ...getMissionStatusPillStyle(
            getMissionActionVisualStatus(primaryMissionControlAction)
          ),
        }}
      >
        {getMissionActionBadgeLabel(primaryMissionControlAction)}
      </div>
    </div>

    {renderMissionActionDetails(primaryMissionControlAction)}

    <div className="pgc-missionActionFooterRow" style={styles.missionActionFooterRow}>
      <div style={getMissionActionFooterStyle(primaryMissionControlAction)}>
        {getMissionActionFooterLabel(primaryMissionControlAction)}
      </div>

      <div className="pgc-missionActionTrustText" style={styles.missionActionTrustText}>
        {primaryMissionControlAction.requiresHumanAction
          ? "Pin&Go detected a real signal that needs host review."
          : "Pin&Go is monitoring this property and no host action is needed."}
      </div>
    </div>

    {secondaryMissionControlActions.length > 0 ? (
      <div className="pgc-missionActionList" style={styles.missionActionList}>
        {secondaryMissionControlActions.map((action: any, index: number) => (
          <div
            key={`${
  action.reservationNumber ??
  action.reservationId ??
  "property"
}-${action.engine}-${action.title}-${index}`}
            className="pgc-missionActionItem" style={styles.missionActionItem}
          >
            <div className="pgc-missionActionItemTopRow" style={styles.missionActionItemTopRow}>
              <div>
                <div className="pgc-missionActionMiniMeta" style={styles.missionActionMiniMeta}>
                  <span className="pgc-missionActionEngineBadge" style={styles.missionActionEngineBadge}>
                    {getMissionActionEngineDisplayLabel(action.engine)}
                  </span>

                  <span className="pgc-missionActionSignal" style={styles.missionActionSignal}>
                    {getMissionActionLastSignalLabel(action)}
                  </span>
                </div>

                <div className="pgc-missionActionText" style={styles.missionActionText}>
                  {sanitizeWhiteLabelText(action.title)}
                </div>
              </div>

              <div
                className="pgc-missionStatusPill" style={{
                  ...styles.missionStatusPill,
                  ...getMissionStatusPillStyle(
                    getMissionActionVisualStatus(action)
                  ),
                }}
              >
                {getMissionActionBadgeLabel(action)}
              </div>
            </div>

           {renderMissionActionDetails(action)}
          </div>
        ))}

        {hiddenMissionControlActionCount > 0 ? (
          <div className="pgc-missionActionCount" style={styles.missionActionCount}>
            +{hiddenMissionControlActionCount} more grouped action
            {hiddenMissionControlActionCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    ) : null}
  </div>
) : null}
     {!hasOperationalIntelligenceContract && autoResolutionLogItems.length > 0 ? (
  <div className="pgc-autoResolutionPanel" style={styles.autoResolutionPanel}>
    <div className="pgc-autoResolutionHeader" style={styles.autoResolutionHeader}>
      <div>
        <div className="pgc-autoResolutionEyebrow" style={styles.autoResolutionEyebrow}>
          Auto Resolution Log
        </div>

        <div className="pgc-autoResolutionHeading" style={styles.autoResolutionHeading}>
          Operations resolved by Pin&Go
        </div>

        <div className="pgc-autoResolutionSubheading" style={styles.autoResolutionSubheading}>
          Autonomous APMS actions completed without host intervention.
        </div>
      </div>

      <div className="pgc-autoResolutionStats" style={styles.autoResolutionStats}>
        <div className="pgc-autoResolutionStatCard" style={styles.autoResolutionStatCard}>
          <div className="pgc-autoResolutionStatValue" style={styles.autoResolutionStatValue}>
            {autoResolutionLogItems.length}
          </div>
          <div className="pgc-autoResolutionStatLabel" style={styles.autoResolutionStatLabel}>
            Resolved automatically
          </div>
        </div>

        <div className="pgc-autoResolutionStatCard" style={styles.autoResolutionStatCard}>
          <div className="pgc-autoResolutionStatValue" style={styles.autoResolutionStatValue}>0</div>
          <div className="pgc-autoResolutionStatLabel" style={styles.autoResolutionStatLabel}>
            Host actions required
          </div>
        </div>
      </div>
    </div>

    <div className="pgc-autoResolutionTimeline" style={styles.autoResolutionTimeline}>
      {autoResolutionLogItems.map((entry: any, index: number) => (
        <div
          key={`${entry.decisionId ?? entry.id ?? index}-auto-resolution`}
          className="pgc-autoResolutionTimelineRow" style={styles.autoResolutionTimelineRow}
        >
          <div className="pgc-autoResolutionTimelineRail" style={styles.autoResolutionTimelineRail}>
            <div className="pgc-autoResolutionTimelineDot" style={styles.autoResolutionTimelineDot}>✓</div>
            {index < autoResolutionLogItems.length - 1 ? (
              <div className="pgc-autoResolutionTimelineLine" style={styles.autoResolutionTimelineLine} />
            ) : null}
          </div>

          <div className="pgc-autoResolutionEnterpriseCard" style={styles.autoResolutionEnterpriseCard}>
            <div className="pgc-autoResolutionCardTopRow" style={styles.autoResolutionCardTopRow}>
              <div>
                <div className="pgc-autoResolutionEngineBadge" style={styles.autoResolutionEngineBadge}>
                  {getMissionActivityEngineLabel(entry.engine)}
                </div>

                <div className="pgc-autoResolutionTitle" style={styles.autoResolutionTitle}>
                  {getAutoResolutionTitle(entry)}
                </div>
              </div>

              <div className="pgc-autoResolutionResolvedPill" style={styles.autoResolutionResolvedPill}>
                Resolved automatically
              </div>
            </div>

            <div className="pgc-autoResolutionDescription" style={styles.autoResolutionDescription}>
              {getAutoResolutionDescription(entry)}
            </div>

            {getMissionActivityDetail(entry) ? (
              <div className="pgc-autoResolutionDetail" style={styles.autoResolutionDetail}>
                {getMissionActivityDetail(entry)}
              </div>
            ) : null}

            <div className="pgc-autoResolutionFooter" style={styles.autoResolutionFooter}>
              <span>APMS execution completed</span>
              <span>{formatMissionActivityTime(entry)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
) : null}

      </div>

      </>}
      <Link to={`/properties/${id}/edit`} style={styles.backLink}>
        Back to property
      </Link>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 28,
    background: "#ffffff",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "#020617",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 14,
    fontWeight: 700,
  },
  autoPilotPill: {
    height: 44,
    padding: "0 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 14px 30px rgba(15,23,42,0.16)",
  },
  summaryGrid: {
    marginTop: 28,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
    gap: 24,
  },
  summaryCard: {
    minHeight: 92,
    padding: 20,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    color: "#020617",
  },
  summaryHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#334155",
    fontWeight: 750,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#f3f0ff",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
    fontSize: 26,
    fontWeight: 950,
  },
  summaryIconGreen: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#16a34a",
    display: "grid",
    placeItems: "center",
    fontSize: 26,
    fontWeight: 950,
  },
  summaryIconRed: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#ffe4e6",
    color: "#dc2626",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 950,
  },
  summaryIconPurple: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#f3e8ff",
    color: "#7c3aed",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  
    guestJourneyPanel: {
    margin: 18,
    marginTop: 0,
    padding: 18,
    borderRadius: 20,
    border: "1px solid #cbd5e1",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    boxShadow: "0 14px 36px rgba(15,23,42,0.06)",
  },

  guestJourneyHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },

  guestJourneyEyebrow: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  guestJourneyTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
  },

  guestJourneySubtitle: {
    marginTop: 6,
    maxWidth: 620,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 750,
  },

  guestJourneyCompletion: {
    minWidth: 132,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    textAlign: "right",
  },

  guestJourneyCompletionValue: {
    color: "#1d4ed8",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 950,
  },

  guestJourneyCompletionLabel: {
    marginTop: 6,
    color: "#475569",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  guestJourneyMetricGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },

  guestJourneyMetricCard: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  guestJourneyMetricValue: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
  },

  guestJourneyMetricLabel: {
    marginTop: 7,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  guestJourneyAttentionCard: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
  },

  guestJourneyClearCard: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
  },

  missionControlCard: {
  marginTop: 24,
  borderRadius: 24,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  boxShadow: "0 24px 70px rgba(15,23,42,0.10)",
  overflow: "hidden",
  display: "grid",
},

missionEnterpriseHeader: {
  padding: 24,
  background:
    "linear-gradient(135deg, #0f172a 0%, #1e293b 56%, #334155 100%)",
  color: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
},

missionEyebrow: {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#93c5fd",
},

missionEnterpriseTitle: {
  marginTop: 8,
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 950,
  color: "#ffffff",
},

missionEnterpriseSubtitle: {
  marginTop: 8,
  maxWidth: 620,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 700,
  color: "#cbd5e1",
},

missionStatusCluster: {
  display: "grid",
  justifyItems: "end",
  gap: 8,
  minWidth: 150,
},

missionStatusPill: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  whiteSpace: "nowrap",
},

missionStatusDot: {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "currentColor",
},

missionGeneratedLabel: {
  fontSize: 11,
  fontWeight: 800,
  color: "#cbd5e1",
},

missionUnavailableState: {
  margin: 18,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  display: "grid",
  gap: 6,
  fontSize: 12,
  lineHeight: 1.45,
},

missionEngineUnavailable: {
  padding: 16,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
},

missionHeroGrid: {
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
},

missionHeroCard: {
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
},

missionHeroLabel: {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
},

missionHeroValue: {
  marginTop: 10,
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
},

missionHeroHint: {
  marginTop: 9,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 750,
  color: "#64748b",
},

missionProgressShell: {
  marginTop: 12,
  height: 8,
  borderRadius: 999,
  background: "#e2e8f0",
  overflow: "hidden",
},

missionProgressFill: {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #22c55e, #16a34a)",
},

missionPanel: {
  margin: 18,
  marginTop: 0,
  padding: 0,
  borderRadius: 22,
  border: "1px solid #cbd5e1",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 18px 44px rgba(15,23,42,0.08)",
  overflow: "hidden",
  display: "grid",
  gap: 0,
},

missionPanelHeader: {
  padding: 18,
  background:
    "linear-gradient(135deg, #020617 0%, #0f172a 58%, #1e293b 100%)",
  color: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
},

missionPanelTitle: {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#93c5fd",
},

missionPanelMeta: {
  marginTop: 7,
  fontSize: 12,
  fontWeight: 750,
  color: "#cbd5e1",
},

missionEngineGrid: {
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
},
missionEngineCard: {
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
},

missionEngineHeader: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
},

missionEngineName: {
  fontSize: 14,
  fontWeight: 950,
  color: "#0f172a",
},

missionEngineTimestamp: {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 800,
  color: "#94a3b8",
},

missionEngineMessage: {
  marginTop: 14,
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 750,
  color: "#475569",
},

missionActivityTimeline: {
  padding: 18,
  display: "grid",
  gap: 10,
},

missionActivityRow: {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  gap: 12,
  alignItems: "start",
},

missionActivityMarker: {
  width: 10,
  height: 10,
  marginTop: 8,
  borderRadius: 999,
  background: "#2563eb",
  boxShadow: "0 0 0 5px #dbeafe",
},

missionActivityContent: {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
},

missionActivityTopRow: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
},

missionActivityEngine: {
  fontSize: 13,
  fontWeight: 950,
  color: "#0f172a",
},

missionActivityReason: {
  marginTop: 8,
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
  color: "#0f172a",
},

missionActivityDetail: {
  marginTop: 5,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 850,
  color: "#2563eb",
},

missionActivitySummary: {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 800,
  color: "#334155",
},

missionActivityMeta: {
  marginTop: 8,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
},

missionActionBox: {
  margin: 18,
  marginTop: 0,
  padding: 16,
  borderRadius: 20,
  border: "1px solid #bbf7d0",
  background:
    "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
},

missionActionHeader: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
},

missionActionTitle: {
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#166534",
},

missionActionText: {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 900,
  color: "#0f172a",
},

missionActionMeta: {
  marginTop: 8,
  fontSize: 12,
  fontWeight: 800,
  color: "#166534",
},
 
missionActionTopMeta: {
  marginTop: 10,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
},

missionActionMiniMeta: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
},

missionActionEngineBadge: {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
},

missionActionSignal: {
  fontSize: 11,
  fontWeight: 850,
  color: "#64748b",
},

missionActionFooterRow: {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
},

missionActionFooter: {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 11,
  fontWeight: 950,
},

missionActionTrustText: {
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 850,
  color: "#64748b",
},

missionActionList: {
  marginTop: 14,
  display: "grid",
  gap: 10,
},

missionActionItem: {
  padding: 12,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
},

missionActionItemTopRow: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
},

missionActionEngine: {
  marginTop: 5,
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#64748b",
},

missionActionCount: {
  fontSize: 12,
  fontWeight: 850,
  color: "#475569",
},
  
autoResolutionPanel: {
  margin: 18,
  marginTop: 0,
  padding: 0,
  borderRadius: 22,
  border: "1px solid #cbd5e1",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 18px 44px rgba(15,23,42,0.08)",
  overflow: "hidden",
},

autoResolutionHeader: {
  padding: 18,
  background:
    "linear-gradient(135deg, #020617 0%, #0f172a 58%, #1e293b 100%)",
  color: "#ffffff",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
},

autoResolutionEyebrow: {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#86efac",
},

autoResolutionHeading: {
  marginTop: 7,
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 950,
  color: "#ffffff",
},

autoResolutionSubheading: {
  marginTop: 7,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
  color: "#cbd5e1",
},

autoResolutionStats: {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(110px, 1fr))",
  gap: 10,
  minWidth: 260,
},

autoResolutionStatCard: {
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(10px)",
},

autoResolutionStatValue: {
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 950,
  color: "#ffffff",
},

autoResolutionStatLabel: {
  marginTop: 6,
  fontSize: 10,
  lineHeight: 1.25,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#cbd5e1",
},

autoResolutionTimeline: {
  padding: 18,
  display: "grid",
  gap: 0,
},

autoResolutionTimelineRow: {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  gap: 12,
},

autoResolutionTimelineRail: {
  display: "grid",
  justifyItems: "center",
  gridTemplateRows: "28px 1fr",
},

autoResolutionTimelineDot: {
  width: 28,
  height: 28,
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  display: "grid",
  placeItems: "center",
  fontSize: 13,
  fontWeight: 950,
  boxShadow: "0 0 0 5px #f0fdf4",
},

autoResolutionTimelineLine: {
  width: 2,
  minHeight: 18,
  background: "#e2e8f0",
},

autoResolutionEnterpriseCard: {
  marginBottom: 14,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
},

autoResolutionCardTopRow: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
},

autoResolutionEngineBadge: {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
},

autoResolutionResolvedPill: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 9px",
  borderRadius: 999,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
},

autoResolutionTitle: {
  marginTop: 9,
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  color: "#0f172a",
},

autoResolutionDescription: {
  marginTop: 9,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
  color: "#475569",
},

autoResolutionDetail: {
  marginTop: 10,
  width: "fit-content",
  padding: "6px 9px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
},

autoResolutionFooter: {
  marginTop: 12,
  paddingTop: 10,
  borderTop: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 11,
  fontWeight: 850,
  color: "#64748b",
},

  controlCenterCard: {
    marginTop: 24,
    padding: 22,
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 16px 36px rgba(15,23,42,0.05)",
    display: "grid",
    gridTemplateColumns: "220px minmax(520px, 1fr) 300px",
    gap: 24,
    alignItems: "stretch",
  },
  legendColumn: {
    borderRight: "1px solid #e2e8f0",
    paddingRight: 22,
  },
  aiColumn: {
    borderRight: "1px solid #e2e8f0",
    paddingRight: 22,
  },
  guardrailsColumn: {
    minWidth: 260,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#475569",
    fontWeight: 750,
  },
  legendList: {
    marginTop: 22,
    display: "grid",
    gap: 16,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    fontWeight: 850,
    color: "#0f172a",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  aiHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  liveBadge: {
    borderRadius: 999,
    padding: "7px 11px",
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: 12,
    fontWeight: 950,
  },
  aiMetricsRow: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
    gap: 12,
  },
  aiMetricCard: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  aiIconUp: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#16a34a",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  aiIconDown: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#f3e8ff",
    color: "#7c3aed",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  aiIconUpWarm: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#ffedd5",
    color: "#ea580c",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  aiIconDownBlue: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#dbeafe",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  aiMetricValue: {
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 950,
    color: "#020617",
  },
  aiMetricLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#334155",
    fontWeight: 850,
  },
  aiFooter: {
    marginTop: 14,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },
  guardrailsBox: {
    marginTop: 22,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
  },
  guardrailLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: 850,
  },
  guardrailValue: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 1,
    color: "#2563eb",
    fontWeight: 950,
  },
  guardrailsActive: {
    marginTop: 0,
    padding: "14px 18px",
    borderRadius: "0 0 16px 16px",
    border: "1px solid #e2e8f0",
    borderTop: "none",
    color: "#16a34a",
    fontSize: 13,
    fontWeight: 950,
  },
  calendarToolbar: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "auto auto auto 1fr auto",
    alignItems: "center",
    gap: 10,
  },
  todayButton: {
    height: 44,
    padding: "0 22px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#2563eb",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 700,
    cursor: "pointer",
  },
  monthTitle: {
    justifySelf: "center",
    fontSize: 22,
    fontWeight: 950,
    color: "#020617",
  },
  viewButtons: {
    display: "flex",
    gap: 8,
  },
  viewButtonActive: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#f3f0ff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },
  viewButton: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    fontSize: 14,
    fontWeight: 850,
  },
  calendarGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
    gap: 8,
  },
  weekday: {
    fontSize: 12,
    fontWeight: 950,
    color: "#475569",
    textAlign: "center",
    padding: "6px 0",
  },
  dayCard: {
    minHeight: 118,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 6,
    cursor: "pointer",
  },
  dayTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 850,
    color: "#0f172a",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dayRate: {
    marginTop: 2,
    fontSize: 35,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  dayStatus: {
    fontSize: 12,
    fontWeight: 950,
  },
  reasonPill: {
    width: "fit-content",
    marginTop: 2,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 850,
  },
  dayMeta: {
    fontSize: 11,
    color: "#0f172a",
    fontWeight: 850,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dayMetaMuted: {
    fontSize: 10,
    color: "#475569",
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rangeActionPanel: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  rangeActionTitle: {
    fontSize: 15,
    fontWeight: 950,
    color: "#0f172a",
  },
  rangeActionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 850,
    color: "#2563eb",
  },
  rangeActionButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryActionButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  actionButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryActionButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  clearButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  inlineActionForm: {
    width: "100%",
    marginTop: 4,
    paddingTop: 16,
    borderTop: "1px solid #bfdbfe",
    display: "flex",
    gap: 10,
    alignItems: "end",
    flexWrap: "wrap",
  },
  inlineActionLabel: {
    width: "100%",
    fontSize: 12,
    fontWeight: 950,
    color: "#1e3a8a",
  },
  inlineActionInput: {
    height: 40,
    width: 170,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
  },
  manualQuoteCard: {
  width: "100%",
  marginTop: 4,
  padding: 14,
  borderRadius: 16,
  border: "1px solid #bfdbfe",
  background: "#ffffff",
  display: "grid",
  gap: 10,
},

manualQuoteHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
},

manualQuoteLabel: {
  fontSize: 12,
  fontWeight: 950,
  color: "#1e3a8a",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
},

manualQuoteHint: {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 750,
  color: "#475569",
},

manualQuoteBadge: {
  padding: "5px 9px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
},

manualQuoteTotal: {
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
},

manualQuoteBreakdown: {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 12,
  fontWeight: 850,
  color: "#334155",
},

manualQuoteMuted: {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
},

manualQuoteError: {
  padding: 10,
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 850,
},
 selectedDayPanel: {
    marginTop: 24,
    padding: 20,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#ffffff",
  },
  selectedDayTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#020617",
  },
  detailLine: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
  },
  backLink: {
    display: "inline-block",
    marginTop: 18,
    color: "#2563eb",
    fontWeight: 900,
  },
};
