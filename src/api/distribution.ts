import { isAllowedDistributionFrameUrl } from "../lib/distributionFramePolicy";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export const DISTRIBUTION_PROVIDERS = [
  "AIRBNB",
  "BOOKING_COM",
  "EXPEDIA",
  "VRBO",
] as const;
export const DISTRIBUTION_AVAILABILITY = [
  "AVAILABLE",
  "PLANNED",
  "ASSISTED_BETA",
] as const;
export const DISTRIBUTION_CHANNEL_STATUSES = [
  "NOT_CONNECTED",
  "AUTHORIZATION_REQUIRED",
  "MAPPING_REQUIRED",
  "READINESS_CHECK",
  "ACTIVATION_PENDING",
  "ACTIVE",
  "DEGRADED",
  "FAILED",
  "DISCONNECTING",
  "DISCONNECTED",
] as const;
export const DISTRIBUTION_READINESS_STATUSES = [
  "NOT_STARTED",
  "REQUIRED",
  "IN_PROGRESS",
  "READY",
  "BLOCKED",
  "NOT_APPLICABLE",
] as const;
export const DISTRIBUTION_NEXT_ACTIONS = [
  "CONNECT",
  "AUTHORIZE",
  "COMPLETE_MAPPING",
  "WAITING",
  "MANAGE",
  "REPAIR",
] as const;

type ValueOf<T extends readonly string[]> = T[number];
export type DistributionProvider = ValueOf<typeof DISTRIBUTION_PROVIDERS>;
export type DistributionAvailability = ValueOf<typeof DISTRIBUTION_AVAILABILITY>;
export type DistributionChannelStatus = ValueOf<
  typeof DISTRIBUTION_CHANNEL_STATUSES
>;
export type DistributionReadinessStatus = ValueOf<
  typeof DISTRIBUTION_READINESS_STATUSES
>;
export type DistributionNextAction = ValueOf<typeof DISTRIBUTION_NEXT_ACTIONS>;

export type DistributionConnectionCenter = {
  productName: "Distribution by Pin&Go";
  property: { id: string; name: string };
  status:
    | "NOT_CONFIGURED"
    | "SETUP_REQUIRED"
    | "ACTIVATION_PENDING"
    | "ACTIVE"
    | "DEGRADED"
    | "FAILED";
  provisioningStatus: "NOT_PROVISIONED" | "PROVISIONING" | "READY" | "FAILED";
  channels: Array<{
    provider: DistributionProvider;
    name: string;
    availability: DistributionAvailability;
    status: DistributionChannelStatus;
    nextAction: DistributionNextAction;
    readiness: {
      authorization: DistributionReadinessStatus;
      mapping: DistributionReadinessStatus;
      distribution: DistributionReadinessStatus;
      payment: DistributionReadinessStatus;
      tax: DistributionReadinessStatus;
      content: DistributionReadinessStatus;
    };
    lastReadinessCheckedAt: string | null;
    lastFullSyncConfirmedAt: string | null;
    activatedAt: string | null;
    attentionCode: string | null;
  }>;
};

export type DistributionConnectionSession = {
  sessionId: string;
  launchUrl: string;
  expiresAt: string;
};

export class DistributionApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "DistributionApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMember<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const PROPERTY_STATUSES = [
  "NOT_CONFIGURED",
  "SETUP_REQUIRED",
  "ACTIVATION_PENDING",
  "ACTIVE",
  "DEGRADED",
  "FAILED",
] as const;
const PROVISIONING_STATUSES = [
  "NOT_PROVISIONED",
  "PROVISIONING",
  "READY",
  "FAILED",
] as const;

export function parseDistributionConnectionCenter(
  payload: unknown
): DistributionConnectionCenter {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.connectionCenter)) {
    throw new Error("INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE");
  }

  const center = payload.connectionCenter;
  const property = center.property;
  if (
    center.productName !== "Distribution by Pin&Go" ||
    !isRecord(property) ||
    typeof property.id !== "string" ||
    typeof property.name !== "string" ||
    !isMember(PROPERTY_STATUSES, center.status) ||
    !isMember(PROVISIONING_STATUSES, center.provisioningStatus) ||
    !Array.isArray(center.channels)
  ) {
    throw new Error("INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE");
  }

  for (const channel of center.channels) {
    if (
      !isRecord(channel) ||
      !isMember(DISTRIBUTION_PROVIDERS, channel.provider) ||
      typeof channel.name !== "string" ||
      !isMember(DISTRIBUTION_AVAILABILITY, channel.availability) ||
      !isMember(DISTRIBUTION_CHANNEL_STATUSES, channel.status) ||
      !isMember(DISTRIBUTION_NEXT_ACTIONS, channel.nextAction) ||
      !isRecord(channel.readiness) ||
      !Object.values(channel.readiness).every((value) =>
        isMember(DISTRIBUTION_READINESS_STATUSES, value)
      ) ||
      !isNullableString(channel.lastReadinessCheckedAt) ||
      !isNullableString(channel.lastFullSyncConfirmedAt) ||
      !isNullableString(channel.activatedAt) ||
      !isNullableString(channel.attentionCode)
    ) {
      throw new Error("INVALID_DISTRIBUTION_CONNECTION_CENTER_RESPONSE");
    }
  }

  return center as DistributionConnectionCenter;
}

export async function getDistributionConnectionCenter(propertyId: string) {
  const response = await fetch(
    `${API_BASE}/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}`,
    { credentials: "include", cache: "no-store" }
  );

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("DISTRIBUTION_CONNECTION_CENTER_FETCH_FAILED");
  }

  return parseDistributionConnectionCenter(payload);
}

function createIdempotencyKey(action: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `ota.${action}:${random}`.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 120);
}

async function postDistribution(path: string, action: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": createIdempotencyKey(action),
    },
    body: "{}",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : "DISTRIBUTION_REQUEST_FAILED";
    throw new DistributionApiError(code, response.status);
  }
  return payload;
}

export async function prepareDistributionChannel(
  propertyId: string,
  provider: "AIRBNB" | "BOOKING_COM"
): Promise<"READY"> {
  const payload = await postDistribution(
    `/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/${encodeURIComponent(provider)}/prepare`,
    "prepare"
  );
  if (!isRecord(payload) || payload.ok !== true || payload.provisioningStatus !== "READY") {
    throw new Error("INVALID_DISTRIBUTION_PREPARE_RESPONSE");
  }
  return "READY";
}

export async function issueDistributionConnectionSession(
  propertyId: string,
  provider: "AIRBNB" | "BOOKING_COM"
): Promise<DistributionConnectionSession> {
  const payload = await postDistribution(
    `/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/${encodeURIComponent(provider)}/session`,
    "session"
  );
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.session)) {
    throw new Error("INVALID_DISTRIBUTION_SESSION_RESPONSE");
  }
  const session = payload.session;
  if (
    typeof session.sessionId !== "string" ||
    typeof session.launchUrl !== "string" ||
    typeof session.expiresAt !== "string"
  ) {
    throw new Error("INVALID_DISTRIBUTION_SESSION_RESPONSE");
  }
  if (!isAllowedDistributionFrameUrl(session.launchUrl)) {
    throw new Error("INVALID_DISTRIBUTION_SESSION_RESPONSE");
  }
  return session as DistributionConnectionSession;
}

export async function transitionDistributionConnectionSession(
  sessionId: string,
  event: "opened" | "completed" | "cancelled"
): Promise<void> {
  const payload = await postDistribution(
    `/api/dashboard/distribution/sessions/${encodeURIComponent(sessionId)}/${event}`,
    `session-${event}`
  );
  if (!isRecord(payload) || payload.ok !== true) {
    throw new Error("INVALID_DISTRIBUTION_TRANSITION_RESPONSE");
  }
}
