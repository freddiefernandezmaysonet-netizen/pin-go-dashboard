const ORGANIZATION_BRANDING_API_BASE = import.meta.env.DEV
  ? String(import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
      /\/+$/,
      ""
    )
  : "/backend";

export type OrganizationBrandProfileStatus = "DRAFT" | "ACTIVE" | "SUSPENDED";

export type OrganizationBrandRevisionApprovalStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type OrganizationBrandDomainStatus =
  | "PENDING_CONFIGURATION"
  | "PENDING_DNS"
  | "VERIFYING"
  | "ACTIVE"
  | "FAILED"
  | "RETIRED";

export type OrganizationBrandRevision = {
  id: string;
  version: number;
  displayName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  approvalStatus: OrganizationBrandRevisionApprovalStatus;
  createdAt?: string;
};

export type OrganizationBrandDomain = {
  id: string;
  hostname: string;
  status: OrganizationBrandDomainStatus;
};

export type OrganizationBrandProfile = {
  id: string;
  organizationId: string;
  experienceType: "ENTERPRISE_BRANDED";
  status: OrganizationBrandProfileStatus;
  activeRevisionId: string | null;
  activeDomainId: string | null;
  activeRevision: OrganizationBrandRevision | null;
  activeDomain: OrganizationBrandDomain | null;
};

export type OrganizationBrandingReview = {
  profile: OrganizationBrandProfile | null;
  pendingRevisions: OrganizationBrandRevision[];
};

export type OrganizationBrandReviewDecision = {
  id: string;
  approvalStatus: "APPROVED" | "REJECTED";
};

export class OrganizationBrandingRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field: string | null;

  constructor(input: {
    code: string;
    status: number;
    message: string;
    field?: string | null;
  }) {
    super(input.message);
    this.name = "OrganizationBrandingRequestError";
    this.code = input.code;
    this.status = input.status;
    this.field = input.field ?? null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return textValue(value) ?? undefined;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function secureUrl(value: unknown): string | null {
  const normalized = textValue(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return normalized;
}

function responseInvalid(status: number): OrganizationBrandingRequestError {
  return new OrganizationBrandingRequestError({
    code: "ORGANIZATION_BRANDING_RESPONSE_INVALID",
    status,
    message: "The organization branding response is invalid.",
  });
}

function parseRequestError(response: Response, payload: unknown) {
  const data = isRecord(payload) ? payload : null;
  return new OrganizationBrandingRequestError({
    code: textValue(data?.error) ?? "ORGANIZATION_BRANDING_REQUEST_FAILED",
    status: response.status,
    message:
      textValue(data?.message) ??
      "Unable to complete the organization branding operation.",
    field: textValue(data?.field),
  });
}

async function organizationBrandingRequest(
  path: string,
  init: RequestInit
): Promise<{ payload: Record<string, unknown>; status: number }> {
  const response = await fetch(`${ORGANIZATION_BRANDING_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) throw parseRequestError(response, payload);
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw responseInvalid(response.status);
  }

  return { payload: payload.data, status: response.status };
}

function parseRevision(
  value: unknown,
  responseStatus: number,
  requireCreatedAt: boolean
): OrganizationBrandRevision {
  if (!isRecord(value)) throw responseInvalid(responseStatus);

  const id = textValue(value.id);
  const version = Number(value.version);
  const displayName = textValue(value.displayName);
  const logoUrl = secureUrl(value.logoUrl);
  const faviconUrl = secureUrl(value.faviconUrl);
  const primaryColor = textValue(value.primaryColor)?.toUpperCase() ?? null;
  const approvalStatus = value.approvalStatus;
  const createdAt = value.createdAt;
  const allowedStatuses = new Set<OrganizationBrandRevisionApprovalStatus>([
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
  ]);

  if (
    !id ||
    !Number.isInteger(version) ||
    version < 1 ||
    !displayName ||
    !logoUrl ||
    !faviconUrl ||
    !primaryColor ||
    !/^#[0-9A-F]{6}$/.test(primaryColor) ||
    !allowedStatuses.has(
      approvalStatus as OrganizationBrandRevisionApprovalStatus
    ) ||
    (requireCreatedAt && !validDate(createdAt))
  ) {
    throw responseInvalid(responseStatus);
  }

  return {
    id,
    version,
    displayName,
    logoUrl,
    faviconUrl,
    primaryColor,
    approvalStatus: approvalStatus as OrganizationBrandRevisionApprovalStatus,
    ...(validDate(createdAt) ? { createdAt } : {}),
  };
}

function parseDomain(
  value: unknown,
  responseStatus: number
): OrganizationBrandDomain {
  if (!isRecord(value)) throw responseInvalid(responseStatus);

  const id = textValue(value.id);
  const hostname = textValue(value.hostname);
  const status = value.status;
  const allowedStatuses = new Set<OrganizationBrandDomainStatus>([
    "PENDING_CONFIGURATION",
    "PENDING_DNS",
    "VERIFYING",
    "ACTIVE",
    "FAILED",
    "RETIRED",
  ]);

  if (
    !id ||
    !hostname ||
    !allowedStatuses.has(status as OrganizationBrandDomainStatus)
  ) {
    throw responseInvalid(responseStatus);
  }

  return { id, hostname, status: status as OrganizationBrandDomainStatus };
}

function parseProfile(
  value: unknown,
  responseStatus: number
): OrganizationBrandProfile | null {
  if (value === null) return null;
  if (!isRecord(value)) throw responseInvalid(responseStatus);

  const id = textValue(value.id);
  const organizationId = textValue(value.organizationId);
  const profileStatus = value.status;
  const allowedProfileStatuses = new Set<OrganizationBrandProfileStatus>([
    "DRAFT",
    "ACTIVE",
    "SUSPENDED",
  ]);
  const activeRevisionId = nullableText(value.activeRevisionId);
  const activeDomainId = nullableText(value.activeDomainId);

  if (
    !id ||
    !organizationId ||
    value.experienceType !== "ENTERPRISE_BRANDED" ||
    !allowedProfileStatuses.has(profileStatus as OrganizationBrandProfileStatus) ||
    activeRevisionId === undefined ||
    activeDomainId === undefined
  ) {
    throw responseInvalid(responseStatus);
  }

  const activeRevision =
    value.activeRevision === null
      ? null
      : parseRevision(value.activeRevision, responseStatus, false);
  const activeDomain =
    value.activeDomain === null
      ? null
      : parseDomain(value.activeDomain, responseStatus);

  if (
    (activeRevisionId === null) !== (activeRevision === null) ||
    (activeDomainId === null) !== (activeDomain === null) ||
    (activeRevision && activeRevision.id !== activeRevisionId) ||
    (activeDomain && activeDomain.id !== activeDomainId)
  ) {
    throw responseInvalid(responseStatus);
  }

  return {
    id,
    organizationId,
    experienceType: "ENTERPRISE_BRANDED",
    status: profileStatus as OrganizationBrandProfileStatus,
    activeRevisionId,
    activeDomainId,
    activeRevision,
    activeDomain,
  };
}

function resourcePath(value: string): string {
  return encodeURIComponent(String(value ?? "").trim());
}

export async function getOrganizationBrandingReview(
  signal?: AbortSignal
): Promise<OrganizationBrandingReview> {
  const { payload, status } = await organizationBrandingRequest(
    "/api/org/branding/review",
    { method: "GET", signal }
  );

  if (!Array.isArray(payload.pendingRevisions)) throw responseInvalid(status);

  const profile = parseProfile(payload.profile, status);
  const pendingRevisions = payload.pendingRevisions.map((revision) =>
    parseRevision(revision, status, true)
  );

  if (
    pendingRevisions.some(
      (revision) => revision.approvalStatus !== "PENDING_APPROVAL"
    ) ||
    (profile === null && pendingRevisions.length > 0)
  ) {
    throw responseInvalid(status);
  }

  return { profile, pendingRevisions };
}

async function reviewDecision(
  action: "approve" | "reject",
  brandProfileId: string,
  brandRevisionId: string,
  rejectionReason?: string
): Promise<OrganizationBrandReviewDecision> {
  const expectedStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const { payload, status } = await organizationBrandingRequest(
    `/api/org/branding/profiles/${resourcePath(
      brandProfileId
    )}/revisions/${resourcePath(brandRevisionId)}/${action}`,
    {
      method: "POST",
      body:
        action === "reject"
          ? JSON.stringify({ rejectionReason })
          : JSON.stringify({}),
    }
  );

  if (!isRecord(payload.revision)) throw responseInvalid(status);
  const revisionId = textValue(payload.revision.id);

  if (
    revisionId !== brandRevisionId.trim() ||
    payload.revision.approvalStatus !== expectedStatus
  ) {
    throw responseInvalid(status);
  }

  return { id: revisionId, approvalStatus: expectedStatus };
}

export async function approveOrganizationBrandRevision(
  brandProfileId: string,
  brandRevisionId: string
): Promise<OrganizationBrandReviewDecision> {
  return reviewDecision("approve", brandProfileId, brandRevisionId);
}

export async function rejectOrganizationBrandRevision(
  brandProfileId: string,
  brandRevisionId: string,
  rejectionReason: string
): Promise<OrganizationBrandReviewDecision> {
  const normalizedReason = rejectionReason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw new OrganizationBrandingRequestError({
      code: "BRAND_REVIEW_REJECTION_REASON_INVALID",
      status: 0,
      message: "Rejection reason must contain between 3 and 500 characters.",
      field: "rejectionReason",
    });
  }

  return reviewDecision(
    "reject",
    brandProfileId,
    brandRevisionId,
    normalizedReason
  );
}
