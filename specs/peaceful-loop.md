# Peaceful loop spec (fishing, bugs, foraging, journal, museum, wardrobe hooks)

Owner: island agent (world + UI), systems agent (data, already built under web/lib/collections and web/lib/homes-sync). Decisions: rows 55–57, 62, 66, 67, 83, 88, 91, 94, 97, 98, 128, 129, 193–204, 210. Ledger wins.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Fishing input | Keep and deepen the existing cast/bite/tracking-bar reel minigame; distinct fish fighting patterns | 55 |
| Rods | 5 tiers; each widens the bite window, slows line tension, small rare-catch bonus; top tiers needed for some legendaries; basic/mid at shop, top crafted | 193, 94 |
| Bait | None in v1 | 194 |
| Spots | Cast anywhere along shore, river and pond edges; species by water type, real time, weather, season; no shadows | 195, 84, 88 |
| Catch card | Name, size, rarity, one-liner; personal size record per species | 196 |
| Bugs | ACNH sneak-and-swing: approach slowly, swing when close, bugs flee if you run | 197 |
| Foraging | Simple harvest; diegetic clues (sparkle, rustle, sound) for rare spots; hourly personal respawn with random rarity | 56, 98, 97, 83 |
| Roster | ~40 fish, ~20 bugs, ~8 fruit, ~15 shells/mushrooms/flowers, ~5 rocks/ore | 128, 129 |
| Journal | Pages per category, silhouettes + clues for unknowns, catch details, personal records | 203, 66 |
| Museum | Three wings (aquarium, insect hall, nature room); first-of-species displayed with donor name; duplicates refused | 201, 202, 67 |
| Showcase | Profile showcase of 3; HQ weekly trophy case; seasonal fishing tourney later | 204 |
| Selling | Surplus sells at the shop for coins | 91 |
| Wardrobe | Home closet item + shop fitting room open the same wardrobe sheet (ACNH character-card display) | 210 |

## Deliverables (island agent)

1. Wire the systems agent's stores: homes remote store (`createRemoteHomeStore`, hydrate on mount, `buyRoom` at the door), CollectionBook reading `/api/collections/journal`, catches posting `size_cm`.
2. Fishing: 5 rod tiers as data (bite window, tension rate, rarity bonus) applied in the existing reel; cast anywhere along shore/river/pond edges with water-type detection; catch card overlay with name, size, rarity, one-liner and "new record" when the personal best improves.
3. Bugs: sneak state (slow approach), flee radius per species, net swing on the existing interaction key; bug roster placed on bushes/trees with the hourly personal respawn and random rarity.
4. Foraging clues: sparkle/rustle/sound tells on rare spawns (High tier stronger), harvest with one key; fruit/shell/mushroom/flower/rock nodes on the village core.
5. Museum interior: three wings from the dump's interior pieces; cases/tanks fill from `/api/collections/museum`; donor plaques; donate prompt refuses duplicates with the curator's line. HQ trophy case from `/api/collections/trophies`; profile showcase picker from `/api/collections/showcase`.
6. Wardrobe sheet: character-card display (A sheet layout) with outfit/hair/accessory slots from inventory stubs; entry points: a closet item at home and a fitting-room prompt at the shop.
7. Screenshots prefix L- under `specs/evidence/peaceful/`; tsc, focused lint, tests (rod tier math, water-type detection, flee radius, respawn timers, duplicate donation refusal in UI).

## Out of scope

Crafting workshop UI, selling UI (economy area), combat, live multiplayer, Blender props.

## Questions

`specs/peaceful-questions.md`.
