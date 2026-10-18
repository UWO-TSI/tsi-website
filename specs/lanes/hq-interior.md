# Lane: HQ interior

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/hq-interior`
- **Branch:** `game/hq-interior`

## Status (2026-10-18)

- **Phase 2 in progress** on `game/hq-interior` (main merged at `39c70fd2`). The previous agent's `[wip]` (`f338d64a`) was reviewed and kept: option A only, the greybox removed.
- **Built so far** (uncommitted parts are listed in Next):
  - Layout A is the real member HQ: `components/game/hq/HqInterior.tsx` (lights, stations by floor, Wren, trophy case, workbench, clock) and `HqRoom.tsx` (the models, the cut-away, the ceiling for eye-level cameras only).
  - The models: `art/interiors/build_hq.py` reads `art/interiors/hq_layout.json` (from `web/scripts/hq-layout-json.mjs`; a test keeps it current) and writes `web/public/assets/game/interiors/hq/{ground,upper,ceiling,tank}.glb`. Triangles: ground 23.4k, upper 15.0k, ceiling 4.6k (hidden from the walking camera), tank 9.2k.
  - The aquarium: `components/game/hq/Aquarium.tsx` (water, surface, reef and fish shaders; one instanced draw for 64 fish, `lib/game/hqAquarium.ts` + test).
  - Faked lamp light: `lib/game/hqLight.ts` (+ test) and `components/game/hq/LampPools.tsx`.
  - Wren: `KEEPER_POSTS.memberHq` (lib/game/keepers.ts) from `HQ_WREN`. The applicant island keeps `hq`.
  - New stations: coffee, aquarium, admin (two doors), lines in `HQ_LINES` (drafts). The library replaces the bookshelf ("Browse the library").
  - The old member clubhouse (`Clubhouse` in DefaultIslandWorld, `FounderDesk.tsx`, `constrainWorkshop`) is gone; `HQInterior.tsx` stays for the applicant island and /lab/interior.
  - Perf bench: an `hq` scene in `specs/perf/perf-bench.mjs`.
  - Evidence script: `specs/evidence/hq-interior/phase2/shots.mjs`.

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

1. Night shots and the look pass: check the lamps carry the room at night; tune the four point lights and the pool gains in `HqInterior.tsx` / `hqLight.ts`.
2. The full shot set (`shots.mjs` day and night, plus the prompt pass), then the sheet (`sheet.py`) in `specs/evidence/hq-interior/phase2/`.
3. Budget exceptions in `web/lib/game/perf/budget.ts` for `game/interiors/hq/ground.glb` and `upper.glb` (over the 12k interior line, like the shop's), then the full vitest and tsc under the heavy lock.
4. One `perf:check` with `SCENES=hq` (commit first: the measure build refuses dirty gated files).
5. Update `specs/interiors/hq.md` (phase 2), this file, commit, report to the coordinator.

## Tools and gotchas

- **The shop is the template.** Its layout JSON script is `web/scripts/shop-layout-json.mjs`. Its build, shots and sheet are under `art/` and `specs/evidence/shop-interior/phase2/` (`shots.mjs`, `sheet.py`). Its bench scene is `shop` in `specs/perf/perf-bench.mjs`, and its budget exceptions are in `budget.ts`.
- **The current HQ** was measured at 16 x 12, door front centre. Its stations: front desk with Wren, notice board, trophy case, bookshelf, clock, Founder's desk, workbench, exit.
- **Under the mezzanine,** the upper floor is cut away while you're beneath it, so you can see your own floor.
- **The merch catalogue rows aren't this lane's.**
- **Building the room:** `/Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_hq.py` under the Blender lock (it prints triangles per part). Regenerate the JSON first after any layout change: `cd web && node scripts/hq-layout-json.mjs`.
- **Shots:** `cd web && PORT=3189 node ../specs/evidence/hq-interior/phase2/shots.mjs <out> day,night [ids]` against `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3189` (browser lock).
- **The ceiling** (`ceiling.glb`: the hall's ceiling, the oval ceiling, the tracks and the whole front wall) shows only to a camera under 6.75: `scene.onBeforeRender` decides per rendering camera, so the evidence's eye-level views see a closed room and the walking camera looks in from above.
- **Custom shaders bend:** the curved world lives in three's shared `project_vertex`; the tank and pool ShaderMaterials include it, or they'd slide off the room.
- **High swap** (over 9 GB most of the time): stop the dev server and release the browser lock before taking the Blender lock.

