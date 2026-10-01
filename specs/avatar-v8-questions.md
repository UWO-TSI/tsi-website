# Avatar v8: questions and assumptions (build agent)

None of these blocked the work. Each one records the assumption I took. Art verdicts are David's. The sheets are in `specs/evidence/avatar-v8/`.

## Hair: on hold (David, 2026-10-01)

David on the first organic pass: "the character hair looks so ugly like it looks so poorly generated and does not have the hairstyle feel. I will give some game reference for you to train on."

The hair-look rework waits for his game references (`specs/references/characters/david/games/`).

What is committed is a WIP pass. It is not polished further:
- bob, long and short reworked;
- the afro and box braids (front and back pieces);
- the strand texture;
- the pipeline hooks (soft normals, baked occlusion, coil and plait locks).

The ACNH study (`specs/evidence/avatar-v8/acnh-hair-study.md`) explains the gap. Ours is still many separate locks; ACNH is one smooth mass whose outline alone breaks into points, with the strands painted. The next pass should start from that and from his references, not from the WIP.

1. **Does the WIP hair stay in the catalogue until the rework?** The six reworked pieces and the four new ones ship under their ids today. They pass fit_check with 0 fails.
   - Assumption: yes. Revert to v7 for the three old styles with `git checkout c0555593 -- art/characters/hair/{bangs,back}/<id>.glb` and the sync, if he prefers v7 until then.
2. **Afro and box braids had no reference.** Both follow hair-acnh's language, and both are WIP:
   - the afro: about 19 round curl clumps on a round mass;
   - the braids: twisted-diamond plaits.
   - The ACNH study shows the afro (PlayerHair36) and box braids (PlayerHair34) as reference points.
3. **New bangs for the new types.** The afro comes with a curly fringe (`bangs_curls`), the braids with a braided front (`bangs_braids`). Both own the front crown like every bangs piece, so they sit on any back.

## Hair accessories (deliverable 3)

4. **Where each one sits.** Each accessory lists its anchors in order and takes the first one the worn style declares (back piece first, then bangs):

   | Accessory | Anchors, in order | On a loose style |
   |---|---|---|
   | Claw clip | pony base, bun, crown | the back of the crown |
   | Bow | pony base, bun, braid end, side | above the left ear |
   | Scrunchie | pony base, bun, braid end | hides (nothing to wrap) |

   - Assumption: one placement rule per accessory, no player choice of anchor. Say if players should pick the spot.
5. **Two ties wear two.** Pigtails and twin buns declare two pony or bun placements, so a scrunchie or bow appears on both. It still counts as one accessory.
6. **The hide rule.** A hair accessory hides when:
   - the worn back and bangs declare none of its anchors; or
   - a hat or a hood is worn (anything that hides the back hair).

   Bands (the flower crown and circlet) do not hide it. The saved look keeps the accessory, so it comes back when the hat comes off.
7. **Side is the character's left.** The `side` anchor is above the left ear and `fringe` on the left of the fringe. Mirroring per look would need a toggle.
8. **Not sold yet.** The three hair accessories have no shop rows: they are kept out of the ownership seed until deliverable 5.
   - Until then, players cannot save a look wearing them: the server checks ownership. They work in the bench and the evidence.
   - When they are sold, "a few starters, the rest in the shop at today's accessory price (80)" needs a new seed migration. Adding them also reshuffles the daily specials, because the specials snapshot depends on the pool.
   - Assumption: the economy waits for your approval.
9. **Accessory budgets** (row 265 puts accessories outside the 4,000):
   - hair accessories, glasses, bags and neck pieces: at most 600 triangles each;
   - headwear: at most 1,700, including the hair tuck it carries in place of the back hair.

   The pieces as built:

   | Piece | Triangles |
   |---|---|
   | Claw clip | 492 |
   | Bow | 320 |
   | Scrunchie | 336 |
   | Backpack | 588 |
   | Beanie | 1,624 |
   | Sun hat | 1,284 |
   | Straw hat | 1,284 |
   | Cap | 1,120 |

   - `look.test.ts` now checks the look budget (base + heaviest bangs + back + outfit) without accessories, and each accessory against its own budget.
10. **One material per piece.** The hair accessories are one material each (M_Main, the colour the player picks). The remodeled beanie and backpack keep their existing material slots: M_Hair on the beanie is its tuck, tinted with the hair colour. Every character still draws as one merged mesh.

## Remodeled accessories (deliverable 4)

11. **Beanie.**
    - 24 knit ribs: raised and sunken columns, the sunken ones baked darker.
    - A thicker rolled cuff with deeper ribs.
    - A slight slouch to the back.
    - A bigger, lumpy pompom.
12. **Backpack.**
    - A padded body that puffs out at the back and rounds over the top, with a soft sag fold low on the front.
    - A flap that rolls over the top.
    - A puffy pocket, a grab loop, and thick padded straps (closed slabs, not single sheets).
13. **The other hats' hair tucks.** The sun hat, cap and straw hat were not remodeled, but their hair tucks now use the rounded clump locks with soft normals, so every hat matches the hair under it.
    - The flower crown sits on the new bob. Its vine follows the hair as before, and its blossoms are 12% smaller (they overhung a groove by 1.2 cm).

## Checks

14. **fit_check gained a hair-accessory seating check.** It tests every hair accessory on every back piece (with the default bangs) that has one of its anchors:
    - at most 4 mm of air under it;
    - at most half of it sunk into the hair.

    The worst cases are 2 mm of air and a 32% sink. This needs re-running whenever the hair is reworked: accessories follow the anchors, which are measured on the built pieces.
