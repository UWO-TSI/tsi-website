# CLAUDE.md — Agent Entry Point

> First file every agent reads. 1-page index. Last updated 2026-05-21.

## What this repo is

UWO-TSI (Tethos) website + student portal. Two product surfaces:

1. **Marketing site** (`web/app/(site)/`, `web/app/student/page.tsx`) — public landing pages. Stable.
2. **Recruitment system** (`web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`) — 2026-27 exec hiring portal. Live in production. Do not touch unless explicitly tasked.
3. **Student game portal** (`web/app/student/dashboard/`, `web/components/game/`, `web/components/portal/`) — **THIS is what agents are building.** A 2.5D MMO RPG game world for active TSI members. Single-player MVP, multiplayer (Colyseus) deferred to Phase 2.

## Your role

The team has 3 agents: `build`, `qa`, `reviewer`. See `AGENT_LOG.md` Team section for ownership boundaries. Append entries only to your section.

## Read in this order

1. **This file** — you're here
2. **`AGENT_LOG.md`** — current sprint, your role, file ownership, commit prefixes
3. **`web/app/student/STUDENT_SYSTEM_BIBLE.md`** — feature mechanics (Bounty, Calendar, Kanban, Marketplace, Job Board, Directory). Read the "CURRENT VISION DELTAS" banner at the top first — it lists what's drifted.
4. **`specs/ux-status.md`** — current design-debt backlog, prioritized into Tier-1/2/3. The sprint pulls from Tier-1.
5. **`specs/acnh-system-reference.md`** — **the world model.** ACNH's grid, level, autotile, placement, material and rendering rules, measured from the dump. David ruled 2026-07-26 that the world follows ACNH grid logic. Read before touching terrain, water, cliffs, roads or placement.
6. **`specs/asset-stack.md`** — tech architecture: R3F + Drei, 2D sprite chars, Colyseus deferred. **Its asset table is superseded** — see the banner at its top.
7. **Role-specific specs** in `specs/` — `ux-game-world-v2.md`, `ux-oracle-v2.md`, `ux-classes.md`, `ux-dashboard.md`, `ux-directory.md`, etc. Use the index in `specs/ux-status.md` §1 to find the right one.

Background on why the world model changed: `specs/investigation-2026-07-26-foundations.md` (the defects) and `specs/investigation-2026-07-26-systems.md` (how ACNH/Minecraft/Roblox solve them).

## Project vision (TL;DR)

- **Style:** 2D sprite characters in a 3D world (Dave the Diver, Octopath Traveler). PS1 shader + ACNH curved-world shader.
- **Map:** 2-3 screens wide. Buildings (HQ, Shop, Oracle Temple) you enter; objects (Bounty Board, Job Board) open overlays.
- **5-tier RBAC:** T1 David / T2 chapter presidents / T3 PMs+VPs / T4 directors+devs / T5 volunteers+general.
- **MBTI class system:** 4 main classes (Analyst/Diplomat/Sentinel/Explorer) + 16 subclasses, assigned via Oracle Temple quiz during onboarding.
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
1b. **Flat, full cliffs, and rare blended half steps** (David, 2026-07-30: "the
   half steps needs blending, and will be rarely used for island naturalness,
   otherwise keep everything either flat or with 1 unit high cliffs").

   | state | height | drawn as | share |
   |---|---|---|---|
   | flat | — | ground quad | ~80% of land |
   | full cliff, 2 levels | **1.5u** | the kit piece | 18.6% of land, 79% of relief |
   | half step, 1 level | **0.75u** | BLENDED by `heightField` | 0.9% of land, 21% of relief |

   `LEVEL_STEP = 0.75`, `CLIFF_LEVELS = 2`. A half step is **not geometry** — the
   blur in `heightField` crosses any drop under `CLIFF_LEVELS` and treats a full
   drop as a barrier, so soft-where-soft and sharp-where-the-kit-draws falls out
   of one function. An earlier pass built a vertical half-height face and drew it
   *into* the slope the field was already smoothing; don't reintroduce it.

   **`cellHeightRange` is load-bearing.** The field stores one height per cell
   CORNER, but a corner on a cliff boundary belongs to two cells that must
   disagree — the cliff top wants 1.5u, the ground below wants 0. The pinning
   pass resolves it for the cliff, which then drags the low cell's edge halfway
   up the wall (measured: 0.75 exactly). The mesh does not share vertices, so
   each cell clamps the field to its own reachable range, using the same barrier
   the blur does.

   **Authoring: `blob`'s taper is the trap.** `want = level <= taper ? level :
   t < 0.62 ? level : level - taper`, so `taper = 1` on a CLIFF blob resolves the
   outer 38% of the radius to level 1 — an L1 apron around every plateau, whose
   whole perimeter is a half step on both sides. That single argument was 74% of
   all relief. Pass `taper = CLIFF` so plateaus fill uniformly.

   Half steps come only from `SWELLS` in the authoring script: three rises of
   radius 4-5. A swell's PERIMETER is the half step, so the count scales with
   radius, not area.

   **Ramps cross full cliffs.** `Surface.Ramp` (8), stored at the LOWER level,
   direction derived from the neighbour one level up. `dropTo` reports a ramp as
   no drop and `sameLevelOrHigher` reports it as the same tier, so the cliff
   outline routes around the opening rather than sealing it. Auto-placed, and the
   check is reachability — currently 100% on 21 ramps. Without them, hard cliffs
   strand 22% of the island.
2. **One autotile vocabulary.** `{Kit}{Class}{Variant}_{Rotation}`; class 0-8 from the
   8 neighbours, A/B/C for diagonals, 0-3 pre-baked rotations. The same function drives
   cliff (44 pieces), river (45), waterfall (47) and road (20 per material).
3. **Each cliff level insets at least 1 tile** from the level below, and no two
   neighbours may differ by more than `CLIFF_LEVELS` — a face taller than one
   kit piece has nothing to draw it.
3b. **Mostly flat.** `CENTRE_FLAT` in the authoring script protects a 34-unit
   disc; `widen()` deletes one-cell-wide walls that `open(2)` misses because it
   filters by area.
4. **Waterfalls are derived, not placed.** A river cell bordering a lower level emits a
   Fall piece. Multi-step drops stack single-step pieces.
5. **Buildings, bridges and inclines have integer footprints and a 1-tile gap.**
   `house-chalet.glb` already measures exactly 5.00 x 4.21 cells. Bridges ship in 3/4/5
   tile lengths; inclines are 2x4.
6. **Seasons are a tint on greyscale albedo** (`_AlbGry`), with explicit `Snow`
   variants only where the pattern changes, not the colour.
7. **Shadows are baked into the assets** as `mShadow` meshes. No realtime shadow map.
8. **Animation is a separate model** (`*Anim` variants), swapped in, not always paid for.

Anything that needs a flatten zone, a blend radius, a slab disc, a bank ribbon or a
rock band to hide a seam is fighting this model. Fix the model instead of adding another
cover layer.

## Where to find things

| Topic | Location |
|-------|----------|
| Current sprint goal | `AGENT_LOG.md` → "Current Sprint" |
| Build/lint baseline + bug list | `specs/qa.md` |
| 3D game world component | `web/components/game/GameWorld.tsx` |
| **Terrain drafting tool** | `web/app/lab/map` — where the layout of every island gets planned. See below. |
| Player avatar + sprite sheet | `web/components/game/PlayerAvatar.tsx` |
| Dashboard pages (overlays) | `web/app/student/dashboard/*/page.tsx` |
| Supabase clients | `web/lib/supabase/{client,server,admin}.ts` |
| DB types | `web/lib/supabase/types.ts` |
| Migrations | `web/supabase/migrations/` (portal: 001_initial, 002-008; recruitment: 001_recruitment, 009-012 — separate trees) |
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
  David asks for that specifically. Ask him to draw it, or draw a proposal
  yourself in the editor and export it.
- The editor edits the SHIPPED `web/data/island-map.json` and exports the whole
  document to the clipboard. There is no write path to disk on purpose.
- **`author-elevation.mjs` overwrites hand edits.** Its output is also its own
  input, which is how 21 stale ramp cells accumulated in the shipped map. If you
  run it, expect to lose hand-drawn work.
- Named drafts live in the browser's localStorage, so they are per-machine.
  Anything worth keeping has to be exported into the repo.
- The health panel checks exactly what `web/lib/game/islandMap.test.ts` asserts:
  reachability, cliff-piece coverage, orphan ramps, one-cell walls, faces taller
  than the kit can draw. **If the panel says healthy, the paste keeps the suite
  green.** Keep those two in sync when adding a check to either.

## Design principles (set 2026-05-25)

These guide every scope and design decision. When trade-offs arise, choose the option that satisfies these. Confirmed by David.

1. **Community over productivity.** The portal is a 3D hangout, not a productivity tool. Bounties, jobs, leaderboards are features inside the hangout, not the engagement engine. When you have to pick: more social presence, less task throughput.
2. **The world must never feel empty.** AI NPCs always populate the world, scaling inversely with real-player count. Ghost-replay of recent member positions if multiplayer isn't on. No empty-world states ever ship.
3. **XP rewards IRL, TC rewards money-equivalent value.** XP comes only from in-person event attendance (QR check-in) and special admin grants. TC comes only from delivering monetary-value work (bounties, paid projects). **Never reward online activity** — no login streaks, no "visited a building" XP, no Habitica grinding.
4. **Cosmetic > functional class system.** MBTI classes and avatar customization are flair, not mechanics. Don't gate features behind class. Rich cosmetic + class identity is a late-game build (Phase 3+).
5. **Mobile-aware, always.** No feature ships that's fundamentally desktop-only. Mobile members may get a stripped "view + emote + chat" mode, but they must be able to *appear online* on their phone.
6. **Leaderboard: top half public, bottom half private.** Bottom-half members see only their own rank and anonymized neighbors. Privacy default.
7. **Senior members can mute the game-feel.** No mandatory quests for T1-T3. Onboarding quests are opt-in for everyone, skippable in one click.
8. **The world has a monthly content cadence.** Admins drop new NPCs, new shop items, seasonal palettes, new events monthly. The build must include admin tooling that makes this easy — never code-only content updates.

---

## Working rules

- `cd web && npm install` requires `--legacy-peer-deps` (`.npmrc` is configured).
- `npm run dev` may fall back to port 3001 if 3000 is taken.
- Game world uses `next/dynamic` with `ssr: false` — `BAILOUT_TO_CLIENT_SIDE_RENDERING` in SSR output is expected, not an error.
- Middleware gracefully handles missing Supabase env vars — dev works without `.env.local`.
- **Never** edit applied migrations. Add new ones (next slot: `013_*`).
- **Never** reveal the TC ≈ CAD conversion rate in user-facing strings.
- Build agents: when scope is unclear, ask reviewer (David) before guessing. Don't add features the spec doesn't list.

## Known foundational defects (measured 2026-07-26, not yet fixed)

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
- `web/app/student/apply/**`, `web/components/recruit/**`, `web/components/admin/**` — recruitment system (live in prod)
- `web/components/sections/**` — marketing homepage sections
- Migrations `001_recruitment.sql`, `009_*`, `010_*`, `011_*`, `012_*` — recruitment schema
