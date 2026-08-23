import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManualReservationDateChangeReviewModel,
  confirmManualReservationDateChange,
  requestManualReservationDateChangePreview,
} from "./manualReservationDateChangeFlow.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

const previewPayload = {
  reservationUpdatedAt: "2026-08-23T15:00:00.000Z",
  current: {
    checkIn: "2026-09-11T20:00:00.000Z",
    checkOut: "2026-09-13T15:00:00.000Z",
    totalAmount: 225,
    currency: "usd",
  },
  proposed: {
    checkIn: "2026-09-15T20:00:00.000Z",
    checkOut: "2026-09-18T15:00:00.000Z",
    nights: 3,
    totalAmount: 375,
    currency: "usd",
  },
  difference: 150,
  paymentHandledOutsidePinGo: true,
};

test("review then confirm uses only the backend preview as the confirmation source of truth", async () => {
  const calls = [];
  const responses = [
    jsonResponse(200, { ok: true, preview: previewPayload }),
    jsonResponse(200, { ok: true, reservation: { id: "reservation/1" } }),
  ];
  const fetchMock = async (url, init) => {
    calls.push({ url, init });
    return responses.shift();
  };

  const preview = await requestManualReservationDateChangePreview({
    apiBase: "https://api.example.test/",
    reservationId: "reservation/1",
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-18",
    fetchImpl: fetchMock,
  });

  assert.equal(calls.length, 1, "review must not confirm or mutate automatically");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(
    calls[0].url,
    "https://api.example.test/api/dashboard/reservations/reservation%2F1/dates/preview",
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-18",
  });

  const initialReservationDates = {
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-12",
  };
  const review = buildManualReservationDateChangeReviewModel({
    preview,
    timezone: "America/Puerto_Rico",
  });

  assert.deepEqual(review.current, {
    checkInDate: "2026-09-11",
    checkOutDate: "2026-09-13",
    nights: 2,
    totalAmount: 225,
    currency: "usd",
  });
  assert.notDeepEqual(
    {
      checkInDate: review.current.checkInDate,
      checkOutDate: review.current.checkOutDate,
    },
    initialReservationDates,
    "Current must come from preview.current rather than the stale initial reservation GET",
  );
  assert.deepEqual(review.proposed, {
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-18",
    nights: 3,
    totalAmount: 375,
    currency: "usd",
  });
  assert.equal(review.difference, 150);

  const result = await confirmManualReservationDateChange({
    apiBase: "https://api.example.test/",
    reservationId: "reservation/1",
    preview,
    timezone: "America/Puerto_Rico",
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(
    calls[1].url,
    "https://api.example.test/api/dashboard/reservations/reservation%2F1/dates",
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-18",
    expectedReservationUpdatedAt: "2026-08-23T15:00:00.000Z",
    expectedProposedTotalAmount: 375,
  });
});

test("preview errors surface without issuing a confirmation request", async () => {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(409, {
      ok: false,
      error: "RESERVATION_DATE_CHANGE_CONFLICT",
      message: "The proposed dates conflict with another active reservation.",
    });
  };

  await assert.rejects(
    requestManualReservationDateChangePreview({
      apiBase: "https://api.example.test",
      reservationId: "reservation-1",
      checkInDate: "2026-09-15",
      checkOutDate: "2026-09-18",
      fetchImpl: fetchMock,
    }),
    /conflict with another active reservation/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
});

test("stale confirmation requires a new review and preserves the reviewed fence payload", async () => {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(409, {
      ok: false,
      error: "RESERVATION_CHANGED_REVIEW_REQUIRED",
      message: "The reservation changed after the preview. Review the change again before confirming.",
    });
  };

  await assert.rejects(
    confirmManualReservationDateChange({
      apiBase: "https://api.example.test",
      reservationId: "reservation-1",
      preview: previewPayload,
      timezone: "America/Puerto_Rico",
      fetchImpl: fetchMock,
    }),
    /Review the change again before confirming/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-18",
    expectedReservationUpdatedAt: "2026-08-23T15:00:00.000Z",
    expectedProposedTotalAmount: 375,
  });
});
