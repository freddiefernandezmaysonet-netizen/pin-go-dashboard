import { useEffect, useState } from "react";

type Confirmation = {
  status: "CHECKING" | "PENDING" | "UNVERIFIED" | "UNAVAILABLE" | "CONFIRMED";
  identityVerificationRequired?: boolean;
  pinAIEnabled?: boolean;
  organizationSlug?: string | null;
};
const checking: Confirmation = { status: "CHECKING" };

export function useCheckoutConfirmation({ apiBase, sessionId, pollIntervalMs = 2000, maxAttempts = 15 }: {
  apiBase: string; sessionId: string; pollIntervalMs?: number; maxAttempts?: number;
}): Confirmation {
  const [state, setState] = useState<{ sessionId: string; value: Confirmation }>({ sessionId: "", value: checking });
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (value: Confirmation) => {
      if (!controller.signal.aborted) setState({ sessionId, value });
    };
    if (!/^cs_(?:test|live)_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
      update({ status: "UNVERIFIED" });
      return () => controller.abort();
    }
    update(checking);
    let attempts = 0;
    async function check() {
      try {
        const response = await fetch(`${apiBase}/api/public-booking/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || data?.ok !== true) throw new Error("STATUS_UNAVAILABLE");
        if (data.status === "CONFIRMED") {
          update({ status: "CONFIRMED", identityVerificationRequired: data.identityVerificationRequired !== false,
            pinAIEnabled: data.pinAIEnabled === true,
            organizationSlug: typeof data.organizationSlug === "string" ? data.organizationSlug : null });
        } else if (data.status === "UNAVAILABLE") {
          update({ status: "UNAVAILABLE" });
        } else if (data.status === "PENDING" && ++attempts < maxAttempts) {
          update({ status: "PENDING" });
          timer = setTimeout(() => { void check(); }, pollIntervalMs);
        } else {
          update({ status: "UNVERIFIED" });
        }
      } catch {
        update({ status: "UNVERIFIED" });
      }
    }
    void check();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [apiBase, sessionId, pollIntervalMs, maxAttempts]);
  return state.sessionId === sessionId ? state.value : checking;
}
