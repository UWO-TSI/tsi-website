# Lane: polish (round 2 done: lighthouse lantern glow, interact ring)

Worktree `.claude/worktrees/polish`, branch `game/polish` (round 1 plus origin/main 3f9f2b4d merged in). Agent type `uwotsi-lane`. Dev port 3332.

## Status (round 2, 2026-11-01)

Built on `game/polish`, ready for David's review. Head: see the last `[build] polish lane file` commit. Gates: full vitest 3733 passed (398 files) after item 0; on the final head 3732 passed and 1 timed out (shoreField "crosses 0 on the drawn coast", 5 s timeout at load 8; untouched by this lane), which passes alone (2/2); tsc clean; eslint clean on changed files; perf:check (SCENES=v2, once) failed on frame time on a loaded machine (1-minute load 5.3 to 5.7, other lanes benching and building): v2 high 6.5 ms (baseline 4.8, +35%), lite 4.0 ms (2.9, +38%); draws 367 (359, +2.2%) and 291 (289, +0.7%), triangles +1.5% and +2.2%, all within tolerance. The bench holds no lantern and has no E target, so neither effect draws there (the ring and glow are `visible = false` until a target; the lantern mounts only with rod-4 in hand); the small draw and triangle drift is against a 10-14 baseline. When shown, each costs two transparent draws (the ring: ring + glow; per lantern holder: halo + pool) and no shader compile into lit materials. The coordinator should rerun it on a quiet machine.

- **0. Round 1's two failures fixed** (5b58b09a, sent to the coordinator): rod-4 is 5 materials and one held mesh. In `build_tools.py` the lamp rod's line uses the Blank material (near the same cream) and the glass (`rod-4_Lamp`, now #FFB548) is plain, not emissive: `heldMesh.ts` keeps any emissive part as its own mesh, so a glowing glass can't merge. The glow now comes from item 1. Icon re-rendered (`rod_lighthouse.webp`).
- **1. The Lighthouse rod is a lantern** (`components/game/character/LanternGlow.tsx`, mounted by `HeldItem` in Character.tsx for `LANTERN_URL`, so yours and other players'): one additive sprite at the glass (a bright core in a wide warm halo, slid 0.5 toward the camera along the view ray so it washes over the holder) and one warm pool disc on the ground under the lamp (hidden mid-jump). Two draws per holder, no real light, no shader added to lit materials. Strength follows `nightLit()` (`lib/game/glow.ts`, written by DefaultIslandWorld from `windowLit(light)`): faint by day, about 2/3 at dusk, full at night; it breathes with the lamps' `breath`.
- **2. Interact ring** (`components/game/InteractRing.tsx`): one shared ring (a soft band on a disc, `--ui-highlight` at 0.35) and one shared glow sprite (`--ui-select`, additive, 0.14), both read from the HUD's cream tokens on `<html>` (the body's clean theme has a black highlight). It follows the `near` loop in `IslandScene`: each branch records its spot (`at`), the `RING` table gives the radius and glow height per `Near`, and it shows only while the E prompt is up (`ring` prop: the prompt's own condition). Doors put it 1.6 past the doorstep toward the building (`doorRings`); a bench rings the whole bench; on the wharf it sits on the deck you stand on. The catch board gets it through `layout.boards`, wherever the fishing lane moves it.
  - Not on residents (talk, Bram, the chef, Rosa): they turn to you and the prompt names them, and a person walks out of a ring. Not on building signs (museum, ruins), the volleyball net (a whole court) or tool targets (water, bugs, dig spots). Interiors (HQ, café, museum stations) don't get it: their `onNear` passes no positions.
- `glowTexture` and `breath` moved from AmbientProps.tsx to `lib/game/glow.ts` (shared by the lamps, the lantern and the ring).
- **Evidence** `specs/evidence/polish/lantern-ring/` (webp): `00-compare-before-after` (left before, right after: sell stand day, bench night, lantern night standing, lantern night walking); `01-icon-before-after`; `ring-<target>-<day|night>-after` for sell, catch, bench, shop, tackle, board (leaderboard), plus `ring-bench-play` (play camera) and `ring-sell-phone`; `lan-day|dusk|night`, `lan-walk-day|dusk|night`, `lan-play-night`, `lan-phone-night`; `*-before` for the four in the compare sheet. Script `shoot.mjs` (headless, `x,z@time@yaw,pitch,zoom@flags`).

## Next

1. The coordinator merges round 1's fix and round 2, then puts the evidence on a review page for David.
2. On notes: the lantern's size, strength and colours are in `LanternGlow.tsx` `glow()` and `STOPS`; the ring's `RING_ALPHA`, `GLOW_ALPHA`, `BAND` in InteractRing.tsx, per-target sizes in `RING` (DefaultIslandWorld.tsx).

## Round 2 (coordinator, 2026-11-01)

Round 1 is approved (every card) but not merged: the full vitest run fails two tests on the new lamp.

**0. First, fix round 1's two failures** and send the coordinator a one-line message (SendMessage to "main") with the commit SHA, then go on to items 1 and 2 while the coordinator merges round 1:
- `lib/game/character/heldMesh.test.ts`: "tools/rod-4.glb is one mesh, the same shape and size": expected 1 mesh, got 2.
- `lib/game/perf/budget.test.ts`: "game/tools/rod-4.glb: primitives 6 over the tool budget's 5" and "materials 6 over the tool budget's 5".
- Fix the model (build_tools.py, through Blender), not the tests or an exception: merge the lamp into the rod's one mesh and fold its parts into the existing materials so it stays within 5, keeping the glass's glow. Read how the held-mesh path treats look classes and emissive parts before choosing. Then the full `npx vitest run`, not just the touched areas.

Then two new items.

**1. The Lighthouse rod is a lantern when held.** David, pol-lighthouse, verbatim: "this rod when held also shines light and gives character glow halo like holding a lantern".
- When a player holds rod-4 (theirs or another player's), the lamp glows brighter and a warm halo surrounds the character, like carrying a lantern. It should read at dusk and night most; by day it can be faint.
- Fake the light: an additive halo sprite or shell, plus a soft warm pool on the ground if it helps. No new real-time three.js light: adding a light recompiles every lit material and costs every frame. If a real light is the only way it reads, show both and say what it costs.
- Shots: day, dusk and night, standing and walking, desktop and phone.

**2. A faint glow and circle on whatever you can interact with.** David, f4-board-world (fishing review), verbatim: "i also want a very faint glow and circle around when close enough to interact with a interactable object like the sell stand".
- When the E prompt is up for an object (the `near` state in `DefaultIslandWorld.tsx`, type `Near`), that object gets a very faint glow and a soft circle on the ground around it. Only the current target, one at a time, so one shared ring and one glow pass, not one per object.
- Objects first: the sell stand, the catch board, the market and shop doors, benches, the mailbox, the volleyball board. Say what you did with NPCs (talk) and why.
- Very faint means very faint: it should confirm "this one", not decorate. Use the kit's tokens for the colour.
- Shots: four or five targets close up and from the play camera, before and after, day and night, plus phone.

The fishing lane is moving the catch board to a new spot in parallel. Register the ring through the shared `near` path so the board gets it wherever it ends up; don't touch `wharf.ts` board placement.

## Round 1 (merged): Part A: the creator's hair change

David, 2026-10-29, creator polish review (https://claude.ai/artifact/KkE3ppKZjP7o2yP6kxg8Rx):
- cp-dissolve: "not hte effect i like, do a more chill subtle hair change thats less glitchy"
- cp-dissolve-2 and cp-top: "not hte effect i like, do a more chill subtle hair change"
- Approved: cp-calm, cp-calm-face, cp-wave.

Today's look: the composite dissolves old to new with clumpy 3 px pixel noise and a foam-cream edge (`COMPOSITE_FRAG`, `uDissolve`). Replace it with something calm and subtle: for example a soft cross-fade, or a gentle fade that follows the wave's crest, with no noise cells and no bright edge. The old you still copies the new you's bones during the sweep, so only the look changes. Same for tops. Before and after strips (hair-a, hair-b, top) with the creator-polish shoot script.

## Round 1 (merged): Part B: rods (round 3 fixes, not the new roster)

David, 2026-10-29, rods round 2 review (https://claude.ai/artifact/2SriizfPH8naxzxb1SdFmn), verbatim:
- r2-bag-rod: "make the line not black and thinner more subtle, the overlay good, maybe make it a slightly different color so its more ob, also the bobber on the rod is too big "
- r2-shop-glass: "move the title and text up a bit and the graph up a bit so theres a bit space between graph and purchase"
- r2-shop-shelf: "outline could be slightly bigger"
- r2-shop-lighthouse: "the model needs a light ontop because its lightouse, "

Build:
1. The bag's rod view: the line lighter (not black), thinner and subtler; the overlay a slightly different colour so it stands out more; the bobber on the rod smaller.
2. The shop's rod card: the title, text and radar up a little, so there's space between the radar and Purchase.
3. The shelf's rarity outline slightly bigger.
4. The Lighthouse rod gets a light on top: a small lamp housing at the tip with a warm emissive glow. Edit the model with a headless Blender script (a script, not hand edits), HD and LP, then run `cd web && node scripts/pack-glbs.mjs`.

Not this lane: the new rod roster (Precision, Training, Riptide, Titanium, Tempest and the re-tiering), the bait and bobber remodels, and auras. They wait for the Meshy key.

## Gates and evidence

tsc, vitest on the touched areas, eslint on changed files, headless before and after shots (desktop and phone where it's UI). Round 2: one perf:check (SCENES=v2) at the end, since the halo and the ring add draws; if the machine is loaded (other lanes running), say so and leave the rerun to the coordinator. Evidence in `specs/evidence/polish/`, then report to the coordinator for a review page.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- Locks: `LANE=game/polish /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Supabase env blanked on your dev server.
- New world only (the village is retired). No fetched art. Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail code (`specs/lane-rules.md`).

## Round 1 status

Both parts built 2026-11-01 on `game/polish` (from f9cebe44), ready for David's review. Gates: tsc clean; vitest on the touched areas (arrival, rods, gui, economy, icons, rarityPalette, gui contrast) 224 tests passed (128 in 18 files, then 96); eslint clean on changed TS files. No perf:check: the lamp adds 204 triangles to rod-4 (361 to 565), not noticeable.

- **Part A, the creator's hair change:** `COMPOSITE_FRAG` (ReflectionScene.tsx) now cross-fades the old you into the new one (`mix` by `uDissolve`, which keeps its smoothstep over the crest's crossing, `ride` to `done`). The noise cells, the hash/noise functions and the foam-cream edge are deleted. Bone copying during the sweep is unchanged, so only the look fades. Tops go through the same path.
- **Part B, rods:**
  1. Bag rod view (`RodGear.tsx`): the line light grey (0xb4bcc4, was 0x3a3a3a) and thinner (radius 0.0035, was 0.006); the bobber 0.13 (was 0.2), the bait 0.1 (was 0.12) so it doesn't outsize the bobber.
  2. The build overlay on the radar is its own colour, new token `--ui-chart-gain` (teal, in all three themes); `HexRadar` sets `data-built` when there's a base, and the "+20" gains use it too. The rod alone stays faint dashed blue.
  3. Shop card: `.info > .radar:has(+ .pay) { margin-bottom: 30px }`; the column is centred, so the title, text and radar rise about 15 px and the price drops 15 px.
  4. Rarity outline 1.5 px to 2.5 px (cards and the detail stage; the divine holo edge 2 to 2.5 px).
  5. Lighthouse rod lamp: `art/props-enemies/build_tools.py` (ROD[4] `lamp`) adds a red gallery, an amber emissive glass (`rod-4_Lamp`, emission strength 2, exported as KHR_materials_emissive_strength), a red roof and a gold finial at the tip. Only `rod-4.glb` changed on the rebuild. Its icon re-rendered (`render-icons.mjs rod_lighthouse`).
     - There is one rod file (no HD/LP split exists for tools), used by the shop stage and the hand, so the edit covers both.
     - `pack-glbs.mjs` (no args) doesn't list the tools, and the other rods are unpacked too, so rod-4 stays unpacked like its siblings.
- **Evidence** `specs/evidence/polish/hair-rods/` (before on top or left, after below or right): 01-03 hair-a, hair-b, top strips (back of the head, every third frame, about 0.27 s apart); 04 bag rod; 05 tip close-up; 06 bag strip as bait goes on; 07 shop glass; 08 shelf; 09 shop lighthouse, 09b lamp close-up (stage, stage, icon); 10-11 phone. Shot script `hair-rods/rod-shots.mjs` (rod-gear r2's with an out dir argument).

## Round 1 code pointers

1. The coordinator puts the evidence on a review page for David.
2. On notes: the fade is `COMPOSITE_FRAG`'s one `mix` line and its timing `smooth(beats.ride, beats.done, ...)`; line colour/size, `SIZE` in RodGear.tsx; `--ui-chart-gain` in styles/themes; the gap `margin-bottom: 30px`; the outline `2.5px` in flat.module.css; the lamp's colour, size `k` and strength in build_tools.py (then rerun Blender, then `render-icons.mjs rod_lighthouse`).

## Tools and gotchas

- In the shop's white studio stage the lamp's glass reads soft peach (the studio lights wash the amber); the icon shows it amber. It will glow more in the world at dusk.
- `specs/evidence/polish/` also holds an older lane's files (polish-ownership); this lane's are under `hair-rods/`.
- Shots: hold `withlock.sh devserver`, start `next dev -p 3332` with the Supabase env blanked, then `HOST=http://localhost:3332 node specs/evidence/creator-polish/shoot.mjs <dir>` and `PW=~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs SHELL_BIN=<chromium_headless_shell-1217> BASE=http://localhost:3332 ONLY=shop,bag,phone node specs/evidence/polish/hair-rods/rod-shots.mjs <dir>`, then kill the server. The rod shots take about 8 minutes (swiftshader).
- Blender: `withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props-enemies/build_tools.py` rebuilds every tool; only changed outputs show in git.
- Round 2 shots: `withlock.sh devserver <scratch>/run.sh specs/evidence/polish/lantern-ring <tag> "<name>=x,z@time@yaw,pitch,zoom@flags" ...` where run.sh starts `next dev -p 3332` (Supabase blanked), runs `HOST=http://localhost:3332 node specs/evidence/polish/lantern-ring/shoot.mjs <out> <tag> <shots>` and kills its server. Keep it to 4 shots a call (about 2 min a shot on a loaded machine), and run it with `run_in_background` so a slow run isn't cut at 10 minutes. Then convert the PNGs to webp.
- The lab island (`/lab/island?time=day|evening|night&at=x,z`) takes `tsi.held.v1` and `tsi.camera.v1` from localStorage; owning the Lighthouse rod signed out needs `/api/economy/inventory` answered (the script does it). Camera yaw 0 looks +z.
- The wharf's deck is drawn about 0.1 over `island.ground`, so anything flat on it needs lifting that much (the ring's +0.1).
