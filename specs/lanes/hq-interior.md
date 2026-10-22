# Lane: HQ interior

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/hq-interior`
- **Branch:** `game/hq-interior`

## Status (2026-10-22, phase 4)

- **Head:** the `[build]` commit that adds this file's update, on top of the merge of main at `3e6ced4b` (the flat UI
  restyle) and the phase 4 build `1fc340ac`. Not merged to main.
- **Phase 4 is built and its sheet is with David:** `specs/evidence/hq-interior/phase4/hq-phase4-sheet.webp`. The spec
  is `specs/interiors/hq.md`, "Phase 4". Feature freeze is Oct 24 (launch Oct 31).
- **What's done (David's phase 3 notes, all of them):**
  - 24 x 18 (`lib/game/hqLayout.ts`), its tests (29: the lounge, the study, the windows, the one admin door).
  - The hall's lounge: a U sectional, five beanbags, a 10.4 x 6.2 rug. The study on the left arm: a 6 m table, six
    monitors and chairs, shelves, a whiteboard. Reading nooks on both arms. A window nook downstairs.
  - Big modern windows (thin black frames, upright mullions only, no curtains); the front door split down the middle.
  - One admin door, under the stair's high end, on the ground floor (station `admin`, level 0). The upstairs doors and
    the station `admin-2` are gone.
  - 30 lamps, sconces, cove strips; softer pools cut to the room, wall washes (`lib/game/hqLight.ts`, `poolQuad`); six
    real lights; a warmer night fill. A test checks no wall-side spot is over 3.6 from a light.
  - Materials: `P_Leather` and `P_Velvet` presets (`modelMaterials.ts`), velvet sheen and marble clear coat in the GLB,
    normal maps on the floor, walnut, plaster and rugs, clear glass, chrome kept metal, the room's reflections with
    glows (`envLight.ts` `glows`, `HqRoom.tsx` `HQ_ENV`).
  - Fixed the pale arms' floors (the floor quad sank under the slab's top when the curved world bent it).
  - Gates on the merged head: tsc clean; full vitest 3401 passed (356 files); eslint clean on the changed files.
  - Perf (`phase4/perf-check.txt`, passed): high 2.10 ms, 125 draws, 97k triangles; lite 1.70 ms, 76 draws, 90k.
  - Walk-through: all 10 stations and the workbench answer; Wren at her post.
- **Approved:** layout B and the taller storeys (David, 2026-10-19). Phase 4 awaits David.

## David's decisions (newest first)

- 2026-10-22, on the phase 3 review: REDO. Verbatim:
  - "looks good for a v1, but make the textures of things more accurate like how they interact with the light. I also think the building can be built a little bigger for more space, make it more loungy, like utilize the first floor space infront of the fishtank to use for lounging, big cozy sofa and bean bag with bigger rug, second floor can utilize space better by adding like study fixtures on the left side, I want big clear windows like in modern appartments and not the curtain with the + kinda window, and add like long table with monitor and chairs and stuff, add more plants, and improve quality of these models"
  - "more lightings, lightsings should fade a little lighter and more light fixures so no dark corners at night"
  - "why is there 2 admin doors, make it 1, and place it like under the stairs"
- 2026-10-19, on the phase 2 review: "i said to do plan b, also make roofs taller for both floors".
  - Layout B, the gallery. Option A's code is gone (not kept behind the lab flag: keeping it wasn't free). It's in git
    history at `831f3036`.
  - Taller storeys: 4.6 each (the brief said about 4.4 to 4.8, our call by eye), the aquarium the full height.
  - Don't change HQ's exterior: buildings get remodelled later.
- 2026-10-18:
  - **Layout:** Option A, the back mezzanine (superseded on 2026-10-19).
  - **Exterior:** "gonna remodel the buildings maybe later". Leave the HQ building's exterior exactly as it is.
- 2026-10-18, the design. All of it is in `specs/interiors/hq.md`, ledger row 316, with the references in `references/interiors/hq/`.
  - **The feel:** expensive. Walnut, concrete, leather and velvet, plants, deep carpets.
  - **The lighting:** from lamps, strips and track spots, not ceiling panels, and it follows the time of day.
  - **The aquarium:** two storeys tall.
  - **Ground floor, work:** the existing stations; the co-working desks; the green marble coffee bar; the library wall;
    a small lounge by the aquarium.
  - **Upstairs, lounge:** a big carpet, beanbags, the arc lamp; the walnut oval ceiling over this lounge only; yearly
    banners, blank until David sends designs; two admin-only doors, locked.

## Next

1. Wait for David's notes on the phase 4 sheet, relayed by the coordinator. Apply them, reshoot the touched views
   (`phase4/shots.mjs <out> day,night <ids>`), rebuild the sheet (`phase4/sheet.py`).
2. Rough edges for David to rule on before they're touched:
   - the blank banners still read as white blocks from eye level;
   - velvet's sheen is subtle at the walking camera's distance;
   - the monitors' screens glow a plain pale blue;
   - other players upstairs draw at the ground floor's height (the network sends no height; the shop has the same).
3. When David sends them: the yearly banner designs (cloth on `P_Cloth` in `upper.glb`, parts 1 and 2; a design needs
   its own material or atlas), and the plaque text (`FOUNDER_PLAQUE` in `lib/game/arrival/hq/lines.ts`).
4. The station lines (`HQ_LINES`) are drafts until David OKs them.

## Tools and gotchas

- **The shop is the template.** Its build, shots and sheet are under `art/` and `specs/evidence/shop-interior/phase2/`.
- **Building the room:** regenerate the JSON first after any layout change (`cd web && node scripts/hq-layout-json.mjs`;
  a test fails if it's stale), then `/Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_hq.py`
  under the Blender lock (it prints triangles per part). Check the GLBs' budget numbers with `glbStats`
  (`lib/game/perf/glbStats.ts`) before editing `budget.ts`.
- **Pieces on a side or the front wall** are built facing −z about their first block and turned (`Local`, `turned` in
  `build_hq.py`); give the fixture a `facing` in the layout.
- **Shots:** `cd web && PORT=3189 node ../specs/evidence/hq-interior/phase4/shots.mjs <out> day,night [ids|prompts]`
  against `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3189` (browser lock). Then
  `python3 specs/evidence/hq-interior/phase4/sheet.py <out> specs/evidence/hq-interior/phase4/hq-phase4-sheet.webp`.
  A whole day or night pass is about 2 minutes for 11 shots: split the list in two calls.
  - Eye-level views set `window.__hqShowUpper` (every part drawn) and park the player out of the picture; the ground
    plan sets `__hqHideUpper`. Each shot walks back to the hall's hub (0, −3) and out along its own route.
  - `prompts` walks to every station along the taped paths and logs each E prompt; never press Escape there (it opens
    the pause menu over the next shot).
- **Floors bend:** the curved world moves a model's vertices only, so a big quad folds along its diagonal. Floors are
  in 2 m cells (`floor_quad`) and the upper slab's top sits 5 cm under the planks; keep anything lying on a floor
  either in cells or well clear of what's under it.
- **Glass and sheen come from the GLB:** `dress()` in `build_hq.py` sets the normal maps, the clear coat, the sheen and
  the glass's alpha; the exporter writes glTF extensions and three makes those materials MeshPhysicalMaterial.
- **Chrome stays metal only while it's darkish:** the look's metal class turns light paint dielectric (luma over about
  0.55 linear). `CHROME` is `#a3a8ae` for that.
- **Rebuilding while the browser lock is held at high swap:** stop the dev server and release the browser lock first;
  the build, then queue and retake it.
- **The tank:** the room's back wall is open behind it on purpose. A plaster face 2 cm behind the water won the depth
  test from the walking camera's distance and hid the water.
- **The ceiling** (`ceiling.glb`: the ceiling, the oval ceiling, the tracks up there and the whole front wall with the
  art) shows only to a camera inside the room (`insideRoom` in `HqRoom.tsx`).
- **Custom shaders bend:** the curved world lives in three's shared `project_vertex`; the tank and pool ShaderMaterials
  include it, or they'd slide off the room.
- **High swap:** stop the dev server and release the browser lock before taking the Blender lock when swap is over 9 GB.
- **Lock helper:** `LANE=game/hq-interior /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh <heavy|blender|devserver> <cmd>`.
  Take the browser lock by hand: join the queue, wait until you're first and it's free, mkdir it, write the owner.
- **perf:check:** commit first (the measure build refuses dirty gated files). `sh specs/perf/measure-build.sh` under the
  heavy lock as its own call; then, holding the browser lock, `SKIP_BUILD=1 SCENES=hq LOCK_OWNER=game/hq-interior npm
  run perf:check` (its own lock call doesn't honour the queue, so take the lock first). It deletes `web/.next` itself.
  The measure build keeps the dev hooks, so `shots.mjs` also runs against its `next start`.
