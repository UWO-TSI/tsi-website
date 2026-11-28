# Lane rod-tests

Worktree `.claude/worktrees/rod-tests`, branch `game/rod-tests` (from origin/main 5221df56a). Never push.

## Task (coordinator, 2026-11-28)

Three RodAura.test failures on main and game/rod-touchup. For each one, decide whether the test is stale or the asset regressed, and fix the root. Done when the full vitest run passes and tsc is clean.

## Status

Done. The head SHA is in the report.

The three failures go back to rod-rebuild-a (d7eb9156c to 8b606211a, 2026-11-20), not to ed633448f. Rebuild A remade the Riptide, Tempest, Tidewarden and Titanium effects from the concept effects sheets (`art/pipeline/concepts/old/<rod>/effects.png`), following David's 11-20 note "titanium = match the concept including details". It never ran RodAura.test. Rod-meshy then hid all three failures behind a texture-loading error, and its loader fix brought them back (rod-meshy.md, Tools and gotchas).

1. **`rod-titanium.glb` names `rodfx-titanium.glb`: the test was stale.** Rebuild A deliberately gave the shut Titanium the concept sheet's effect: cyan `Bands` (Glow, pulse) and `Sparks` (Glow, flicker), 2 draws. The Meshy fit kept the rod's `rodFx`, and David saw the bands in rod-meshy's `titanium-compare.jpg`. The round 2 and 3 rule "no effect when shut" came from David's 11-06 "no purple glow on the unawakened", and the 11-20 concept direction replaced it. The rod's material (plain steel `P_Polished` with the grazing film) is unchanged, and its own test passes. Test changed: the Titanium names `rodfx-titanium.glb`. The same test's "7 rods have effects" was hidden behind the Titanium assertion and was stale too. 14 rods name an effect now, each added on purpose: Candy Cane, North Star, Crystal, Lighthouse, Riptide, Training stage 2 and the Cedar's leaves came from rebuilds B and C, rod-meshy and the Christmas rods. Each one passes the per-rod check (the file exists, at most 5 draws, the tip unmoved). The count is now 14.
2. **The base Tidewarden effect isn't all Glow: the test was stale.** The failing assertion was `base.m.every(endsWith "Glow")` on the effect as bought, not the awakened Water wrap, which passes. The round 11 base effect was Glow veins traced on the round 9 model's head, and that model is gone. Rebuild A replaced the veins with the concept sheet's `Wisps` and `Drift` (Light, 2 draws). It still carries no water as bought, as David's round 10 note asks. Test changed: the base parts are all Light.
3. **The Tempest's effect is 6 draws: a perf regression, now fixed.** Rebuild A added an `Eye` part (the storm's eye and ice shards round the globe, Glow, pulse). That made 5 meshes plus the Gust trail, over the 5-draw cap (effects-cost.md row 68 has the Tempest at 5). No doc approves raising the cap. Fix in `build_rods_a.py`: the Eye's geometry is built into `Bolts`, so it crackles with the bolts that run into it, in the Bolts' cyan, and the effect is 4 meshes plus the trail, 5 draws. The rest of the effect is unchanged.
   - Pipeline fix in the same file: `build_rods_a.py` no longer writes the rod GLBs. The four rods are the Meshy models now, so a rerun would have overwritten them. Don't rebuild the Riptide with it: fxedit.py edited the Riptide's effect afterwards.

## Open (for the coordinator, not this lane)

- The Titanium's `Bands` rings sit near the Meshy collars but not exactly on them, and one floats under the reel. Rod-meshy noted this and it's still open.
- If David meant "no effect on the shut Titanium" to stand, drop the rod's `rodFx`. It's his call.

## Tools and gotchas

- `LANE=game/rod-tests withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_a.py -- only tempest`, then `cd web && node scripts/pack-glbs.mjs <glb>`.
- To dump an effect GLB's nodes, materials and extras, load it the way RodAura.test's `load` does, in a throwaway vitest file.
