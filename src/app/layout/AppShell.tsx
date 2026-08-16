import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { getOrganizationBrandingReview } from "../../api/organizationBranding";
import { useAuth } from "../../auth/AuthProvider";
import { useBrand } from "../../branding/BrandProvider";
import { shouldShowLegacyPmsUi } from "../../lib/dashboardPresentation";

// ✅ NAV BASE (producto normal)
const baseNav = [
  { to: "/overview", label: "Overview" },
  { to: "/properties", label: "Properties" },
  { to: "/locks", label: "Locks" },
  { to: "/health", label: "Locks Health Center" },
  { to: "/reservations", label: "Reservations" },
  { to: "/access", label: "Access" },
  { to: "/team", label: "Team" },
  { to: "/organization", label: "Organization" },
  
  { to: "/messages", label: "Messages" },
  { to: "/staff", label: "Staff Members" },

  ...(shouldShowLegacyPmsUi()
    ? [{ to: "/integrations/pms", label: "PMS" }]
    : []),
  { to: "/billing", label: "Billing" },
  { to: "/integrations/tuya", label: "Tuya Integration" },
  { to: "/automation/history", label: "Automation History" },
];

function SideItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: isActive
          ? "var(--brand-on-primary-color, #ffffff)"
          : "#6b7280",
        background: isActive
          ? "var(--brand-primary-color, #2563eb)"
          : "transparent",
        fontWeight: isActive ? 600 : 500,
        display: "block",
      })}
    >
      {label}
    </NavLink>
  );
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/overview")) return "Overview";
  if (pathname.startsWith("/properties")) return "Properties";
  if (pathname.startsWith("/locks")) return "Locks";
  if (pathname.startsWith("/reservations")) return "Reservations";
  if (pathname.startsWith("/access")) return "Access";
  if (pathname.startsWith("/team")) return "Team";
  if (pathname.startsWith("/organization/branding-review")) return "Brand Approval";
  if (pathname.startsWith("/organization")) return "Organization";
  if (pathname.startsWith("/staff")) return "Staff Members";
  if (pathname.startsWith("/health")) return "Health Center";
  if (pathname.startsWith("/automation/history")) return "Automation History";
  if (pathname.startsWith("/messages")) return "Messages";

  // ✅ NUEVO
  if (pathname.startsWith("/admin/sales-followups")) return "Sales Follow-ups";
  if (pathname.startsWith("/admin/financial")) return "Admin Financial";
  if (pathname.startsWith("/admin/demo-center")) return "Demo Center";
  if (pathname.startsWith("/admin/branding")) return "Enterprise Branding";
 
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/integrations/tuya")) return "Tuya Integration";

  return "Dashboard";
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { brand, isCustomBrand } = useBrand();
  const [canReviewOrganizationBrand, setCanReviewOrganizationBrand] =
    useState(false);
  const logoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";

  useEffect(() => {
    if (user?.role !== "ORG_ADMIN" && user?.role !== "ADMIN") {
      setCanReviewOrganizationBrand(false);
      return;
    }

    const controller = new AbortController();
    setCanReviewOrganizationBrand(false);

    getOrganizationBrandingReview(controller.signal)
      .then((review) => {
        if (!controller.signal.aborted) {
          setCanReviewOrganizationBrand(
            review.profile?.experienceType === "ENTERPRISE_BRANDED"
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCanReviewOrganizationBrand(false);
        }
      });

    return () => controller.abort();
  }, [user?.id, user?.orgId, user?.role]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }

  const memberHiddenPaths = new Set([
  "/team",
  "/billing",
  "/integrations/pms",
  "/integrations/ttlock",
  "/integrations/tuya",
  "/integrations/tuya-premium",
  "/integrations/pms/listings-mapping",
]);

const memberNav = baseNav.filter((item) => !memberHiddenPaths.has(item.to));
const organizationNav = canReviewOrganizationBrand
  ? [...baseNav, { to: "/organization/branding-review", label: "Brand Approval" }]
  : baseNav;

 // ✅ NAV DINÁMICO (solo tú ves admin)
const nav =
  user?.role === "PLATFORM_ADMIN"
    ? [
        ...baseNav,
        { to: "/admin/financial", label: "Admin Financial" },
        { to: "/admin/sales-followups", label: "Sales Follow-ups" },
        { to: "/admin/demo-center", label: "Demo Center" },
        { to: "/admin/branding", label: "Enterprise Branding" },
      ]
    : user?.role === "MEMBER"
      ? memberNav
      : organizationNav;
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #e5e7eb",
          background: "#ffffff",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src={logoUrl}
            alt={`${brand.displayName} logo`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: 38,
              height: 38,
              objectFit: "contain",
              borderRadius: 9,
            }}
          />

          <div
            style={{
              minWidth: 0,
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.15,
              overflowWrap: "anywhere",
            }}
          >
            {brand.displayName}
          </div>
        </div>

        <nav style={{ display: "grid", gap: 8 }}>
          {nav.map((item) => (
            <SideItem key={item.to} to={item.to} label={item.label} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {isCustomBrand && brand.poweredByPinGo ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 11,
              color: "#9ca3af",
              textAlign: "center",
            }}
          >
            Powered by Pin&Go
          </div>
        ) : null}

        <div
          style={{
            marginTop: isCustomBrand ? 12 : 24,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 8,
              wordBreak: "break-word",
            }}
          >
            {user?.email ?? "No user"}
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 72,
            borderBottom: "1px solid #e5e7eb",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.1,
              }}
            >
              {pageTitle}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              {brand.displayName} Dashboard
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {user?.organizationName ?? "Organization"}
              </div>
            </div>

            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: "var(--brand-primary-color, #2563eb)",
                color: "var(--brand-on-primary-color, #ffffff)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 14,
                border: "1px solid rgba(15, 23, 42, 0.08)",
              }}
            >
              {(user?.email?.[0] ?? "P").toUpperCase()}
            </div>
          </div>
        </header>

        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
