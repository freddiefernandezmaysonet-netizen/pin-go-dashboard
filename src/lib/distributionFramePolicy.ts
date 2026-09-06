const DISTRIBUTION_FRAME_ORIGINS = new Set([
  "https://app.channex.io",
  "https://staging.channex.io",
]);

export function isAllowedDistributionFrameUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      DISTRIBUTION_FRAME_ORIGINS.has(parsed.origin)
    );
  } catch {
    return false;
  }
}
