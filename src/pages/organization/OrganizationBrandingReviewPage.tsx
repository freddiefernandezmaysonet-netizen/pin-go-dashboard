import { useEffect, useState } from "react";
import {
  OrganizationBrandingRequestError,
  approveOrganizationBrandRevision,
  getOrganizationBrandingReview,
  rejectOrganizationBrandRevision,
  type OrganizationBrandRevision,
  type OrganizationBrandingReview,
} from "../../api/organizationBranding";

function reviewErrorMessage(error: unknown) {
  if (!(error instanceof OrganizationBrandingRequestError)) {
    return "Unable to complete the brand review. Please try again.";
  }

  if (error.code === "BRAND_REVIEWER_REQUIRED") {
    return "Only an active organization owner can review this brand proposal.";
  }
  if (error.code.includes("TRANSITION")) {
    return "This proposal is no longer pending. Refresh the page to see its current state.";
  }
  if (error.code.includes("NOT_FOUND")) {
    return "This brand proposal is no longer available.";
  }
  if (error.code === "BRAND_REVIEW_REJECTION_REASON_INVALID") {
    return "Explain the requested change using between 3 and 500 characters.";
  }
  if (error.code === "ORGANIZATION_BRANDING_RESPONSE_INVALID") {
    return "The brand review response could not be verified. Please try again.";
  }

  return error.message || "Unable to complete the brand review. Please try again.";
}

function readableDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function contrastingTextColor(hexColor: string) {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(hexColor.slice(index, index + 2), 16) / 255
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}

export default function OrganizationBrandingReviewPage() {
  const [review, setReview] = useState<OrganizationBrandingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<string | null>(null);
  const [confirmedRevisionId, setConfirmedRevisionId] = useState<string | null>(
    null
  );
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refreshReview() {
    const nextReview = await getOrganizationBrandingReview();
    setReview(nextReview);
    return nextReview;
  }

  useEffect(() => {
    const controller = new AbortController();

    getOrganizationBrandingReview(controller.signal)
      .then(setReview)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(reviewErrorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function approve(revision: OrganizationBrandRevision) {
    const profile = review?.profile;
    if (!profile || confirmedRevisionId !== revision.id) {
      setError("Confirm that you reviewed every item in this proposal.");
      return;
    }
    if (
      !window.confirm(
        `Approve brand revision ${revision.version} for ${revision.displayName}? Pin&Go may publish it after the domain is ready.`
      )
    ) {
      return;
    }

    setOperation(`approve-${revision.id}`);
    setError(null);
    setSuccess(null);
    try {
      await approveOrganizationBrandRevision(profile.id, revision.id);
      await refreshReview();
      setConfirmedRevisionId(null);
      setSuccess(
        "Brand proposal approved. Pin&Go will complete the remaining domain and publication checks."
      );
    } catch (caught) {
      setError(reviewErrorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  async function reject(revision: OrganizationBrandRevision) {
    const profile = review?.profile;
    const reason = rejectionReasons[revision.id]?.trim() ?? "";
    if (!profile) return;
    if (reason.length < 3 || reason.length > 500) {
      setError("Explain the requested change using between 3 and 500 characters.");
      return;
    }
    if (
      !window.confirm(
        `Reject brand revision ${revision.version} and send this change request to Pin&Go?`
      )
    ) {
      return;
    }

    setOperation(`reject-${revision.id}`);
    setError(null);
    setSuccess(null);
    try {
      await rejectOrganizationBrandRevision(profile.id, revision.id, reason);
      await refreshReview();
      setConfirmedRevisionId(null);
      setRejectionReasons((current) => {
        const next = { ...current };
        delete next[revision.id];
        return next;
      });
      setSuccess(
        "Change request sent. Pin&Go must prepare and submit a new revision before anything can be published."
      );
    } catch (caught) {
      setError(reviewErrorMessage(caught));
    } finally {
      setOperation(null);
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <section style={cardStyle}>
          <h1 style={titleStyle}>Brand review</h1>
          <p style={bodyStyle}>Loading your secure brand proposal…</p>
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <header style={heroStyle}>
        <p style={eyebrowStyle}>Organization owner approval</p>
        <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 44px)" }}>
          Review your branded experience
        </h1>
        <p style={{ margin: "12px 0 0", maxWidth: 760, lineHeight: 1.65 }}>
          Verify the exact name, logo, favicon and primary color proposed for
          your organization. Pin&amp;Go cannot publish a revision until an
          authorized owner approves it.
        </p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      {!review?.profile ? (
        <section style={cardStyle}>
          <h2 style={titleStyle}>No enterprise brand configured</h2>
          <p style={bodyStyle}>
            Your organization does not currently have a branded experience to
            review. Contact Pin&amp;Go if you expected a proposal here.
          </p>
        </section>
      ) : (
        <>
          <section style={summaryGridStyle}>
            <Summary
              label="Profile status"
              value={review.profile.status.toLowerCase()}
            />
            <Summary
              label="Pending proposals"
              value={String(review.pendingRevisions.length)}
            />
            <Summary
              label="Published revision"
              value={
                review.profile.activeRevision
                  ? `Revision ${review.profile.activeRevision.version}`
                  : "Not published"
              }
            />
            <Summary
              label="Domain"
              value={review.profile.activeDomain?.hostname ?? "Not active"}
            />
          </section>

          {review.profile.status === "SUSPENDED" && (
            <Notice tone="warning">
              This branded experience is suspended. You may review a pending
              identity, but Pin&amp;Go must resolve the suspension before publication.
            </Notice>
          )}

          {review.pendingRevisions.length === 0 ? (
            <section style={cardStyle}>
              <h2 style={titleStyle}>No approval is pending</h2>
              <p style={bodyStyle}>
                There is no brand proposal waiting for your decision. Pin&amp;Go
                will notify you when a new revision is ready for review.
              </p>
            </section>
          ) : (
            review.pendingRevisions.map((revision) => {
              const reason = rejectionReasons[revision.id] ?? "";
              const busy = operation !== null;
              return (
                <section key={revision.id} style={cardStyle}>
                  <div style={sectionHeaderStyle}>
                    <div>
                      <p style={eyebrowDarkStyle}>Revision {revision.version}</p>
                      <h2 style={titleStyle}>{revision.displayName}</h2>
                      <p style={bodyStyle}>
                        Submitted {readableDate(revision.createdAt)}
                      </p>
                    </div>
                    <span style={pendingBadgeStyle}>Pending approval</span>
                  </div>

                  <BrandPreview revision={revision} />

                  <div style={identityGridStyle}>
                    <IdentityItem label="Display name" value={revision.displayName} />
                    <IdentityItem label="Primary color" value={revision.primaryColor}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 7,
                          background: revision.primaryColor,
                          border: "1px solid rgba(15, 23, 42, 0.15)",
                        }}
                      />
                    </IdentityItem>
                    <IdentityItem label="Logo" value="Uploaded and verified">
                      <img
                        src={revision.logoUrl}
                        alt={`${revision.displayName} logo`}
                        style={assetThumbnailStyle}
                      />
                    </IdentityItem>
                    <IdentityItem label="Favicon" value="Uploaded and verified">
                      <img
                        src={revision.faviconUrl}
                        alt={`${revision.displayName} favicon`}
                        style={{ ...assetThumbnailStyle, width: 34 }}
                      />
                    </IdentityItem>
                  </div>

                  <div style={scopeNoticeStyle}>
                    Your approval covers only this visual identity. Pin&amp;Go
                    separately verifies domain ownership, security and publication
                    readiness.
                  </div>

                  <div style={decisionGridStyle}>
                    <div style={{ ...decisionCardStyle, borderColor: "#86efac" }}>
                      <h3 style={decisionTitleStyle}>Approve proposal</h3>
                      <p style={bodyStyle}>
                        Confirm that the identity shown above accurately represents
                        your organization.
                      </p>
                      <label style={confirmationStyle}>
                        <input
                          type="checkbox"
                          checked={confirmedRevisionId === revision.id}
                          disabled={busy}
                          onChange={(event) =>
                            setConfirmedRevisionId(
                              event.target.checked ? revision.id : null
                            )
                          }
                        />
                        I reviewed the name, logo, favicon and color.
                      </label>
                      <button
                        type="button"
                        disabled={busy || confirmedRevisionId !== revision.id}
                        onClick={() => void approve(revision)}
                        style={approveButtonStyle}
                      >
                        {operation === `approve-${revision.id}`
                          ? "Approving…"
                          : "Approve this revision"}
                      </button>
                    </div>

                    <div style={{ ...decisionCardStyle, borderColor: "#fecaca" }}>
                      <h3 style={decisionTitleStyle}>Request a change</h3>
                      <p style={bodyStyle}>
                        Describe exactly what Pin&amp;Go should correct. Rejection
                        prevents this revision from being published.
                      </p>
                      <label style={labelStyle}>
                        Requested change
                        <textarea
                          value={reason}
                          disabled={busy}
                          maxLength={500}
                          rows={5}
                          onChange={(event) =>
                            setRejectionReasons((current) => ({
                              ...current,
                              [revision.id]: event.target.value,
                            }))
                          }
                          placeholder="Example: Please use our horizontal logo and change the display name to…"
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                        <span style={helperStyle}>{reason.length}/500 characters</span>
                      </label>
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => void reject(revision)}
                        style={rejectButtonStyle}
                      >
                        {operation === `reject-${revision.id}`
                          ? "Sending…"
                          : "Reject and request changes"}
                      </button>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </>
      )}
    </PageFrame>
  );
}

function BrandPreview({ revision }: { revision: OrganizationBrandRevision }) {
  const onPrimary = contrastingTextColor(revision.primaryColor);
  return (
    <div style={previewFrameStyle}>
      <div style={browserBarStyle}>
        <span style={browserDotStyle} />
        <span style={browserDotStyle} />
        <span style={browserDotStyle} />
        <img
          src={revision.faviconUrl}
          alt=""
          style={{ width: 18, height: 18, objectFit: "contain", marginLeft: 10 }}
        />
        <span style={{ color: "#475569", fontSize: 12 }}>
          {revision.displayName} Dashboard
        </span>
      </div>
      <div style={previewContentStyle}>
        <aside style={previewSidebarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img
              src={revision.logoUrl}
              alt={`${revision.displayName} logo preview`}
              style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 8 }}
            />
            <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>
              {revision.displayName}
            </strong>
          </div>
          {['Overview', 'Properties', 'Reservations'].map((item, index) => (
            <div
              key={item}
              style={{
                padding: "9px 10px",
                borderRadius: 9,
                color: index === 0 ? onPrimary : "#64748b",
                background: index === 0 ? revision.primaryColor : "transparent",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {item}
            </div>
          ))}
          <span style={{ marginTop: "auto", color: "#94a3b8", fontSize: 10 }}>
            Powered by Pin&amp;Go
          </span>
        </aside>
        <div style={previewDashboardStyle}>
          <div style={{ fontWeight: 850, color: "#0f172a" }}>Overview</div>
          <div style={previewMetricsStyle}>
            {['Properties', 'Arrivals', 'Access'].map((item, index) => (
              <div key={item} style={previewMetricStyle}>
                <span style={{ color: "#64748b", fontSize: 10 }}>{item}</span>
                <strong style={{ color: "#0f172a", fontSize: 18 }}>
                  {[20, 4, 7][index]}
                </strong>
              </div>
            ))}
          </div>
          <div
            style={{
              height: 58,
              borderRadius: 12,
              background: `linear-gradient(90deg, ${revision.primaryColor}22, ${revision.primaryColor}08)`,
              border: `1px solid ${revision.primaryColor}33`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div style={pageStyle}>{children}</div>;
}

function Notice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success" | "warning";
}) {
  const colors = {
    error: { border: "#fecaca", color: "#991b1b", background: "#fef2f2" },
    success: { border: "#86efac", color: "#166534", background: "#f0fdf4" },
    warning: { border: "#fde68a", color: "#92400e", background: "#fffbeb" },
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        padding: "14px 18px",
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        color: colors.color,
        background: colors.background,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <span style={helperStyle}>{label}</span>
      <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

function IdentityItem({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={identityItemStyle}>
      <span style={helperStyle}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {children}
        <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{value}</strong>
      </span>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  padding: "32px clamp(22px, 5vw, 46px)",
  borderRadius: 28,
  color: "#ffffff",
  background: "linear-gradient(135deg, #020617 0%, #172554 58%, #155eef 100%)",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.20)",
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

const cardStyle: React.CSSProperties = {
  padding: "clamp(20px, 4vw, 30px)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)",
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0 8px",
  color: "#0f172a",
  fontSize: 24,
};

const bodyStyle: React.CSSProperties = {
  margin: "6px 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const summaryCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#ffffff",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const pendingBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  color: "#92400e",
  background: "#fef3c7",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const previewFrameStyle: React.CSSProperties = {
  marginTop: 20,
  overflow: "hidden",
  border: "1px solid #cbd5e1",
  borderRadius: 18,
  background: "#ffffff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
};

const browserBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const browserDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#cbd5e1",
};

const previewContentStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 0.34fr) 1fr",
  minHeight: 250,
};

const previewSidebarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 16,
  borderRight: "1px solid #e2e8f0",
};

const previewDashboardStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 16,
  padding: 22,
  background: "#f8fafc",
};

const previewMetricsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 9,
};

const previewMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 11,
  border: "1px solid #e2e8f0",
  borderRadius: 11,
  background: "#ffffff",
};

const identityGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
  marginTop: 22,
};

const identityItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
};

const assetThumbnailStyle: React.CSSProperties = {
  width: 72,
  height: 38,
  objectFit: "contain",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#ffffff",
};

const scopeNoticeStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 13,
  border: "1px solid #bfdbfe",
  borderRadius: 13,
  color: "#1e3a8a",
  background: "#eff6ff",
  fontSize: 13,
  lineHeight: 1.55,
};

const decisionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: 16,
  marginTop: 22,
};

const decisionCardStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 12,
  padding: 18,
  border: "1px solid",
  borderRadius: 16,
  background: "#ffffff",
};

const decisionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
};

const confirmationStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  color: "#0f172a",
  background: "#ffffff",
  font: "inherit",
};

const helperStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.45,
};

const approveButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  border: 0,
  borderRadius: 12,
  color: "#ffffff",
  background: "#15803d",
  fontWeight: 850,
  cursor: "pointer",
};

const rejectButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #ef4444",
  borderRadius: 12,
  color: "#b91c1c",
  background: "#ffffff",
  fontWeight: 850,
  cursor: "pointer",
};
