import type { CleanerTask } from "../../api/cleaner";

export const CLOSED_CLEANER_TASKS = new Set(["COMPLETED", "CANCELLED", "REASSIGNED", "EXPIRED", "DECLINED"]);
export function belongsToCleanerView(task: CleanerTask, view: "today" | "upcoming" | "history", now: Date): boolean {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: task.property.timezone,
    year: "numeric", month: "2-digit", day: "2-digit" });
  const day = formatter.format(new Date(task.scheduledStartAt ?? task.departureAt));
  const today = formatter.format(now);
  const closed = CLOSED_CLEANER_TASKS.has(task.status);
  if (view === "today") return day === today || (day < today && !closed);
  if (view === "upcoming") return day > today && !closed;
  return closed;
}
