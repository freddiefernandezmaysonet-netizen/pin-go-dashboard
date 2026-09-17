import { useEffect, useState } from "react";
import { getStripeConnectV2Eligibility } from "../../api/payouts";
import { HostPayoutsCard } from "./HostPayoutsCard";
import {
  StripeConnectIsolationV2Card,
  stripeConnectIsolationV2UiEnabled,
} from "./StripeConnectIsolationV2Card";

export function HostPayoutsExperience() {
  const [canUseV2, setCanUseV2] = useState(false);

  useEffect(() => {
    if (!stripeConnectIsolationV2UiEnabled()) {
      setCanUseV2(false);
      return;
    }

    let cancelled = false;

    getStripeConnectV2Eligibility()
      .then((response) => {
        if (!cancelled) {
          setCanUseV2(response.eligibility.eligible);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanUseV2(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (stripeConnectIsolationV2UiEnabled() && canUseV2) {
    return <StripeConnectIsolationV2Card />;
  }

  return <HostPayoutsCard />;
}

export default HostPayoutsExperience;
