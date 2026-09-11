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

export type AirbnbHostListing = {
  id: string;
  title: string | null;
  type: string | null;
  occupancies: number[] | null;
  synchronizationCategory: string | null;
  city: string | null;
  countryCode: string | null;
  qualityStatus: string | null;
};

export type AirbnbPropertyMatchStatus =
  | "AUTO_MATCH"
  | "REVIEW_REQUIRED"
  | "UNMATCHED";

export type AirbnbPropertyMatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AirbnbPropertyMatchDecision = {
  propertyId: string;
  status: AirbnbPropertyMatchStatus;
  confidence: AirbnbPropertyMatchConfidence;
  candidateListingId: string | null;
  candidateTitle: string | null;
  score: number;
  runnerUpScore: number | null;
  reasons: string[];
};

export type AirbnbPortfolioMatchSummary = {
  propertiesConsidered: number;
  listingsConsidered: number;
  autoMatched: number;
  reviewRequired: number;
  unmatched: number;
};

export type AirbnbHostListingDiscovery = {
  listings: AirbnbHostListing[];
  match: AirbnbPropertyMatchDecision;
  portfolioSummary: AirbnbPortfolioMatchSummary;
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

async function get(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
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
    return value;
  } catch {
    throw new Error("INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  }
}

function nullableText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
}

function nullableOccupancies(value: unknown): number[] | null {
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "number" || !Number.isInteger(item))
  ) {
    throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
  }
  return [...value];
}

function parseListing(value: unknown): AirbnbHostListing {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
    throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
  }
  return {
    id: value.id,
    title: nullableText(value.title),
    type: nullableText(value.type),
    occupancies: nullableOccupancies(value.occupancies),
    synchronizationCategory: nullableText(value.synchronizationCategory),
    city: nullableText(value.city),
    countryCode: nullableText(value.countryCode),
    qualityStatus: nullableText(value.qualityStatus),
  };
}

function parseMatchStatus(value: unknown): AirbnbPropertyMatchStatus {
  if (value === "AUTO_MATCH" || value === "REVIEW_REQUIRED" || value === "UNMATCHED") {
    return value;
  }
  throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
}

function parseMatchConfidence(value: unknown): AirbnbPropertyMatchConfidence {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") return value;
  throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
}

function parseMatch(value: unknown): AirbnbPropertyMatchDecision {
  if (
    !isRecord(value) ||
    typeof value.propertyId !== "string" ||
    !value.propertyId ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    !Array.isArray(value.reasons) ||
    value.reasons.some((reason) => typeof reason !== "string")
  ) {
    throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
  }
  return {
    propertyId: value.propertyId,
    status: parseMatchStatus(value.status),
    confidence: parseMatchConfidence(value.confidence),
    candidateListingId: nullableText(value.candidateListingId),
    candidateTitle: nullableText(value.candidateTitle),
    score: value.score,
    runnerUpScore: nullableNumber(value.runnerUpScore),
    reasons: [...value.reasons] as string[],
  };
}

function parsePortfolioSummary(value: unknown): AirbnbPortfolioMatchSummary {
  if (!isRecord(value)) {
    throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
  }
  return {
    propertiesConsidered: nonNegativeInteger(value.propertiesConsidered),
    listingsConsidered: nonNegativeInteger(value.listingsConsidered),
    autoMatched: nonNegativeInteger(value.autoMatched),
    reviewRequired: nonNegativeInteger(value.reviewRequired),
    unmatched: nonNegativeInteger(value.unmatched),
  };
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

export async function listAirbnbHostListings(
  propertyId: string
): Promise<AirbnbHostListingDiscovery> {
  const payload = await get(
    `/api/dashboard/distribution/properties/${encodeURIComponent(propertyId)}/channels/AIRBNB/listings`
  );
  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    !Array.isArray(payload.listings)
  ) {
    throw new Error("INVALID_AIRBNB_LISTING_DISCOVERY_RESPONSE");
  }
  return {
    listings: payload.listings.map(parseListing),
    match: parseMatch(payload.match),
    portfolioSummary: parsePortfolioSummary(payload.portfolioSummary),
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
