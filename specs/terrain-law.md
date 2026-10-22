# Terrain law

> Moved out of `CLAUDE.md` on 2026-10-22, unchanged. Read it before touching terrain, water, cliffs, roads or placement. Where it disagrees with the ledger (`specs/game-world-development-plan.md`), the ledger wins. Background: `specs/acnh-system-reference.md` (the ACNH grid, level, autotile, placement, material and rendering rules, measured from the dump), `specs/investigation-2026-07-26-foundations.md` (the defects) and `specs/investigation-2026-07-26-systems.md` (how ACNH, Minecraft and Roblox solve them).

## World model — ACNH grid law (David ruling, 2026-07-26)

**The world is a grid of cells, not a deformed surface.** ACNH's entire ground plane is
`FldUnit/Base_0.dae`: one 4-vertex quad, 10x10 raw, material `mGrass`. Every visual
comes from choosing which piece goes in which cell. Nothing is displaced.

Canonical constants (raw dump units; world = raw x 0.1). These are measured, not chosen:

| Constant | Raw | World |
|---|---|---|
| Tile pitch | 10.0 | **1.0u** |
| Cliff height (one kit piece) | 15.0 | **1.5u** |
| Elevation step (one LEVEL) | 7.5 | **0.75u** — a HALF cliff |
| River water surface, below its ground level | 0.78 | **0.078u** |
| Grass top lip | 0.39 | 0.039u |
| Cliff grass drape down the face | 1.88 | 0.188u |
| Chunk / acre | 160 | 16 x 16 cells |

Rules that follow, all enforced by ACNH and none of them optional if the art is to fit:

1. **Integer cells, integer levels.** Position is `(cellX, cellZ, level)`. No float
   placement.
1b. **Flat, cliffs, and natural slopes** (David, 2026-07-30: "the half steps
   needs blending"; 2026-09-30, rows 262-263: "what does cliffs look like and what
   does natural mountain slopes look like", and he picked both).

   | between two neighbours | height | drawn as |
   |---|---|---|
   | same level | — | flat ground |
   | 1 level | **0.75u** | a SLOPE: blended by `heightField`, walkable |
   | 2+ levels | **1.5u** | a CLIFF: the kit piece; crossed by a ramp or a mantle |

   `LEVEL_STEP = 0.75`, `CLIFF_LEVELS = 2`. That rule IS the slope class; no cell
   carries a flag. A hill or a mountain is a stack of one-level steps of any height
   (up to `MAX_LEVEL`), and the blend makes it one surface: `heightField` is a
   DIFFUSION over the cells that stops only where two neighbours are a cliff
   apart (it used to window each corner to its own level, which turned every
   mountain into terraces). Vertex normals come from the ground's own slope, and
   stony ground fades in past a rise of 0.33 (`ROCK`). The painter's Slope brush
   builds a level per 2.5 cells; a level per 1.5 cells is the steepest slope the
   rule allows and reads as a rocky mountainside. A slope is not geometry: an
   earlier pass built a vertical half-height face into the slope the field was
   already smoothing; don't reintroduce it.

   **`cellHeightRange` is load-bearing.** The field stores one height per cell
   CORNER, but a corner on a cliff boundary belongs to two cells that must
   disagree — the cliff top wants 1.5u, the ground below wants 0. The pinning
   pass resolves it for the cliff, which then drags the low cell's edge halfway
   up the wall. The mesh does not share vertices, so each cell clamps the field
   to its own reachable range, using the same barrier the blur does
   (`clampToCell`).

   **Authoring: `blob`'s taper is the trap** (`author-elevation.mjs`, legacy):
   `taper = 1` on a CLIFF blob resolves the outer 38% of the radius to level 1,
   an apron of half steps round every plateau. Pass `taper = CLIFF`.

   **Ramps cross full cliffs.** `Surface.Ramp` (8), stored at the LOWER level,
   direction derived from the neighbour one level up. `dropTo` reports a ramp as
   no drop and `sameLevelOrHigher` reports it as the same tier, so the cliff
   outline routes around the opening rather than sealing it. A run of two climbs
   a full cliff; reachability is the health check.

   **Edges are derived, not drawn** (rows 262-263, `grid.ts` "Natural shapes").
   Cells stay the data. The coast, the sand and soil blends and the built
   borders are 0-crossings of fields derived on a 4-per-cell lattice: the cell
   mask blurred (an exact box-Gaussian), plus noise seeded by world position
   (strong on open water, mild on narrow rivers), with every painted cell centre
   held on its own side so thin channels and spits survive and per-cell systems
   agree with the contour. So the coast is organic (rounded bays and points, no
   stair steps), sand and soil fade into grass over a worn edge, stone/wood/brick
   keep crisp rounded borders, and sand runs down to the waterline (`BEACH_RUN`)
   with a wet band. ONE derivation (`terrainOf`) feeds the mesh (`cellPieces`),
   walking and every dry-land check (`isGroundAtWorld`), the shore field, the
   beach height (`sampleGroundHeight`), fishing, forage and bug nodes, health and
   the painter's preview. `setCell` forgets it; an editor writing in place calls
   `refreshTerrain` for the cells it touched.
2. **One autotile vocabulary.** `{Kit}{Class}{Variant}_{Rotation}`; class 0-8 from the
   8 neighbours, A/B/C for diagonals, 0-3 pre-baked rotations. The same function drives
   cliff (44 pieces), river (45), waterfall (47) and road (20 per material).
3. **Each cliff level insets at least 1 tile** from the level below, and no two
   neighbours may differ by more than `CLIFF_LEVELS` — a face taller than one
   kit piece has nothing to draw it.
3b. **Mostly flat.** Health asks for flat ground (a cell whose eight neighbours
   share its level, at any level) on at least 60% of land; slopes and cliffs are
   free within that. `CENTRE_FLAT` in the authoring script protects a 34-unit
   disc; `widen()` deletes one-cell-wide walls that `open(2)` misses because it
   filters by area.
4. **Waterfalls are derived, not placed.** A river cell bordering a lower level emits a
   Fall piece. Multi-step drops stack single-step pieces.
5. **Buildings, bridges and inclines have integer footprints and a 1-tile gap.**
   `house-chalet.glb` already measures exactly 5.00 x 4.21 cells. Bridges ship in 3/4/5
   tile lengths; inclines are 2x4.
6. **Seasons are a tint on greyscale albedo** (`_AlbGry`), with explicit `Snow`
   variants only where the pattern changes, not the colour.
7. ~~Shadows are baked into the assets as `mShadow` meshes. No realtime shadow map.~~ **Wrong (measured 2026-09-27, row 240):** only interior room shells, the oak/cherry trees and two snow bushes carry `mShadow`, and on the trees it is a low-poly shadow *caster* (the leaf cards are not meant to cast), not a baked ground shadow. Shadow logic: `specs/look-development.md` section 9.
8. **Animation is a separate model** (`*Anim` variants), swapped in, not always paid for.

Anything that needs a flatten zone, a blend radius, a slab disc, a bank ribbon or a
rock band to hide a seam is fighting this model. Fix the model instead of adding another
cover layer.

## Terrain is drawn, not coded (set 2026-07-30)

**`/lab/map` is where the general layout for all future terrain and islands gets
drafted.** David's call. Before it existed, every terrain change was him
describing what he wanted ("less hills", "too vertical", "half steps should
blend") and an agent guessing at constants in `web/scripts/author-elevation.mjs`
— six of eight rounds went that way, each one a script edit, a regenerate and a
screenshot.

Consequences for anyone working on terrain:

- **Do not tune terrain by editing `author-elevation.mjs` constants** unless
  David asks for that specifically. Ask him to draw it. **David paints the
  village himself** (rows 241, 246; 2026-09-28: "dont make the island ill make
  it"): agents do not author, paint or rearrange island layouts or objects.
- The editor opens the SHIPPED `web/data/village-map.json` (terrain plus the
  object layer the game loads: every building, tree, prop, table, anchor,
  spawn; `lib/game/villageMap.ts`) and exports the whole document to the
  clipboard. There is no write path to disk on purpose. `island-map.json` is
  the preserved legacy draft, still openable. `/lab/island?draft=1` walks the
  painter's working draft. Spec: `specs/island-painter.md`.
- **`author-elevation.mjs` overwrites hand edits.** Its output is also its own
  input, which is how 21 stale ramp cells accumulated in the shipped map. If you
  run it, expect to lose hand-drawn work.
- Named drafts live in the browser's localStorage, so they are per-machine.
  Anything worth keeping has to be exported into the repo.
- The painter draws the terrain the game derives (organic coast, worn paths,
  wet sand, hill shading) and has the natural brushes: round grow/shrink,
  blur-threshold smooth, Slope, Cliff, soft land/sea (`specs/island-painter.md`,
  "Natural terrain"). `/lab/map?fixture=terrain` and `/lab/island?fixture=terrain`
  open the synthetic test island, never the shipped one.
- The health panel is `web/lib/game/mapHealth.ts`, which
  `web/lib/game/villageMap.test.ts` asserts on the shipped file: reachability
  from spawn, cliff-piece coverage, orphan ramps, cliff walls, faces taller than
  the kit can draw, the flat share, every landmark placed on dry land and
  reachable, resident anchors, study tables, forage and bug spots, a fishable
  sea. **If the panel says healthy, the paste keeps the suite green.** Add a
  check there and both follow.
