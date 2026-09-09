const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export class AirbnbHostSelfServiceApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "AirbnbHostSelfServiceApiError";
  }
}

export type AirbnbHostConnectionLink = {
  authorizationUrl: string;
  expiresAt: string;
};

export type AirbnbHostCallbackResult = {
  success: boolean;
  propertyId: string | null;
  channelId: string | null;
  channelActive: boolean | null;
  airbnbAccountVerified: false;
  nextAction: "RETRY_AUTHORIZATION" | "LISTING_DISCOVERY_REQUIRED";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idempotencyKey(action: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `ota.airbnb.${action}:${random}`
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 120);
}

async function post(path: string, action: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(action),
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : "OTA_AIRBNB_HOST_SELF_SERVICE_REQUEST_FAILED";
    throw new AirbnbHostSelfServiceApiError(code, response.status);
  }
  return payload;
}

function safeAuthorizationUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("invalid");
    }
    // The backend relays Channex's authorization URL, not its API origin.
    // Preserve it exactly for the existing top-level navigation.
    return value;
  } catch {
    throw new Error("INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  }
}

export async function issueAirbnbHostConnectionLink(
  propertyId: string
): Promise<AirbnbHostConnectionLink> {
  const payload = await post(
    `/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/AIRBNB/connection-link`,
    "connection-link",
    {}
  );
  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new Error("INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  }
  return {
    authorizationUrl: safeAuthorizationUrl(payload.authorizationUrl),
    expiresAt: payload.expiresAt,
  };
}

export async function verifyAirbnbHostCallback(args: {
  success: string;
  channelId: string | null;
  token: string;
}): Promise<AirbnbHostCallbackResult> {
  const payload = await post(
    "/api/dashboard/distribution/airbnb/callback/verify",
    "callback-verify",
    {
      success: args.success,
      channelId: args.channelId,
      token: args.token,
    }
  );
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result)) {
    throw new Error("INVALID_AIRBNB_CALLBACK_VERIFICATION_RESPONSE");
  }
  const result = payload.result;
  if (
    typeof result.success !== "boolean" ||
    !(result.propertyId === null || typeof result.propertyId === "string") ||
    !(result.channelId === null || typeof result.channelId === "string") ||
    !(result.channelActive === null || typeof result.channelActive === "boolean") ||
    result.airbnbAccountVerified !== false ||
    (result.success
      ? result.nextAction !== "LISTING_DISCOVERY_REQUIRED" ||
        typeof result.propertyId !== "string" || !result.propertyId ||
        typeof result.channelId !== "string" || !result.channelId
      : result.nextAction !== "RETRY_AUTHORIZATION" ||
        result.propertyId !== null || result.channelId !== null || result.channelActive !== null)
  ) {
    throw new Error("INVALID_AIRBNB_CALLBACK_VERIFICATION_RESPONSE");
  }
  return result as AirbnbHostCallbackResult;
}

// Internal read-phase DTO. The marker records a valid Airbnb-specific listings
// response; it is not proof of the host's identity, mapping or activation.
export type AirbnbHostListingSummary = { id: string; title: string };
export type AirbnbHostListingsResult = {
  propertyId: string;
  channelId: string;
  airbnbAccountVerified: true;
  listings: AirbnbHostListingSummary[];
  nextAction: "MAPPING_REQUIRED";
};

export async function discoverAirbnbHostListings(
  propertyId: string,
  channelId: string
): Promise<AirbnbHostListingsResult> {
  const response = await fetch(
    `${API_BASE}/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/AIRBNB/${encodeURIComponent(channelId)}/listings`,
    { method: "GET", credentials: "include", cache: "no-store" }
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === "string"
      ? payload.error : "OTA_AIRBNB_LISTINGS_DISCOVERY_FAILED";
    throw new AirbnbHostSelfServiceApiError(code, response.status);
  }
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result)) {
    throw new Error("INVALID_AIRBNB_LISTINGS_RESPONSE");
  }
  const result = payload.result;
  if (result.propertyId !== propertyId || result.channelId !== channelId ||
      result.airbnbAccountVerified !== true || result.nextAction !== "MAPPING_REQUIRED" ||
      !Array.isArray(result.listings)) {
    throw new Error("INVALID_AIRBNB_LISTINGS_RESPONSE");
  }
  const listings = result.listings.map((value): AirbnbHostListingSummary => {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
        typeof value.title !== "string" || !value.title) {
      throw new Error("INVALID_AIRBNB_LISTINGS_RESPONSE");
    }
    return { id: value.id, title: value.title };
  });
  return { propertyId, channelId, airbnbAccountVerified: true, listings, nextAction: "MAPPING_REQUIRED" };
}

// Internal proposal only. This DTO never authorizes a provider write.
export type AirbnbHostMappingPlan = {
  propertyId: string;
  channelId: string;
  listing: AirbnbHostListingSummary;
  ratePlan: { id: string; source: "PIN_GO_PRIMARY_RATE_PLAN" };
  mappingRequest: { mapping: { rate_plan_id: string; settings: { listing_id: string } } };
  executable: false;
  nextAction: "MAPPING_EXECUTION_REQUIRES_APPROVAL";
};

export async function prepareAirbnbHostMappingPlan(
  propertyId: string,
  channelId: string,
  listingId: string
): Promise<AirbnbHostMappingPlan> {
  const response = await fetch(
    `${API_BASE}/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/AIRBNB/${encodeURIComponent(channelId)}/mapping-plan?listingId=${encodeURIComponent(listingId)}`,
    { method: "GET", credentials: "include", cache: "no-store" }
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === "string"
      ? payload.error : "OTA_AIRBNB_MAPPING_PLAN_FAILED";
    throw new AirbnbHostSelfServiceApiError(code, response.status);
  }
  const invalid = (): never => { throw new Error("INVALID_AIRBNB_MAPPING_PLAN_RESPONSE"); };
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.result)) return invalid();
  const result = payload.result;
  if (result.propertyId !== propertyId || result.channelId !== channelId ||
      result.executable !== false || result.nextAction !== "MAPPING_EXECUTION_REQUIRES_APPROVAL" ||
      !isRecord(result.listing) || result.listing.id !== listingId || !listingId ||
      typeof result.listing.title !== "string" || !result.listing.title ||
      !isRecord(result.ratePlan) || typeof result.ratePlan.id !== "string" || !result.ratePlan.id ||
      result.ratePlan.source !== "PIN_GO_PRIMARY_RATE_PLAN" || !isRecord(result.mappingRequest)) return invalid();
  const request = result.mappingRequest;
  const mapping = request.mapping;
  if (Object.keys(request).length !== 1 || !isRecord(mapping) || Object.keys(mapping).length !== 2 ||
      mapping.rate_plan_id !== result.ratePlan.id || !isRecord(mapping.settings) ||
      Object.keys(mapping.settings).length !== 1 || mapping.settings.listing_id !== listingId) return invalid();
  return {
    propertyId, channelId,
    listing: { id: listingId, title: result.listing.title },
    ratePlan: { id: result.ratePlan.id, source: "PIN_GO_PRIMARY_RATE_PLAN" },
    mappingRequest: { mapping: { rate_plan_id: result.ratePlan.id, settings: { listing_id: listingId } } },
    executable: false, nextAction: "MAPPING_EXECUTION_REQUIRES_APPROVAL",
  };
}
