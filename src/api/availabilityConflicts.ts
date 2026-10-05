import { loginPathForSessionError } from "../auth/sessionExpiry";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
export type ConflictCause = { type: string; label: string; startsAt: string | null; endsAt: string | null;
  blockReason: string | null; reservation: { id: string; reservationNumber: string | null; guestName: string | null } | null };
export type ConflictReview = { ok: true; reservation: { id: string; reservationNumber: string | null;
  property: { name: string; timezone: string }; checkIn: string; checkOut: string };
  items: { id: string; updatedAt: string; state: string; detectedAt: string; incomingStartsAt: string | null; incomingEndsAt: string | null; detectedCause: ConflictCause;
    resolutionSummary: string | null; resolvedAt: string | null;
    history: { state: string; summary: string; actor: string; at: string }[] }[];
  currentAvailability: { available: boolean; cause: ConflictCause | null } | null; hasMore: boolean };
export class ConflictReviewApiError extends Error {
  readonly status: number;
  constructor(status: number) { super("CONFLICT_REVIEW_UNAVAILABLE"); this.status = status; }
}
async function request(path: string, init: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json" } });
  const data = await response.json().catch(() => null);
  if (response.status === 401) window.location.href = loginPathForSessionError(data?.error) ?? "/login";
  if (!response.ok || data?.ok !== true) throw new ConflictReviewApiError(response.status);
  return data;
}
export async function getAvailabilityConflicts(reservationId: string, signal?: AbortSignal): Promise<ConflictReview> {
  const data = await request(`/api/dashboard/reservations/${encodeURIComponent(reservationId)}/availability-conflicts`, { method: "GET", signal });
  if (data.reservation?.id !== reservationId || !Array.isArray(data.items) ||
      data.items.some((item: ConflictReview["items"][number]) => !item.id || !item.updatedAt || !item.detectedCause || !Array.isArray(item.history))) {
    throw new ConflictReviewApiError(502);
  }
  return data;
}
export async function resolveAvailabilityConflict(issueId: string, expectedUpdatedAt: string, resolutionSummary: string) {
  const result = await request(`/api/dashboard/availability-conflicts/${encodeURIComponent(issueId)}/resolve`, {
    method: "POST", body: JSON.stringify({ expectedUpdatedAt, resolutionSummary }),
  });
  if (result.state !== "RESOLVED") throw new ConflictReviewApiError(502);
  return result;
}
