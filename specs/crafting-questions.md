# crafting: open questions for David

Each has the assumption the build uses today. None blocks.

1. **Workbench placement.** A DIY bench (the existing reading table dressed with a rod, a net and a materials crate) against the clubhouse's west wall, member HQ only. The home closet area gets one later. *Assumption:* HQ bench only for v1.
2. **Workbench and bottle models.** No workbench or message-bottle asset exists in the repo or the ACNH dump. The bench reuses dump furniture; the bottle is a small lathe mesh (glass, cork, paper). *Ask:* send a workbench and a bottle model if you want them to match the dump's look.
3. **Starter recipes.** Three recipes everyone knows from day one so the bench is useful before the first bottle: straw hat, campfire, study chair (branches and stone only). *Assumption:* keep them.
4. **Shop recipe cards.** Four cards at 300 coins in the Tools tab (sturdy shovel, flower crown, bookshelf, floor lamp). Buying one teaches the recipe in the same transaction (database trigger on `member_inventory`); the card stays in your pockets as a keepsake and can't be bought twice. *Assumption:* flat 300 coins.
5. **Craft-only items are shop rows with `active = false`.** Tier 3-5 nets and shovels, rods 4-5, three rare outfits/accessories. The catalogue's one-price rule needs a price, so each has a nominal value that nothing charges. An admin who re-activates one in the ShopEditor would put it on sale. *Assumption:* fine; a `craft_only` flag is the upgrade if that ever happens.
6. **Combat gear goes to `member_weapons`, not `member_inventory`.** The four gear recipes make existing weapons (iron sword, yew longbow, brass revolver, rune staff) at full durability, because that's where combat reads gear. No new weapons rows (stats are out of scope). *Assumption:* keep them in the combat table.
7. **Tree branches.** Every tree can be shaken for one branch per real hour per player (like fruit, decision 97); a fruit tree gives its fruit first, then a branch. Branches are a new collection species `wood_branch` (category `mineral`, sub `wood`, not donatable, sells as a common mineral for 5 coins). They are added by the crafting migration, not the collections roster, so the launch roster counts (row 129) stay as they are.
8. **Rocks.** The existing rock nodes already give stone, clay, iron, crystal and gold ("Strike the rock"). No shovel is required to hit them, because nothing in the world equips tools yet. *Assumption:* no tool gate until tools are equipped in the world.
9. **Message bottles.** One per Toronto day per player, on one of the village beach spots (rotates daily), teaching a bottle recipe the player lacks, picked the same on every retry that day. When a player knows every bottle recipe, no bottle washes up. *Assumption:* village beach only, not the home island.
10. **Resident quests.** No resident personal quests exist yet. `learnFromQuest()` (lib/crafting/service.ts) is the hook they call server-side; the client-facing `/api/crafting/learn` only opens the bottle. Top-tier recipes (rods 4-5, emperor net, golden shovel, koi kimono, crystal circlet, brass revolver, rune staff) are tagged `quest` and `bottle`, so they're reachable by bottle until quests exist. *Ask:* should they become quest-only once residents have quests?
11. **Rare-catch drops (row 199).** Not built: a rare catch doesn't drop a recipe yet. The catch route is client-reported (hourly-capped), so a drop there would be farmable. *Assumption:* wait for server-rolled catches.
12. **Rod gate.** Rods come from the server inventory (`catalogue_ref` of owned tools); the dev-only `?rod=` override is gone. Signed out, you fish with the starter rod. The fishing card shows the rod's name while you wait for a bite (tier 2+).

## Coordinator rulings (2026-09-26)
1. HQ bench only for v1: accepted.
2. Workbench and bottle models: built in-house by the props/enemies Blender agent (`specs/props-and-enemies-art.md`); no ask to David.
3–9. Accepted as built.
10. Resident quests call `learnFromQuest()` when the resident roster lands (waits on David's founders' names and traits, row 217).
11. Rare-catch recipe drops wait for server-rolled catches. Backlog item "server-authoritative catch rolls" added to the roadmap: catches are client-reported with hourly caps today, which bounds but does not remove farming.
12. Accepted.
