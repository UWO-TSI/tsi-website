# Recruitment deployment readiness, 2026-09-17

Status: deployed to www.tethos.ca through PRs #23 and #24. Production Google delivery works; four roles have the confirmed opening/deadline. The dated preparation sections below are historical, superseded by the release verification section.

## Production release and immediate opening (2026-09-17)

Deployed PR #23 (`4ab7f63`) and whitespace-only Google destination fix PR #24 (`f0616f5`) to www.tethos.ca. Production build and 339 tests passed. Applied only recruitment delivery migration (remote ledger 20260917160347) and its minute scheduler (20260917161307); parked game migrations remain unapplied. Google workbook auto-creation recovered correctly after trimming the existing newline-only ID.

Live verification: all 68 existing applications delivered; a synthetic internal application's multiline answer and later update were read back from its fixed row. Deleted only that synthetic application/position. The minute job cleared its row, returned HTTP 200 without timeout, and left zero pending; all 68 real applications remain. Authenticated Dia admin shows zero waiting and the workbook link. Production island, HQ, board and protected-route checks pass. No applicant email was sent. Actual applicant form submission/resume upload/email delivery were not exercised live; timeout/race recovery is covered by local SQL/unit tests rather than a forced production outage.

David then explicitly requested opening immediately, archiving PM/VP Marketing and pushing quieter world-first laptop entry. Production roles opened at **2026-09-17 12:17:10 Toronto (16:17:10Z)**; September 23, 11:59 PM Toronto deadline is unchanged. PM and VP Marketing are archived, preserving all applications; current unarchived round has zero applications at verification. This supersedes the earlier 3 PM opening. Follow-up code sends laptops directly into the existing applicant island, retaining mobile/reduced-motion forms and the explicit `?view=form` escape. Applicant music gain is 0.18; SFX gain 0.25, with a further 0.35 gain for running/landing/jumping. Saved volume settings and member-world levels are preserved.

Operational follow-up: Google consent identified a Testing app. Verify OAuth publishing status or renew before the documented seven-day token expiry; queued applications remain in Supabase if Google access expires. Full repository lint retains known debt (68 errors/52 warnings against previous main 74/53); focused changes pass. New externally-created ` 2` duplicate files appeared untracked during release and are preserved, excluded from staging. Exact follow-up code verified in an isolated checkout: production build and all 343 tests pass; focused ESLint passes.

## Production credentials prepared (2026-09-17)

David authorized completing the production settings. Dia verified `uwotsi.com` serves www.tethos.ca. This project was missing all three OAuth variables; added verified local GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN plus a generated CRON_SECRET as non-revealable Secret variables for Production only. Preserved existing folder/workbook and unrelated variables. Vercel confirmed save success and requires a new deployment to apply them.

Created Supabase Vault recruitment_sheet_origin=https://www.tethos.ca and recruitment_sheet_cron_secret matching the Vercel input; SQL verified both present and matching without returning their values. No delivery migration, scheduler, role activation, code push or redeploy. Google publishing/testing-state review and existing production workbook access verification remain open. Evidence: `specs/references/deployment-2026-09-17/production-configuration.json`. Next: deploy compatible code, then delivery migration/roles/scheduler and end-to-end verification. Do not redeploy old code as a substitute.

## Local Google credential installed (2026-09-17)

David explicitly authorized replacing only GOOGLE_OAUTH_REFRESH_TOKEN in web/.env.local. Replacement completed; all other file bytes preserved and credential never logged. Fresh checkout diagnostic verifies authorization valid and destination writable. Local dev log confirms environment reload. Production environment unchanged; delivery migration/scheduler/new roles and production Google configuration remain outstanding. Temporary credential copy removed after verification; the local env is now the credential source.

## Google reconnect verified (2026-09-17)

David completed consent. New credential saved in protected temporary storage (0600), not in environment files. Actual Google requests passed authorization, configured Drive folder write access, synthetic spreadsheet write/readback, repeated RAW fixed-row update without duplication (including a formula-like literal), and blank-row clearing/readback. The temporary workbook was then moved to trash. No real applicants, database mutations or emails were involved. Evidence: `specs/references/deployment-2026-09-17/google-live-verification.json`.

This verifies the new credential and Google transport. The running local/Vercel configuration still has not been updated, and full admin-to-database-to-Sheets delivery/scheduling still requires the migration and deployed setup. Asked explicit permission to replace only GOOGLE_OAUTH_REFRESH_TOKEN in web/.env.local, per AGENTS.md; pending at checkpoint.

The consent screen explicitly described a testing app. Google documents seven-day refresh-token expiry for external apps in Testing with Drive/Sheets scopes. Verify the OAuth publishing status and production suitability before treating this as a durable production connection; do not assume the earlier invalid_grant cause is proven. Source: https://developers.google.com/identity/protocols/oauth2#expiration. No publishing-status change performed.

## Confirmed schedule and reconnect started (2026-09-17)

David confirmed all four roles open September 17 at 3:00 PM and close September 23 at 11:59 PM, interpreted in the previously agreed Toronto time (EDT in September). UTC: 2026-09-17T19:00:00.000Z to 2026-09-24T03:59:00.000Z. Local role source/preview/preparation payload updated; production roles remain untouched and draft preparation remains inactive.

Google reconnect opened in Dia with the existing account/client. Waiting for user consent at Google's unverified testing-app screen. Existing oauth-setup utility now supports --token-file with exclusive owner-only output, validates OAuth state, binds loopback and omits sensitive error bodies. No .env edit. Syntax/focused lint, TypeScript, 5 role tests, dry-run dates and invalid-state callback rejection checked. Credential receipt/live Google verification still pending.

## Scope and outcome

Prepare the existing director/developer applicant portal for the main website and verify admin Google Sheets delivery. Reuse the existing durable delivery worker. Completion requires a passing production build, authorization/retry correctness, and actual Google write/readback plus production configuration verification. Mocked tests alone do not establish a working live integration.

Branch: `feat/director-developer-recruitment`, HEAD `f850451`, equal to freshly fetched `origin/main` before the existing uncommitted implementation. Preserve the large accumulated working tree. No unrelated cleanup or marketing refactor.

## Changes in this preparation pass

- Admin delivery status now probes Google authorization and destination permissions. Credential presence alone no longer reports success. Missing migration and revoked Google authorization can both be shown.
- Admin can retry a connection check; sync is unavailable until setup and Google access are verified. Errors are sanitized; credential and applicant contents are never returned.
- Shared OAuth transport has a 15-second timeout and automatic transport retries disabled, matching bounded Google requests.
- Added five connection-health tests and five endpoint authorization/error tests. Existing worker tests cover recovery, fixed rows, RAW values, failures and batched writes.
- Added `web/scripts/check-recruitment-deployment.mjs`, a read-only configuration diagnostic. It prints presence flags and setup metadata, never secrets/applicant records. Run from `web`: `node scripts/check-recruitment-deployment.mjs`. Exit 1 means configuration is incomplete; success still requires real delivery and production verification.
- Preserved firefly path sample coverage while aggregating extrema before assertions to avoid assertion overhead/timeouts under concurrent build load.

## Verified results

| Check | Result |
|---|---|
| `cd web && npm run build` | PASS, default production Turbopack build including TypeScript and 108 generated pages |
| `cd web && npm test` | PASS, 338 tests in 34 files |
| Focused ESLint on all files changed this pass | PASS |
| Full repository ESLint | 68 errors / 52 warnings, versus fresh main 74 errors / 53 warnings. Existing debt remains; full lint is not green. |
| `psql -d uwotsi_recruitment_delivery_test -f tests/recruitment-delivery.sql` | PASS, 300 records, stable unique rows, lease exclusion, concurrent edits, retry/tombstone, deadline/archive and permission invariants; transaction rolled back |
| Anonymous local `GET /api/sheets-sync` | 403, no delivery data exposed |
| Google OAuth refresh using checkout configuration | FAIL: `invalid_grant`; reconnect required |
| Production delivery schema | Both `recruitment_sheet_state` and `recruitment_sheet_rows` absent, GET queries return PGRST205 |
| Production scheduled delivery prerequisites | `pg_cron` and `pg_net` absent, verified with read-only SQL |
| New four production positions | None of director-marketing, director-internal, director-external, developer exists |
| Vercel production configuration | UNVERIFIED: connector project requests return 403; team list empty |
| Authenticated local admin UI | UNVERIFIED: Google sign-in returned to production homepage instead of localhost:3102. Check Supabase local redirect allowlist before claiming a local authenticated walkthrough. |
| Real Sheets write/readback and resume access | NOT RUN: authorization and schema prerequisites unavailable |

Evidence: [configuration](references/deployment-2026-09-17/readiness.json), [build](references/deployment-2026-09-17/build.log), [tests](references/deployment-2026-09-17/tests.log), [database tests](references/deployment-2026-09-17/database-tests.log). No applicant contents or secret values in these artifacts.

## Blockers and release sequence

1. Schedule confirmed: September 17, 3:00 PM to September 23, 11:59 PM Toronto time (EDT), now in local draft source. Complete local review and apply these dates with the authorized release; current production roles are still the old round.
2. Reauthorize the existing recruitment Google account with Drive and Sheets scopes. Verify access to its intended folder/workbook. Checkout token is invalid; current Vercel token could not be inspected and must be verified separately. Use existing `scripts/oauth-setup.mjs --token-file /absolute/private/path` to obtain a credential without editing `.env.local`. Its default mode still writes `.env.local` and requires explicit authorization for that file change. Never log returned credentials.
3. Verify the real Vercel production project and environment. STATE records `uwotsi.com` as serving tethos.ca; a second `uwotsi` project also auto-builds this repository. Fresh GitHub statuses confirm both builds, but current connector access cannot validate domain/env settings. Confirm Google credentials, destination configuration and a nonempty `CRON_SECRET` on the serving project. Missing `GOOGLE_SHEETS_SPREADSHEET_ID` is allowed because the worker creates/reuses its managed workbook.
4. Review the complete accumulated diff, preserve intended game assets, and integrate through the existing main deployment flow after release authorization. Main automatically deploys. Full lint's existing debt requires an explicit disposition; focused checks/build pass.
5. **Deploy the new validated submission route before applying `web/supabase/migrations/20260916040531_recruitment_delivery.sql`.** The migration revokes direct authenticated INSERT, so applying it against the old client-scoped route would break submissions. Do not use a blanket migration push that might include parked game drafts. Inspect/apply only the intended delivery migration after the compatible code is live.
6. Verify the deployed admin access gate, migration/state/backfill, RLS/service-only permissions, Google health and pending count. Prepare new roles inactive using the existing `prepare-recruitment-round.mjs --write-drafts` only as part of the authorized rollout. Set reviewed content/dates before activation.
7. Perform an isolated synthetic application lifecycle and real Google write/readback without emailing real applicants or inserting into an open real round. Verify essays/profile metadata, authenticated resume links, admin updates, repeated sync without extra rows, and removal clearing the same fixed row. Mark/check test data explicitly and clean only the created test record. Existing migration backfills records, so inspect destination and queued scope before manually triggering production sync.
8. Store matching deployment origin and cron secret in Supabase Vault under `recruitment_sheet_origin` and `recruitment_sheet_cron_secret`, then apply `web/supabase/schedule-recruitment-sheet.sql`. Verify automatic recovery actually drains a queued test change after a worker interruption, not just that a schedule exists.
9. Activate the four roles with confirmed dates; check desktop island and mobile/direct forms, authenticated draft save/resume/submit/readback, admin review and production route health. Record the deployed commit and final integration evidence.

Rollback: application records remain in Supabase when Google fails; do not remove them. Disable the new roles/scheduler if necessary. After the migration, reverting to the old client-scoped submission implementation is unsafe without a reviewed compatibility plan. Never drop the delivery tables as a routine rollback.

## Sources and interpretation

- Actual checkout, tests, read-only Supabase inspection and Google refresh, 2026-09-17. Production Google configuration was not read.
- Existing project release requirements: `specs/director-developer-round.md`, `STATE.md`, delivery migration and scheduler SQL.
- Google [values.batchUpdate API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate): fixed-range writes and RAW input support the existing idempotent row projection. Its behavior is tested locally with mocked Google responses; live correctness remains pending reconnection.
