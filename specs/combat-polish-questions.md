# Combat polish: open questions for David

## 2026-10-01 (combat polish build, deliverables 1–13)

Each item has the assumption the build uses today. None blocks. Evidence: `specs/evidence/combat-polish/` (C4-), table: `specs/evidence/combat-b/balance.md`.

1. **Facing changes how aiming feels (deliverable 10).** You now face the way you move, snap to the aim for an attack or ability and hold it 0.6 s, and turn to the aim (quickly, not a pop) when you stand still. Before: always the cursor, feet sliding sideways. Clips: `C4-00-before-08-facing.webp` (before; its labels are the after run's timeline) and `C4-08-facing.webp`.
   - A Guardian's frontal block uses the facing, so while running the block faces where you run.
   - Until the mouse moves, the aim sits ahead of you (it used to point +z).

   *Assumption:* this is the feel you want; the 0.6 s hold is one number (`AIM_HOLD`, `lib/game/combat/actions.ts`).
2. **One dash (deliverable 9).** The ruins dodge is the village dash's burst (18 u/s easing to 0.55 of it over 0.2 s), 0.6 s from press to press. The dodge's clock is 0.34 s: i-frames from 0.02 to 0.30 s (a little past the burst, so a dodge pressed as the strike lands still covers it) and no attacks until it ends (a click in that time waits and lands as it ends). An air dash gives no i-frames but still breaks a cast.
   *Assumption:* OK. With i-frames only through the 0.2 s burst, the scripted runs took 2× the damage in the temple.
3. **Sounds were picked without listening (deliverable 3).** Every cue re-pitches one of the 11 CC0 files (table in `public/audio/sfx/MANIFEST.md`). The dodge keeps the kit's dash sound rather than the manifest's footstep, so the dash sounds the same everywhere. Ability casts and mission start/complete are not wired (not on the list).
   *Assumption:* they need ears at the playtest; generated combat sounds stay on the manifest's to-generate list.
4. **Balance moved data a long way to hit the band (deliverable 11).** All four targets pass: normal DPS 0.83–1.17× the median, sanctum damage taken 2.55× spread, no clear under 0.76× the median, the guardian 4.0–5.8 min with a starter. The full list of changes is in `balance.md`. The ones that change how a kit feels:
   - The temple's pressure moved from the golem's slam (which only melee stood in) to the books' charge: books 2.6 → 4.4 u/s with a 3 u lunge, golems hit for 9 instead of 22. Ranged players now get chased.
   - The Guardian blocks 0.4 (0.2 without a buckler, which still can't be acquired) for 1 s every 15 s, and Bulwark gives 1% instead of 6%. It was taking 7× less than the Assassin.
   - All four Warden subclasses get +25% max health so Warden stays the most reliable family on the hard run (G2), now that everyone else got sturdier.
   - Blood Lunge leaves a 0.3 guard for 2.5 s; Smoke Step distracts 0.5 s and slips back 2 u; Decoy Step slips back 2.5 u.
   - The guardian is 1700 HP and armor 7 (was 1800 and 9), in a new seed migration (`20261001070514_guardian_balance_seed`, in the SQL smoke chain, fail-first checked).

   The measure is the scripted bot (no kiting, dodges at half the windup), so the 3× spread is sensitive to it: an earlier cut sat at 2.96× and drifted to 3.5× from a float rounding change.
   *Assumption:* these are starting numbers; retune from the member playtest. A band test (`balance.test.ts`) now pins the targets.
5. **"The boss in about 4–6 minutes"** uses the content pass's measure: level 10, all 27 points in the weapon's stat, landing half the time (`bossMinutes`). Tier 2+ gear takes about 2 minutes. There's no scripted boss fight in the harness.
   *Assumption:* that's the measure you meant.
6. **Impact numbers (deliverable 4).** Hitstop is 60 ms on melee hits, crits and hits taken, and it holds your avatar and its swing pose too; presses wait through it. The camera shake is 0.035 u for a melee hit, 0.07 crit, 0.12 hurt, 0.1 boss stagger, 0.25 boss defeat, gone in about 0.25 s, and off with reduced motion. A hit holds an ordinary enemy's chase for 0.15 s (elites half, the boss never); it never cancels a windup. Knockback is the attack's own number (0.225 u per point: a fox 0.7 u, a golem slam 1.1 u).
   *Assumption:* "juicy, not chaotic"; each is one number in `RuinsScene.tsx` / `encounter.ts` / `sim.ts`.
7. **The escort's look** is a random resident look seeded by who it is ("botanist", "scholar"), the way the village residents get theirs. Should it be a named resident from the roster instead?
8. **One totem model** serves all three roles, its eyes and rings tinted (ember orange, mending green, warding blue). Separate silhouettes per role later?
9. **The rune overlay stays dark** (casting mode). Only its "dodges and cancels" key now follows the bindings. Cream too?
10. **`art/props-enemies/palette_ext.json` was never committed**, so the weapon, enemy and prop builders that name its colours can't run on a fresh checkout. `pe.py` now loads without it, and `build_combat_fx.py` uses hex. Restore the file from wherever it was authored?
11. **Performance.** In a full pack fight (17 enemies, 3 totems, swinging the whole time), the tick allocates 3.3 KB a frame instead of 17.4 KB (`alloc.mjs`). The display holds 144 FPS (1% low 115 before, 119 after). Uncapped, it averages 234 FPS before and 219–226 after: the new rims, trails, health bars and totem models cost about 5%.
12. **Smaller things I changed along the way.**
    - The harness's block-counter roll is now seeded, so the table is reproducible.
    - A defeat resets the scene in place (no remount).
    - A key pressed with more cooldown left than the 150 ms buffer pulses its slot at once and doesn't fire later.
    - Combat keys in the account's key bindings (combat-questions #19) are still per device, as out of scope.
