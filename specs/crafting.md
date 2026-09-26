# Crafting spec (workshop, recipes, materials)

Owner: one systems+world agent in its own worktree. Decisions: rows 58, 60, 62, 63, 94, 129, 193, 198, 199, 127. Ledger wins. Load the `ponytail` skill before coding.

## Fixed decisions
| Topic | Decision | Row |
|---|---|---|
| Model | Reliable recipe crafting: learn recipe, gather ingredients, craft at a workbench; no minigame, no random quality | 63 |
| Roster | ~30 recipes: tool tiers 3–5 (rods, nets, shovels), a few outfits, furniture, rare rods and some combat gear | 198, 60 |
| Top tier | Rods 4–5 and top outfits/gear are craft-only; rare ingredients make rare items | 94, 193, 62 |
| Learning | From residents' personal quests, a few sold at the shop, message bottles on the beach, drops from rare catches | 199 |
| Materials | Fruit, flowers, shells, mushrooms, rocks/ore from the foraging roster; fish/bug drops as rare ingredients | 129 |
| Economy | Consumes ingredients exactly once, retry-safe; outputs go to `member_inventory` via the wallet/inventory service | 33 (economy spec) |

## Assumptions (log in `crafting-questions.md`, keep going)
- Workbench location: a DIY bench inside HQ (resident-services analog) plus the home closet area later. No separate workshop building in v1 (row 155 has none).
- Wood: shaking a tree can drop a branch (common, hourly respawn per tree like 97); stone and ore from hitting rocks with a shovel.
- Message bottles: one per real day on the beach per player, containing a recipe the player lacks.

## Deliverables
1. Migration draft (next timestamp after the Phase 0 renames): recipes (id, output item, qty, ingredients JSON, source tags), member_recipes (learned, source, learned_at), craft_log; a service-role `craft` function that checks the recipe is learned, debits ingredients and credits output atomically with an idempotency key.
2. `web/lib/crafting/`: recipe data for ~30 recipes built from existing item keys in the collections roster and the economy catalogue (no invented item ids without adding them to the catalogue); learn/craft service; tests for insufficient ingredients, double-submit, unlearned recipe, rods 4–5 unlocking the fishing tier gate (replace the dev-only `?rod=` gate).
3. Routes `/api/crafting/{recipes,craft,learn}`; shop sells a few recipe cards; resident-quest and bottle sources call `learn`.
4. World: workbench prop in HQ with a prompt; crafting sheet (recipe list, ingredient counts owned/needed, craft button, result card); beach message bottle spawn; tree-shake branch drop; rock hit for stone/ore.
5. Evidence prefix K- under `evidence/crafting/`; tsc, focused lint, vitest.
Out of scope: resident quest authoring (only the `learn` hook), combat gear stats beyond the item record.
