import { useState, type ReactElement } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { useBrand } from "../branding/BrandProvider";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactElement }) {
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const { brand, isCustomBrand } = useBrand();
  const [signingOut, setSigningOut] = useState(false);
  const logoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";
  const sessionOrganizationSlug = String(
    user?.organizationSlug ?? ""
  )
    .trim()
    .toLowerCase();
  const organizationDomainMismatch = Boolean(
    user &&
      brand.kind === "CUSTOM_BRAND" &&
      user.role !== "PLATFORM_ADMIN" &&
      sessionOrganizationSlug !== brand.organizationSlug
  );

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await logout();
    } catch (error) {
      console.error("[RequireAuth] domain mismatch sign out failed", error);
    } finally {
      await refresh();
      navigate("/login", { replace: true });
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <img
            src={logoUrl}
            alt={`${brand.displayName} logo`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: 54,
              height: 54,
              margin: "0 auto 12px",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />

          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginBottom: 10,
              color: "#111827",
            }}
          >
            {brand.displayName}
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
            }}
          >
            Loading dashboard...
          </div>

          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 3,
              margin: "16px auto 0",
              borderRadius: 999,
              background: "var(--brand-primary-color, #2563eb)",
            }}
          />

          {isCustomBrand && brand.poweredByPinGo ? (
            <div
              style={{
                marginTop: 14,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              Powered by Pin&Go
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (organizationDomainMismatch) {
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: 32,
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "#ffffff",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
            textAlign: "center",
          }}
        >
          <img
            src={logoUrl}
            alt={`${brand.displayName} logo`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: 54,
              height: 54,
              margin: "0 auto 14px",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />

          <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
            Account not available
          </div>

          <div
            style={{
              marginTop: 10,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            This account does not belong to the organization assigned to this
            dashboard. Sign out and use the account provided for this company.
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              marginTop: 22,
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 10,
              background: "var(--brand-primary-color, #2563eb)",
              color: "var(--brand-on-primary-color, #ffffff)",
              fontWeight: 700,
              cursor: signingOut ? "not-allowed" : "pointer",
              opacity: signingOut ? 0.7 : 1,
            }}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>

          {isCustomBrand && brand.poweredByPinGo ? (
            <div style={{ marginTop: 16, fontSize: 11, color: "#9ca3af" }}>
              Powered by Pin&Go
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return children;
}
