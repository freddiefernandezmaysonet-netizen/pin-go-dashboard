// Attribute only the current tagged visit; no identity, cookies or cross-property storage.
export function parseBookingCampaign(search: string): string | null {
  const params = new URLSearchParams(search);
  const expected = { utm_source: "pingo", utm_medium: "email", utm_campaign: "precheckin_return_stay" };
  return Object.entries(expected).every(([key, value]) => params.getAll(key).length === 1 && params.get(key) === value)
    ? expected.utm_campaign : null;
}
