import type { CSSProperties } from "react";

export type OperationalWorkflowState =
  | "ACTION_REQUIRED"
  | "WAITING"
  | "AUTO_RESOLVING"
  | "RESOLVED";

export type OperationalIntelligenceItem = {
  issueCode: string;

  title: string;
  issue: string;
  operationalImpact?: string | null;
  recommendedAction?: string | null;
  nextAutomaticStep?: string | null;

  engine: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  workflowState: OperationalWorkflowState;
  visibility: "HOST";
  responsibleActor: string;

  actionRequired: boolean;
  canAutoResolve: boolean;
  autoResolveStatus:
    | "AVAILABLE"
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "NOT_SUPPORTED";

  reservationId?: string | null;
  reservationNumber?: string | null;
  guestName?: string | null;
  cleanerName?: string | null;

  firstDetectedAt: string | Date;
  lastSignalAt: string | Date;
  resolvedAt?: string | Date | null;

  resolutionCode?: string | null;
  resolutionSummary?: string | null;
  resolutionType?:
    | "AUTOMATIC"
    | "MANUAL"
    | "EXPIRED"
    | "SUPERSEDED"
    | null;
  resolvedBy?: string | null;

  actionTarget: string;

  openUrl?: string | null;
  secondaryActionUrl?: string | null;
};

type OperationalIntelligencePanelProps = {
  items: OperationalIntelligenceItem[];
  onOpenReservation?: (
    reservationId: string
  ) => void;
};

type SectionDefinition = {
  state: OperationalWorkflowState;
  eyebrow: string;
  title: string;
  description: string;
  emptyLabel: string;
  accent: string;
  softBackground: string;
  borderColor: string;
  badgeBackground: string;
  badgeColor: string;
};

const sectionDefinitions: SectionDefinition[] = [
  {
    state: "ACTION_REQUIRED",
    eyebrow: "NEEDS YOUR ATTENTION",
    title: "Human action required",
    description:
      "Pin&Go found an operational issue that cannot continue safely without intervention.",
    emptyLabel: "No host actions required",
    accent: "#dc2626",
    softBackground: "#fff7f7",
    borderColor: "#fecaca",
    badgeBackground: "#fee2e2",
    badgeColor: "#991b1b",
  },
  {
    state: "WAITING",
    eyebrow: "WAITING",
    title: "Monitoring expected responses",
    description:
      "Pin&Go is waiting for a normal workflow signal and will continue automatically.",
    emptyLabel: "No workflows waiting",
    accent: "#2563eb",
    softBackground: "#f8fbff",
    borderColor: "#bfdbfe",
    badgeBackground: "#dbeafe",
    badgeColor: "#1d4ed8",
  },
  {
    state: "AUTO_RESOLVING",
    eyebrow: "PIN&GO WORKING",
    title: "Automatic resolution in progress",
    description:
      "Pin&Go is actively repairing or completing these operational workflows.",
    emptyLabel: "No repairs currently running",
    accent: "#7c3aed",
    softBackground: "#faf8ff",
    borderColor: "#ddd6fe",
    badgeBackground: "#ede9fe",
    badgeColor: "#6d28d9",
  },
  {
    state: "RESOLVED",
    eyebrow: "RECENTLY RESOLVED",
    title: "Completed without disruption",
    description:
      "These operational workflows were completed or safely closed recently.",
    emptyLabel: "No recent resolutions",
    accent: "#059669",
    softBackground: "#f7fdf9",
    borderColor: "#bbf7d0",
    badgeBackground: "#dcfce7",
    badgeColor: "#047857",
  },
];

function getTimestamp(item: OperationalIntelligenceItem) {
  const rawValue =
    item.workflowState === "RESOLVED"
      ? item.resolvedAt ?? item.lastSignalAt
      : item.lastSignalAt;

  const date = rawValue
    ? new Date(rawValue)
    : null;

  return date && !Number.isNaN(date.getTime())
    ? date.getTime()
    : 0;
}

function formatTimestamp(
  item: OperationalIntelligenceItem
) {
  const timestamp = getTimestamp(item);

  if (!timestamp) {
    return "Live operational signal";
  }

  return new Date(timestamp).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatActor(value: unknown) {
  const actor = String(value ?? "")
    .trim()
    .toUpperCase();

  if (actor === "PIN_GO") return "Pin&Go";
  if (actor === "PIN_AI") return "Pin AI";
  if (actor === "HOST") return "Host";
  if (actor === "GUEST") return "Guest";
  if (actor === "CLEANER") return "Cleaner";
  if (actor === "STAFF") return "Staff";
  if (actor === "SYSTEM") return "System";

  return "No action owner";
}

function getStatusLabel(
  item: OperationalIntelligenceItem
) {
  if (item.workflowState === "ACTION_REQUIRED") {
    return item.severity === "CRITICAL"
      ? "Review now"
      : "Action required";
  }

  if (item.workflowState === "WAITING") {
    return "No host action";
  }

  if (item.workflowState === "AUTO_RESOLVING") {
    return "Working";
  }

  return item.resolutionType === "SUPERSEDED"
    ? "Safely closed"
    : "Resolved";
}

function getReservationLabel(
  item: OperationalIntelligenceItem
) {
  const reservationNumber = String(
    item.reservationNumber ?? ""
  ).trim();

  return reservationNumber
    ? `#${reservationNumber}`
    : null;
}

function OperationalItemCard({
  item,
  section,
  onOpenReservation,
}: {
  item: OperationalIntelligenceItem;
  section: SectionDefinition;
  onOpenReservation?: (
    reservationId: string
  ) => void;
}) {
  const reservationLabel =
    getReservationLabel(item);

  const showOpenReservation = Boolean(
    item.reservationId &&
      onOpenReservation
  );

  return (
    <article
      style={{
        ...styles.itemCard,
        borderColor: section.borderColor,
        background: section.softBackground,
      }}
    >
      <div style={styles.itemHeader}>
        <div style={styles.itemIdentity}>
          <div
            style={{
              ...styles.engineDot,
              background: section.accent,
            }}
          />

          <div>
            <div style={styles.itemMeta}>
              <span>{item.engine} Engine</span>

              {reservationLabel ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span style={styles.reservationNumber}>
                    {reservationLabel}
                  </span>
                </>
              ) : null}

              {item.guestName ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{item.guestName}</span>
                </>
              ) : null}
            </div>

            <h4 style={styles.itemTitle}>
              {item.title}
            </h4>
          </div>
        </div>

        <div
          style={{
            ...styles.statusBadge,
            background:
              section.badgeBackground,
            color: section.badgeColor,
          }}
        >
          {getStatusLabel(item)}
        </div>
      </div>

      <div style={styles.contentGrid}>
        <div>
          <div style={styles.detailLabel}>
            What happened
          </div>
          <div style={styles.detailText}>
            {item.issue}
          </div>
        </div>

        {item.operationalImpact ? (
          <div>
            <div style={styles.detailLabel}>
              Operational impact
            </div>
            <div style={styles.detailText}>
              {item.operationalImpact}
            </div>
          </div>
        ) : null}

        {item.nextAutomaticStep ? (
          <div>
            <div style={styles.detailLabel}>
              What Pin&Go will do next
            </div>
            <div style={styles.detailText}>
              {item.nextAutomaticStep}
            </div>
          </div>
        ) : null}

        {item.recommendedAction ? (
          <div>
            <div style={styles.detailLabel}>
              Recommended action
            </div>
            <div style={styles.detailText}>
              {item.recommendedAction}
            </div>
          </div>
        ) : null}

        {item.workflowState === "RESOLVED" &&
        item.resolutionSummary ? (
          <div>
            <div style={styles.detailLabel}>
              Resolution
            </div>
            <div style={styles.detailText}>
              {item.resolutionSummary}
            </div>
          </div>
        ) : null}
      </div>

      <div style={styles.itemFooter}>
        <div style={styles.footerMeta}>
          <span>
            Responsible:{" "}
            <strong>
              {formatActor(
                item.responsibleActor
              )}
            </strong>
          </span>

          <span aria-hidden="true">•</span>

          <span>{formatTimestamp(item)}</span>
        </div>

        {showOpenReservation ? (
          <button
            type="button"
            onClick={() =>
              onOpenReservation?.(
                String(item.reservationId)
              )
            }
            style={styles.openButton}
          >
            Open Reservation
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function OperationalIntelligencePanel({
  items,
  onOpenReservation,
}: OperationalIntelligencePanelProps) {
  const hostItems = Array.isArray(items)
    ? items.filter(
        (item) => item.visibility === "HOST"
      )
    : [];

  if (hostItems.length === 0) {
    return null;
  }

  const counts = {
    actionRequired: hostItems.filter(
      (item) =>
        item.workflowState ===
        "ACTION_REQUIRED"
    ).length,
    waiting: hostItems.filter(
      (item) =>
        item.workflowState === "WAITING"
    ).length,
    working: hostItems.filter(
      (item) =>
        item.workflowState ===
        "AUTO_RESOLVING"
    ).length,
    resolved: hostItems.filter(
      (item) =>
        item.workflowState === "RESOLVED"
    ).length,
  };

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <div style={styles.eyebrow}>
            OPERATIONAL INTELLIGENCE
          </div>

          <h3 style={styles.panelTitle}>
            Pin&Go Operational State
          </h3>

          <p style={styles.panelDescription}>
            Live workflows classified by what
            requires attention, what is waiting,
            what Pin&Go is resolving and what was
            completed.
          </p>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryItem}>
            <strong>
              {counts.actionRequired}
            </strong>
            <span>Needs attention</span>
          </div>

          <div style={styles.summaryItem}>
            <strong>{counts.waiting}</strong>
            <span>Waiting</span>
          </div>

          <div style={styles.summaryItem}>
            <strong>{counts.working}</strong>
            <span>Working</span>
          </div>

          <div style={styles.summaryItem}>
            <strong>{counts.resolved}</strong>
            <span>Resolved</span>
          </div>
        </div>
      </div>

      <div style={styles.sections}>
        {sectionDefinitions.map((section) => {
          const sectionItems = hostItems
            .filter(
              (item) =>
                item.workflowState ===
                section.state
            )
            .sort(
              (left, right) =>
                getTimestamp(right) -
                getTimestamp(left)
            );

          if (sectionItems.length === 0) {
            return null;
          }

          return (
            <div
              key={section.state}
              style={styles.section}
            >
              <div style={styles.sectionHeader}>
                <div>
                  <div
                    style={{
                      ...styles.sectionEyebrow,
                      color: section.accent,
                    }}
                  >
                    {section.eyebrow}
                  </div>

                  <div style={styles.sectionTitleRow}>
                    <h4 style={styles.sectionTitle}>
                      {section.title}
                    </h4>

                    <span
                      style={{
                        ...styles.sectionCount,
                        background:
                          section.badgeBackground,
                        color:
                          section.badgeColor,
                      }}
                    >
                      {sectionItems.length}
                    </span>
                  </div>

                  <p style={styles.sectionDescription}>
                    {section.description}
                  </p>
                </div>
              </div>

              <div style={styles.itemList}>
                {sectionItems.map(
                  (item, index) => (
                    <OperationalItemCard
                      key={`${item.issueCode}-${item.reservationNumber ?? "property"}-${index}`}
                      item={item}
                      section={section}
                      onOpenReservation={
                        onOpenReservation
                      }
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: "grid",
    gap: 22,
    padding: 24,
    borderRadius: 22,
    border: "1px solid #dbe4ee",
    background:
      "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow:
      "0 18px 45px rgba(15, 23, 42, 0.08)",
  },

  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    flexWrap: "wrap",
  },

  eyebrow: {
    marginBottom: 7,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.13em",
  },

  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.2,
  },

  panelDescription: {
    maxWidth: 650,
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(82px, 1fr))",
    gap: 8,
  },

  summaryItem: {
    display: "grid",
    gap: 3,
    minWidth: 82,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    textAlign: "center",
  },

  sections: {
    display: "grid",
    gap: 18,
  },

  section: {
    display: "grid",
    gap: 12,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
  },

  sectionEyebrow: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
  },

  sectionCount: {
    minWidth: 26,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    textAlign: "center",
  },

  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  itemList: {
    display: "grid",
    gap: 12,
  },

  itemCard: {
    display: "grid",
    gap: 16,
    padding: 18,
    border: "1px solid",
    borderRadius: 16,
  },

  itemHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },

  itemIdentity: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
  },

  engineDot: {
    flex: "0 0 auto",
    width: 9,
    height: 9,
    marginTop: 6,
    borderRadius: 999,
  },

  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },

  reservationNumber: {
    color: "#1d4ed8",
  },

  itemTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.35,
  },

  statusBadge: {
    flex: "0 0 auto",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },

  contentGrid: {
    display: "grid",
    gap: 12,
  },

  detailLabel: {
    marginBottom: 3,
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  detailText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.55,
  },

  itemFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    paddingTop: 13,
    borderTop: "1px solid rgba(148, 163, 184, 0.28)",
  },

  footerMeta: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 11,
  },

  openButton: {
    minHeight: 36,
    padding: "0 13px",
    borderRadius: 9,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};