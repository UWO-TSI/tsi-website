# Movement tech: questions (build agent, 2026-09-28)

Each has the assumption the build took; none blocked. Tune the numbers in `/lab/move` and paste Copy JSON back.

1. **Sprint speed.** Today's sprint is an instant 13.69 u/s. The kit's sprint builds from walk (7.4, unchanged) to 12 over 0.9 s, and three timed hops reach 14.5 u/s, so skill travels a little faster than today and plain Shift a little slower. The river gaps only mean something at these speeds (a walking jump clears 2 tiles, a long jump 3, a chained long jump, dash-jump or air dash 4). The "Today's walk" preset puts the old instant 13.69 back for comparison. Keep 12?
2. **Falling short of a river.** Water stays a wall on foot; a jump that comes down in water splashes and puts you back on the last dry spot you stood on after 0.55 s. Never damage. A jump that just misses a bank or ledge by up to 0.3u lands on it instead.
3. **Ruins controls before integration.** Q (the dash key) dodges in the ruins now with today's i-frames and cooldown; weapon swap moved from Q to R (a swap saved on Q falls back to R). Space still dodges there until the kit replaces the ruins controller; then Space jumps (the row 49 change the coordinator flagged).
4. **Menu keys can still take Q or C.** `lib/identity/settings.ts` `RESERVED_KEYS` does not list them; adding them belongs with integration, when Q dashes in the village.
5. **Movement remap lives in the lab for now** (panel, this device, `tsi.moveKeys.v1`). The Settings sheet row lands with integration; before then it would do nothing in the village.
6. **Walking off edges.** You can walk (not just run) off a cliff at any speed, including while sneaking. ACNH never lets you. If sneaking should stop at edges, it is one rule.
7. **The `canStep` ramp gap.** The shipped village has no cliffs or ramps any more, and free, carved, one- and two-cell test ramps all walk end to end under the old walker. The defect found was the reverse: from the upper half of a carved ramp you could step 0.45u sideways onto the plateau. The sim decides by height (a rise over 0.3u is a wall, a drop is a fall), which fixes both; `canStep` itself is left as is and goes away at integration.
8. **Long jump is automatic** at 92% of sprint speed or more (no extra key), and a dash-jump uses its flatter arc while carrying the dash speed.
9. **Props are hop-able.** Rocks (0.52 to 0.61u), benches (0.51u) and fence rails (0.7u) have their measured tops: a jump clears them and you can land or mantle onto the rocks and bench. Buildings, trunks and study furniture are walls of any height.
10. **Not ported to the lab:** today's sprint wind streaks, surface footstep sounds (bridge knock, brick tap) and wet-step ripples. They stay in `PlayerAvatar` and carry over at integration.

## Refine pass (build agent, 2026-09-29)

None blocked; each has the assumption the build took.

11. **Bunny-hop only while sprinting.** Holding Space at a walk lands and stays down; a quick re-press just before landing is a plain buffered jump that keeps your speed but adds none. The cap went from 14.5 to 14.8 u/s (0.7 per hop instead of 0.6) so each hop is felt; still under 1.25× sprint.
12. **One top speed.** A dash-jump now carries at most the bunny-hop top (14.8 u/s). Before, it carried the dash's 14 and a burst start could have carried 18.
13. **Dash cooldown 0.5 s** (was 0.45), counted from the press, now that the ring shows it. The facing snaps to the dash direction at once rather than turning over ~70 ms.
14. **Air dash arc.** It floats up 0.2u and eases to an apex before the fall, rather than holding dead level; a ground dash that runs off an edge still holds level. "First cut" in the dash presets is the old flat dash for comparison.
15. **Camera is lab-only for now.** The rigid follow and the level lock are in `/lab/move`; the village, home island and ruins keep the shipped lerping `useFollowCamera` until integration. Should the village camera become rigid too at integration (it is the lag you felt)? Assumed yes, with the kit.
16. **Saved lab values reset.** The panel's storage key moved to `tsi.moveLab.v2` so the new dash and hop defaults take effect; values saved before sit under `tsi.moveLab.v1` in this browser.
17. **Speed lines, not afterimages.** The dash streak is the village's sprint wind rods (stronger through the dash). A ghost copy of the character per dash would mean a second skinned character; the rods, dust, squash and FOV punch read clearly in the strips.
18. **The cooldown ring stays on the ground** under the avatar, in the air too, where it shows empty while the air dash is spent.
19. **Shared character change.** `CharacterMotion.stop` ends a running one-shot (a landing ends a short hop's Jump); only the movement avatar sets it.

## Integration (build agent, 2026-09-30)

None blocked; each has the assumption the build took.

20. **The café and the applicant island get the kit too.** Both walk on `PlayerAvatar` (the café for its study seats), so they jump and dash like the village; the clubhouse, museum, temple and house keep the simple interior walker. Say if the café or the applicant island should lose jump and dash (one flag).
21. **The ruins stay a closed canyon.** Its walls are one cliff high (1.5u), which the kit can mantle, so the ruins world treats the cliff tops as walls: you cannot climb out of the encounter. Say if some walls should be climbable.
22. **Getting up from a seat** puts you at the nearest open spot, its front first (in front of a bench; beside or behind a study chair, since the table is in front), easing over rather than popping, instead of walking out of the seat's footprint as before.
23. **Tap-to-walk into something** now walks until pressed against it, slides along it a moment, and stops (it used to clamp the target to the reachable point up front).
24. **The nameplate follows jumps and falls** (it used to stay at ground height under the cosmetic hop).
25. **The applicant island's own camera** (recruitment, not the member follow camera) still lerps on the player, so it follows a jump a little; the member scenes use the rigid follow.
26. **Movement keys refuse Z, J and F** (zoom, quests, decorate) as well as the menu, interact and ability keys.
