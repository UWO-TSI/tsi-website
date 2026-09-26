# SQL smoke test: drafts 029–033 (2026-09-24)

Run against a throwaway local Postgres 16 (Homebrew `initdb`, port 55432, deleted after), never Supabase. Stub `auth` schema and roles. Applied in order: 001, 014, 015, 016, 023, 024, 029, 030, 031, 032. Then `web/supabase/tests/pre033_seed.sql` (a member holding 024-era `profiles.coins` = 777 and `gear` = ["rod_cedar"]), then 033. Then the 029–031, 032 and 033 smoke scripts, all run in `web/supabase/tests/`.

What 033_smoke checks:
- **024 reconciled:** `profiles.coins` and `profiles.gear` are dropped; the 777 coins became an opening ledger row; the gear became an inventory row. Every wallet equals the sum of its ledger, checked at the start and at the end.
- **Credit and debit:** `wallet_apply` replays a key without changing anything, and an insufficient debit raises `insufficient` with no partial charge.
- **Buying:** a bad price is refused; a buy charges once and a replay doesn't; a second copy of a non-stackable item raises `already_owned`.
- **Selling:** a legendary fish pays 600; a non-roster common fish (priced via 024's `fish_prices` rarity) pays 8 each; a rare bug pays 50. A replay is a no-op, and selling with nothing left raises `insufficient_items`.
- **Merch with 1 in stock:** the first reservation goes through and the second gets `sold_out`. A member can't resolve a reservation (`forbidden`). A T1 cancel refunds the Gems once, returns the stock, and is idempotent. A cancelled reservation can't then be fulfilled (`already_resolved`); a new one can. Gems rows go to `tc_transactions`.
- **Daily gift:** paid once per America/Toronto day.
- **In-person events:** marking an IRL attendance as `attended` twice credits 50 coins once, via the trigger.
- **Rewired writers:** 029 goal deliveries, 030 room purchases and 032 study settlement now pay through `wallet_apply`. Their own smokes pass, with one ledger row per study settlement.
- **Permissions:** `authenticated` is denied on `wallet_apply`, `study_settle` and `daily_gift_claim`.

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
NOTICE: 029 ok
NOTICE: 030 ok
NOTICE: 031 ok
NOTICE: 032 ok
NOTICE: 033 ok
permission denied for function wallet_apply
permission denied for function study_settle
permission denied for function daily_gift_claim
```
