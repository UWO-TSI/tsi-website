# SQL smoke test: drafts 029–034 (2026-09-24)

Same throwaway local Postgres chain as `specs/evidence/economy/sql-smoke.md` (never Supabase), now with `034_identity.sql` applied after 033 and `web/supabase/tests/034_smoke.sql` run after the 029–033 smokes.

What 034_smoke checks:
- **Names:**
  - Setting a world name works, and re-saving the same name is a no-op.
  - A name that differs only in case or look-alike characters (same key) raises `name_taken`.
  - A change inside 30 days raises `too_soon`.
  - A member can't reset someone else's name (`forbidden`); a T1 reset works and is counted and logged.
- **Badge:** members get the badge; public accounts get none.
- **Oracle:**
  - The first reading is free, and a second start resumes the open reading.
  - Finishing with 63 of 64 answers raises `incomplete`; 64 completes. Completing again replays.
  - `profiles.class` is set to the family, which chapter 4 reads.
  - A new reading inside 7 days raises `cooldown`.
  - After that, a respec charges 250 coins through `wallet_apply` (ledger source `respec`). Both auras are kept and `respec_log` records the change.
- **Settings:** a bad text size is refused by a CHECK constraint.
- **Permissions:** `authenticated` is denied on `oracle_start` and `identity_set_name`, as well as on the earlier service-role functions.

Output:
```
applied 001_initial_schema
applied 014_content_pipeline
applied 015_content_versions
applied 016_events_check_in
applied 023_member_collections
applied 024_game_coins
applied 029_progression
applied 030_homes
applied 031_collections
applied 032_study
applied 033_economy
applied 034_identity
NOTICE: 029 ok
NOTICE: 030 ok
NOTICE: 031 ok
NOTICE: 032 ok
NOTICE: 033 ok
NOTICE: 034 ok
permission denied for function wallet_apply
permission denied for function study_settle
permission denied for function daily_gift_claim
permission denied for function oracle_start
permission denied for function identity_set_name
```
