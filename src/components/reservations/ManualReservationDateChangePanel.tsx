import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.pin-ngo.com";

type ReservationSummary = { id: string; source?: string | null; status?: string | null; checkIn: string; checkOut: string };

function toDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function ManualReservationDateChangePanel() {
  const { id } = useParams();
  const [reservation, setReservation] = useState<ReservationSummary | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
        setCheckIn(toDateInput(data.checkIn));
        setCheckOut(toDateInput(data.checkOut));
      } catch {
        // Reservation Detail owns the primary load/error experience.
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (!reservation || String(reservation.source ?? "").toUpperCase() !== "MANUAL" || String(reservation.status ?? "").toUpperCase() !== "ACTIVE") return null;

  async function save() {
    if (!id || !checkIn || !checkOut) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${API_BASE}/api/dashboard/reservations/${encodeURIComponent(id)}/dates`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn: `${checkIn}T16:00:00-04:00`, checkOut: `${checkOut}T11:00:00-04:00` }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.message || payload?.error || "Unable to update reservation dates.");
      setMessage("Reservation dates updated successfully.");
      setEditing(false);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update reservation dates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: "1px solid #dbeafe", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Stay dates</div><div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>Change the dates for this manual reservation.</div></div>
        {!editing ? <button type="button" onClick={() => { setEditing(true); setMessage(null); setError(null); }} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>Change dates</button> : null}
      </div>
      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Check-in<input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>Check-out<input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <button type="button" disabled={saving} onClick={save} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.65 : 1 }}>{saving ? "Saving..." : "Save new dates"}</button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setCheckIn(toDateInput(reservation.checkIn)); setCheckOut(toDateInput(reservation.checkOut)); setError(null); }} style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : null}
      {error ? <div style={{ marginTop: 12, color: "#991b1b", fontSize: 13, fontWeight: 600 }}>{error}</div> : null}
      {message ? <div style={{ marginTop: 12, color: "#065f46", fontSize: 13, fontWeight: 600 }}>{message}</div> : null}
    </div>
  );
}
