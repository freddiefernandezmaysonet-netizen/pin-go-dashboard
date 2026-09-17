import { HostPayoutsCard } from "./HostPayoutsCard";
import {
  StripeConnectIsolationV2Card,
  stripeConnectIsolationV2UiEnabled,
} from "./StripeConnectIsolationV2Card";

export function HostPayoutsExperience() {
  if (stripeConnectIsolationV2UiEnabled()) {
    return <StripeConnectIsolationV2Card />;
  }

  return <HostPayoutsCard />;
}

export default HostPayoutsExperience;
