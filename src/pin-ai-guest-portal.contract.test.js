import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const assistant = readFileSync(
  new URL("./components/public-booking/GuestPinAIAssistant.tsx", import.meta.url),
  "utf8",
);
const portal = readFileSync(
  new URL("./pages/public-booking/GuestCancellationPage.tsx", import.meta.url),
  "utf8",
);

test("guest portal sends one bounded message to the scoped Pin AI gateway", () => {
  assert.match(assistant, /manage\/\$\{encodeURIComponent\(guestToken\)\}\/pin-ai\/messages/);
  assert.match(assistant, /const MAX_MESSAGE_LENGTH = 2_000/);
  assert.match(assistant, /body: JSON\.stringify\(\{ message: question \}\)/);
  assert.doesNotMatch(assistant, /JSON\.stringify\(\{[^}]*conversation/s);
});

test("guest portal accepts only a complete shadow response", () => {
  for (const invariant of [
    'payload.mode !== "SHADOW"',
    "payload.actionsExecuted !== false",
    "payload.databaseWrites !== false",
    "payload.escalationCreated !== false",
  ]) {
    assert.ok(assistant.includes(invariant), `missing invariant: ${invariant}`);
  }
  assert.match(assistant, /Nothing was sent, approved, or changed\./);
  assert.match(assistant, /Nada fue enviado, aprobado ni cambiado\./);
});

test("guest response is session-only plain text", () => {
  assert.doesNotMatch(assistant, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(assistant, /dangerouslySetInnerHTML/);
  assert.match(assistant, /whiteSpace: "pre-wrap"/);
  assert.match(assistant, /This conversation is not saved yet\./);
  assert.match(assistant, /Esta conversación todavía no se guarda\./);
});

test("reservation portal mounts Pin AI only for an active reservation view", () => {
  assert.match(assistant, /Informational shadow mode/);
  assert.match(portal, /VITE_PIN_AI_GUEST_PORTAL_ENABLED === "true"/);
  assert.match(portal, /import \{ GuestPinAIAssistant \} from "\.\.\/\.\.\/components\/public-booking\/GuestPinAIAssistant"/);
  assert.match(
    portal,
    /!isCancelled && PIN_AI_GUEST_PORTAL_ENABLED \? \(\s*<GuestPinAIAssistant/s,
  );
  assert.match(portal, /guestToken=\{String\(guestToken \?\? ""\)\.trim\(\)\}/);
});
