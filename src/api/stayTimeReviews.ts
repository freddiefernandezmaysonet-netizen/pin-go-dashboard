export type StayTimeReviewItem = {
  id: string; updatedAt: string; state: string; detectedAt: string; organization: string; property: string;
  timezone: string | null; reservationNumber: string | null; operation: string; modificationStatus: string;
  paymentEvidence: "PAID" | "REFUNDED" | "UNPAID" | "UNVERIFIED"; additionalChargeAmount: string; currency: string;
  attempts: number; nextAttemptAt: string | null; reconciliationCompleted: boolean; physicalAccessCertified: false;
};
export type StayTimeReviewDetail = { item: StayTimeReviewItem;
  history: Array<{ id: string; at: string; kind: string; note: string | null; state: string }>; historyHasMore: boolean };
export type StayTimeReviewCommand = { requestId: string; expectedUpdatedAt: string; note: string };
export class StayTimeReviewApiError extends Error {
  readonly status: number;
  constructor(status: number) { super("Recovery review request failed"); this.status = status; }
}
export function createStayTimeReviewApi(base: string) {
  const root = `${base.replace(/\/$/, "")}/api/internal/stay-time-recovery`;
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(root + path, { ...init, credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.ok !== true) throw new StayTimeReviewApiError(res.status);
    return body;
  }
  return {
    list: (state: "OPEN" | "RESOLVED", after: string | null, signal: AbortSignal) =>
      request<{ items: StayTimeReviewItem[]; nextCursor: string | null }>(`?state=${state}${after ? `&after=${encodeURIComponent(after)}` : ""}`, { signal }),
    read: (id: string, signal: AbortSignal) => request<StayTimeReviewDetail>(`/${encodeURIComponent(id)}`, { signal }),
    review: (id: string, command: StayTimeReviewCommand, signal: AbortSignal) =>
      request<{ recorded: true; replayed: boolean; resolved: false }>(`/${encodeURIComponent(id)}/reviews`,
        { method: "POST", signal, body: JSON.stringify(command) }),
  };
}
export type StayTimeReviewApi = ReturnType<typeof createStayTimeReviewApi>;
