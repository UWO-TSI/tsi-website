# character-in-engine: open questions for David

## 2026-09-26 (first engine pass, branch `game/character-engine`)

1. **In-world size.** v6 is 1.045 m tall. Assumed scale 1.3, so a character stands about 1.36 world units: a little over one tile, close to ACNH next to the 5-tile chalets. The old sprite was about 1.3 units and the Quaternius applicant about 1.6. Say if residents should read bigger or smaller.
2. **Clothing inventory.** Nothing in the economy tracks owned clothes yet. Assumed: the closet and the fitting room offer every catalogue part (row 110's unlockables and merch come with the shop update). The wardrobe is the creator limited to hair and clothes; skin, eyes, mouth and features stay creator-only (row 210).
3. **Where the look is saved.** Assumed: `profiles.avatar_config.look` through the existing `PATCH /api/profile` (the column is already member-editable under the #40 guard), plus a device copy. No migration. A hired applicant keeps the look automatically (row 142).
4. **Names in the applicant portal.** The creator asks for a world name only in the member game. The applicant island runs on production, where the identity tables are still unapplied drafts, so it skips the name field there.
5. **Old applicant looks.** The Quaternius colour picks don't map onto the new parts, so returning applicants see the creator once.
6. **Dig and Sleep.** No dig spot or bed interaction exists yet. Both clips are reachable: `tsi:sit {clip: "Sleep", seatY}` for beds and `tsi:emote {clip: "Dig"}` for a dig action. The homes/peaceful owners can wire them in one line each.
7. **Seat heights (ruling 18).** Seats pass their furniture's measured seat top: `tsi:sit {x, z, clip: "Sit" | "Study" | "Sleep", seatY, yaw}`, and the engine lifts the character by `seatY - clip.seatHeight x scale`. The village benches aren't sittable yet; the evidence uses the plaza bench (bench-wood seat top 0.51) through that event. The study agent's cafe seats should use the same event.
8. **The "sit" emote.** The content emote list has "sit", but Sit without a seat floats. The emote menu ignores it on the member island.
9. **Expressions.** v6 has no expression frames, so each ruling-23 expression swaps atlas cells: happy E8.1 + M2.1, surprised M6.1, sad E1.2 + M4.3, angry E6.1 ("> <") + M2.2, sleepy E1.6 + M3.1, blink E8.1 for 0.13 s every 2.5–6 s. Say if David wants different cells.
10. **Weapons in the village (row 140).** Assumed "equipped" means the ruins gate is open (every member gets the starters then). Until then nothing shows. With the gate open the equipped weapon sits on the back socket in the village and in the right hand (bow: left) in the ruins. Grip angles are tuned by eye; the dump weapon models are placeholders.
11. **Performance evidence.** Measured headless Chromium on the M4 Mac mini (Metal), village at High with shadows, `R-perf.txt`: no crowd 79–83 FPS / 370 draws; 12 extra strolling characters 77–82 FPS / 395 draws (+~2 draws each); 24 extra 54–86 FPS / 426 draws. This is not integrated-graphics evidence; the Phase 1 laptop check still has to run.

## Coordinator rulings (2026-09-26)
1. Scale 1.3: accepted.
2. All catalogue parts available in the wardrobe for v1: accepted; ownership/unlockables arrive with the shop pass.
3. **Production has no `profiles.avatar_config` column** (read-only check 2026-09-26: prod has `preferences` but not `avatar_config`, `skills`, `social_links`, although 004/020 define them: schema drift). Add an idempotent game migration `alter table public.profiles add column if not exists avatar_config jsonb` (already on the #40 guard allowlist and SELECT grant list, which skip missing columns: re-run the grant for it in the same migration). Keep the device copy as fallback.
4. No name field in the applicant portal: accepted.
5. Returning applicants see the creator once: accepted.
6. Wire Dig (shovel on dig spots / buried items near foraging nodes) and Sleep (home bed) in the integration pass.
7. Village benches and the cafe seats use `tsi:sit` with measured seat heights in the integration pass.
8. "sit" emote ignored without a seat: accepted.
9. Expression cells: accepted.
10. Weapons after the gate opens: accepted.
11. Phase 1 runs the integrated-graphics laptop check.
