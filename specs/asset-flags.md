# Dump Asset Flags — water/ocean + land sweep (2026-07-14)

> David's directive: "go through the asset pack and flag any assets that can
> potentially be used and then use those in the project." This is the flag
> catalog from the full `~/Downloads/GLB` (2.2GB) sweep, water/land focused.
> Status legend: **USED** already shipped · **SHIPPING** this batch ·
> **FLAG** viable, queued · **SKIP** inspected, not worth it (reason given).

## Terrain/ (233 entries — the water/land motherlode)

| Asset | What it is | Status |
|---|---|---|
| `unit-road-soil`, `unit-road-stone` | marching-squares road kits | USED (RoadTiles) |
| `unit-road-sand` | same kit, sand | **SHIPPING** — beach spur path |
| `unit-road-wood` | same kit, boardwalk planks | **SHIPPING** — beach deck pad |
| `unit-road-brick`, `-tile`, `-fan-pattern`, `-dark-soil`, `-my-design` | more road materials | FLAG — brick around fountain is the next candidate |
| `stone-a..e` | the 5 classic ACNH rocks, textured, 120 verts each | **SHIPPING** — land rock field + shallow-water outcrops |
| `buoy-main/`, `buoy-kappei/` | buoy float + **6 rope-span pieces** | **SHIPPING** — rope chains (deferred item unlocked) |
| `buoy-mystery/`, `buoy-wherearen/` | same mesh, alt textures | SKIP — no visual gain at our draw distance |
| `water-model/main.glb` | caustic mask carrier | USED (ocean/river caustics) |
| `water-model/sea-water-model.glb` | 128px sea **sparkle glint** sprite | FLAG — drifting glint sprites on ocean, cheap win later |
| `unit-fall` | waterfall kit | USED (river mouths) |
| `unit-river` | full riverbed kit (bed+walls, road-kit layout) | FLAG — river v2 rebuild, medium job, queued behind David's water verdict |
| `unit-cliff` | full cliff kit (45 pieces) | FLAG — needs real elevation terrain; Phase-2 material |
| `out-sea-{n,s,e,w,ne,nw,se,sw}-00..08` | ACNH's actual surrounding-sea slabs, 320×160u each | SKIP — terrain-system scale, replaces our whole ocean; David cut distant clutter |
| `out-*-stone/cliff/island/garden/river/harbor/ship` (150+ slabs) | vista surround terrain | SKIP — same reason (his "clear the distance" ruling) |
| `out-n-ship-00..02` | distant cargo ship mesh | FLAG — single silhouette at sea IF David wants horizon life back |
| `distant-view-*.glb` | vista isle cards | USED then CUT by David — do not re-add |
| `proc-grass` | grass tufts | USED (GrassTufts) |
| `snow-ball-*` | snowballs | FLAG — winter palette month |
| `env-map*.glb`, `ui-bridge`, `ui-slope` | engine internals | SKIP |

## Plants/ (53)

| Asset | Status |
|---|---|
| hardwood/cedar/blossom trees, azalea/holly/hydrangea bushes, 7 flowers | USED |
| `palm-tree-3/4` (textured, growth stages) | **SHIPPING** — beach cove palms |
| `hibiscus-bush-4` | **SHIPPING** — tropical accent at cove |
| `bamboo` | FLAG — a grove behind the Oracle would suit it |
| `camellia/osmanthus/plumeria-bush`, `gold-rose`, remaining flowers | FLAG — palette-month variety |
| `*-snow` variants of everything | FLAG — winter month swap (pairs with seasonal palettes) |
| crops (pumpkin/tomato/etc), `crop-soil` | FLAG — community garden feature if ever wanted |

## Fences/ (33 styles)

| Asset | Status |
|---|---|
| `country-fence` a/b/i, `log-fence` | USED |
| `rope-fence` (textured, coastal) | **SHIPPING** — lines the beach spur |
| `park-fence` | FLAG — plaza garden beds |
| `hedge` | FLAG — nice around HQ; hedge-snow exists for winter |
| spooky/easter/june-bride etc | FLAG — event-month drops (principle #8) |

## Furniture/ (2796) — beach subset flagged this sweep

| Asset | Status |
|---|---|
| `beachparasol`, `beachtowel`, `beachball` | **SHIPPING** — the cove camp |
| `beachbed` | FLAG — second cove spot later |
| `shell-*` set (arch/fountain/lamp/bed) | FLAG — mermaid/shell theming month |
| `palmtreelamp` | FLAG — cove night lighting v2 |
| (interior sets) | USED selectively (HQ/Shop/Oracle rooms) |

## Misc/ (10)

`cloud-vr`, `vr-moon`, `sys-sun*` — SKIP while David's AI sky art is pending
(sky dome contract already live).

## Events/ (82)

Garlands USED (seasonal). `plaza-deco-*` stalls, `fish-tent`/`insect-tent`,
`countdown-board` — FLAG: monthly-event props, exactly what principle #8's
admin drops want. `campfire` USED.

## Characters/ (1216) / Clothing/ (2095) / Creatures/ (278) / Tools/ (373) / Buildings/ (777) / Interiors/ (516)

- Creatures: USED (13 bugs + 10 fish + critters). Museum variants FLAG for a
  museum interior someday.
- Tools: net/rod USED. `beach-umbrella` overlaps beachparasol — SKIP.
- Buildings: door/roof/exterior swatches — FLAG for building-variety pass.
- Characters: 2D-sprite direction locked (Nano Banana) — SKIP for players;
  FLAG as possible 3D NPC villagers if David ever wants them.
- Clothing/Interiors: Phase-2+ (avatar/room customization).

## This batch ("Beach Cove") — what ships now

South-east shore destination, all dump assets: sand path spur off the south
spine → rope-fence lined → wood boardwalk pad → parasol/towel/beachball camp,
5 palms + hibiscus on the sand band, rock outcrops in the shallows, the
classic 5-rock field in the NE grass, and buoy rope-chains offshore.
