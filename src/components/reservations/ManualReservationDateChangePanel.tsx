import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.pin-ngo.com";

type ReservationSummary = {
  id: string;
  source?: string | null;
  status?: string | null;
  checkIn: string;
  checkOut: string;
  totalAmount?: number | null;
  currency?: string | null;
  property?: { timezone?: string | null } | null;
};

type PricingResult = {
  currentTotalAmount: number | null;
  proposedTotalAmount: number;
  difference: number | null;
  currency: string;
  paymentHandledOutsidePinGo: true;
};

function dateKeyInTimezone(value: string, timezone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function money(value: number | null | undefined, currency = "usd") {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(Number(value));
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function ManualReservationDateChangePanel() {
  const { id } = useParams();
  const [reservation, setReservation] = useState<ReservationSummary | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        const response = await fetch(`${API_BASE}/api/dashboard/reservations/${encodeURIComponent(id)}`, { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as ReservationSummary;
        if (cancelled) return;
        setReservation(data);
        setCheckIn(dateKeyInTimezone(data.checkIn, data.property?.timezone));
        setCheckOut(dateKeyInTimezone(data.checkOut, data.property?.timezone));
      } catch {
        // Reservation Detail owns the primary load/error experience.
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const proposedNights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  if (!reservation || String(reservation.source ?? "").toUpperCase() !== "MANUAL" || String(reservation.status ?? "").toUpperCase() !== "ACTIVE") return null;

  async function save() {
    if (!id || !checkIn || !checkOut || proposedNights <= 0) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      setPricing(null);

      const response = await fetch(`${API_BASE}/api/dashboard/reservations/${encodeURIComponent(id)}/dates`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInDate: checkIn, checkOutDate: checkOut }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.message || payload?.error || "Unable to update reservation dates.");

      setPricing(payload.pricing ?? null);
      setMessage("Reservation dates and pricing updated successfully.");
      setEditing(false);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update reservation dates.");
    } finally {
      setSaving(false);
    }
  }

  const currentCheckIn = dateKeyInTimezone(reservation.checkIn, reservation.property?.timezone);
  const currentCheckOut = dateKeyInTimezone(reservation.checkOut, reservation.property?.timezone);
  const currentNights = nightsBetween(currentCheckIn, currentCheckOut);

  return (
    <div style={{ border: "1px solid #dbeafe", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Stay dates</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>Change this manual reservation. Pin&Go recalculates pricing; payment remains outside Pin&Go.</div>
        </div>
        {!editing ? <button type="button" onClick={() => { setEditing(true); setMessage(null); setError(null); setPricing(null); }} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>Change dates</button> : null}
      </div>

      {editing ? <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Check-in<input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Check-out<input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
        </div>
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#f8fafc", fontSize: 13, color: "#374151" }}>
          <strong>Current:</strong> {currentCheckIn} – {currentCheckOut} · {currentNights} nights · {money(reservation.totalAmount, reservation.currency ?? "usd")}<br />
          <strong>Proposed:</strong> {checkIn} – {checkOut} · {proposedNights} nights<br />
          <span style={{ color: "#6b7280" }}>The canonical Pricing Engine recalculates the final total when you confirm. No Stripe charge is created.</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" disabled={saving || proposedNights <= 0} onClick={save} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving || proposedNights <= 0 ? 0.65 : 1 }}>{saving ? "Updating..." : "Confirm change"}</button>
          <button type="button" disabled={saving} onClick={() => { setEditing(false); setCheckIn(currentCheckIn); setCheckOut(currentCheckOut); setError(null); setPricing(null); }} style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
        </div>
      </> : null}

      {pricing ? <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ecfdf5", color: "#065f46", fontSize: 13 }}><strong>Updated total:</strong> {money(pricing.proposedTotalAmount, pricing.currency)}{pricing.difference != null ? ` · Difference ${pricing.difference >= 0 ? "+" : ""}${money(pricing.difference, pricing.currency)}` : ""}<br />Payment is handled outside Pin&Go.</div> : null}
      {error ? <div style={{ marginTop: 12, color: "#991b1b", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
      {message ? <div style={{ marginTop: 12, color: "#065f46", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}
    </div>
  );
}
