# Combat polish (row 268)

David, 2026-10-01: "I need you to polish combat system, cafe first ... polish the game first." The ruins work end to end: 16 kits, 7 enemy types plus the guardian boss, 10 missions, rewards, defeat and leaving. What's missing is feel. Survey (2026-10-01), paths under `web/` (`C/` = `components/game/combat/`, `L/` = `lib/game/combat/`):

## Rough edges, worst first
1. **Silent.** Nothing in `C/` or `L/` plays a sound; `public/audio/sfx/MANIFEST.md:31-41` maps combat sounds that were never wired.
2. **No impact.**
   - No hitstop, shake or hit particles.
   - Enemies die by shrinking over 0.6 s (`EncounterRender.tsx:72`).
   - The player is always pushed 5 u/s for 0.15 s (`L/encounter.ts:37`), while each attack's `knockback` in `L/data.ts:44-56` goes unused.
3. **Lost input.**
   - Attack is a held flag cleared on pointerup (`RuinsScene.tsx:133-134`), so a quick trackpad tap can miss every frame.
   - No buffering during cooldowns.
   - Ability presses on cooldown are dropped silently (`abilities.ts:207`).
4. **Sliding feet.** The character always faces the cursor (`RuinsScene.tsx:157`, `PlayerAvatar.tsx:270`) with no strafe or backpedal clips. It faces +z until the mouse moves.
5. **Clumping, idle AI.** Straight-line chase with no separation (`sim.ts:156-157`); packs stack and their red markers merge. Idle enemies stand still (`sim.ts:147`).
6. **Placeholder art.**
   - Projectiles are flat boxes (`EncounterRender.tsx:176-177`), so volleys are barely visible.
   - Totems are cylinders (`:233`).
   - The escort is the capsule shopkeeper, which slides and faces the player (`RuinsScene.tsx:285`).
7. **Telegraphs.** One red for everything; a spit marks only its landing, not its path (`telegraph.ts:118`).
8. **Two different dashes.** The ruins dodge (14 u/s, 0.34 s, 0.89 s cooldown) is heavier than the village dash (18, 0.2, 0.5) (`actions.ts:88-93`), and air dashes give i-frames.
9. **HUD.**
   - The dark purple panel is off the cream UI kit (row 124; `DefaultIslandWorld.module.css:209`).
   - The energy label is 9 px.
   - Slot names are truncated.
   - A cooldown is only a faint number.
   - The victory and trait banners reuse the defeat card (`CombatHud.tsx:65`).
   - Key labels are hardcoded (R, 1–4, Q in `DefaultIslandWorld.tsx:759`, `IncantationOverlay.tsx:81`), so remaps show wrong.
   - No enemy HP bars.
   - Status messages share the 12-slot damage-number pool (`CombatHud.tsx:33`).
10. **Bug.** Dying before landing a hit sends `hits: NaN` (`DefaultIslandWorld.tsx:446` → `L/progression.ts:43`). The route rejects it, so the 10% defeat wear is never saved.
11. **Balance outliers** (`specs/evidence/combat-b/balance.md`).
    - Normal mission DPS: Monk 47 vs Priest 21.
    - Sanctum damage taken per minute: melee 202–331 vs Illusionist 23.
    - Necromancer clears the sanctum in 67 s vs about 130 s for the rest.
    - The boss takes 6.5–11 min with starter weapons.
12. **Performance.**
    - All 15 model groups rebuild lists and bounding spheres every frame (`EncounterRender.tsx:69-104`).
    - The tick allocates every frame (`encounter.ts:33-41`).
    - `PlayerCharacter` re-renders 10×/s (`PlayerAvatar.tsx:459`).
    - The rune overlay copies and re-scores the stroke on every pointer move.
    - Defeat remounts the whole scene (`DefaultIslandWorld.tsx:650`).

## Deliverable, in order (a commit each)
1. **Input.**
   - A click is a queued attack until a frame consumes it.
   - Attack and ability presses buffer about 150 ms.
   - A press on cooldown pulses its slot.
2. **Wear bug:** `p.hits[w] ?? 0`, with a test.
3. **Sound.** Wire swing, hit, crit, hurt, dodge, enemy defeat, windup, boss stagger and boss defeat through `lib/game/audio.ts`:
   - Use the files `MANIFEST.md` maps where they exist; otherwise the closest existing CC0 sound. Generating new sounds is out of scope.
   - Combat code emits events and the scene plays them.
   - Respect the Sound settings. Test browsers stay muted (`--mute-audio`).
4. **Impact.**
   - About 60 ms hitstop on melee hits, crits and getting hurt.
   - A small camera shake through the follow camera.
   - Per-attack `knockback` for the player push and a short stagger push on enemies.
   - A hit flash and a death pop with a puff instead of the shrink.
   - Keep it juicy, not chaotic (David's movement bar).
5. **AI:** enemies keep a separation radius and wander a little near their spawn when idle; a `sim.test.ts` case for each.
6. **Telegraphs:** a distinct colour or shape per attack family (melee sector, ranged line from source to target, area ring, boss), each readable on its own when packs overlap.
7. **Projectiles and props.**
   - Arrow, bolt and spit meshes with short glow trails.
   - A real totem model.
   - The escort on the real character rig (a resident look), facing where it walks.

   Hand-made in Blender headless (`--background --python`). Do not use the live Blender MCP window, which the avatar agent is using. Matte (row 264). No web references.
8. **HUD in the cream UI kit.**
   - A radial cooldown sweep.
   - A readable energy label.
   - Full slot names, or a tooltip.
   - Its own victory and trait banners.
   - Key labels from the bindings.
   - Small HP bars over damaged normal enemies and elites.
   - A separate status-message pool.
9. **One dash.** The ruins dodge uses the village dash's burst shape (`dashSpeed`, `dashEase`, `dashExit`) plus i-frames, with a cooldown around 0.6 s. Air dashes get no i-frames.
10. **Facing.**
    - Face the movement direction when moving.
    - Snap to the aim for an attack and hold it about 0.6 s after.
    - Face the aim when standing.

    This removes the sliding feet. It changes how aiming feels, so note it in the questions file with a before/after clip.
11. **Balance into a band.** With starter weapons:
    - every subclass's normal-mission DPS within about ±25% of the median;
    - sanctum damage taken per minute within a 3× spread;
    - no clear time under 0.7× the median;
    - the boss in about 4–6 minutes.

    Change data, not systems. Re-run the balance harness and update `balance.md`.
12. **Performance.** A fixed bounding sphere per model, reused arrays in the tick, `PlayerCharacter` subscribing only to weapon changes, the rune overlay scoring on pointer-up (or throttled), and a defeat reset without remounting the scene.
13. **Evidence** reshot under a `C4-` prefix with Q and R controls: hit feedback frames, telegraph families, a pack keeping apart, projectiles, the HUD, the dash, facing. Plus the balance table.

## Out of scope
New enemies, new missions, new kits, wing flight, Epic/Legendary weapon models, combat keys in account bindings (`combat-questions.md` #19), climbable ruins walls (movement Q21). Note anything else you find in the questions file.
