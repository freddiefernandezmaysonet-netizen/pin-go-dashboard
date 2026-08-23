function normalizeApiBase(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }
  return fetchImpl;
}

async function readPayload(response) {
  return response.json().catch(() => ({}));
}

function responseError(payload, fallback) {
  return new Error(payload?.message || payload?.error || fallback);
}

export function dateKeyInTimezone(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function buildManualReservationDateChangeReviewModel({ preview, timezone }) {
  if (!preview?.current || !preview?.proposed) {
    throw new Error("A valid reservation date change preview is required.");
  }

  return {
    reservationUpdatedAt: preview.reservationUpdatedAt,
    current: {
      checkInDate: dateKeyInTimezone(preview.current.checkIn, timezone),
      checkOutDate: dateKeyInTimezone(preview.current.checkOut, timezone),
      nights: nightsBetween(
        dateKeyInTimezone(preview.current.checkIn, timezone),
        dateKeyInTimezone(preview.current.checkOut, timezone),
      ),
      totalAmount: preview.current.totalAmount,
      currency: preview.current.currency,
    },
    proposed: {
      checkInDate: dateKeyInTimezone(preview.proposed.checkIn, timezone),
      checkOutDate: dateKeyInTimezone(preview.proposed.checkOut, timezone),
      nights: Number(preview.proposed.nights ?? 0),
      totalAmount: preview.proposed.totalAmount,
      currency: preview.proposed.currency,
    },
    difference: preview.difference,
    paymentHandledOutsidePinGo: preview.paymentHandledOutsidePinGo === true,
  };
}

export async function requestManualReservationDateChangePreview({
  apiBase,
  reservationId,
  checkInDate,
  checkOutDate,
  fetchImpl = globalThis.fetch,
}) {
  const fetcher = requireFetch(fetchImpl);
  const response = await fetcher(
    `${normalizeApiBase(apiBase)}/api/dashboard/reservations/${encodeURIComponent(reservationId)}/dates/preview`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInDate, checkOutDate }),
    },
  );
  const payload = await readPayload(response);
  if (!response.ok || payload?.ok !== true || !payload?.preview) {
    throw responseError(payload, "Unable to review reservation change.");
  }
  return payload.preview;
}

export async function confirmManualReservationDateChange({
  apiBase,
  reservationId,
  preview,
  timezone,
  fetchImpl = globalThis.fetch,
}) {
  const fetcher = requireFetch(fetchImpl);
  const review = buildManualReservationDateChangeReviewModel({ preview, timezone });
  const response = await fetcher(
    `${normalizeApiBase(apiBase)}/api/dashboard/reservations/${encodeURIComponent(reservationId)}/dates`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkInDate: review.proposed.checkInDate,
        checkOutDate: review.proposed.checkOutDate,
        expectedReservationUpdatedAt: review.reservationUpdatedAt,
        expectedProposedTotalAmount: review.proposed.totalAmount,
      }),
    },
  );
  const payload = await readPayload(response);
  if (!response.ok || payload?.ok !== true) {
    throw responseError(payload, "Unable to update reservation dates.");
  }
  return payload;
}
