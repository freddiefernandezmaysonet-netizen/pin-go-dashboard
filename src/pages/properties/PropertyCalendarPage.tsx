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
  }>({
    start: null,
    end: null,
  });

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
    if (startOfDay(day) < today) {
      return;
    }

    setSelectedDay(day);

    setSelectedRange((current) => {
      if (!current.start || current.end) {
        return {
          start: day,
          end: null,
        };
      }

      if (day < current.start) {
        return {
          start: day,
          end: current.start,
        };
      }

      return {
        start: current.start,
        end: day,
      };
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

  function getRateReasonForDay(day: Date, rate: any) {
    const reason = rate?.reason;

    if (reason === "LEAD_TIME_RULE") return "↓ Last Minute";
    if (reason === "OCCUPANCY_LOW_RULE") return "↓ Low Demand";
    if (reason === "OCCUPANCY_HIGH_RULE") return "↑ High Demand";
    if (reason === "CUSTOM_RATE") return "Manual Override";
    if (reason === "Calendar override") return "Manual Override";
    if (reason === "WEEKEND_RULE") return "↑ Weekend Boost";

    if (
      dynamicPricingEnabled &&
      weekendMarkupPercent > 0 &&
      isWeekendNight(day)
    ) {
      return "↑ Weekend Boost";
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

      if (reason === "↑ Weekend Boost") weekendBoosts += 1;
      if (reason === "↓ Last Minute") lastMinuteDiscounts += 1;
      if (reason === "↑ High Demand") highDemandAdjustments += 1;
      if (reason === "↓ Low Demand") lowDemandAdjustments += 1;
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
          headers: {
            "Content-Type": "application/json",
          },
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
          headers: {
            "Content-Type": "application/json",
          },
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

      setSelectedRange({
        start: null,
        end: null,
      });

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

      setSelectedRange({
        start: null,
        end: null,
      });

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
          headers: {
            "Content-Type": "application/json",
          },
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

      setSelectedRange({
        start: null,
        end: null,
      });
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
          <div style={styles.eyebrow}>Autonomous Revenue Calendar</div>
          <h1 style={styles.title}>Property Calendar</h1>
          <p style={styles.subtitle}>
            {loading
              ? "Loading calendar intelligence..."
              : `${nightlyRates.length} rate signal(s), ${reservations.length} reservation(s), and ${blockedDates.length} blocked date(s) loaded.`}
          </p>
        </div>

        <div style={styles.autoPilotPill}>
          <span style={styles.autoPilotIcon}>🦾</span>
          Auto Pilot Active
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Occupancy</div>
          <div style={styles.summaryValue}>
            {occupancySummary.occupancyPercent}%
          </div>
          <div style={styles.summaryHint}>
            {occupancySummary.bookedDays} booked ·{" "}
            {occupancySummary.availableDays} available
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Revenue Optimizations</div>
          <div style={styles.summaryValue}>
            {revenueSummary.totalOptimizations}
          </div>
          <div style={styles.summaryHint}>
            Pricing engine actions this month
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Blocked Dates</div>
          <div style={styles.summaryValue}>{occupancySummary.blockedDays}</div>
          <div style={styles.summaryHint}>Owner stays or maintenance</div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Manual Overrides</div>
          <div style={styles.summaryValue}>{revenueSummary.manualOverrides}</div>
          <div style={styles.summaryHint}>Human pricing adjustments</div>
        </div>
      </div>

      <div style={styles.intelligenceRow}>
        <div style={styles.aiSummaryCard}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>AI Revenue Summary</div>
              <div style={styles.cardSubtitle}>
                Pin&Go pricing activity for {format(month, "MMMM yyyy")}
              </div>
            </div>
            <div style={styles.aiBadge}>Live</div>
          </div>

          <div style={styles.aiMetricGrid}>
            <div style={styles.aiMetric}>
              <span style={styles.metricSignal}>↑</span>
              <div>
                <strong>{revenueSummary.weekendBoosts}</strong>
                <span> Weekend Boosts</span>
              </div>
            </div>

            <div style={styles.aiMetric}>
              <span style={styles.metricSignal}>↓</span>
              <div>
                <strong>{revenueSummary.lastMinuteDiscounts}</strong>
                <span> Last Minute Discounts</span>
              </div>
            </div>

            <div style={styles.aiMetric}>
              <span style={styles.metricSignal}>↑</span>
              <div>
                <strong>{revenueSummary.highDemandAdjustments}</strong>
                <span> High Demand Adjustments</span>
              </div>
            </div>

            <div style={styles.aiMetric}>
              <span style={styles.metricSignal}>↓</span>
              <div>
                <strong>{revenueSummary.lowDemandAdjustments}</strong>
                <span> Low Demand Adjustments</span>
              </div>
            </div>
          </div>

          <div style={styles.aiFooter}>
            🦾 Pin&Go is monitoring demand and applying pricing rules
            automatically.
          </div>
        </div>

        <div style={styles.guardrailsCard}>
          <div style={styles.cardTitle}>Pricing Guardrails</div>
          <div style={styles.guardrailGrid}>
            <div>
              <div style={styles.guardrailLabel}>Base</div>
              <div style={styles.guardrailValue}>
                ${baseNightlyRate.toFixed(0)}
              </div>
            </div>

            <div>
              <div style={styles.guardrailLabel}>Minimum</div>
              <div style={styles.guardrailValue}>
                ${minimumNightlyRate.toFixed(0)}
              </div>
            </div>

            <div>
              <div style={styles.guardrailLabel}>Maximum</div>
              <div style={styles.guardrailValue}>
                ${maximumNightlyRate.toFixed(0)}
              </div>
            </div>
          </div>

          <div style={styles.guardrailHint}>
            Dynamic pricing stays within these limits.
          </div>
        </div>
      </div>

      <div style={styles.calendarToolbar}>
        <button
          type="button"
          style={styles.navButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
        >
          ← Previous
        </button>

        <strong style={styles.monthTitle}>{format(month, "MMMM yyyy")}</strong>

        <button
          type="button"
          style={styles.navButton}
          onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
        >
          Next →
        </button>
      </div>

      <div style={styles.legendCard}>
  <div style={styles.legendTitle}>
    Calendar Intelligence
  </div>

  <div style={styles.legendGrid}>
    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          background: "#16a34a",
        }}
      />
      Available — Ready to book
    </div>

    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          background: "#2563eb",
        }}
      />
      Booked — Reservation active
    </div>

    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          background: "#dc2626",
        }}
      />
      Blocked — Owner stay or maintenance
    </div>

    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          background: "#0f172a",
        }}
      />
      Selected range
    </div>

    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          background: "#cbd5e1",
        }}
      />
      Past or inactive dates
    </div>
  </div>
</div>

      <div style={styles.calendarGrid}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
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
                opacity: !isSameMonth(day, month) || isPastDay ? 0.35 : 1,
                borderColor: isDayInSelectedRange(day)
                  ? "#2563eb"
                  : status === "Booked"
                  ? "#bfdbfe"
                  : status === "Blocked"
                  ? "#fecaca"
                  : "#e2e8f0",
                background: isDayInSelectedRange(day) ? "#eff6ff" : "#ffffff",
                cursor: isPastDay ? "not-allowed" : "pointer",
              }}
            >
              <div style={styles.dayTopRow}>
                <div style={styles.dayNumber}>{format(day, "d")}</div>
                <div
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

              <div style={styles.dayRate}>
                {displayRate !== null ? `$${displayRate.toFixed(0)}` : "—"}
              </div>

              <div
                style={{
                  ...styles.statusPill,
                  ...(status === "Booked"
                    ? styles.bookedPill
                    : status === "Blocked"
                    ? styles.blockedPill
                    : styles.availablePill),
                }}
              >
                {status}
              </div>

              <div style={styles.rateReason}>{rateReason}</div>

              {reservation ? (
                <>
                  <div style={styles.guestText}>
                    {reservation.guestName || "Guest"}
                  </div>

                  <div style={styles.sourceText}>
                    {reservation.source ||
                      reservation.externalProvider ||
                      "Direct"}
                  </div>
                </>
              ) : blockedDate ? (
                blockedDate.reason ? (
                  <div style={styles.sourceText}>{blockedDate.reason}</div>
                ) : null
              ) : (
                <div style={styles.sourceText}>Ready to book</div>
              )}
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
              style={{
                ...styles.actionButton,
                opacity: savingBlock ? 0.7 : 1,
                cursor: savingBlock ? "not-allowed" : "pointer",
              }}
            >
              {savingBlock ? "Blocking..." : "Block Dates"}
            </button>

            <button
              type="button"
              onClick={handleUnblockDates}
              disabled={savingUnblock}
              style={{
                ...styles.secondaryActionButton,
                opacity: savingUnblock ? 0.7 : 1,
                cursor: savingUnblock ? "not-allowed" : "pointer",
              }}
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
                setSelectedRange({
                  start: null,
                  end: null,
                });
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
                style={{
                  ...styles.actionButton,
                  opacity: savingRate ? 0.7 : 1,
                  cursor: savingRate ? "not-allowed" : "pointer",
                }}
              >
                {savingRate ? "Applying..." : "Apply Manual Rate"}
              </button>
            </div>
          )}

          {showCreateReservationForm && (
            <div style={styles.inlineActionForm}>
              <div style={styles.inlineActionLabel}>
                Create manual reservation
              </div>

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
                style={{
                  ...styles.primaryActionButton,
                  opacity: savingManualReservation ? 0.7 : 1,
                  cursor: savingManualReservation ? "not-allowed" : "pointer",
                }}
              >
                {savingManualReservation ? "Creating..." : "Create Reservation"}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedDay && (
        <div style={styles.selectedDayPanel}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.selectedDayTitle}>
                {format(selectedDay, "MMMM d, yyyy")}
              </h3>
              <div style={styles.cardSubtitle}>
                {getRateReasonForDay(
                  selectedDay,
                  rateByDate.get(getDateKey(selectedDay))
                )}
              </div>
            </div>

            <div style={styles.autoPilotPillSmall}>🦾 Auto Pilot</div>
          </div>

          <div style={styles.selectedDayGrid}>
            <div>
              <div style={styles.guardrailLabel}>Nightly Rate</div>
              <div style={styles.guardrailValue}>
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
            </div>

            <div>
              <div style={styles.guardrailLabel}>Status</div>
              <div style={styles.guardrailValue}>
                {getStatusForDay(selectedDay)}
              </div>
            </div>
          </div>

          {getReservationForDay(selectedDay) && (
            <>
              <div style={styles.detailLine}>
                Guest: {getReservationForDay(selectedDay)?.guestName || "Guest"}
              </div>

              <div style={styles.detailLine}>
                Source:{" "}
                {getReservationForDay(selectedDay)?.source ||
                  getReservationForDay(selectedDay)?.externalProvider ||
                  "Direct"}
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

          {getBlockedDateForDay(selectedDay)?.reason && (
            <div style={styles.detailLine}>
              Reason: {getBlockedDateForDay(selectedDay)?.reason}
            </div>
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
    padding: 24,
    background:
      "linear-gradient(180deg, #f8fafc 0%, #ffffff 42%, #f8fafc 100%)",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 950,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  title: {
    margin: "6px 0 0",
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "#020617",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
  },
  autoPilotPill: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 14px 30px rgba(15,23,42,0.18)",
  },
  autoPilotIcon: {
    fontSize: 18,
  },
  summaryGrid: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: 14,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: 950,
    color: "#020617",
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
  },
  intelligenceRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1.45fr) minmax(260px, 0.8fr)",
    gap: 14,
    alignItems: "stretch",
  },
  aiSummaryCard: {
    padding: 20,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #ffffff 48%, #ecfeff 100%)",
    border: "1px solid #bfdbfe",
    boxShadow: "0 18px 40px rgba(37,99,235,0.08)",
  },
  guardrailsCard: {
    padding: 20,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 950,
    color: "#0f172a",
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
  },
  aiBadge: {
    borderRadius: 999,
    padding: "5px 10px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: 950,
  },
  aiMetricGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
    gap: 10,
  },
  aiMetric: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid #dbeafe",
    display: "flex",
    gap: 10,
    alignItems: "center",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 800,
  },
  metricSignal: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#2563eb",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: 15,
    fontWeight: 950,
  },
  aiFooter: {
    marginTop: 14,
    fontSize: 12,
    color: "#1e3a8a",
    fontWeight: 850,
  },
  guardrailGrid: {
    marginTop: 14,
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
  },
  guardrailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 850,
  },
  guardrailValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 950,
    color: "#020617",
  },
  guardrailHint: {
    marginTop: 14,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 750,
  },
  calendarToolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  navButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
  },
  monthTitle: {
    minWidth: 180,
    textAlign: "center",
    fontSize: 18,
    fontWeight: 950,
    color: "#020617",
  },
  calendarGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
    gap: 10,
  },
  weekday: {
    fontSize: 12,
    fontWeight: 950,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0 8px",
  },
  dayCard: {
    minHeight: 138,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 7,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    cursor: "pointer",
    transition: "border-color 160ms ease, transform 160ms ease",
  },
  dayTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dayRate: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
    color: "#2563eb",
    letterSpacing: "-0.04em",
  },
  statusPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 950,
  },
  availablePill: {
    background: "#dcfce7",
    color: "#166534",
  },
  bookedPill: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  blockedPill: {
    background: "#fee2e2",
    color: "#b91c1c",
  },
  rateReason: {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
  },
  guestText: {
    fontSize: 12,
    fontWeight: 950,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sourceText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rangeActionPanel: {
    marginTop: 20,
    padding: 18,
    borderRadius: 22,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 18px 40px rgba(37,99,235,0.08)",
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
    borderRadius: 13,
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
    borderRadius: 13,
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
    borderRadius: 13,
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
    borderRadius: 13,
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
    borderRadius: 13,
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
    borderRadius: 22,
    background: "#ffffff",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
  },
  selectedDayTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#020617",
  },
  selectedDayGrid: {
    marginTop: 16,
    display: "flex",
    gap: 28,
    flexWrap: "wrap",
  },
  autoPilotPillSmall: {
    borderRadius: 999,
    padding: "6px 10px",
    background: "#f1f5f9",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
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
legendCard: {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
},

legendTitle: {
  fontSize: 13,
  fontWeight: 950,
  color: "#0f172a",
  marginBottom: 12,
},

legendGrid: {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
},

legendItem: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
},

legendDot: {
  width: 10,
  height: 10,
  borderRadius: 999,
  flexShrink: 0,
},

};