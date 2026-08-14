import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getVisibleReservationProviderLabel,
  getVisibleReservationSourceLabel,
} from "../../lib/whiteLabel";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://api.pin-ngo.com";

type Passcode = {
  id: string;
  method: string;
  status: string;
  startsAt: string;
  endsAt: string;
  codeMasked: string | null;
  lock: {
    id: string;
    ttlockLockId: number;
    name: string | null;
    property: { id: string; name: string };
  };
};

type Nfc = {
  id: string;
  role: string;
  status: string;
  startsAt: string;
  endsAt: string;
  card: {
    id: string;
    label: string | null;
    ttlockCardId: number;
  };
};

type PricingAmenity = {
  id: string;
  name: string;
  amount: number;
  feeType: string;
  baseAmount: number;
  chargeMode: string;
  isSelected: boolean;
  description?: string | null;
};

type PricingTax = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
};

type PricingBreakdown = {
  nights: number;
  currency: string;
  nightlyRate: number;
  nightlySubtotal: number;
  cleaningFee: number;
  amenitiesTotal: number;
  taxesTotal: number;
  taxableSubtotal: number;
  totalAmount: number;
  totalAmountCents?: number;
  amenities?: PricingAmenity[];
  chargedAmenities?: PricingAmenity[];
  taxes?: PricingTax[];
};

type Reservation = {
  id: string;
  reservationNumber?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  roomName?: string | null;
  checkIn: string;
  checkOut: string;
  operationalStatus: string;
  status?: string;
  paymentState?: "NONE" | "PAID" | "FAILED" | "PENDING";
  totalAmount?: number | null;
  currency?: string | null;
  source?: string | null;
  externalProvider?: string | null;
  externalId?: string | null;
  selectedAmenityIds?: string[];
  pricingBreakdown?: PricingBreakdown | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  property?: { id: string; name: string; timezone?: string | null } | null;
  passcodes?: Passcode[];
  nfc?: Nfc[];
};

function fmt(d?: string | null, timezone?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);

  if (isNaN(dt.getTime())) return d;

  try {
    return dt.toLocaleString(undefined, {
      timeZone: timezone || "UTC",
    });
  } catch {
    return dt.toLocaleString(undefined, {
      timeZone: "UTC",
    });
  }
}

function money(value?: number | null, currency = "usd") {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function getReservationTotalAmount(reservation: Reservation) {
  const totalAmount = Number(reservation.totalAmount);

  if (Number.isFinite(totalAmount) && totalAmount > 0) {
    return totalAmount;
  }

  const pricingTotalAmount = Number(reservation.pricingBreakdown?.totalAmount);

  if (Number.isFinite(pricingTotalAmount) && pricingTotalAmount > 0) {
    return pricingTotalAmount;
  }

  return null;
}

function getReservationCurrency(reservation: Reservation) {
  return (
    reservation.currency ||
    reservation.pricingBreakdown?.currency ||
    "usd"
  );
}

function labelizeStatus(value?: string | null) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

function statusPill(value?: string | null) {
  const v = String(value ?? "").toUpperCase();

  let background = "#f3f4f6";
  let color = "#4b5563";
  let border = "1px solid #e5e7eb";

  if (v === "IN_HOUSE" || v === "ACTIVE") {
    background = "#ecfdf5";
    color = "#065f46";
    border = "1px solid #a7f3d0";
  } else if (v === "UPCOMING" || v === "PENDING") {
    background = "#eff6ff";
    color = "#1d4ed8";
    border = "1px solid #bfdbfe";
  } else if (v === "CHECKED_OUT" || v === "EXPIRED") {
    background = "#f3f4f6";
    color = "#4b5563";
    border = "1px solid #e5e7eb";
  } else if (v === "CANCELLED" || v === "FAILED") {
    background = "#fef2f2";
    color = "#991b1b";
    border = "1px solid #fecaca";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        background,
        color,
        border,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {labelizeStatus(value)}
    </span>
  );
}

function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  } as const;
}

function sectionTitleStyle() {
  return {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  } as const;
}

function mutedStyle() {
  return {
    color: "#6b7280",
  } as const;
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}

export function ReservationDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [cancellationNotice, setCancellationNotice] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`${API_BASE}/api/dashboard/reservations/${id}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${text || res.statusText}`);
        }

        const json = (await res.json()) as Reservation;

        if (!cancelled) {
          setData(json);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message ?? e));
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const passcodes = useMemo(() => data?.passcodes ?? [], [data]);
  const nfcCards = useMemo(() => data?.nfc ?? [], [data]);

  const reservationTotalPaid = data ? getReservationTotalAmount(data) : null;
  const reservationCurrency = data ? getReservationCurrency(data) : "usd";
  const reservationSource = data
    ? getVisibleReservationSourceLabel(data)
    : "—";
  const reservationProvider = data
    ? getVisibleReservationProviderLabel(data.externalProvider ?? "PIN_GO")
    : "—";

  const canCancelManualReservation =
    String(data?.status ?? "").trim().toUpperCase() === "ACTIVE" &&
    String(data?.source ?? "").trim().toUpperCase() === "MANUAL" &&
    String(data?.externalProvider ?? "").trim().toUpperCase() ===
      "PIN_GO_MANUAL";

  function openCancellationDialog() {
    setCancellationReason("");
    setCancellationError(null);
    setCancellationNotice(null);
    setCancelDialogOpen(true);
  }

  function closeCancellationDialog() {
    if (cancellationSubmitting) return;

    setCancelDialogOpen(false);
    setCancellationError(null);
  }

  async function cancelManualReservation() {
    const reason = cancellationReason.trim();

    if (!reason) {
      setCancellationError("A cancellation reason is required.");
      return;
    }

    if (!id || !canCancelManualReservation || cancellationSubmitting) {
      return;
    }

    try {
      setCancellationSubmitting(true);
      setCancellationError(null);

      const response = await fetch(
        `${API_BASE}/api/dashboard/reservations/${id}/cancel-manual`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        operationalFinalization?: {
          ok?: boolean;
        };
      } | null;

      if (!response.ok || payload?.ok !== true) {
        throw new Error(
          payload?.message || "Unable to cancel this manual reservation."
        );
      }

      const followUpNeedsAttention =
        payload.operationalFinalization?.ok === false;

      setCancellationNotice({
        tone: followUpNeedsAttention ? "warning" : "success",
        message: followUpNeedsAttention
          ? "Reservation cancelled. Some follow-up operations need attention in Mission Control."
          : "Manual reservation cancelled successfully.",
      });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setRefreshKey((current) => current + 1);
    } catch (error: unknown) {
      setCancellationError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this manual reservation."
      );
    } finally {
      setCancellationSubmitting(false);
    }
  }
  
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Link
          to="/reservations"
          style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
        >
          ← Back to reservations
        </Link>
        <div style={cardStyle()}>Loading reservation...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Link
          to="/reservations"
          style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
        >
          ← Back to reservations
        </Link>
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            padding: 16,
            borderRadius: 16,
          }}
        >
          <b>Error loading reservation:</b> {err}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Link
          to="/reservations"
          style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
        >
          ← Back to reservations
        </Link>
        <div style={cardStyle()}>Reservation not found.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/reservations"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to reservations
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <div>{statusPill(data.operationalStatus)}</div>

          {canCancelManualReservation ? (
            <button
              type="button"
              onClick={openCancellationDialog}
              style={{
                border: "1px solid #dc2626",
                borderRadius: 10,
                padding: "8px 12px",
                background: "#fff",
                color: "#b91c1c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel manual reservation
            </button>
          ) : null}
        </div>
      </div>

      {cancellationNotice ? (
        <div
          role="status"
          style={{
            border:
              cancellationNotice.tone === "warning"
                ? "1px solid #fde68a"
                : "1px solid #a7f3d0",
            background:
              cancellationNotice.tone === "warning" ? "#fffbeb" : "#ecfdf5",
            color:
              cancellationNotice.tone === "warning" ? "#92400e" : "#065f46",
            padding: 14,
            borderRadius: 14,
            fontWeight: 700,
          }}
        >
          {cancellationNotice.message}
        </div>
      ) : null}

      <div
        style={{
          ...cardStyle(),
          padding: 20,
          borderRadius: 20,
        }}
      >
     <div
  style={{
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  }}
>
  <div>
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 6,
      }}
    >
      Reservation
    </div>

    <h1
      style={{
        fontSize: 30,
        fontWeight: 800,
        margin: 0,
        color: "#111827",
      }}
    >
      {data.guestName}
    </h1>

    <div
      style={{
        marginTop: 8,
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.01em",
      }}
    >
      Reservation #{data.reservationNumber ?? "Pending Reference"}
    </div>
  </div>

  {data.paymentState ? (
    <div>{statusPill(data.paymentState)}</div>
  ) : null}
</div>
{/* ✅ ALERTA */}
{data.paymentState !== "PAID" && (
  <div
    style={{
      marginTop: 12,
      border: "1px solid #fde68a",
      background: "#fffbeb",
      padding: 12,
      borderRadius: 12,
      color: "#92400e",
      fontWeight: 600,
    }}
  >
    {data.paymentState === "PENDING" && "⏳ Waiting for payment"}
    {data.paymentState === "FAILED" && "❌ Payment failed"}
    {data.paymentState === "NONE" && "⚠️ No payment registered"}
  </div>
)}

        <div style={{ ...mutedStyle(), marginTop: 8, display: "grid", gap: 6 }}>
          <div>
            <b>Property:</b>{" "}
            {data.property ? (
              <Link
                to={`/properties/${data.property.id}`}
                style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
              >
                {data.property.name}
              </Link>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <Stat title="Check-in" value={fmt(data.checkIn, data.property?.timezone)} />
        <Stat title="Check-out" value={fmt(data.checkOut, data.property?.timezone)} />
        <Stat title="Operational Status" value={statusPill(data.operationalStatus)} />
        <Stat title="Room" value={data.roomName ?? "—"} />
      </div>





      <div style={cardStyle()}>
        <h3 style={sectionTitleStyle()}>Guest Information</h3>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <div>
            <b>Name:</b> {data.guestName}
          </div>

          <div>
            <b>Email:</b> {data.guestEmail ?? "—"}
          </div>
        </div>
      </div>

             <div style={cardStyle()}>
  <h3 style={sectionTitleStyle()}>Reservation Payment Details</h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 16,
      marginTop: 16,
    }}
  >
    <Stat
      title="Total Paid"
      value={
        reservationTotalPaid !== null
          ? money(reservationTotalPaid, reservationCurrency)
          : "—"
      }
    />

    <Stat title="Payment State" value={statusPill(data.paymentState)} />

    <Stat title="Source" value={reservationSource} />

    <Stat title="Provider" value={reservationProvider} />

    <Stat title="Currency" value={reservationCurrency.toUpperCase()} />
  </div>
</div> 
        {data.pricingBreakdown ? (
  <div style={cardStyle()}>
    <h3 style={sectionTitleStyle()}>Pricing Breakdown</h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginTop: 16,
      }}
    >
      <Stat
        title="Nightly Rate"
        value={`$${Number(data.pricingBreakdown.nightlyRate ?? 0).toFixed(2)}`}
      />

      <Stat
        title="Nights"
        value={String(data.pricingBreakdown.nights ?? 0)}
      />

      <Stat
        title="Amenities"
        value={`$${Number(data.pricingBreakdown.amenitiesTotal ?? 0).toFixed(2)}`}
      />

      <Stat
        title="Taxes"
        value={`$${Number(data.pricingBreakdown.taxesTotal ?? 0).toFixed(2)}`}
      />

      <Stat
  title="Total Paid"
  value={money(
    data.pricingBreakdown.totalAmount ?? 0,
    data.pricingBreakdown.currency ?? reservationCurrency
  )}
/>
    </div>
  </div>
) : null}
         
         {data.pricingBreakdown?.chargedAmenities?.length ? (
  <div style={cardStyle()}>
    <h3 style={sectionTitleStyle()}>Charged Amenities</h3>

    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {data.pricingBreakdown.chargedAmenities.map((amenity) => (
        <div
          key={amenity.id}
          style={{
            border: "1px solid #eef2f7",
            borderRadius: 14,
            padding: 14,
            background: "#fafafa",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#111827" }}>
              {amenity.name}
            </div>

            <div style={{ ...mutedStyle(), fontSize: 13, marginTop: 4 }}>
              {amenity.chargeMode} · {amenity.feeType}
            </div>
          </div>

          <div style={{ fontWeight: 800, color: "#111827" }}>
            ${Number(amenity.amount ?? 0).toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  </div>
) : null}

      
       {data.pricingBreakdown?.taxes?.length ? (
  <div style={cardStyle()}>
    <h3 style={sectionTitleStyle()}>Taxes</h3>

    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {data.pricingBreakdown.taxes.map((tax) => (
        <div
          key={tax.id}
          style={{
            border: "1px solid #eef2f7",
            borderRadius: 14,
            padding: 14,
            background: "#fafafa",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#111827" }}>
              {tax.name}
            </div>

            <div style={{ ...mutedStyle(), fontSize: 13, marginTop: 4 }}>
              {Number(tax.percentage ?? 0).toFixed(2)}%
            </div>
          </div>

          <div style={{ fontWeight: 800, color: "#111827" }}>
            ${Number(tax.amount ?? 0).toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  </div>
) : null} 

      
        <div style={cardStyle()}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
          
        <h3 style={sectionTitleStyle()}>Passcodes</h3>
          <div style={mutedStyle()}>{passcodes.length} total</div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {passcodes.length === 0 ? (
            <div style={mutedStyle()}>No passcodes.</div>
          ) : (
            passcodes.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 14,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <b>Lock:</b>{" "}
                    <Link
                      to={`/locks/${p.lock.id}`}
                      style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                    >
                      {p.lock.name ?? `Lock ${p.lock.ttlockLockId}`}
                    </Link>
                  </div>

                  <div>
                    <b>Property:</b>{" "}
                    <Link
                      to={`/properties/${p.lock.property.id}`}
                      style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                    >
                      {p.lock.property.name}
                    </Link>
                  </div>

                  <div>
                    <b>Code:</b> {p.codeMasked ?? "—"}
                  </div>

                  <div>
                    <b>Access Period:</b>{" "}
                    {fmt(p.startsAt, data.property?.timezone)} —{" "}
                    {fmt(p.endsAt, data.property?.timezone)}
                  </div>

                  <div>
                    <b>Status:</b> {statusPill(p.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={cardStyle()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={sectionTitleStyle()}>NFC Cards</h3>
          <div style={mutedStyle()}>{nfcCards.length} total</div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {nfcCards.length === 0 ? (
            <div style={mutedStyle()}>No NFC cards.</div>
          ) : (
            nfcCards.map((n) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid #eef2f7",
                  borderRadius: 14,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <b>Card:</b> {n.card.label ?? `Card #${n.card.ttlockCardId}`}
                  </div>

                  <div>
                    <b>Role:</b> {labelizeStatus(n.role)}
                  </div>

                  <div>
                    <b>Access Period:</b>{" "}
                    {fmt(n.startsAt, data.property?.timezone)} —{" "}
                    {fmt(n.endsAt, data.property?.timezone)}
                  </div>

                  <div>
                    <b>Status:</b> {statusPill(n.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {cancelDialogOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(17, 24, 39, 0.55)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-cancellation-title"
            style={{
              width: "min(100%, 560px)",
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
              padding: 22,
            }}
          >
            <h2
              id="manual-cancellation-title"
              style={{ margin: 0, color: "#991b1b", fontSize: 22 }}
            >
              Cancel manual reservation?
            </h2>

            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 14,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <div>This will cancel the reservation and close its access lifecycle.</div>
              <div>The guest and the related cleaner will be notified.</div>
              <div>
                Any manually recorded payment remains unchanged. No Stripe refund
                will be processed.
              </div>
            </div>

            <label
              htmlFor="manual-cancellation-reason"
              style={{
                display: "block",
                marginTop: 18,
                color: "#111827",
                fontWeight: 700,
              }}
            >
              Cancellation reason
            </label>
            <textarea
              id="manual-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                if (cancellationError) setCancellationError(null);
              }}
              maxLength={1000}
              rows={4}
              disabled={cancellationSubmitting}
              placeholder="Explain why this reservation is being cancelled."
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 8,
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: 12,
                resize: "vertical",
                font: "inherit",
              }}
            />

            <div
              style={{
                marginTop: 6,
                textAlign: "right",
                color: "#6b7280",
                fontSize: 12,
              }}
            >
              {cancellationReason.length}/1000
            </div>

            {cancellationError ? (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#991b1b",
                  padding: 10,
                  fontWeight: 600,
                }}
              >
                {cancellationError}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={closeCancellationDialog}
                disabled={cancellationSubmitting}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  cursor: cancellationSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Keep reservation
              </button>
              <button
                type="button"
                onClick={cancelManualReservation}
                disabled={
                  cancellationSubmitting || !cancellationReason.trim()
                }
                style={{
                  border: "1px solid #b91c1c",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background:
                    cancellationSubmitting || !cancellationReason.trim()
                      ? "#fca5a5"
                      : "#b91c1c",
                  color: "#fff",
                  fontWeight: 800,
                  cursor:
                    cancellationSubmitting || !cancellationReason.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {cancellationSubmitting
                  ? "Cancelling..."
                  : "Cancel reservation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
