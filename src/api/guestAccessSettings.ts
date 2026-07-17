const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_BASE ??
  "http://localhost:3000";

export type GuestAccessMode =
  | "PASSCODE_ONLY"
  | "PASSCODE_PLUS_NFC";

export type PropertyGuestAgreement = {
  id: string;
  version: string;
  title: string;
  agreementText: string;
  rules: string[];
  guestFacingSummary: string;
  requiresIdentityVerification: boolean;
  requiresAgreementSignature: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuestAccessSettings = {
  propertyId: string;
  propertyName: string;
  maxGuests: number | null;
  guestAccessMode: GuestAccessMode;
  cleaningNfcEnabled: boolean;
  configured: boolean;
  activeAgreement: PropertyGuestAgreement | null;
};

export type SaveGuestAccessSettingsInput = {
  guestAccessMode: GuestAccessMode;
  cleaningNfcEnabled: boolean;
  title: string;
  agreementText: string;
  guestFacingSummary: string;
  rules: string[];
};

export type GetGuestAccessSettingsResponse = {
  ok: true;
  settings: GuestAccessSettings;
};

export type SaveGuestAccessSettingsResponse = {
  ok: true;
  settings: GuestAccessSettings;
  newVersionCreated: boolean;
};

type GuestAccessApiErrorPayload = {
  error?: string;
  message?: string;
  details?: unknown;
};

export class GuestAccessApiError extends Error {
  readonly status: number;
  readonly code:
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "SERVER_ERROR"
    | "REQUEST_FAILED";
  readonly details?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code:
      | "VALIDATION_ERROR"
      | "NOT_FOUND"
      | "SERVER_ERROR"
      | "REQUEST_FAILED";
    details?: unknown;
  }) {
    super(params.message);
    this.name = "GuestAccessApiError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

function getErrorCode(status: number): GuestAccessApiError["code"] {
  if (status === 400) {
    return "VALIDATION_ERROR";
  }

  if (status === 404) {
    return "NOT_FOUND";
  }

  if (status >= 500) {
    return "SERVER_ERROR";
  }

  return "REQUEST_FAILED";
}

async function readResponseBody(
  response: Response
): Promise<GuestAccessApiErrorPayload | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response
      .json()
      .then((value) => value as GuestAccessApiErrorPayload)
      .catch(() => null);
  }

  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  return {
    message: text,
  };
}

async function throwGuestAccessApiError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  const payload = await readResponseBody(response);

  throw new GuestAccessApiError({
    status: response.status,
    code: getErrorCode(response.status),
    message:
      payload?.error ||
      payload?.message ||
      fallbackMessage,
    details: payload?.details,
  });
}

export async function getGuestAccessSettings(
  propertyId: string
): Promise<GetGuestAccessSettingsResponse> {
  const normalizedPropertyId = propertyId.trim();

  if (!normalizedPropertyId) {
    throw new GuestAccessApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Property ID is required.",
    });
  }

  const response = await fetch(
    `${API_BASE}/api/dashboard/properties/${encodeURIComponent(
      normalizedPropertyId
    )}/guest-access-settings`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    return throwGuestAccessApiError(
      response,
      "Failed to load Secure Guest Access settings."
    );
  }

  return response.json() as Promise<GetGuestAccessSettingsResponse>;
}

export async function saveGuestAccessSettings(
  propertyId: string,
  input: SaveGuestAccessSettingsInput
): Promise<SaveGuestAccessSettingsResponse> {
  const normalizedPropertyId = propertyId.trim();

  if (!normalizedPropertyId) {
    throw new GuestAccessApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Property ID is required.",
    });
  }

  const response = await fetch(
    `${API_BASE}/api/dashboard/properties/${encodeURIComponent(
      normalizedPropertyId
    )}/guest-access-settings`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    return throwGuestAccessApiError(
      response,
      "Failed to save Secure Guest Access settings."
    );
  }

  return response.json() as Promise<SaveGuestAccessSettingsResponse>;
}