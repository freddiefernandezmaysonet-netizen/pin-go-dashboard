const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type DistributionRuntimeState = {
  distributionEnabled: boolean;
  distributionStatus: string;
};

export type DistributionFullSyncResult = {
  queued: true;
  syncMode: "FULL";
  correlationId: string;
  requestedAt: string;
  messageKinds: ["AVAILABILITY", "RATES_RESTRICTIONS"];
};

export class DistributionFullSyncApiError extends Error {
  constructor(
    readonly status: number,
    readonly providerMessage: string
  ) {
    super(providerMessage);
    this.name = "DistributionFullSyncApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePropertyId(propertyId: string): string {
  const id = String(propertyId ?? "").trim();
  if (!id) throw new Error("DISTRIBUTION_FULL_SYNC_PROPERTY_REQUIRED");
  return id;
}

export async function getDistributionRuntimeState(
  propertyId: string
): Promise<DistributionRuntimeState> {
  const id = requirePropertyId(propertyId);
  const response = await fetch(
    `${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}`,
    { credentials: "include", cache: "no-store" }
  );
  const payload: unknown = await response.json().catch(() => null);
  const item = isRecord(payload) && isRecord(payload.item) ? payload.item : null;

  if (
    !response.ok ||
    !item ||
    typeof item.distributionEnabled !== "boolean" ||
    typeof item.distributionStatus !== "string"
  ) {
    throw new DistributionFullSyncApiError(
      response.status,
      "DISTRIBUTION_RUNTIME_STATE_UNAVAILABLE"
    );
  }

  return {
    distributionEnabled: item.distributionEnabled,
    distributionStatus: item.distributionStatus,
  };
}

function parseFullSyncResult(payload: unknown): DistributionFullSyncResult {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result)) {
    throw new Error("INVALID_DISTRIBUTION_FULL_SYNC_RESPONSE");
  }

  const result = payload.result;
  const messageKinds = result.messageKinds;
  if (
    result.queued !== true ||
    result.syncMode !== "FULL" ||
    typeof result.correlationId !== "string" ||
    !result.correlationId.trim() ||
    typeof result.requestedAt !== "string" ||
    !result.requestedAt.trim() ||
    !Array.isArray(messageKinds) ||
    messageKinds.length !== 2 ||
    messageKinds[0] !== "AVAILABILITY" ||
    messageKinds[1] !== "RATES_RESTRICTIONS"
  ) {
    throw new Error("INVALID_DISTRIBUTION_FULL_SYNC_RESPONSE");
  }

  return {
    queued: true,
    syncMode: "FULL",
    correlationId: result.correlationId,
    requestedAt: result.requestedAt,
    messageKinds: ["AVAILABILITY", "RATES_RESTRICTIONS"],
  };
}

export async function requestDistributionFullSync(
  propertyId: string
): Promise<DistributionFullSyncResult> {
  const id = requirePropertyId(propertyId);
  const response = await fetch(
    `${API_BASE}/api/dashboard/properties/${encodeURIComponent(id)}/channex/sync-availability`,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }
  );

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "DISTRIBUTION_FULL_SYNC_REQUEST_FAILED";
    throw new DistributionFullSyncApiError(response.status, message);
  }

  try {
    return parseFullSyncResult(payload);
  } catch {
    throw new DistributionFullSyncApiError(
      response.status,
      "INVALID_DISTRIBUTION_FULL_SYNC_RESPONSE"
    );
  }
}
