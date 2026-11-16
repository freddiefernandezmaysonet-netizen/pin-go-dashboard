import assert from "node:assert/strict";
import test from "node:test";
import { parseBookingCampaign } from "./bookingCampaign.ts";
test("recognizes the exact precheckin email link in either language", () => {
  for (const lang of ["es", "en"]) assert.equal(parseBookingCampaign(`?lang=${lang}&utm_source=pingo&utm_medium=email&utm_campaign=precheckin_return_stay`), "precheckin_return_stay");
});
test("untagged, incomplete, duplicated and different campaigns remain unattributed", () => {
  for (const query of ["", "?utm_campaign=precheckin_return_stay", "?utm_source=pingo&utm_medium=social&utm_campaign=precheckin_return_stay", "?utm_source=pingo&utm_medium=email&utm_campaign=other", "?utm_source=pingo&utm_medium=email&utm_campaign=precheckin_return_stay&utm_campaign=other"]) assert.equal(parseBookingCampaign(query), null);
});
