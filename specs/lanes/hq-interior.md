# Lane: HQ interior

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/hq-interior`
- **Branch:** `game/hq-interior`

## Status (2026-10-22)

- **Head:** the `[build]` commit that adds this file's update, on top of `2aca913c` (the phase 3 build). Main merged at
  `f66bafe6`. Not merged to main.
- **Phase 3 is built and its sheet is ready for David:** `specs/evidence/hq-interior/phase3/hq-phase3-sheet.webp`. The
  spec is `specs/interiors/hq.md`, "Phase 3". Feature freeze is Oct 24 (launch Oct 31): it merges only if David
  approves it by then, otherwise after launch.
- **What's done:**
  - Layout B, the gallery, is the member HQ, with storeys of 4.6 (the ceiling at 9.2): `lib/game/hqLayout.ts` (one
    layout, `HQ`, id "b"), its test (21 tests).
  - The upper floor is three parts (bridge, left arm, right arm). The walker cuts a part away while you're under it or
    it stands between the walking camera and you (`partBoxes`, `hidesYou`, `HQ_CAMERA` mirrors
    `interiorShared.tsx`'s 8.4 up and 7.2 back).
  - Models rebuilt: ground 27.9k, upper 17.5k (3 parts, 28 primitives), ceiling 8.1k, tank 10.5k triangles. Budget
    exceptions updated in `budget.ts`.
  - Aquarium on the back wall, the full height: fish along x (`hqAquarium.ts`), shaders turned (`Aquarium.tsx`), unlit
    glass. Lamp pools on the side and front walls, upstairs per part (`hqLight.ts`).
  - Ceiling rule: `ceiling.glb` shows only to a camera inside the room (`HqRoom.tsx`).
  - Stations walk-through (rerun 2026-10-22): all 11 stations and the workbench answer on their floor; Wren at her post.
  - Gates: tsc clean; full vitest 3358 passed (350 files); eslint clean on the changed files.
  - Perf (`specs/evidence/hq-interior/phase3/perf-check.txt`, passed): high 2.90 ms, 111 draws, 79k triangles; lite
    1.90 ms, 69 draws, 72k triangles.
- **Approved:** layout B and the taller storeys (David, 2026-10-19). The phase 3 sheet awaits David.

## David's decisions (newest first)

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

1. Wait for David's notes on the phase 3 sheet, relayed by the coordinator. Apply them, reshoot the touched views
   (`phase3/shots.mjs <out> day,night <ids>`), rebuild the sheet.
2. Known rough edges, for David to rule on before they're touched:
   - from the bridge at eye level the blank banners read as white blocks behind the arms' rails;
   - sunlight through the upstairs windows lands as flat pale patches on the arms' floors;
   - the reef's sea fans and the pale sand (from phase 2);
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
- **Shots:** `cd web && PORT=3189 node ../specs/evidence/hq-interior/phase3/shots.mjs <out> day,night [ids|prompts]`
  against `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3189` (browser lock). Then
  `python3 specs/evidence/hq-interior/phase3/sheet.py <out> specs/evidence/hq-interior/phase3/hq-phase3-sheet.webp`.
  - Eye-level views set `window.__hqShowUpper` (every part drawn) and park the player out of the picture; the ground
    plan sets `__hqHideUpper`. Each shot walks back to the hall's hub (0, −3) and out along its own route.
  - `prompts` walks to every station along the taped paths and logs each E prompt; never press Escape there (it opens
    the pause menu over the next shot).
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
