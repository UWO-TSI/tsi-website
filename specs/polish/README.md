# Polish plan (rows 268, 273)

David, 2026-10-01:
- "polish the game first";
- "every small thing needs to be considered a proper feature";
- "i want you to have the same mindset on developing everything, be detailed in the polishing of the game."

This folder turns three read-only audits into agent-sized specs:
- `audit-activities.md`
- `audit-spaces-life.md`
- `audit-ui-flows.md`

Combat, café, movement feel and the avatar have their own specs in `specs/`.

## The standard for every spec
- No primitive placeholders: no capsule people, box walls, sphere fruit, or flat rings and discs as effects.
- Characters and hair are matte (row 264).
- Every action has anticipation, a reaction and feedback (motion, effect, sound) that ties into the world: lit by the sun, tinted by the surface, drifting with the shared wind.
- Effects draw on the avatar or object they belong to, not "the" player (multiplayer-forward, look spec §7.1).
- Transitions never pop: fades wait for loading; lights and lamps ease.
- No `setState` inside `useFrame`, no per-frame allocations, FPS unchanged.
- Evidence is checked before reporting: no broken or empty tiles in a sheet.

## Order (two code agents at a time)
| # | Spec | Depends on | State |
|---|---|---|---|
| — | Combat polish (`specs/combat-polish.md`) | — | on main |
| — | Café polish (`specs/cafe-polish.md`) | — | on main |
| 1 | Movement feel (`specs/movement-feel.md`): our particle pack and particle system | combat merged (shared dash and avatar files) | running (milestone 1) |
| 2 | HUD frame and first login (`hud-first-login.md`) | café merged (shared HUD files) | running |
| 3 | Living village (`living-village.md`) | 1 (particles for rain splashes, leaf bits) | queued |
| 4 | Interiors (`interiors.md`) | café merged (keeper → character pattern) | queued |
| 5 | Menus and sheets (`menus.md`) | 2 | queued |
| 6 | Fishing (`fishing.md`) | 1 | queued |
| 7 | Foraging, crafting, museum, shop (`forage-craft-museum.md`) | 1, 4 | queued |
| 8 | Arrival, wharf, home island (`arrival-wharf.md`) | 1, 2 | queued |
| 9 | Resident talk, wallet, sign-in, companion (`reachability.md`) | 3 (resident routines) | queued |
| 10 | Sound pass (`sound.md`) | David's sound source | waits |
| — | Avatar v8 hair rework (`specs/avatar-v8.md`) | David's game references | waits |

## Waiting on David
1. **Sound source.** Combat, movement, activities, ambience and interiors all lack sounds; the whole SFX set is 10 files, and dialogue blips stand in for effects. Options:
   - CC0 packs (free);
   - ElevenLabs or Higgsfield generation (row 125; needs a paid plan).

   Until he decides, agents wire what exists and list the gaps.
2. **The resident roster** (row 217): names, looks and traits for the service posts (HQ lead, shopkeeper, café owner, museum curator, wharf keeper, Oracle keeper, crafter). Agents propose them in their questions files.
3. **HUD:**
   - the coin's name and symbol;
   - what the top HUD shows;
   - whether members get the time-of-day override and the pixel filter;
   - retiring the portal onboarding wizard and the old `QuestChecklist` for game players.
4. **Shop:** a real shop interior (default), or delete `ShopInterior.tsx`. Whether the portal shop shows $ prices at all.
5. **Fishing:** a visible line, the fish held up in the hands (row 136 said no visible props), fish shadows (rows 151, 195 said no for v1), and the reveal's style (gacha rays vs cozy).
6. **Lamps:** he places lamps along the paths himself in the painter (rows 163, 246).

## Follow-ups found along the way
- **Combat target marker.** The white target ring under enemies is a flat ring. Replace it with a painted marker from the particle pack (movement feel).
- **Lost palette file.** `art/props-enemies/palette_ext.json` was never committed and is lost. The weapon, enemy and prop builders that name its colours can't rebuild on a fresh checkout (`pe.py` now loads without it). Rebuild it from the shipped GLBs' material colours.
- **Café ceiling hotspot.** The eye-level reference shot shows a blown-out light on the ceiling (`specs/evidence/cafe-polish/19-ref1-beside-interior.webp`). Soften it when the café is next touched.
- **Toast over the seat prompt.** The café agent saw the toast cover the seat prompt at bottom centre; the HUD spec's toast lane fixes it.
