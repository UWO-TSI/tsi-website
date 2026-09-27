# Combat B evidence (C3-, 2026-09-26)

Headed Chromium on `/lab/island` against the dev server, signed out: `?combat=demo` answers `/api/combat/*` from the real service on the in-memory store (`?subclass=`, `?stats=none`, `?sheet=path` are dev-only). Ruins shots stage a few enemies next to the player with `window.__combat`, top energy up between presses and hold the frame with `__combat.freeze`; every effect on screen comes from pressing the ability key.

| File | What it shows |
|---|---|
| C3-01 … C3-04 | Level-10 subclass choice at the Oracle for each family (Arcane, Ranger, Vanguard, Warden): the four subclasses with signature, own abilities, passive, runes marked, starter notes; first choice free. |
| C3-05 | After choosing Druid: the kit (signature, two own, two Warden), four equipped, one swapped for Renew before saving. |
| C3-06 | A later change asks first: 250 coins, what stays. |
| C3-07 | Stats: family preset spent, then the 200-coin reset confirm. |
| C3-08 | Arcane: Necromancer raised a fallen fox as a shade (violet ring) that fights, Bone Spear in flight; HUD `Summons 1/4`. |
| C3-09 | Ranger: Hunter's Bow Volley (five arrows) leaving toward the fox. |
| C3-10 | Vanguard: Juggernaut's Ground Slam ring with the hits (one crit). |
| C3-11 | Warden: Priest's Holy Beam through three enemies in a line. |
| C3-12 | Totem cap: Shaman's ember, mending and warding totems overlapping; a fourth press replaced the ember; HUD `Totems 3/3`. |
| C3-13 | Summon cap: Summoner's call (drawn), Fox Pack and Crab Bulwark past capacity; the oldest wisp left; HUD `Summons 5/5`. |
| C3-14 … C3-16 | Incantation: Elemental Burst traced on the spark rune while foxes keep coming (the world runs), the Empowered readout, the burst landing on the aimed spot. |

`balance.md`: the scripted solo runs (Part B 3). `sql-smoke.md` / `sql-smoke.sh`: the migration's smoke chain.
