# Avatar v8: organic, matte hair and accessories (rows 264–266)

David, 2026-10-01:
- "why is the character so plasticy and shiny, they should not be toys, they should be characters with normal matte hair" (row 264).
- "i want better more organic looking hair accessories and types" (row 266).

He picked every hair-type family, every hair-accessory family, a hand remodel of all 12 existing accessories, and building from the references he already supplied. Accessories do not count toward the 4,000-triangle look budget, and lock joins up to 14 mm are fine (row 265).

## Where it stands
- **Characters are matte** since `8f5b9a6f`: every character material is diffuse only (`MATTE` in `web/lib/game/character/faceMaterial.ts`), and the hair gloss band is gone.
- **Hair** is the v7 library: 16 bangs and 12 backs, built as sculpted locks (`art/characters/v7/`: `locks.py`, `hair_styles.py`, `hair_build.py`, `export_hair.py`, `hair_bangs.blend`, `hair_backs.blend`). Every style is straight or lightly wavy.
  - Its locks are faceted low-poly ridges with hard grooves, one flat colour each. Even matte, they read as molded toy hair.
  - The mesh still carries each lock's UVs (`hairSheen` and `hairTangent` in `web/lib/game/character/rig.ts`), which nothing uses now.
  - Known rough spots: lower lock tips poke out on the bowl and short-spiky backs, and the pony is a thin fan.
- **Accessories**: 12 pieces built from primitives in code (`art/characters/accessories/build_accessories.py`) in groups face, head, bag and neck, one of each (`web/lib/game/character/look.ts`).
  - The pieces: round glasses, square glasses, beanie, sun hat, cap, straw hat, flower crown, crystal circlet, backpack, shoulder bag, scarf, shell necklace.
  - Hats hide the back hair and carry a hair tuck.
  - Several are shop or craft items (seeded in the database).

## References (David's, in `specs/references/characters/david/`)
- `hair-acnh.png` (A1.1–A2.3): soft rounded masses, a fine painted strand texture, no plastic ridges.
- `hair-fluffy-silhouettes.png` (S1.1–S2.3): fluffy silhouettes with irregular flicks and tips.
- `hair-3d-set.png`, `bangs-sheet.png`, `hair-sketched.png`, `character-ref-15` to `18`.

No references from the web: David supplies every visual reference. Where a new type (curls, braids, locs) has no reference, follow these sheets' language and flag it in the questions file.

## Deliverable
1. **Organic hair look, for the whole library.**
   - Soft rounded hair masses with smooth shading instead of faceted ridges.
   - Irregular flicks and tapered tips at the silhouette.
   - A matte painted strand texture along each lock: fine strand lines, a slight root-to-tip value shift and a darker inner layer. It takes the catalogue hair colours and keeps the existing ids.
   - Reuse the lock UVs already on the mesh for the texture, or remove that attribute if the texture lives elsewhere.
   - No specular, no gloss (row 264). Fix the known rough spots.
2. **New hair types**, as bangs and back pieces in the same system:
   - **Curly and coily:** afro, loose curls, twist-out, curly bob. Volume is built from curl clumps.
   - **Braids and locs:** box braids, cornrows, locs, long single braid.
   - **Short cuts:** buzz cut, fade, mullet, textured crop.
   - **Long and half-up:** side pony, half-up half-down, low pony, long layered.
   - Styles that cover the whole head (buzz, cornrows, fade) need a no-bangs pairing. Check how the catalogue handles an empty bangs slot first.
3. **Hair accessories**: a new `hair` group, one per look, each taking a colour:
   - **Clips and pins:** barrette, claw clip, star clip, shell clip, hairpins.
   - **Bows and ribbons:** bow, ribbon.
   - **Scrunchies and ties.**
   - **Headbands and flowers:** headband, bandana, a flower behind the ear.

   How they attach to styles:
   - Every back and bangs piece declares named anchors: pony base, bun, braid end, crown, side above the ear, fringe side.
   - Each accessory sits on an anchor and follows the style.
   - An accessory hides when the style lacks its anchor or a hat covers it (state the rule).

   The engine, look validation (`look.ts`) and the server save path must accept the new group.
4. **Remodel all 12 existing accessories by hand** in Blender: knit rib on the beanie, woven straw, real petals on the crown, soft fabric folds on the scarf and bags, shaped frames on the glasses. Keep the ids and the stacking groups. They must fit every hairstyle, old and new, through the existing hat-tuck and band-rest rules. Matte.
5. **Economy**: the new hairstyles are free in the creator, like today's.
   - The hair accessories follow how today's accessories are sold or crafted: a few starters, the rest in the shop at today's accessory prices.
   - Put any new shop rows in a new seed migration (`web/lib/seedMigrations.ts`, `web/scripts/gen-seeds.mjs`) with a timestamp after `20261001041452`, and add it to the SQL smoke list. Never reveal the TC ≈ CAD rate.
6. **Budget**: a full look stays under 4,000 triangles excluding accessories. Each accessory has its own budget; propose it, around 600. One material per piece. `fit_check` passes with 0 fails.

## Pipeline
As in v7 (`art/characters/v7/README.md`):
- Live Blender 5.2 through the `blender` MCP. If Blender is closed, start it with `open -a Blender --args --python <worktree>/art/characters/blender_mcp_autostart.py`. Take a viewport screenshot after each step.
- `.blend` sources and GLB export through `kit.py`, with stable ids. Then `web/scripts/sync-character-assets.mjs`.
- The `/lab/avatar` bench and the creator for engine sheets.

## Milestone 1 (review gate)
Rework three existing styles to the organic look (the bob, the long curtain and the short spiky). Add:
- two new types: the afro and box braids;
- three hair accessories on several styles: a claw clip, a bow and a scrunchie;
- two remodeled accessories: the beanie and the backpack.

Deliver before/after sheets at creator distance and game distance. David approves before the rest is built.

## Evidence
WebP sheets in `specs/evidence/avatar-v8/`:
- before and after;
- the library (bangs and backs);
- new types front, 3/4 and back;
- hair accessories across styles;
- the remodeled accessories on short, long and curly hair;
- the game camera.

## Milestone 1 status (build agent, 2026-10-01)
**Hair: on hold.** David on the first organic pass: "looks so poorly generated and does not have the hairstyle feel". The rework waits for his game references.
- Committed as WIP, not polished:
  - bob, long and short reworked (rounded clumps, soft mass normals, baked occlusion, a painted strand texture, `art/characters/v8/`);
  - the afro (`bangs_curls`, `back_afro`) and box braids (`bangs_braids`, `back_box_braids`).
- The ACNH study (`specs/evidence/avatar-v8/acnh-hair-study.md`) sets the direction for the next pass: one smooth mass, only the outline breaks into points, strands and depth painted.

Done, and independent of the hair look:
- **Anchors.** Every bangs and back piece declares named anchors (`art/characters/v8/anchors.py`, measured on the built piece). The catalogue holds them as `[p, q, r, h]` in glTF space.
- **Hair accessory group.** `look.ts`, `rig.ts` and `Character.tsx` handle it; the server save path goes through `parseLook`. The claw clip, bow and scrunchie (`accessories/hair_acc.py`) sit on the worn style's anchors.
  - The hide rule: no matching anchor, or a hat or a hood is worn.
- **Remodels.** The beanie and the backpack are remodeled by hand (`accessories/acc_v8.py`). Every hat's hair tuck now uses the rounded locks.
- **Checks.** `fit_check` passes with 0 fails, including a new seating check for hair accessories on every style. Numbers are in `specs/evidence/avatar-v8/fit-v8.txt`.

**Not sold yet.** Hair accessories are kept out of the shop seed until deliverable 5. No migration was written.

Sheets are in `specs/evidence/avatar-v8/`:
- Open first: `06-closeups`, `01-before-after-creator`, `04-hair-accessories`, `05-remodeled`.
- Then: `02-before-after-game`, `03-new-types`, `acnh-hair-study`.

Questions are in `specs/avatar-v8-questions.md`. The review files are `art/characters/v8/accessories_v8.blend` and `art/characters/v7/hair_{bangs,backs}.blend` (the WIP curves).
