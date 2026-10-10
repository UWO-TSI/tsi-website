# Terrain v2: the world island

> The plan for the map that replaces the live 64x64 member island. Agreed with
> David 2026-10-10 in planning session. Read with `specs/island-painter.md`
> (tooling) and `specs/ux-game-world-v2.md` (world vision). Supersedes the
> island-painter ruling "David makes the island" for this map: his drawing
> (`specs/references/terrain/terrainv1.png`) set placement and overall shape,
> and he instructed agents to develop it for the game's aesthetics (2026-10-09).

## Vision

A fishing village world. The wharf is the entrance to the village; the village
is organic with a central plaza, HQ and the important buildings radiating off
it, residents in their own small houses, and its daily life is CHILL STUDY
(study tables, cafe, calm anchors). East, an exaggerated terraced mountain
(level 8, the cap) with a waterfall from the peak; the ORACLE TEMPLE sits on
the summit plateau, so the carved trail is the pilgrimage to your class.
North over a bay, open plains. Southeast, forest with ruins scenery. West, an
archipelago for future boat trips. The ground rolls: non-extreme height
differences taper into slopes; only the mountain (and coastal banks the
drawing demands) read as cliffs.

## Zone purposes

Set (David 2026-10-10): village = chill study and social heart; summit =
Oracle Temple (class quiz); wharf = fishing entrance; islets = boat trips
later. OPEN: where combat lives. David is weighing the north island over the
bridges vs the forest ruins ("still need to think what each section would be
for"). Both stay combat-capable terrain until he calls it; nothing in P0-P2
depends on the answer.

## Decisions (David, 2026-10-09/10)

| Topic | Decision |
|---|---|
| Destiny | Replaces the live member island (village-map.json). The old 64x64 retires. |
| Swap timing | As soon as terrain + village + residents + fishing pass gates. Later phases land on main in small merges. Prod stays safe behind the opening-soon gate. |
| Scale | 384x552 cells, ~52k land (link: generator). Locked for feel; perf work makes it shippable, not shrinking it. |
| Heights | MAX_LEVEL raised 6 -> 8 engine-wide (grid.ts). Mountain tiers 2/4/6/8, 2-level kit cliffs, carved west trail to the summit, peak waterfall into a tier-2 pond. |
| Ground | Rolling value-noise swells to level 2 off-mountain, tapered to 1-level steps (David: "if its not a extreme height difference it will taper off as a slope"). |
| Village | Organic, central plaza, HQ + main buildings radiating; mainly chill study. Wharf connected as the village entrance: planks, boat dock, small click ladder down to the water, lamp posts for vibes. Claude proposes the full layout; David reviews top-down in the painter before anything is wired. |
| Oracle Temple | On the mountain summit plateau, reached by the carved trail. Leaves the village ring. Class quiz happens at the top. |
| Resident houses | Yes. Small homes around the village so each resident lives somewhere. Needs house models + a home landmark/object design + resident home re-wiring. |
| Rivers | A river system from the mountain through the island to the sea, with bridge crossings. Adds river fishing water. |
| Ruins | Scenery only this pass: ruined props in the SE forest, no gate, no combat hook yet. Candidate combat home (see Zone purposes). |
| Cave | Mouth on the NW cliff face, sealed by rocks for now. Interior is a later scene. |
| Plains | Open ground over the bay, shaped to stay combat-capable. Candidate combat home (see Zone purposes). |
| Islets | Scenery now, boat trips later. Each islet holds playable ground (>= 150 cells). |

## Phases and gates

Every phase merges to main on its own short branch, gated by: draft tests
(`web/lib/game/fixtures/terrainV2Draft.test.ts`), the affected system suites,
tsc, lint ceiling, build.

- **P0 Terrain lock.** David walks the current draft (`/lab/island?fixture=v2`)
  and signs off heights, falls, rolling feel, bay/neck shape. Exit: his notes
  applied, draft constants frozen.
- **P1 Village + wharf proposal.** Full layout on the real terrain: plaza,
  radiating paths, HQ/Shop/Cafe/Museum, resident houses, study spots, wharf
  planks + dock + ladder + lamps, spawn. The Oracle is NOT in the village: its
  temple site is staked on the summit plateau in the same proposal. Delivered
  as a painter-reviewable document. Exit: David approves the top-down.
- **P2 Village wiring.** Landmarks (doors, interiors), resident homes/anchors/
  schedules, benches/lamps as objects, fishing spots, missions/study/gather
  anchors. Exit: residents live a full day on the new map; all system tests green.
- **P3 Rivers + mountain polish.** River routing to the coast with bridges,
  stone surfacing on cliffs, sealed cave mouth, falls tuning, beach taper.
- **P4 Forest, ruins scenery, plains, islets.** Tree/bush/rock passes by zone
  density, ruined props SE, combat-ready clearings north, islet dressing.
- **P5 Ship.** Performance pass (load time at 384x552: chunk streaming or
  merged geometry; target: comparable feel to today's island load), then
  village-map.json swap + migration checklist. Old island retired.

## Migration checklist (P5)

- Ruins gate landmark needs a home or combat is unreachable (ruins zone is
  scenery-only by decision; gate placement TBD with David).
- Fishing: classifyWater re-verified (sea/bay/ponds/rivers all classify as
  intended; the strait is a BAY, open west, dead-end east, per the drawing).
- Residents: all schedules resolve on the new map; no spawn-cluster fallback.
- Gulls/shore, puddles, bugs, shells, bottles: re-seeded for the new coasts.
- Painter: the new map becomes the painter's shipped base; health suite green.
- Load/perf measured on David's machine, not headless.

## Working rules

- The generator (`art/terrain/draft_from_png.py`) is the terrain source of
  truth until P2; iterate constants, never hand-edit the JSON.
- Draft tests guard invariants (climbable summit, flat plains zone, playable
  islets, waterfall + pond, legal levels). Add a test with every new invariant.
- Residents must never crash on a partial map (residentRoutine guards, fixed
  2026-10-09). Any new system must tolerate a map missing its objects.
