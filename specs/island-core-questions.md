# Island core: open questions for David

Append questions here (date, question, what you assumed meanwhile). The reviewer relays them.

## 2026-09-23 (island agent, milestone 1)

1. **Dawn window.** Should dawn follow real sunrise in London/Toronto (it moves from ~05:40 in June to ~07:50 in December), or stay a fixed clock window? *Assumed:* fixed 05:00–07:00, with the applicant island's shipped windows kept (day 07–17, evening 17–21, night otherwise).
2. **Which island is "the default island".** The worktree has the small `/lab/island` fixture (`DefaultIslandWorld`) and the legacy full world (`GameWorld`, `/student/dashboard`, `/lab/world`). *Assumed:* milestone 1 targets `/lab/island` per the plan's "keep the simple default island"; `GameWorld` only received the shared, opt-in rendering hooks and restored furniture GLBs.
3. **Island size.** The village core did not fit the 42×34 fixture. *Assumed:* grew the ellipse to 48×40 units (same 64×64 grid, same terrain system); later biomes stay out of scope.
4. **Museum and café models.** No museum or café building exists in the asset library (the only "museum" GLB is the Oracle's `oracle-museum.glb`). *Assumed:* red chalet = museum shell, yellow chalet = café, both boarded with the country fence and a sign. Want dedicated models later?
5. **Season dressing.** `season.ts` returns blended weights, but nothing is dressed by season yet (spec says scaffolding). *Assumed:* dressing (grass tint, props, palettes from `seasonal_palettes`) is the next pass; tell me which of the existing `DEFAULT_PALETTES` should map to each season.
6. **Light tier and post effects.** Shipped "Lighter graphics" disables all post effects, so Light also loses colour grading. *Assumed:* kept as shipped. Should Light keep the grade (cheap) and drop only FXAA/bloom?
7. **Player character.** The applicant island's 3D Quaternius player/guide were not ported; the 2D sprite stays until the Blender set (other agent) lands. *Assumed:* correct per the character-set split.
8. **Plaza surface.** Brick rendered saturated orange next to the recalibrated grass/soil. *Assumed:* stone plaza. Fine?

## 2026-09-24 (island agent, deliverables A–C)

9. **Evening window.** Decision 173 says evening is the hour around sunset (±30 min), so evening is now 1 h long instead of the shipped 4 h (17–21). Night lamps and fireflies start ~30 min after sunset. *Assumed:* as specified; say if you want a longer golden hour (e.g. sunset −90 min).
10. **Stone plaza and wood in winter.** Snow cover is on grass, paths and beach. The stone plaza and bridge stay bare (the dump has `mRoadStoneSnow_Alb`/`mRoadWoodSnow_Alb`, but those surfaces use the non-palette material path). *Assumed:* acceptable for now; next pass can swap those albedos.
11. **Fireflies by season.** ACNH fireflies are a June thing; I only removed them in winter and during rain/snow. *Assumed:* keep them spring–autumn nights. Restrict to summer?
12. **Winter tree variant.** All oaks (including the blossom slot) use the dump's `PltTreeOak4Snow`, cedars `PltTreeCedar4Snow`, extracted with the committed `extract-acnh-kit.mjs --scale 0.1`. The snow overlay mesh `mWinterSnow` is dropped by that extractor (it renders opaque); the snow in the leaf albedo carries the look. OK?
13. **Buildings in winter.** Roofs are not snow-capped (the same `mWinterSnow` overlay would be needed). *Assumed:* later pass.

## 2026-09-24 (island agent, deliverable D)

14. **Winter flowers.** In ACNH itself flowers stay out and bloom through winter (they sit in the snow). Per the coordinator's instruction I hide all flower clusters in winter and swap bushes to the dump's snow holly (`PltBushHolly4Snow`); hydrangea/azalea snow variants only exist at growth stages 0–2 in the dump. *Assumed:* hide. Say if David wants ACNH's winter blooms back.

## 2026-09-24 (island agent, progression world side)

15. **Monument placement.** The plaza was widened west (x −7..4) and the monument sits at (−5.2, 3.4), off the spawn→clubhouse axis so the main route stays clear. *Assumed:* fine; say if it should be plaza-centre.
16. **Which goal the monument shows.** One monument tracks the *active* club goal (café, then museum); completed goals open their building. *Assumed:* one shared monument rather than one per goal.
17. **Ceremony audience.** Only two placeholder residents exist (Mayor Eliza, shopkeeper); both walk to the monument and cheer. More residents join automatically when the roster grows.
18. **Contract for the systems agent.** World reads `ProgressionWorldState` via `web/lib/game/progressionBridge.ts` (swap `useProgressionSource`) and sheets via `web/components/game/progressionSheets.tsx` (`{ open, onClose }`). `web/lib/progression/` did not exist when I finished.
