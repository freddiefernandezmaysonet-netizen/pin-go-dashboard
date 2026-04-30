import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type StatusType =
  | "READY_TO_SEND"
  | "PENDING"
  | "COMPLETED"
  | "SKIPPED_CONVERTED";

type FollowUp = {
  id: string;
  status: string;
  bookingType: string;
  dueAt?: string;
  createdAt?: string;
  appointment?: {
    name?: string;
    email?: string;
    phone?: string;
    topic?: string;
    scheduledAt?: string;
  };
};

export default function AdminSalesFollowupsPage() {
  const [data, setData] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<StatusType>("READY_TO_SEND");

  async function load(status: StatusType = activeTab) {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/internal/admin/sales-followups?status=${status}`,
        { credentials: "include" }
      );

      const json = await res.json();

      if (json.ok) {
        setData(json.followUps ?? []);
      } else {
        console.error("[FOLLOWUPS_ERROR]", json);
        setData([]);
      }
    } catch (err) {
      console.error("[ADMIN_SALES_FOLLOWUPS_LOAD_ERROR]", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAsContacted(id: string) {
    try {
      setMarkingId(id);

      const res = await fetch(
        `${API_BASE}/api/internal/admin/sales-followups/${id}/contacted`,
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
    load(activeTab);
  }, [activeTab]);

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.headerCard}>
        <div>
          <div style={styles.eyebrow}>Pin&Go internal CRM</div>
          <h1 style={styles.title}>Sales Follow-ups</h1>
          <p style={styles.subtitle}>
            Manage demo leads and follow-up pipeline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(activeTab)}
          style={styles.refreshButton}
        >
          Refresh
        </button>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {[
          "READY_TO_SEND",
          "PENDING",
          "COMPLETED",
          "SKIPPED_CONVERTED",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as StatusType)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {loading ? (
        <div style={styles.emptyCard}>Loading...</div>
      ) : data.length === 0 ? (
        <div style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>No results</h3>
          <p style={styles.emptyText}>
            No follow-ups found for {activeTab}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {data.map((f) => (
            <div key={f.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <div style={styles.leadName}>
                    {f.appointment?.name ?? "Unknown lead"}
                  </div>
                  <div style={styles.leadEmail}>
                    {f.appointment?.email ?? "-"}
                  </div>
                </div>

                <span style={styles.badge}>{f.status}</span>
              </div>

              <div style={styles.infoGrid}>
                <div>
                  <div style={styles.infoLabel}>Phone</div>
                  <div style={styles.infoValue}>
                    {f.appointment?.phone ?? "-"}
                  </div>
                </div>

                <div>
                  <div style={styles.infoLabel}>Type</div>
                  <div style={styles.infoValue}>{f.bookingType}</div>
                </div>

                <div>
                  <div style={styles.infoLabel}>Demo</div>
                  <div style={styles.infoValue}>
                    {f.appointment?.scheduledAt
                      ? new Date(
                          f.appointment.scheduledAt
                        ).toLocaleString()
                      : "-"}
                  </div>
                </div>

                <div>
                  <div style={styles.infoLabel}>Due</div>
                  <div style={styles.infoValue}>
                    {f.dueAt
                      ? new Date(f.dueAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
              </div>

              {activeTab === "READY_TO_SEND" && (
                <button
                  type="button"
                  disabled={markingId === f.id}
                  onClick={() => markAsContacted(f.id)}
                  style={styles.primaryButton}
                >
                  {markingId === f.id
                    ? "Marking..."
                    : "Mark as contacted"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* STYLES */

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", gap: 18 },

  headerCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    color: "#2563eb",
  },

  title: { margin: 0, fontSize: 28, fontWeight: 900 },

  subtitle: { color: "#64748b" },

  refreshButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
  },

  tabs: {
    display: "flex",
    gap: 8,
  },

  tab: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    background: "#fff",
    fontWeight: 700,
  },

  tabActive: {
    background: "#0f172a",
    color: "#fff",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
  },

  leadName: { fontWeight: 900 },

  leadEmail: { color: "#64748b" },

  badge: {
    fontSize: 11,
    fontWeight: 900,
    background: "#fef3c7",
    padding: "4px 8px",
    borderRadius: 999,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    marginTop: 12,
  },

  infoLabel: { fontSize: 11, color: "#94a3b8" },

  infoValue: { fontWeight: 700 },

  primaryButton: {
    marginTop: 12,
    padding: "10px",
    borderRadius: 10,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 800,
    border: "none",
    cursor: "pointer",
  },

  emptyCard: {
    padding: 30,
    textAlign: "center",
  },

  emptyTitle: { fontWeight: 900 },

  emptyText: { color: "#64748b" },
};