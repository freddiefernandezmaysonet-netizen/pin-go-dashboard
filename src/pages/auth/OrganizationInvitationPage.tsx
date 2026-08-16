import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  OrganizationInvitationRequestError,
  acceptOrganizationInvitation,
  inspectOrganizationInvitation,
  type OrganizationInvitationInspection,
} from "../../api/organizationInvitations";
import { useBrand } from "../../branding/BrandProvider";

type InvitationPageStatus = "loading" | "ready" | "invalid" | "accepted";

function tokenFromLocationHash(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash).get("token")?.trim() ?? "";
}

function validInvitationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

function invitationErrorMessage(error: unknown): string {
  if (!(error instanceof OrganizationInvitationRequestError)) {
    return "Unable to process this invitation. Please try again.";
  }

  if (error.code === "ORGANIZATION_INVITATION_EMAIL_REGISTERED") {
    return "An account already exists for this email. Please sign in instead.";
  }

  if (error.code === "ORGANIZATION_INVITATION_PASSWORD_WEAK") {
    return "Your password does not meet the security requirements.";
  }

  if (
    error.code === "INVALID_OR_EXPIRED_ORGANIZATION_INVITATION" ||
    error.code === "ORGANIZATION_INVITATION_INPUT_INVALID"
  ) {
    return "This invitation is invalid or has expired. Contact Pin&Go for a new invitation.";
  }

  return "Unable to process this invitation. Please try again.";
}

export default function OrganizationInvitationPage() {
  const { brand, isCustomBrand } = useBrand();
  const [token] = useState(tokenFromLocationHash);
  const [status, setStatus] = useState<InvitationPageStatus>("loading");
  const [invitation, setInvitation] =
    useState<OrganizationInvitationInspection | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const logoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }, [token]);

  useEffect(() => {
    if (!validInvitationToken(token)) {
      setStatus("invalid");
      setError(
        "This invitation is invalid or has expired. Contact Pin&Go for a new invitation."
      );
      return;
    }

    const controller = new AbortController();

    inspectOrganizationInvitation(token, controller.signal)
      .then((result) => {
        setInvitation(result);
        setStatus("ready");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(invitationErrorMessage(requestError));
        setStatus("invalid");
      });

    return () => controller.abort();
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setDetails([]);

    const normalizedFullName = fullName.trim();

    if (normalizedFullName.length < 2 || normalizedFullName.length > 120) {
      setError("Enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!password) {
      setError("Enter a secure password.");
      return;
    }

    setSubmitting(true);

    try {
      await acceptOrganizationInvitation({
        token,
        fullName: normalizedFullName,
        password,
      });
      setPassword("");
      setConfirmPassword("");
      setStatus("accepted");
    } catch (requestError) {
      setError(invitationErrorMessage(requestError));
      setDetails(
        requestError instanceof OrganizationInvitationRequestError
          ? requestError.details
          : []
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--brand-primary-color, #2563eb) 10%, transparent), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 32,
          border: "1px solid #e5e7eb",
          borderRadius: 22,
          background: "#ffffff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={logoUrl}
            alt={`${brand.displayName} logo`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: 48,
              height: 48,
              objectFit: "contain",
              borderRadius: 10,
            }}
          />

          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
              {brand.displayName}
            </div>
            {isCustomBrand && brand.poweredByPinGo ? (
              <div style={{ marginTop: 2, fontSize: 11, color: "#9ca3af" }}>
                Powered by Pin&Go
              </div>
            ) : null}
          </div>
        </div>

        {status === "loading" ? (
          <div style={{ marginTop: 30, color: "#6b7280" }}>
            Verifying your invitation...
          </div>
        ) : null}

        {status === "invalid" ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
              Invitation unavailable
            </div>
            <div style={errorBoxStyle}>{error}</div>
            <Link to="/login" style={secondaryLinkStyle}>
              Return to sign in
            </Link>
          </div>
        ) : null}

        {status === "accepted" ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
              Owner account created
            </div>
            <div
              style={{
                marginTop: 10,
                color: "#6b7280",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Your organization access is ready. Sign in with the invited email
              and the password you just created.
            </div>
            <Link to="/login" style={primaryLinkStyle}>
              Continue to sign in
            </Link>
          </div>
        ) : null}

        {status === "ready" && invitation ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>
              Create your owner account
            </div>
            <div
              style={{
                marginTop: 8,
                color: "#6b7280",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              You have been invited to manage {invitation.organizationName}.
            </div>

            <div style={invitationSummaryStyle}>
              <div>
                <div style={summaryLabelStyle}>Account email</div>
                <div style={summaryValueStyle}>{invitation.ownerEmailHint}</div>
              </div>
              <div>
                <div style={summaryLabelStyle}>Invitation expires</div>
                <div style={summaryValueStyle}>
                  {new Date(invitation.expiresAt).toLocaleString()}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Full name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  style={inputStyle}
                />
              </label>

              <div style={passwordHelpStyle}>
                Use at least 12 characters, including uppercase, lowercase,
                number and symbol. Do not include your name, email or company
                name.
              </div>

              {error ? (
                <div style={errorBoxStyle}>
                  <div>{error}</div>
                  {details.map((detail) => (
                    <div key={detail} style={{ marginTop: 4 }}>
                      • {detail}
                    </div>
                  ))}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: 46,
                  marginTop: 4,
                  border: 0,
                  borderRadius: 12,
                  background: "var(--brand-primary-color, #2563eb)",
                  color: "var(--brand-on-primary-color, #ffffff)",
                  fontWeight: 800,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Creating account..." : "Create owner account"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 14px",
  fontSize: 14,
};

const invitationSummaryStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  margin: "20px 0",
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#f8fafc",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const passwordHelpStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#eff6ff",
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.6,
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: "1px solid #fecaca",
  borderRadius: 12,
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: 13,
  lineHeight: 1.5,
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  marginTop: 22,
  padding: "0 18px",
  borderRadius: 12,
  background: "var(--brand-primary-color, #2563eb)",
  color: "var(--brand-on-primary-color, #ffffff)",
  textDecoration: "none",
  fontWeight: 800,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 18,
  color: "#374151",
  fontWeight: 700,
};
