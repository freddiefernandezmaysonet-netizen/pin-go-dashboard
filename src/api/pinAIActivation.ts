import { loginPathForSessionError } from "../auth/sessionExpiry";
const base = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
export type PinAIPropertySettings = { propertyId: string; name: string; enabled: boolean; revision: number;
  billing: { version: string; amountCents: number; currency: string; acceptedVersion: string | null;
    acceptedAt: string | null; collectionReady: boolean };
  organization: { enabled: boolean; revision: number };
  state: "EXISTING_SCOPE" | "DISABLED" | "ENABLED" | "PENDING_ACTIVATION" };
export type PinAIOrganization = { id: string; name: string; pinAIEnabled: boolean; pinAIRevision: number };
export type PinAIFeeOverview = { currency: "USD"; serviceReviews: number; totals: { status: string; count: number; amountCents: number }[];
  recent: { reservationId: string; reservationNumber: string | null; propertyName: string; amountCents: number;
    status: string; recordedAt: string }[] };
export class PinAIActivationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (response.status === 401) window.location.href = loginPathForSessionError(body?.error) ?? "/login";
  if (!response.ok || body?.ok !== true) throw new PinAIActivationError(response.status, body?.error ?? "UNAVAILABLE");
  return body;
}
const propertyPath = (id: string) => `/api/dashboard/properties/${encodeURIComponent(id)}/pin-ai-settings`;
export const getPinAIFeeOverview = (signal?: AbortSignal) => request<PinAIFeeOverview>("/api/dashboard/pin-ai/billing", { signal });
export const getPinAIProperty = (id: string, signal?: AbortSignal) => request<PinAIPropertySettings>(propertyPath(id), { signal });
export const setPinAIProperty = (view: PinAIPropertySettings, enabled: boolean) => request<PinAIPropertySettings>(propertyPath(view.propertyId), {
  method: "PUT", body: JSON.stringify({ enabled, expectedRevision: view.revision, organizationRevision: view.organization.revision,
    ...(enabled && (view.billing.acceptedVersion !== view.billing.version || !view.billing.acceptedAt)
      ? { acceptedTermsVersion: view.billing.version } : {}) }),
});
export const listPinAIOrganizations = (query: string, signal?: AbortSignal) =>
  request<{ items: PinAIOrganization[]; rolloutActive: boolean }>(`/api/internal/pin-ai/organizations?q=${encodeURIComponent(query)}`, { signal });
export const setPinAIOrganization = (row: PinAIOrganization) => request(`/api/internal/pin-ai/organizations/${encodeURIComponent(row.id)}`, {
  method: "PUT", body: JSON.stringify({ enabled: !row.pinAIEnabled, expectedRevision: row.pinAIRevision }),
});
