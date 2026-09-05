/* eslint-disable react-refresh/only-export-components -- Router modules intentionally export route configuration alongside route components. */
import { lazy, Suspense, type ReactElement, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { OverviewPage } from "../../pages/overview/OverviewPage";
import { ReservationsPage } from "../../pages/reservations/ReservationsPage";
import { ReservationDetailPage } from "../../pages/reservation-detail/ReservationDetailPage";
import { ManualReservationDateChangePanel } from "../../components/reservations/ManualReservationDateChangePanel";
import { LocksPage } from "../../pages/locks/LocksPage";
import { AccessPage } from "../../pages/access/AccessPage";
import { PropertiesPage } from "../../pages/properties/PropertiesPage";
import { PropertyDetailPage } from "../../pages/property-detail/PropertyDetailPage";
import { PropertyEditPage } from "../../pages/properties/PropertyEditPage";
import { PropertyCalendarPage } from "../../pages/properties/PropertyCalendarPage";
import { ConnectionCenterPage } from "../../pages/distribution/ConnectionCenterPage";
import { PropertyCalendarStayRestrictionsPanel } from "../../components/properties/PropertyCalendarStayRestrictionsPanel";
import { LockDetailPage } from "../../pages/lock-detail/LockDetailPage";
import { PmsConnectionsPage } from "../../pages/integrations/PmsConnectionsPage";
import TuyaIntegrationPremiumPage from "../../pages/integrations/TuyaIntegrationPremiumPage";
import TuyaIntegrationPage from "../../pages/integrations/TuyaIntegrationPage";
import ListingsMappingPage from "../../pages/pms/ListingsMappingPage";
import LoginPage from "../../pages/LoginPage";
import SignupPage from "../../pages/auth/SignupPage";
import SignupSuccessPage from "../../pages/auth/SignupSuccessPage";
import OrganizationInvitationPage from "../../pages/auth/OrganizationInvitationPage";
import { RequireAuth } from "../../auth/RequireAuth";
import CreatePropertyPage from "../../pages/onboarding/CreatePropertyPage";
import TtlockConnectPage from "../../pages/integrations/TtlockConnectPage";
import NfcSyncPage from "../../pages/dashboard/locks/NfcSyncPage";
import { BillingPage } from "../../pages/dashboard/BillingPage";
import BillingSuccessPage from "../../pages/dashboard/BillingSuccessPage";
import BillingCancelPage from "../../pages/dashboard/BillingCancelPage";
import { HealthCenterPage } from "../../pages/health-center/HealthCenterPage";
import { StaffMembersPage } from "../../pages/staff/StaffMembersPage";
import ForgotPasswordPage from "../../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../../pages/auth/ResetPasswordPage";
import DeviceAutomationHistoryPage from "../../pages/DeviceAutomationHistoryPage";
import ApmsDecisionHistoryPage from "../../pages/ApmsDecisionHistoryPage";
import MessagesPage from "../../pages/messages/MessagesPage";
import TeamPage from "../../pages/TeamPage";
import AdminFinancialPage from "../../pages/admin/AdminFinancialPage";
import LandingPage from "../../pages/LandingPage";
import TermsPage from "../../pages/TermsPage";
import PrivacyPage from "../../pages/PrivacyPage";
import SupportPolicyPage from "../../pages/SupportPolicyPage";
import BillingPolicyPage from "../../pages/BillingPolicyPage";
import OnboardingPage from "../../pages/OnboardingPage";
import AdminSalesFollowupsPage from "../../pages/admin/AdminSalesFollowupsPage";
import AdminDemoCenterPage from "../../pages/admin/AdminDemoCenterPage";
import AdminBrandingPage from "../../pages/admin/AdminBrandingPage";
import PublicBookingSitePage from "../../pages/public-booking/PublicBookingSitePage";
import PublicPropertyDetailPage from "../../pages/public-booking/PublicPropertyDetailPage";
import PublicBookingSuccessPage from "../../pages/public-booking/PublicBookingSuccessPage";
import PublicBookingCancelPage from "../../pages/public-booking/PublicBookingCancelPage";
import GuestCancellationPage from "../../pages/public-booking/GuestCancellationPage";
import OrganizationSettingsPage from "../../pages/organization/OrganizationSettingsPage";
import OrganizationBrandingReviewPage from "../../pages/organization/OrganizationBrandingReviewPage";
import { HostPayoutsCard } from "../../components/payouts/HostPayoutsCard";
import { useAuth } from "../../auth/AuthProvider";
import { useBrand } from "../../branding/BrandProvider";
import { shouldShowLegacyPmsUi } from "../../lib/dashboardPresentation";
import { reviewsE1Enabled } from "../../lib/reviewsConfig";

const GuestReviewPage = lazy(() => import("../../pages/public-booking/GuestReviewPage"));
const ReputationPage = lazy(() => import("../../pages/reputation/ReputationPage"));
const AdminReviewModerationPage = lazy(() => import("../../pages/admin/AdminReviewModerationPage"));

function ReviewRouteBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div role="status" style={{ padding: 24 }}>Loading reviews…</div>}>
      {children}
    </Suspense>
  );
}


function RootRedirect() {
  const host = window.location.hostname;
  const { isCustomBrand } = useBrand();

  if (
    isCustomBrand ||
    host === "app.pin-ngo.com" ||
    host.endsWith(".vercel.app")
  ) {
    return <Navigate to="/overview" replace />;
  }

  return <Navigate to="/home" replace />;
}

function LandingRoute() {
  const { isCustomBrand } = useBrand();
  return isCustomBrand ? <Navigate to="/overview" replace /> : <LandingPage />;
}

function StandardBrandRoute({ children }: { children: ReactElement }) {
  const { isCustomBrand } = useBrand();
  return isCustomBrand ? <Navigate to="/login" replace /> : children;
}

function BrandOrganizationRoute({ children }: { children: ReactElement }) {
  const { brand } = useBrand();
  const { organizationSlug } = useParams();
  const requestedSlug = String(organizationSlug ?? "").trim().toLowerCase();

  if (
    brand.kind === "CUSTOM_BRAND" &&
    requestedSlug !== brand.organizationSlug
  ) {
    return <Navigate to={`/book/${brand.organizationSlug}`} replace />;
  }

  return children;
}

function PlatformAdminRoute({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user?.role === "PLATFORM_ADMIN" ? (
    children
  ) : (
    <Navigate to="/overview" replace />
  );
}

function OrganizationBrandReviewerRoute({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user?.role === "ORG_ADMIN" || user?.role === "ADMIN" ? (
    children
  ) : (
    <Navigate to="/overview" replace />
  );
}

function ReviewManagerRoute({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user?.role === "ORG_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "PLATFORM_ADMIN" ? (
    children
  ) : (
    <Navigate to="/overview" replace />
  );
}

function OrganizationRoute() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <OrganizationSettingsPage />
      <HostPayoutsCard />
    </div>
  );
}

function PropertyDetailRoute() {
  return <PropertyDetailPage />;
}

function PropertyCalendarRoute() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PropertyCalendarStayRestrictionsPanel />
      <PropertyCalendarPage />
    </div>
  );
}

function ReservationDetailRoute() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <ManualReservationDateChangePanel />
      <ReservationDetailPage />
    </div>
  );
}

export const router = createBrowserRouter([
 
  {
  path: "/home",
  element: <LandingRoute />,
  },
  {
  path: "/book/:organizationSlug",
  element: (
    <BrandOrganizationRoute>
      <PublicBookingSitePage />
    </BrandOrganizationRoute>
  ),
  },
  {
  path: "/book/:organizationSlug/:propertySlug",
  element: (
    <BrandOrganizationRoute>
      <PublicPropertyDetailPage />
    </BrandOrganizationRoute>
  ),
  },
  {
  path: "/booking/success",
  element: <PublicBookingSuccessPage />,
  },
  {
  path: "/booking/cancel",
  element: <PublicBookingCancelPage />,
  },
  {
  path: "/booking/manage/:guestToken",
  element: <GuestCancellationPage />,
  },
  ...(reviewsE1Enabled
    ? [{ path: "/review", element: <ReviewRouteBoundary><GuestReviewPage /></ReviewRouteBoundary> }]
    : []),
  {
  path: "/",
  element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/organization-invitation",
    element: <OrganizationInvitationPage />,
  },
  {
    path: "/signup",
    element: (
      <StandardBrandRoute>
        <SignupPage />
      </StandardBrandRoute>
    ),
  },
  { 
    path: "/legal/terms",
    element: <TermsPage /> 
  },
  { 
    path: "/legal/privacy",
    element: <PrivacyPage /> 
  },
  { 
  path: "/legal/support-policy",
  element: <SupportPolicyPage /> 
  },
  { 
  path: "/legal/billing-policy",
  element: <BillingPolicyPage /> 
  },
  {
    path: "/signup/success",
    element: (
      <StandardBrandRoute>
        <SignupSuccessPage />
      </StandardBrandRoute>
    ),
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },

  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <Navigate to="/overview" replace /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      { path: "/onboarding/property", element: <CreatePropertyPage /> },
      { path: "/overview", element: <OverviewPage /> },

      { path: "/properties", element: <PropertiesPage /> },
      { path: "/properties/:id", element: <PropertyDetailRoute /> },
      { path: "/properties/:id/edit", element: <PropertyEditPage /> },
      { path: "/properties/:id/calendar", element: <PropertyCalendarRoute /> },
      { path: "/properties/:id/distribution", element: <ConnectionCenterPage /> },
     
      { path: "/locks", element: <LocksPage /> },
      { path: "/locks/nfc-sync", element: <NfcSyncPage /> },
      { path: "/locks/:id", element: <LockDetailPage /> },

      { path: "/reservations", element: <ReservationsPage /> },
      { path: "/reservations/:id", element: <ReservationDetailRoute /> },

      { path: "/access", element: <AccessPage /> },
      { path: "/staff", element: <StaffMembersPage /> },
      { path: "/team", element: <TeamPage /> },
      { path: "/organization", element: <OrganizationRoute /> },
      {
        path: "/organization/branding-review",
        element: (
          <OrganizationBrandReviewerRoute>
            <OrganizationBrandingReviewPage />
          </OrganizationBrandReviewerRoute>
        ),
      },
      
      { path: "/health", element: <HealthCenterPage /> },
      { path: "/automation/history", element: <DeviceAutomationHistoryPage /> },
      { path: "/apms/decision-history", element: <ApmsDecisionHistoryPage /> },
      { path: "/messages", element: <MessagesPage /> },
      ...(reviewsE1Enabled
        ? [{ path: "/reputation", element: <ReviewManagerRoute><ReviewRouteBoundary><ReputationPage /></ReviewRouteBoundary></ReviewManagerRoute> }]
        : []),
           
      { path: "/billing", element: <BillingPage /> },
      { path: "/billing/success", element: <BillingSuccessPage /> },
      { path: "/billing/cancel", element: <BillingCancelPage /> },

      {
        path: "/admin/branding",
        element: (
          <PlatformAdminRoute>
            <AdminBrandingPage />
          </PlatformAdminRoute>
        ),
      },
      ...(reviewsE1Enabled
        ? [{ path: "/admin/review-moderation", element: <PlatformAdminRoute><ReviewRouteBoundary><AdminReviewModerationPage /></ReviewRouteBoundary></PlatformAdminRoute> }]
        : []),

      {
        path: "/integrations/pms",
        element: shouldShowLegacyPmsUi() ? (
          <PmsConnectionsPage />
        ) : (
          <Navigate to="/overview" replace />
        ),
      },
      { path: "/integrations/ttlock", element: <TtlockConnectPage /> },
      { path: "/integrations/tuya-premium", element: <TuyaIntegrationPremiumPage /> },
      { path: "/integrations/tuya", element: <TuyaIntegrationPage /> },
      {
        path: "/integrations/pms/listings-mapping",
        element: shouldShowLegacyPmsUi() ? (
          <ListingsMappingPage />
        ) : (
          <Navigate to="/overview" replace />
        ),
      },
    ],
  },

{
  path: "/admin/sales-followups",
  element: (
    <RequireAuth>
      <PlatformAdminRoute>
        <AdminSalesFollowupsPage />
      </PlatformAdminRoute>
    </RequireAuth>
  ),
},

 {
  path: "/admin/demo-center",
  element: (
    <RequireAuth>
      <PlatformAdminRoute>
        <AdminDemoCenterPage />
      </PlatformAdminRoute>
    </RequireAuth>
  ),
},

{
    path: "/admin/financial",
    element: (
      <RequireAuth>
        <PlatformAdminRoute>
          <AdminFinancialPage />
        </PlatformAdminRoute>
      </RequireAuth>
    ),
  },
]);
