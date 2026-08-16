const ADMIN_BRANDING_API_BASE = import.meta.env.DEV
  ? String(import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
      /\/+$/,
      ""
    )
  : "/backend";

export type BrandDomainType = "PINNGO_SUBDOMAIN" | "CUSTOM_DOMAIN";
export type BrandAssetKind = "logo" | "favicon";

export type BrandDomainStatus =
  | "PENDING_CONFIGURATION"
  | "PENDING_DNS"
  | "VERIFYING"
  | "ACTIVE"
  | "FAILED"
  | "RETIRED";

export type BrandProfileStatus = "DRAFT" | "ACTIVE" | "SUSPENDED";

export type BrandRevisionApprovalStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type BrandIdentityInput = {
  displayName: string;
  logoUrl: string;
  logoPublicId: string;
  faviconUrl: string;
  faviconPublicId: string;
  primaryColor: string;
};

export type ProvisionEnterpriseBrandInput = BrandIdentityInput & {
  organizationName: string;
  organizationSlug: string;
  ownerEmail: string;
  hostname: string;
  domainType: BrandDomainType;
};

export type InitializeEnterpriseBrandInput = BrandIdentityInput & {
  hostname: string;
  domainType: BrandDomainType;
};

export type AdminBrandOrganization = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string;
};

export type AdminBrandRevision = {
  id: string;
  brandProfileId?: string;
  version: number;
  displayName: string;
  logoUrl: string;
  logoPublicId?: string;
  faviconUrl: string;
  faviconPublicId?: string;
  primaryColor: string;
  approvalStatus: BrandRevisionApprovalStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBrandDomain = {
  id: string;
  brandProfileId?: string;
  hostname: string;
  type: BrandDomainType;
  status: BrandDomainStatus;
  provider: "VERCEL";
  providerDomainId: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  redirectUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBrandProfile = {
  id: string;
  organizationId: string;
  experienceType: "ENTERPRISE_BRANDED";
  status: BrandProfileStatus;
  activeRevisionId: string | null;
  activeDomainId: string | null;
  createdAt: string;
  updatedAt: string;
  revisions: AdminBrandRevision[];
  domains: AdminBrandDomain[];
};

export type AdminBrandProfileRecord = Omit<
  AdminBrandProfile,
  "revisions" | "domains"
>;

export type AdminOrganizationInvitation = {
  id: string;
  organizationId?: string;
  email: string;
  role: "ORG_ADMIN";
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type EnterpriseBrandingStatus = AdminBrandOrganization & {
  brandProfile: AdminBrandProfile | null;
  organizationInvitations: AdminOrganizationInvitation[];
};

export type AdminBrandOrganizationSearchResult = {
  name: string;
  slug: string;
  propertyCount: number;
  brandStatus: BrandProfileStatus | null;
};

export type EnterpriseBrandProvisioningResult = {
  organization: AdminBrandOrganization;
  profile: AdminBrandProfileRecord;
  revision: AdminBrandRevision;
  domain: AdminBrandDomain;
  invitation: AdminOrganizationInvitation;
  invitationToken: string;
};

export type EnterpriseBrandInitializationResult = {
  profile: AdminBrandProfileRecord;
  revision: AdminBrandRevision;
  domain: AdminBrandDomain;
};

export type TransitionBrandDomainInput = {
  toStatus: BrandDomainStatus;
  providerDomainId?: string | null;
  redirectUntil?: string | null;
};

export type UploadedBrandAsset = {
  kind: BrandAssetKind;
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export class AdminBrandingRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field: string | null;
  readonly context: Record<string, unknown> | null;

  constructor(input: {
    code: string;
    status: number;
    message: string;
    field?: string | null;
    context?: Record<string, unknown> | null;
  }) {
    super(input.message);
    this.name = "AdminBrandingRequestError";
    this.code = input.code;
    this.status = input.status;
    this.field = input.field ?? null;
    this.context = input.context ?? null;
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

async function adminBrandingRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${ADMIN_BRANDING_API_BASE}${path}`, {
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

  if (!response.ok) {
    const errorPayload = isRecord(payload) ? payload : null;
    throw new AdminBrandingRequestError({
      code: textValue(errorPayload?.error) ?? "ADMIN_BRANDING_REQUEST_FAILED",
      status: response.status,
      message:
        textValue(errorPayload?.message) ??
        "Unable to complete the branding operation.",
      field: textValue(errorPayload?.field),
      context: isRecord(errorPayload?.context) ? errorPayload.context : null,
    });
  }

  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: response.status,
      message: "The branding response is invalid.",
    });
  }

  return payload.data as T;
}

function resourcePath(value: string): string {
  return encodeURIComponent(String(value ?? "").trim());
}

export async function uploadBrandAsset(
  kind: BrandAssetKind,
  file: File,
  signal?: AbortSignal
): Promise<UploadedBrandAsset> {
  const acceptedTypes =
    kind === "favicon"
      ? new Set(["image/png", "image/webp"])
      : new Set(["image/png", "image/jpeg", "image/webp"]);

  if (!acceptedTypes.has(file.type)) {
    throw new AdminBrandingRequestError({
      code: "BRAND_ASSET_FILE_INVALID",
      status: 0,
      message:
        kind === "favicon"
          ? "Favicon must be a PNG or WebP image."
          : "Logo must be a PNG, JPEG or WebP image.",
    });
  }

  if (file.size < 1) {
    throw new AdminBrandingRequestError({
      code: "BRAND_ASSET_FILE_INVALID",
      status: 0,
      message: "Brand asset file cannot be empty.",
    });
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new AdminBrandingRequestError({
      code: "BRAND_ASSET_FILE_TOO_LARGE",
      status: 0,
      message: "Brand assets must be smaller than 2 MB.",
    });
  }

  const form = new FormData();
  form.append("asset", file);

  const response = await fetch(
    `${ADMIN_BRANDING_API_BASE}/api/internal/admin/branding/assets/${kind}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
      body: form,
      signal,
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorPayload = isRecord(payload) ? payload : null;
    throw new AdminBrandingRequestError({
      code: textValue(errorPayload?.error) ?? "BRAND_ASSET_UPLOAD_FAILED",
      status: response.status,
      message: "Unable to upload the brand asset.",
    });
  }

  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: response.status,
      message: "The brand asset response is invalid.",
    });
  }

  const data = payload.data;
  const url = textValue(data.url);
  const publicId = textValue(data.publicId);
  const format = textValue(data.format);
  const width = Number(data.width);
  const height = Number(data.height);
  const bytes = Number(data.bytes);

  if (
    data.kind !== kind ||
    !url ||
    !publicId ||
    !format ||
    !Number.isInteger(width) ||
    width < 1 ||
    !Number.isInteger(height) ||
    height < 1 ||
    !Number.isInteger(bytes) ||
    bytes < 1
  ) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: response.status,
      message: "The brand asset response is invalid.",
    });
  }

  try {
    const assetUrl = new URL(url);
    if (
      assetUrl.protocol !== "https:" ||
      assetUrl.username ||
      assetUrl.password ||
      !assetUrl.hostname
    ) {
      throw new Error("Unsafe brand asset URL");
    }
  } catch {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: response.status,
      message: "The brand asset response is invalid.",
    });
  }

  return {
    kind,
    url,
    publicId,
    width,
    height,
    format,
    bytes,
  };
}

export async function provisionEnterpriseBrand(
  input: ProvisionEnterpriseBrandInput
): Promise<EnterpriseBrandProvisioningResult> {
  const data = await adminBrandingRequest<EnterpriseBrandProvisioningResult>(
    "/api/internal/admin/branding/enterprise-onboarding",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  if (
    !textValue(data.organization?.id) ||
    !textValue(data.profile?.id) ||
    !textValue(data.revision?.id) ||
    !textValue(data.domain?.id) ||
    !textValue(data.invitation?.id) ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.invitationToken)
  ) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 201,
      message: "The enterprise onboarding response is invalid.",
    });
  }

  return data;
}

export async function getEnterpriseBrandingStatus(
  organizationId: string
): Promise<EnterpriseBrandingStatus> {
  const data = await adminBrandingRequest<{
    organization: EnterpriseBrandingStatus;
  }>(
    `/api/internal/admin/branding/organizations/${resourcePath(
      organizationId
    )}/status`,
    { method: "GET" }
  );

  if (!isRecord(data.organization) || !textValue(data.organization.id)) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 200,
      message: "The enterprise branding status response is invalid.",
    });
  }

  return data.organization;
}

export async function searchEnterpriseBrandingOrganizations(
  query: string
): Promise<AdminBrandOrganizationSearchResult[]> {
  const normalizedQuery = query.trim();
  const data = await adminBrandingRequest<{ organizations: unknown }>(
    `/api/internal/admin/branding/organizations/search?query=${encodeURIComponent(
      normalizedQuery
    )}`,
    { method: "GET" }
  );

  if (!Array.isArray(data.organizations)) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 200,
      message: "The organization search response is invalid.",
    });
  }

  return data.organizations.map((item) => {
    const record = isRecord(item) ? item : null;
    const name = textValue(record?.name);
    const slug = textValue(record?.slug);
    const propertyCount = Number(record?.propertyCount);
    const brandStatus = record?.brandStatus;
    if (
      !name ||
      !slug ||
      !Number.isInteger(propertyCount) ||
      propertyCount < 0 ||
      (brandStatus !== null &&
        brandStatus !== "DRAFT" &&
        brandStatus !== "ACTIVE" &&
        brandStatus !== "SUSPENDED")
    ) {
      throw new AdminBrandingRequestError({
        code: "ADMIN_BRANDING_RESPONSE_INVALID",
        status: 200,
        message: "The organization search response is invalid.",
      });
    }

    return { name, slug, propertyCount, brandStatus };
  });
}

export async function getEnterpriseBrandingStatusBySlug(
  organizationSlug: string
): Promise<EnterpriseBrandingStatus> {
  const normalizedSlug = organizationSlug.trim().toLowerCase();
  const data = await adminBrandingRequest<{
    organization: EnterpriseBrandingStatus;
  }>(
    `/api/internal/admin/branding/organizations/by-slug/${resourcePath(
      normalizedSlug
    )}/status`,
    { method: "GET" }
  );

  if (
    !isRecord(data.organization) ||
    !textValue(data.organization.id) ||
    textValue(data.organization.slug) !== normalizedSlug
  ) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 200,
      message: "The enterprise branding status response is invalid.",
    });
  }

  return data.organization;
}

export async function initializeEnterpriseBrand(
  organizationId: string,
  input: InitializeEnterpriseBrandInput
): Promise<EnterpriseBrandInitializationResult> {
  const normalizedOrganizationId = organizationId.trim();
  const data = await adminBrandingRequest<EnterpriseBrandInitializationResult>(
    `/api/internal/admin/branding/organizations/${resourcePath(
      normalizedOrganizationId
    )}/initialize`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  const profileId = textValue(data.profile?.id);
  if (
    !normalizedOrganizationId ||
    !profileId ||
    textValue(data.profile?.organizationId) !== normalizedOrganizationId ||
    data.profile?.status !== "DRAFT" ||
    textValue(data.revision?.id) === null ||
    textValue(data.revision?.brandProfileId) !== profileId ||
    data.revision?.approvalStatus !== "DRAFT" ||
    textValue(data.domain?.id) === null ||
    textValue(data.domain?.brandProfileId) !== profileId ||
    data.domain?.status !== "PENDING_CONFIGURATION"
  ) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 201,
      message: "The enterprise brand initialization response is invalid.",
    });
  }

  return data;
}

export async function createEnterpriseBrandRevisionDraft(
  brandProfileId: string,
  identity: BrandIdentityInput
): Promise<AdminBrandRevision> {
  const normalizedProfileId = brandProfileId.trim();
  const data = await adminBrandingRequest<{ revision: AdminBrandRevision }>(
    `/api/internal/admin/branding/profiles/${resourcePath(
      normalizedProfileId
    )}/revisions`,
    {
      method: "POST",
      body: JSON.stringify(identity),
    }
  );

  if (
    !isRecord(data.revision) ||
    !textValue(data.revision.id) ||
    textValue(data.revision.brandProfileId) !== normalizedProfileId ||
    !Number.isInteger(data.revision.version) ||
    data.revision.version < 1 ||
    data.revision.approvalStatus !== "DRAFT"
  ) {
    throw new AdminBrandingRequestError({
      code: "ADMIN_BRANDING_RESPONSE_INVALID",
      status: 201,
      message: "The brand revision response is invalid.",
    });
  }

  return data.revision;
}

export async function submitBrandRevisionForApproval(
  brandProfileId: string,
  brandRevisionId: string
) {
  return adminBrandingRequest<{ revision: AdminBrandRevision }>(
    `/api/internal/admin/branding/profiles/${resourcePath(
      brandProfileId
    )}/revisions/${resourcePath(brandRevisionId)}/submit`,
    { method: "POST", body: "{}" }
  );
}

export async function transitionBrandDomain(
  brandProfileId: string,
  brandDomainId: string,
  input: TransitionBrandDomainInput
) {
  return adminBrandingRequest<{ domain: AdminBrandDomain }>(
    `/api/internal/admin/branding/profiles/${resourcePath(
      brandProfileId
    )}/domains/${resourcePath(brandDomainId)}/status`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export async function publishEnterpriseBrand(
  brandProfileId: string,
  brandRevisionId: string,
  brandDomainId: string
) {
  return adminBrandingRequest<{
    profile: AdminBrandProfileRecord;
    revisionId: string;
    domainId: string;
    publishedByUserId: string;
  }>(
    `/api/internal/admin/branding/profiles/${resourcePath(
      brandProfileId
    )}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ brandRevisionId, brandDomainId }),
    }
  );
}

export async function suspendEnterpriseBrand(brandProfileId: string) {
  return adminBrandingRequest<{ profile: AdminBrandProfileRecord }>(
    `/api/internal/admin/branding/profiles/${resourcePath(
      brandProfileId
    )}/suspend`,
    { method: "POST", body: "{}" }
  );
}

export async function createOrganizationOwnerInvitation(
  organizationId: string,
  email: string
) {
  return adminBrandingRequest<{
    invitation: AdminOrganizationInvitation;
    token: string;
  }>(
    `/api/internal/admin/branding/organizations/${resourcePath(
      organizationId
    )}/owner-invitations`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}

export async function revokeOrganizationOwnerInvitation(
  invitationId: string
) {
  return adminBrandingRequest<{
    invitation: {
      id: string;
      acceptedAt: string | null;
      revokedAt: string | null;
    };
  }>(
    `/api/internal/admin/branding/owner-invitations/${resourcePath(
      invitationId
    )}/revoke`,
    { method: "POST", body: "{}" }
  );
}
