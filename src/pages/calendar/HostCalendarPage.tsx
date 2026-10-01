import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  dateKeys,
  layoutStays,
  localToday,
  shiftDate,
  validDate,
  type CalendarSnapshot,
} from "../../calendar/model";
import "./HostCalendar.css";
const API =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";
const label = (key: string) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function HostCalendarPage({ mission = false }: { mission?: boolean }) {
  const [params, setParams] = useSearchParams();
  const propertyId = params.get("propertyId") || "";
  const from = validDate(params.get("from"))
    ? params.get("from")!
    : localToday();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(params.get("page")) || 1)),
  );
  const days = useMemo(() => dateKeys(from), [from]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: CalendarSnapshot;
  } | null>(null);
  const [propertiesError, setPropertiesError] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<{
    propertyId: string;
    name: string;
    from: string;
    to: string;
  } | null>(null);
  const key = `${propertyId}:${from}:${page}:${version}`;
  const data = snapshot?.key === key ? snapshot.value : null;
  useEffect(() => {
    const abort = new AbortController();
    setPropertiesError("");
    fetch(`${API}/api/dashboard/properties`, {
      credentials: "include",
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setProperties(d.items || []))
      .catch(() => {
        if (!abort.signal.aborted)
          setPropertiesError(
            "Could not load properties.",
          );
      });
    return () => abort.abort();
  }, [version]);
  useEffect(() => {
    if (mission) return;
    const abort = new AbortController();
    const query = new URLSearchParams({
      from,
      to: shiftDate(from, 14),
      page: String(page),
    });
    if (propertyId) query.set("propertyId", propertyId);
    setError("");
    setSelection(null);
    fetch(`${API}/api/dashboard/calendar?${query}`, {
      credentials: "include",
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<CalendarSnapshot>;
      })
      .then((value) => setSnapshot({ key, value }))
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Calendar unavailable. Try refreshing.",
          );
      });
    return () => abort.abort();
  }, [key, from, page, propertyId, mission]);
  function change(next: Record<string, string>) {
    const updated = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) updated.set(k, v);
      else updated.delete(k);
    }
    setParams(updated);
    setSelection(null);
  }
  function select(id: string, name: string, date: string) {
    setSelection((current) =>
      current?.propertyId === id && current.from === current.to
        ? {
            ...current,
            from: date < current.from ? date : current.from,
            to: date > current.to ? date : current.to,
          }
        : { propertyId: id, name, from: date, to: date },
    );
  }
  return (
    <section className="host-calendar">
      <header className="hc-heading">
        <div>
          <span className="hc-eyebrow">PIN&GO · HOST</span>
          <h1>{mission ? "Mission Control" : "Calendar"}</h1>
          <p>
            {mission
              ? "Select a property to view its alerts and actions."
              : "Availability, reservations and nightly rates by property."}
          </p>
        </div>
        <button onClick={() => setVersion((v) => v + 1)}>Refresh</button>
      </header>
      <div className="hc-controls">
        {!mission && (
          <div className="hc-segment" aria-label="Calendar view">
            <button
              aria-pressed={!propertyId}
              onClick={() => change({ propertyId: "", page: "1" })}
            >
              Multi
            </button>
            <button
              aria-pressed={!!propertyId}
              disabled={!properties.length}
              onClick={() =>
                change({
                  propertyId: propertyId || properties[0].id,
                  page: "1",
                })
              }
            >
              Single
            </button>
          </div>
        )}
        <label>
          Property
          <select
            aria-label="Property"
            value={propertyId}
            onChange={(e) => change({ propertyId: e.target.value, page: "1" })}
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!mission && (
          <>
            <label>
              From
              <input
                aria-label="From date"
                type="date"
                value={from}
                onChange={(e) => {
                  if (validDate(e.target.value))
                    change({ from: e.target.value, page: "1" });
                }}
              />
            </label>
            <div className="hc-nav">
              <button
                aria-label="Previous 14 days"
                onClick={() => change({ from: shiftDate(from, -14) })}
              >
                ‹
              </button>
              <button onClick={() => change({ from: localToday() })}>
                Today
              </button>
              <button
                aria-label="Next 14 days"
                onClick={() => change({ from: shiftDate(from, 14) })}
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>
      {(error || propertiesError) && (
        <p role="alert" className="hc-error">
          {error || propertiesError}
        </p>
      )}
      {mission ? (
        <div className="hc-property-list">
          {properties
            .filter((p) => !propertyId || p.id === propertyId)
            .map((p) => (
              <Link key={p.id} to={`/properties/${p.id}/mission-control`}>
                {p.name} <span>Mission Control →</span>
              </Link>
            ))}
        </div>
      ) : (
        <>
          <p className="hc-hint">
            Swipe dates ↔ · Tap two nights to select a range.
          </p>
          {!data && !error && (
            <p role="status">Loading calendar…</p>
          )}
          {data && data.items.length === 0 && (
            <p>
              No properties in this view.
            </p>
          )}
          {data && data.items.length > 0 && (
            <div
              className="hc-scroll"
              tabIndex={0}
              role="region"
              aria-label="Property calendar, scroll horizontally"
            >
              <table style={{ width: 128 + days.length * 88 }}>
                <caption className="hc-sr">
                  {label(from)} – {label(shiftDate(from, 13))}. Nightly rates in USD.
                </caption>
                <colgroup>
                  <col style={{ width: 128 }} />
                  {days.map((d) => (
                    <col key={d} style={{ width: 88 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="hc-sticky">Properties</th>
                    {days.map((d) => (
                      <th key={d} scope="col">
                        <span>
                          {new Date(d + "T12:00:00Z").toLocaleDateString(
                            "en-US",
                            { weekday: "short", timeZone: "UTC" },
                          )}
                        </span>
                        <strong>{label(d)}</strong>
                      </th>
                    ))}
                  </tr>
                </thead>
                {data.items.map((property) => {
                  const stays = layoutStays(
                    property.reservations,
                    from,
                    days.length,
                  );
                  const lanes = Math.max(1, ...stays.map((s) => s.lane + 1));
                  return (
                    <tbody key={property.id}>
                      <tr>
                        <th
                          rowSpan={2}
                          scope="rowgroup"
                          className="hc-sticky hc-property"
                        >
                          {property.photoUrl ? (
                            <img
                              src={property.photoUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <div className="hc-placeholder" aria-hidden="true">
                              ⌂
                            </div>
                          )}
                          <Link to={`/properties/${property.id}`}>
                            {property.name}
                          </Link>
                          <small>{property.timezone}</small>
                        </th>
                        <td colSpan={days.length} className="hc-bookings">
                          <div
                            style={{
                              height: lanes * 48 + 8,
                              position: "relative",
                            }}
                          >
                            {property.state === "UNAVAILABLE" ? (
                              <span className="hc-unavailable">
                                Data unavailable
                              </span>
                            ) : (
                              stays.map((stay) => (
                                <Link
                                  key={stay.id}
                                  className="hc-stay"
                                  style={{
                                    left: stay.start * 88,
                                    width: (stay.end - stay.start) * 88 - 4,
                                    top: 4 + stay.lane * 48,
                                  }}
                                  to={`/reservations/${stay.id}`}
                                  title={`${stay.guestName || "Guest"} · ${stay.number || ""} · ${stay.from} → ${stay.to}`}
                                >
                                  {stay.guestName || "Guest"} · {stay.number}
                                </Link>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        {days.map((date) => {
                          const day = property.days.find(
                            (d) => d.date === date,
                          );
                          const chosen =
                            selection?.propertyId === property.id &&
                            selection.from <= date &&
                            date <= selection.to;
                          return (
                            <td
                              key={date}
                              className={`hc-day ${day?.status?.toLowerCase() || "unknown"} ${chosen ? "selected" : ""} ${property.today === date ? "today" : ""}`}
                            >
                              <button
                                disabled={!day}
                                aria-pressed={chosen}
                                aria-label={`${property.name}, ${date}, ${day?.status || "unknown"}, ${day?.rate == null ? "price unavailable" : `${day.rate} USD`}, minimum ${day?.minimumNights ?? "unknown"} nights`}
                                onClick={() =>
                                  select(property.id, property.name, date)
                                }
                              >
                                <small>
                                  {day?.status === "BOOKED"
                                    ? "Booked"
                                    : day?.status === "BLOCKED"
                                      ? "Blocked"
                                      : day
                                        ? "Available"
                                        : "—"}
                                </small>
                                <strong>
                                  {day?.rate == null
                                    ? "—"
                                    : new Intl.NumberFormat("en-US", {
                                        style: "currency",
                                        currency: "USD",
                                        maximumFractionDigits: 0,
                                      }).format(day.rate)}
                                </strong>
                                <span>
                                  {day
                                    ? `${day.minimumNights} night${day.minimumNights === 1 ? "" : "s"} min.`
                                    : "No data"}
                                </span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}
          {selection && (
            <aside className="hc-selection" aria-live="polite">
              <div>
                <strong>{selection.name}</strong>
                <p>
                  {label(selection.from)} – {label(selection.to)} · selected nights
                </p>
              </div>
              <Link
                className="hc-primary"
                to={`/calendar/property/${selection.propertyId}?from=${selection.from}&to=${selection.to}`}
              >
                Manage dates
              </Link>
              <Link to={`/properties/${selection.propertyId}/mission-control`}>
                Mission Control
              </Link>
              <button onClick={() => setSelection(null)}>Close</button>
            </aside>
          )}
          {data && (
            <footer className="hc-footer">
              <span>
                {data.total} properties · Page {data.page} · USD
              </span>
              <button
                disabled={page <= 1}
                onClick={() => change({ page: String(page - 1) })}
              >
                Previous
              </button>
              <button
                disabled={!data.hasMore}
                onClick={() => change({ page: String(page + 1) })}
              >
                More properties
              </button>
              <Link to="/mission-control">Mission Control →</Link>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
