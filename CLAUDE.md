# CLAUDE.md — Agent Entry Point

> First file every agent reads. 1-page index. Last updated 2026-09-02.

## What this repo is

UWO-TSI (Tethos) website + student portal. Two product surfaces:

1. **Marketing site** (`web/app/(site)/`, `web/app/student/page.tsx`) — public landing pages. Stable.
2. **Recruitment system** (`web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`) — 2026-27 exec hiring portal. Live in production. **Current focus** (fall round + gamified apply); otherwise do not touch unless tasked.
3. **Student game portal** (`web/app/student/dashboard/`, `web/components/game/`, `web/components/portal/`) — a 2.5D MMO RPG game world for active TSI members. **Pushed back as of 2026-09-02**; tip parked on `feat/acnh-tile-grid`. Single-player MVP, multiplayer (Colyseus) deferred.
   **Superseded 2026-09-26:** the member game is active again on `feat/game-default-island` (draft PR, not merged). Its decisions live in `specs/game-world-development-plan.md` (ledger rows 1–231) and its sequence in `specs/development-roadmap.md`; both override this file where they differ. The applicant island is live on `main` and shares its rendering code with the member island. See `STATE.md` → "Game branch".

## Your role

The team has 3 agents: `build`, `qa`, `reviewer`. See `AGENT_LOG.md` Team section for ownership boundaries. Append entries only to your section.

## Read in this order

0. **`STATE.md`** — which branch is live, what's in prod, what David decided most recently. One page. Read it before anything else below.
1. **This file** — you're here
2. **`AGENT_LOG.md`** — current sprint, your role, file ownership, commit prefixes
3. **`web/app/student/STUDENT_SYSTEM_BIBLE.md`** — feature mechanics (Bounty, Calendar, Kanban, Marketplace, Job Board, Directory). Read the "CURRENT VISION DELTAS" banner at the top first — it lists what's drifted.
4. **`specs/ux-status.md`** — current design-debt backlog, prioritized into Tier-1/2/3. The sprint pulls from Tier-1.
5. **`specs/acnh-system-reference.md`** — **the world model.** ACNH's grid, level, autotile, placement, material and rendering rules, measured from the dump. David ruled 2026-07-26 that the world follows ACNH grid logic. Read before touching terrain, water, cliffs, roads or placement.
6. **`specs/asset-stack.md`** — tech architecture: R3F + Drei, 2D sprite chars, Colyseus deferred. **Its asset table is superseded** — see the banner at its top.
7. **Role-specific specs** in `specs/` — `ux-game-world-v2.md`, `ux-oracle-v2.md`, `ux-classes.md`, `ux-dashboard.md`, `ux-directory.md`, etc. Use the index in `specs/ux-status.md` §1 to find the right one.

Background on why the world model changed: `specs/investigation-2026-07-26-foundations.md` (the defects) and `specs/investigation-2026-07-26-systems.md` (how ACNH/Minecraft/Roblox solve them).

## Current focus (David, 2026-09-02)

**Sept 2026 launch = fall hiring round (VP Marketing + PM, Sept 5-11) with a gamified "character sheet" application.** The member game world is pushed back; its tip is parked on `feat/acnh-tile-grid` (see `STATE.md`). Recruitment code is **in scope** for this work; the marketing site stays off-limits.

## Project vision (TL;DR)

- **Style:** ~~2D sprite characters in a 3D world~~ retired by ledger row 105: characters are low-poly 3D models on one shared rig. PS1 shader + ACNH curved-world shader.
- **Map:** 2-3 screens wide. Buildings (HQ, Shop, Oracle Temple) you enter; objects (Bounty Board, Job Board) open overlays.
- **5-tier RBAC:** T1 David / T2 chapter presidents / T3 PMs+VPs / T4 directors+devs / T5 volunteers+general.
- **MBTI class system:** 4 main classes (as implemented: Warrior/Mage/Healer/Rogue, colors in `specs/ux-classes.md`) + 16 subclasses, assigned via the Oracle Temple quiz. The gamified apply flow reuses the same mapping.
- **Economy:** TSI Coins, never reveal conversion rate.
- **Phase 1 (current):** single-player game world, directory, all feature pages as overlays. Close Tier-1 punch list to merge to main.
- **Phase 2 (deferred):** multiplayer (Colyseus), Avatar creator (Nano Banana sprites), building interiors, Oracle v2 card-game, mobile.

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

## Where to find things

| Topic | Location |
|-------|----------|
| Current sprint goal | `AGENT_LOG.md` → "Current Sprint" |
| Build/lint baseline + bug list | `specs/qa.md` |
| 3D game world component | `web/components/game/DefaultIslandWorld.tsx` (served at `/student/dashboard`; the legacy `GameWorld.tsx` was deleted 2026-09-27) |
| Member world launch switch | `NEXT_PUBLIC_MEMBER_WORLD=open` (`web/lib/recruitment-access.ts`); closed shows `/student/opening-soon` |
| **Terrain drafting tool** | `web/app/lab/map` — where the layout of every island gets planned. See below. |
| Player avatar + sprite sheet | `web/components/game/PlayerAvatar.tsx` |
| Dashboard pages (overlays) | `web/app/student/dashboard/*/page.tsx` |
| Supabase clients | `web/lib/supabase/{client,server,admin}.ts` |
| DB types | `web/lib/supabase/types.ts` |
| Migrations | `web/supabase/migrations/` (portal: 001_initial, 002-008, 014-023; recruitment: 001_recruitment, 009-013, 027; timestamped since 2026-09-16). The game drafts `20260926150000_*`–`20260926150800_*` are unapplied. Status in `STATE.md` |
| Design tokens | `web/styles/game-tokens.css` |
| Historical 5-agent log | `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md` |
| Deprecated specs | `archive/specs/` |

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

## Design principles (set 2026-05-25)

These guide every scope and design decision. When trade-offs arise, choose the option that satisfies these. Confirmed by David.

> **Partly superseded (2026-09-26).** Principle 3 is overridden by ledger rows 11, 23, 76, 200 and 225 (XP from play and missions as well as IRL, play coins from in-game activity, a daily login gift). Rows 74–75 open study tables and the wider game to public accounts. Where this list and `specs/game-world-development-plan.md` disagree, the ledger wins; `specs/development-roadmap.md` has the build order.

1. **Community over productivity.** The portal is a 3D hangout, not a productivity tool. Bounties, jobs, leaderboards are features inside the hangout, not the engagement engine. When you have to pick: more social presence, less task throughput.
2. **The world must never feel empty.** AI NPCs always populate the world, scaling inversely with real-player count. Ghost-replay of recent member positions if multiplayer isn't on. No empty-world states ever ship.
3. **(Superseded, see above.) XP rewards IRL, TC rewards money-equivalent value.** XP comes only from in-person event attendance (QR check-in) and special admin grants. TC comes only from delivering monetary-value work (bounties, paid projects). **Never reward online activity** — no login streaks, no "visited a building" XP, no Habitica grinding.
4. **Cosmetic > functional class system.** MBTI classes and avatar customization are flair, not mechanics. Don't gate features behind class. Rich cosmetic + class identity is a late-game build (Phase 3+).
5. **Mobile-aware, always.** No feature ships that's fundamentally desktop-only. Mobile members may get a stripped "view + emote + chat" mode, but they must be able to *appear online* on their phone.
6. **Leaderboard: top half public, bottom half private.** Bottom-half members see only their own rank and anonymized neighbors. Privacy default.
7. **Senior members can mute the game-feel.** No mandatory quests for T1-T3. Onboarding quests are opt-in for everyone, skippable in one click.
8. **The world has a monthly content cadence.** Admins drop new NPCs, new shop items, seasonal palettes, new events monthly. The build must include admin tooling that makes this easy — never code-only content updates.

---

## Working rules

- **Before implementing or creating anything, search for an existing implementation first:** inspect current code, relevant branches/worktrees, existing assets and saved context. Read the best prior version and reuse or adapt it. Do not build a simplified duplicate because it is absent from the current branch. In particular, the advanced game systems are in `.claude/worktrees/restart-art-cohesion` (`feat/game-default-island`): seagull model/pathing, full fishing, CollectionBook/backpack and flower picking. Identify a concrete incompatibility before proposing a replacement. (David, 2026-09-16)

- `cd web && npm install` requires `--legacy-peer-deps` (`.npmrc` is configured).
- `npm run dev` may fall back to port 3001 if 3000 is taken.
- Game world uses `next/dynamic` with `ssr: false` — `BAILOUT_TO_CLIENT_SIDE_RENDERING` in SSR output is expected, not an error.
- Middleware gracefully handles missing Supabase env vars — dev works without `.env.local`.
- **Never** edit applied migrations. New migrations use a `YYYYMMDDHHMMSS_` timestamp after the latest one on `main` (see `STATE.md`).
- **Never** reveal the TC ≈ CAD conversion rate in user-facing strings.
- Build agents: when scope is unclear, ask reviewer (David) before guessing. Don't add features the spec doesn't list.

## Known foundational defects (measured 2026-07-26, not yet fixed)

> D2, D3, D6 and the `GameWorld.tsx` half of D8 went with the legacy world (deleted 2026-09-27); re-measure them on `DefaultIslandWorld` before acting.

Do not "fix" the symptoms of these by adding another layer. Each has a documented
root cause in the file that owns it. Full detail:
`specs/investigation-2026-07-26-foundations.md`.

| # | Defect | Owner file | Evidence |
|---|---|---|---|
| D1 | Curved-world patch corrupts the shadow map — caster bent in light space, receiver looks up unbent, error grows with distance and changes as the player walks | `lib/game/curvedWorld.ts` | header note; three r182 `depth.glsl.js:37` |
| D2 | Road tiles overlap 11% — `CELL = 0.89` on a 1.0u tile, coplanar at 0.0005u thick, z-fights | `components/game/RoadTiles.tsx` | header note |
| D3 | Key:fill is 1.08:1 → a 2.2:1 contrast ratio, ~1.1 stops. Form cannot read. Key 1.40 vs ambient 0.35 + hemi 0.40 + 2nd directional 0.15 + env IBL 0.40 | `GameWorld.tsx` `TOD_KEYS` + lights | target ≈ 4:1, cut fill to ~0.50 |
| D4 | Grade compensates in the WRONG direction — `uDesat 0.14` and `uBlackLift` on an already-flat render | `components/game/PostFX.tsx` | retune after D3, not before |
| D5 | 12 shipped GLBs are missing meshes, including all 4 river banks (lost their ground plane) and the trees' baked `mShadow` layers | `scripts/organize-dump.mjs` | header note |
| D6 | Camera FOV 48 is a wide lens; the diorama read needs ~28-32° and more distance. Wide FOV also amplifies the view-space bend at screen edges | `GameWorld.tsx:2668` | pairs with D1 fix (a) |
| D7 | React setState on the per-frame path — `onMove(pos.clone())` inside useFrame re-renders 7 Buildings with `<Html>` pills at 60fps. `playerPosRef` already exists next to it | `components/game/PlayerAvatar.tsx:600` | read the ref; throttle the setState |
| D8 | M1 budget: `dpr={[1,2]}` = 4x fragments on Retina; realtime shadow map still on despite the ~7 FPS note; bloom auto-enables because `navigator.deviceMemory` is absent in Safari and capped at 8 in Chrome | `GameWorld.tsx:2668`, `lib/game/useGraphicsSettings.ts` | gate on a real FPS probe |

Live-scene budget for context: 108 GLB URLs carrying 220 primitives, **209 distinct
materials**, 134,817 vertices. Vertices are free on an M1; the ~400-500 draw calls with
a material change on each are the wall. `THREE.BatchedMesh` and `THREE.LOD` both ship
in the installed three r182 and are unused; there is no texture atlas.

## Commit prefixes

`[build]` / `[qa]` / `[review]` — see `AGENT_LOG.md` Commit Prefixes.

## Out of scope (do not touch unless tasked)

- `web/app/(site)/**` — marketing site
- `web/app/student/apply/**`, `web/components/recruit/**`, `web/components/admin/**` — recruitment system (live in prod). **Exception:** in scope for the Sept 2026 round + gamified apply prototype (David, 2026-09-02)
- `web/components/sections/**` — marketing homepage sections
- Migrations `001_recruitment.sql`, `009_*`, `010_*`, `011_*`, `012_*` — recruitment schema
