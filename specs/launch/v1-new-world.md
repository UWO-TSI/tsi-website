# v1 on the new world (row 318)

David, 2026-10-23: "i want v1 launch with the main new world". His drawing (`specs/references/terrain/terrainv1.png`) is a guideline for where things are, not a literal shape: "when you generated the terrain you took it too literarly and a lot of the terrrain are patchy because the art work wasnt the best".

- **Planning page:** the terrain is planned with David section by section on the World Terrain Plan page, https://claude.ai/artifact/J6fE1DjDqxt732R8JPvpxs. Read his answers with ArtifactData `list`, collection `sections`. Follow-up questions go into each document's `followups` array as `{q, a}`.
- **Fallback:** the village stays the fallback behind a world switch. Go/no-go is Oct 28.

## Gap analysis (Oct 23)

- **What works:** the smooth heightfield (384 x 552), the coast, the wharf quay, water, walking, glide, fishing on the client, building doors, spawn, Halloween, the campfire site finder, chat, emotes, friends and photo mode.
- **On the map today:** 9 landmarks, 11 lamps, 4 benches, 4 study tables and the spawn. There's no nature, and no resident anchors, gather spots, bug spots, houses, mailbox, boards or fitting room.
- **Hard blockers (code):**
  1. **Multiplayer bounds:** `OUTDOOR.half: 40` (protocol.ts:144). The wharf and plaza lie outside it, so players get kicked after 10 strikes. Widen the bounds and deploy realtime v7.
  2. **Server catch checks:** these validate against the old `village()` (rolls.ts:33–39), so every catch on the new world is refused. The server must load the new world.
  3. **The dashboard still loads the village** (villageMap.ts). Load the world behind an env switch, keeping the village as the fallback, and update groundGate.test.
- **Smaller code items:**
  - the editor names anchors `anchor-N`, but resident schedules need the fixed ids, so name them from the fixed list;
  - add `water_edge` bug spots to the editor;
  - an arrival route file for the new world, with a test that the crossing stays on water;
  - a walkability test that the closed zones are sealed;
  - move the oracle keeper off the summit;
  - crop the minimap to the open area;
  - shadows that follow the camera;
  - keep the title screen on the village;
  - perf on the populated world, including load time.
- **Data:**
  - the terrain rebuilt from David's section answers;
  - the named anchors, the mailbox, the boards, the fitting room, gather and bug spots, and village nature;
  - the barriers and the campfire.
  The layout is David's call; agents build from his answers, and he signs off on the result.
- **Estimate:** agents need about 7 to 9 working days of effort across 3 lanes. David needs 4 to 6 hours in the editor at minimum.
- **Smallest viable scope:**
  - the village core open;
  - the other zones sealed by terrain and barriers;
  - anchors only for the posted residents;
  - houses, the forest painting, rivers, the title restage and the look pass deferred.
