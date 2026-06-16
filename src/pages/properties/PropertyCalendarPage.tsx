import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, addMonths, startOfMonth } from "date-fns";
import { Link, useParams } from "react-router-dom";
//import { getPropertyNightlyRates } from "../../api/endpoints";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

export function PropertyCalendarPage() {
  
 
  const { id } = useParams();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
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

      <div style={{ marginTop: 24 }}>
        <DayPicker
          month={month}
          onMonthChange={(nextMonth) => setMonth(startOfMonth(nextMonth))}
        />
      </div>

      <Link to={`/properties/${id}/edit`}>Back to property</Link>
    </div>
  );
}