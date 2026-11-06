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

(round 1 not started)

## Rules

Same as `specs/lanes/rod-gear.md` Rules, with your own lane in the lock commands: `LANE=game/rod-titanium /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>`. Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; never touch prod. After any Blender export into web/public: `cd web && node scripts/pack-glbs.mjs <the files>`.
