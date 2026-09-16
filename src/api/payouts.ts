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

export type HostPayoutTransaction = {
  reservationId: string;
  reservationNumber: string | null;
  property: {
    id: string;
    name: string;
  };
  createdAt: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  paymentState: string | null;
  guestPaidAmount: number | null;
  pingoPlatformFeeAmount: number | null;
  identityCheckFeeAmount: number | null;
  totalPinGoFeeAmount: number | null;
  applicationFeeAmount: number | null;
  applicationFeeActual: boolean;
  stripeProcessingFeeAmount: number | null;
  stripeProcessingFeeActual: boolean;
  stripeFeeSource: "STRIPE_BALANCE_TRANSACTION" | null;
  recordedHostPayoutAmount: number | null;
  hostNetAmount: number | null;
  hostPayoutStatus: string | null;
  lastSyncedAt: string | null;
};

export type HostPayoutTransactionsResponse = {
  ok: true;
  items: HostPayoutTransaction[];
};

export async function getHostPayoutStatus() {
  return api<PayoutStatusResponse>("/api/dashboard/payouts/status");
}

export async function getHostPayoutTransactions(limit = 10) {
  return api<HostPayoutTransactionsResponse>(
    `/api/dashboard/payouts/transactions?limit=${encodeURIComponent(String(limit))}`
  );
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