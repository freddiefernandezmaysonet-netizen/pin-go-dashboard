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

const tabs: StatusType[] = [
  "READY_TO_SEND",
  "PENDING",
  "COMPLETED",
  "SKIPPED_CONVERTED",
];

export default function AdminSalesFollowupsPage() {
  const [data, setData] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusType>("READY_TO_SEND");

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/internal/admin/sales-followups?status=${activeTab}`,
        { credentials: "include" }
      );

      const json = await res.json();

      if (json.ok) {
        setData(json.followUps ?? []);
      } else {
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

async function sendEmail(id: string) {
  try {
    setMarkingId(id);

    const res = await fetch(
      `${API_BASE}/api/internal/admin/sales-followups/${id}/send-email`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const json = await res.json();

    if (!json.ok) {
      alert(json.error ?? "Failed to send email");
      return;
    }

    await load();
  } catch (err) {
    console.error("[FOLLOWUP_EMAIL_ERROR]", err);
    alert("Failed to send email");
  } finally {
    setMarkingId(null);
  }
}

  useEffect(() => {
    load();
  }, [activeTab]);

  const currentCount = data.length;

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <div style={styles.eyebrow}>Pin&Go internal CRM</div>
          <h1 style={styles.title}>Sales Follow-ups</h1>
          <p style={styles.subtitle}>
            Manage demo leads and follow-up pipeline.
          </p>
        </div>

        <button type="button" onClick={load} style={styles.refreshButton}>
          Refresh
        </button>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Current view</div>
          <div style={styles.statValue}>{currentCount}</div>
          <div style={styles.statHint}>{activeTab}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Flow</div>
          <div style={styles.statValue}>DEMO</div>
          <div style={styles.statHint}>Sales pipeline</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Action</div>
          <div style={styles.statValue}>Manual</div>
          <div style={styles.statHint}>No auto SMS yet</div>
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab ? styles.tabButtonActive : {}),
            }}
          >
            {tab.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>{activeTab.replaceAll("_", " ")}</h2>
          <p style={styles.sectionSubtitle}>
            {activeTab === "READY_TO_SEND"
              ? "Mark a lead as contacted after you follow up."
              : "Review leads in this stage of the pipeline."}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={styles.emptyCard}>Loading follow-ups...</div>
      ) : data.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={styles.emptyIcon}>✨</div>
          <h3 style={styles.emptyTitle}>No leads in this status</h3>
          <p style={styles.emptyText}>
            No follow-ups found for {activeTab.replaceAll("_", " ")}.
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
                  <div style={styles.infoLabel}>Booking type</div>
                  <div style={styles.infoValue}>{f.bookingType}</div>
                </div>

                <div>
                  <div style={styles.infoLabel}>Demo date</div>
                  <div style={styles.infoValue}>
                    {f.appointment?.scheduledAt
                      ? new Date(f.appointment.scheduledAt).toLocaleString()
                      : "-"}
                  </div>
                </div>

                <div>
                  <div style={styles.infoLabel}>Follow-up due</div>
                  <div style={styles.infoValue}>
                    {f.dueAt ? new Date(f.dueAt).toLocaleString() : "-"}
                  </div>
                </div>
              </div>

              {f.appointment?.topic && (
                <div style={styles.topicBox}>
                  <div style={styles.infoLabel}>Topic</div>
                  <div style={styles.topicText}>{f.appointment.topic}</div>
                </div>
              )}

             {activeTab === "READY_TO_SEND" && (
  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
    
    <button
      type="button"
      disabled={markingId === f.id}
      onClick={() => sendEmail(f.id)}
      style={{
        ...styles.primaryButton,
        background: "#2563eb",
      }}
    >
      {markingId === f.id ? "Sending..." : "Send email"}
    </button>

    <button
      type="button"
      disabled={markingId === f.id}
      onClick={() => markAsContacted(f.id)}
      style={{
        ...styles.primaryButton,
        background: "#0f172a",
      }}
    >
      Mark as contacted
    </button>

  </div>
)}

                             
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  headerCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
  refreshButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  statValue: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
  },
  statHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 700,
  },
  tabs: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  tabButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    fontWeight: 800,
    cursor: "pointer",
  },
  tabButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginTop: 4,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
    fontWeight: 900,
  },
  sectionSubtitle: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  leadName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  leadEmail: {
    marginTop: 4,
    fontSize: 14,
    color: "#64748b",
    wordBreak: "break-word",
  },
  badge: {
    fontSize: 11,
    fontWeight: 900,
    color: "#92400e",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 999,
    padding: "6px 9px",
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    wordBreak: "break-word",
  },
  topicBox: {
    marginTop: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
  },
  topicText: {
    marginTop: 4,
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.5,
  },
  primaryButton: {
    marginTop: 16,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 800,
  },
  emptyCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 28,
    textAlign: "center",
    color: "#64748b",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  emptyText: {
    margin: "8px auto 0",
    maxWidth: 460,
    fontSize: 14,
    lineHeight: 1.6,
  },
};