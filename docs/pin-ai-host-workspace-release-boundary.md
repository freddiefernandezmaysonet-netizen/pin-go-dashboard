# Host workspace: remove the build-time UI gate

Candidate based on Dashboard `54efdb00c4093580a908f7c073aaf3a8cdfd668a`.
Audit 2026-09-27: production Dashboard READY; backend
`6d3db8723b8ec76637ae6f00fdf561626a5097d5` SUCCESS, deployment
`911db412-3d24-4504-90c9-f685397f8425` after the authorized limited activation.

## Exact implementation scope

Remove the VITE_PIN_AI_HOST_INCIDENT_ENABLED dependency from host navigation,
host route and guest updates projection. Existing session/role presentation,
backend authorization, organization isolation and guest token validation remain.
No backend files, database schema, billing, new report settings or operational
state are changed. No new infrastructure variable is needed.

Administrators can see the workspace navigation. The current backend still
restricts access to its explicitly configured organization/reservation canary;
other scopes receive the existing unavailable response. Guest projection 404s
remain hidden. This patch is NOT commercial general availability.

The rejected local organization-report-settings implementation is excluded.
No HostIncidentSettings component or default-enabled incident migration is part
of this branch. Changes here are derived directly from audited main.

Prior docs/pin-ai-host-incident-ui-v1.md describes the original default-off
candidate. This document supersedes only its Vite activation-variable requirement.
Host supervisor/runtime dialog remains future work. The existing workspace is
human operated with explicit reviewed notes, acknowledgement, publication and
single-case resolution.

## Approved commercial design (not implemented by this patch)

The host enables Pin AI through Dashboard for new paid Direct Booking reservations.
Reservations are the canonical source of context and service entitlement. Any
organization must be able to configure the product without infrastructure edits.
OTA, manual and previously paid reservations are outside the initial paid offering.

- USD 1 per enabled new reservation, using the existing Identity Check commission
  mechanism. Audited Direct Booking uses Direct Charge on the host's connected
  account with application_fee_amount for Pin&Go; no separate guest surcharge.
- Normal service window: check-in minus 24 hours through check-out plus 24 hours,
  following the reservation's current dates. Extension adds no second Pin AI fee.
- Open incidents continue receiving follow-up until all are closed. This does
  not extend door credentials or other unrelated action eligibility.
- Cancellation before service begins returns the Pin AI dollar to the host,
  separately from the guest's cancellation refund. After service starts the
  fee remains and only open-incident follow-up continues.
- Disabling Pin AI stops inclusion on new reservations. Already contracted
  reservations retain service. No retroactive enrollment/charge in V1.
- Commercial completion requires removal of temporary scope restrictions and
  certification using a new organization without infrastructure intervention.

Finish the agent capabilities before implementing commercial enablement/billing.
No Stripe action, incident action, message or production setting change is part of
this patch. Ready, merge and deployment still require explicit approval.
