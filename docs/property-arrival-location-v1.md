# Property arrival location V1

Create and edit forms now support optional complex/building name and apartment/unit.
Values remain strings (including 107B and leading zeros), round-trip through the
existing authenticated property API, and have accessible labels and length limits.
The backend supplies these details in guest arrival/access notifications.

Paired backend: agent/property-arrival-unit-v1 (stacked on backend PR #344).
Deploy backend and additive Property migration first. Preview deployment of this
branch is disabled in vercel.json; publication requires the controlled release.

Requested production data, not saved by this UI commit:
Serena Studio — Las Palmas Doradas — unit 107B.
Do not send test notifications to Serena Studio's real guests.

Validation: focused TypeScript check for both forms and Vite production build pass.
React review found no new fetching effects or dependencies; edits follow existing
state patterns. Live browser review remains pending.
