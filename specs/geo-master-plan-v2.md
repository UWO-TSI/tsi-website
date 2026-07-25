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

### Scale: +18%

Coast base radius 52 → 61 (R range 45..59 → 53..70). Everything in
coast-space scales with one constant, so sand/waterline/clamp thresholds
ride along; fixed placements re-solve numerically like the coast-v2 pass.
18% ≈ +39% walkable area — big enough to breathe, small enough that the
2-3-screen feel survives. Player speed stays; the loop road (below) keeps
traversal times flat.

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
- **⚠ ECONOMY FLAG for David:** *buying fish for TC* conflicts with
  principle #3 ("TC comes only from delivering monetary-value work — never
  reward online activity"). Options: **(a)** amend the principle for fish
  (TC trickle, capped daily); **(b)** fish sell for a separate cosmetic
  currency (Scales) spent only in the Wharf Shack; **(c)** no selling —
  the Shack COLLECTS species donations for badges/trophies (museum-style).
  My recommendation: **(b)** — keeps TC's meaning intact, gives fishing a
  full loop, and the Shack stays interesting. Awaiting the ruling; the
  store ships selling gear only until then.

### Terrain diversity

Temple bluff (cliff system, David-ruled next rock), rolling meadow west,
wetland pocket at the east mouth (rushes/mud ground zone), cove dunes,
islet knoll. Verticality north, wetness east, softness west.

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
