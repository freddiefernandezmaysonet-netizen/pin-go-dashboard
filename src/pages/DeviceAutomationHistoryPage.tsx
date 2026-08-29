import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import AutomationHistoryPage from "./AutomationHistoryPage";

/**
 * Preserves the complete legacy automation execution surface while making its
 * scope explicit. The underlying AutomationHistoryPage continues to use the
 * existing /api/automation/history contract and automationExecutionLog data.
 */
export default function DeviceAutomationHistoryPage() {
  return (
    <div style={styles.page}>
      <section style={styles.scopeNotice}>
        <div>
          <div style={styles.eyebrow}>Legacy Device Automation</div>
          <div style={styles.title}>Device Automation History</div>
          <div style={styles.copy}>
            This log contains smart-device and property automation executions.
            It is intentionally separate from the APMS audit trail and must not
            be interpreted as APMS Decision History.
          </div>
        </div>

        <Link to="/apms/decision-history" style={styles.link}>
          Open APMS Decision History
        </Link>
      </section>

      <AutomationHistoryPage />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 20,
  },
  scopeNotice: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#2563eb",
  },
  title: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },
  copy: {
    marginTop: 6,
    maxWidth: 720,
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 750,
    color: "#475569",
  },
  link: {
    textDecoration: "none",
    color: "#1d4ed8",
    background: "#ffffff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
};
