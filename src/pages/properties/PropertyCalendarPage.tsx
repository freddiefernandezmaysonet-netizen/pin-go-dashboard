import { useEffect, useMemo, useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns";
import { Link, useParams } from "react-router-dom";
//import { getPropertyNightlyRates } from "../../api/endpoints";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

export function PropertyCalendarPage() {
  
 
  const { id } = useParams();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const calendarDays = eachDayOfInterval({
  start: startOfWeek(startOfMonth(month)),
  end: endOfWeek(endOfMonth(month)),
});
  const [nightlyRates, setNightlyRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const from = useMemo(() => format(startOfMonth(month), "yyyy-MM-dd"), [month]);

  const to = useMemo(
    () => format(startOfMonth(addMonths(month, 1)), "yyyy-MM-dd"),
    [month]
  );

  useEffect(() => {
  if (!id) return;

  let active = true;

  async function loadRates() {
    try {
      setLoadingRates(true);

     const res = await fetch(
  `${API_BASE}/api/dashboard/properties/${id}/nightly-rates?from=${from}&to=${to}`,
  {
    credentials: "include",
  }
);

const data = await res.json();

if (!res.ok || !data.ok) {
  throw new Error(data.error || "Failed to load nightly rates");
}
      if (!active) return;

      setNightlyRates(Array.isArray(data.rates) ? data.rates : []);
    } catch (e) {
      if (active) {
        setNightlyRates([]);
      }
    } finally {
      if (active) {
        setLoadingRates(false);
      }
    }
  }

  loadRates();

  return () => {
    active = false;
  };
}, [id, from, to]);

const rateCount = nightlyRates.length;
const rateByDate = new Map(
  nightlyRates.map((item) => [item.date, item])
);

function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}
   return (
    <div style={{ padding: 24 }}>
      <h1>Property Calendar</h1>
<p>
  {loadingRates
    ? "Loading nightly rates..."
    : `${rateCount} custom nightly rate(s) loaded for this month.`}
</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 24 }}>
        <button onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}>
          ← Previous
        </button>

        <strong>{format(month, "MMMM yyyy")}</strong>

        <button onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}>
          Next →
        </button>
      </div>

     <div style={styles.calendarGrid}>
  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
    <div key={day} style={styles.weekday}>
      {day}
    </div>
  ))}

  {calendarDays.map((day) => (
    <div
      key={day.toISOString()}
      style={{
        ...styles.dayCard,
        opacity: isSameMonth(day, month) ? 1 : 0.35,
      }}
    >
      <div style={styles.dayNumber}>{format(day, "d")}</div>
      <div style={styles.dayRate}>
  {rateByDate.get(getDateKey(day))
    ? `$${Number(rateByDate.get(getDateKey(day))?.rate ?? 0).toFixed(0)}`
    : "Base"}
</div>
      <div style={styles.availablePill}>Available</div>
    </div>
  ))}
</div>
      <Link to={`/properties/${id}/edit`}>Back to property</Link>
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
};