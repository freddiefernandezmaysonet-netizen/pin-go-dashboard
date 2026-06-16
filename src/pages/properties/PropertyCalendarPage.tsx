import { useEffect, useMemo, useState } from "react";
import {
  format,
  addMonths,
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

          return (
            <div
              key={day.toISOString()}
              onClick={() => setSelectedDay(day)}
              style={{
                ...styles.dayCard,
                opacity: isSameMonth(day, month) ? 1 : 0.35,
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

      <Link to={`/properties/${id}/edit`} style={styles.backLink}>
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
    <h3 style={{ marginTop: 0 }}>
      {format(selectedDay, "MMMM d, yyyy")}
    </h3>

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
};