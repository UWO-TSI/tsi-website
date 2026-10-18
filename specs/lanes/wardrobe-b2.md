# Lane: wardrobe batch 2

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/wardrobe-b2`
- **Branch:** `game/wardrobe-b2`

## Status (2026-10-18)

- **Head:** `13494fe2 [wip]`, on top of `cf28320f` (round 4).
  - The WIP is the previous agent's round-5 rebake, stopped midway: 153 files, mostly `art/characters/hair/full/*.glb` and their LODs.
  - The rebake is partial, so it isn't consistent. Rerun the full hair build once your cut change is in rather than trusting these files.
- **Approved:**
  - every hair (round 4), with #15 V-kei lowered again and approved in round 5;
  - the #04 crew visor's placement (round 5);
  - the batch 2 fit and pricing.
- **Open:** the hat cut is a REDO (below).
- **Unapplied seed:** `web/supabase/migrations/20261017172740_catalogue_seed.sql`. It holds batch 2, the colour wheel at 250 gems, the avatar effect `glitch-aura` at 250, and #22 as the ushanka at 200.
  - When David approves the hat cut, the coordinator applies it to prod and merges the branch.
  - Never edit an applied migration. If the seed needs regenerating, do it in place, since it's still unapplied.

## David's decisions (newest first)

**2026-10-18, round 5 hat cut: REDO.** His note, verbatim:

> "18 hair deletion is showing, map out the hair deletion higher in th hat
> 21 same thing
> 24 same thing
> 22 same thing
> 04 needs hair deletion near the logo so hair isnt blocking"

What it means:

- **#18 top hat, #21 cowboy, #24 straw, #22 ushanka:** the cut edge is visible.
  - Keep the cut boundary well up inside the hat's cavity, so the hair runs on up under the rim. From no angle may a cut edge, a stub or a scalp gap show between the hair and the hat: front, 3/4, side, back, and slightly high and low.
  - The hair should touch or tuck under the rim.
  - Remove only hair that would poke through the hat's surface.
- **#04 crew visor:** hair covers the logo on the front band. Clear the hair in front of the logo area, around the "M", so the logo shows fully from the front and 3/4. Keep the hair elsewhere around the band.

**2026-10-18, round 4:** "the delete hair under hat needs to be better mapped, currently hair is being deleted outside of hat, map from the inside of hat". Round 4 rebuilt the cut from each hat's own cavity. Keep that approach and fix the boundary height.

Earlier decisions:
- the per-item notes are in `specs/art-direction-oct17.md`, under "Wardrobe batch 2";
- the provisional Roblox attachment estimates are explained there too (`roblox_attachments.json`).

## Next

1. Review the WIP, then finish the round-5 cut:
   - the cut boundary higher in #18, #21, #24 and #22;
   - the logo clearance on #04.
2. Rebuild every hair and its LODs, so the hair files are consistent again.
3. Make the evidence sheet `specs/evidence/wardrobe-b2/18-round5-hatcut.webp`.
   - For each hat: #03 long, #10 short, #27 buns, the curly pigtails and a bob, at front, 3/4, side, back, high and low.
   - Add zoomed rim crops for #18, #21, #22 and #24.
   - Show #04 front and 3/4 with the logo clear.
4. Run the gates:
   - tsc, and lint on the changed files;
   - the FULL vitest under the heavy lock;
   - `sql-smoke.sh`;
   - fit_check;
   - the character budget, at most 7,800 / 5,100 / 4,000 for the heaviest look.
5. Update this file, commit, and report the head and sheet path.

## Tools and gotchas

- **Scripts:**
  - in `specs/evidence/wardrobe-b2/`: `shoot.mjs` (headless shots), `sheets.py`, `render_hatcut.py`;
  - `art/characters/hair/import_hair.py`;
  - `art/characters/accessories/import_roblox.py`.
- **Woven hat:** it's an open weave, so hair under its skirt shows through the gaps. That's accepted.
- **Known flag:** fit_check's one standing flag is #20 waves (skin_through 0.005).
- **Recolour:** it keeps lightness. Two-colour hairs have two channels.
- **After this merges,** the avatar creator restyle (flat-ui step 8), the merch catalogue rows and the body rework can start.
