import { api } from "./client";

export type StripeConnectStatus =
  | "NOT_CONNECTED"
  | "ONBOARDING_REQUIRED"
  | "PENDING_VERIFICATION"
  | "READY"
  | "RESTRICTED";

export type OrganizationPayoutStatus = {
  organizationId: string;
  stripeConnectAccountId: string | null;
  status: StripeConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  requirements: unknown;
  lastSyncedAt: string | null;
  canAcceptDirectBookingPayments: boolean;
};

export type PayoutStatusResponse = {
  ok: true;
  payoutStatus: OrganizationPayoutStatus;
};

export type PayoutOnboardingLinkResponse = {
  ok: true;
  onboardingLink: {
    url: string;
    expiresAt: number;
    accountId: string;
    payoutStatus: OrganizationPayoutStatus;
  };
};

export type PayoutDashboardLoginLinkResponse = {
  ok: true;
  loginLink: {
    url: string;
    accountId: string;
  };
};

export type StripeConnectIsolationV2AccountSession = {
  clientSecret: string;
  expiresAt: number;
  accountId: string;
  accountDisplayId: string;
  organizationId: string;
  organizationName: string;
};

export type StripeConnectIsolationV2AccountSessionResponse = {
  ok: true;
  accountSession: StripeConnectIsolationV2AccountSession;
};

export async function getHostPayoutStatus() {
  return api<PayoutStatusResponse>("/api/dashboard/payouts/status");
}

export async function createHostPayoutOnboardingLink() {
  return api<PayoutOnboardingLinkResponse>(
    "/api/dashboard/payouts/onboarding-link",
    {
      method: "POST",
    }
  );
}

export async function createHostPayoutDashboardLoginLink() {
  return api<PayoutDashboardLoginLinkResponse>(
    "/api/dashboard/payouts/login-link",
    {
      method: "POST",
    }
  );
}

export async function createStripeConnectIsolationV2AccountSession() {
  return api<StripeConnectIsolationV2AccountSessionResponse>(
    "/api/dashboard/payouts/connect-isolation-v2/account-session",
    {
      method: "POST",
    }
  );
}

export async function syncHostPayoutStatus() {
  return api<PayoutStatusResponse>("/api/dashboard/payouts/sync", {
    method: "POST",
  });
}
