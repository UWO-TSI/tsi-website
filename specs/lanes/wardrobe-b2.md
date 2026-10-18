# Lane: wardrobe batch 2

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/wardrobe-b2`
- **Branch:** `game/wardrobe-b2`

## Status (2026-10-18, end of day)

- **Head:** `974677d1` (round 5), on top of `5e42ee17` (main merged, no conflicts). This file's update is the commit after it.
  - The `[wip]` commit `13494fe2` is finished by round 5; nothing of it is left half done.
- **Round 5 is ready for David's review:**
  - `specs/evidence/wardrobe-b2/18-round5-hatcut.webp`: every covering hat over #03, #10, #27, #25 and #23, at front, 3/4, side, back, high and low.
  - `specs/evidence/wardrobe-b2/18b-round5-rims-visor.webp`: the rims of #18, #21, #22 and #24 close up, #10 with no hat (its nape), and #04's visor at front, 3/4 and high.
- **Gates at round 5:** all passed.
  - tsc and eslint on the changed files.
  - Full vitest: 347 files, 3,329 tests.
  - `sql-smoke.sh`, with gen-seeds reporting the seeds up to date.
  - fit_check PASS, with only #20's standing flag.
  - Heaviest look 7,757 / 4,997 / 3,974, within 7,800 / 5,100 / 4,000.
- **Approved:**
  - every hair (round 4), with #15 V-kei lowered again and approved in round 5;
  - the #04 crew visor's placement (round 5);
  - the batch 2 fit and pricing.
- **Open:** the round-5 hat cut, waiting on David.
- **Unapplied seed:** `web/supabase/migrations/20261017172740_catalogue_seed.sql`, unchanged, still sorting after every migration on main. It holds batch 2, the colour wheel at 250 gems, the avatar effect `glitch-aura` at 250, and #22 as the ushanka at 200.
  - When David approves the hat cut, the coordinator applies it to prod and merges the branch.
  - Never edit an applied migration. If the seed needs regenerating, do it in place, since it's still unapplied.

### What round 5 did (art/characters/hidden_cut.py)

- **#18, #21, #24 and #22 (`cover_cut`):**
  - A hair point goes only when no view reaches it with the hat on.
    - The views are 128 directions over the whole sphere.
    - The hat, the head and body, and the hair itself block them.
    - It's asked again without the poking hair, until nothing more shows.
  - The point also goes only when all hair within `CUT_CLEAR` (3.5 cm) goes too. So the cut's edge stays well up inside the hat.
  - Hair poking out through the hat goes:
    - hair over the hat with nothing above it, or with the hat between it and the head's centre;
    - the outer end of an edge through the hat's surface, and its inner end with it;
    - a root just under a brim (`ROOT_CLEAR`, 2 cm);
    - the strand beyond, within the hat's reach;
    - any leftover piece of `FRAG_MAX` (16) points or fewer.
  - Hair hanging under a brim or a crown always stays. Hair outside a flap (`FLAP_CLEAR`) doesn't count as hanging.
- **#01's cap and the woven hat (`ROUND4`):** they keep round 4's rule, since David didn't send them back. Their bits are identical to round 4's.
- **#04's visor:** every hair triangle between its logo and a front or 3/4 view goes (`LOGO_VIEWS`: yaw -50 to 50, pitch -10 to 40).
- **Rebuild:** every hair was rebuilt from source and synced. The geometry and tris match round 4.

### Residuals the sheet shows (tell David; not fixed)

- **#18 over #10:** three small spikes stand above the brim at the back.
- **#18 over #23:** a dark hair strip lies on the brim at the back.
- **#22 over #27:** a few thin wisps of the side tufts are left beside the flaps. The tufts come out through the flaps, so most of them go.
- **#22 over #25:** the big curls outside the hat stay. They don't pass through it.
- **Tried and dropped (they cut visible hair under the brims):**
  - `ROOT_CLEAR` 4 cm;
  - following poking strands 10 cm past the hat;
  - `FRAG_MAX` 48.

## David's decisions (newest first)

**2026-10-18, round 5 hat cut: REDO.** His note, verbatim:

> "18 hair deletion is showing, map out the hair deletion higher in th hat
> 21 same thing
> 24 same thing
> 22 same thing
> 04 needs hair deletion near the logo so hair isnt blocking"

What it means:

- **#18 top hat, #21 cowboy, #24 straw, #22 ushanka:** the cut edge was visible.
  - Keep the cut boundary well up inside the hat's cavity, so the hair runs on up under the rim.
  - From no angle may a cut edge, a stub or a scalp gap show between the hair and the hat. That covers front, 3/4, side, back, and slightly high and low.
  - The hair should touch or tuck under the rim.
  - Remove only hair that would poke through the hat's surface.
- **#04 crew visor:** hair covered the logo on the front band.
  - Clear the hair in front of the logo area, around the "M", so the logo shows fully from the front and 3/4.
  - Keep the hair elsewhere around the band.

**2026-10-18, round 4:** "the delete hair under hat needs to be better mapped, currently hair is being deleted outside of hat, map from the inside of hat".

Earlier decisions:
- the per-item notes are in `specs/art-direction-oct17.md`, under "Wardrobe batch 2";
- the provisional Roblox attachment estimates are explained there too (`roblox_attachments.json`).

## Next

1. Wait for David's verdict on sheets 18 and 18b. The coordinator relays it.
2. If he sends it back:
   - Iterate with the Blender diagnostic first. It's fast, about a minute for five hairs. See below.
   - Then rerun `hatcut` on every hair and sync.
   - Reshoot only the changed sheets (`R5_ONLY`) and rebuild them with `sheet_round5.py`.
3. Once he approves:
   - The coordinator applies the seed and merges.
   - Then the avatar creator restyle (flat-ui step 8), the merch catalogue rows and the body rework can start.

## Tools and gotchas

- **Rebuild order:** each step is a foreground call under the Blender lock, and each takes seconds to 3 minutes.
  1. `Blender -b -P art/characters/hair/import_hair.py -- --no-lod --no-sync`
  2. `Blender -b -P art/characters/build_lod.py -- <every catalogue hair id>`. In zsh, split the ids with `${=IDS}`, or nothing is built.
  3. `hidden_cut.py -- hidden <the hair ids>`
  4. `hidden_cut.py -- hatcut`
  5. `node web/scripts/sync-character-assets.mjs`
  - Sync rewrites `decal_tsi_mark.png` and `hair_colour_world.png` byte-for-byte differently but pixel-identically. Check out the committed copies.
- **Measure:** `hidden_cut.py -- measure --detail`. LOD 2 is the tight tier, with about 26 triangles of slack.
- **Diagnostic, Blender, no browser:**
  - `specs/evidence/wardrobe-b2/diag_hatcut.py` renders whole versus cut from six (or 24) views in flat hues (hair blue, hat green, skin red). It counts the changed pixels by what they now show (magenta: skin, background or other hair; cyan: the hat).
  - `diag_contact.py` lays them out.
  - Run hatcut on five hairs first (`hidden_cut.py -- hatcut <ids>`, about 40 s). That rewrites their files, so rerun every hair before committing.
- **Engine shots:**
  - `HOST=http://localhost:3184 node specs/evidence/wardrobe-b2/shoot.mjs <dir> round5`, with `R5_ONLY=r5-acc_x,...` for a subset.
  - Then run `python3 specs/evidence/wardrobe-b2/sheet_round5.py <dir>`.
  - The bench's `&views=` takes `high` and `low`. `&zoom=` and `&look=` frame a rim.
  - The canvas is the viewport, so size the viewport to the whole sheet. Otherwise the bottom row is clipped flat and reads as a cut.
- **Locks:** swap stays over 9 GB here, so the locks are exclusive.
  - Your own browser lock blocks your own Blender lock. Finish the shots, release, then use Blender.
  - The shared `withlock.sh` waits 20 minutes, longer than a foreground call. Use a copy that waits at most 8.
- **Woven hat:** it's an open weave, so hair under its skirt shows through the gaps. That's accepted.
- **Known flag:** fit_check's one standing flag is #20 waves (skin_through 0.005).
- **#10's nape:** the stepped edge low at the back of its head is the hairstyle's own (sheet 18b shows it with no hat).
- **Recolour:** it keeps lightness. Two-colour hairs have two channels.
