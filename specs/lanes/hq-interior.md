# Lane: HQ interior

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/hq-interior`
- **Branch:** `game/hq-interior`

## Status (2026-10-18, end of day)

- **Head:** the `[build]` commit that adds this file's end-of-day update, on top of `aee89e25`. Main merged at `39c70fd2`. The previous agent's `[wip]` (`f338d64a`) was reviewed and kept (option A only, the greybox gone).
- **Phase 2 is built and its sheet is ready for David:** `specs/evidence/hq-interior/phase2/hq-phase2-sheet.webp`. Not yet reviewed by David. The spec is `specs/interiors/hq.md`, "Phase 2".
- **What's done:**
  - Layout A is the member HQ: `components/game/hq/HqInterior.tsx` (lights, stations by floor, Wren, trophy case, workbench, clock) and `HqRoom.tsx` (the models, the cut-away, the ceiling for eye-level cameras only, the day-following reflections).
  - Models: `art/interiors/build_hq.py` → `web/public/assets/game/interiors/hq/{ground,upper,ceiling,tank}.glb`. Triangles: ground 23.4k, upper 15.0k, ceiling 4.6k, tank 9.2k. Budget exceptions for ground and upper in `budget.ts`.
  - The aquarium: `components/game/hq/Aquarium.tsx` (water, surface, reef and fish shaders; 64 fish in one instanced draw; `lib/game/hqAquarium.ts` and its test).
  - Faked lamp light: `lib/game/hqLight.ts` (and its test) and `components/game/hq/LampPools.tsx`.
  - Wren: `KEEPER_POSTS.memberHq` (lib/game/keepers.ts) from `HQ_WREN`. The applicant island keeps `hq`.
  - Stations: every old one kept. New: coffee, aquarium, admin (two doors). Their lines are `HQ_LINES` (drafts). The library replaces the bookshelf ("Browse the library").
  - Prompt pass, every station on its own floor: `prompts.json` from `shots.mjs`; all eleven answer.
  - The old member clubhouse is removed: `Clubhouse` in DefaultIslandWorld, `FounderDesk.tsx` and `constrainWorkshop`. `HQInterior.tsx` stays for the applicant island and /lab/interior.
  - Perf: the `hq` bench scene. perf:check passed:
    - high: 2.70 ms, 104 draws, 77k triangles;
    - lite: 1.80 ms, 62 draws, 70k triangles;
    - in `specs/evidence/hq-interior/phase2/perf-check.txt`.
  - Gates: tsc clean, vitest 3316 passed (349 files), eslint clean on the changed files.
- **Approved:** layout A (phase 1). Phase 2 awaits David.

## David's decisions (newest first)

- 2026-10-18:
  - **Layout:** Option A, the back mezzanine.
  - **Exterior:** "gonna remodel the buildings maybe later". Leave the HQ building's exterior exactly as it is.
- 2026-10-18, the design. All of it is in `specs/interiors/hq.md`, ledger row 316, with the references in `references/interiors/hq/`.
  - **The feel:** expensive. Walnut, concrete, leather and velvet, plants, deep carpets.
  - **The lighting:** from lamps, strips and track spots, not ceiling panels, and it follows the time of day.
  - **The aquarium:** two storeys tall.
  - **Ground floor, work:**
    - the existing stations;
    - the co-working desks;
    - the green marble coffee bar;
    - the library wall;
    - a small lounge by the aquarium.
  - **Upstairs, lounge:**
    - a big carpet, beanbags, the arc lamp;
    - the walnut oval ceiling over this lounge only;
    - yearly banners on the rail, blank until David sends designs;
    - two admin-only doors, locked.

## Next

1. Wait for David's notes on the phase 2 sheet, relayed by the coordinator. Apply them, reshoot the touched views, and rebuild the sheet.
2. Known rough edges, for David to rule on before they're touched:
   - the reef's sea fans read as big flat ovals;
   - the sand is pale;
   - the walnut grain is a little wavy on the big panels;
   - other players upstairs draw at the ground floor's height (the network sends no height; the shop has the same).
3. When David sends them:
   - the yearly banner designs: the banners are cloth on `P_Cloth` in `upper.glb`; a design needs its own material or atlas;
   - the plaque text: `FOUNDER_PLAQUE` in `lib/game/arrival/hq/lines.ts`.
4. The station lines (`HQ_LINES`) are drafts until David OKs them.

## Tools and gotchas

- **The shop is the template.** Its layout JSON script is `web/scripts/shop-layout-json.mjs`. Its build, shots and sheet are under `art/` and `specs/evidence/shop-interior/phase2/` (`shots.mjs`, `sheet.py`). Its bench scene is `shop` in `specs/perf/perf-bench.mjs`, and its budget exceptions are in `budget.ts`.
- **The old HQ** (gone from the member game) was 16 x 12. Its stations all live on in the new room: front desk with Wren, notice board, trophy case, bookshelf (now the library), clock, Founder's desk, workbench, exit.
- **Under the mezzanine,** the upper floor is cut away while you're beneath it, so you can see your own floor.
- **The merch catalogue rows aren't this lane's.**
- **Building the room:** `/Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_hq.py` under the Blender lock (it prints triangles per part). Regenerate the JSON first after any layout change: `cd web && node scripts/hq-layout-json.mjs`.
- **Shots:** `cd web && PORT=3189 node ../specs/evidence/hq-interior/phase2/shots.mjs <out> day,night [ids]` against `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3189` (browser lock).
- **The ceiling** (`ceiling.glb`: the hall's ceiling, the oval ceiling, the tracks and the whole front wall) shows only to a camera under 6.75: `scene.onBeforeRender` decides per rendering camera, so the evidence's eye-level views see a closed room and the walking camera looks in from above.
- **Custom shaders bend:** the curved world lives in three's shared `project_vertex`; the tank and pool ShaderMaterials include it, or they'd slide off the room.
- **High swap** (over 9 GB most of the time): stop the dev server and release the browser lock before taking the Blender lock.
- **Lock helper:** `withlock-hq.sh <heavy|blender|devserver> <cmd>` in the session scratchpad is `withlock.sh` with the owner `game/hq-interior`. It waits for the others under high swap. Take the browser lock by hand: join the queue, mkdir the lock, write the owner.
- **perf:check:** commit first (the measure build refuses dirty gated files). Then run `sh specs/perf/measure-build.sh` under the heavy lock as its own call, then `SKIP_BUILD=1 SCENES=hq LOCK_OWNER=game/hq-interior npm run perf:check` as another. Keep each under 10 minutes. It deletes `web/.next` itself.
- **Prompt pass:** `shots.mjs <out> day prompts` walks to each station along the taped paths (straight lines snag on the sofa and the co-working desk) and writes `prompts.json`.
- **Evidence views under the mezzanine** stand the player in the hall, so the upper floor isn't cut away in the eye-level shots.

