# Lane: polish (creator hair change, rod shop and bag fixes)

Worktree `.claude/worktrees/polish`, branch `game/polish`, cut from origin/main. Agent type `uwotsi-lane`. Dev port 3332.

Both parts shipped in v1.2 and David reviewed them. These are his redo notes. Read `specs/lanes/creator-polish.md` and `specs/lanes/rod-gear.md` for the code map and the "Tools and gotchas" of each (shoot scripts, URLs, demo data). Their "Next" sections are stale; this file wins.

## Part A: the creator's hair change

David, 2026-10-29, creator polish review (https://claude.ai/artifact/KkE3ppKZjP7o2yP6kxg8Rx):
- cp-dissolve: "not hte effect i like, do a more chill subtle hair change thats less glitchy"
- cp-dissolve-2 and cp-top: "not hte effect i like, do a more chill subtle hair change"
- Approved: cp-calm, cp-calm-face, cp-wave.

Today's look: the composite dissolves old to new with clumpy 3 px pixel noise and a foam-cream edge (`COMPOSITE_FRAG`, `uDissolve`). Replace it with something calm and subtle: for example a soft cross-fade, or a gentle fade that follows the wave's crest, with no noise cells and no bright edge. The old you still copies the new you's bones during the sweep, so only the look changes. Same for tops. Before and after strips (hair-a, hair-b, top) with the creator-polish shoot script.

## Part B: rods (round 3 fixes, not the new roster)

David, 2026-10-29, rods round 2 review (https://claude.ai/artifact/2SriizfPH8naxzxb1SdFmn), verbatim:
- r2-bag-rod: "make the line not black and thinner more subtle, the overlay good, maybe make it a slightly different color so its more ob, also the bobber on the rod is too big "
- r2-shop-glass: "move the title and text up a bit and the graph up a bit so theres a bit space between graph and purchase"
- r2-shop-shelf: "outline could be slightly bigger"
- r2-shop-lighthouse: "the model needs a light ontop because its lightouse, "

Build:
1. The bag's rod view: the line lighter (not black), thinner and subtler; the overlay a slightly different colour so it stands out more; the bobber on the rod smaller.
2. The shop's rod card: the title, text and radar up a little, so there's space between the radar and Purchase.
3. The shelf's rarity outline slightly bigger.
4. The Lighthouse rod gets a light on top: a small lamp housing at the tip with a warm emissive glow (no real light source; emissive plus the existing bloom if any). Edit the model with a headless Blender script (a script, not hand edits), HD and LP, then run `cd web && node scripts/pack-glbs.mjs`.

Not this lane: the new rod roster (Precision, Training, Riptide, Titanium, Tempest and the re-tiering), the bait and bobber remodels, and auras. They wait for the Meshy key.

## Gates and evidence

tsc, vitest on the touched areas, eslint on changed files, headless before and after shots (desktop and phone where it's UI). One perf:check (SCENES=v2) only if the lighthouse model's triangles grow noticeably. Evidence in `specs/evidence/polish/`, then report to the coordinator for a review page.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- Locks: `LANE=game/polish /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Supabase env blanked on your dev server.
- New world only (the village is retired). No fetched art. Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail code (`specs/lane-rules.md`).

## Status

Both parts built 2026-11-01 on `game/polish` (from f9cebe44), ready for David's review. Gates: tsc clean; vitest on the touched areas (arrival, rods, gui, economy, icons, rarityPalette, gui contrast) 24 files / 224 tests passed; eslint clean on changed TS files. No perf:check: the lamp adds 204 triangles to rod-4 (361 to 565), not noticeable.

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

## Next

1. The coordinator puts the evidence on a review page for David.
2. On notes: the fade is `COMPOSITE_FRAG`'s one `mix` line and its timing `smooth(beats.ride, beats.done, ...)`; line colour/size, `SIZE` in RodGear.tsx; `--ui-chart-gain` in styles/themes; the gap `margin-bottom: 30px`; the outline `2.5px` in flat.module.css; the lamp's colour, size `k` and strength in build_tools.py (then rerun Blender, then `render-icons.mjs rod_lighthouse`).

## Tools and gotchas

- In the shop's white studio stage the lamp's glass reads soft peach (the studio lights wash the amber); the icon shows it amber. It will glow more in the world at dusk.
- `specs/evidence/polish/` also holds an older lane's files (polish-ownership); this lane's are under `hair-rods/`.
- Shots: hold `withlock.sh devserver`, start `next dev -p 3332` with the Supabase env blanked, then `HOST=http://localhost:3332 node specs/evidence/creator-polish/shoot.mjs <dir>` and `PW=~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs SHELL_BIN=<chromium_headless_shell-1217> BASE=http://localhost:3332 ONLY=shop,bag,phone node specs/evidence/polish/hair-rods/rod-shots.mjs <dir>`, then kill the server. The rod shots take about 8 minutes (swiftshader).
- Blender: `withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props-enemies/build_tools.py` rebuilds every tool; only changed outputs show in git.
