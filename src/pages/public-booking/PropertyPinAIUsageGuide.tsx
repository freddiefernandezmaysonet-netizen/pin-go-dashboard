import { useEffect, useState } from "react";
import { PinAIUsageGuide } from "./GuestStayGuide";

type Props = Readonly<{
  apiBase: string;
  organizationSlug: string;
  propertySlug: string;
  language: "en" | "es";
}>;

// Reset eligibility immediately when the property changes. URL flags and local
// storage never decide whether this accommodation offers Pin AI.
export function PropertyPinAIUsageGuide(props: Props) {
  return <VerifiedPropertyPinAIUsageGuide key={JSON.stringify([
    props.apiBase, props.organizationSlug, props.propertySlug,
  ])} {...props} />;
}

function VerifiedPropertyPinAIUsageGuide({ apiBase, organizationSlug, propertySlug, language }: Props) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!organizationSlug || !propertySlug) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `${apiBase}/api/public-booking/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(propertySlug)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!controller.signal.aborted) {
          setEnabled(response.ok && data?.ok === true &&
            data.property?.slug === propertySlug &&
            data.property?.organization?.slug === organizationSlug &&
            data.property?.pinAIEnabled === true);
        }
      } catch {
        if (!controller.signal.aborted) setEnabled(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [apiBase, organizationSlug, propertySlug]);
  return <PinAIUsageGuide language={language} enabled={enabled} />;
}
