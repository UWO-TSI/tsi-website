# Island Geography Master Plan v2 (2026-07-25)

> David's geo review verdicts + my design response. Companion concept map:
> published artifact "TSI Island v2 — Master Plan". Implementation is staged
> (S1-S7 below); nothing lands without passing gates, and the fish-economy
> question is flagged for David before the store ships.

## David's verdicts (2026-07-25)

1. Island too small/cramped → **+15-20% overall size**.
2. Path structure needs work → I design a logical, efficient village
   network hitting every major building.
3. Map the game's important sections — fishing areas + a **fishing store**
   (buys fish, sells rods/accessories).
4. More diverse terrain; a **far-off islet reachable by boat**.
5. Areas must be **distinct yet cohesive**.
6. Furniture: use simple logical chairs/tables per house for now; fix the
   untextured (clay) look before real placement.

## My design response

### Scale: +18% — WITH a coast-character pass (David 2026-07-25)

Coast base radius 52 → 61 (R range 45..59 → 53..70). Everything in
coast-space scales with one constant, so sand/waterline/clamp thresholds
ride along; fixed placements re-solve numerically like the coast-v2 pass.
18% ≈ +39% walkable area — big enough to breathe, small enough that the
2-3-screen feel survives.

**David's shape note (from the concept-map review): no perfect-oval feel —
natural inconsistency.** S1 therefore also amps the harmonic character:
stronger asymmetric harmonics (deeper bays, bolder headlands, one new
narrow inlet on the NW), so the bigger island reads MORE irregular, not
just larger. The concept map's oval was schematic shorthand only — the
shipped coast is and stays organic.

### Districts — distinct but cohesive (one palette, seven moods)

| District | Where | Identity anchor | Ground |
|---|---|---|---|
| **Village Core** | center-south (existing plaza) | HQ, fountain, market, brick plaza | brick/soil |
| **Riverside Wharf** | east river mouth | **NEW fishing store**, boat dock, fish market feel | wood decking |
| **West Green** | west (shop + windmill) | commerce/craft, orchard rows | soil/grass |
| **Temple Rise** | north (oracle + bamboo) | **BLUFF via the cliff system** — temple gains elevation, stairs up | stone steps |
| **Beach Cove** | SE (existing) | leisure: camp, parasols, shallow swimming | sand |
| **Lighthouse Point** | NE (existing) | scenic coastal walk, quiet | grass/rock |
| **Isla Chica (islet)** | ~28u offshore SE | boat-only; rare fishing grounds, picnic knoll; future Sea-King waters | sand/wild grass |

Cohesion comes from ONE pastel grade + shared kit vocabulary; distinction
comes from ground material, density, and one signature prop per district.

### Path network v2 — loop + spine (replaces the cross)

- **The Loop** (primary, stone→brick at the plaza): an oval ring road
  hitting Plaza → Riverside Wharf → House → Beach-spur junction →
  West Green (Shop, Windmill) → back to Plaza. Every major building is ON
  the loop or one junction off it. Loops beat crosses: no backtracking,
  constant discovery, natural jogging circuit.
- **North Spine**: Plaza → main bridge → Temple stairs. A SECOND river
  crossing at the wharf (east bridge) closes the loop across the river.
- **Scenic spurs** (soil/sand, deliberately dead-end): Lighthouse coastal
  walk, Cove sand spur (existing), orchard path. Dead-ends are only for
  destinations that reward the walk.
- Rule: primary loop width 2 tiles, spurs 1 tile — hierarchy readable at a
  glance and on the minimap.

### Fishing, mapped

- **Prime spots become places**: river bend cluster (2 spots + rushes),
  wharf pier (sea spots), cove sand cast (existing), islet grounds (rare
  pool, boat-only).
- **Fishing store ("The Wharf Shack")** at Riverside Wharf: enterable,
  sells rods/accessories (TC sink — clean), displays trophy catches.
- **ECONOMY RULED (David 2026-07-25):** currencies invert — **Gems** take the money-equivalent tier, **TC** becomes the play currency the Shack pays for fish. Full design: specs/economy-v2-currencies.md (E1-E4).

### River v3 — bend like a river, breathe like a river (David 2026-07-25)

The river keeps its spline bends but gains **natural width variation**:
narrows (~2.5u) at fast stretches, widens (~7u) into a slow **bend pool**
mid-island — the pool is a marquee river fishing hole (2 spots, rushes,
fish shadows cluster there). Width function rides the spline t the same
way the bank walls do; bridges sit at narrows.

### Terrain diversity

**Temple on a hill — confirmed as ruled**: Temple Rise bluff via the cliff
system (S6), stairs up, the temple silhouette gains skyline presence.
Rolling meadow west, wetland pocket at the east mouth (rushes/mud ground
zone), cove dunes, islet knoll. Verticality north, wetness east, softness
west.

### The Flats — MAJOR sand fishing area (David 2026-07-25)

Beach Cove's south shore expands into **The Flats**: a broad low-tide sand
flat with 3-4 sea casting spots, tide pools (shore-critter density up),
wet-sand sheen, and a bait shack lean-to later. This is the island's
signature sand fishery — the cove keeps its leisure camp identity beside
it, distinct but adjoining.

### Boat travel

Rowboat at the wharf dock → fade transition (LoadGate reuse) → islet.
One interaction, no new movement system. Later: the boat becomes the
Sea-King charter when David's models land.

## Implementation stages (each gated, multi-wake)

- **S1** Coast +18% + threshold/placement re-solve (solver rerun) + minimap.
- **S2** Path network v2 (RoadTiles rect rebuild + corridors + minimap).
- **S3** Riverside Wharf district (dock decking, east bridge, store shell).
- **S4** Wharf Shack interior + gear shop (fish-buy awaits economy ruling).
- **S5** Islet + boat travel.
- **S6** Temple Rise cliffs (the ruled big rock — S1/S2 first so cliffs cut
  into the FINAL coast).
- **S7** Wetland pocket + meadow pass.

## Furniture direction (recorded)

Interim ruling: furnish with SIMPLE, logical chairs/tables per building.
Prerequisite work item: **furniture texture pipeline** — dump albedos are
gray recolor bases; placed pieces need the LUT/tint treatment (extend
lumNormalizeMats or apply ReBody textures) so in-game furniture reads
colored, not clay. Ships before the first real room build.
