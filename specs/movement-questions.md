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
