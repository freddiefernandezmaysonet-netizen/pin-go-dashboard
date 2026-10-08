import { cleanerRequest } from "./cleaner";
export type CleaningRecoveryPolicy = { revision: number; maxDelayMinutes: number; maxAccessExtensionMinutes: number; arrivalSafetyMarginMinutes: number };
export const getCleaningRecoveryPolicy = (propertyId: string) => cleanerRequest<CleaningRecoveryPolicy>(`/api/properties/${encodeURIComponent(propertyId)}/cleaning-recovery-policy`);
export const saveCleaningRecoveryPolicy = (propertyId: string, policy: CleaningRecoveryPolicy) => cleanerRequest<CleaningRecoveryPolicy>(`/api/properties/${encodeURIComponent(propertyId)}/cleaning-recovery-policy`, { method: "PUT", body: JSON.stringify(policy) });
