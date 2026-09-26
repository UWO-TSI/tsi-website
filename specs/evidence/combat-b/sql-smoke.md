# SQL smoke: combat B draft `20260926210000_combat_kits` (2026-09-26)

`zsh specs/evidence/combat-b/sql-smoke.sh`: throwaway Homebrew Postgres 16 (port 55443, deleted after; never Supabase), main's chain, then all 25 game drafts through `20260926190000_combat_content` and `20260926210000_combat_kits`, then every game smoke.

`web/supabase/tests/combat_kits_smoke.sql` checks:
- **Traits seeded:** seven species carry a trait; the guardian teaches none.
- **Loadout (row 50):** refused before a subclass (`no_subclass`); one to four distinct keys of the kit's shape (`bad_loadout` for five, a duplicate, or a malformed key); setting the same list twice is harmless. The service checks the keys against the member's kit before this stores them.
- **Traits (rows 40, 41):** a Transmuter's first thorn crab teaches Crab Shell; the replayed kill event adds nothing; an elder thorn crab trains the same trait; the guardian teaches nothing; a Druid's kills leave `traits` empty.
- **Subclass change (row 20):** 250 coins per change; a retried key after a later change answers with its first result (`replayed`, same subclass and fee) and changes nothing, charging nothing.
- **Permissions:** `authenticated` can't call `combat_set_loadout` or `combat_record_kill`.

Output (tail):
```
chain ok (game): 25 game drafts, last 20260926210000_combat_kits
NOTICE:  029 ok … NOTICE:  035 ok
NOTICE:  security 1 collections ok … security 4 class server-only ok
NOTICE:  crafting ok
ownership smoke ok
NOTICE:  combat content ok
NOTICE:  combat content: boss reward not callable by members ok
NOTICE:  combat content: materials not callable by members ok
NOTICE:  combat kits ok
NOTICE:  combat kits: loadout not callable by members ok
NOTICE:  combat kits: kills not callable by members ok
```
