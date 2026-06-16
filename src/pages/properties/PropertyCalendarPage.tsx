import { useEffect, useMemo, useState } from "react";
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
import { Link, useParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

export function PropertyCalendarPage() {
  const { id } = useParams();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [nightlyRates, setNightlyRates] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

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

    const startDate = getDateKey(selectedRange.start);
    const endDate = getDateKey(selectedRange.end ?? selectedRange.start);

    try {
      setSavingRate(true);

      const res = await fetch(
        `${API_BASE}/api/dashboard/properties/${id}/nightly-rates`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate,
            endDate,
            rate,
            reason: "Calendar override",
          }),
        }
      );

      const data = await res.json();

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

  return (
    <div style={{ padding: 24 }}>
      <h1>Property Calendar</h1>

      <p>
        {loading
          ? "Loading calendar..."
          : `${nightlyRates.length} custom rate(s), ${reservations.length} reservation(s), and ${blockedDates.length} blocked date(s) loaded.`}
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 24,
        }}
      >
        <button onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}>
          ← Previous
        </button>

        <strong>{format(month, "MMMM yyyy")}</strong>

        <button onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}>
          Next →
        </button>
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
         
          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
             style={{
  ...styles.dayCard,
  opacity: !isSameMonth(day, month) || isPastDay ? 0.35 : 1,
  borderColor: isDayInSelectedRange(day) ? "#2563eb" : "#e2e8f0",
  background: isDayInSelectedRange(day) ? "#eff6ff" : "#ffffff",
  cursor: isPastDay ? "not-allowed" : "pointer",
}}
            >
              <div style={styles.dayNumber}>{format(day, "d")}</div>

              <div style={styles.dayRate}>
                {rate ? `$${Number(rate.rate ?? 0).toFixed(0)}` : "Base"}
              </div>

              {reservation ? (
                <>
                  <div style={styles.bookedPill}>Booked</div>

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
                <>
                  <div style={styles.blockedPill}>Blocked</div>

                  {blockedDate.reason ? (
                    <div style={styles.sourceText}>{blockedDate.reason}</div>
                  ) : null}
                </>
              ) : (
                <div style={styles.availablePill}>Available</div>
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
              style={styles.actionButton}
              onClick={() => setShowSetRateForm((value) => !value)}
            >
              Set Rate
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
              onClick={() => {
                setSelectedRange({
                  start: null,
                  end: null,
                });
                setShowSetRateForm(false);
                setRateInput("");
              }}
            >
              Clear
            </button>
          </div>

          {showSetRateForm && (
            <div style={styles.inlineActionForm}>
              <div style={styles.inlineActionLabel}>Nightly rate</div>

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
                {savingRate ? "Applying..." : "Apply Rate"}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedDay && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
          }}
        >
          <h3 style={{ marginTop: 0 }}>{format(selectedDay, "MMMM d, yyyy")}</h3>

          <div>
            Rate:{" "}
            {rateByDate.get(getDateKey(selectedDay))
              ? `$${rateByDate.get(getDateKey(selectedDay))?.rate}`
              : "Base"}
          </div>

          <div style={{ marginTop: 8 }}>
            Status:{" "}
            {getReservationForDay(selectedDay)
              ? "Booked"
              : getBlockedDateForDay(selectedDay)
              ? "Blocked"
              : "Available"}
          </div>

          {getReservationForDay(selectedDay) && (
            <>
              <div style={{ marginTop: 8 }}>
                Guest: {getReservationForDay(selectedDay)?.guestName}
              </div>

              <div>
                Source:{" "}
                {getReservationForDay(selectedDay)?.source ||
                  getReservationForDay(selectedDay)?.externalProvider ||
                  "Direct"}
              </div>
            </>
          )}

          {getBlockedDateForDay(selectedDay)?.reason && (
            <div style={{ marginTop: 8 }}>
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

const styles: Record<string, React.CSSProperties> = {
  calendarGrid: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
    gap: 10,
  },
  weekday: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0 8px",
  },
  dayCard: {
    minHeight: 118,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 8,
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    cursor: "pointer",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
  },
  dayRate: {
    fontSize: 18,
    fontWeight: 950,
    color: "#2563eb",
  },
  availablePill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 9px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: 900,
  },
  bookedPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 9px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
  },
  blockedPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 9px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: 900,
  },
  guestText: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sourceText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  backLink: {
    display: "inline-block",
    marginTop: 18,
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
    fontWeight: 800,
    color: "#2563eb",
  },
  rangeActionButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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
    fontWeight: 900,
    color: "#1e3a8a",
  },
  inlineActionInput: {
    height: 40,
    width: 160,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
  },
};