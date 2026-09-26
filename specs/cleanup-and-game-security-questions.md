# cleanup-and-game-security: open questions for David

Each item has the assumption the agent took so the work kept moving.

1. **Catch caps (20260926150900).** A catch is capped per species per hour by rarity (common 60, uncommon 30, rare 12, epic 6, legendary 3) and at 200 per member per hour. Assumption: no honest player reaches these; they only bound what a scripted client can mint. The real fix is a server-rolled catch (the server picks the fish), which is a bigger change. Tell us if the numbers should differ.
2. **Clamping old stock (20260926150900).** Stock written through 023's self-editable path is clamped to 99 per species when the migration runs, because 033 turns it into coins. Assumption: nobody legitimately holds more than 99 of one species. Before applying, `select count(*) from member_collections where count > 99` on prod shows how many rows it touches.
3. **Legacy Gem routes now need 033 (commit "Gems: legacy writers go through wallet_apply").** `/api/economy` (marketplace buy, avatar buy, T1/T2 award) and `awardRewards` (bounty, achievement, onboarding) call `wallet_apply`, so they only work once 033 and 20260926151100 are applied. Assumption: the game migrations go out in one window with this code, as planned. Bounty, achievement and onboarding rewards are now keyed per member (a re-approved bounty pays once).
4. **Two Gem shops.** `/student/dashboard/shop` (marketplace) and `/student/dashboard/economy/shop` both exist. Not retired: that is a product call.
5. **Study chat double auth (audit R8 / item 19)** is not fixed: `app/api/study/*` belongs to the study agent right now. Follow-up: use one context and read the mute through its db.
6. **Legacy local coins and gear are gone (coordinator ruling).** Balances and rods bought with the old localStorage wallet (`tsi.coins.local.v1`, `tsi.gear.local.v1`) are no longer read; the island's rod comes from the server inventory (033 already migrates 024's `profiles.gear`). Assumption: nobody's local-only progress needs carrying over, since the game was never deployed.
7. **Rarity colours.** The journal's rarity pills (`JournalPages.tsx RARITY_COLOR`) and the fishing HUD (`fishing.ts RARITY_META`) use two different palettes. Not merged, because either choice changes how one screen looks. Which palette should win?
8. **Stubs the shop now sells (audit item 22).** The wardrobe stub gives hair/tops free and DecorateSheet places catalogue furniture free, while the shop sells both. Untouched until you pick the rule.

## Follow-ups for other owners (files this agent could not edit)
- `DefaultIslandWorld.tsx`: import the three progression sheets directly and delete `components/game/progressionSheets.tsx` (item 14); open the collections journal from the catch board instead of the placeholder sheet (item 11); one `FamilyReveal` shared with `OracleSheetEmbed` (item 1); use `apiCall` for its collections fetch (item 5); read the monument stage from `activeGoal` so progressionBridge's `monumentStage` can go (item 7); use an `IslandSheet` for its sheet chrome, together with Showcase/Donate/Wardrobe/Settings/OracleQuiz sheets (item 16).
- Study: delete `/api/study/tables` (no caller; item 11); `lib/study` onto `lib/result.ts` and `withStore` (item 2), `apiCall`/`newKey` (item 5); chime through `AudioManager` (item 13); a seed-sync test for `study/tables.ts` vs 032 (item 18).
- Not done, low value: one `memoryWallet()` for the five memory stores (item 12). Each store raises its own domain error on insufficient funds, so sharing saves little and the SQL smokes stay the authority.

## Coordinator ruling on 8 / audit item 22 (2026-09-26, follows ledger rows 186–187, 110, 210)
Ownership is required for things the shop sells, with free starters:
- **Creator identity is always free:** skin, eyes, mouth, brows/extras, every bangs and back-hair style, and 6 hair colours. The other 6 hair colours are shop dyes (row 186 "hair recolours"), bought once and then free to use.
- **Clothing:** a free starter set per account (base tee, base shorts, 2 more tops, 2 more bottoms, the hooded rain-cape, 2 shoes). Everything else is bought, crafted or merch.
- **Furniture:** the starter home pieces (bed, lamp, shelf) plus a 10-piece starter pack are free; the rest is bought or crafted.
- WardrobeSheet and DecorateSheet read owned items from `/api/economy/inventory`; the free starters are granted once through the wallet/inventory service (idempotent, first login). Delete `WARDROBE_STUB` and the free catalogue stub.
Queued as the next polish task together with the DefaultIslandWorld/study follow-ups above.
