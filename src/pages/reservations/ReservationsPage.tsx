import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVisibleReservationSourceLabel } from "../../lib/whiteLabel";

type ReservationStatus = "ACTIVE" | "CANCELLED";
type OperationalStatus = "UPCOMING" | "IN_HOUSE" | "CHECKED_OUT" | "CANCELLED";
type PaymentState = "NONE" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

type ReservationRow = {
  id: string;
  reservationNumber?: string | null;
  guestName: string;
  guestEmail?: string | null;
  roomName?: string | null;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  operationalStatus: OperationalStatus;
  paymentState: PaymentState;
  totalAmount?: number | null;
  source?: string | null;
  externalProvider?: string | null;
  property?: { id: string; name: string; timezone?: string } | null;
  propertyId?: string | null;
};

type ReservationsResp = {
  page: number;
  pageSize: number;
  total: number;
  items: ReservationRow[];
};

type PropertiesResp = { items: Array<{ id: string; name: string }> };

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${t || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function fmt(d: string, timezone?: string) {
  const dt = new Date(d);

  if (isNaN(dt.getTime())) return d;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(dt);
}

function fmtMoney(value?: number | null) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusStyles(status: OperationalStatus) {
  if (status === "IN_HOUSE") {
    return {
      background: "#ecfdf5",
      color: "#065f46",
      border: "1px solid #a7f3d0",
    };
  }
  if (status === "UPCOMING") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }
  if (status === "CHECKED_OUT") {
    return {
      background: "#f3f4f6",
      color: "#4b5563",
      border: "1px solid #e5e7eb",
    };
  }
  return {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  };
}

function paymentStyles(state: PaymentState) {
  if (state === "PAID") {
    return {
      background: "#ecfdf5",
      color: "#065f46",
      border: "1px solid #a7f3d0",
    };
  }

  if (state === "PARTIALLY_REFUNDED") {
    return {
      background: "#fffbeb",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (state === "NONE") {
    return {
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "1px solid #e5e7eb",
  };
}

function propertyLabel(r: ReservationRow) {
  return r.property?.name ?? r.propertyId ?? "—";
}

function operationalStatusLabel(status: OperationalStatus) {
  if (status === "IN_HOUSE") return "In house";
  if (status === "CHECKED_OUT") return "Checked out";
  if (status === "CANCELLED") return "Cancelled";
  return "Upcoming";
}

function paymentStateLabel(state: PaymentState) {
  if (state === "PAID") return "Paid";
  if (state === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (state === "REFUNDED") return "Refunded";
  return "Not paid";
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function inclusiveEndDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return value;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

const filterLabelStyle = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.01em",
} as const;

const filterControlStyle = {
  width: "100%",
  minHeight: 40,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
} as const;

export function ReservationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [properties, setProperties] = useState<PropertiesResp["items"]>([]);
  const propertyId = searchParams.get("propertyId") || "ALL";
  const operationalStatus = searchParams.get("operationalStatus") || "ALL";
  const paymentState = searchParams.get("paymentState") || "ALL";
  const source = searchParams.get("source") || "ALL";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const sort = searchParams.get("sort") || "checkIn_desc";
  const search = searchParams.get("search") || "";
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const requestedPageSize = parsePositiveInt(searchParams.get("pageSize"), 25);
  const pageSize = [10, 25, 50].includes(requestedPageSize)
    ? requestedPageSize
    : 25;
  const [searchInput, setSearchInput] = useState(search);

  const [data, setData] = useState<ReservationsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function updateFilters(
    changes: Record<string, string | null>,
    resetPage = true
  ) {
    const next = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === "ALL") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    if (resetPage) {
      next.delete("page");
    }

    setSearchParams(next, { replace: true });
  }

  function clearAllFilters() {
    const next = new URLSearchParams();

    if (pageSize !== 25) {
      next.set("pageSize", String(pageSize));
    }

    setSearchInput("");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    api<PropertiesResp>("/api/dashboard/properties")
      .then((r) => setProperties(r.items ?? []))
      .catch(() => setProperties([]));
  }, []);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedSearch = searchInput.trim().replace(/^#/, "");

      if (normalizedSearch !== search) {
        const next = new URLSearchParams(searchParams);

        if (normalizedSearch) {
          next.set("search", normalizedSearch);
        } else {
          next.delete("search");
        }

        next.delete("page");
        setSearchParams(next, { replace: true });
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search, searchInput, searchParams, setSearchParams]);

  const qs = useMemo(() => {
    const q = new URLSearchParams();

    q.set("page", String(page));
    q.set("pageSize", String(pageSize));
    q.set("sort", sort);

    if (propertyId !== "ALL") q.set("propertyId", propertyId);
    if (operationalStatus !== "ALL") {
      q.set("operationalStatus", operationalStatus);
    }
    if (paymentState !== "ALL") q.set("paymentState", paymentState);
    if (source !== "ALL") q.set("source", source);
    if (from) q.set("from", `${from}T00:00:00.000Z`);
    if (to) q.set("to", inclusiveEndDate(to));
    if (search) q.set("search", search);

    return q.toString();
  }, [
    from,
    operationalStatus,
    page,
    pageSize,
    paymentState,
    propertyId,
    search,
    sort,
    source,
    to,
  ]);

  useEffect(() => {
    setLoading(true);
    setErr(null);

    api<ReservationsResp>(`/api/dashboard/reservations?${qs}`)
      .then((r) => setData(r))
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [qs]);

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const activeFilterCount = [
    propertyId !== "ALL",
    operationalStatus !== "ALL",
    paymentState !== "ALL",
    source !== "ALL",
    Boolean(from),
    Boolean(to),
    Boolean(search),
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const resultStart = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const resultEnd = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          width: "100%",
          border: "1px solid #dbe3ee",
          borderRadius: 18,
          padding: 16,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#0f172a", fontSize: 17, fontWeight: 800 }}>
              Find reservations
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              Search and narrow the complete reservation history.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {hasActiveFilters ? (
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {activeFilterCount} active
              </span>
            ) : null}

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              style={{
                minHeight: 36,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: hasActiveFilters ? "#334155" : "#94a3b8",
                cursor: hasActiveFilters ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Search reservations</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Reservation #, guest, email, room or external ID"
              aria-label="Search reservations"
              style={filterControlStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Property</span>
            <select
              value={propertyId}
              onChange={(e) => updateFilters({ propertyId: e.target.value })}
              style={filterControlStyle}
            >
              <option value="ALL">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Stay from</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => updateFilters({ from: e.target.value })}
              style={filterControlStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Stay through</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => updateFilters({ to: e.target.value })}
              style={filterControlStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Operational status</span>
            <select
              value={operationalStatus}
              onChange={(e) =>
                updateFilters({ operationalStatus: e.target.value })
              }
              style={filterControlStyle}
            >
              <option value="ALL">All stays</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="IN_HOUSE">In house</option>
              <option value="CHECKED_OUT">Checked out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Payment status</span>
            <select
              value={paymentState}
              onChange={(e) => updateFilters({ paymentState: e.target.value })}
              style={filterControlStyle}
            >
              <option value="ALL">All payments</option>
              <option value="PAID">Paid</option>
              <option value="NONE">Not paid</option>
              <option value="PARTIALLY_REFUNDED">Partially refunded</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Source</span>
            <select
              value={source}
              onChange={(e) => updateFilters({ source: e.target.value })}
              style={filterControlStyle}
            >
              <option value="ALL">All sources</option>
              <option value="PIN_GO_DIRECT">Pin&amp;Go Direct</option>
              <option value="PIN_GO_MANUAL">Pin&amp;Go Manual</option>
              <option value="AIRBNB">Airbnb</option>
              <option value="VRBO">Vrbo</option>
              <option value="BOOKING_COM">Booking.com</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>Sort by</span>
            <select
              value={sort}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              style={filterControlStyle}
            >
              <option value="checkIn_desc">Latest check-in first</option>
              <option value="checkIn_asc">Earliest check-in first</option>
              <option value="checkOut_asc">Earliest check-out first</option>
              <option value="checkOut_desc">Latest check-out first</option>
              <option value="updatedAt_desc">Recently updated</option>
            </select>
          </label>
        </div>

        <div style={{ color: "#64748b", fontSize: 13 }}>
          {loading
            ? "Updating results…"
            : data
            ? `Showing ${resultStart}–${resultEnd} of ${data.total} matching reservations`
            : "—"}
        </div>
      </div>

      {err ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div
  style={{
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  }}
>
          <table
  style={{
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
  }}
>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {[ "Reservation #","Guest", "Property", "Check-in", "Check-out", "Operational", "Payment", "Total Paid", "Source"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "#666",
                        padding: 12,
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                        letterSpacing: 0.2,
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16, color: "#666" }}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16, color: "#666" }}>
                    No reservations found for this filter.
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const styles = statusStyles(r.operationalStatus);
                  const payment = paymentStyles(r.paymentState);

                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/reservations/${r.id}`)}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fff";
                      }}
                    >
                      
<td
  style={{
    padding: 12,
    whiteSpace: "nowrap",
  }}
>
  <div
    style={{
      fontWeight: 800,
      color: "#2563eb",
      fontSize: 13,
    }}
  >
    {r.reservationNumber
  ? `#${r.reservationNumber}`
  : "Pending"}
  </div>
</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700, color: "#111827" }}>{r.guestName}</div>
                        <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                          {r.roomName ?? r.guestEmail ?? ""}
                        </div>
                      </td>

                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{propertyLabel(r)}</div>
                      </td>

                      <td style={{ padding: 12, color: "#333", whiteSpace: "nowrap" }}>
                        {fmt(r.checkIn, r.property?.timezone)}
                      </td>

                      <td style={{ padding: 12, color: "#333", whiteSpace: "nowrap" }}>
                        {fmt(r.checkOut, r.property?.timezone)}
                      </td>

                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: styles.background,
                            color: styles.color,
                            border: styles.border,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {operationalStatusLabel(r.operationalStatus)}
                        </span>
                      </td>

                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: payment.background,
                            color: payment.color,
                            border: payment.border,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {paymentStateLabel(r.paymentState)}
                        </span>
                      </td>

                                             <td style={{ padding: 12, color: "#111827", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 800 }}>
                          {fmtMoney(r.totalAmount)}
                        </div>
                      </td>

                      <td style={{ padding: 12, color: "#666" }}>
                        {getVisibleReservationSourceLabel(r)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "12px 14px",
            borderTop: "1px solid #f3f4f6",
            background: "#f8fafc",
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              color: "#475569",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Rows per page
            <select
              value={pageSize}
              onChange={(e) =>
                updateFilters({
                  pageSize: e.target.value === "25" ? null : e.target.value,
                })
              }
              style={{
                padding: "7px 9px",
                borderRadius: 9,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#0f172a",
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>

          <div style={{ color: "#64748b", fontSize: 13 }}>
            {resultStart}–{resultEnd} of {data?.total ?? 0}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                const previousPage = Math.max(1, page - 1);
                updateFilters(
                  { page: previousPage === 1 ? null : String(previousPage) },
                  false
                );
              }}
              disabled={page <= 1 || loading}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: page <= 1 ? "#f1f5f9" : "#fff",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                color: page <= 1 ? "#94a3b8" : "#0f172a",
                fontWeight: 700,
              }}
            >
              Previous
            </button>

            <div style={{ color: "#475569", fontSize: 13, minWidth: 90, textAlign: "center" }}>
              Page <b>{page}</b> of {totalPages}
            </div>

            <button
              onClick={() =>
                updateFilters(
                  { page: String(Math.min(totalPages, page + 1)) },
                  false
                )
              }
              disabled={page >= totalPages || loading}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: page >= totalPages ? "#f1f5f9" : "#fff",
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                color: page >= totalPages ? "#94a3b8" : "#0f172a",
                fontWeight: 700,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
