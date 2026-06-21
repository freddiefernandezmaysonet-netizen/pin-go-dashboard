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
import { Link, useNavigate, useParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

export function PropertyCalendarPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [nightlyRates, setNightlyRates] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [property, setProperty] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreateReservationForm, setShowCreateReservationForm] =
    useState(false);
  const [manualGuestName, setManualGuestName] = useState("");
  const [manualGuestEmail, setManualGuestEmail] = useState("");
  const [manualGuestPhone, setManualGuestPhone] = useState("");
  const [manualPaymentState, setManualPaymentState] = useState("NONE");
  const [savingManualReservation, setSavingManualReservation] = useState(false);

  const [selectedRange, setSelectedRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });

  const [rateInput, setRateInput] = useState("");
  const [showSetRateForm, setShowSetRateForm] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingUnblock, setSavingUnblock] = useState(false);

  const today = startOfDay(new Date());

  const from = useMemo(() => format(startOfMonth(month), "yyyy-MM-dd"), [month]);
  const to = useMemo(
    () => format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd"),
    [month]
  );

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

const occupancyLowThresholdPercent =
  property?.occupancyLowThresholdPercent != null
    ? Number(property.occupancyLowThresholdPercent)
    : null;

const occupancyHighThresholdPercent =
  property?.occupancyHighThresholdPercent != null
    ? Number(property.occupancyHighThresholdPercent)
    : null;

function getRateReasonForDay(day: Date, rate: any) {
  const reason = rate?.reason;

  if (reason === "CUSTOM_RATE") return "Manual Override";
  if (reason === "Calendar override") return "Manual Override";

  const reasons: string[] = [];

  if (
    occupancyLowThresholdPercent !== null &&
    occupancySummary.occupancyPercent <= occupancyLowThresholdPercent
  ) {
    reasons.push("Low Demand");
  }

  if (
    occupancyHighThresholdPercent !== null &&
    occupancySummary.occupancyPercent >= occupancyHighThresholdPercent
  ) {
    reasons.push("High Demand");
  }

  if (reason === "LEAD_TIME_RULE") {
    reasons.push("Last Minute");
  }

  if (
    dynamicPricingEnabled &&
    weekendMarkupPercent > 0 &&
    isWeekendNight(day)
  ) {
    reasons.push("Weekend Boost");
  }

  if (reasons.length > 0) {
    return reasons.join(" + ");
  }

  return "Base Rate";
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
    let weekendBoosts = 0;
    let lastMinuteDiscounts = 0;
    let highDemandAdjustments = 0;
    let lowDemandAdjustments = 0;
    let manualOverrides = 0;

    for (const day of visibleMonthDays) {
      const rate = rateByDate.get(getDateKey(day));
      const reason = getRateReasonForDay(day, rate);

      if (reason === "Weekend Boost") weekendBoosts += 1;
      if (reason === "Last Minute") lastMinuteDiscounts += 1;
      if (reason === "High Demand") highDemandAdjustments += 1;
      if (reason === "Low Demand") lowDemandAdjustments += 1;
      if (reason === "Manual Override") manualOverrides += 1;
    }

    return {
      weekendBoosts,
      lastMinuteDiscounts,
      highDemandAdjustments,
      lowDemandAdjustments,
      manualOverrides,
      totalOptimizations:
        weekendBoosts +
        lastMinuteDiscounts +
        highDemandAdjustments +
        lowDemandAdjustments,
    };
  
 }, [
  visibleMonthDays,
  rateByDate,
  dynamicPricingEnabled,
  weekendMarkupPercent,
  baseNightlyRate,
]);

const occupancySummary = useMemo(() => {
  const lookaheadDays = Number(property?.occupancyLookaheadDays ?? 30);
  const windowDays =
    Number.isFinite(lookaheadDays) && lookaheadDays > 0 ? lookaheadDays : 30;

  const occupancyStart = today;
  const occupancyEnd = addDays(occupancyStart, windowDays);

  const occupancyDays = eachDayOfInterval({
    start: occupancyStart,
    end: addDays(occupancyEnd, -1),
  });

  const totalDays = occupancyDays.length || 1;

  let bookedDays = 0;
  let blockedDays = 0;

  for (const day of occupancyDays) {
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
    windowDays,
  };
}, [property?.occupancyLookaheadDays, reservations, blockedDates, today]);
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
            reason: "Calendar block",
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
            checkIn: getDateKey(selectedRange.start),
            checkOut: getDateKey(selectedRange.end ?? selectedRange.start),
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
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Property Calendar</h1>
          <p style={styles.subtitle}>
            {loading
              ? "Loading calendar intelligence..."
              : `${nightlyRates.length} rate signal(s), ${reservations.length} reservation(s), and ${blockedDates.length} blocked date(s) loaded.`}
          </p>
        </div>

        <div style={styles.autoPilotPill}>🦾 Auto Pilot Active</div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div>
            <div style={styles.summaryLabel}>Occupancy</div>
            <div style={styles.summaryValue}>
              {occupancySummary.occupancyPercent}%
            </div>
            <div style={styles.summaryHint}>
  Rolling {occupancySummary.windowDays}-day window ·{" "}
  {occupancySummary.bookedDays} booked ·{" "}
  {occupancySummary.availableDays} available
</div>
          </div>
          <div style={styles.summaryIcon}>◔</div>
        </div>

        <div style={styles.summaryCard}>
          <div>
            <div style={styles.summaryLabel}>Revenue Optimizations</div>
            <div style={styles.summaryValue}>
              {revenueSummary.totalOptimizations}
            </div>
            <div style={styles.summaryHint}>Pricing engine actions this month</div>
          </div>
          <div style={styles.summaryIconGreen}>⌁</div>
        </div>

        <div style={styles.summaryCard}>
          <div>
            <div style={styles.summaryLabel}>Blocked Dates</div>
            <div style={styles.summaryValue}>{occupancySummary.blockedDays}</div>
            <div style={styles.summaryHint}>Owner stay or maintenance</div>
          </div>
          <div style={styles.summaryIconRed}>▣</div>
        </div>

        <div style={styles.summaryCard}>
          <div>
            <div style={styles.summaryLabel}>Manual Overrides</div>
            <div style={styles.summaryValue}>{revenueSummary.manualOverrides}</div>
            <div style={styles.summaryHint}>Human pricing adjustments</div>
          </div>
          <div style={styles.summaryIconPurple}>✎</div>
        </div>
      </div>

      <div style={styles.controlCenterCard}>
        <div style={styles.legendColumn}>
          <div style={styles.sectionTitle}>Calendar Intelligence</div>

          <div style={styles.legendList}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#16a34a" }} />
              Available
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#2563eb" }} />
              Booked
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#dc2626" }} />
              Blocked
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#8b5cf6" }} />
              Selected range
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#94a3b8" }} />
              Past or inactive
            </div>
          </div>
        </div>

        <div style={styles.aiColumn}>
          <div style={styles.aiHeader}>
            <div>
              <div style={styles.sectionTitle}>AI Revenue Summary</div>
              <div style={styles.sectionSubtitle}>
                Pin&Go pricing activity for {format(month, "MMMM yyyy")}
              </div>
            </div>

            <div style={styles.liveBadge}>Live</div>
          </div>

          <div style={styles.aiMetricsRow}>
            <div style={styles.aiMetricCard}>
              <div style={styles.aiIconUp}>↑</div>
              <div>
                <div style={styles.aiMetricValue}>
                  {revenueSummary.weekendBoosts}
                </div>
                <div style={styles.aiMetricLabel}>Weekend Boosts</div>
              </div>
            </div>

            <div style={styles.aiMetricCard}>
              <div style={styles.aiIconDown}>↓</div>
              <div>
                <div style={styles.aiMetricValue}>
                  {revenueSummary.lastMinuteDiscounts}
                </div>
                <div style={styles.aiMetricLabel}>Last Minute</div>
              </div>
            </div>

            <div style={styles.aiMetricCard}>
              <div style={styles.aiIconUpWarm}>↑</div>
              <div>
                <div style={styles.aiMetricValue}>
                  {revenueSummary.highDemandAdjustments}
                </div>
                <div style={styles.aiMetricLabel}>High Demand</div>
              </div>
            </div>

            <div style={styles.aiMetricCard}>
              <div style={styles.aiIconDownBlue}>↓</div>
              <div>
                <div style={styles.aiMetricValue}>
                  {revenueSummary.lowDemandAdjustments}
                </div>
                <div style={styles.aiMetricLabel}>Low Demand</div>
              </div>
            </div>
          </div>

          <div style={styles.aiFooter}>
            🦾 Pin&Go is monitoring demand and applying pricing rules automatically.
          </div>
        </div>

        <div style={styles.guardrailsColumn}>
          <div style={styles.sectionTitle}>Pricing Guardrails</div>

          <div style={styles.guardrailsBox}>
            <div>
              <div style={styles.guardrailLabel}>Base</div>
              <div style={styles.guardrailValue}>${baseNightlyRate.toFixed(0)}</div>
            </div>

            <div>
              <div style={styles.guardrailLabel}>Min</div>
              <div style={styles.guardrailValue}>
                ${minimumNightlyRate.toFixed(0)}
              </div>
            </div>

            <div>
              <div style={styles.guardrailLabel}>Max</div>
              <div style={styles.guardrailValue}>
                ${maximumNightlyRate.toFixed(0)}
              </div>
            </div>
          </div>

          <div style={styles.guardrailsActive}>● Guardrails are active</div>
        </div>
      </div>

      <div style={styles.calendarToolbar}>
        <button
          type="button"
          style={styles.todayButton}
          onClick={() => setMonth(startOfMonth(new Date()))}
        >
          Today
        </button>

        <button
          type="button"
          style={styles.iconButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
        >
          ‹
        </button>

        <button
          type="button"
          style={styles.iconButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
        >
          ›
        </button>

        <div style={styles.monthTitle}>{format(month, "MMMM yyyy")}⌄</div>

        <div style={styles.viewButtons}>
          <button type="button" style={styles.viewButtonActive}>
            Month
          </button>
               </div>
              </div>
      <div style={styles.calendarGrid}>
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((weekday) => (
          <div key={weekday} style={styles.weekday}>
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
              style={{
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
              <div style={styles.dayTopRow}>
                <div style={styles.dayNumber}>{format(day, "d")}</div>
                <span
                  style={{
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
                style={{
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
                style={{
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
                <div style={styles.dayMeta}>
                  {reservation.guestName || "Guest"}
                </div>
              ) : blockedDate ? (
                <div style={styles.dayMeta}>
                  {blockedDate.reason || "Owner Stay"}
                </div>
              ) : (
                <div
                  style={{
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
                <div style={styles.dayMetaMuted}>
                  {reservation.source ||
                    reservation.externalProvider ||
                    "Direct Booking"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasSelectedRange && (
        <div style={styles.rangeActionPanel}>
          <div>
            <div style={styles.rangeActionTitle}>Range selected</div>
            <div style={styles.rangeActionSubtitle}>{selectedRangeLabel}</div>
          </div>

          <div style={styles.rangeActionButtons}>
            <button
              type="button"
              style={styles.primaryActionButton}
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
              style={styles.actionButton}
            >
              {savingBlock ? "Blocking..." : "Block Dates"}
            </button>

            <button
              type="button"
              onClick={handleUnblockDates}
              disabled={savingUnblock}
              style={styles.secondaryActionButton}
            >
              {savingUnblock ? "Unblocking..." : "Unblock Dates"}
            </button>

            <button
              type="button"
              style={styles.secondaryActionButton}
              onClick={() => setShowSetRateForm((value) => !value)}
            >
              Manual Rate
            </button>

            <button
              type="button"
              style={styles.clearButton}
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
            <div style={styles.inlineActionForm}>
              <div style={styles.inlineActionLabel}>
                Manual nightly rate override
              </div>

              <input
                type="number"
                min="0"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="199.00"
                style={styles.inlineActionInput}
              />

              <button
                type="button"
                onClick={handleApplyRate}
                disabled={savingRate}
                style={styles.actionButton}
              >
                {savingRate ? "Applying..." : "Apply Manual Rate"}
              </button>
            </div>
          )}

          {showCreateReservationForm && (
            <div style={styles.inlineActionForm}>
              <div style={styles.inlineActionLabel}>Create manual reservation</div>

              <input
                type="text"
                value={manualGuestName}
                onChange={(e) => setManualGuestName(e.target.value)}
                placeholder="Guest name"
                style={styles.inlineActionInput}
              />

              <input
                type="email"
                value={manualGuestEmail}
                onChange={(e) => setManualGuestEmail(e.target.value)}
                placeholder="Guest email"
                style={styles.inlineActionInput}
              />

              <input
                type="tel"
                value={manualGuestPhone}
                onChange={(e) => setManualGuestPhone(e.target.value)}
                placeholder="Guest phone"
                style={styles.inlineActionInput}
              />

              <select
                value={manualPaymentState}
                onChange={(e) => setManualPaymentState(e.target.value)}
                style={styles.inlineActionInput}
              >
                <option value="NONE">Payment pending</option>
                <option value="PAID">Paid manually</option>
                <option value="PENDING">Pending</option>
              </select>

              <button
                type="button"
                onClick={handleCreateManualReservation}
                disabled={savingManualReservation}
                style={styles.primaryActionButton}
              >
                {savingManualReservation ? "Creating..." : "Create Reservation"}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedDay && (
        <div style={styles.selectedDayPanel}>
          <h3 style={styles.selectedDayTitle}>
            {format(selectedDay, "MMMM d, yyyy")}
          </h3>

          <div style={styles.detailLine}>
            Status: {getStatusForDay(selectedDay)}
          </div>

          <div style={styles.detailLine}>
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

          {getReservationForDay(selectedDay) && (
            <>
              <div style={styles.detailLine}>
                Guest: {getReservationForDay(selectedDay)?.guestName || "Guest"}
              </div>

              <button
                type="button"
                style={styles.primaryActionButton}
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
    gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
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