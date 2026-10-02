# Classes v2, wave 0: questions for David (with the assumption taken)

Nothing here blocked the build. Each item says what wave 0 does now; a one-word answer changes it.

## Feel
1. **Combo keys wait for their partner.** A key that is part of a combo (the Elementalist's elements) holds its solo spell up to 0.4 s in case the second key comes, then casts it. The alternative is to cast the solo at once and let a quick second key cast the combo on top (both paid). *Assumed:* wait; the window is per kit (`window`), so the Elementalist wave can shorten it if 0.4 s feels laggy.
2. **"The subclass core colour"** for the ult ring and the flash frame. Every ramp's core is near white (white-hot), which vanishes on the cream HUD and makes the flash frame plain white. *Assumed:* the ramp's mid band (the class colour) for the ring, the edge glow and the flash frame's tint.
3. **Flash frame variants (§5 Q2).** Only the default is built: ink silhouettes on the ult's colour (the canvas cut to two tones, the colour multiplied over). *Assumed:* that one; the inverted-monochrome and white variants are a CSS filter each if you want to compare them.
4. **Per-target hitstop at the ult (80 ms at A+120).** *Assumed:* folded into the 120 ms freeze; separate per-enemy holds come with multiplayer, where the freeze is local.
5. **Charges** fire at 0.5× uncharged to 1.5× full; **holds** keep their buffs while held (up to `max_s`) and their cooldown starts on release. *Assumed:* these as the shared rules; a kit can tune its own numbers.
6. **The Priest's shapes:** under 50% still fizzles (rules unchanged), 50% casts at 0.6× rising to 1.5× at 95%+ ("60% for a rough sketch, up to 150% for a clean one"). Under mouse-look the pen starts on each stroke's numbered dot (no cursor to see).

## Keys
7. **Z X C V preset with five keys:** key 5 goes on **T** (the free key by R and F; B is the journal, G is fixed). F is the ult's alone; no slot can take it.
8. **P opens the Path sheet** only with the flag on (it is free in the menu map).

## Rules and data
9. **Mastery only trains with the flag on.** With it off, ruins XP raises the character level as today and no mastery accrues (existing members start at mastery 1 at launch, §1.11).
10. **One repick token at a time** (`repick_source`). A paid redo while holding the launch gift leaves one token ("oracle"), not two.
11. **`subclass_respec_fee` and `SUBCLASS_RESPEC_FEE`** are retired on the v2 path only. Today's path still charges the fee while the flag is off; the row and the constant go with the legacy kits in wave 5.
12. **Signature weapons:** the migration and the grant work, but no subclass has rows until its family wave seeds its 5 tiers. The dev kit uses today's staff type.
13. **Stat directions without a system yet:** reload speed (Gunslinger) is stored; the reload bar comes with the Ranger wave. Duration, summon count and the rest act through the shared modifiers now.
14. **"Show class on my nameplate"** is kept on this device until other players see nameplates (multiplayer); then it hides it for everyone as the sheet says.
15. **Balance output:** v2 rows go to `specs/evidence/classes/K0-balance.md`; `combat-b/balance.md` keeps today's kits until wave 5.

## Art and sound
16. **The verb library** (96 clips, 6 grips × 16 verbs) is a separate 1.07 MB GLB loaded only in the ruins. The poses are readable but small; each family wave keys its unique ability and ult clips on top.
17. **Sound (§5 Q1):** only the ult-ready chime is wired (a re-pitched CC0 cue). *Assumed:* the to-generate list waits for your pick of source.

## Found while building (for the coordinator)
18. **Telegraph render order vs the painted ground.** The terrain's sand and soil layers draw at render orders 2 and 3 (transparent), the same as the telegraphs' body and fill. Combat effects and the aura now draw at 3.4–3.7 so the sand never paints over them, which puts them over the telegraph fills (the rims at 4 stay on top; glows add, so fills still read). The §1.7 rule "player effects under enemy markers" needs the telegraphs lifted above 3.5 (EncounterRender, the mobs agent's file).
19. **A weapon loop at load (pre-existing).** On a device with no held item stored, if the server's equipped weapon isn't the driftwood sword, DefaultIslandWorld's held/equipped effects (`settleHeld` / `holdItem` / `setWeapon`) flip between the two and React stops with "Maximum update depth exceeded" once. It showed when the dev kit equipped its staff on the server; the demo no longer does (the staff is on the wheel instead). A member who equipped a non-starter weapon on another device would hit it.
