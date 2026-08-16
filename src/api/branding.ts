const BRANDING_API_BASE = import.meta.env.DEV
  ? String(import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
      /\/+$/,
      ""
    )
  : "/backend";

export type PinGoStandardBrandContext = {
  kind: "PIN_GO_STANDARD";
  displayName: "Pin&Go";
  logoUrl: null;
  faviconUrl: null;
  primaryColor: null;
  onPrimaryColor: null;
  organizationSlug: null;
  version: null;
  poweredByPinGo: true;
};

export type CustomBrandContext = {
  kind: "CUSTOM_BRAND";
  displayName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  onPrimaryColor: "#000000" | "#FFFFFF";
  organizationSlug: string;
  version: number;
  poweredByPinGo: true;
};

export type BrandContext =
  | PinGoStandardBrandContext
  | CustomBrandContext;

export const PIN_GO_STANDARD_BRAND_CONTEXT: PinGoStandardBrandContext =
  Object.freeze({
    kind: "PIN_GO_STANDARD",
    displayName: "Pin&Go",
    logoUrl: null,
    faviconUrl: null,
    primaryColor: null,
    onPrimaryColor: null,
    organizationSlug: null,
    version: null,
    poweredByPinGo: true,
  });

export type BrandContextRequestErrorCode =
  | "BRAND_DOMAIN_UNAVAILABLE"
  | "BRAND_CONTEXT_REQUEST_FAILED"
  | "BRAND_CONTEXT_RESPONSE_INVALID";

export class BrandContextRequestError extends Error {
  readonly code: BrandContextRequestErrorCode;
  readonly status: number | null;

  constructor(
    code: BrandContextRequestErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "BrandContextRequestError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDisplayName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return (
    normalized === value &&
    normalized.length >= 2 &&
    normalized.length <= 100
  );
}

function validSecureAssetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function validOrganizationSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function parseBrandContext(payload: unknown): BrandContext {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new BrandContextRequestError(
      "BRAND_CONTEXT_RESPONSE_INVALID",
      "The brand context response is invalid."
    );
  }

  const data = payload.data;

  if (data.kind === "PIN_GO_STANDARD") {
    if (
      data.displayName !== "Pin&Go" ||
      data.logoUrl !== null ||
      data.faviconUrl !== null ||
      data.primaryColor !== null ||
      data.onPrimaryColor !== null ||
      data.organizationSlug !== null ||
      data.version !== null ||
      data.poweredByPinGo !== true
    ) {
      throw new BrandContextRequestError(
        "BRAND_CONTEXT_RESPONSE_INVALID",
        "The standard brand context response is invalid."
      );
    }

    return PIN_GO_STANDARD_BRAND_CONTEXT;
  }

  if (
    data.kind !== "CUSTOM_BRAND" ||
    !validDisplayName(data.displayName) ||
    !validSecureAssetUrl(data.logoUrl) ||
    !validSecureAssetUrl(data.faviconUrl) ||
    typeof data.primaryColor !== "string" ||
    !/^#[0-9A-Fa-f]{6}$/.test(data.primaryColor) ||
    (data.onPrimaryColor !== "#000000" &&
      data.onPrimaryColor !== "#FFFFFF") ||
    !validOrganizationSlug(data.organizationSlug) ||
    typeof data.version !== "number" ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    data.poweredByPinGo !== true
  ) {
    throw new BrandContextRequestError(
      "BRAND_CONTEXT_RESPONSE_INVALID",
      "The custom brand context response is invalid."
    );
  }

  return {
    kind: "CUSTOM_BRAND",
    displayName: data.displayName,
    logoUrl: data.logoUrl,
    faviconUrl: data.faviconUrl,
    primaryColor: data.primaryColor.toUpperCase(),
    onPrimaryColor: data.onPrimaryColor,
    organizationSlug: data.organizationSlug,
    version: data.version,
    poweredByPinGo: true,
  };
}

export async function fetchBrandContext(
  signal?: AbortSignal
): Promise<BrandContext> {
  const response = await fetch(`${BRANDING_API_BASE}/api/public/brand-context`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "include",
    cache: "no-store",
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (
    response.status === 404 &&
    isRecord(payload) &&
    payload.error === "BRAND_DOMAIN_UNAVAILABLE"
  ) {
    throw new BrandContextRequestError(
      "BRAND_DOMAIN_UNAVAILABLE",
      "This dashboard domain is not available.",
      response.status
    );
  }

  if (!response.ok) {
    throw new BrandContextRequestError(
      "BRAND_CONTEXT_REQUEST_FAILED",
      "Unable to load the dashboard brand context.",
      response.status
    );
  }

  return parseBrandContext(payload);
}
