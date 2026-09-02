export const reviewsE1Enabled =
  String(import.meta.env.VITE_PINGO_REVIEWS_E1_ENABLED ?? "false")
    .trim()
    .toLowerCase() === "true";
