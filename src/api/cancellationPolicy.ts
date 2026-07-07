import { api } from "./client";

export type CancellationPolicyType =
  | "FLEXIBLE"
  | "MODERATE"
  | "FIRM"
  | "STRICT"
  | "CUSTOM"
  | "NON_REFUNDABLE";

export type CancellationRefundBasis =
  | "TOTAL_AMOUNT"
  | "NIGHTLY_SUBTOTAL"
  | "NIGHTLY_PLUS_CLEANING"
  | "CUSTOM";

export type CancellationRefundRule = {
  minHoursBeforeCheckIn: number;
  refundPercent: number;
  label: string;
  description?: string | null;
};

export type CancellationNonRefundableScenario =
  | "EARLY_DEPARTURE"
  | "DELAYED_ARRIVAL"
  | "REDUCED_NIGHTS"
  | "WEATHER_RE_SCHEDULE"
  | "OTHER";

export type DashboardCancellationPolicy = {
  id: string;
  propertyId: string;
  name: string;
  type: CancellationPolicyType;
  source: string;
  isActive: boolean;
  guestSelfCancellationEnabled: boolean;
  autoRefundEligibleCancellations: boolean;
  requireHostApprovalOutsidePolicy: boolean;
  freeCancellationHoursBeforeCheckIn: number;
  refundBasis: CancellationRefundBasis;
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  refundRules: CancellationRefundRule[];
  nonRefundableScenarios: CancellationNonRefundableScenario[];
  guestFacingSummary: string | null;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DefaultCancellationPolicy = {
  policyId: string | null;
  name: string;
  type: CancellationPolicyType;
  source: string;
  guestSelfCancellationEnabled: boolean;
  autoRefundEligibleCancellations: boolean;
  requireHostApprovalOutsidePolicy: boolean;
  freeCancellationHoursBeforeCheckIn: number;
  refundBasis: CancellationRefundBasis;
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  refundRules: CancellationRefundRule[];
  nonRefundableScenarios: CancellationNonRefundableScenario[];
  guestFacingSummary: string | null;
  cleaningFeeRefundable: boolean;
  amenitiesRefundable: boolean;
  taxesRefundable: boolean;
  nonRefundableDiscountPercent: number | null;
  description: string | null;
  snapshotAt: string;
};

export type CancellationPolicyResponse = {
  ok: true;
  property: {
    id: string;
    name: string;
  };
  policy: DashboardCancellationPolicy | null;
  defaultPolicy: DefaultCancellationPolicy;
};

export type SaveCancellationPolicyInput = {
  name?: string;
  type?: CancellationPolicyType;
  guestSelfCancellationEnabled?: boolean;
  autoRefundEligibleCancellations?: boolean;
  requireHostApprovalOutsidePolicy?: boolean;
  freeCancellationHoursBeforeCheckIn?: number;
  refundBasis?: CancellationRefundBasis;
  refundPercentBeforeDeadline?: number;
  refundPercentAfterDeadline?: number;
  refundRules?: CancellationRefundRule[];
  nonRefundableScenarios?: CancellationNonRefundableScenario[];
  guestFacingSummary?: string | null;
  cleaningFeeRefundable?: boolean;
  amenitiesRefundable?: boolean;
  taxesRefundable?: boolean;
  nonRefundableDiscountPercent?: number | null;
  description?: string | null;
};

export type SaveCancellationPolicyResponse = {
  ok: true;
  property: {
    id: string;
    name: string;
  };
  policy: DashboardCancellationPolicy;
};

export async function getCancellationPolicy(propertyId: string) {
  return api<CancellationPolicyResponse>(
    `/api/dashboard/properties/${propertyId}/cancellation-policy`
  );
}

export async function saveCancellationPolicy(
  propertyId: string,
  input: SaveCancellationPolicyInput
) {
  return api<SaveCancellationPolicyResponse>(
    `/api/dashboard/properties/${propertyId}/cancellation-policy`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}