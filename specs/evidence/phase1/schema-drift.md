# Schema drift: production vs the migration files (Phase 1, 2026-09-26)

## Method

1. **Production, read-only.** One catalog query through the management API with `"read_only": true` against `rtbkrngsdbptbjhfbcud`: every `public` table/column/type/default, constraints, indexes, RLS flags, policies (`public` and `storage`), non-extension functions (identity args, SECURITY DEFINER, `search_path`, body md5, ACL), triggers on `public`/`auth`/`storage`, table and column grants to `anon`/`authenticated` (from `relacl`/`attacl`), extensions, storage buckets, pg_cron jobs, and `supabase_migrations.schema_migrations`. Plus read-only data checks for every launch statement that touches existing rows. Nothing was written to production.
2. **Staging replay.** Every file in `web/supabase/migrations` in name order on `tethos-staging` (`jjiyeroyralfbluowbjq`), each in one transaction with `ON_ERROR_STOP`. Same catalog query, diffed object by object.
3. **Prod-shaped staging.** Where a file failed or production differs, staging was patched (staging only) until the diff against production was empty apart from the two cron jobs. The game drafts and the reconciliation were then applied on top of that, which is the launch chain run against production's real shape.

Production at dump time: 57 tables, 486 columns, 188 constraints, 119 indexes, 137 policies, 10 functions, 17 triggers; 315 users = 315 profiles (tiers: 1 × T1, 1 × T2, 313 × T4; no class/subclass set); 217 of them have applications.

## What the files replay to but production doesn't have

| Source | On a fresh replay | In production | Why |
|---|---|---|---|
| `004_cleanup_and_extend` | **Fails.** `gin_trgm_ops` needs `pg_trgm`, which neither production nor a new Supabase project enables; the whole file rolls back. (The local smoke stub creates `pg_trgm`, so local chains never saw this.) | Never ran: `profiles_tier_check` is still `1..4`; no `avatar_config`, `skills`, `social_links`; none of the six `idx_profiles_*` indexes. | Same failure. |
| `005_avatar_items` | `avatar_items` table; `player_inventory` created here with FK to `avatar_items`; three self-service policies incl. **"Users can insert own inventory"**. | No `avatar_items`. `player_inventory` came from 020 (FK to `shop_items`, `source` column + check). | Never applied. |
| `007_achievement_policies` | **"Achievements insertable/updatable by authenticated"**, **"User achievements insertable by authenticated"**: any signed-in user can create achievements and award them to themselves. | Absent. | Never applied. |
| `008_event_attendance_policies` | **"Users can delete own attendance"**. With 001's self-insert policy, a member could delete and re-insert an `attended` row; after launch each insert pays event coins and 2,000 XP. | Absent. | Never applied. |
| `011_resume_storage` | `applications.resume_storage_path` + index; four `storage.objects` policies for the `resumes` bucket. | Bucket only (2 MB, set by a later migration). No column, no policies. Recruitment uploads use signed URLs and never read the column (`app/api/applications/route.ts`), so this is harmless. | Half-applied by hand. |
| `020_player_persistence` | **Fails** at `idx_achievements_active`: 001 already created a different `achievements` table (no `active` column). | Sections 1 and 4 present (`player_inventory` + policies, `preferences`/`first_seen_at`/`last_seen_at`/`login_count`); no `player_achievements`, no new achievements columns, no seed. | Applied piecemeal. |

## What production has that no file creates

| Object | Notes |
|---|---|
| `handle_new_user()` body | Hand-hardened: `COALESCE(email, meta email, '')`, display name falls back through `display_name → full_name → name → email prefix → 'Agent'` (Google puts the name in `full_name`/`name`), and the profile insert is wrapped so a failure never blocks sign-up. `003` has none of this, and `20260926150700_identity` would **replace it at launch** with a body that has none of it either. |
| Policy "Invite codes readable by anon for validation" | `SELECT` to `anon` where `is_active`. Used by `/student/signup` to validate a code before `signUp`. It lets anyone list the active codes, and an active code makes a sign-up a member once identity ships: dropped by `20260926155300` (see `flows.md` §9). |
| Bucket `portfolios` (private, 50 MB) | Created by `web/scripts/_create-portfolios-bucket.mjs`; `lib/google-sheets.ts` signs links from it. |
| Extensions `pg_cron`, `pg_net`; jobs `recruitment-sheet-delivery` (`*/5`), `prune-cron-history` | From `web/supabase/schedule-recruitment-sheet.sql` (outside the migrations folder). **Not** scheduled on staging: the job posts to the production origin. Extensions only were created on staging. |

Grants: identical on every pre-existing table once the above is accounted for (`authenticated` holds column-level `SELECT` on 19 `profiles` columns, from `20260926120000`).

## Migration ledger drift

`supabase_migrations.schema_migrations` in production lists only 10 versions (`20260412162917` … `20260918230000`, several under names/timestamps that match no file). `001`–`028` and the two 2026-09-26 security migrations were applied through the SQL editor and are not recorded. **Do not run `supabase db push` against production at launch**: it would try to replay `001`–`028`. Apply the launch files by hand in the documented order, or `supabase migration repair --status applied` the already-present versions first.

## Launch chain against production's shape

All 13 game drafts (`20260926150000` … `20260926151200`) applied cleanly on prod-shaped staging **without** any reconciliation: none of them depends on the drifted objects. Data checks (read-only, production):

| Launch statement | Production data | Result |
|---|---|---|
| `150600` new `tc_transactions_type_check` | types in use: `earn_quest` (2), `earn_achievement` (1) | inside the new list |
| `150600` `shop_items` category / one-price / merch-in-Gems checks | 3 rows (`tsi-hoodie` merch 1500, `glitch-aura` avatar-effect 800, `founder-badge` profile-customization 5000), all Gems-priced | all pass |
| `150400` / `150900` `member_collections` backfill and 99 clamp | 14 rows, none above 99 | no-op clamp |
| `150700` legacy class → family mapping | no profile has `class`/`subclass` | no-op |
| `150700` `membership` column default `'member'` at ALTER time | 315 profiles, 217 of them recruitment applicants | **all 315 become members**, see questions |
| `150100` seasonal seed | `default`, `halloween` exist | upsert keeps `active` |

## Reconciliation: `20260926155000_schema_drift_reconcile.sql`

Idempotent (applied twice on staging, second run all no-ops), placed after the last game draft so it can merge with `identity`'s trigger:

1. `profiles.avatar_config`, `skills`, `social_links` (`add column if not exists`, 004's definitions) and `grant select` on them to `authenticated` (the 20260926120000 grant only covered columns that existed). The profile editor, onboarding, directory and `/api/profile/[id]` select these today and fail on production.
2. `profiles_tier_check` → `1..5` (the admin tier editor offers T5).
3. `handle_new_user()`: production's fallbacks and failure guard plus identity's member/public decision (whitelist or active invite code).
4. `drop policy if exists` for the 005/007/008 self-service write policies (no-ops in production; closes them on any fresh replay, which is what staging and local builds are).
5. The `portfolios` bucket (`on conflict do nothing`).

Not reconciled, on purpose: the trigram and other `idx_profiles_*` indexes (performance only, 315 rows), `avatar_items` / `player_achievements` (only the legacy `/api/shop`, `/api/inventory` and avatar purchase read them; see flows), the `011` resume column and storage policies (unused), the cron jobs.

After the reconciliation and the Phase 1 fixes, a final staging dump vs production differs only by the launch chain's own objects (1,788 added), the intended changes to existing objects (`profiles_tier_check`, `shop_items.tc_price` nullable and category check, `tc_transactions_type_check`, `handle_new_user`, `profiles_guard_privileged`, the RSVP-only attendance policy, the two invite-code policies and `member_collections` write access removed), and the two cron jobs.
