# Section: fishing (complete for December 20)

Worktree `.claude/worktrees/fishing`, branch `game/fishing`, cut from main 5ae7c2665 on 2026-11-19. Run by the coordinator as one section with David (memory `feedback-uwotsi-one-section`): one section at a time, its influence on the rest of the game checked inside it, merged only on his approval. Building runs through `/delegate` (lane rules).

The December 20 plan (2026-11-19): UI packs (done, row 341), then **fishing**, then mountains, then combat, then the personal island, then a freeze from December 15.

## Scope

1. **Rods onto main.** Merge `game/rod-titanium`, which carries rod-gear rounds 1 to 11 and tool-pipeline's models, and `game/vfx-library`. Roster (`lib/game/rods.ts`): Flimsy, Precision, Training, Cedar, Carrot, Glass, Lighthouse, Tidewarden, Riptide, Titanium, Tempest. Also the awakenings, the per-rod catch counter, the Training rod found at 50 fish, and the rod seller. Finish the Titanium redo from Rods Titanium 3 (awakening, idle, workbench; `specs/lanes/rod-titanium.md` round 4).
2. **The tackle shop**, from Markets 1:
   - Rods, Bait and Bobbers in one shop with a toggle rail.
   - The general shop no longer sells rods, bait or bobbers. It keeps cosmetics and UI packs.
   - The tackle counter's gem roll becomes coins only (launch blocker, row 326).
3. **Big fish:** turn on legendary fish (the boss reel) and the divine fight (`NEXT_PUBLIC_FISH_BOSSES`, `realtime/src/rooms/raid.ts`). The roster is a question for David (below).
4. **Bait and bobbers:** real models through the asset pipeline (`specs/asset-pipeline.md`), and their effects.
5. **The awakening cutscene** in play, not only in the lab.

## Influence (check each, fix or flag, before the page)

- **Tutorial:** Bram's rod challenge (m4) and the walk past the rod and tackle shop.
- **Gem shop:** the newcomer pack's gear, the Glass rod (`game/gem-shop`).
- **Pre-registration:** the reward copy ("a limited edition rod").
- **Daily tasks:** "catch a river fish" (`game/daily-return`).
- **Every place that lists fish:** sushi, the tasting book, museum donations, the collection's counts, the catch board and chef orders, the HQ tank. New legendaries and divines need a decision in each: in, out, or special.
- **Sell prices:** new fish, and the economy around them.
- **The mountain section:** the pond's 10 fish and its legendary open there, not here.
- **Analytics:** the new `rodseller` screen.
- **UI packs:** new rod screens must use pack tokens (the guard test enforces it).

## Questions for David (asked 2026-11-19)

1. All 11 rods on December 20, with Riptide and Tempest modelled through the asset pipeline?
2. How many legendary fish? Proposal: one per open water (river, sea, cliff pool) plus the divine fight. The pond's legendary comes with the mountain.

## David's answers (2026-11-19)

1. Rods: "yes once its complete". All 11 ship on December 20, but each only once it is finished.
2. Legendaries: "3 is good, no divine yet". One legendary each for the river, the sea and the cliff pool. The divine fight stays off.

3. The three (David, 2026-11-19: "have diversity like one of them keep summer, so theres atleast 1 per season"):
   - **Namazu**, river, winter and spring;
   - **Umibozu**, sea, autumn and winter;
   - **Raiju**, cliff pools, summer, in rain.
   Every season has at least one, and two bite at the December 20 launch. Descriptions come from `specs/fish-list.md` section 4 on `game/fish-list`.

4. **Gear roles** (David, 2026-11-19: "rod has base stats, bobber has any small bonus, bait is either another booster or to catch more specific fish, or specific situation"):
   - **Rod:** the base stats.
   - **Bobber:** a small permanent bonus.
   - **Bait:** the only consumable. Coins only, used up per catch, never sold for gems or given by the gacha. Each bait is either a booster or a targeter (specific fish or a specific situation).
   - **Launch set** (proposed): Worms (faster bites), Sweet bait (rarer fish), Glow bait (night and bad weather), and the Legend lure (that water's legendary, craft-only).
   - Bait sells at the tackle shop's Bait tab. Farming bait comes with the personal island, after launch.

5. **Christmas rods** (David, 2026-11-19):
   - **Candy Cane rod** (rare): "make that the rod new players get at launch when pre reg". It is the pre-registration reward rod.
   - **North Star rod** (legendary): "very similar to fallen star rod"; "will be limited and can only get during christmas". Earned during the Christmas event, December 20 to January 6.
   - **Fallen Star rod:** stays the permanent legendary, crafted from the three legendary materials.
   - **No rod skins** ("no rod skins").
   - **The tackle counter's four "legendary" seasonal rods** (Pumpkin, Icicle, Bamboo shoot, summer): to be removed. Their baits stay.
   - Hero concept shots run on ElevenLabs flow C7WgY7cJR04g0sitR3VW.

6. **Christmas Rods 1 marks** (2026-11-19):
   - Candy Cane take A approved ("i like this one"): `art/pipeline/concepts/b/candy-cane/hero-1.png`.
   - North Star redo: "not cool enough. legendary rods need to feel super well desined and crazy"; "it doesnt even have to be rod looking as long as it looks super cool". David's reference is in the vault at `References/Rod references/north-star-ref.png`: a blazing star, a vine shaft with molten filaments, a fire orb, smoke.

7. **Christmas Rods 1, round 2 marks** (2026-11-19):
   - The fiery dark takes (`north-star/hero-5.png`, `hero-6.png`): "this looks like the fallen star rod". They become the **Fallen Star rod's** concept.
   - **North Star:** "need to make this more christmas looking and look like the north star, also the effects should be modeled layered on after the base model". David's reference: `References/Rod references/north-star-bethlehem-ref.png` (the Star of Bethlehem: a white eight-point star over a deep blue sky). Generate the base model alone first, then add the effects as layers.

8. **North Star effects reference** (David, 2026-11-19, Pinterest pin 620089442493947762): a shooting-star effect breakdown.
   - A bright white four-point star glint.
   - A violet, blue and gold iridescent comet trail built from noise and optical flares.
   - Radial speed streaks.
   - Saved in the vault at `References/Rod references/north-star-vfx-ref.jpg`; third-party, so kept out of git.

9. **North Star round 3 rejected** (David, 2026-11-19): "its ugly and horrible, i will just start giving you pinterest references". Generation pauses until his references arrive. Each one is saved to the vault, and the design is built from them, not from my own prompts.

10. **North Star references, round 2** (David, 2026-11-19), in the vault at `References/Rod references/north-star-r2/ref-110` to `117`:
   - **Animation:** the Pinterest pin (`north-star-vfx-ref.jpg`): "this animation needs to be replicated and it will be casting animation and rod animations".
   - **Effects:** 110 to 113: a blue burst, a violet burst, a white star with a pink trail, a gold crystal star with a trail.
   - **Art:** 114 to 116: a violet streak, a golden spear with rotating rings, a hand holding a star glint.
   - **Style:** 117, a gold star with violet crystal hands: "should be anime genshin impact style".
   - **First:** a 2D anime concept illustration, not a 3D model ("make the rod in the art style not in a 3d model style, so that we have a first iteration of what the art look of the rod will be").

11. **Round 5 marks** (2026-11-19):
   - The style sheet and the Candy Cane art (`candy-cane/art-3.png`) are approved.
   - North Star: "better, but the actual star is the reference star color very bright light with blue hue, make the hand around the star better looking".

## Status

- 2026-11-19: `game/rod-titanium` merged into `game/fishing` (5d6813d4a). The coordinator resolved 17 conflicts:
  - cream.css stays deleted, and its two new tokens went to vintage.css;
  - rolls use main's season with the rod passive;
  - the sushi meal still applies to the held rod;
  - the trophy and showcase sheets stay removed, and the rod seller sheet joins.
  - `rod_catches` was re-dated `20261119120000`, and the catalogue seed regenerated from the merged code as `20261119120001`, both in the SQL smoke chain.
- tsc clean. Full vitest and the SQL chain are running.

## Next

1. Merge `game/vfx-library`.
2. The SQL smoke chain.
3. Shots of the merged rods in the new world, against what David approved on the rods pages.
4. Then scope items 1 to 5, each through `/delegate`.

## Christmas rods concept art, approved 2026-11-20
- North Star: `art/pipeline/concepts/b/north-star/approved.webp`, round 7 take A. The crystal hand is coaxial with the rod, the star is white with a blue hue, and the line art is on the subject only. Takes C and D were also approved; A was called "looks good".
- Candy Cane: `art/pipeline/concepts/b/candy-cane/approved.webp`, the reel-fix take B. The reel hangs under the rod, side-on.
- Both made with gpt-image-2.6-sunburst edits, on flow C7WgY7cJR04g0sitR3VW.
- Next: a blueprint for each (asset-pipeline §1.5), then the model.
