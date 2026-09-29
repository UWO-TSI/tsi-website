# SQL smoke test: game drafts on top of main (2026-09-26, Phase 0)

Throwaway local Postgres 16 (Homebrew `initdb`, port 55432, trust auth, deleted after). Never Supabase.

Chain:
1. `web/supabase/tests/supabase_stub.sql` (main's stub: Supabase roles, `auth`, `storage`, default grants on `public`).
2. Every production migration in name order, `001_initial_schema` through `20260926130000_portal_rls_hardening`. Only `020_player_persistence` reports statement errors (the known legacy achievements section).
3. The game drafts, each with `ON_ERROR_STOP`: `20260926150000_game_coins` … `20260926150500_study`, then `pre033_seed.sql`, `20260926150600_economy`, `pre034_seed.sql`, `20260926150700_identity`, `20260926150800_combat`.
4. The game smokes: `029-031`, `032`, `033`, `034`, `034_legacy`, `035`.

Output:
```
NOTICE: 029 ok
NOTICE: 030 ok
NOTICE: 031 ok
NOTICE: 032 ok
NOTICE: 033 ok
NOTICE: 034 ok
NOTICE: 034 membership not self-editable ok
NOTICE: 034 legacy ok
NOTICE: 035 ok
```
`authenticated` has no EXECUTE on `wallet_apply`, `study_settle`, `daily_gift_claim`, `museum_donate`, `home_buy_room`, `progression_commit_contribution`, `economy_buy`, `economy_sell`, `merch_reserve`, `oracle_start`, `identity_set_name`, `combat_grant_xp`, `combat_mission_complete`.

Main's `profiles_guard_smoke.sql` and `portal_rls_smoke.sql` also pass on a fresh database with all nine game drafts applied after main's chain.

Fixture changes needed for the full chain: `003_profile_trigger` now creates profile rows on `auth.users` insert, so the smoke seeds upsert their profiles. The old `034` assert `NOT has_column_privilege('authenticated', 'profiles', 'membership', 'UPDATE')` fails under Supabase's default grants (a column REVOKE is a no-op while the role holds table-level UPDATE). It now checks behaviour instead: a member's own `UPDATE profiles SET membership` is refused by main's `profiles_guard_privileged` trigger.

Open for Phase 1: main's guard lists `class` and `subclass` as user-editable (the old client-side quiz writes them), while `20260926150700_identity` intends them to be server-only (the Oracle reading sets the family). Its `REVOKE UPDATE (membership, class, subclass)` does nothing on Supabase.
