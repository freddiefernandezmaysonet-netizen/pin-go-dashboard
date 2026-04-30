import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function AdminSalesFollowupsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/admin/sales-followups?status=READY_TO_SEND`,
        { credentials: "include" }
      );

      const json = await res.json();

      if (json.ok) {
        setData(json.followUps ?? []);
      }
    } catch (err) {
      console.error("[ADMIN_SALES_FOLLOWUPS_LOAD_ERROR]", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsContacted(id: string) {
    try {
      setMarkingId(id);

      const res = await fetch(
        `${API_BASE}/api/admin/sales-followups/${id}/contacted`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const json = await res.json();

      if (!json.ok) {
        alert(json.error ?? "Failed to mark as contacted");
        return;
      }

      await load();
    } catch (err) {
      console.error("[ADMIN_SALES_FOLLOWUP_CONTACTED_ERROR]", err);
      alert("Failed to mark as contacted");
    } finally {
      setMarkingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Sales Follow-ups</h2>
      <p style={{ color: "#64748b" }}>READY_TO_SEND leads only.</p>

      {data.length === 0 ? (
        <p>No leads ready yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((f) => (
            <div
              key={f.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <strong>{f.appointment?.name}</strong>
              <div>{f.appointment?.email}</div>
              <div>{f.appointment?.phone ?? "-"}</div>

              <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>
                Demo:{" "}
                {f.appointment?.scheduledAt
                  ? new Date(f.appointment.scheduledAt).toLocaleString()
                  : "-"}
              </div>

              <div style={{ fontSize: 13 }}>
                Due: {f.dueAt ? new Date(f.dueAt).toLocaleString() : "-"}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>
                {f.status}
              </div>

              <button
                type="button"
                disabled={markingId === f.id}
                onClick={() => markAsContacted(f.id)}
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #0f172a",
                  background: "#0f172a",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: markingId === f.id ? "not-allowed" : "pointer",
                  opacity: markingId === f.id ? 0.7 : 1,
                }}
              >
                {markingId === f.id ? "Marking..." : "Mark as contacted"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}