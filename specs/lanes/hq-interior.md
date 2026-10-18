# Lane: HQ interior

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/hq-interior`
- **Branch:** `game/hq-interior`

## Status (2026-10-18)

- **Head:** `f338d64a [wip]`, on top of `79d02ab0`.
  - The WIP is the previous agent's start on phase 2:
    - deleting the greybox components (`HqGreybox.tsx`, `HqLayoutInterior.tsx`);
    - edits to `hqLayout.ts` and its test;
    - a new `web/scripts/hq-layout-json.mjs`.
  - It was about to write the room's model build (`build_hq.py`) from the layout JSON, following the shop's build. Review it, then finish or revert.
- **Phase 1 is done and David picked a layout.** Commit `015308ee` built two walkable greybox layouts, 20 x 16 over two storeys:
  - `web/lib/game/hqLayout.ts`, with 16 tests in `hqLayout.test.ts`;
  - in development at `/lab/island?hq=inside&hqLayout=a`;
  - the sheet: `specs/evidence/hq-interior/phase1/hq-layout-options.webp`.
- **Phase 2 has the go.**

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

1. Make layout A the real HQ interior. Remove option B, or keep it behind the lab flag only if that costs nothing.
   - Every HQ station and E prompt must keep working (`specs/hq-onboarding.md`); the onboarding script follows stations, not positions.
   - Wren stands at her new post.
2. Build the room after the references, the way the shop's was built (`specs/interiors/shop.md`):
   - a layout JSON, then a Blender build script under the Blender lock, then GLBs;
   - material classes from `lib/game/modelMaterials.ts`;
   - textures only where they show.
3. Lighting that follows the time of day:
   - windows for daylight;
   - lamps, under-shelf strips, the aquarium's base strip and the track spots always on;
   - fake the lamp pools with emissive and baked light, and keep real lights few.
4. The aquarium:
   - colour from `2026-10-18-ref-aquarium-colour.png` (cyan-blue water, schools of silver fish, coral low down);
   - size from `2026-10-18-ref-aquarium-wall-size.png` (reef rock, a few orange fish, a warm base strip);
   - instanced, cheaply animated fish, and caustics from the tank's own shader;
   - a blue glow on the lounge in front of it.
5. New stations:
   - the coffee bar;
   - the aquarium, with a short look line;
   - the admin doors: "Admins only. It's locked."
   Any new lines are drafts for David.
6. Perf:
   - an `hq` scene in `specs/perf/perf-bench.mjs`;
   - exceptions in `web/lib/game/perf/budget.ts`, like the shop's, if they're needed;
   - one `perf:check` at the end.
7. A review sheet in `specs/evidence/hq-interior/phase2/`:
   - the phase 1 views, furnished;
   - day and night;
   - the aquarium close up;
   - the upper lounge, the work floor, and a top-down of each floor.
8. Run the full vitest, update this file, commit, and report the head and sheet path to the coordinator.

## Tools and gotchas

- **The shop is the template.** Its layout JSON script is `web/scripts/shop-layout-json.mjs`. Its build, shots and sheet are under `art/` and `specs/evidence/shop-interior/phase2/` (`shots.mjs`, `sheet.py`). Its bench scene is `shop` in `specs/perf/perf-bench.mjs`, and its budget exceptions are in `budget.ts`.
- **The current HQ** was measured at 16 x 12, door front centre. Its stations: front desk with Wren, notice board, trophy case, bookshelf, clock, Founder's desk, workbench, exit.
- **Under the mezzanine,** the upper floor is cut away while you're beneath it, so you can see your own floor.
- **The merch catalogue rows aren't this lane's.**
