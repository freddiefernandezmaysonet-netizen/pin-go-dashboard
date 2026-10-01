export type CalendarDay = {
  date: string;
  rate: number | null;
  minimumNights: number;
  maximumNights: number | null;
  status: "OPEN" | "BOOKED" | "BLOCKED";
};
export type CalendarStay = {
  id: string;
  number: string | null;
  guestName: string | null;
  from: string;
  to: string;
};
export type CalendarProperty = {
  id: string;
  name: string;
  photoUrl: string | null;
  timezone: string;
  today: string | null;
  state: "READY" | "UNAVAILABLE";
  pricingUnavailable: boolean;
  days: CalendarDay[];
  reservations: CalendarStay[];
  blocks: { id: string; from: string; to: string; reason: string | null }[];
};
export type CalendarSnapshot = {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  items: CalendarProperty[];
};
export const shiftDate = (key: string, days: number) =>
  new Date(Date.parse(key) + days * 86400000).toISOString().slice(0, 10);
export const dateKeys = (from: string, count = 14) =>
  Array.from({ length: count }, (_, i) => shiftDate(from, i));
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function validDate(value: string | null): value is string {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function layoutStays(
  stays: CalendarStay[],
  from: string,
  count: number,
) {
  const ends: number[] = [];
  return [...stays]
    .sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id))
    .flatMap((stay) => {
      const start = Math.max(
        0,
        (Date.parse(stay.from) - Date.parse(from)) / 86400000 + 0.5,
      );
      const end = Math.min(
        count,
        (Date.parse(stay.to) - Date.parse(from)) / 86400000 + 0.5,
      );
      if (start >= count || end <= 0 || end <= start) return [];
      let lane = ends.findIndex((last) => last <= start);
      if (lane < 0) lane = ends.length;
      ends[lane] = end;
      return [{ ...stay, start, end, lane }];
    });
}
