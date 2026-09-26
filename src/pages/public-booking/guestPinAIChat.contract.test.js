import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";

const chat = readFileSync(
  new URL("./GuestPinAIChat.tsx", import.meta.url),
  "utf8",
);
const portal = readFileSync(
  new URL("./GuestCancellationPage.tsx", import.meta.url),
  "utf8",
);
const packageManifest = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
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

test("Pin AI renders assistant Markdown through a constrained safe surface", () => {
  assert.equal(packageManifest.dependencies["react-markdown"], "^10.1.0");
  assert.match(chat, /lazy\(\(\) => import\("react-markdown"\)\)/);
  assert.match(chat, /<Suspense fallback=\{null\}>/);
  assert.match(chat, /if \(message\.role === "guest"\)/);
  assert.match(chat, /return <>\{message\.text\}<\/>/);
  assert.match(
    chat,
    /const PIN_AI_MARKDOWN_ELEMENTS = \[\s*"p",\s*"strong",\s*"em",\s*"ul",\s*"ol",\s*"li",\s*"br",\s*\]/,
  );
  assert.match(chat, /allowedElements=\{PIN_AI_MARKDOWN_ELEMENTS\}/);
  assert.match(chat, /skipHtml/);
  assert.match(chat, /unwrapDisallowed/);
  assert.doesNotMatch(chat, /dangerouslySetInnerHTML/);
});

test("Pin AI formats emphasis while dropping HTML, links, and images", () => {
  const html = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        allowedElements: ["p", "strong", "em", "ul", "ol", "li", "br"],
        skipHtml: true,
        unwrapDisallowed: true,
      },
      "Promedio de **4.5 sobre 5**. <script>alert(1)</script> " +
        "[enlace](javascript:alert(1)) ![imagen](https://example.com/x.png)",
    ),
  );

  assert.match(html, /<strong>4\.5 sobre 5<\/strong>/);
  assert.doesNotMatch(html, /\*\*|script|href=|<img/i);
});

test("guest reservation portal mounts Pin AI with the existing URL token and API base", () => {
  assert.match(
    portal,
    /import \{ GuestPinAIChat \} from "\.\/GuestPinAIChat";/,
  );
  assert.match(portal, /guestToken && preview\?\.reservation/);
  assert.match(
    portal,
    /<GuestPinAIChat apiBase=\{API_BASE\} guestToken=\{guestToken\} \/>/,
  );
});


test("Pin AI renders structured reservation-action quotes without exposing the confirmation credential", () => {
  assert.match(chat, /actionProposal\?: ReservationActionProposal/);
  assert.match(chat, /<ReservationActionCard/);
  assert.match(chat, /quoteExpiresAt/);
  assert.match(chat, /propertyTimezone/);
  assert.match(chat, /availabilityHeld: false/);
  assert.match(chat, /Las fechas no están retenidas/);
  assert.match(chat, /Dates are not held/);

  assert.doesNotMatch(
    chat,
    /\{proposal\.confirmationToken\}/,
  );
  assert.doesNotMatch(
    chat,
    /confirmationToken\}\s*<\//,
  );
});

test("Pin AI confirmation control posts only the private token to the certified action endpoint", () => {
  assert.match(
    chat,
    /\/pin-ai\/action-proposals\/\$\{encodeURIComponent\(proposal\.proposalId\)\}\/confirm/,
  );
  assert.match(chat, /method:\s*"POST"/);
  assert.match(
    chat,
    /JSON\.stringify\(\{ confirmationToken: proposal\.confirmationToken \}\)/,
  );
  assert.doesNotMatch(
    chat,
    /JSON\.stringify\(\{[^}]*proposalId:/,
  );
  assert.match(chat, /type="button"/);
  assert.match(chat, /Confirmar cambio/);
  assert.match(chat, /Confirm change/);
});

test("Pin AI confirmation UI maps canonical action outcomes without claiming success early", () => {
  assert.match(chat, /"EXECUTED"/);
  assert.match(chat, /"WAITING_FOR_PAYMENT"/);
  assert.match(chat, /"WAITING_FOR_HOST"/);
  assert.match(chat, /"REVIEW_REQUIRED"/);
  assert.match(chat, /Cambio confirmado/);
  assert.match(chat, /Payment is required to complete this change/);
  assert.match(chat, /Pendiente de revisión del anfitrión/);
  assert.match(chat, /La cotización debe actualizarse antes de continuar/);
  assert.match(chat, /result\?\.outcome === "WAITING_FOR_PAYMENT"/);
  assert.match(chat, /result\.checkoutUrl/);
});

test("Pin AI confirmation UI handles invalid, expired, unavailable, and review-required actions", () => {
  assert.match(chat, /INVALID_CONFIRMATION/);
  assert.match(chat, /ACTION_PROPOSAL_NOT_FOUND/);
  assert.match(chat, /ACTION_REVIEW_REQUIRED/);
  assert.match(chat, /PIN_AI_ACTIONS_UNAVAILABLE/);
  assert.match(chat, /Pídele a Pin AI una nueva cotización/);
  assert.match(chat, /Ask Pin AI for an updated quote/);
});
