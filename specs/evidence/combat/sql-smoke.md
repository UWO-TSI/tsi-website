# SQL smoke test: drafts 029–035 (2026-09-26)

Same throwaway local Postgres chain as `specs/evidence/oracle/sql-smoke.md` (Homebrew cluster in the scratchpad, port 55432, stopped afterwards; never Supabase). `035_combat.sql` is applied after 034, and `web/supabase/tests/035_smoke.sql` runs last.

What 035_smoke checks (fresh member created through `auth.users`, funded 1000 coins with `wallet_apply`):
- **Curve:** `combat_level_for_xp` gives 124 → 1, 125 → 2, 11,624 → 9, 11,625 → 10, and caps at 50. The vitest suite checks the TS curve against the same numbers and the SQL text.
- **XP:** `combat_grant_xp` replays on the same key. A kill is recorded once per event key, and the hourly cap raises `kill_xp_cap`.
- **Starter gear:** Driftwood sword (equipped) and Cloth wraps.
- **Stats:** allocation is add-only and refuses overspend (`not_enough_points`). A reset charges 200 coins through `wallet_apply` (source `stat_reset`) and replays on the same key.
- **Subclass:** refused below level 10 and for another family. The first choice is free and a change costs 250.
- **Missions:** start, then a second start resumes; complete before ready raises `not_ready`. Complete pays XP and coins once (the replay pays nothing), then the cooldown blocks a restart.
- **Wear:** wear replays on its key; repair costs 14 coins for 14 points on a tier-1 weapon.
- **Event hook:** an `event_attendance` row grants +2,000 XP.
- **Permissions:** `authenticated` is denied on `combat_grant_xp` and `combat_mission_complete`, as well as on the earlier service functions.

Output:
```
applied 001_initial_schema … 034_identity, 035_combat
NOTICE: 029 ok
NOTICE: 030 ok
NOTICE: 031 ok
NOTICE: 032 ok
NOTICE: 033 ok
NOTICE: 034 ok
NOTICE: 034 legacy ok
NOTICE: 035 ok
permission denied for function wallet_apply
permission denied for function study_settle
permission denied for function daily_gift_claim
permission denied for function oracle_start
permission denied for function identity_set_name
permission denied for function combat_grant_xp
permission denied for function combat_mission_complete
```

Screenshots in this folder (systems harness `/dev/combat`, in memory, shared dev server on port 3100):
- `progress.webp` / `progress-mobile.webp`: XP curve, character sheet at level 10 (Warden), subclass choices, weapon durability with a broken-ish sword, and the damage table.
- `runes.webp` / `runes-mobile.webp`: both runes scored against clean, wobbly, jittery, half, wrong-order, scribble and too-slow traces.
- `kits.webp`: the 16 subclass signatures and passives.
- `missions.webp`: the mission board after a run that includes a double turn-in (paid once), a failed escort and the cooldown.
