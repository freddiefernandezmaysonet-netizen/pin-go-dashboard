#!/usr/bin/env python3
from pathlib import Path
import sys


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 base snippet, found {count}")
    return text.replace(old, new, 1)

def transform_property_calendar(text: str) -> str:
    text = replace_once(
        text,
        '''import {
  getVisibleReservationSourceLabel,
  sanitizeWhiteLabelText,
} from "../../lib/whiteLabel";''',
        '''import {
  getVisibleReservationSourceLabel,
  sanitizeWhiteLabelText,
} from "../../lib/whiteLabel";
import {
  getLiveMissionControlMetric,
  getMissionControlDisplayStatus,
} from "../../lib/apmsMissionControlPresentation.js";''',
        "PropertyCalendar Mission Control helper import",
    )

    text = replace_once(
        text,
        '''const missionControlStatus =
  missionControlSnapshot?.autopilotStatus ?? "ACTIVE";''',
        '''const hasLiveMissionControlSnapshot = Boolean(missionControlSnapshot);

const missionControlStatus = getMissionControlDisplayStatus({
  loading,
  snapshot: missionControlSnapshot,
});''',
        "PropertyCalendar fail-open status",
    )

    text = replace_once(
        text,
        '''const missionControlEngineCards =
  missionControlEngineHealth.length > 0
    ? [...missionControlEngineHealth].sort(
        (engineA: any, engineB: any) =>
          getMissionEngineSortValue(engineA.engine) -
          getMissionEngineSortValue(engineB.engine)
      )
    : [
        {
          engine: "Revenue",
          status: "PENDING",
          message: "Waiting for revenue engine activity.",
        },
        {
          engine: "Reservation",
          status: "PENDING",
          message: "Waiting for reservation autopilot activity.",
        },
      ];''',
        '''const missionControlEngineCards = [...missionControlEngineHealth].sort(
  (engineA: any, engineB: any) =>
    getMissionEngineSortValue(engineA.engine) -
    getMissionEngineSortValue(engineB.engine)
);''',
        "PropertyCalendar fabricated engine fallback",
    )

    text = replace_once(
        text,
        '''const autonomyScore = Number(
  missionControlSnapshot?.autonomyScore?.score ?? 100
);

const interventionsAvoided = Number(
  missionControlSnapshot?.freedomMetrics?.interventionsAvoided ?? 0
);

const autonomousDecisions = Number(
  missionControlSnapshot?.freedomMetrics?.autonomousDecisions ?? 0
);''',
        '''const autonomyScore = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["autonomyScore", "score"]
);

const interventionsAvoided = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["freedomMetrics", "interventionsAvoided"]
);

const autonomousDecisions = getLiveMissionControlMetric(
  missionControlSnapshot,
  ["freedomMetrics", "autonomousDecisions"]
);''',
        "PropertyCalendar fabricated autonomy metrics",
    )

    text = replace_once(
        text,
        '''function formatAutopilotStatus(status: string) {
  if (status === "ACTIVE") return "Auto Pilot Active";
  if (status === "NEEDS_ATTENTION") return "Needs Attention";
  if (status === "PAUSED") return "Auto Pilot Paused";
  if (status === "ERROR") return "Auto Pilot Error";

  return "Auto Pilot";
}''',
        '''function formatAutopilotStatus(status: string) {
  if (status === "ACTIVE") return "Auto Pilot Active";
  if (status === "NEEDS_ATTENTION") return "Needs Attention";
  if (status === "PAUSED") return "Auto Pilot Paused";
  if (status === "ERROR") return "Auto Pilot Error";
  if (status === "LOADING") return "Auto Pilot Checking";
  if (status === "UNAVAILABLE" || status === "UNKNOWN") {
    return "Auto Pilot Unavailable";
  }

  return "Auto Pilot Unavailable";
}''',
        "PropertyCalendar unavailable label",
    )

    text = replace_once(
        text,
        '''function getAutopilotPillStyle(status: string): CSSProperties {
  if (status === "ERROR") {''',
        '''function getAutopilotPillStyle(status: string): CSSProperties {
  if (
    status === "LOADING" ||
    status === "UNAVAILABLE" ||
    status === "UNKNOWN"
  ) {
    return {
      ...styles.autoPilotPill,
      background: "#475569",
    };
  }

  if (status === "ERROR") {''',
        "PropertyCalendar unavailable style",
    )

    text = replace_once(
        text,
        '''      <div style={styles.missionGeneratedLabel}>
        {missionControlSnapshot ? "Live snapshot" : "Waiting for snapshot"}
      </div>''',
        '''      <div style={styles.missionGeneratedLabel}>
        {loading
          ? "Verifying live snapshot"
          : hasLiveMissionControlSnapshot
          ? "Live snapshot"
          : "Live snapshot unavailable"}
      </div>''',
        "PropertyCalendar live snapshot label",
    )

    text = replace_once(
        text,
        '''  <div style={styles.missionHeroGrid}>
    <div style={styles.missionHeroCard}>''',
        '''  {!hasLiveMissionControlSnapshot && !loading ? (
    <div style={styles.missionUnavailableState}>
      <strong>Mission Control live state is unavailable.</strong>
      <span>
        Pin&Go cannot prove current APMS health for this property, so no ACTIVE
        status or autonomy metrics are being inferred.
      </span>
    </div>
  ) : null}

  <div style={styles.missionHeroGrid}>
    <div style={styles.missionHeroCard}>''',
        "PropertyCalendar unavailable trust banner",
    )

    text = replace_once(
        text,
        '''      <div style={styles.missionHeroValue}>{autonomyScore}%</div>''',
        '''      <div style={styles.missionHeroValue}>
        {autonomyScore === null ? "—" : `${autonomyScore}%`}
      </div>''',
        "PropertyCalendar autonomy score display",
    )

    text = replace_once(
        text,
        '''            width: `${Math.min(Math.max(autonomyScore, 0), 100)}%`,''',
        '''            width: `${
              autonomyScore === null
                ? 0
                : Math.min(Math.max(autonomyScore, 0), 100)
            }%`,''',
        "PropertyCalendar autonomy progress",
    )

    text = replace_once(
        text,
        '''      <div style={styles.missionHeroValue}>{interventionsAvoided}</div>''',
        '''      <div style={styles.missionHeroValue}>
        {interventionsAvoided === null ? "—" : interventionsAvoided}
      </div>''',
        "PropertyCalendar interventions display",
    )

    text = replace_once(
        text,
        '''      <div style={styles.missionHeroValue}>{autonomousDecisions}</div>''',
        '''      <div style={styles.missionHeroValue}>
        {autonomousDecisions === null ? "—" : autonomousDecisions}
      </div>''',
        "PropertyCalendar decisions display",
    )

    text = replace_once(
        text,
        '''        {missionControlEngineHealth.length}''',
        '''        {hasLiveMissionControlSnapshot ? missionControlEngineHealth.length : "—"}''',
        "PropertyCalendar engines online display",
    )

    text = replace_once(
        text,
        '''        <div style={styles.missionEngineGrid}>
      {missionControlEngineCards.map((engineHealth: any) => (''',
        '''        <div style={styles.missionEngineGrid}>
      {!hasLiveMissionControlSnapshot ? (
        <div style={styles.missionEngineUnavailable}>
          Engine health is unavailable until Mission Control returns a live snapshot.
        </div>
      ) : missionControlEngineCards.map((engineHealth: any) => (''',
        "PropertyCalendar engine unavailable state",
    )

    text = replace_once(
        text,
        '''missionHeroGrid: {
  padding: 18,''',
        '''missionUnavailableState: {
  margin: 18,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  display: "grid",
  gap: 6,
  fontSize: 12,
  lineHeight: 1.45,
},

missionEngineUnavailable: {
  padding: 16,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
},

missionHeroGrid: {
  padding: 18,''',
        "PropertyCalendar unavailable styles",
    )

    return text


def main() -> int:
    path = Path("src/pages/properties/PropertyCalendarPage.tsx")
    try:
        before = path.read_text(encoding="utf-8")
        after = transform_property_calendar(before)
        if before == after:
            raise RuntimeError("PropertyCalendarPage: no change produced")
        path.write_text(after, encoding="utf-8")
        print("UPDATED", path)
        return 0
    except Exception as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
