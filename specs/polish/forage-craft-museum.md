# Polish: foraging, crafting, museum and shop

Audit: `audit-activities.md` (bugs, tree shake, flowers/rocks, digging, puddles, fireflies, workbench, bottle, selling, shop, museum, collection book, trophies, glider) and its specs 1 and 3; `audit-ui-flows.md` spec C (shop door). Paths under `web/components/game/` unless noted. The standard is in `README.md`. Needs the particle pack (`specs/movement-feel.md`); comes after `interiors.md`, whose shop keeper it uses.

## Problems
- **Rewards are text-only.** Bugs and forage get no catch card: `tsi:peaceful-got` is dispatched but nothing listens (`peaceful/VillageLife.tsx:114`). Toasts carry no icon (`:112-113`). The craft card has no item art.
- **Tree shake:** the `Forage` clip plays but the tree doesn't move and nothing falls. The branch is never drawn (`VillageLife.tsx:56`).
- **Primitives:**
  - fruit spheres (`:54`), dodecahedron rocks (`:61`), an icosahedron flower fallback (`:63`), a circle for dig spots (`:59`);
  - the petal burst (`FlowerPickFX.tsx`) is mounted only on the applicant island.
- **Digging:** no hole, no sand; the item just vanishes.
- **Timing:** a node is removed before the clip lands or the server answers (`VillageLife.tsx:102`).
- **Puddles:** flat tinted discs that nothing reacts to (`IslandAtmosphere.tsx:98`).
- **Fireflies:** each one is its own GLB, sprite and `useFrame` (`AmbientLife.tsx:21-58`), and `fireflyOffset` allocates 3 arrays per firefly per frame (`lib/game/fireflyPath.ts:16-17`).
- **Workbench:** press Craft, hear `confirm`, read "It's in your pockets." (`crafting/Workshop.tsx:134-152`). There's no in-world moment, and the bottle vanishes on E (`:72`).
- **Glider:** no unlock moment and no guided first glide.
- **Museum:**
  - A sheet with a curator line, no sound, no animation (`peaceful/DonateSheet.tsx:47`).
  - Nothing reaches the case.
  - The trophies are a list (`peaceful/ShowcaseSheets.tsx:25-37`) with no physical trophy case.
- **Shop and selling:** not in the world. The shop building has no door prompt (DIW:120-130, 144). `ShopInterior.tsx` is only used in `/lab/interior`, and `SellBody` only on a portal page.
- **The `VillageLife` act effect** has no deps array, so it re-subscribes every render (`:95-119`).

## Deliverable, in order (a commit each)
1. **A shared reward card** for bugs, forage, digging, crafting and bottles: the item's art (model render or icon), its name, rarity and size, a soft pop-in and a sound. It listens to `tsi:peaceful-got`; toasts get icons.
2. **Tree shake:** the tree wobbles (vertex sway or bone), leaf bits fall (particle pack), and fruit or a branch drops and rolls to rest. You pick it up with a pickup clip at its contact frame.
3. **Models replace the primitives:** fruit, rocks (with a strike puff and chips), flowers (the petal burst mounted in the village), and a dig spot with a crack decal. Made in Blender, matte.
4. **Digging:** a sand burst, a hole decal that fills back in over time, and the item rising out. Remove the node at the clip's contact frame, never on the key press.
5. **Puddles:** rain rings on them, a splash when stepped in. **Fireflies:** one instanced system, no per-frame allocation.
6. **Crafting moment:**
   - A `Craft` clip at the bench, hammering puffs and a final sparkle (particle pack).
   - The result card with the item's art.
   - The bottle uncorks with a scroll unrolling to reveal the recipe.
7. **Glider unlock:** a card on first craft, then a short guided first glide (a hint at the nearest cliff, a target ring painted from the particle pack on the landing spot).
8. **Museum:**
   - Donating plays the curator's reaction and fades the specimen into its case or tank.
   - Aquarium fish swim.
   - A trophy case in the HQ that shows the player's trophies in 3D.
9. **The shop in the world:**
   - The shop door enters `ShopInterior.tsx`, restyled: the counter, the shopkeeper resident from `interiors.md`, buy and sell at the counter.
   - Selling counts the coins up with a clink.
   - Shop tiles show the items' real art.
   - Delete the shop panel duplicates the world no longer needs.
10. **Fix the `VillageLife` effect deps** and any per-frame allocations you touch.

## Sounds
Wire what exists; list the missing ones in the questions file: leaf rustle, fruit thud, rock clink, shovel scrape, pickup pop, cork, paper unroll, hammering, craft jingle, coin clink, museum chime. Never a dialogue blip for an effect.

## Evidence
`specs/evidence/polish-forage/`: a frame strip of each activity before and after, the reward card per type, the shop counter, the museum donation.
