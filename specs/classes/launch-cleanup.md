# Classes v2, wave 5: the cleanup list (not the cleanup)

What goes once `economy_settings.classes_v2` is on for good (design sheet §4 "Wave 5": "the legacy family abilities and
`gear.without` code deleted"). **Nothing here is deleted yet:** today's kits stay live until David turns the flag on.
Surveyed 2026-10-03 on `game/classes-launch` (line numbers from then; they drift). Applied migrations are never edited,
so every SQL removal is a new migration.

## 1. What goes

| Area | Where | What | Size | Call sites |
|---|---|---|---|---|
| Family abilities | `web/lib/combat/kits.ts` `FAMILY_ABILITIES` (L211–229) | The 8 shared abilities (Blink, Starfall, Tumble, Rain of Arrows, Leap Strike, Second Wind, Renew, Verdant Covenant) | −20 | `kitOptions`/`resolveLoadout` (below), PathSheet's legacy tab, `abilities.test.ts` |
| `gear.without` | `kits.ts` `Ability.gear` (L147–148); `web/lib/game/combat/abilities.ts` `context()` (`Ctx.gear`, `potency * gear`, the block value); `web/lib/game/combat/beasts.ts` (`gear: 1`) | Partial power without the suggested weapon (§1.5 retires it) | −5, 3 edits | none outside |
| The subclass fee | `web/lib/combat/progression.ts` `SUBCLASS_RESPEC_FEE` (L17); `web/lib/combat/memoryStore.ts` (L5, L121–126); `web/lib/combat/service.ts` (L10, `fees.subclass_change` L84) | The 250-coin change (row 287 retires it; the Oracle's own 250-coin redo stays) | −10 | SQL: the `subclass_respec_fee` setting and `combat_choose_subclass`'s flag-off branch (`20261002181044_classes_v2.sql` L154–163) |
| Today's kits | `kits.ts`: `Subclass` (L188–199), `SUBCLASSES`/`subclassesFor`/`subclassByKey` (L231–397), `SLOTS`, `kitOptions`, `resolveLoadout`, `checkLoadout` (L488–512), `STARTER_TRAIT`, `traitMastery`, `Element`, the Ability fields `incantation`, `on_block`, `element`, `weapon_affinity`, `starter_note` | The sixteen legacy kits | −225 | Keep `FAMILY_STAT`, `UNITS` (v2's summons), `CAPS`, `TRAITS`, `traitTier`. Readers move to `classKit`/`CLASS_KITS`: service.ts (L65, 82, 132, 141), PathSheet (L37, 65, 99, 141), `demo.ts` (L51, 58), `playtest.ts` (L59 and its fallback L36–54) |
| The legacy runtime | `abilities.ts`: `equipKit` (L82–90), `fireSlot` (L310–327), `onPlayerHit` (L185–195), `resonance` (L583–588), the undriven totem pulse (L601–615), the forks in `cancelCast`, `resolveCast` and `context`; `web/lib/game/combat/runtime.ts`: `kit`/`slots`/`passive` (L164–168) and `SLOT_IDS`; `actions.ts` (the slot path L282–286, the `poise` check L234); `encounter.ts` (L17, 36, 39–40); `classRuntime.ts` (L96) | Slots 1–4 and today's passives | −105 | `V2_SLOT_IDS` takes `SLOT_IDS`' place |
| Legacy-only passives | `kits.ts` passive kinds: element_switch, distracted, kill_heal, same_target, distance, crit_cdr, block_shield, momentum, poise, lifesteal, pack_bond, resonance, overheal_shield | Read in `passiveBonus`/`onPlayerHit`/`onKill`/`heal` | −40 | Keep `still` (the dev kit) and `transform_shield` |
| Legacy units | `kits.ts` `UNITS`: fox, crab, shade, the three totems, tripwire, decoy; `WEAPON_MINION`/`minionFor`, `CAPS.decoys`; `EncounterRender.tsx` (their colours, L347) | | −15 | Keep `wisp`, `bone-wisp`, `weapon-wisp` |
| The loadout | `web/app/api/combat/loadout/route.ts` (delete); service.ts `setLoadout` (L137–146), the view's `loadout`/`kit`/`subclass_choices` (L78–82), `bad_loadout`; `store.ts`, memoryStore.ts (L128–132), `supabaseStore.ts` (L24, 28, 45), `lib/game/combat/progression.ts` (L49), demo.ts (L7, 59, 90) | Pick-4 is gone (row 291) | −50 | SQL: `combat_set_loadout` and `member_progression.loadout` (`20260926210000_combat_kits.sql`) |
| The UI | `web/components/game/oracle/PathSheet.tsx` (the `!v2` tabs L159–187 and their state); `web/components/game/combat/CombatHud.tsx` (L38–40, L62–73); `web/components/game/DefaultIslandWorld.tsx` (the `equipKit` branch L642, imports, the slot fork L1071); `web/components/game/combat/RuinsScene.tsx` (L114–118, the legacy `impact()` L166–172, the key fork L334–337) | | −80 | |
| The flag | TS: service.ts `classesV2()` (L54–58) and its `v2.on` uses, memoryStore.ts (L14–15, 65, 111, 256), `setting()` in both stores, demo.ts (L57, 101). SQL: `classes_v2_on()` in `combat_grant_xp`, `combat_choose_subclass`, `combat_tame_beast` (`20261003054110_backpack.sql` L77) | The branches collapse to v2 | −40 | The client's `rt.v2` null checks stay: below level 10 nobody has a class |
| The gate's starters | memoryStore.ts (L125); SQL `combat_choose_subclass`'s flag-off grant; `runtime.ts` `setOwnedWeapons` (L211) adds the five `STARTER_WEAPONS` to every member's swap and wheel, owned or not | | −5 | **A behaviour call, not just a deletion:** v2 never grants those five, so the wheel would stop showing them |
| The legacy harness | `web/lib/game/combat/balance.ts`: `starterWeapon`, `runSurvive`/`runElder`/`runFight`, `balanceTable`/`elderTable`, `familyAverages`, `useful`'s legacy branches; `balance.test.ts`; `specs/evidence/combat-b/balance.md` | Today's kits' band | −120, −224 | The Ranger, Warden and Vanguard balance tests use `balanceTable` for "today's median": point them at the all-16 v2 median (classesBalance.test.ts) or drop those checks |
| Legacy-only tests | delete `web/lib/game/combat/abilities.test.ts` (port 3: dash i-frames, rune potency caps, summon caps) and `balance.test.ts`; edit service.test.ts (~70 lines), actions.test.ts (`caster()`, 5 slot tests), classesService.test.ts, rules.test.ts (L127–134), classRuntime.test.ts (L37), vanguardKits.test.ts (L27), progression.test.ts (L8–10); SQL smokes: combat_kits_smoke.sql (~35 of 60 lines), combat_content_smoke.sql (L19–20), classes_v2_smoke.sql, the flag toggles in the four family smokes | | −700 tests, +150 ported | |
| Dead fallbacks | the "kit not landed yet" paths, `CLASS_RENAMES` (all sixteen have landed) | | −30 | Optional |

**Must change or it breaks:** service.ts sends the legacy `subclass` object, which the client's `islandProgression()`
reads to open the ruins gate: send `{ key, name }` instead or the gate closes for everyone. service.ts (L73) and
abilities.ts (L100) read `Subclass.mods`: read `classKit().mods`. **Keep** `FamilyAura.tsx`: it is the aura of members
without a subclass, not something the subclass aura replaced.

**Total:** about 650 lines of production code and 700 of tests and evidence out, about 150 test lines ported, one
migration (about 110 lines) with its smoke (about 40). **About 7–8 hours for one build agent:** TS 4–5 h (the balance
suites are slow to rerun), the migration and smokes 1.5–2 h, verification 1 h.

## 2. Order

0. The launch migration has turned the flag on in production.
1. **Commit A, no schema change:** sections above except the SQL, and the TS half of the flag. It works against the old
   schema. Deploy.
2. **Commit B, a migration** (after A is live): recreate `combat_grant_xp`, `combat_choose_subclass` and
   `combat_tame_beast` without the flag; drop `combat_set_loadout`; delete the `subclass_respec_fee` and `classes_v2`
   settings rows; then drop `classes_v2_on()`. Update the smokes in the same commit.
3. **Commit C, later:** drop `member_progression.loadout`.

**Risks.** `supabaseStore.progression()` selects `loadout`: dropping the column before A is live breaks the progression
endpoint (and the gate) and any rollback to an older deploy, hence C apart. If A ships while the flag is still 0, the
server keeps charging the fee and granting starters while the UI says the change is free. Drop `classes_v2_on()` only
after its callers are replaced (PL/pgSQL fails when the function is called, not when it's dropped). Doing it all before
the member world opens keeps the blast radius small.

## 3. Single-player assumptions in the combat runtime (for co-op later)

Colyseus work is starting elsewhere; co-op ruins are specs/multiplayer.md's M3, which starts after this branch merges
(the party leader's client runs `stepCombat` for everyone, the server keeps a damage ledger). None of this blocks the
launch (the ruins are single-player), but M3 meets it first. Item 2 matters most there: on the host, its own ult freeze,
hitstop and slow motion would pause or slow the enemies for the whole party. The five riskiest:

1. **Hits have no owner.** `HitSrc` (`web/lib/game/combat/abilities.ts` L116–178) carries no player: `hitAmount` scales
   every hit, units included, off `rt.player`'s weapon, stats and buffs, and `strike` charges the one meter, the tally,
   the passives and the ambush. A hit landing during a sustained ult counts as that ult's. → an owner on `HitSrc`,
   `ShotHit`, `Projectile` and `Unit`.
2. **Local presentation pauses the shared tick.** `web/components/game/combat/RuinsScene.tsx` (L354–355) sets the
   encounter's `dt` to 0 for hitstop and the ult freeze and scales it for slow motion (also the tool wheel's slow-mo,
   `web/lib/game/slowMotion.ts`). §1.6 already says these become local presentation in co-op. → render-side only.
3. **Every enemy targets one player.** `stepCombat(rt, me)` (`web/lib/game/combat/encounter.ts` L31, 60–66) takes one
   position; `enemyTarget` and taunt (`p.taunt`) fall back to "the player"; strike, contact and beam checks
   (`sim.ts` L363–387) test one player, and `e.landed` allows one hit per attack; one player's stealth or fall sends
   every enemy home. → per-enemy targets and per-target hit tracking.
4. **The scene runs world rules off the local player.** RuinsScene: the safe zone from your position (L366), your
   defeat resets the encounter for everyone (L368–372), respawns by your distance (L386–389), waves and the escort follow
   you (L400–426), this client posts kills, missions and tames (L434–446). → the room owns these.
5. **Per-player state sits on the shared runtime.** One `player`; cooldowns, `v2` (meter, cast, Focus, cylinder, the
   channel), buffs, casting, `field` (stealth, marks, counter, orders, surf), `tally`, the kill queue and the mission
   all live on `rt` (`runtime.ts` L114–181), and `combat` is a page-wide singleton. → one encounter plus
   `Record<memberId, PlayerCombat>`. The meter's math is already built from events (`web/lib/combat/ult.ts`).

Also:
- **`allies` is data only.** Set on heals, shields and buffs in the Warden, Vanguard and Arcane kits, read nowhere, and
  `withMods` doesn't scale it; heal, shield and buff only ever touch `rt.player` (abilities.ts L219–238, 422–427), and
  zone, regen and totem heals check only `me`. The Priest's "the ally under your crosshair", "the allies it passes" and
  "the downed rise" exist only in descriptions (there's no downed state). → an ally resolver (lowest-HP ally in radius,
  §1.12) and a downed/revive state.
- **Units are owned by nobody** (`runtime.ts` L47–60): summon caps, totem links, leash, minion orders, clones and beast
  guarding all assume one player; toggles dismiss units by ability key. → `owner` on Unit; caps, links and leash per owner.
- **Threat is data only.** `ROLE_THREAT` (`web/lib/combat/classes.ts` L22–23) is never read; enemies have no threat
  table, and the healer's threat per HP isn't modelled.
- **Randomness and time.** The live callers pass no seeded random (crits, blind misses, clone AI, round shuffles,
  bomblets, enemy wander all use `Math.random`); "Who's Real?" picks on `v2.clock`, wall-clock time; kill, tame and
  mission idempotency keys come from each client's `Date.now()` (two clients would earn double). → server seeds and
  server-assigned keys.
- **FX:** events say `caster: "me"` in the local kit's colours (abilities.ts L53–57); RuinsScene increments the
  simulation's `rt.seq` to seed hit sparks (L188); there's no ult event (§1.2) and no view of another player's ult
  (§1.6). `CombatFx.tsx` is already event-driven and seeded.
- **Fine as they are** (local overlays): the HUD, the ult's dim, flash and lines, nameplates, the aura's own-screen
  toggle (EncounterRender L402–417, ClassRender L137–146, WardenRender L143, MobFx L172, impact.ts L90). Other players'
  avatars will need their own versions of these.
- **The balance harness** (`balance.ts runV2`) is one bot; a co-op band (§1.12's roles in a group) needs a party of bots
  sharing an encounter, once the runtime takes more than one player.
