export type BookingSearchHandoff = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function localTodayKey(now: Date) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseBookingSearchHandoff(
  search: string,
  now = new Date()
): BookingSearchHandoff | null {
  const params = new URLSearchParams(search);
  const checkIn = params.get("checkIn")?.trim() ?? "";
  const checkOut = params.get("checkOut")?.trim() ?? "";
  const guestsRaw = params.get("guests")?.trim() ?? "";

  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    return null;
  }

  if (checkIn < localTodayKey(now) || checkOut <= checkIn) {
    return null;
  }

  if (!/^\d+$/.test(guestsRaw)) {
    return null;
  }

  const guests = Number(guestsRaw);
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 20) {
    return null;
  }

  return { checkIn, checkOut, guests };
}
