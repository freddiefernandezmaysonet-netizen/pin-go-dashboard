import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type PaymentState = "NONE" | "PAID" | "FAILED" | "PENDING";

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

type Reservation = {
  id: string;
  guestName: string;
  guestEmail?: string | null;
  roomName?: string | null;
  checkIn: string;
  checkOut: string;
  operationalStatus: string;
  paymentState: PaymentState; // ✅ ADD
  property?: { id: string; name: string; timezone?: string } | null;
  passcodes?: Passcode[];
  nfc?: Nfc[];
};

function fmt(d?: string | null, timezone?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone ?? "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
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

// ✅ NUEVO
function paymentStyles(state: PaymentState) {
  if (state === "PAID") {
    return { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" };
  }
  if (state === "PENDING") {
    return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
  }
  if (state === "FAILED") {
    return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
  }
  return { background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb" };
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
    <div style={{ ...cardStyle(), padding: 16 }}>
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

        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message ?? e));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const passcodes = useMemo(() => data?.passcodes ?? [], [data]);
  const nfcCards = useMemo(() => data?.nfc ?? [], [data]);

  if (!data || loading) return <div>Loading...</div>;

  const payment = paymentStyles(data.paymentState);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Link to="/reservations">← Back</Link>

      {/* HEADER */}
      <div style={cardStyle()}>
        <h1>{data.guestName}</h1>

        {/* ✅ PAYMENT BADGE */}
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: payment.background,
              color: payment.color,
              border: payment.border,
              fontWeight: 700,
            }}
          >
            {data.paymentState}
          </span>
        </div>

        {/* ⚠️ ALERTA UX */}
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
            {data.paymentState === "PENDING" && "⏳ Waiting for payment to enable access"}
            {data.paymentState === "FAILED" && "❌ Payment failed. Access blocked"}
            {data.paymentState === "NONE" && "⚠️ No payment registered"}
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Stat title="Check-in" value={fmt(data.checkIn, data.property?.timezone)} />
        <Stat title="Check-out" value={fmt(data.checkOut, data.property?.timezone)} />
        <Stat title="Status" value={statusPill(data.operationalStatus)} />
        <Stat title="Room" value={data.roomName ?? "—"} />
      </div>

      {/* PASSCODES */}
      <div style={cardStyle()}>
        <h3>Passcodes ({passcodes.length})</h3>
        {passcodes.map((p) => (
          <div key={p.id}>{p.codeMasked}</div>
        ))}
      </div>

      {/* NFC */}
      <div style={cardStyle()}>
        <h3>NFC ({nfcCards.length})</h3>
        {nfcCards.map((n) => (
          <div key={n.id}>{n.card.label}</div>
        ))}
      </div>
    </div>
  );
}