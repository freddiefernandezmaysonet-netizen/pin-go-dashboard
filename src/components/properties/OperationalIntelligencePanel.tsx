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
  onOpenReservation?: (reservationId: string) => void;
};

type StatePresentation = {
  label: string;
  metricLabel: string;
  eyebrowColor: string;
  dot: string;
  dotBackground: string;
  dotRing: string;
  pillColor: string;
  pillBackground: string;
  pillBorder: string;
  cardBackground: string;
  nextStepLabel: string;
};

const statePresentation: Record<OperationalWorkflowState, StatePresentation> = {
  ACTION_REQUIRED: {
    label: "Needs attention",
    metricLabel: "Needs attention",
    eyebrowColor: "#fca5a5",
    dot: "!",
    dotBackground: "#fee2e2",
    dotRing: "#fef2f2",
    pillColor: "#991b1b",
    pillBackground: "#fee2e2",
    pillBorder: "#fecaca",
    cardBackground: "linear-gradient(135deg, #fff7f7 0%, #ffffff 100%)",
    nextStepLabel: "Host action",
  },
  AUTO_RESOLVING: {
    label: "Pin&Go working",
    metricLabel: "Pin&Go working",
    eyebrowColor: "#c4b5fd",
    dot: "↻",
    dotBackground: "#ede9fe",
    dotRing: "#faf5ff",
    pillColor: "#6d28d9",
    pillBackground: "#ede9fe",
    pillBorder: "#ddd6fe",
    cardBackground: "linear-gradient(135deg, #faf8ff 0%, #ffffff 100%)",
    nextStepLabel: "Automatic next step",
  },
  WAITING: {
    label: "Waiting",
    metricLabel: "Waiting",
    eyebrowColor: "#93c5fd",
    dot: "…",
    dotBackground: "#dbeafe",
    dotRing: "#eff6ff",
    pillColor: "#1d4ed8",
    pillBackground: "#dbeafe",
    pillBorder: "#bfdbfe",
    cardBackground: "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
    nextStepLabel: "Automatic next step",
  },
  RESOLVED: {
    label: "Resolved",
    metricLabel: "Recently resolved",
    eyebrowColor: "#86efac",
    dot: "✓",
    dotBackground: "#dcfce7",
    dotRing: "#f0fdf4",
    pillColor: "#166534",
    pillBackground: "#dcfce7",
    pillBorder: "#bbf7d0",
    cardBackground: "#ffffff",
    nextStepLabel: "Outcome",
  },
};

const stateOrder: OperationalWorkflowState[] = [
  "ACTION_REQUIRED",
  "AUTO_RESOLVING",
  "WAITING",
  "RESOLVED",
];

function getTimestamp(item: OperationalIntelligenceItem) {
  const rawValue =
    item.workflowState === "RESOLVED"
      ? item.resolvedAt ?? item.lastSignalAt
      : item.lastSignalAt;
  const date = rawValue ? new Date(rawValue) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function formatTimestamp(item: OperationalIntelligenceItem) {
  const timestamp = getTimestamp(item);
  if (!timestamp) return "Live operational signal";

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActor(value: unknown) {
  const actor = String(value ?? "").trim().toUpperCase();
  if (actor === "PIN_GO") return "Pin&Go";
  if (actor === "PIN_AI") return "Pin AI";
  if (actor === "HOST") return "Host";
  if (actor === "GUEST") return "Guest";
  if (actor === "CLEANER") return "Cleaner";
  if (actor === "STAFF") return "Staff";
  if (actor === "SYSTEM") return "System";
  return "None";
}

function getNextStep(item: OperationalIntelligenceItem) {
  if (item.workflowState === "ACTION_REQUIRED") {
    return item.recommendedAction ?? item.operationalImpact ?? item.issue;
  }

  if (item.workflowState === "WAITING" || item.workflowState === "AUTO_RESOLVING") {
    return item.nextAutomaticStep ?? item.recommendedAction ?? item.issue;
  }

  return item.resolutionSummary ?? item.operationalImpact ?? item.issue;
}

function OperationalTimelineItem({
  item,
  isLast,
  onOpenReservation,
}: {
  item: OperationalIntelligenceItem;
  isLast: boolean;
  onOpenReservation?: (reservationId: string) => void;
}) {
  const presentation = statePresentation[item.workflowState];
  const reservationNumber = String(item.reservationNumber ?? "").trim();
  const canOpenReservation = Boolean(item.reservationId && onOpenReservation);

  return (
    <div style={styles.timelineRow}>
      <div style={styles.timelineRail}>
        <div
          style={{
            ...styles.timelineDot,
            color: presentation.pillColor,
            background: presentation.dotBackground,
            borderColor: presentation.pillBorder,
            boxShadow: `0 0 0 5px ${presentation.dotRing}`,
          }}
        >
          {presentation.dot}
        </div>
        {!isLast ? <div style={styles.timelineLine} /> : null}
      </div>

      <article
        style={{
          ...styles.enterpriseCard,
          background: presentation.cardBackground,
        }}
      >
        <div style={styles.cardTopRow}>
          <div>
            <div style={styles.contextRow}>
              <span style={styles.engineBadge}>{item.engine} Engine</span>
              {reservationNumber ? (
                <span style={styles.reservationNumber}>#{reservationNumber}</span>
              ) : null}
              {item.guestName ? <span style={styles.contextText}>{item.guestName}</span> : null}
            </div>
            <h4 style={styles.itemTitle}>{item.title}</h4>
          </div>

          <div
            style={{
              ...styles.statePill,
              color: presentation.pillColor,
              background: presentation.pillBackground,
              borderColor: presentation.pillBorder,
            }}
          >
            {presentation.label}
          </div>
        </div>

        <div style={styles.issue}>{item.issue}</div>

        {item.operationalImpact ? (
          <div style={styles.impactBox}>
            <span style={styles.detailLabel}>Operational impact</span>
            <span>{item.operationalImpact}</span>
          </div>
        ) : null}

        <div style={styles.nextStepBox}>
          <span style={styles.detailLabel}>{presentation.nextStepLabel}</span>
          <span>{getNextStep(item)}</span>
        </div>

        <div style={styles.cardFooter}>
          <div style={styles.footerMeta}>
            <span>
              Responsible: <strong>{formatActor(item.responsibleActor)}</strong>
            </span>
            <span aria-hidden="true">•</span>
            <span>{formatTimestamp(item)}</span>
            {item.workflowState === "WAITING" ? (
              <>
                <span aria-hidden="true">•</span>
                <strong style={{ color: "#166534" }}>No host action required</strong>
              </>
            ) : null}
          </div>

          {canOpenReservation ? (
            <button
              type="button"
              onClick={() => onOpenReservation?.(String(item.reservationId))}
              style={styles.openButton}
            >
              Open Reservation
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function OperationalIntelligencePanel({
  items,
  onOpenReservation,
}: OperationalIntelligencePanelProps) {
  const hostItems = Array.isArray(items)
    ? items.filter((item) => item.visibility === "HOST")
    : [];

  const sortedItems = [...hostItems].sort((left, right) => {
    const stateDifference =
      stateOrder.indexOf(left.workflowState) -
      stateOrder.indexOf(right.workflowState);
    return stateDifference || getTimestamp(right) - getTimestamp(left);
  });

  const counts = stateOrder.reduce<Record<OperationalWorkflowState, number>>(
    (result, state) => {
      result[state] = hostItems.filter((item) => item.workflowState === state).length;
      return result;
    },
    {
      ACTION_REQUIRED: 0,
      WAITING: 0,
      AUTO_RESOLVING: 0,
      RESOLVED: 0,
    }
  );

  const needsAttention = counts.ACTION_REQUIRED;

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Operational Command Center</div>
          <div style={styles.heading}>What needs attention right now</div>
          <div style={styles.subheading}>
            Pin&Go classifies every workflow by who must act and what happens next.
          </div>
        </div>

        <div style={styles.stats}>
          {stateOrder.map((state) => {
            const presentation = statePresentation[state];
            return (
              <div key={state} style={styles.statCard}>
                <div
                  style={{
                    ...styles.statValue,
                    color: counts[state] > 0 ? presentation.eyebrowColor : "#ffffff",
                  }}
                >
                  {counts[state]}
                </div>
                <div style={styles.statLabel}>{presentation.metricLabel}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          ...styles.trustBanner,
          color: needsAttention > 0 ? "#991b1b" : "#166534",
          background: needsAttention > 0 ? "#fef2f2" : "#f0fdf4",
          borderColor: needsAttention > 0 ? "#fecaca" : "#bbf7d0",
        }}
      >
        <strong>
          {needsAttention > 0
            ? `${needsAttention} issue${needsAttention === 1 ? "" : "s"} require host attention.`
            : "No host action is required right now."}
        </strong>
        <span>
          {needsAttention > 0
            ? "Pin&Go identified the exact operational next step below."
            : "Pin&Go is monitoring active workflows and will continue automatically."}
        </span>
      </div>

            <div style={styles.timeline}>
        {sortedItems.length > 0 ? (
          sortedItems.map((item, index) => (
            <OperationalTimelineItem
              key={`${item.issueCode}-${item.reservationNumber ?? "property"}-${index}`}
              item={item}
              isLast={index === sortedItems.length - 1}
              onOpenReservation={onOpenReservation}
            />
          ))
        ) : (
          <div style={styles.emptyState}>
            <strong>All operational workflows are clear.</strong>
            <span>
              Pin&Go has not detected any host-facing issue that requires action.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    margin: 18,
    marginTop: 0,
    padding: 0,
    borderRadius: 22,
    border: "1px solid #cbd5e1",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 18px 44px rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  header: {
    padding: 18,
    background: "linear-gradient(135deg, #020617 0%, #0f172a 58%, #1e293b 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#93c5fd",
  },
  heading: {
    marginTop: 7,
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "#ffffff",
  },
  subheading: {
    marginTop: 7,
    maxWidth: 590,
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 750,
    color: "#cbd5e1",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(96px, 1fr))",
    gap: 8,
    minWidth: 430,
  },
  statCard: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },
  statValue: {
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 950,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 9,
    lineHeight: 1.2,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#cbd5e1",
  },
  trustBanner: {
    margin: 18,
    marginBottom: 0,
    padding: "11px 13px",
    border: "1px solid",
    borderRadius: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 12,
    lineHeight: 1.4,
  },
  timeline: {
    padding: 18,
    display: "grid",
    gap: 0,
  },
 emptyState: {
    display: "grid",
    gap: 5,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 12,
    lineHeight: 1.4,
  },
  timelineRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr)",
    gap: 12,
  },
  timelineRail: {
    display: "grid",
    justifyItems: "center",
    gridTemplateRows: "28px 1fr",
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid",
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    fontWeight: 950,
  },
  timelineLine: {
    width: 2,
    minHeight: 18,
    background: "#e2e8f0",
  },
  enterpriseCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },
  cardTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  contextRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  engineBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  reservationNumber: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 950,
  },
  contextText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 850,
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },
  itemTitle: {
    margin: "9px 0 0",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },
  issue: {
    marginTop: 9,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 780,
  },
  impactBox: {
    marginTop: 11,
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "rgba(255,255,255,0.82)",
    color: "#475569",
    display: "grid",
    gap: 4,
    fontSize: 12,
    lineHeight: 1.4,
  },
  nextStepBox: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    display: "grid",
    gap: 4,
    fontSize: 12,
    lineHeight: 1.4,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  footerMeta: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  openButton: {
    minHeight: 36,
    padding: "0 13px",
    borderRadius: 10,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
};