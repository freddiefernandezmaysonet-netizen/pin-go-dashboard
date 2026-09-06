import assert from "node:assert/strict";
import test from "node:test";
import { parseBookingSearchHandoff } from "./bookingSearchHandoff.ts";

const NOW = new Date("2026-09-06T12:00:00-04:00");

test("accepts valid booking search criteria", () => {
  assert.deepEqual(
    parseBookingSearchHandoff(
      "?checkIn=2026-09-15&checkOut=2026-09-18&guests=2",
      NOW
    ),
    { checkIn: "2026-09-15", checkOut: "2026-09-18", guests: 2 }
  );
});

test("rejects malformed or impossible dates", () => {
  assert.equal(
    parseBookingSearchHandoff(
      "?checkIn=2026-09-31&checkOut=2026-10-02&guests=2",
      NOW
    ),
    null
  );
  assert.equal(
    parseBookingSearchHandoff(
      "?checkIn=09-15-2026&checkOut=2026-09-18&guests=2",
      NOW
    ),
    null
  );
});

test("rejects past or non-increasing stays", () => {
  assert.equal(
    parseBookingSearchHandoff(
      "?checkIn=2026-09-05&checkOut=2026-09-08&guests=2",
      NOW
    ),
    null
  );
  assert.equal(
    parseBookingSearchHandoff(
      "?checkIn=2026-09-15&checkOut=2026-09-15&guests=2",
      NOW
    ),
    null
  );
});

test("rejects invalid guest counts", () => {
  for (const guests of ["0", "21", "2.5", "abc", ""]) {
    assert.equal(
      parseBookingSearchHandoff(
        `?checkIn=2026-09-15&checkOut=2026-09-18&guests=${guests}`,
        NOW
      ),
      null
    );
  }
});
