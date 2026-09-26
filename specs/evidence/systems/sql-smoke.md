# SQL smoke test: drafts 029, 030, 031, 032 (2026-09-24)

Run against a throwaway local Postgres 16 cluster (Homebrew `initdb`, port 55432, trust auth, deleted after). Never against Supabase. A stub supplies `auth.users`, `auth.uid()`, `auth.role()` and the `anon` / `authenticated` / `service_role` roles. Then `001_initial_schema`, `014`, `015`, `023`, `024`, `029_progression`, `030_homes`, `031_collections` were applied in order, and `web/supabase/tests/029-031_smoke.sql` was run.

Checks, all `ASSERT`s inside `DO` blocks:
- 029: credits are idempotent (a replay doesn't charge twice), `cap_exceeded` charges nothing, `insufficient` coins are refused, and the `club_goal_progress` view sums correctly.
- 030: saves are idempotent via the save key and stale revisions raise `revision_conflict`. Buying a room charges the server price; a replayed purchase doesn't charge again. The fifth room raises `room_cap` and charges nothing, and `insufficient` coins are refused.
- 031: the roster seeds 100 species (40 fish). A catch keeps the personal best, and a smaller catch doesn't lower the weekly best. The first donor is credited and a replayed donation consumes only once. A duplicate raises `already_donated` and the second member keeps their specimen. `not_owned` and `not_donatable` (fruit) are refused.
- The `authenticated` role gets `permission denied` on `museum_donate`, `home_buy_room` and `progression_commit_contribution`; they are service-role only.

Output:
```
applied 001_initial_schema
applied 014_content_pipeline
applied 015_content_versions
applied 023_member_collections
applied 024_game_coins
applied 029_progression
applied 030_homes
applied 031_collections
NOTICE: 029 ok
NOTICE: 030 ok
NOTICE: 031 ok
```

Permission check output: `ERROR: permission denied for function museum_donate` / `home_buy_room` / `progression_commit_contribution`.

## 032_study (added 2026-09-24)

Same throwaway cluster; `032_study.sql` is applied after 031, then `web/supabase/tests/032_smoke.sql` runs after the 029–031 script. Result: `NOTICE: 032 ok`. What it checks:
- The 9 starter tables seed.
- The unique index refuses a seat that's already taken and a second active session for the same member.
- `study_settle` pays 25 + 10 once; a replay returns `replayed` with the balance unchanged.
- An implausible row (60 minutes in a 5-minute session) raises `implausible`.
- `study_weekly_stats` sums the week.
- `authenticated` gets `permission denied for function study_settle`.
