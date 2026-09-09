const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

const ALLOWED_AUTHORIZATION_ORIGINS = new Set([
  "https://app.channex.io",
  "https://staging.channex.io",
]);

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
  propertyId: string;
  channelId: string | null;
  channelActive: boolean | null;
  nextAction: "RETRY_AUTHORIZATION" | "MAPPING_REQUIRED";
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
  if (typeof value !== "string" || value.length > 4096) {
    throw new Error("INVALID_AIRBNB_CONNECTION_LINK_RESPONSE");
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !ALLOWED_AUTHORIZATION_ORIGINS.has(parsed.origin)
    ) {
      throw new Error("invalid");
    }
    return parsed.toString();
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
    typeof result.propertyId !== "string" ||
    !(result.channelId === null || typeof result.channelId === "string") ||
    !(result.channelActive === null || typeof result.channelActive === "boolean") ||
    (result.nextAction !== "RETRY_AUTHORIZATION" && result.nextAction !== "MAPPING_REQUIRED")
  ) {
    throw new Error("INVALID_AIRBNB_CALLBACK_VERIFICATION_RESPONSE");
  }
  return result as AirbnbHostCallbackResult;
}
