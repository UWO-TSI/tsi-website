# Remodel inventory: old and dump models the new world still draws (2026-10-27)

How it was counted: a headless census of the new world (`tools/census.mjs`: `/lab/island?fixture=v2`, dev server with
`NEXT_PUBLIC_GAME_WORLD=new`, eight stops by day and three by night). It logs every GLB the page fetches and counts the
main scene's meshes by primitive signature (`tools/glb-stats.mjs`), so "instances" is what the scene held at the busiest
stop, and "nearest" is how close the nearest one came to the player at any stop. Triangles and textures are read from
each GLB. The code paths that pick each model by id are traced in the last column.

55 GLBs outside our own `assets/game/` load in the new world; 49 are from the ACNH dump. Everything else drawn is ours.

## Ranked by how much a player sees them

| # | Model (file) | Instances, nearest | Tris | Textures | Where it comes from | Plan tonight |
|---|---|---|---|---|---|---|
| 1 | Tree fruit: `acnh/fruit/{apple,peach,pear,orange,coconut}.glb` | 116 (peach 40, apple 30, pear 25, orange 20, coconut 1), 2.9 | 410 to 594 | 128 px | `lib/game/treeFruit.ts` FRUIT_MODEL | **Kept.** David, Oct 17 (`specs/art-direction-oct17.md`): "old fruits are way better, it has soul". Not touched. |
| 2 | Butterflies: `acnh/critters/{peacock,emperor,common,monarch,agrias,tiger}-butterfly.glb` | 50 (peacock 28, emperor 18), 3 | 770 to 824 | 128 to 256 px | `lib/game/ambientFauna.ts` FLYERS, `components/game/Critters.tsx` SPECIES (catchable) | **Remodel** (6) |
| 3 | Fireflies: `acnh/critters/firefly.glb` | 64 at night, 3.5 | 610 | 128 px | `components/game/AmbientLife.tsx`, Critters SPECIES | Later if time: drawn about 0.04 across under a glow sprite |
| 4 | Crabs: `acnh/props/crab-gazami.glb`, `crab-hermit.glb` | 28 on the beach, 12.4 | 926, 802 | 256 px | ambientFauna CRAB_MODELS, Critters SPECIES (catchable) | **Remodel** (2) |
| 5 | Market barrel: `acnh/furniture/barrel.glb` | 10 at the market, 2.5 | 1196 | 256 px | `lib/game/propModels.ts` SCENERY_URLS `barrel` | **Remodel** |
| 6 | Market cart: `acnh/props/market-cart.glb` (the countdown stall) | 4 at the market, 4.7 | 1506 (only a third draws: two of its four meshes are empty, the collision lane) | 256 px | propUrl fallback `acnh/props/<model>` | **Remodel, first** (coordinator) |
| 7 | Fish, all 81 species: `acnh/fish/*.glb` | the catch on the angler, the tank fish, 3 ambient species (2 each, 9.9) | 300 to 2000 (818 average), rigged | 128 to 512 px, base + normal | `lib/game/fishing.ts`, `fishCatalog.ts`, ambientFauna FISH_MODELS | **Tweak** (David: "tweak the fish models we have") |
| 8 | Village buildings: `acnh/buildings/` chalet walls, roofs and doors (the 8 houses), `hq-office`, `shop-market`, `oracle-museum` | 1 draw each (merged), 3.2 | 768 to 9395 per part | 512 px | `components/game/ACNHBuilding.tsx` | Not tonight: buildings are big jobs with their own lanes (hq-interior) |
| 9 | Lighthouse: `acnh/furniture/lighthouse.glb` | 1, the islet off the wharf, seen from the wharf | 4735 | none (flat red) | SCENERY_URLS `lighthouse` | **Remodel** |
| 10 | Gather rocks: `acnh/props/rock-{a,b,c}.glb` | 5 nodes, 10 | 146 to 214 | 256 px | `components/game/peaceful/VillageLife.tsx` rock nodes, `lib/game/rocks.ts` | **Remodel** (one shared look, three shapes) |
| 11 | Monument rope fence: `acnh/props/fence-rope-a.glb` | 4 round the monument, 7.5 | 696 | 256 px | `components/game/DefaultIslandWorld.tsx` monument | **Remodel** |
| 12 | Arrival boat: `acnh/props/boat.glb` | 1 at the wharf, 5.9 | 3950 | 256 px | `lib/game/wharf.ts` BOAT | Not tonight: the opening's boat (a big job, the arrival lane) |
| 13 | Dragonflies: `acnh/critters/{red,darner}-dragonfly.glb` | 6 (red), 25 | 360, 778 | 256 px | ambientFauna FLYERS, Critters SPECIES | **Remodel** (2) |
| 14 | Catchable crawlers: `acnh/critters/{ladybug,brown-cicada,mantis,grasshopper}.glb` | spawn near the player only (0 at the stops) | 504 to 1006 | 128 to 256 px | Critters SPECIES | Later if time |
| 15 | Seagull: `fauna/seagull.glb` (CC-BY, not the dump) | 4, 17.3 | 2268 | 512 px | `components/game/Seagulls.tsx` | Not tonight (licensed, not dump) |

Fetched but not drawn in the new world (preloads; nothing to remodel for players): `acnh/critters/{ladybug,mantis,
grasshopper,brown-cicada}` until one spawns, `acnh/furniture/museum-{case,stand,tank}`, `acnh/plants/stump`,
`acnh/props/{bench-park,fence-country-a,fence-log-a,fountain,park-clock,stone-lantern}`, `nature/grass-tufts`.

Our own older pieces the 2026-10-14 audit flagged as "completely low poly" (`specs/asset-audit`, in git at 8df7ded2): the
forest edge (2 in the new world), the rockslide (1). Not tonight: barriers, not props.

## Order of work

market cart, market barrel, butterflies, crabs, lighthouse, the fish, dragonflies, gather rocks, the rope fence; then the
firefly and the crawlers if the night allows.
