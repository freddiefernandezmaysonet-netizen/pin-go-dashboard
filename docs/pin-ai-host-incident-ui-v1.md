# Pin AI Host Incident UI V1

Candidate based on dashboard main d37822e832800c92b23cd1aa2efbc3872fb1db62.
Backend contract: PR #295, deployed at 6d3db8723b8ec76637ae6f00fdf561626a5097d5.
No production communication, incident write, activation, merge or deployment was
performed while implementing this frontend.

## User flow

- Authenticated dashboard route `/pin-ai/incidents/:reference?`, linked from the
  sidebar only for ORG_ADMIN, ADMIN or PLATFORM_ADMIN when enabled.
- Organization identity comes from the existing session. Backend validates fresh
  roles and exact organization/reservation scope on every request. The UI role
  check is presentation only. Workspace remounts on organization/user/role change.
- Case list supports server pagination and a search explicitly limited to loaded
  cases. Selecting a case reads its canonical state and complete paginated history.
- Read operations do not acknowledge or close the case. Internal notes, explicit
  acknowledgement, guest-visible publication and single-case resolution each
  require review and confirmation. Resolution notes remain internal; resolved
  state is visible through canonical guest status. No repair is independently
  verified merely by the host closing a case.
- POST requests carry only requestId, expectedVersion, operation and exact text.
  A lost server response freezes new actions and retries the exact same request.
  Conflicts require a fresh read and review. No automatic mutation retry occurs.
  Pending request identity is in memory only: leaving/reloading the page requires
  inspecting server history before issuing another action. Draft notes are not
  persisted in browser storage.
- GuestIncidentUpdates reads only the dedicated public projection, with no host
  cookies. Published updates appear separately from the existing Pin AI chat and
  cannot overwrite its history. It refreshes on mount, window focus and explicitly
  via its refresh button when visible; no constant polling or email send occurs.
- Guest projection is mounted within the existing PRE_STAY/IN_STAY portal gate.
  Existing guest expiry and active reservation checks remain authoritative.
- Backend 404 hides the guest section; a host 404 explains capability/case
  unavailability. History failures never become writable empty conversations.
- Both host and guest text are rendered as plain React text (no HTML injection).

## Release gate

`VITE_PIN_AI_HOST_INCIDENT_ENABLED=true` enables the UI. It defaults OFF and has
not been configured on Vercel. Backend independent enable flag, organization AND
reservation allowlists and encryption keys are also required. No guest publication
is available in production from this implementation until activation is authorized.

This is a human-operated incident workspace, not the host AI runtime. Host AI
responses, supervisor delegation, approval policies, notification email deep-link
changes and a new email sender remain separate future slices. Existing Messages,
Access/TTLock, OTA, payment and reservation engines are unchanged.

## Validation

12 synthetic React DOM/API tests cover explicit publication, private notes,
acknowledgement without publishing a draft, canonical history restoration,
version conflicts, exact request retry, single-case resolution, late responses
from another case, access denial, guest-token-only reads and default-off behavior.
56 existing guest chat/session isolation tests passed locally. Production Vite
build passed. New API/workspace/guest components pass strict TypeScript. The page
wrapper is checked using the existing non-strict auth boundary configuration:
turning strict on for that dependency exposes pre-existing HeadersInit errors in
src/api/auth.ts (unchanged). Existing AppShell effect cleanup lint warning and
Vite large-chunk warning remain; focused lint has no errors.

CI repeats interaction/regression tests, typechecks, lint and disabled/enabled
builds. Real browser/mobile visual review and production end-to-end certification
remain pending. The agent-browser CLI was not available in this workspace.
