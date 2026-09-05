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
