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

export async function syncHostPayoutStatus() {
  return api<PayoutStatusResponse>("/api/dashboard/payouts/sync", {
    method: "POST",
  });
}