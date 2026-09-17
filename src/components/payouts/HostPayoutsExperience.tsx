import { useEffect, useState } from "react";
import {
  getStripeConnectV2Eligibility,
  type StripeConnectV2EligibilityResponse,
} from "../../api/payouts";
import { HostPayoutsCard } from "./HostPayoutsCard";
import { StripeConnectIsolationV2Card } from "./StripeConnectIsolationV2Card";

export function HostPayoutsExperience() {
  const [eligibility, setEligibility] = useState<
    StripeConnectV2EligibilityResponse["eligibility"] | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    getStripeConnectV2Eligibility()
      .then((response) => {
        if (!cancelled) {
          setEligibility(response.eligibility);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEligibility({
            eligible: false,
            accountCreationAllowed: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (eligibility?.eligible) {
    return (
      <StripeConnectIsolationV2Card
        accountCreationAllowed={eligibility.accountCreationAllowed}
      />
    );
  }

  return <HostPayoutsCard />;
}

export default HostPayoutsExperience;
