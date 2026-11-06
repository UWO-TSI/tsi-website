# Lane: rod-titanium (the new Titanium rod and its mecha awakening)

Worktree `.claude/worktrees/rod-titanium`, branch `game/rod-titanium`, cut from `game/rod-gear` at 7106dbe5f (rod-gear round 8 built, round 9 notes only). Agent type `uwotsi-lane`. Dev port 3484.

rod-gear owns the rods and runs round 9 in parallel (the Tidewarden and a `Water` effect type) in `art/pipeline/build_rods.py`, `fx_library.py`, `web/lib/game/fx/library.ts` and `RodAura`. Keep your edits to the Titanium's own functions and lines so the two branches merge cleanly; this branch merges into `game/rod-gear`. Read `specs/lanes/rod-gear.md` (Status, Tools and gotchas, Rules) and `specs/fx-library.md` first: the effects library, the awakening cutscene, rodMotion and the Blender pipeline are all there.

## Round 1: David's notes (2026-11-05, verbatim)

- "the current titanium rod shuold be something else it look nice, but i want you to make a new model of the titanium thats closer related while the current is reserved for smth else"
- With `specs/references/rods/epic-titanium-metal-ref.png`: "titanium reference, clean like cnc machined rod, thick too and reflects this glow because its metal"
- With `specs/references/rods/epic-titanium-awakened-ref.png`: "like this type of hard edge looks like this reference loosely as a rod and the awakenign will have the blue energy thing built in should be very meccha looking"

The images are third-party: untracked in `specs/references/rods/` (README.md describes them) and in the vault. Never commit them.

Build (coordinator):
1. **Reserve the current Titanium.** Keep today's model and effect (`titanium()` in build_rods.py, `tools/rod-titanium.glb`, `props/rodfx-titanium.glb`, its icon) under a neutral reserved name (`reserved_slate()`, `rod-reserved-slate.glb`, `rodfx-reserved-slate.glb`), out of the roster, for a rod David names later. Its reference `epic-titanium-ref.png` goes with it.
2. **The new Titanium**, from the metal reference: a thick, clean CNC-machined rod with hard bevels and flat ground facets, crisp edges and chamfers, machined rings where parts meet, a machined reel. The anodised titanium tint runs along it the way the reference does (pale steel and straw gold through bronze to deep blue and violet). It's metal, so it reflects: light and the glow (the shop, the bag stage, the cutscene's glow) slide across the facets in sharp streaks. Find how the stages light models today and make the metal read in each without breaking the toon look. Tool budget (600 tris, 5 materials, nothing emissive on the rod); same file names as today so nothing rewires (`tools/rod-titanium.glb`, `rodfx-titanium.glb`, `rod_titanium`). Its base effect stays quiet (it's metal, not magic): no halos or rings (the library's rules). Re-render the icon.
3. **The awakening, mecha** (from the second reference, loosely, as a rod): at its awakening the Titanium becomes armoured, with stepped hard-edged plates, panel lines, a ring hub at the reel, and cyan-blue energy built into the plates (Glow parts in its effect GLB; the energy's motion from the library). This is the first real awakened model: give an awakening its own model and effect files (for example `rod-titanium-a1.glb`, `rodfx-titanium-a1.glb`) in place of the cutscene's `FINISH` recolour for this rod, and show it wherever an awakened Titanium shows (the bag, the card, the cutscene's reveal, in hand). Keep the change small and general so the other rods can use it later. The cutscene (`/dev/economy?view=awakening&rod=titanium&stage=1`) goes from the machined rod to the mecha form; the energy comes alive in the burst. Its awakening data (one at 400 fish, proposed in round 7) stays.

Evidence `rti1-*` in `specs/evidence/rod-titanium/r1/`:
- the new Titanium beside the metal reference (still), turning (clip), with the light sliding over the facets;
- the awakened form beside the mecha reference (still), turning (clip), and the cutscene (clip);
- both in the shop detail, the bag and in hand (desktop and phone);
- the reserved rod (still) under its reserved name;
- draws and tris against the budget;
- a questions card (what the reserved rod becomes; anything else to decide).

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, headless shots, one `perf:check` at the end on the scenes you touched. Report at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Status

- **Round 1b built** (the coordinator's review of e6ba25651: "thick too", the flat-to-flat contrast, the awakened form washed out in the bag; build aa88f0e99; gates: tsc clean, full vitest 3808 passed + 4 skipped with and without `NEXT_PUBLIC_GAME_WORLD=new`, eslint clean, perf:check v2 passed (high 5.20 ms, lite 3.00 ms, draws 360 and 283; load 8.5)):
  - The machined Titanium is thick bar stock (about twice round 1's width: grip 0.036, collar 0.047, blank 0.062 by 0.046 rig units), tapering only into a broad ground point from 0.62; the reel moved out (y -0.105, rim 0.045) and the line runs clear of the bar.
  - Contrast: `ground(u, n)` gives each wide flat its own oxide (`FLATS`: a shift along `ANODISED` and a brightness: one bright, the next deep blue), chamfers polished brighter, the point pale steel on every flat; the run stretched (`u ** 1.6`) so straw and gold cover the front half. `P_Polished` is now metallic 0.85, roughness 0.14 (env 2.2): the light slides from flat to flat as it turns, and it survives the bag's pixel finish (rti1-titanium-stage).
  - The awakened form is painted armour: one `P_Paint` material (`metal(..., finish="P_Paint")`, `FINISHES`), pale grey faces outlined dark (chamfers and walls), cyan energy lines thicker; its `Aura` dropped and `Blades` made a solid `Glow` (the additive parts vanished on the shop's white and washed the plates pale). Effect 3 parts, 308 tris, 4 draws in a hand.
  - Evidence redone under the same names; the vs-ref composites are in the session scratchpad (`with-ref/`); the questions card updated.

- **Round 1 built** on `game/rod-titanium` (build 167628157, final models and evidence c74091e66, this file after; gates: tsc clean, full vitest 3808 passed + 4 skipped with and without `NEXT_PUBLIC_GAME_WORLD=new`, eslint clean on changed files, perf:check v2 passed (high 4.90 ms, lite 3.00 ms, draws 358 and 285)):
  - **Reserved:** the old Titanium is `reserved_slate()` in build_rods.py: `tools/rod-reserved-slate.glb`, `props/rodfx-reserved-slate.glb` (rodFx `reserved-slate`), `icons/rod_reserved_slate.webp` (the old icon, moved), out of the roster. Its reference `epic-titanium-ref.png` goes with it (the references README already says so).
  - **The new Titanium** (`titanium()`, same file names: `tools/rod-titanium.glb`, `rodfx-titanium.glb`, `rod_titanium`): a thick machined bar through `machined()` stations (eight points each, ground flats and chamfers): a chamfered pommel, a grip with two machined grooves, the reel seat collar, a blank ground to a diamond, a ferrule ring, a broad chisel point; a machined reel heat-coloured from its hub. 578 tris, **one material `P_Polished`** (all colour in COLOR_0, `metal()`): the anodised run `ANODISED` (pale steel, straw, gold, bronze, purple, blue, violet), polished chamfers brighter (`chamfer()`), hard edges over 14 degrees. Effect quiet: `Glint` (light, pulse) on the point and sparkle particles; no halos, no aura.
  - **The metal in each stage:** the stages (shop, bag, workbench, cutscene) are TurnStage: studio lights and a RoomEnvironment at 0.7. New preset `polished` in modelMaterials.ts (`P_Polished`: roughness 0.2, metalness 0.45, `env` 2.2, the room seen brighter in it); prepareModel applies `env` as envMapIntensity. In a hand the rod merges to one mesh of the `metal` look class, so LookMaterials reflects the island's sky in it. The icon stage is matte by design (the gradient and facets still read).
  - **The awakening's own model** (general): `Awakening.model` (rods.ts) and `awakenedLook(rod)` (`{ model, icon: <key>_a<n> }`, the last reached awakening with a model). The icon manifest adds `<rod>_a<n>` for each (rendered icon `rod_titanium_a1.webp`); `rodSpec(rod)` (lib/icons/itemModel.ts) is the rod's spec as it is now. Used by the bag (RodStage gets the awakened rod; the card's picture), the shop's detail (`rodSpec(awakened(rod, catches))`), the cutscene (`looks` before and after; `FINISH` stays only as the stand-in for awakenings without a model, the Titanium's entry deleted) and the hand (WheelContext `catches`, WheelItem `model` and icon; `heldView` uses `item.model`).
  - **The awakened Titanium** (`titanium_a1()`, `tools/rod-titanium-a1.glb`, `props/rodfx-titanium-a1.glb`, rodFx `titanium-a1`): the machined core armoured with `A1_PLATES` through `plate()` (convex outline in the broad XZ plane, chamfered: pale chamfers, grey faces, dark walls as panel lines), stepped plates either side, cheeks over the seat, a fin, a ring hub on the front with a knuckle guard. 590 tris, one material. Effect (4 draws): `Energy` (glow, flicker: panel lines and the blade's edge), `Core` (glow, pulse: the hub), `Blades` (light, pulse: two energy blades), `Aura` (aura_hug), sparks.
  - Dev: `/dev/economy?view=bag&ti=<fish>` puts a Titanium in the bag (400 awakens it); `/dev/flat-ui?surface=crafting&crafting=demo&ti=1` teaches its recipe (lib/crafting/demo.ts). heldMesh.test allows a held item that is one mesh already.
  - Evidence: `specs/evidence/rod-titanium/r1/` (below). The side-by-sides with the references are **not committed** (they contain the third-party art): the coordinator's copies are in the session scratchpad, `with-ref/rti1-titanium-vs-ref.png` and `with-ref/rti1-a1-vs-ref.png`.

## Next

1. David reviews `specs/evidence/rod-titanium/r1/` and the questions card (`rti1-questions.png`): what the reserved rod becomes; a high-def copy of the awakened form for the close-ups; list the Titanium in the rod shop; send the awakening to other players (today they see the machined rod: the held string carries the rod only, lib/net/protocol.ts `heldOf`); the cutscene's glow colour for a mecha awakening.
2. Merges into `game/rod-gear` (round 9 runs there in parallel: expect a conflict only in `specs/fx-library.md`'s "Made before the library" line and maybe `ROD_FILES`/`BUILD` in build_rods.py; rebuild any GLB from the merged script, never pick a side).

## Tools and gotchas

- Build: `Blender -b --factory-startup -P art/pipeline/build_rods.py -- only titanium,titanium-a1,reserved-slate [render <dir>]` under `withlock.sh blender`, then `cd web && node scripts/pack-glbs.mjs <the files>`. The two Titanium rods share one `P_Polished` material when built in one run (`metal()` reuses it).
- Studio renders (stills and turntables, a dim warm room and three soft boxes): add `-P specs/evidence/rod-titanium/r1/studio.py` after build_rods.py and `studio <dir> [turn <frames>]` to the args (it exports too: repack after).
- Shots: `withlock.sh devserver specs/evidence/rod-titanium/r1/serve.sh node specs/evidence/rod-titanium/r1/shots.mjs` with `ONLY=look|stages|cut|clips|cards` (`OUT=` must be absolute); serve.sh starts `next dev -p 3484` in its own process group with Supabase blanked and the new world, and stops it after. In hand: `serve.sh node specs/evidence/rod-titanium/r1/hand.mjs <dir> name=<rod glb>@day|night@140,8,0.25` (`CLIP=440,250,400,420`, `VIEW=390x844` for a phone). Icons: `serve.sh node web/scripts/render-icons.mjs rod_titanium rod_titanium_a1`.
- node_modules: this worktree had none; cloned from rod-gear's (`cp -Rc`, same package-lock).
- `specs/perf/measure-build.sh` restores the game's files from git after its build: commit first.

## Rules

Same as `specs/lanes/rod-gear.md` Rules, with your own lane in the lock commands: `LANE=game/rod-titanium /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>`. Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; never touch prod. After any Blender export into web/public: `cd web && node scripts/pack-glbs.mjs <the files>`.
