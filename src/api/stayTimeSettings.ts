import { loginPathForSessionError } from "../auth/sessionExpiry";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
export type StayTimeRule = {
  enabled: boolean;
  limitLocalTime: string;
  fee: { mode: "FREE" | "FIXED" | "PER_HOUR"; amountMinor: number; currency: "USD" };
};
export type StayTimeSettings = { earlyCheckin: StayTimeRule; lateCheckout: StayTimeRule };
export type StayTimeSettingsResponse = {
  ok: true; propertyId: string; revision: number; settings: StayTimeSettings;
  timezone: string | null; checkInTime: string; checkOutTime: string;
  currency: "USD"; executionAvailable: boolean;
};
export class StayTimeSettingsApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
async function request(propertyId: string, init: RequestInit): Promise<StayTimeSettingsResponse> {
  const response = await fetch(`${API_BASE}/api/dashboard/properties/${encodeURIComponent(propertyId)}/stay-time-settings`, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401) window.location.href = loginPathForSessionError(data?.error) ?? "/login";
  if (!response.ok || data?.ok !== true) throw new StayTimeSettingsApiError(response.status, data?.error ?? "STAY_TIME_SETTINGS_UNAVAILABLE");
  if (data.propertyId !== propertyId || !Number.isInteger(data.revision) || data.revision < 0 ||
      !data.settings?.earlyCheckin || !data.settings?.lateCheckout || data.currency !== "USD") {
    throw new StayTimeSettingsApiError(502, "STAY_TIME_SETTINGS_UNAVAILABLE");
  }
  return data;
}
export function getStayTimeSettings(propertyId: string, signal?: AbortSignal) {
  return request(propertyId, { method: "GET", signal });
}
export function saveStayTimeSettings(propertyId: string, expectedRevision: number, settings: StayTimeSettings, signal?: AbortSignal) {
  return request(propertyId, { method: "PUT", body: JSON.stringify({ expectedRevision, settings }), signal });
}
