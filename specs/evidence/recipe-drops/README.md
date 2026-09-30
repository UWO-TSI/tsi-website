# Rare-catch recipe drops (ledger rows 199, 258)

Branch `game/recipe-drops`. Migration `web/supabase/migrations/20260930100000_recipe_drops.sql`.

## Rules

- **Rare** is the roster's own rarity (`collection_species.rarity`, the same tiers `hasClue` sparkles for): rare, epic, legendary. Fish the roster doesn't list (no `collection_species` row) never drop.
- The server's land step (`collections_land_drop`, wrapping `seasonal_land`) and harvest step (`collections_harvest_drop`, wrapping `collections_harvest`) call `crafting_catch_drop` in the same transaction as the catch. If the catch is refused (too fast, out of season, over the hourly cap, node already harvested), no recipe is learned.
- Chance per catch comes from the species' rarity (`recipe_drop_chances`). On a hit: one random active recipe whose `drop_rarity` this catch reaches, which the member doesn't know yet (from any source), and which is not a starter or shop-card recipe. Recorded in `member_recipes` with source `catch`, once per recipe per member (primary key). Once the pool is empty, nothing drops.
- The client never names a recipe. The reply's `recipe` (`{ id, name }` or null) only reports what the server picked. No currency is involved.

## Drop table (seed)

| Catch rarity | Chance per catch | Recipes it can teach |
|---|---|---|
| rare | 2% | the 13 recipes below marked rare |
| epic | 5% | rare ones + the 3 marked epic |
| legendary | 15% | all 16 |

| `drop_rarity` | Recipes |
|---|---|
| rare | rod-glass, net-silk, acc-shell-necklace, outfit-silk-sweater, furn-study-desk, furn-bench-park, furn-streetlamp, furn-plant-monstera, furn-wall-clock, furn-wall-frame, furn-lounge-rug, sword-iron, bow-yew |
| epic | net-dragonfly, shovel-crystal, outfit-monarch-cape |

This is every recipe whose only source is the beach bottle. Starter (3), shop-card (4) and quest-tagged (8: rods 4-5, emperor net, golden shovel, koi kimono, crystal circlet, brass revolver, rune staff) recipes are not in the pool. Admins set `drop_rarity` per recipe in the Recipes editor ("Rare-catch drop"). The three chances are data (`recipe_drop_chances`) with no editor.

Rough rate: about 5 to 10% of landed casts are rare or rarer by roster rarity, and foraging turns up about 1.3 rare finds per member-hour if you visit every node. At these chances that works out to about 1 recipe per 40 to 50 rare catches. A member who fishes about 10 hours in a season (roughly 100 rare catches) learns about 2 recipes, plus the odd one from foraging.

## Tests

- Vitest `app/api/collections/route.test.ts`, "rare catches can teach a recipe": 6 tests, all written first and failing before the implementation (6 failed / 12 passed). They cover: a forged `recipe_id`/`learn` field is ignored, and `action: "learn"` returns 400; a rare catch teaches one recipe, shown by name; common/uncommon catches and a quiet dice teach nothing; once per recipe, where a bottle-known recipe never drops and the rare pool runs out; a refused land or harvest (too fast, out of season, rate-limited) teaches nothing; drop rates match the chances within 4σ over 10,000 rolls per rarity on the memory mirror.
- Vitest `lib/crafting/crafting.test.ts`: the drop table is only bottle recipes, the migration seed matches `recipeDropsSql()`, and the validator rejects a common drop or a drop on a shop-card recipe.
- Full suite: 1075 passed (baseline 1068 + 7).
- SQL `web/supabase/tests/recipe_drops_smoke.sql` in `zsh specs/evidence/launch-fixes/sql-smoke.sh`. Fail-first (`sql-smoke.sh 20260930100000`): `ERROR: column "drop_rarity" does not exist`. Full chain output:

```
── recipe_drops_smoke.sql
NOTICE:  drops 1 seeds ok
NOTICE:  drops 2 members locked out ok
NOTICE:  drops 3 once per recipe ok
NOTICE:  drops 4 refused catches teach nothing ok
NOTICE:  drops 5 rate rock_crystal: 100 of 6000 (chance 0.02)
NOTICE:  drops 5 rate rock_gold_nugget: 210 of 4000 (chance 0.05)
NOTICE:  drops 5 rate fish_golden_koi: 454 of 3000 (chance 0.15)
NOTICE:  drops 5 rate rock_stone: 0 of 2000 (chance 0)
recipe drops smoke ok
```

  Section 2 checks that a member (authenticated) cannot call `crafting_catch_drop`, `collections_land_drop`, `collections_harvest_drop` or `crafting_learn`, cannot insert into `member_recipes`, cannot read or write `recipe_drop_chances`, and cannot set `drop_rarity`. Section 3 also sets `drop_rarity` on starter and shop-card recipes and deactivates one recipe to confirm none of them drop. Section 5 applies the migration a second time. Every other smoke output is identical to the baseline.

## Screenshots (`shots.mjs`, `?crafting=demo`, signed out, demo dice always drop)

- `R-02-harvest-taught-recipe.webp`: striking a rock that holds a crystal (rare) shows "NEW! Got Crystal!" and then "You learned a recipe: Glass rod".
- `R-03-workbench-from-a-rare-catch.webp`: on the same page, the workbench lists Glass rod as "From a rare catch." The sheet was opened by dispatching `tsi:workbench-near` in place instead of walking to HQ, because the demo's stores reset on navigation.
- `R-04-fish-taught-recipe.webp`: a first-catch reveal for a snapping turtle (rare) with "You learned a recipe: Glass rod". Math.random was pinned at 0.95 for the cast only, so the demo's server roll picked the turtle.
