import { useEffect, useMemo, useState } from "react";
import {
  AdminBrandingRequestError,
  type AdminBrandDomain,
  type BrandAssetKind,
  type BrandDomainStatus,
  type BrandDomainType,
  type EnterpriseBrandingStatus,
  type UploadedBrandAsset,
  createEnterpriseBrandRevisionDraft,
  createOrganizationOwnerInvitation,
  getEnterpriseBrandingStatus,
  initializeEnterpriseBrand,
  provisionEnterpriseBrand,
  publishEnterpriseBrand,
  revokeOrganizationOwnerInvitation,
  submitBrandRevisionForApproval,
  suspendEnterpriseBrand,
  transitionBrandDomain,
  uploadBrandAsset,
} from "../../api/adminBranding";

const DOMAIN_TRANSITIONS: Record<BrandDomainStatus, BrandDomainStatus[]> = {
  PENDING_CONFIGURATION: ["PENDING_DNS", "VERIFYING", "FAILED", "RETIRED"],
  PENDING_DNS: ["VERIFYING", "FAILED", "RETIRED"],
  VERIFYING: ["PENDING_DNS", "ACTIVE", "FAILED", "RETIRED"],
  ACTIVE: ["FAILED", "RETIRED"],
  FAILED: ["PENDING_CONFIGURATION", "PENDING_DNS", "VERIFYING", "RETIRED"],
  RETIRED: ["VERIFYING"],
};

type ProvisioningForm = {
  organizationName: string;
  organizationSlug: string;
  ownerEmail: string;
  displayName: string;
  hostname: string;
  domainType: BrandDomainType;
  primaryColor: string;
};

type AssetUploadTarget =
  | `provision-${BrandAssetKind}`
  | `initialize-${BrandAssetKind}`
  | `revision-${BrandAssetKind}`;

type ExistingInitializationBasis =
  | ""
  | "INTERNAL_TEST"
  | "COMMERCIAL_10_PLUS";

type ExistingInitializationForm = {
  displayName: string;
  hostname: string;
  domainType: BrandDomainType;
  primaryColor: string;
  basis: ExistingInitializationBasis;
};

const INITIAL_FORM: ProvisioningForm = {
  organizationName: "",
  organizationSlug: "",
  ownerEmail: "",
  displayName: "",
  hostname: "",
  domainType: "CUSTOM_DOMAIN",
  primaryColor: "#155EEF",
};

const INITIAL_EXISTING_FORM: ExistingInitializationForm = {
  displayName: "",
  hostname: "",
  domainType: "PINNGO_SUBDOMAIN",
  primaryColor: "#155EEF",
  basis: "",
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function invitationUrl(token: string) {
  const base = import.meta.env.DEV
    ? window.location.origin
    : "https://app.pin-ngo.com";
  return `${base}/organization-invitation#token=${encodeURIComponent(token)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof AdminBrandingRequestError) {
    const field = error.field ? ` (${error.field})` : "";
    return `${error.message}${field} [${error.code}]`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Unable to complete the operation.";
}

export default function AdminBrandingPage() {
  const [form, setForm] = useState<ProvisioningForm>(INITIAL_FORM);
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [logo, setLogo] = useState<UploadedBrandAsset | null>(null);
  const [favicon, setFavicon] = useState<UploadedBrandAsset | null>(null);
  const [existingForm, setExistingForm] = useState<ExistingInitializationForm>(
    INITIAL_EXISTING_FORM
  );
  const [existingInitializationConfirmed, setExistingInitializationConfirmed] =
    useState(false);
  const [existingLogo, setExistingLogo] =
    useState<UploadedBrandAsset | null>(null);
  const [existingFavicon, setExistingFavicon] =
    useState<UploadedBrandAsset | null>(null);
  const [assetLoading, setAssetLoading] = useState<AssetUploadTarget | null>(null);
  const [revisionDisplayName, setRevisionDisplayName] = useState("");
  const [revisionPrimaryColor, setRevisionPrimaryColor] = useState("#155EEF");
  const [revisionLogo, setRevisionLogo] =
    useState<UploadedBrandAsset | null>(null);
  const [revisionFavicon, setRevisionFavicon] =
    useState<UploadedBrandAsset | null>(null);
  const [organizationId, setOrganizationId] = useState(
    () => new URLSearchParams(window.location.search).get("organizationId") ?? ""
  );
  const [status, setStatus] = useState<EnterpriseBrandingStatus | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [domainTarget, setDomainTarget] = useState<BrandDomainStatus | "">("");
  const [providerDomainId, setProviderDomainId] = useState("");
  const [operation, setOperation] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profile = status?.brandProfile ?? null;
  const latestRevision = profile?.revisions[0] ?? null;
  const latestDomain = profile?.domains[0] ?? null;
  const nextDomainStatuses = latestDomain
    ? DOMAIN_TRANSITIONS[latestDomain.status]
    : [];
  const canPublish =
    profile?.status !== "SUSPENDED" &&
    latestRevision?.approvalStatus === "APPROVED" &&
    latestDomain?.status === "ACTIVE" &&
    (profile?.activeRevisionId !== latestRevision.id ||
      profile?.activeDomainId !== latestDomain.id);

  const pendingInvitations = useMemo(
    () =>
      (status?.organizationInvitations ?? []).filter(
        (invitation) => !invitation.acceptedAt && !invitation.revokedAt
      ),
    [status]
  );

  async function fetchStatus(id: string) {
    const result = await getEnterpriseBrandingStatus(id);
    setStatus(result);
    setOrganizationId(result.id);
    setOwnerEmail(result.organizationInvitations[0]?.email ?? "");
    setProviderDomainId(result.brandProfile?.domains[0]?.providerDomainId ?? "");
    if (!result.brandProfile) {
      setExistingForm({
        ...INITIAL_EXISTING_FORM,
        displayName: result.name,
        hostname: result.slug ? `${result.slug}.pin-ngo.com` : "",
      });
      setExistingInitializationConfirmed(false);
      setExistingLogo(null);
      setExistingFavicon(null);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("organizationId", result.id);
    window.history.replaceState(null, "", url);
    return result;
  }

  async function loadStatus(id = organizationId) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      setError("Enter an organization ID.");
      return;
    }

    setOperation("load");
    setMessage(null);
    setError(null);
    setInvitationLink(null);
    try {
      await fetchStatus(normalizedId);
    } catch (caught) {
      setStatus(null);
      setError(errorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  useEffect(() => {
    if (organizationId) void loadStatus(organizationId);
    // The initial query string is intentionally read only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (latestRevision?.approvalStatus === "REJECTED") {
      setRevisionDisplayName(latestRevision.displayName);
      setRevisionPrimaryColor(latestRevision.primaryColor);
    } else {
      setRevisionDisplayName("");
      setRevisionPrimaryColor("#155EEF");
    }
    setRevisionLogo(null);
    setRevisionFavicon(null);
  }, [
    latestRevision?.id,
    latestRevision?.approvalStatus,
    latestRevision?.displayName,
    latestRevision?.primaryColor,
  ]);

  async function uploadAsset(
    scope: "provision" | "initialize" | "revision",
    kind: BrandAssetKind,
    file: File | null
  ) {
    if (!file) return;
    const target: AssetUploadTarget = `${scope}-${kind}`;
    setAssetLoading(target);
    setMessage(null);
    setError(null);
    try {
      const uploaded = await uploadBrandAsset(kind, file);
      if (scope === "provision") {
        if (kind === "logo") setLogo(uploaded);
        else setFavicon(uploaded);
      } else if (scope === "initialize") {
        if (kind === "logo") setExistingLogo(uploaded);
        else setExistingFavicon(uploaded);
      } else if (kind === "logo") {
        setRevisionLogo(uploaded);
      } else {
        setRevisionFavicon(uploaded);
      }
      setMessage(
        `${kind === "logo" ? "Logo" : "Favicon"} uploaded securely for ${
          scope === "provision"
            ? "provisioning"
            : scope === "initialize"
              ? "existing organization initialization"
              : "the corrected revision"
        }.`
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setAssetLoading(null);
    }
  }

  async function initializeExistingOrganization(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!status || status.brandProfile) {
      setError("Load an existing organization without a branding profile.");
      return;
    }
    if (!existingForm.basis) {
      setError("Select the authorization basis for this initialization.");
      return;
    }
    if (!existingInitializationConfirmed) {
      setError("Confirm the selected authorization basis before initializing.");
      return;
    }
    if (!existingLogo || !existingFavicon) {
      setError("Upload both the logo and favicon before initializing.");
      return;
    }

    const displayName = existingForm.displayName.trim();
    if (displayName.length < 2 || displayName.length > 100) {
      setError("Customer-facing name must contain between 2 and 100 characters.");
      return;
    }

    const basisLabel =
      existingForm.basis === "INTERNAL_TEST"
        ? "a controlled internal test"
        : "a commercially approved 10+ property customer";
    if (
      !window.confirm(
        `Initialize branding for ${status.name} as ${basisLabel}? This creates a draft only and does not publish a live brand.`
      )
    ) {
      return;
    }

    setOperation("initialize");
    try {
      await initializeEnterpriseBrand(status.id, {
        displayName,
        hostname: existingForm.hostname.trim().toLowerCase(),
        domainType: existingForm.domainType,
        primaryColor: existingForm.primaryColor.toUpperCase(),
        logoUrl: existingLogo.url,
        logoPublicId: existingLogo.publicId,
        faviconUrl: existingFavicon.url,
        faviconPublicId: existingFavicon.publicId,
      });
      await fetchStatus(status.id);
      setMessage(
        `Branding initialized for ${status.name} as ${basisLabel}. The profile, revision and domain remain unpublished drafts.`
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  async function createCorrectedRevision(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (
      !status ||
      !profile ||
      latestRevision?.approvalStatus !== "REJECTED"
    ) {
      setError("A rejected revision is required before creating a correction.");
      return;
    }

    const displayName = revisionDisplayName.trim();
    if (displayName.length < 2 || displayName.length > 100) {
      setError("Customer-facing name must contain between 2 and 100 characters.");
      return;
    }
    if (!revisionLogo || !revisionFavicon) {
      setError("Upload both the logo and favicon for the corrected revision.");
      return;
    }

    setOperation("create-revision");
    setMessage(null);
    setError(null);
    try {
      const revision = await createEnterpriseBrandRevisionDraft(profile.id, {
        displayName,
        primaryColor: revisionPrimaryColor.toUpperCase(),
        logoUrl: revisionLogo.url,
        logoPublicId: revisionLogo.publicId,
        faviconUrl: revisionFavicon.url,
        faviconPublicId: revisionFavicon.publicId,
      });
      await fetchStatus(status.id);
      setMessage(
        `Corrected revision ${revision.version} created as a draft. Review it, then submit it separately for owner approval.`
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!eligibilityConfirmed) {
      setError("Confirm that the customer meets the 10+ property requirement.");
      return;
    }
    if (!logo || !favicon) {
      setError("Upload both the logo and favicon before provisioning.");
      return;
    }

    setOperation("provision");
    try {
      const result = await provisionEnterpriseBrand({
        organizationName: form.organizationName.trim(),
        organizationSlug: normalizeSlug(form.organizationSlug),
        ownerEmail: form.ownerEmail.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        hostname: form.hostname.trim().toLowerCase(),
        domainType: form.domainType,
        primaryColor: form.primaryColor.toUpperCase(),
        logoUrl: logo.url,
        logoPublicId: logo.publicId,
        faviconUrl: favicon.url,
        faviconPublicId: favicon.publicId,
      });
      const link = invitationUrl(result.invitationToken);
      setInvitationLink(link);
      setOrganizationId(result.organization.id);
      setOwnerEmail(result.invitation.email);
      setForm(INITIAL_FORM);
      setEligibilityConfirmed(false);
      setLogo(null);
      setFavicon(null);
      await fetchStatus(result.organization.id);
      setMessage(
        "Organization provisioned. Copy the owner invitation now; the token is not stored in this console."
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  async function runStatusOperation(
    key: string,
    successMessage: string,
    action: () => Promise<unknown>
  ) {
    if (!status) return false;
    setOperation(key);
    setMessage(null);
    setError(null);
    try {
      await action();
      await fetchStatus(status.id);
      setMessage(successMessage);
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    } finally {
      setOperation(null);
    }
  }

  async function createInvitation() {
    if (!status || !ownerEmail.trim()) {
      setError("Enter the account owner's email address.");
      return;
    }
    setOperation("invite");
    setMessage(null);
    setError(null);
    try {
      const result = await createOrganizationOwnerInvitation(
        status.id,
        ownerEmail.trim().toLowerCase()
      );
      setInvitationLink(invitationUrl(result.token));
      await fetchStatus(status.id);
      setMessage(
        "New owner invitation created. Copy it now; the token is shown only in this session."
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  async function copyInvitation() {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setMessage("Invitation link copied.");
      setError(null);
    } catch {
      setError("The browser could not copy the link. Select and copy it manually.");
    }
  }

  return (
    <div style={pageStyle}>
      <header style={heroStyle}>
        <p style={eyebrowStyle}>Platform admin only</p>
        <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 46px)" }}>
          Enterprise branding
        </h1>
        <p style={{ margin: "12px 0 0", maxWidth: 760, lineHeight: 1.65 }}>
          Manually provision a Pin&amp;Go experience with the customer's name,
          visual identity and domain. Approval, DNS activation and publication
          remain separate controlled steps.
        </p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {invitationLink && (
        <section style={{ ...cardStyle, borderColor: "#f59e0b" }}>
          <div style={sectionHeadingStyle}>
            <div>
              <p style={eyebrowDarkStyle}>One-time secret</p>
              <h2 style={headingStyle}>Owner invitation</h2>
            </div>
            <button type="button" style={primaryButtonStyle} onClick={copyInvitation}>
              Copy invitation
            </button>
          </div>
          <input
            aria-label="Owner invitation link"
            readOnly
            value={invitationLink}
            onFocus={(event) => event.currentTarget.select()}
            style={inputStyle}
          />
          <p style={helpStyle}>
            This link is kept only in page memory. Refreshing or closing this tab
            removes it from the console.
          </p>
        </section>
      )}

      <div style={twoColumnStyle}>
        <section style={cardStyle}>
          <p style={eyebrowDarkStyle}>New customer</p>
          <h2 style={headingStyle}>Manual provisioning</h2>
          <form onSubmit={provision} style={{ display: "grid", gap: 16 }}>
            <Field
              label="Organization name"
              value={form.organizationName}
              onChange={(value) =>
                setForm((current) => ({ ...current, organizationName: value }))
              }
              onBlur={() =>
                setForm((current) => ({
                  ...current,
                  organizationSlug:
                    current.organizationSlug || normalizeSlug(current.organizationName),
                  displayName: current.displayName || current.organizationName.trim(),
                }))
              }
              required
            />
            <Field
              label="Organization slug"
              value={form.organizationSlug}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  organizationSlug: normalizeSlug(value),
                }))
              }
              help="3–80 lowercase letters, numbers and hyphens."
              required
            />
            <Field
              label="Account owner email"
              type="email"
              value={form.ownerEmail}
              onChange={(value) =>
                setForm((current) => ({ ...current, ownerEmail: value }))
              }
              required
            />
            <Field
              label="Customer-facing name"
              value={form.displayName}
              onChange={(value) =>
                setForm((current) => ({ ...current, displayName: value }))
              }
              required
            />
            <label style={labelStyle}>
              Domain type
              <select
                value={form.domainType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    domainType: event.target.value as BrandDomainType,
                  }))
                }
                style={inputStyle}
              >
                <option value="CUSTOM_DOMAIN">Customer domain</option>
                <option value="PINNGO_SUBDOMAIN">Direct pin-ngo.com subdomain</option>
              </select>
            </label>
            <Field
              label="Hostname"
              value={form.hostname}
              onChange={(value) =>
                setForm((current) => ({ ...current, hostname: value }))
              }
              help="Hostname only, without https:// or a path."
              placeholder={
                form.domainType === "CUSTOM_DOMAIN"
                  ? "portal.customer.com"
                  : "customer.pin-ngo.com"
              }
              required
            />
            <label style={labelStyle}>
              Primary color
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      primaryColor: event.target.value,
                    }))
                  }
                  style={{ width: 54, height: 44, border: 0, background: "none" }}
                />
                <input readOnly value={form.primaryColor.toUpperCase()} style={inputStyle} />
              </span>
            </label>
            <AssetField
              kind="logo"
              asset={logo}
              loading={assetLoading === "provision-logo"}
              disabled={assetLoading !== null || operation !== null}
              onSelect={(file) => void uploadAsset("provision", "logo", file)}
            />
            <AssetField
              kind="favicon"
              asset={favicon}
              loading={assetLoading === "provision-favicon"}
              disabled={assetLoading !== null || operation !== null}
              onSelect={(file) =>
                void uploadAsset("provision", "favicon", file)
              }
            />
            <label style={confirmationStyle}>
              <input
                type="checkbox"
                checked={eligibilityConfirmed}
                onChange={(event) => setEligibilityConfirmed(event.target.checked)}
              />
              <span>
                I confirm that Pin&amp;Go has commercially approved this customer
                and verified that it manages at least 10 properties.
              </span>
            </label>
            <button
              type="submit"
              disabled={operation !== null || assetLoading !== null}
              style={primaryButtonStyle}
            >
              {operation === "provision" ? "Provisioning…" : "Provision organization"}
            </button>
          </form>
        </section>

        <section style={cardStyle}>
          <p style={eyebrowDarkStyle}>Existing customer</p>
          <h2 style={headingStyle}>Open branding record</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Organization ID"
                value={organizationId}
                onChange={setOrganizationId}
                placeholder="Organization UUID"
              />
            </div>
            <button
              type="button"
              disabled={operation !== null}
              onClick={() => void loadStatus()}
              style={secondaryButtonStyle}
            >
              {operation === "load" ? "Loading…" : "Load"}
            </button>
          </div>

          {!status && (
            <p style={{ ...helpStyle, marginTop: 18 }}>
              Load a record to review its approval, domain and publication state.
            </p>
          )}

          {status && (
            <div style={{ display: "grid", gap: 20, marginTop: 24 }}>
              <SummaryGrid status={status} />

              {!profile && (
                <form
                  onSubmit={initializeExistingOrganization}
                  style={{ ...subcardStyle, borderColor: "#93c5fd" }}
                >
                  <p style={eyebrowDarkStyle}>Existing organization</p>
                  <h3 style={subheadingStyle}>Initialize branding draft</h3>
                  <p style={helpStyle}>
                    Use this flow for a controlled Pin&amp;Go test or for a
                    commercially approved customer that manages at least 10
                    properties. Initialization does not publish the brand or send
                    an owner invitation.
                  </p>
                  <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                    <label style={labelStyle}>
                      Authorization basis
                      <select
                        value={existingForm.basis}
                        onChange={(event) => {
                          setExistingForm((current) => ({
                            ...current,
                            basis: event.target
                              .value as ExistingInitializationBasis,
                          }));
                          setExistingInitializationConfirmed(false);
                        }}
                        style={inputStyle}
                        required
                      >
                        <option value="">Select one</option>
                        <option value="INTERNAL_TEST">
                          Controlled Pin&amp;Go internal test
                        </option>
                        <option value="COMMERCIAL_10_PLUS">
                          Commercial customer — verified 10+ properties
                        </option>
                      </select>
                    </label>
                    <Field
                      label="Customer-facing name"
                      value={existingForm.displayName}
                      onChange={(value) =>
                        setExistingForm((current) => ({
                          ...current,
                          displayName: value,
                        }))
                      }
                      required
                    />
                    <label style={labelStyle}>
                      Domain type
                      <select
                        value={existingForm.domainType}
                        onChange={(event) =>
                          setExistingForm((current) => ({
                            ...current,
                            domainType: event.target.value as BrandDomainType,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="CUSTOM_DOMAIN">Customer domain</option>
                        <option value="PINNGO_SUBDOMAIN">
                          Direct pin-ngo.com subdomain
                        </option>
                      </select>
                    </label>
                    <Field
                      label="Hostname"
                      value={existingForm.hostname}
                      onChange={(value) =>
                        setExistingForm((current) => ({
                          ...current,
                          hostname: value,
                        }))
                      }
                      help="Hostname only, without https:// or a path."
                      placeholder={
                        existingForm.domainType === "CUSTOM_DOMAIN"
                          ? "portal.customer.com"
                          : "customer.pin-ngo.com"
                      }
                      required
                    />
                    <label style={labelStyle}>
                      Primary color
                      <span
                        style={{ display: "flex", alignItems: "center", gap: 12 }}
                      >
                        <input
                          type="color"
                          value={existingForm.primaryColor}
                          onChange={(event) =>
                            setExistingForm((current) => ({
                              ...current,
                              primaryColor: event.target.value,
                            }))
                          }
                          style={{
                            width: 54,
                            height: 44,
                            border: 0,
                            background: "none",
                          }}
                        />
                        <input
                          readOnly
                          value={existingForm.primaryColor.toUpperCase()}
                          style={inputStyle}
                        />
                      </span>
                    </label>
                    <AssetField
                      kind="logo"
                      asset={existingLogo}
                      loading={assetLoading === "initialize-logo"}
                      disabled={assetLoading !== null || operation !== null}
                      onSelect={(file) =>
                        void uploadAsset("initialize", "logo", file)
                      }
                    />
                    <AssetField
                      kind="favicon"
                      asset={existingFavicon}
                      loading={assetLoading === "initialize-favicon"}
                      disabled={assetLoading !== null || operation !== null}
                      onSelect={(file) =>
                        void uploadAsset("initialize", "favicon", file)
                      }
                    />
                    {existingForm.basis && (
                      <label style={confirmationStyle}>
                        <input
                          type="checkbox"
                          checked={existingInitializationConfirmed}
                          onChange={(event) =>
                            setExistingInitializationConfirmed(
                              event.target.checked
                            )
                          }
                        />
                        <span>
                          {existingForm.basis === "INTERNAL_TEST"
                            ? "I confirm this is a controlled Pin&Go internal test. It will remain a draft until separately reviewed."
                            : "I confirm that Pin&Go commercially approved this customer and verified that it manages at least 10 properties."}
                        </span>
                      </label>
                    )}
                    <button
                      type="submit"
                      disabled={operation !== null || assetLoading !== null}
                      style={primaryButtonStyle}
                    >
                      {operation === "initialize"
                        ? "Initializing draft…"
                        : "Initialize branding draft"}
                    </button>
                  </div>
                </form>
              )}

              {profile && latestRevision && (
                <div style={subcardStyle}>
                  <div style={sectionHeadingStyle}>
                    <div>
                      <p style={eyebrowDarkStyle}>Revision {latestRevision.version}</p>
                      <h3 style={subheadingStyle}>{latestRevision.displayName}</h3>
                    </div>
                    <StatusBadge value={latestRevision.approvalStatus} />
                  </div>
                  <p style={helpStyle}>
                    Created {formatDate(latestRevision.createdAt)}
                    {latestRevision.rejectionReason
                      ? ` · Rejection: ${latestRevision.rejectionReason}`
                      : ""}
                  </p>
                  {latestRevision.approvalStatus === "DRAFT" && (
                    <button
                      type="button"
                      disabled={operation !== null}
                      style={secondaryButtonStyle}
                      onClick={() =>
                        void runStatusOperation(
                          "submit",
                          "Revision submitted to the organization owner for approval.",
                          () =>
                            submitBrandRevisionForApproval(profile.id, latestRevision.id)
                        )
                      }
                    >
                      {operation === "submit" ? "Submitting…" : "Submit for owner approval"}
                    </button>
                  )}
                </div>
              )}

              {profile && latestRevision?.approvalStatus === "REJECTED" && (
                <form
                  onSubmit={createCorrectedRevision}
                  style={{ ...subcardStyle, borderColor: "#fca5a5" }}
                >
                  <p style={eyebrowDarkStyle}>Correction required</p>
                  <h3 style={subheadingStyle}>Create a corrected revision</h3>
                  <p style={helpStyle}>
                    Owner feedback: {latestRevision.rejectionReason ?? "No reason provided."}
                  </p>
                  <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                    <Field
                      label="Customer-facing name"
                      value={revisionDisplayName}
                      onChange={setRevisionDisplayName}
                      required
                    />
                    <label style={labelStyle}>
                      Primary color
                      <span
                        style={{ display: "flex", alignItems: "center", gap: 12 }}
                      >
                        <input
                          type="color"
                          value={revisionPrimaryColor}
                          onChange={(event) =>
                            setRevisionPrimaryColor(event.target.value)
                          }
                          style={{
                            width: 54,
                            height: 44,
                            border: 0,
                            background: "none",
                          }}
                        />
                        <input
                          readOnly
                          value={revisionPrimaryColor.toUpperCase()}
                          style={inputStyle}
                        />
                      </span>
                    </label>
                    <div style={correctionComparisonStyle}>
                      <div>
                        <span style={helpStyle}>Previously submitted logo</span>
                        <img
                          src={latestRevision.logoUrl}
                          alt="Previously submitted logo"
                          style={correctionPreviewStyle}
                        />
                      </div>
                      <div>
                        <span style={helpStyle}>Previously submitted favicon</span>
                        <img
                          src={latestRevision.faviconUrl}
                          alt="Previously submitted favicon"
                          style={{ ...correctionPreviewStyle, width: 48 }}
                        />
                      </div>
                    </div>
                    <AssetField
                      kind="logo"
                      asset={revisionLogo}
                      loading={assetLoading === "revision-logo"}
                      disabled={assetLoading !== null || operation !== null}
                      onSelect={(file) =>
                        void uploadAsset("revision", "logo", file)
                      }
                    />
                    <AssetField
                      kind="favicon"
                      asset={revisionFavicon}
                      loading={assetLoading === "revision-favicon"}
                      disabled={assetLoading !== null || operation !== null}
                      onSelect={(file) =>
                        void uploadAsset("revision", "favicon", file)
                      }
                    />
                    <div style={correctionNoticeStyle}>
                      Upload both assets again, even if only one item changed. The
                      new revision receives its own complete, auditable identity
                      snapshot.
                    </div>
                    <button
                      type="submit"
                      disabled={operation !== null || assetLoading !== null}
                      style={primaryButtonStyle}
                    >
                      {operation === "create-revision"
                        ? "Creating draft…"
                        : "Create corrected draft"}
                    </button>
                  </div>
                </form>
              )}

              {profile && latestDomain && (
                <DomainControls
                  domain={latestDomain}
                  targets={nextDomainStatuses}
                  target={domainTarget}
                  providerDomainId={providerDomainId}
                  disabled={operation !== null}
                  loading={operation === "domain"}
                  onTargetChange={setDomainTarget}
                  onProviderDomainIdChange={setProviderDomainId}
                  onTransition={() => {
                    if (!domainTarget) return;
                    void runStatusOperation(
                      "domain",
                      `Domain moved to ${humanize(domainTarget)}.`,
                      () =>
                        transitionBrandDomain(profile.id, latestDomain.id, {
                          toStatus: domainTarget,
                          providerDomainId: providerDomainId.trim() || undefined,
                        })
                    ).then((succeeded) => {
                      if (succeeded) setDomainTarget("");
                    });
                  }}
                />
              )}

              {profile && latestRevision && latestDomain && canPublish && (
                <div style={{ ...subcardStyle, borderColor: "#86efac" }}>
                  <p style={eyebrowDarkStyle}>Ready</p>
                  <h3 style={subheadingStyle}>Publish customer experience</h3>
                  <p style={helpStyle}>
                    The owner approved revision {latestRevision.version} and the
                    domain is active. Publication is still a separate manual action.
                  </p>
                  <button
                    type="button"
                    disabled={operation !== null}
                    style={primaryButtonStyle}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Publish ${latestRevision.displayName} on ${latestDomain.hostname}? This changes the live customer experience.`
                        )
                      ) {
                        return;
                      }
                      void runStatusOperation(
                        "publish",
                        "Enterprise brand published.",
                        () =>
                          publishEnterpriseBrand(
                            profile.id,
                            latestRevision.id,
                            latestDomain.id
                          )
                      );
                    }}
                  >
                    {operation === "publish" ? "Publishing…" : "Publish brand"}
                  </button>
                </div>
              )}

              {profile && (
                <div style={subcardStyle}>
                  <p style={eyebrowDarkStyle}>Account owner</p>
                  <h3 style={subheadingStyle}>Invitation recovery</h3>
                  <Field
                    label="Owner email"
                    type="email"
                    value={ownerEmail}
                    onChange={setOwnerEmail}
                  />
                  <button
                    type="button"
                    disabled={operation !== null}
                    style={{ ...secondaryButtonStyle, marginTop: 12 }}
                    onClick={() => void createInvitation()}
                  >
                    {operation === "invite"
                      ? "Creating…"
                      : "Create new owner invitation"}
                  </button>
                  {pendingInvitations.length > 0 && (
                    <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                      {pendingInvitations.map((invitation) => (
                        <div key={invitation.id} style={invitationRowStyle}>
                          <span>
                            {invitation.email} · expires{" "}
                            {formatDate(invitation.expiresAt)}
                          </span>
                          <button
                            type="button"
                            disabled={operation !== null}
                            style={textButtonStyle}
                            onClick={() =>
                              void runStatusOperation(
                                `revoke-${invitation.id}`,
                                "Invitation revoked.",
                                () =>
                                  revokeOrganizationOwnerInvitation(invitation.id)
                              )
                            }
                          >
                            {operation === `revoke-${invitation.id}`
                              ? "Revoking…"
                              : "Revoke"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profile?.status === "ACTIVE" && (
                <div style={{ ...subcardStyle, borderColor: "#fecaca" }}>
                  <p style={eyebrowDarkStyle}>Restricted action</p>
                  <h3 style={subheadingStyle}>Suspend published brand</h3>
                  <p style={helpStyle}>
                    Suspension disables the customer-branded experience. It does not
                    delete the organization or its history.
                  </p>
                  <button
                    type="button"
                    disabled={operation !== null}
                    style={dangerButtonStyle}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Suspend branding for ${status.name}? This affects the live customer experience.`
                        )
                      ) {
                        return;
                      }
                      void runStatusOperation(
                        "suspend",
                        "Enterprise brand suspended.",
                        () => suspendEnterpriseBrand(profile.id)
                      );
                    }}
                  >
                    {operation === "suspend" ? "Suspending…" : "Suspend brand"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  help,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  help?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
      />
      {help && <span style={helpStyle}>{help}</span>}
    </label>
  );
}

function AssetField({
  kind,
  asset,
  loading,
  disabled,
  onSelect,
}: {
  kind: BrandAssetKind;
  asset: UploadedBrandAsset | null;
  loading: boolean;
  disabled: boolean;
  onSelect: (file: File | null) => void;
}) {
  const isFavicon = kind === "favicon";
  return (
    <label style={assetFieldStyle}>
      <span style={{ fontWeight: 800 }}>{isFavicon ? "Favicon" : "Logo"}</span>
      <span style={helpStyle}>
        {isFavicon ? "PNG or WebP" : "PNG, JPEG or WebP"} · maximum 2 MB
      </span>
      {asset && (
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={asset.url}
            alt="Uploaded preview"
            style={{
              width: isFavicon ? 44 : 120,
              height: 44,
              objectFit: "contain",
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
          />
          <span style={helpStyle}>
            {asset.width}×{asset.height} · {Math.ceil(asset.bytes / 1024)} KB
          </span>
        </span>
      )}
      <input
        type="file"
        accept={isFavicon ? "image/png,image/webp" : "image/png,image/jpeg,image/webp"}
        disabled={disabled}
        onChange={(event) => {
          onSelect(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      {loading && <span style={helpStyle}>Uploading…</span>}
    </label>
  );
}

function SummaryGrid({ status }: { status: EnterpriseBrandingStatus }) {
  const profile = status.brandProfile;
  return (
    <div style={summaryGridStyle}>
      <Summary label="Organization" value={status.name} />
      <Summary label="Slug" value={status.slug ?? "—"} />
      <Summary label="Profile" value={profile ? humanize(profile.status) : "Not created"} />
      <Summary
        label="Published"
        value={profile?.activeRevisionId && profile.activeDomainId ? "Yes" : "No"}
      />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryStyle}>
      <span style={helpStyle}>{label}</span>
      <strong style={{ overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

function DomainControls({
  domain,
  targets,
  target,
  providerDomainId,
  disabled,
  loading,
  onTargetChange,
  onProviderDomainIdChange,
  onTransition,
}: {
  domain: AdminBrandDomain;
  targets: BrandDomainStatus[];
  target: BrandDomainStatus | "";
  providerDomainId: string;
  disabled: boolean;
  loading: boolean;
  onTargetChange: (value: BrandDomainStatus | "") => void;
  onProviderDomainIdChange: (value: string) => void;
  onTransition: () => void;
}) {
  return (
    <div style={subcardStyle}>
      <div style={sectionHeadingStyle}>
        <div>
          <p style={eyebrowDarkStyle}>Domain</p>
          <h3 style={subheadingStyle}>{domain.hostname}</h3>
        </div>
        <StatusBadge value={domain.status} />
      </div>
      <Field
        label="Vercel provider domain ID"
        value={providerDomainId}
        onChange={onProviderDomainIdChange}
        help="Optional unless the provider operation returns an identifier."
      />
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Next verified state
        <select
          value={target}
          disabled={disabled}
          onChange={(event) =>
            onTargetChange(event.target.value as BrandDomainStatus | "")
          }
          style={inputStyle}
        >
          <option value="">Select a valid transition</option>
          {targets.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || !target}
        style={{ ...secondaryButtonStyle, marginTop: 12 }}
        onClick={onTransition}
      >
        {loading ? "Updating…" : "Record domain transition"}
      </button>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const positive = value === "ACTIVE" || value === "APPROVED";
  const negative = value === "FAILED" || value === "REJECTED" || value === "SUSPENDED";
  return (
    <span
      style={{
        ...badgeStyle,
        color: positive ? "#166534" : negative ? "#991b1b" : "#92400e",
        background: positive ? "#dcfce7" : negative ? "#fee2e2" : "#fef3c7",
      }}
    >
      {humanize(value)}
    </span>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        padding: "14px 18px",
        borderRadius: 14,
        border: `1px solid ${tone === "error" ? "#fecaca" : "#86efac"}`,
        color: tone === "error" ? "#991b1b" : "#166534",
        background: tone === "error" ? "#fef2f2" : "#f0fdf4",
      }}
    >
      {children}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  padding: "32px clamp(22px, 5vw, 46px)",
  color: "#fff",
  borderRadius: 28,
  background: "linear-gradient(135deg, #020617 0%, #172554 58%, #155eef 100%)",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
};

const cardStyle: React.CSSProperties = {
  padding: "clamp(20px, 4vw, 30px)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
  gap: 20,
  alignItems: "start",
};

const subcardStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#f8fafc",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 750,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  background: "#fff",
  color: "#0f172a",
  font: "inherit",
};

const assetFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  border: "1px dashed #94a3b8",
  borderRadius: 14,
  background: "#f8fafc",
};

const correctionComparisonStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const correctionPreviewStyle: React.CSSProperties = {
  display: "block",
  width: 120,
  maxWidth: "100%",
  height: 48,
  marginTop: 7,
  objectFit: "contain",
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  background: "#ffffff",
};

const correctionNoticeStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid #fde68a",
  borderRadius: 12,
  color: "#78350f",
  background: "#fffbeb",
  fontSize: 12,
  lineHeight: 1.55,
};

const confirmationStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 14,
  border: "1px solid #fde68a",
  borderRadius: 14,
  color: "#78350f",
  background: "#fffbeb",
  fontSize: 14,
  lineHeight: 1.5,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  border: 0,
  borderRadius: 12,
  background: "#155eef",
  color: "#fff",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid #94a3b8",
  borderRadius: 12,
  background: "#fff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: "#ef4444",
  color: "#b91c1c",
};

const textButtonStyle: React.CSSProperties = {
  border: 0,
  padding: 4,
  color: "#b91c1c",
  background: "transparent",
  fontWeight: 800,
  cursor: "pointer",
};

const sectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 12,
};

const headingStyle: React.CSSProperties = {
  margin: "4px 0 18px",
  color: "#0f172a",
  fontSize: 24,
};

const subheadingStyle: React.CSSProperties = {
  margin: "4px 0 8px",
  color: "#0f172a",
  fontSize: 18,
};

const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#bfdbfe",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const eyebrowDarkStyle: React.CSSProperties = {
  ...eyebrowStyle,
  color: "#475569",
};

const helpStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.5,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const summaryStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 12,
  borderRadius: 12,
  background: "#f1f5f9",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const invitationRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 0",
  borderTop: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 12,
};
