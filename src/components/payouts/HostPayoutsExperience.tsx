import { useEffect, useState } from "react";
import {
  getStripeConnectV2Eligibility,
  type StripeConnectV2EligibilityResponse,
} from "../../api/payouts";
import { StripeConnectIsolationV2Card } from "./StripeConnectIsolationV2Card";

export function HostPayoutsExperience() {
  const [eligibility, setEligibility] = useState<
    StripeConnectV2EligibilityResponse["eligibility"] | null
  >(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setEligibility(null);

    getStripeConnectV2Eligibility()
      .then((response) => {
        if (!cancelled) {
          if (response.eligibility?.eligible === true) {
            setEligibility(response.eligibility);
          } else {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retry]);

  if (eligibility?.eligible) {
    return (
      <StripeConnectIsolationV2Card
        accountCreationAllowed={eligibility.accountCreationAllowed}
      />
    );
  }

  if (error) return (
    <section aria-label="Payments & Payouts">
      <h3>Payments &amp; Payouts</h3>
      <p role="alert">Unable to load payment setup. No account changes were made.</p>
      <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
    </section>
  );

  return <p role="status">Loading Payments &amp; Payouts…</p>;
}

export default HostPayoutsExperience;
