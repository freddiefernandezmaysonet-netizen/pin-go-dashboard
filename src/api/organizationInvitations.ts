const INVITATION_API_BASE = import.meta.env.DEV
  ? String(import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
      /\/+$/,
      ""
    )
  : "/backend";

export type OrganizationInvitationInspection = {
  organizationName: string;
  ownerEmailHint: string;
  expiresAt: string;
};

export type AcceptedOrganizationOwner = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: "ORG_ADMIN";
  isActive: true;
  createdAt: string;
};

export type OrganizationInvitationAcceptance = {
  user: AcceptedOrganizationOwner;
  organizationId: string;
  acceptedAt: string;
};

export type AcceptOrganizationInvitationInput = {
  token: string;
  fullName: string;
  password: string;
};

export class OrganizationInvitationRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: string[];

  constructor(
    code: string,
    status: number,
    details: string[] = []
  ) {
    super(code);
    this.name = "OrganizationInvitationRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function validDateText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

async function responsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function requestError(response: Response, payload: unknown) {
  const data = isRecord(payload) ? payload : null;
  const code =
    requiredText(data?.error) ?? "ORGANIZATION_INVITATION_REQUEST_FAILED";
  const details = Array.isArray(data?.details)
    ? data.details.filter((item): item is string => typeof item === "string")
    : [];

  return new OrganizationInvitationRequestError(
    code,
    response.status,
    details
  );
}

export async function inspectOrganizationInvitation(
  token: string,
  signal?: AbortSignal
): Promise<OrganizationInvitationInspection> {
  const response = await fetch(
    `${INVITATION_API_BASE}/api/public/organization-invitations/inspect`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ token }),
      signal,
    }
  );
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw requestError(response, payload);
  }

  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new OrganizationInvitationRequestError(
      "ORGANIZATION_INVITATION_RESPONSE_INVALID",
      response.status
    );
  }

  const organizationName = requiredText(payload.data.organizationName);
  const ownerEmailHint = requiredText(payload.data.ownerEmailHint);
  const expiresAt = payload.data.expiresAt;

  if (!organizationName || !ownerEmailHint || !validDateText(expiresAt)) {
    throw new OrganizationInvitationRequestError(
      "ORGANIZATION_INVITATION_RESPONSE_INVALID",
      response.status
    );
  }

  return { organizationName, ownerEmailHint, expiresAt };
}

export async function acceptOrganizationInvitation(
  input: AcceptOrganizationInvitationInput,
  signal?: AbortSignal
): Promise<OrganizationInvitationAcceptance> {
  const response = await fetch(
    `${INVITATION_API_BASE}/api/public/organization-invitations/accept`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        token: input.token,
        fullName: input.fullName,
        password: input.password,
      }),
      signal,
    }
  );
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw requestError(response, payload);
  }

  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    !isRecord(payload.data) ||
    !isRecord(payload.data.user)
  ) {
    throw new OrganizationInvitationRequestError(
      "ORGANIZATION_INVITATION_RESPONSE_INVALID",
      response.status
    );
  }

  const user = payload.data.user;
  const userId = requiredText(user.id);
  const userOrganizationId = requiredText(user.organizationId);
  const email = requiredText(user.email);
  const fullName = requiredText(user.fullName);
  const organizationId = requiredText(payload.data.organizationId);
  const acceptedAt = payload.data.acceptedAt;
  const createdAt = user.createdAt;

  if (
    !userId ||
    !userOrganizationId ||
    !email ||
    !fullName ||
    user.role !== "ORG_ADMIN" ||
    user.isActive !== true ||
    !organizationId ||
    organizationId !== userOrganizationId ||
    !validDateText(acceptedAt) ||
    !validDateText(createdAt)
  ) {
    throw new OrganizationInvitationRequestError(
      "ORGANIZATION_INVITATION_RESPONSE_INVALID",
      response.status
    );
  }

  return {
    user: {
      id: userId,
      organizationId: userOrganizationId,
      email,
      fullName,
      role: "ORG_ADMIN",
      isActive: true,
      createdAt,
    },
    organizationId,
    acceptedAt,
  };
}
