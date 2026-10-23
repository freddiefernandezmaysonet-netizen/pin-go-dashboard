const STANDARD_BOOKING_HOSTS = new Set([
  "app.pin-ngo.com",
  "pin-ngo.com",
  "www.pin-ngo.com",
]);

/** Keep custom domains and local/preview environments on their own origin. */
export function resolvePublicBookingOrigin(currentOrigin: string, configuredOrigin?: string): string {
  const current = new URL(currentOrigin);
  if (STANDARD_BOOKING_HOSTS.has(current.hostname)) return "https://pin-ngo.com";
  return (configuredOrigin?.trim() || currentOrigin).replace(/\/+$/, "");
}
