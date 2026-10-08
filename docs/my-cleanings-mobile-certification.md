# Mis limpiezas — mobile browser evidence

Backend candidate `72dce9f9774f691545e7326d1fc32a95ebef3a87` passed all 68 returned CI workflows, including native PostgreSQL cleaning and OTA Initial Distribution. Backend PR: https://github.com/freddiefernandezmaysonet-netizen/pin-go-backend/pull/376

Cleaner browser candidate `652b21fda3c4d6672bcb984458a66e2954d7ebb3` passed: https://github.com/freddiefernandezmaysonet-netizen/pin-go-dashboard/actions/runs/37720733587

The browser log reports seven mobile states with no horizontal overflow, page errors or unexpected requests. Buttons and selects are at least 44px high. The fixture loads the real React components, cleaner CSS and global application CSS with isolated synthetic API replies. It never signs into or calls production. Playwright tooling is installed separately, retaining the application lockfile dependencies.

## States reviewed

- Spanish, 390px: confirmed work, checklist in read-only mode, delay report.
- Spanish, 320px: cancellation confirmation before the window.
- English, 320px: confirmed work and translated checklist/report/cancellation.
- English, 320px: Upcoming.
- English, 320px: History with explicit recorded completion.
- English, 320px: started work, checklist saved, incomplete-work selection, no cancel control.
- Spanish, 390px: started work and incomplete-work selection.

The screenshots were inspected directly: text wraps within the cards, work and access are distinct, report fields remain usable, and controls remain inside the viewport. At 320px the native English incomplete-work select abbreviates the selected option visually; opening the select exposes its full option. No product redesign was made during this review.

An ENDED access status in a confirmed task does not render work as Completed. The checklist checkbox changes after the acknowledged save. This review does not exercise the backend portal's Start/Complete buttons with live reservations, physical NFC, Twilio delivery, or the whole host property-editor layout.

## Reproduction and CI corrections

Run `node tests/cleaner-mobile.browser.mjs` with Playwright and Chrome available. `CHROMIUM_EXECUTABLE_PATH` selects Chrome and `PLAYWRIGHT_MODULE` selects an isolated Playwright installation. The workflow uploads `cleaner-mobile-review` screenshots and JSON with seven-day retention. Source remains committed and captures can be regenerated.

Initial harness errors were corrected without changing product: await the checklist's acknowledged state; fix Date without pausing async timers; locate the issue selector within the form; mock the existing session-activity POST. Failed intermediate runs are not successful certifications.

E6/E8B UI CI also exposed a source contract that searched for `finishSignIn()` instead of the current `finishSignIn(user)` call. The corrected source contract is backed by stronger actual-component assertions: no session refresh while MFA is pending or when OTP verification fails. Nineteen auth/public-route tests and four scope failure-path tests pass locally. Exact PR #198 scope uses reviewed path/content hashes and a pinned main base; unrelated files, altered bytes, changed main or other PRs fail. Runtime certification remains enabled. CI for this follow-up remains pending until explicitly recorded in PR #198.

## Release boundary

Both PRs remain Draft. No merge, production migration or deployment occurred. Physical primary/backup NFC testing remains pending. Backend receipt tests and simulated browser replies do not establish actual entry. Host configuration runtime tests pass, but this report only certifies the cleaner page's mobile layout.
