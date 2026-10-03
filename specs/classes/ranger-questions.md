# Classes v2, the Ranger wave: questions for David (with the assumption taken)

Nothing here blocked the build. Each item says what the wave does now; a one-word answer changes it.

## Feel
1. **Focus and movement.** "Ramps to 8/s over about 4 s while you keep shooting and moving." *Assumed:* moving never breaks Focus and isn't required to build it; only a 0.5 s pause (the bow ready and not fired) or a hit halves it. Say "moving only" and standing still stops the ramp.
2. **Arrow drop.** Arrows fall under 8 u/s² from chest height and are spent where they meet the ground, about 11 u out (the bow's range is 13). Swift Arrows fly flat. *Assumed:* that reach; homing arrows still drop (they curve, they don't fly flat).
3. **Back Hop "lands into a slide".** Ability movement never forces the movement kit (§1.1), so Back Hop is a 4 u/s push back and a 0.7 u hop; held crouch on landing turns it into a slide when you carry slide speed (kiting backward). *Assumed:* that. A forced slide on landing needs a hook in the movement sim (shared).
4. **The Sniper's weak points.** No hit zones exist on enemies, so a weak point is the inner 35% of a body's radius (at most 0.3 u): a shot whose line passes that close to the centre always crits. Scope widens it ×1.5. The bot's aim wanders up to 0.45 u (a new spot every 0.4 s) so headshots aren't free in the harness. *Assumed:* that model; real heads and cores per enemy are a mobs-side change.
5. **Scope.** A hold on key 1 (up to 8 s): +40% crit chance, the wider weak point and a 14° aim zoom; letting go ends it. *Assumed:* hold, not toggle.
6. **Camouflage's look.** Enemies past 1.5 u lose you, a quick step (faster than a slow walk) or acting breaks it, the first shot out deals +60%, and the HUD says "Hidden". The character isn't drawn translucent: character materials are shared, so a fade needs an opacity hook in the character renderer (also wanted by the Illusionist's Vanish and the Assassin's Smoke Bomb). *Assumed:* no fade until that hook lands.
7. **Mark Prey through walls.** A red diamond over every marked enemy, drawn without depth test (PreyMarks.tsx). *Assumed:* any mark (also a future kit's) shows that way.
8. **Gunslinger's R.** With a cylinder, R reloads (a second R inside the gold span is the active reload, one try a reload); "previous weapon" stays on the tool wheel. *Assumed:* no new key for the previous weapon; say which key if you want one.
9. **Quickdraw** is key 5 and works for 1.5 s after a reload ends ("Right after a reload"). *Assumed:* that window.
10. **Russian Roulette's sequence.** The press plays the wind-up (the spin, 500 ms), then the freeze, flash frame and lines wait for the warhead: wherever it lands they play larger (shake 0.6, a 1.6× FOV kick) with a mushroom cloud. Golden rounds land at the heavy tier. The flash limiter and Reduce flashing still apply. *Assumed:* no flash at the spin itself, so the warhead's is the only one. If the window closes with the warhead unfired, no sequence plays.
11. **Thousand Arrows** fires its 20 shots a second on its own toward your aim (you steer, you don't hold the mouse) and ends in a falling volley (power 4.5, r3.6) at the aim with the sequence again. Each arrow's own hit is small (it rounds to 1 against armour). *Assumed:* that.

## Rules and data
12. **Signature type names.** `recurve`, `rifle`, `harpoon` and `sixgun` (the brass revolver keeps `revolver`, so the Gunslinger's type is its own, §1.5). Keys `<type>-<tier>`; tier names in the seed (Ash recurve … Starlit revolver).
13. **The trap cap and duration.** Three traps at mastery 1, `floor(3 × duration)` at a level (five at 20, where duration is ×1.7), and trap life × duration. *Assumed:* that curve.
14. **Prey and marks.** Prey adds +30% to trap springs on marked enemies; Mark Prey's own mark is +20% damage taken for 8 s; the Great Hunt sends a hound per mark (two with none, four at most). *Assumed:* those numbers.
15. **Stat directions at 20.** Attack speed ×1.15, crit damage ×1.75 → ×2.3, duration ×1.7, reload speed ×1.5. Attack speed is capped low because the Marksman's DPS grows with it directly (×1.3 put mastery 20 past the 1.2× budget).

## Balance (specs/evidence/classes/K-ranger-balance.md)
16. **The scripted guardian.** The Rangers bring the guardian down in 1.6–3.0 minutes in the scripted fight (the §3 target is 4–6). Today's kits on the old bot run 2.4–10 minutes there, and the guardian's pace is one number for every family. *Assumed:* the wave-5 pass sets the guardian (or the scripted fight) once all 16 are in; the Rangers aren't detuned against it alone.
17. **The sanctum ult share of field-wide ults.** The bot fires an ult only with two or more enemies in its area (§3). On the sanctum the meter fills (60–62 s) as the last wave thins to its golem, so the Great Hunt and the Roulette often go unfired there (0–3% of the damage) while they land 9–14% on the guardian. *Assumed:* the guardian's share is the ult-weight pin for these; a bot that fires field-wide ults on a lone elite would change it (a harness rule for every family).
18. **The bot's `ult.reach`.** An ult that isn't an area (a rail, the traps, a cylinder) gives the bot the reach it counts enemies in (6, 8, 9–14 u). Data only, but a new field the harness reads.

## Art and the HUD
19. **The Rifle grip.** The long rifle and the harpoon crossbow share a new grip family (17 verb clips): the right hand on the grip, the left reaching along the barrel (the arms are short: it reaches as far as it goes), a shouldered aim for QuickShot and DrawShot. Hold idles exist for every grip but nothing lays them in the ruins yet, so the rifles' rest grip is solved for the plain arms (muzzle up at the side).
20. **Animated runes at tier 5.** The trim kit's T5 glow parts breathe (65–100% of their strength, every tier-5 copy together: `Weapon.pulse`). *Assumed:* a breathe is "animated"; a scrolling rune pattern needs a texture the meshes don't have. The mastery trim (13) and its glow (19) are equip rows today; drawing a skin or trim on the weapon needs a material swap in the weapon renderer, wave 5.
21. **Ability icons on the HUD.** The kits' icons sit before each key's name in the bar (16 px) and the ult slot shows the ult's icon; the Path sheet still shows names only.
22. **Unique clips.** Four ults (Ult_Marksman, Ult_Sniper, Ult_Hunter, Ult_Gunslinger), Unique_Reload (played at the reload stat's pace) and Unique_FanHammer. Smoke Roll plays the Backstep verb and the Harpoon DrawShot (both inside the 3-unique budget if you want them unique later).

## Found while building (for the coordinator)
23. **Combat pack rows 15–18** (flame, muzzle, chain, mushroom) are the Rangers'. Another family appending rows will collide on the same indices: rebuild `art/fx/build_pack.py` with both lists (rows are append-only, the atlas is deterministic).
24. **`v7_verbs.glb`** was rebuilt with the Rifle grip and the six Ranger clips (125 clips); the other 102 are byte-identical (checked per action). Another family's clips merge the same way: rebuild once with both sets in `build_clips.py`.
25. **`lib/combat/seed.ts`** now leaves signature weapons (rows with a `subclass`) out of the generic combat seed: each family seeds its own with the subclass column. The catalogue test would otherwise ask for a new generated migration per family.
26. **The `combat_content_smoke.sql` boss-gear count** (`tier >= 4` = 5) now counts only weapons without a subclass: signature tiers 4–5 aren't the guardian's common gear.
