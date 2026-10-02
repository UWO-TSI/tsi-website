# World refinement: questions for David (row 284)

Each question names the assumption I built on. Evidence: `specs/evidence/world-refinement/`.

## Trees
1. **Cut-out leaves.** ACNH's leaf masks (`_OP`) are now wired, so the cards read as leaf clusters instead of solid hexagons. A cut-out crown shows its own depth, and the screen-space AO darkened it. To compensate, I lifted the oak's leaf texture by 1.22, so the lit side is as orange as before and the shade side is darker. *Assumed:* keep the cut-outs (`01-trees-four-sides.webp`). Going back to solid cards on the closed crowns is a one-line change in `web/scripts/finish-trees.mjs`.
2. **Crown size.** The oaks and the cherry close into ACNH's three lobes plus a ring of two more low lobes. The crowns are now about 2.0-2.7 deep; they were about 1.45 deep, only the front shell. Nothing you placed collides in the shots. *Assumed:* this is fine. The painter's placements may want a look.
3. **Turn.** I dropped the camera-facing half-turn and kept the small seeded turn (±16°). *Assumed:* the literal reading of the spec. A full seeded turn per tree is one line in `lib/game/natureParts.ts` `treeYaw`.
4. **Snow cedar.** ACNH draws the winter fir's top tier and the snow on its back as one snow layer, which our extract drops. That is why the tree had no top and a hollow back. It is back as a matte white snow cap, without ACNH's snow normal map. *Assumed:* plain matte snow. Should it get some texture?
5. **The plain cedar** was already closed from every side, so it is unchanged.

## Fruit
6. **Models.** I used ACNH's own fruit: the dump's UnitIconPltFruit apple, cherry, coconut, orange, peach and pear, the same licence path as the trees. Separately, the game-ui agent is building our own matte fruit for the held item (`art/props-enemies/build_items.py`, uncommitted on `game/game-ui`). *Question:* should one set be used both on the tree and in the hand? Blackberries and blueberries have no node that grows them yet.
7. **How many.** Each tree carries 6-7 fruit: ACNH's three on the front, the same three on the back, and one or two on the ringed lobes. That puts about three in view from any side. ACNH shows three. *Assumed:* full from every side.
8. **The shake itself** (the tree wobbling, leaf bits falling) is still the forage spec's. Fruit already drops from where it hung.

## Birds and glows
9. **Gulls far out.** The gulls now circle 35 units off each side of the island, about 16 past the furthest point the camera can reach at Z zoom. Looking out to sea they read as small far gulls; up close they appear only when they land. The scroll-wheel zoom goes further out (1.6). At the lowest tilt, standing on the shore and facing inland, the camera can still come within a couple of units of a circle's edge. *Assumed:* that edge case is acceptable.
10. **Perches.** Gulls land on the lamp tops, the HQ's spire, the shop's sign and the water off each shore. *Question:* add more roofs, the wharf posts or the chalets? Each spot needs its measured top.
11. **Butterfly size.** Ambient butterflies are 0.25 across. The catchable ones are 0.3, so you can still spot them to catch. *Assumed:* that small difference is wanted.
12. **Evidence gap.** I could not reliably frame a fleeing bug in-game with the harness (where a bug appears depends on the hourly roll). The calmer escape is plotted (`05-fauna-and-glows.webp`) and tested in `lib/game/bugFlee.test.ts`. A hand check is worth doing.

## HUD
13. **The "?" on the key bar.** The bar shows its first six keys. Pointing at it, or tabbing into it, shows them all. This is CSS only, because game/game-ui is editing the same JSX lines. *Question:* should it be a click toggle or the ? key? That means editing those lines after the merge.
14. **"Click to look around"** now sits on the canvas at 30% of the height, over the scene's middle. *Assumed:* that is clear of everything at every size checked.

## Merge notes for the coordinator
- `game/game-ui` touches some of the same files:
  - `DefaultIslandWorld.tsx`: I changed the PeacefulLayer `treeModels` prop, the gull perches in `villageLayout`, the TouchControls line and the defaultIsland import.
  - `VillageLife.tsx`: I left the bug target label line and `harvestNode` alone.
  - `FishingOverlay.tsx`: my change is the root `div`'s `bottom` and a data marker; theirs is the cast line.
  - The bottom-stack CSS block in `DefaultIslandWorld.module.css`.
- The HUD variables are the place for the clean HUD to hook in:
  - `--hud-bar`, `--hud-lane-bottom` and `--game-toast-bottom`;
  - `--hud-side-bottom` and `--hud-edge`;
  - `--hud-stick-left` and `--hud-stick-bottom`.
