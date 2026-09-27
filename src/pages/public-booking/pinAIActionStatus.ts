export type PinAIActionStatus = Readonly<{
  proposalId: string;
  proposalStatus: string;
  modificationId: string | null;
  modificationStatus: string | null;
  paymentStatus: string | null;
  paymentExpiresAt: string | null;
  appliedAt: string | null;
  checkedAt: string;
}>;

const statuses = new Set(["AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED", "HOST_APPROVAL_REQUIRED", "APPLYING", "APPLIED", "EXPIRED", "CANCELLED"]);

export async function readPinAIActionStatus(apiBase: string, guestToken: string, proposalId: string, signal: AbortSignal): Promise<PinAIActionStatus> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timeout = window.setTimeout(abort, 10_000);
  try {
  const response = await fetch(`${apiBase}/api/public-booking/manage/${encodeURIComponent(guestToken)}/pin-ai/action-proposals/${encodeURIComponent(proposalId)}/status`, {
    method: "GET", cache: "no-store", signal: controller.signal,
  });
  const payload = await response.json();
  const s = payload?.status;
  const optionalDate = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  if (!response.ok || payload?.ok !== true || !s || s.proposalId !== proposalId ||
      typeof s.proposalStatus !== "string" ||
      !(s.modificationId === null || typeof s.modificationId === "string") ||
      !(s.modificationStatus === null || statuses.has(s.modificationStatus)) ||
      !(s.paymentStatus === null || typeof s.paymentStatus === "string") ||
      !optionalDate(s.paymentExpiresAt) || !optionalDate(s.appliedAt) ||
      typeof s.checkedAt !== "string" || !Number.isFinite(Date.parse(s.checkedAt))) {
    throw new Error("ACTION_STATUS_UNAVAILABLE");
  }
  return s;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
