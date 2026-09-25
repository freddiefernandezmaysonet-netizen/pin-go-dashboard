import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chat = readFileSync(
  new URL("./GuestPinAIChat.tsx", import.meta.url),
  "utf8",
);
const portal = readFileSync(
  new URL("./GuestCancellationPage.tsx", import.meta.url),
  "utf8",
);

test("Pin AI beta chat uses the certified guest-facing message endpoint", () => {
  assert.match(
    chat,
    /\/api\/public-booking\/manage\/\$\{encodeURIComponent\(guestToken\)\}\/pin-ai\/messages/,
  );
  assert.match(chat, /method:\s*"POST"/);
  assert.match(chat, /JSON\.stringify\(\{ message \}\)/);
  assert.doesNotMatch(chat, /guestToken:\s*guestToken/);
});

test("Pin AI beta chat keeps the guest request bounded and review-aware", () => {
  assert.match(chat, /const MAX_MESSAGE_LENGTH = 2_000/);
  assert.match(chat, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
  assert.match(chat, /payload\.requiresHumanReview === true/);
  assert.match(chat, /needs review before any change is made/);
  assert.match(chat, /necesita revisión antes de realizar cualquier cambio/);
});

test("Pin AI beta chat handles unavailable, busy, and invalid reservation states", () => {
  assert.match(chat, /status === 409/);
  assert.match(chat, /PIN_AI_BUSY/);
  assert.match(chat, /status === 404/);
  assert.match(chat, /RESERVATION_NOT_FOUND/);
  assert.match(chat, /status === 503/);
  assert.match(chat, /PIN_AI_UNAVAILABLE/);
});

test("guest reservation portal mounts Pin AI with the existing URL token and API base", () => {
  assert.match(
    portal,
    /import \{ GuestPinAIChat \} from "\.\/GuestPinAIChat";/,
  );
  assert.match(
    portal,
    /<GuestPinAIChat apiBase=\{API_BASE\} guestToken=\{guestToken\} \/>/,
  );
});
