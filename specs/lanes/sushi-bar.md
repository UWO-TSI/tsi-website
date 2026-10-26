# Lane: sushi-bar (the sushi bar, remodelled in the style of Bancho Sushi)

Worktree `.claude/worktrees/sushi-bar`, branch `game/sushi-bar`. Agent type `uwotsi-lane`, cut from `game/terrain-v3` at c13ea8e7 (terrain R2c, with every new-world asset so far).

**Read first:**
- `specs/lanes/terrain-v3.md`, "2026-10-26: R2c review": David's notes verbatim and the reading. This lane does the items it names for you.
- `specs/lanes/wharf-art.md` and `specs/lanes/village-art.md`: how the last art lanes built, registered and previewed their assets. Follow the same pattern: the builders in `art/`, `propkit.py`, `paintkit.py`, `SCENERY_URLS`, `NEW_LAMPS`, `PROP_FOOTPRINT`/`PROP_TOP`, the budget rows.
- The references in `specs/references/terrain/` (`plan-2026-10-23/`, `r2-2026-10-26/`).

**Art direction:** David's words are "treat each asset properly" and "visually stunning". Use our style: cartoony, smooth, subtle painted textures, low detail where it doesn't show, performance first (few materials, instanced repeats). Organic shapes, never plain spheres or boxes. Search `web/public/assets/` first. David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. The default village is the launch fallback and stays unchanged: new files and names only, or replace files only the new world uses.

**Per asset:**
- a builder in `art/`;
- the GLB in `web/public/assets/game/`;
- a preview in `specs/evidence/sushi-bar/`;
- registered, with footprints where solid;
- the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with:
- the commit;
- each asset's name, triangles and size;
- the preview path;
- placement notes for terrain-v3.

Then go straight on. At the end, update Status here, send the full list, and stop. Questions go in `specs/launch/terrain-v3-questions.md` under your lane, one line each with your default.

## Status

Not started.

## Next

**References:** `specs/references/terrain/sushi-bar-2026-10-26/` (README with David's words, `bar-day.jpg`, `bar-evening.jpg`) and the earlier `plan-2026-10-23/wharf-sharkbar.jpg`. David's words: "a long horizontal bar ... really big open bar where you can sit down and it changes camera anger to more first person, it has festive lighting inside, it back of the bar is open window to see beatiful view in the back, 1-2 sushi npc making sushi ... re modeled in blender properly and it needs to looks visually stunning", and "good decore, speaker with music, lights and fishtank".

1. **The model** (replace `sushi-bar`, only the new world uses it):
   - a long, open bar on the beach by the wharf, in the wharf's wood and rope;
   - a long counter with stools along it;
   - sake bottles along the top beam;
   - speakers at the corners;
   - a wide open window behind the bar framing the sea;
   - round paper lanterns and string lights, red drapes, a big fan;
   - a neon sign (no real brand names; your own wording or a symbol);
   - a fish tank;
   - a menu board.

   Visually stunning, but within budget. Report its footprint and front early (one message), so terrain-v3 can make room on the beach.
2. **Its lights:** the lanterns and neon glow at night (`NEW_LAMPS` or emissive, cheaply), so it reads festive.
3. **Sitting:** the stools are seats. Reuse the café's seating (`components/game/study/StudySeats.tsx`, `interiorShared.tsx`). When a player sits, the camera moves to a lower, closer, almost first-person view across the counter toward the window. Reuse any seat-camera code first.
4. **Chefs:** one or two sushi chef NPCs behind the counter, working (an idle or prep loop). Use the existing NPC or resident system (`components/game/NPC.tsx`) and existing outfits; no real names.
5. **Music:** soft music from the speakers when you're near or seated (`web/public/assets/audio/music/`, the game's existing audio code), respecting the game's sound settings.
6. **Placement:** terrain-v3 places the model. You may set it on the beach yourself in `generate.ts` only if terrain-v3 has said it's done; otherwise give the position you want.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `sushi-bar=game/sushi-bar /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock. Other lanes are running (terrain-v3, perf-newworld and two more art lanes), so expect waits.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** other lanes append to the same tables. Add your entries in one block with a comment line naming your lane.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
