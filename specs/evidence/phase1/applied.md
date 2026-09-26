# Migrations applied to staging (`tethos-staging`, `jjiyeroyralfbluowbjq`)

Postgres 17.6 (Supabase, us-west-2, free plan). Applied 2026-09-26 with `psql` over the session pooler, one transaction per file, `ON_ERROR_STOP`. Production (`rtbkrngsdbptbjhfbcud`) was only read (`"read_only": true`); nothing was written there.

## 1. Everything production already has, in name order

| # | File | Result (UTC) |
|---|---|---|
| 1 | `001_initial_schema.sql` | ok 15:51:37 |
| 2 | `001_recruitment.sql` | ok |
| 3 | `002_election_votes.sql` | ok |
| 4 | `003_profile_trigger.sql` | ok |
| 5 | `004_cleanup_and_extend.sql` | **FAIL**: `operator class "gin_trgm_ops" does not exist` (no `pg_trgm`). Rolled back, as it did in production. |
| 6 | `005_avatar_items.sql` … `019_community_loops.sql` | ok (15 files) |
| 7 | `020_player_persistence.sql` | **FAIL**: `column "active" does not exist` (001's `achievements` has another shape). Rolled back; then only the sections production has (1 and 4) were applied. |
| 8 | `021_profiles_bio_year.sql` … `023_member_collections.sql`, `026`, `027`, `028` | ok |
| 9 | `20260916040531_recruitment_delivery.sql` | ok |
| 10 | `20260918200000_recruitment_sheet_tabs.sql` | ok |
| 11 | `20260918230000_recruitment_sheet_project_rows.sql` | ok |
| 12 | `20260926120000_profiles_privilege_guard.sql` (PR #40) | ok |
| 13 | `20260926130000_portal_rls_hardening.sql` (PR #41) | ok 15:53:15 |

## 2. Staging made production-shaped (staging only, not a migration)

Diff against the read-only production dump, then patched staging until the only remaining difference was production's two pg_cron jobs (not scheduled on staging: they post to www.tethos.ca): removed what 005/007/008/011 left that production never had, added production's hand-made `handle_new_user()` body, anon invite-code policy, `portfolios` bucket and the `pg_cron`/`pg_net` extensions. Details in `schema-drift.md`.

## 3. The launch chain on top

| File | Result |
|---|---|
| `20260926150000_game_coins.sql` | ok 15:55:22 |
| `20260926150100_seasonal_seed.sql` | ok |
| `20260926150200_progression.sql` | ok |
| `20260926150300_homes.sql` | ok |
| `20260926150400_collections.sql` | ok |
| `20260926150500_study.sql` | ok |
| `20260926150600_economy.sql` | ok |
| `20260926150700_identity.sql` | ok |
| `20260926150800_combat.sql` | ok |
| `20260926150900_collections_server_only.sql` | ok |
| `20260926151000_economy_sell_lock.sql` | ok |
| `20260926151100_wallet_gem_types.sql` | ok |
| `20260926151200_profiles_class_server_only.sql` | ok 15:55:54 |
| `20260926155000_schema_drift_reconcile.sql` (new, Phase 1) | ok 16:00:41, and again 16:00:43 (idempotent) |
| `20260926155100_letters_broadcast_unique.sql` (Phase 1 fix) | ok 16:15:33 |
| `20260926155200_event_attendance_rsvp_only.sql` (Phase 1 fix) | ok |
| `20260926155300_invite_codes_private.sql` (Phase 1 fix) | ok |
| `20260926155400_member_badges_signed_in_only.sql` (Phase 1 fix) | ok 17:08 |
| `20260926160000_crafting.sql` (merged from `game/crafting`) | ok 16:39 |
| `20260926170000_profiles_avatar_config.sql` (merged from `game/study-character`) | ok (no-op after `155000`) |

Local throwaway Postgres 16 with every migration above (`supabase_stub.sql` first): `phase1_regressions`, `crafting_smoke`, `avatar_config_smoke`, `game_security_smoke`, `profiles_guard_smoke`, `portal_rls_smoke` all pass, each on a fresh database.

Not applied: `web/supabase/schedule-recruitment-sheet.sql` (would schedule a job that posts to production), `APPLY_THEN_RESET.sql` (a one-off reset script).

## Auth and users

- Email provider on with password sign-in, `mailer_autoconfirm` on (no mail is sent from staging), site URL and redirect allow-list `http://localhost:3500`. Staging only.
- Test users, created through the GoTrue admin API; passwords only in the macOS keychain (`security find-generic-password -s "tethos-staging phase1 <member|public|staff>" -w`):

| User | id | Profile |
|---|---|---|
| `phase1-member@tethos-staging.test` | `c2982825-3dd1-4572-a9d0-4b7fadd306d6` | tier 4, `membership = member` (email pre-listed in `member_email_whitelist`, so the sign-up trigger decided it) |
| `phase1-public@tethos-staging.test` | `4e294cb3-7032-433c-971e-90f855021d10` | tier 4 (column default), `membership = public` |
| `phase1-staff@tethos-staging.test` | `6d14b24f-7005-4194-adf2-4fc02d186c45` | tier 2 (set with SQL), `membership = member` |

- API keys: `web/.env.staging.local` (gitignored by `web/.gitignore:34 .env*`, checked with `git check-ignore -v`). The worktree has no `.env.local`, so the dev server can only reach staging.
