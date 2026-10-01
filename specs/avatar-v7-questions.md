# Avatar v7: questions and assumptions (build agent)

None of these blocked the work; each one records the assumption I took. Art verdicts are David's. The sheets are in `specs/evidence/avatar-v7/`.

## The full library (2026-09-30, after "Approve with tweaks")

Open first: `09-before-after.webp` (the three tweaks), `10-library-bangs.webp`, `11-library-backs.webp`, `12-hats.webp`, `04-expressions.webp`.

1. **Where bangs meet the back.** Lock pieces meet with a step up to 13.2 mm on the worst of the 192 pairs (swept_l over the high pony), median 5.1 mm. Shell hair was held to 3 mm. Lock pairs are now held to 14 mm: the 12 mm groove the fuller hair has between any two locks, plus 2 mm.
   - Assumption: where one lock ends beside another, the step reads as one more groove. 127 pairs are above the old 3 mm, none above 14 mm.

2. **Bangs own the front crown.** Every bangs lock roots at the crown whorl and runs forward at full volume; the backs have no locks over the front crown. That is how bangs and back meet in buried roots on every pair.
   - Assumption: fine, since a bangs choice already shapes the front of the head. It does mean the top of the head changes with the bangs.

3. **Triangle budget.** The heaviest bangs, the heaviest back, the heaviest outfit and glasses, on the base, come to 3,989 tris. With the heaviest hat in place of the back, 3,995. `look.test.ts` checks both stay under 4,000, so the 4,500 allowance was not needed.
   - Not counted: bands (which keep the back hair), bags and neck items. A flower crown over the heaviest back, plus a bag and a scarf, reaches about 4,940. Milestone 1 counted the same way; that case was about 4,670 then.
   - Assumption: the 4,000 covers hair, outfit, glasses and hats.
   - If every slot must fit, the cheapest cuts are:
     - the circlet's 5 deg band (600 down to about 340 tris);
     - the crown's blossoms (624 down to about 450);
     - capping the three heaviest backs at about 1,000 (braid crown 1,110, wolf 1,086, pigtails 1,070).

4. **Headwear budget.** Hats now carry lock tucks under the brim (a cap plus seven short locks), so the per-piece headwear limit went from 1,100 to 1,150. The sunhat and straw hat are 1,116.

5. **Talk mouths, drawn taller.** The first bigger talk cells read as wide slits in the engine. The mouth sits where the face turns under toward the chin, so the camera sees it about half as tall as drawn.
   - T1-T4 are now drawn about 1.7x taller than the picks they follow (M3.1, M6.1, M2.1), and grow upward so they stay above the jaw line.
   - Assumption: shapes that read as open beat strict copies of the picks' proportions. The resting mouth is unchanged.

6. **Sheen.** Thin near-white streaks run along each lock (its centre line and two side lines) and move with the sun, like hair-3d-set's highlights. Behind them, the up-facing ring of the hair gets a small lift.
   - The cap under the locks is matte, so the grooves stay dark.
   - Assumption: streaks, not one wide band; a wide band read as blocky patches on the faceted locks.
   - The strength is one clamp in `faceMaterial.ts` (0.55).

7. **Pulled-back styles sit tight.** The pony, pigtails and buns gather from the crown and lie about 8 mm tighter than the loose styles. Their median volume (1.3-1.6 cm) is under v6's.
   - Assumption: a pulled-back style hugs the head. Say if they should be as full on top as the bob.

8. **Undercut.** The shaved sides are a matte cap at 10 mm over the scalp: short hair, not skin. A thinner cap lets skin flecks show through its quads.
   - Assumption: shaved reads as short dark hair.

9. **Visible rough spots.** These are the ones to judge on the sheets:
   - On the bowl and short spiky backs, a lower lock's tip sticks out under the layer above (side view, `11-library-backs`).
   - The high pony's tail is a fan of five thin locks.
   - The wispy bangs are deliberately sparse, so skin shows between the strands.

10. **Your Blender window.** It holds my working file (`/private/tmp/.../scratchpad/v7_work.blend`, every piece's curves plus a gallery) and is safe to close. The review files are `art/characters/v7/head.blend`, `hair_bangs.blend` and `hair_backs.blend`.

## Milestone 1 (2026-09-30), where each one landed

1. **Hair volume:** answered, "Fuller, like the sheet". Done; see 1-3 above.
2. **Straight fringe height:** stands. The bob's fringe ends just above the brows, so the brows stay visible under the default fringe.
3. **Replacing old ids:** stands. "Short layered" lives under `bangs_spiky` + `back_short_spiky`; every other id is rebuilt as locks under its own name.
4. **Sheen:** answered, "Stronger glossy band". See 6.
5. **Talking mouth:** answered, "Bigger talk shapes". See 5.
6. **Expressions:** stands. Angry is carried by the brows, and the look's eyes stay.
7. **Blinks:** stands. Half, closed, half at random 2-6 s; E8.1 and E6.1 never blink.
8. **Head triangles:** stands (744).
9. **Older library flags:** done. All 28 pieces are locks; fit_check has 0 fails and 0 flags.
10. **Creator framing:** stands. The creator still starts at a 3/4 turn; the bench at `/lab/avatar` shows fronts.
