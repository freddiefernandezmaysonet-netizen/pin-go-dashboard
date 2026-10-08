const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:3000" : "");
export type CleanerProfile = { id: string; fullName: string; preferredLanguage: "es" | "en" };
export type CleanerTask = {
  id: string; property: { id: string; name: string; timezone: string }; status: string; departureAt: string;
  scheduledStartAt: string | null; durationCommitmentMinutes: number | null;
  startedAt: string | null; completedAt: string | null;
  access: { startsAt: string; endsAt: string; status: string } | null;
};
export async function cleanerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", "X-Pin-Go-Brand-Hostname": window.location.hostname } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "CLEANER_REQUEST_FAILED");
  return data as T;
}
export const fetchCleanerProfile = () => cleanerRequest<CleanerProfile>("/api/cleaner/me");
export type CleanerTaskView = "today" | "upcoming" | "history" | "overdue" | "all";
export const fetchCleanerTaskProperties = () => cleanerRequest<{ items: { id: string; name: string }[] }>("/api/cleaner/cleaning-properties");
export type CleanerTaskFilters = { propertyId: string; status: string; from: string; to: string };
export const fetchCleanerTasks = (cursor?: string | null, view: CleanerTaskView = "today", filters?: CleanerTaskFilters) => {
  const params = new URLSearchParams({ view });
  if (cursor) params.set("cursor", cursor);
  for (const [key, value] of Object.entries(filters ?? {})) if (value) params.set(key, value);
  return cleanerRequest<{ items: CleanerTask[]; nextCursor: string | null }>(`/api/cleaner/cleanings?${params}`);
};
export const updateCleanerLanguage = (language: "es" | "en") => cleanerRequest<CleanerProfile>("/api/cleaner/me/language", { method: "PATCH", body: JSON.stringify({ language }) });
export async function openCleanerTask(id: string) {
  const detail = await cleanerRequest<{ portalPath: string }>(`/api/cleaner/cleanings/${encodeURIComponent(id)}`);
  if (!/^\/cleaning\/confirm\/[^/?#]+$/.test(detail.portalPath)) throw new Error("CLEANING_NOT_AVAILABLE");
  window.location.assign(`${API_BASE}${detail.portalPath}`);
}
export const requestCleanerAccount = (staffId: string, email: string) => cleanerRequest<{ status: string }>(`/api/staff/${encodeURIComponent(staffId)}/cleaner-account`, { method: "POST", body: JSON.stringify({ email }) });

export const cancelCleanerTask = (id: string) => cleanerRequest(`/api/cleaner/cleanings/${encodeURIComponent(id)}/cancel`, { method: "POST" });

export type CleaningIssueKind = "DELAY" | "MORE_TIME" | "INCOMPLETE";
export type CleaningIssueReport = { id: string; kind: CleaningIssueKind; reason: string; estimatedAt: string | null; reportedAt: string };
export type CleaningIssueInput = { requestId: string; kind: CleaningIssueKind; reason: string; estimatedAt: string | null };
export type CleaningIssueAssessment = { decision: string; reason: string; estimatedFinishAt: string | null; proposedAccessEnd: string | null; actionsExecuted: boolean; accessChanged: boolean };
export const fetchCleaningIssues = (id: string) => cleanerRequest<{ reports: CleaningIssueReport[]; assessment: CleaningIssueAssessment | null; canReport: boolean; recoveryOutcome: { state: string } | null }>(`/api/cleaner/cleanings/${encodeURIComponent(id)}/issues`);
export const reportCleaningIssue = (id: string, input: CleaningIssueInput) => cleanerRequest<{ report: CleaningIssueReport; recoveryStatus: "RECORDED" }>(`/api/cleaner/cleanings/${encodeURIComponent(id)}/issues`, { method: "POST", body: JSON.stringify(input) });
