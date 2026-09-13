import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { getOrganizationBrandingReview } from "../../api/organizationBranding";
import { useAuth } from "../../auth/AuthProvider";
import { useBrand } from "../../branding/BrandProvider";
import { shouldShowLegacyPmsUi } from "../../lib/dashboardPresentation";
import { reviewsE1Enabled } from "../../lib/reviewsConfig";

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
  ...(reviewsE1Enabled ? [{ to: "/reputation", label: "Reputation" }] : []),
  { to: "/staff", label: "Staff Members" },

  ...(shouldShowLegacyPmsUi()
    ? [{ to: "/integrations/pms", label: "PMS" }]
    : []),
  { to: "/billing", label: "Billing" },
  { to: "/integrations/tuya", label: "Tuya Integration" },
  { to: "/automation/history", label: "Device Automation History" },
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
  if (/^\/properties\/[^/]+\/distribution(?:\/|$)/.test(pathname)) return "Booking channels";
  if (pathname.startsWith("/properties")) return "Properties";
  if (pathname.startsWith("/locks")) return "Locks";
  if (pathname.startsWith("/reservations")) return "Reservations";
  if (pathname.startsWith("/access")) return "Access";
  if (pathname.startsWith("/team")) return "Team";
  if (pathname.startsWith("/organization/branding-review")) return "Brand Approval";
  if (pathname.startsWith("/organization")) return "Organization";
  if (pathname.startsWith("/staff")) return "Staff Members";
  if (pathname.startsWith("/health")) return "Health Center";
  if (pathname.startsWith("/apms/decision-history")) return "APMS Decision History";
  if (pathname.startsWith("/automation/history")) return "Device Automation History";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/reputation")) return "Reputation";

  // ✅ NUEVO
  if (pathname.startsWith("/admin/sales-followups")) return "Sales Follow-ups";
  if (pathname.startsWith("/admin/financial")) return "Admin Financial";
  if (pathname.startsWith("/admin/demo-center")) return "Demo Center";
  if (pathname.startsWith("/admin/branding")) return "Enterprise Branding";
  if (pathname.startsWith("/admin/review-moderation")) return "Review Moderation";
 
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/integrations/tuya")) return "Tuya Integration";

  return "Dashboard";
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { brand, isCustomBrand } = useBrand();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [canReviewOrganizationBrand, setCanReviewOrganizationBrand] =
    useState(false);
  const logoUrl =
    brand.kind === "CUSTOM_BRAND" ? brand.logoUrl : "/pin-go-logo.png";

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
  "/reputation",
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
        ...(reviewsE1Enabled
          ? [{ to: "/admin/review-moderation", label: "Review Moderation" }]
          : []),
      ]
    : user?.role === "MEMBER"
      ? memberNav
      : organizationNav;
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div
      className="pin-go-app-shell"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "grid",
        gridTemplateColumns: "240px minmax(0, 1fr)",
        overflowX: "hidden",
      }}
    >
      <style>{`
        .pin-go-app-shell__mobile-menu,
        .pin-go-app-shell__mobile-close,
        .pin-go-app-shell__backdrop {
          display: none;
        }

        @media (max-width: 720px) {
          .pin-go-app-shell {
            grid-template-columns: minmax(0, 1fr) !important;
            width: 100%;
            max-width: 100%;
          }

          .pin-go-app-shell__sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            width: min(320px, 86vw);
            max-width: 86vw;
            height: 100dvh;
            box-sizing: border-box;
            overflow-y: auto;
            z-index: 50;
            transform: translateX(-105%);
            transition: transform 180ms ease;
            box-shadow: 12px 0 32px rgba(15, 23, 42, 0.16);
          }

          .pin-go-app-shell__sidebar.is-open {
            transform: translateX(0);
          }

          .pin-go-app-shell__mobile-menu,
          .pin-go-app-shell__mobile-close {
            display: inline-grid !important;
            place-items: center;
            flex: 0 0 auto;
            width: 40px;
            height: 40px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            background: #ffffff;
            color: #111827;
            cursor: pointer;
            font-size: 22px;
            line-height: 1;
          }

          .pin-go-app-shell__mobile-close {
            margin-left: auto;
          }

          .pin-go-app-shell__backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 40;
            border: 0;
            padding: 0;
            background: rgba(15, 23, 42, 0.42);
          }

          .pin-go-app-shell__content {
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }

          .pin-go-app-shell__header {
            min-height: 72px;
            height: auto !important;
            padding: 10px 16px !important;
            gap: 12px;
            box-sizing: border-box;
          }

          .pin-go-app-shell__title-row {
            min-width: 0;
          }

          .pin-go-app-shell__main {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            overflow-x: hidden;
            padding: 16px !important;
          }

          .pin-go-app-shell__org-name {
            display: none;
          }
        }
      `}</style>

      {mobileNavOpen ? (
        <button
          type="button"
          className="pin-go-app-shell__backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="pin-go-primary-navigation"
        className={`pin-go-app-shell__sidebar${mobileNavOpen ? " is-open" : ""}`}
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

          <button
            type="button"
            className="pin-go-app-shell__mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            ×
          </button>
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

      <div
        className="pin-go-app-shell__content"
        style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        <header
          className="pin-go-app-shell__header"
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
          <div
            className="pin-go-app-shell__title-row"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <button
              type="button"
              className="pin-go-app-shell__mobile-menu"
              aria-label="Open navigation"
              aria-controls="pin-go-primary-navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>

            <div style={{ minWidth: 0 }}>
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
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flex: "0 0 auto",
            }}
          >
            <div className="pin-go-app-shell__org-name" style={{ textAlign: "right" }}>
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

        <main className="pin-go-app-shell__main" style={{ padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
