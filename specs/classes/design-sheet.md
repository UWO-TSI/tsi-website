# The 16 subclasses: design sheet (rows 286–290)

Brief: `specs/classes/brief.md`. This sheet holds the **shared systems** every subclass runs on (§1), the balance targets (§3) and the build plan (§4). David designs each subclass with the coordinator, one at a time; §2 has a stub per subclass with today's kit as reference, filled in as he decides. Ledger rows win over this sheet.

## 0. Summary and where it stands

**What changes.** Every subclass gets a fully unique kit: a pool of 8 abilities (4 equipped on 1–4), an ultimate on F charged by a meter, a passive, and a required signature weapon with its own model. Mastery 1–20 per subclass unlocks the other 4 abilities, upgrades and cosmetics. Ults land with anime impact frames. Identity outside the ruins is a subtle aura, a class icon and title on the nameplate and profile, and the carried weapon. The Oracle suggests one subclass per MBTI type; the choice is locked until a paid redo.

**Where it stands (survey 2026-10-02, worktree `feat/game-default-island`).**
- **Kits** (`web/lib/combat/kits.ts`): 16 subclasses, each with a signature, two own abilities and a passive, plus 2 family abilities shared by its family (Blink/Starfall, Tumble/Rain of Arrows, Leap Strike/Second Wind, Renew/Verdant Covenant). 5 to choose from, 4 equipped, chosen at the Oracle (`member_progression.loadout`). No ultimate, no mastery.
- **One ability system** (`web/lib/game/combat/abilities.ts`): effects are shared primitives (projectile, area circle/cone/beam, dash, shield, heal, summon with caps, buff, status hold/slow/mark/distract, transform). Passives are one modifier each on `strike`. Drawn incantations (spark, binding runes) on 4 abilities. Energy 100, +12/s after 1 s.
- **Weapons** (`web/lib/combat/weapons.ts`): any weapon for any family (row 31, now superseded by row 288). Kits only *suggest* a type (`weapon_affinity`); three abilities lose power without their gear (`gear.without`). Tiers 1–5 by `TIER_BASE` 10/14/19/25/32. Models exist for 8 weapons; the buckler, the cedar totem and the cloth wraps have none (wraps render empty hands; the Guardian blocks at half because the buckler can't be obtained).
- **Look and feel**: ability effects are flat additive rings, sectors and strips (`Blasts` in `EncounterRender.tsx`); projectiles have short trails; three shared attack clips (`AttackMelee`, `AttackBow`, `AttackCast`) serve all 16. Impact today: 60 ms hitstop on melee hits, crits and hits taken; small shakes (`cameraJuice.ts`, off with reduced motion). No flash, no speed lines, no slow motion.
- **Identity outside the ruins**: only the family aura (7 motes, `FamilyAura.tsx`) and the weapon on the back (row 140). No class icon, title or subclass look.
- **Oracle**: the reading maps type to family (`lib/oracle/engine.ts`). Redo: 250 coins and 7 days after the last result (`lib/oracle/retake.ts`). The subclass change is a separate 250-coin fee (`SUBCLASS_RESPEC_FEE`, `combat_choose_subclass`). No subclass suggestion.
- **Balance** (`specs/evidence/combat-b/balance.md`): today's kits sit inside the combat polish band (normal DPS 0.83–1.17× median, sanctum damage taken 2.55× spread, boss 4.0–5.8 min with starters).

**What stays.** The effect primitives, energy, the Q dash/dodge, incantations (rows 52, 53, C2, C3), statuses and enemy resistances, durability, stats and presets (row 38), the encounter tick, the balance harness, the cream UI kit (row 283), the painted particle system.

### 0.1 Overview (skeleton; filled per subclass as David decides)

| # | Subclass | Family (temperament, colour) | MBTI suggestion | Role | Signature weapon | Ult | Fantasy |
|---|---|---|---|---|---|---|---|
| 1 | Elementalist | Arcane (NT, purple) | | | | | |
| 2 | Illusionist | Arcane (NT, purple) | | | | | |
| 3 | Necromancer | Arcane (NT, purple) | | | | | |
| 4 | Transmuter | Arcane (NT, purple) | | | | | |
| 5 | Marksman | Ranger (SJ, blue) | | | | | |
| 6 | Hunter | Ranger (SJ, blue) | | | | | |
| 7 | Sniper | Ranger (SJ, blue) | | | | | |
| 8 | Gunslinger | Ranger (SJ, blue) | | | | | |
| 9 | Guardian | Vanguard (SP, yellow) | | | | | |
| 10 | Monk | Vanguard (SP, yellow) | | | | | |
| 11 | Juggernaut | Vanguard (SP, yellow) | | | | | |
| 12 | Assassin | Vanguard (SP, yellow) | | | | | |
| 13 | Summoner | Warden (NF, green) | | | | | |
| 14 | Shaman | Warden (NF, green) | | | | | |
| 15 | Druid | Warden (NF, green) | | | | | |
| 16 | Priest | Warden (NF, green) | | | | | |

### 0.2 How this sheet gets finished
1. David approves §1, §3 and §4 (shared systems, targets, build plan).
2. David and the coordinator design each subclass in conversation; the coordinator writes its §2 section against the template in §2.0 and fills its overview row.
3. When all 16 sections and the MBTI map (§1.11) are filled, the sheet is the build spec (§4).

---

## 1. Systems (shared by all 16)

### 1.1 Kit shape and the ability baseline

| Part | Rule |
|---|---|
| Pool | Exactly 8 abilities per subclass, none shared with another subclass or family (row 286). Pool order is unlock order: 1–4 are the mastery-1 starters, 5–8 unlock at mastery 2, 4, 6, 8 (§1.4). |
| Equipped | 4 at a time on slots 1–4 (§1.3). |
| Ultimate | 1 per subclass on F, charged by the meter (§1.2). Always equipped, from mastery 1. |
| Passive | 1 per subclass, always on. Rank II at mastery 16. |
| Signature weapon | 1 weapon type per subclass, required for abilities and the ult (§1.5). |
| Family abilities | Removed (row 286). Their 8 entries in `FAMILY_ABILITIES` leave the game at launch. |

**Units every kit is written in** (the system already works this way):
- **Power**: damage as a multiple of the wielder's **base hit**, the weapon's tier base × stat multiplier × level multiplier (`damage()` in `weapons.ts` at potency 1, no crit, before enemy defense). A basic attack is power 1.
- **Heal and shield**: fractions of the target's max HP.
- **Distances** in world units (a tile is 1 u; the character stands 1.36 u). **Time** in seconds. **Energy** from the shared 100 pool (+12/s after 1 s without spending; unchanged). The ult costs no energy.
- **Statuses**: hold, slow, mark, distract, with the existing resistances (elites 0.6×, the boss 0.3× on hold and distract, half slow).

**Data shape** (replaces `Subclass` in `kits.ts`; build agents finalise names):
```ts
interface SubclassKit {
  key: string; name: string; family: Family; role: Role;          // §1.12
  signature: WeaponType;                                          // §1.5, one type per subclass
  passive: Passive & { rank2: PassiveUpgrade };
  pool: [Ability, Ability, Ability, Ability, Ability, Ability, Ability, Ability]; // unlock order
  ult: Ult;
  upgrades: string[];          // ability keys in the order their rank II arrives (§1.4 template)
  look: { ramp: [core: string, mid: string, edge: string]; aura: AuraDef; icon: string };
  mods?: { max_hp?: number; speed?: number; capacity?: number };
}
interface Ability {            // today's fields plus:
  rank2: AbilityUpgrade;       // §1.4 upgrade menu
  heavy?: boolean;             // impact tier "heavy" (§1.6); at most 2 per pool
  clip: ClipName;              // §1.8
  vfx: { cast?: string; travel?: string; impact?: string; zone?: string }; // keys into the FX registry (§1.7)
  when?: MoveCondition;        // movement riders, below
}
interface Ult extends Ability { charge: number /* fill multiplier 0.8–1.25, tuned by the harness */;
  anticipation_ms: number /* 250–600 */; impacts: "first" | "first-last"; rank2: AbilityUpgrade; rank3: AbilityUpgrade }
```

**Effect primitives.** Kits reuse the existing primitives. Known additions every kit can use:
- `allies` radius on heal, shield and buff: in solo only the caster is affected; in a future group, allies inside the radius are too. Every support effect states its radius now so it works in groups later.
- Movement riders (below).
- A new mechanic a kit needs (a pull, a chain, a persistent zone, a channel) becomes one more shared primitive with tests, never a per-subclass controller (combat content rule, Ponytail).

**Movement hooks.** The dash, slide, jump and momentum belong to everyone (`specs/movement.md`, `specs/movement-slide.md`); no ability duplicates them (no plain "dash 4 u" utility that is just the Q dash). Abilities may *use* them:

| Hook | Meaning | Numbers |
|---|---|---|
| `when: "sliding"` | Cast during a slide (sim mode `slide`) | The slide continues; the cast plays on the upper body (§1.8) |
| `when: "airborne"` | Cast in the air | Instant abilities only; a 0.25 s hang at the cast; drawn abilities need the ground |
| `when: "afterDash"` | Cast within 0.35 s after a dash ends | |
| `when: "fast"` | Cast while moving faster than 9 u/s (above a run) | |
| `scale: "speed"` | Power scales with carried speed | +0 at 7.4 u/s (walk) up to the rider's stated maximum at 16 u/s |
| `momentum` effect | Adds carried speed along the aim | At most +4 u/s per cast, never above `momentumCeiling` 18 u/s; in the ruins it bleeds like the dodge (`DODGE_SHAPE`: 5 u/s², no grace) |
| `launch` effect | A small vertical hop | 0.4–0.9 u, no i-frames |

Rules: ability movement never grants i-frames unless the ability says so (at most one i-frame ability per pool, cooldown 8 s or more); no ability resets or refunds the Q dash; ability movement respects walls (the encounter's `free` check); a slide still faces its travel, so a slide cast fires along the aim without turning the body.

**Drawn abilities.** Which of the 8 are drawn runes is per subclass (rows 52, C2). Rules unchanged: 25% energy at the start, the rest on release, fizzle under 50%, enhanced at 95%+, a dodge cancels. An ult is instant by default; if David makes an ult drawn, the meter empties only on a successful release and a fizzle or cancel keeps 75% of it.

### 1.2 Ult meter

| Topic | Rule |
|---|---|
| Range | 0–100. At 100 the ult is ready; further charge is lost. |
| Dealt | Every hit you or your units land charges `0.7 × raw ÷ baseHit` points, at most 6 per hit. `raw` is the hit before enemy defense and armor, so the armoured boss doesn't starve the meter; `baseHit` is your own base hit (§1.1), so gear, level and stats never speed it up. Ult hits charge nothing. |
| Taken | Damage aimed at you charges 40 points per 100% of your max HP, counted **before** your guard, block and shield, so blocking never costs charge. |
| Healed and shielded | Health actually restored and shield that actually absorbs a hit, on you or (later) an ally: 50 points per 100% of the target's max HP. Overheal and unused shield charge nothing. |
| Per-kit tune | `ult.charge` (0.8–1.25) multiplies all three, set from the harness so every subclass fills in the target. |
| Target | 60–90 s of fighting per charge; median about 75 s on the sanctum run. At about 2 base hits per second that is 0.7 × 2 = 1.4 points/s → 71 s; taken adds about 0.1/s on the sanctum. |
| Between fights | Kept for the whole ruins visit, between encounters and missions. No decay. |
| Reset | Empties on defeat and when you leave the ruins. Starts at 0 on entry. |
| Use | F (remappable). Needs the signature weapon in hand, the caster alive, not drawing a rune, outside the safe zone. Buffered 150 ms like the slots. |
| Protection | The caster has i-frames from the press to 200 ms after the ult's freeze (§1.6), so no hit lands unseen during the freeze. |
| HUD | A round ult slot right of slots 1–4, 1.4× their size, in the cream kit. A clockwise fill ring in the subclass core colour; the ult icon greyed until full. At 100: full-colour icon, the ring glows and pulses once every 2 s, a ready chime, and one soft 300 ms glow along the screen's bottom edge (not a flash). The bound key on the slot. Tooltip: name, effect, numbers. |
| Multiplayer-forward | The meter is player state built from that player's own events, so the server can rebuild it from the event stream once combat is authoritative. No feeding or sharing: each player charges from their own dealt, taken, healed and shielded. The ult is an event `{caster, ult, x, z, aim, seed, t}` every client plays. |

### 1.3 Loadout

| Topic | Rule |
|---|---|
| Pool and slots | Choose 4 of the unlocked pool for slots 1–4. Locked abilities show their mastery level. |
| Default | Mastery 1 equips the 4 starters. New unlocks don't auto-equip: a "New" tag in the sheet and a banner (§1.4). |
| When | Outside combat only. **In combat** = an enemy is chasing or attacking you, a wave is running or the boss is engaged, and for 5 s after the last of these. In combat the sheet opens read-only: "Leave combat to change your loadout." |
| Where | Anywhere: village, home, ruins (gate camp and between fights). The ruins gate is no longer the only place. |
| Per subclass | Stored with the subclass's mastery row (§1.4), so switching subclass and back restores it. |
| Swapping in | An ability swapped in starts ready (swaps are out of combat, so no exploit). Summons and totems whose ability leaves the loadout are dismissed (existing row 50 rule). |
| Server | `setLoadout` checks: 1–4 distinct keys, each in this subclass's pool, each unlocked at the current mastery. Idempotent. |

**Loadout sheet** (cream kit, row 283). Opens from the Path sheet's Loadout tab, from the ruins HUD (click the ability bar) and with **P** (Path; free in the menu map).
- **Top:** subclass icon, name, mastery level with an XP bar to the next level, and the next unlock ("Mastery 6: Ability 7").
- **Pool:** 8 cards in 2 rows of 4. Each shows the icon, name, rank (I or II), cooldown, energy, a "Rune" tag for drawn ones and a "Heavy" tag. Locked cards are dimmed, with "Mastery N".
- **Detail panel** for the selected card: the full description with every number, the rank II change (greyed until unlocked), and the movement rider if any.
- **Equipped row:** slots 1–4 with their bound keys, the ult slot (fixed, shown for reference), the passive.
- **Interaction:** drag a card onto a slot, or click a card then a slot; a slot's ✕ clears it. Keyboard: arrows move, Enter picks, 1–4 place. Touch: tap card, tap slot.
- **Look:** the cream panel, ink outlines, the subclass colour only on the icon rims and the equipped row's underline. No dark glass.

### 1.4 Mastery 1–20

| Topic | Rule |
|---|---|
| Scope | One mastery level per subclass, per member. Kept when you switch away; switching back resumes it. Needs the subclass (character level 10). Independent of character level and stats. |
| Sources | The same XP the ruins already pay, credited to the subclass active when the server records it: kills (inside the 6,000/h kill cap, which also caps mastery), mission completions, the guardian kill. Club event XP (row 23) raises character level only, not mastery (brief: "earned in the ruins"). |
| Curve | Mastery XP from M to M+1 = 800 + 300 × (M − 1). Total to 20: **66,500**. |
| Pace | At an assumed 3,000 mastery XP per hour of ruins play (daily missions plus kills): the full pool of 8 at mastery 8 in about **4 h**, mastery 10 in about 6 h, mastery 20 in about **22 h**. A member doing the daily missions (about 6,200 XP in roughly an hour) reaches 8 on day 2; 2 h a week reaches 20 in about a semester. The real pace is measured at the playtest and the curve retuned. |
| Power budget | Mastery adds options, not raw power: the median subclass at mastery 20 (best loadout) deals at most 1.2× its mastery-1 DPS in the harness (§3). |

**Curve checkpoints**

| Mastery | 2 | 4 | 6 | 8 | 10 | 12 | 15 | 18 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| Total XP | 800 | 3,300 | 7,000 | 11,900 | 18,000 | 25,300 | 38,500 | 54,400 | 66,500 |
| Hours at 3,000/h | 0.3 | 1.1 | 2.3 | 4.0 | 6.0 | 8.4 | 12.8 | 18.1 | 22.2 |

**Unlock template** (identical shape for all 16; each §2 section names which ability fills each step)

| M | Kit | Identity and cosmetics |
|---|---|---|
| 1 | Starters 1–4 (rank I), ult rank I, passive rank I | Signature weapon tier 1, class icon, title "*Subclass*", base aura |
| 2 | Ability 5 | |
| 3 | Rank II: first in the upgrade order | |
| 4 | Ability 6 | |
| 5 | Rank II: second | Bronze mastery nameplate frame |
| 6 | Ability 7 | |
| 7 | Rank II: third | |
| 8 | Ability 8 (pool complete) | |
| 9 | Rank II: fourth | |
| 10 | Ult rank II | Aura tier 2 (a soft ground ring), title "Adept *Subclass*" |
| 11 | Rank II: fifth | |
| 12 | Rank II: sixth | |
| 13 | | Mastery weapon trim (the subclass's own skin) |
| 14 | Rank II: seventh | |
| 15 | Rank II: eighth | Silver mastery frame |
| 16 | Passive rank II | |
| 17 | | Mastery aura colour |
| 18 | Ult rank III | |
| 19 | | The mastery trim gains its glow part |
| 20 | Mastered | Gold frame, aura tier 3, title "Master *Subclass*", a mastered badge on the profile |

**Upgrade menu.** Each rank II is one of these, worth about +15% of that ability's value; ult ranks II and III about +10% each; passive rank II about +25% of the passive or one rider:
- +20% power (or heal, shield, duration);
- −20% cooldown;
- a rider: one more projectile or target, a status added (≤ 1 s hold or ≤ 30% slow), a lingering zone (≤ 3 s), a bigger area (+25% radius), or a movement rider (§1.1).

**Feedback.** A level-up banner in the cream kit ("Elementalist mastery 6 · New ability: …"), a short sting, the XP bar on the ruins HUD (thin, under the ability bar), and the Path sheet's next-unlock line.

**Data model** (one new migration, §4):
- `member_subclass_mastery`: `member_id` (FK profiles, cascade), `subclass` text, `xp` bigint ≥ 0, `mastery` int 1–20 with `CHECK (mastery = combat_mastery_for_xp(xp))`, `loadout` text[] (≤ 4), `cosmetics` jsonb (equipped `weapon_skin`, `aura`, `frame`), `updated_at`; primary key (`member_id`, `subclass`). Service-role writes only, members read their own; mastery level and equipped cosmetics are public with the profile.
- `combat_mastery_for_xp(xp)`: the curve, immutable, mirrored by `lib/combat/mastery.ts` with a test keeping them identical (the XP-curve pattern already used).
- `combat_xp_ledger.subclass` (new nullable column): the subclass credited. `combat_record_kill`, mission completion and the boss reward credit the active subclass's row in the same transaction, idempotent on the existing keys.
- Mastery cosmetics are **derived** from the level (no rows). Shop cosmetics are owned rows (§1.10).
- `member_progression.loadout` is copied into the active subclass's row at launch and stops being read; dropping the column is a later migration.

### 1.5 Signature weapon rule

| Topic | Rule |
|---|---|
| Requirement | Each subclass has exactly one signature weapon type, and that type belongs to it alone (16 types, 16 looks). Abilities and the ult need it in hand. Supersedes row 31's any-weapon rule for abilities. |
| Without it | Any other owned weapon still swings or shoots its basic attack (the tool wheel picks it, row 279), but slots 1–4 and F grey out with "Hold your *weapon*". The `gear.without` partial-power rule is retired. |
| Never stranded | The tier-1 signature weapon is granted at subclass choice and never deleted; at 0 durability it still works at half damage (row 229). The wheel lists signature weapons first. |
| Tiers | Tiers 1–5 per signature type, damage by `TIER_BASE` as today; scaling stat per type (decided per subclass). |
| Getting tiers | T1: granted at the choice. T2: shop, 400 coins (your type only). T3: workshop recipe (ruins materials plus coins). T4: the guardian's Epic drop (20%), rolled as your signature type. T5: the guardian's Legendary drop (4%), rolled as your type; Gem chests later (rows 18, 21). Boss gear still drops only if not owned. |
| Repick carry-over | After a repick (§1.11) the new type is granted at the highest tier of any signature weapon you own, so a redo never costs gear progress. Old signature weapons stay owned. |
| At launch | Existing members get their signature weapon at the highest tier of any weapon they own today (an iron sword counts as tier 2, a guardian drop as tier 4), so earlier progress carries. |
| Common weapons | Today's generic weapons (driftwood and iron sword, willow and yew bow, brass revolver, oak and rune staff, tome, boss drops) stay owned and usable for basic attacks. The gate stops granting the bow, staff and tome starters; new members get the tier-1 signature weapon instead. |
| Look | One base mesh per subclass. Tiers read from one shared trim kit on that mesh: T1 wood/cloth, T2 iron, T3 rune-etched, T4 gold trim with a glow part, T5 animated runes on the glow part. Metal and glass take sun specular (row 237); glow parts are emissive; the character stays matte (row 264). |
| Carry | Village: carried on the back or hip in a per-weapon rest pose (row 140). Ruins: in hand with a per-weapon hold pose. |
| How a new member gets it | At the level-10 choice the Oracle ceremony (§1.11) ends with the weapon forming in the subclass colour in front of the player (a "heavy"-tier impact, §1.6), then it goes to the back. The server grants it in the same transaction as the choice. The shield, the carried totem and the fist wraps have no model today; whichever signature types need them get them in their family's wave. |
| Basic attack per type | Each new type picks one of the existing basic-attack kinds (melee arc, arrow, bolt, summon) with its own cooldown, range, arc and speed in `data.ts`, its own swing clip and trail. |

### 1.6 Impact frames

Four tiers. A hit uses the tier of its source; overlapping hitstops merge (the longest wins, they never add), and total hitstop is capped at 200 ms in any second.

| Tier | Used by | Hitstop | Shake (u, start) | Flash | Speed lines | FOV | Extra |
|---|---|---|---|---|---|---|---|
| Light | Weapon basic hits | 60 ms, melee only (today) | 0.035 melee, 0 ranged | The enemy's hit flash | None | 0 | A small spark sprite |
| Ability | Ability hits | 70 ms melee; 40 ms on the first target of a ranged or area hit | 0.05 | The enemy's hit flash | None | 0 | A spark burst in the ability's ramp |
| Heavy | Abilities flagged `heavy`, crits from them, elite kills, the weapon reveal | 100 ms | 0.10 | A 2-frame white flash on the hit enemy only | 8–12 short world-space lines around the target, 200 ms | +1.5° | A small shock ring |
| Ult | The ult's first hit (and its last, when `impacts: "first-last"`), and the boss defeat | The full sequence below | | | | | |

**The ult sequence**, in ms from the press (A = the ult's `anticipation_ms`, 250–600):

| Beat | When | What | With "Reduce flashing" |
|---|---|---|---|
| Press | 0 | The ult clip starts; caster i-frames on; the meter drains with a sweep; the press sound | Same |
| Anticipation | 0 → A | The world outside a 3 u circle round the caster dims to 75% (a vignette overlay); FOV eases −3° (push-in); charge particles converge on the weapon; a ground glyph draws in under the caster; a riser sound. Enemies keep acting at full speed (the caster has i-frames) | Dim to 85% |
| Freeze | A → A+120 | Hard freeze: the encounter tick, particles and every animation stop; the caster holds the clip's impact key | Same |
| Flash frame | A → A+50, inside the freeze | Full-screen high-contrast frame: the scene posterised to two tones, ink (#1d1a24) silhouettes on the ult's core colour, then cut straight back | A 25% darken and desaturate instead; no brightness spike |
| Speed lines | A → A+350 | 32 radial lines centred on the impact point's screen position, thick to thin, ink with a white edge, scaling 0.9 → 1.15 and fading over the last 150 ms | 50% opacity, no white edge |
| Shake | A+120 → A+620 | Heavy shake 0.35 u decaying (exp 9/s), plus a 0.15 u kick along the hit direction | Follows the Screen shake setting |
| FOV | A+120 → A+520 | Snaps +5° wider, eases back over 400 ms | Same |
| Target hitstop | A+120 → A+200 | Each target hit holds 80 ms with a full white hit flash and a 0.05 u jitter | Hit flash at 50% |
| Slow motion | A+120 → A+570 | The world at 0.3 speed for 250 ms, easing back to 1 over 200 ms | Same |
| Follow-through | A+120 → end | The ult's own effects play out; ult damage numbers in the large style; the ground decal lingers 4 s | Same |
| I-frames end | A+320 | | |

**Rules**
- **Flash limit:** at most one full-screen flash in any 1,000 ms, from any source. Within WCAG 2.3.1's three flashes per second, even if two ults land together later.
- **Order:** overlays (dim, flash, lines) draw in the UI layer after the scene's pixelation pass, so they stay crisp; world effects draw inside it.
- **Camera:** the camera never yaws on its own (the player owns the mouse-look camera, rows 277–282). Only FOV, the push-in and shake move it.
- **Single player (today):** the freeze, hitstop and slow motion pause or scale the encounter tick, the way `combat.hitstop` does now.
- **Multiplayer-forward:** these become local presentation. The shared simulation never pauses; the caster's i-frames cover the local freeze. Another player's ult within 20 u shows that player's ground effects, speed lines at 50% and a 30% shake, with no flash and no freeze.

**Settings** (Settings sheet, a new Accessibility group):
- **Reduce flashing:** a toggle, default off, defaulting on when the OS asks for reduced motion. It applies the right-hand column above everywhere, including the heavy tier's enemy flash (50%) and bloom spikes (capped).
- **Screen shake:** Full / Low (50%) / Off. Default Full; Off when the OS asks for reduced motion (today's rule).

### 1.7 Anime VFX framework

Every ability gets anime-style effects built from five layers. The look: hard-edged cel shapes, two or three tone bands, a white-hot core, a coloured mid band and a darker edge; bold silhouettes that read through the pixel filter.

| Layer | How it's built | Notes |
|---|---|---|
| Painted flipbooks | A **combat pack** atlas, `combat-pack.webp`, built by extending `art/fx/build_pack.py` (its own atlas beside `move-pack.webp`; 8 frames of 128 px per row, up to 32 rows, 1024 × 4096). Painted procedurally in numpy like the move pack, no downloads, seeded and byte-identical. Frames store a grayscale *heat* value; the shader maps it through the effect's 3-stop ramp, so one atlas serves every colour. | Wave 0 builds the base rows: impact star, slash arc, spark burst, shock ring, dark smoke, energy swirl, glow halo, speed line, debris chunk, rune glyph, light mote, crack decal. Each family wave adds the rows its kits need. |
| Meshes with an emissive shader | One shared `FxMaterial`: ramp lookup, scrolling noise mask, dissolve threshold, fresnel rim, vertex alpha; additive or alpha blend; not tone mapped. Used on shock rings, beams, pillars, domes, spikes, projectile cores, low-poly modelled shapes (ice, bone, roots, light shards). | A painted glow halo sprite sits behind every bright core, so magic glows with bloom off (bloom defaults off, `graphicsSettingsStore.ts`). |
| Trails | Ribbon meshes from two sockets on the weapon (base and tip) for swings; projectile trails (the existing pattern); the movement kit's afterimages for fast ability motion. | |
| Ground decals | Flat quads at ground height (like today's blasts): scorch, frost, rune circle, crack, root mat. | At most 16 live, 4 s maximum. |
| Screen overlays | Dim, flash frame, radial speed lines, the ult-ready edge glow. | The caster's own ult only (§1.6). |

**Budgets**

| Effect | Particles | Meshes | Decals | Lights | Life |
|---|---|---|---|---|---|
| Ability | ≤ 60 | ≤ 3 | ≤ 1 | 0 | ≤ 1.2 s (zones: their duration) |
| Heavy ability | ≤ 120 | ≤ 5 | ≤ 1 | 0 | ≤ 1.5 s |
| Ult | ≤ 300 | ≤ 8 | ≤ 2 | ≤ 2 point lights, pooled | ≤ 3 s, decal 4 s |

- **Whole scene:** one combat particle pool of 1,024 (the `ParticlePool` pattern: typed arrays, nothing allocated per frame), combat effects at most 40 extra draw calls, the effect update at most 1 ms CPU per frame in a 17-enemy fight.
- **Lite graphics:** half the particles, no lights, no radial blur.
- **Acceptance:** 30 FPS minimum on integrated graphics in the worst case (a full pack fight with an ult), row 39.

**Readability rules**
- **Enemy telegraph language is reserved.** Enemy markers (combat polish 6) are shapes that *fill up* with a solid rim: red melee sectors (#ff4538), yellow ranged lines (#ffc43a), magenta area rings (#ff4fc8), the boss's violet (#8a6cff). Player ground effects never use a filling shape with a solid rim and never use those four hues at full saturation. They burst or fade *outward*, are textured (glyphs, cracks, roots), and draw at most 50% saturation on the ground.
- **Conflicting families:** Arcane purple sits near the boss violet and Vanguard yellow near the ranged telegraph. Their ground effects lean on the ramp's white core and a glyph texture, not a flat fill.
- **Draw order:** player effects draw under enemy markers. Where they overlap a marker, they drop to 60% opacity.
- **Others:** enemy projectiles keep their own look. Effects never cover an enemy's telegraph glow parts.

**Multiplayer-forward**
- Every effect spawns from an event: caster, ability key, phase (cast, travel, impact, zone), position, aim and seed. The renderer looks the recipe up in the FX registry (`lib/game/fx/combat.ts`, data-driven).
- Effects are anchored to the caster and seeded like `particles.ts`, so every client draws the same effect.
- Only screen overlays read "the local player".

### 1.8 Animation

| Topic | Rule |
|---|---|
| Rig and tools | Hand-keyed on the locked rig in `art/characters/base/build_clips.py`, built headless (`--background --python`); never the live Blender MCP window the avatar work uses. |
| Grip families | Clips are authored per grip family: one-hand, two-hand/staff, bow, pistol, fists, shield + weapon, book, totem, plus any a new type needs. Each grip family gets a hold idle, a run-hold upper-body layer, a basic attack (1–3 hit combo) and the **verb library** below. |
| Verb library | About 16 shared verbs, each per grip family: cast forward, cast up, slam, thrust, spin, leap strike, throw, summon gesture, channel (loop), guard (hold), kick, sweep, plant, draw-back shot, quick shot, backstep. An ability uses a verb with its own timing scale and VFX. |
| Unique clips | Per subclass: the ult clip (always unique, with a clear anticipation pose and an impact key for the freeze) and up to 3 unique ability clips. |
| Upper-body layer | New in the character mixer: casts and shots play on the upper body over locomotion and slides (a bone mask from the spine up). Full-body clips: leaps, slams, spins, the ult. Today every attack is full-body. |
| Transitions | The existing transition table (`clips.ts` `crossfade`) gets a combat row: into an ability 0.04–0.06 s, out to locomotion 0.1 s; hits stay instant. |
| Matte | No emissive on the character. Glow comes from the weapon's glow part, the VFX and the aura. |

### 1.9 Aura, nameplate and profile

| Topic | Rule |
|---|---|
| Aura | Replaces the family aura (`FamilyAura.tsx`) with a subclass aura. Same budget: at most 10 motes, size 0.12–0.22 u, alpha ≤ 0.8, no lights. A subclass mote sprite from the combat pack (shape per subclass) with its own drift (orbit, rise or fall), in the ramp's mid colour. |
| Aura tiers | Tier 1 at mastery 1; tier 2 at 10 adds a soft ground ring at the feet; tier 3 at 20 adds a second mote type. |
| In combat | The aura drops to 40% so it never competes with telegraphs. |
| Toggle | "Show my aura" (today's "Show my family aura") hides it on your own screen; others still see it at 70%. Principle 7: senior members can mute it. |
| Nameplate | Name, then the class icon (24 px) and the title under it ("Adept Elementalist"). The equipped frame (§1.10, mastery frames §1.4) borders the plate. The level and member dot stay as today. A "Show class on my nameplate" toggle hides icon and title for everyone. |
| Class icons | 16 flat emblems on a cream disc: ink outline, the family colour plus the subclass motif. Readable at 24 px. Used on the nameplate, profile, Path sheet, Oracle and HUD. |
| Profile | Portal profile and phone companion (no 3D, row 28): class icon, subclass, mastery level and title, equipped frame, and a strip of other subclasses with mastery above 1. |
| Principle 4 | Outside the ruins a subclass is cosmetic only: aura, nameplate, carried weapon. No peaceful activity, shop, club tool or quest checks the subclass. |

### 1.10 Shop cosmetics

Three new shop categories (`shop_items` category check extended in the migration):

| Category | What it changes | Applies to | Coins | Gems |
|---|---|---|---|---|
| `weapon_skin` | The signature weapon's materials and trim (never its stats); the tier still shows in the UI | One subclass's weapon, all tiers | 800 | Animated skins (glow, particles): 200 |
| `aura` | The aura's 3-stop ramp (a colour set) | Whichever subclass is active | 300 | Two-tone shimmer sets: 150 |
| `frame` | The nameplate frame | Any | 250 | Animated frames: 120 |

- **Coins and Gems:** mostly coins; about one item in four is Gem-priced (row 290). Gem prices are plain numbers beside the merch corner's (150–600); no CAD value, ratio or conversion appears anywhere (CLAUDE.md, row 290).
- **Ownership:** owned items live in `member_inventory` like other shop items. The equipped item per subclass lives in `member_subclass_mastery.cosmetics`.
- **What the shop can't sell:** mastery cosmetics (bronze, silver and gold frames, the mastery trim, the mastery aura colour). Seasonal-event cosmetics stay rewards only (row 256). Chest rolls with skins come later with shown odds (rows G1, 30).
- **Admin cadence (principle 8):** T1/T2 add cosmetics through the existing catalogue editor. An aura colour is three hex values (no art); a frame is a 9-slice image; a weapon skin is a material set authored in the art pipeline for that subclass's mesh.

### 1.11 Oracle: suggestion, choice, redo

**Mechanism**
- The reading already computes a type. A data table `SUBCLASS_FOR_TYPE: Record<Type, SubclassKey>` (`web/lib/oracle/subclass.ts`) maps it to one suggested subclass.
- A test enforces: every type maps to exactly one subclass, every subclass appears exactly once, and each subclass is in its type's family (row 19).
- Within a family the temperament fixes two letters, so two dichotomies choose among the four:
  - NT and NF: E/I and J/P;
  - SJ and SP: E/I and T/F.
- **Low clarity:** if either deciding dichotomy has clarity under 15%, the sheet shows the two closest subclasses ("The light flickers between …") and highlights the stronger.
- Each type has one authored keeper line that gives the reason in plain words.

**The map** (filled with David as each subclass is designed):

| Type | Family | Suggested subclass | Keeper's reason |
|---|---|---|---|
| INTJ | Arcane | | |
| INTP | Arcane | | |
| ENTJ | Arcane | | |
| ENTP | Arcane | | |
| ISTJ | Ranger | | |
| ISFJ | Ranger | | |
| ESTJ | Ranger | | |
| ESFJ | Ranger | | |
| ISTP | Vanguard | | |
| ISFP | Vanguard | | |
| ESTP | Vanguard | | |
| ESFP | Vanguard | | |
| INFJ | Warden | | |
| INFP | Warden | | |
| ENFJ | Warden | | |
| ENFP | Warden | | |

**The choice** (level 10, Path sheet at the temple):
- The four subclasses of your family as cards: icon, fantasy line, role, signature weapon, ult name, and a short looping preview of the ult.
- The suggested one is first, marked "The Oracle suggests", with the keeper's reason. Any of the four can be chosen (a suggestion, not an assignment).
- Confirming takes two steps; the second says "Locked until you redo the Oracle (250 coins, 7 days after your last reading)."
- Then the ceremony: light in the subclass colour, the class icon over the family sigil, a keeper line, the signature weapon forming (§1.5), mastery 1 and the 4 starters equipped.

**The lock and the redo** (row 287):

| Rule | Detail |
|---|---|
| Locked | After the choice, the subclass can only change through a redo. |
| Redo | Pay 250 coins at the Oracle, at least 7 days after the last result (`retake.ts`, unchanged). Take the full reading again. The result can change the family (row 19). Then choose any of the four in the resulting family, suggestion highlighted. One payment covers both. |
| Repick token | A completed paid reading grants one repick, stored as `member_progression.repick_source` (`oracle` or `launch`, null when none). `combat_choose_subclass` with a subclass already set requires and consumes the token in the same transaction, idempotent on its key. Leaving without choosing keeps the token. |
| Fee removed | The separate 250-coin subclass change goes: `subclass_respec_fee` and `SUBCLASS_RESPEC_FEE` are retired, and the Path sheet stops quoting it. |
| What a repick keeps | Mastery stays with each subclass. The new type's weapon comes at your highest signature tier (§1.5). The loadout comes from the new subclass's mastery row (its starters the first time). |

**Existing members at launch**
- They keep their subclass and start at mastery 1: a mastery row at 0 XP, loadout reset to the 4 starters.
- They get their signature weapon at the highest tier they own (§1.5).
- They get **one free repick** (`repick_source = 'launch'`): choose any subclass in their current family, with no reading, no fee and no wait. It never expires. Changing family still takes the normal paid redo.
- A letter in the mailbox explains the new paths and the free repick.
- Members below level 10 are unaffected until they reach it.

### 1.12 Roles

Soft roles for future co-op (row 286). Every subclass has one primary role, and every subclass solos.

| Role | In a future group | Solo, by itself | Kit budget (within the §3 band) |
|---|---|---|---|
| Tank | Holds enemy attention (threat ×2.5 on its hits; taunt effects force targeting for their duration), the most mitigation, staggers elites and the boss, protects others with frontal guards and zones | Outlasts: the lowest damage taken, slower clears | DPS 0.80–0.95× median; sanctum damage taken the lowest |
| Healer | Heals and shields others (heal and shield effects target the lowest-health ally in `allies` range; solo, the caster); healing generates 0.5 threat per HP | Sustains itself with an active offensive loop (G2: never passive waiting) | DPS 0.80–0.95× median |
| Damage | The most damage, burst windows, executes | Kills fastest, relies on the dodge | DPS 1.00–1.20× median |
| Support | Buffs allies (damage, speed, energy in `allies` range), debuffs and controls enemies (marks, slows, holds), summons and zones that draw attacks | Control keeps enemies off; marks raise its own damage | DPS 0.90–1.05× median |

- **Threat:** threat is a multiplayer system for later. Today enemies chase the player or the nearest taunting unit, as now. The role's threat numbers live in kit data now so groups need no kit rewrite.
- **Role map** (filled per subclass): Elementalist ·, Illusionist ·, Necromancer ·, Transmuter ·, Marksman ·, Hunter ·, Sniper ·, Gunslinger ·, Guardian ·, Monk ·, Juggernaut ·, Assassin ·, Summoner ·, Shaman ·, Druid ·, Priest ·.

### 1.13 Keys

| Key | Rule |
|---|---|
| 1–4 | Slots, as today (`tsi.combatKeys`, the store bumps to v3 to add the ult). |
| Z X C V preset | An option in Settings. Inside the ruins, Z X C V fire slots 1–4 instead of their village actions: zoom stays on the scroll wheel, put-away is the tool wheel's centre, and camera reset is middle-click. Outside macOS, C is crouch/slide by default, so turning the preset on first asks to move crouch/slide (Ctrl in fullscreen, or any free key). |
| F | The ult, default F, remappable within the combat map. F stays decorate at home; the two never share a scene. |
| P | The Path sheet (subclass, loadout, mastery, stats). |

Unchanged: Q dash/dodge, Space jump, R quick swap, Tab tool wheel, crouch/slide.

---

## 2. The subclasses

### 2.0 Section template (the coordinator fills one per subclass with David)

- **Fantasy** (2 lines), **role**, **MBTI suggestion** and the keeper's reason.
- **Signature weapon:** model concept, carry pose, hold pose, grip family, basic attack kind and numbers, scaling stat, how it reads.
- **Passive:** rank I, rank II.
- **Abilities table**, 8 rows in unlock order. Columns:
  - Name, and what it does with numbers: power, heal or shield, range, area, cooldown, energy, statuses;
  - drawn or instant, heavy or not, movement rider;
  - rank II;
  - clip (verb or unique);
  - VFX (layers from §1.7, described so an artist-agent can build it);
  - camera feel (impact tier).
- **Ultimate:** mechanics and numbers, `charge`, `anticipation_ms`, impacts, ranks II and III, the beat-by-beat sequence (§1.6 timings with this ult's content), unique clip, VFX, camera.
- **Mastery track:** the §1.4 template with this kit's ability order and upgrade order.
- **Aura and icon:** ramp (core, mid, edge), mote shape and drift, class icon motif.
- **Shop cosmetics:** 2–3 ideas (one Gem item at most).
- **Synergy and solo:** how it pairs with other roles; its solo loop.
- **Art and sound list** for its wave.

Today's kits follow as reference only. They are not proposals; every one is replaced. Family shared abilities, removed by row 286:
- Arcane: Blink (8 s, 20 energy, i-frame dash 5 u), Starfall (drawn binding rune, 16 s, 45: area r3.5 at aim, power 2.8, hold 2 s).
- Ranger: Tumble (7 s, 15, i-frame dash 4 u), Rain of Arrows (12 s, 30: area r3 at aim, power 1.5, slow 30% 2 s).
- Vanguard: Leap Strike (10 s, 25: dash 5 u then area r2, power 1.2), Second Wind (16 s, 25: heal 25%).
- Warden: Renew (12 s, 25: heal 20%, shield 6% 6 s), Verdant Covenant (drawn binding rune, 18 s, 45: area r4 round self, power 1.3, hold 2 s, heal 25%, shield 15% 6 s).

Balance figures are from `specs/evidence/combat-b/balance.md` (level 10, family preset, starter weapon: Arcane oak staff, Ranger willow bow, Vanguard driftwood sword or the Monk's wraps, Warden tome of small spirits).

### 2.1 Elementalist (Arcane)
*Design: pending.*

| Today | |
|---|---|
| Weapon affinity | Staff (suggested only) |
| Signature | Elemental Burst: drawn (spark), 10 s, 35 energy; area r2.4 at the aim, power 2.4; the element cycles fire → frost → lightning |
| Firebolt | 2.5 s, 15; projectile power 1.6, speed 16, range 10, splash 1.2; fire |
| Frost Nova | 10 s, 25; area r3 round self, power 0.9, hold 2 s; frost |
| Passive | Elemental Rhythm: a different element than the last adds 25% to that hit |
| Balance | Normal DPS 26.5, taken 46/min; sanctum DPS 16.8, taken 39/min, lowest HP 78% |

### 2.2 Illusionist (Arcane)
*Design: pending.*

| Today | |
|---|---|
| Weapon affinity | Staff, tome |
| Signature | Decoy Step: 10 s, 25; a phantom (50 HP, 3 s, draws enemies), then an i-frame slip back 2.5 u |
| Mirror Bolts | 3 s, 15; 2 bolts power 1.05 each, spread 0.15, speed 15, range 10 |
| Mass Confusion | 14 s, 30; area r3 at the aim, power 0.6, distract 2 s |
| Passive | Misdirection: +30% on distracted enemies (distracted, held, or near a phantom) |
| Balance | Normal 27.6, taken 27/min; sanctum 17.3, 30/min, 84% |

### 2.3 Necromancer (Arcane)
*Design: pending.* Ledger: Necromancer belongs to Arcane (row 32); its undead are distinct from the Summoner's companions (plan roster note); it needs a summon before its first kill (plan edge case).

| Today | |
|---|---|
| Weapon affinity | Staff, tome |
| Signature | Raise Shade: 8 s, 30; raises the freshest body within 8 u (dead under 20 s, never the boss) as a shade (60% of its HP up to 140, 20 s, power 0.55); with no body, a bone wisp (35 HP, 20 s, ranged power 0.45) |
| Bone Spear | 4 s, 15; piercing projectile power 1.4, speed 18, range 10 |
| Grave Chill | 10 s, 25; area r2.6 at the aim, power 1.0, slow 40% 3 s |
| Passive | Grave Tithe: an enemy death within 9 u heals 4% max HP |
| Mods | +1 summon capacity |
| Balance | Normal 34.9, 28/min; sanctum 20.5, 36/min, 92% |

### 2.4 Transmuter (Arcane)
*Design: pending.* Ledger: rows 34, 37, 40–42 (Rimuru reference). Abilities come from defeated monsters as body-part changes; the first defeat of a species teaches its basic trait; repeated defeats level it; trait mastery matters more than weapon quality; wings give short energy-limited glides within locked-area bounds; a starter trait before the first kill. Not built: rarer drops per species, wing flight. How traits fit the 8-ability pool and the signature weapon rule is part of its design.

| Today | |
|---|---|
| Weapon affinity | Fists, staff |
| Signature | Monster Aspect: 14 s, 30; transform 8 s, +40% damage, +15% speed |
| Own abilities | Its monster traits (`TRAITS`), each 2 s of body change plus: Fox Stride (starter; 6 s, 20, dash 5 u power 1.7, +25% speed 3 s), Crab Shell (12 s, 25, shield 18% 5 s, guard 25% 5 s), Spore Sac (8 s, 20, area r2.4 at aim power 1.2, slow 40% 3 s), Wisp Core (4 s, 15, 3 bolts power 0.6), Page Storm (8 s, 25, area r3 round self power 1.5), Golem Fist (12 s, 35, area r2.8 at aim power 2.4, hold 1 s). The guardian teaches nothing |
| Trait tier | Damage uses trait mastery instead of the weapon tier: 1 defeat → tier 2, 10 → 3, 30 → 4 (`member_progression.traits`) |
| Passive | Shed Skin: transforming grants an 8% max HP barrier for 4 s |
| Balance | Normal 26.7, 34/min; sanctum 19.0, 29/min, 86% |

### 2.5 Marksman (Ranger)
*Design: pending.* Ledger: distinguish it from Hunter, Sniper and Gunslinger (row 32 roster note).

| Today | |
|---|---|
| Weapon affinity | Bow, revolver |
| Signature | Focus Shot: 8 s, 30; piercing shot power 2.6, speed 30, range 14 |
| Double Tap | 4 s, 15; 2 shots power 0.8, speed 24, range 12 |
| Steady Aim | 14 s, 20; +25% damage and +15% crit for 6 s |
| Passive | Steady Stance: after 0.8 s standing still, +20% damage |
| Balance | Normal 36.8, 26/min; sanctum 20.0, 37/min, 85% |

### 2.6 Hunter (Ranger)
*Design: pending.* Ledger: the Hunter uses bows (row 32).

| Today | |
|---|---|
| Weapon affinity | Bow |
| Signature | Bow Volley: 8 s, 30; 5 arrows power 0.6 each, spread 0.1, speed 22, range 12 |
| Hunter's Mark | 12 s, 15; area r1.8 at the aim, power 0.3, mark +25% damage taken for 8 s |
| Snare Shot | 9 s, 20; shot power 0.9, hold 2 s |
| Passive | Marked Prey: +4% per consecutive hit on the same target, up to 5 |
| Balance | Normal 32.2, 11/min; sanctum 21.3, 25/min, 91% |

### 2.7 Sniper (Ranger)
*Design: pending.* Ledger: long range combined with traps (row 32).

| Today | |
|---|---|
| Weapon affinity | Bow, revolver |
| Signature | Tripwire: 10 s, 25; a trap at the aim (r1.2, 25 s, two at most) that holds the first enemy 3 s and hits power 0.8 |
| Long Shot | 6 s, 25; piercing shot power 2.0, speed 32, range 16 |
| Smoke Step | 10 s, 15; distract 0.5 s in r2.5, then an i-frame slip back 2 u |
| Passive | Long Sight: ranged damage up to +30% with distance, full at 12 u |
| Balance | Normal 32.0, 7/min; sanctum 16.2, 23/min, 89% |

### 2.8 Gunslinger (Ranger)
*Design: pending.* Ledger: a revolver and critical-chance build (row 32).

| Today | |
|---|---|
| Weapon affinity | Revolver (the brass revolver is tier 2 and crafted; the harness used the willow bow) |
| Signature | Fan the Hammer: 8 s, 30; 6 shots power 0.5 each, spread 0.3, speed 30, range 10 (70% without a revolver) |
| Trick Shot | 6 s, 20; piercing shot power 1.3, speed 30, range 12 (70% without a revolver) |
| Quickstep | 8 s, 15; an i-frame sidestep 4 u, +25% crit for 4 s |
| Passive | Hot Streak: a crit takes 1 s off Fan the Hammer, 3 times per use |
| Balance | Normal 29.5, 17/min; sanctum 13.6, 45/min, 74% |

### 2.9 Guardian (Vanguard)
*Design: pending.* Ledger: the Guardian uses a shield (row 32). The buckler (`shield-buckler`, tier 1) has no model and can't be obtained, so every Guardian blocks at half today.

| Today | |
|---|---|
| Weapon affinity | Shield, sword |
| Signature | Shield Counter: 15 s, 20; blocks 40% of frontal hits for 1 s (half without a shield); the first blocked hit is answered with a bash (cone 1.8 rad, r2.4, power 1.8, knock 5) |
| Shield Bash | 6 s, 20; cone 1.6 rad, r2.2, power 1.3, hold 0.8 s |
| Stalwart | 14 s, 20; guard 30% for 6 s and a 12% shield for 6 s |
| Passive | Bulwark: each blocked hit adds a 1% max HP barrier (5 s) |
| Balance | Normal 32.6, 22/min; sanctum 13.9, 27/min, 85% |

### 2.10 Monk (Vanguard)
*Design: pending.* Ledger: martial arts (row 32). The cloth wraps (`wraps-cloth`, tier 1) render nothing in hand.

| Today | |
|---|---|
| Weapon affinity | Fists |
| Signature | Flowing Strikes: 6 s, 25; dash 2.5 u (power 0.8 on the path), then a cone 2 rad, r2.2, power 1.4 (85% without wraps) |
| Palm Wave | 4 s, 15; piercing wave power 1.1, speed 16, range 7 |
| Iron Body | 14 s, 20; guard 45% for 6 s, heal 8% |
| Passive | Momentum: each hit +5% move speed for 2 s, up to 5 stacks |
| Balance | Normal 37.5, 39/min; sanctum 15.5, 49/min, 90% |

### 2.11 Juggernaut (Vanguard)
*Design: pending.*

| Today | |
|---|---|
| Weapon affinity | Sword |
| Signature | Ground Slam: 10 s, 35; area r3.2 round self, power 2.1, knock 4, hold 1 s |
| Charge | 9 s, 25; dash 6 u through a line, power 1.2 |
| War Cry | 16 s, 20; +25% damage for 6 s, guard 45% for 8 s |
| Passive | Unstoppable: hits never knock you back |
| Mods | +10% max HP |
| Balance | Normal 36.5, 16/min; sanctum 17.8, 55/min, 77% |

### 2.12 Assassin (Vanguard)
*Design: pending.* Ledger: lifesteal, fast movement, low survivability; no enemy-speed theft (row 35).

| Today | |
|---|---|
| Weapon affinity | Sword, fists |
| Signature | Blood Lunge: 6 s, 20; an i-frame dash 5 u through the target, power 1.7, then guard 30% for 2.5 s |
| Shadow Step | 9 s, 15; an i-frame dash 6 u, +30% crit for 3 s |
| Fan of Knives | 7 s, 20; area r2.6 round self, power 1.2 |
| Passive | Lifesteal: 8% of damage dealt returns as health |
| Mods | −15% max HP, +15% move speed |
| Balance | Normal 37.4, 34/min; sanctum 17.7, 59/min, 89% |

### 2.13 Summoner (Warden)
*Design: pending.* Ledger: multiple monsters at once (G3); the summoning weapon decides the minion types and a capacity stat limits the army, different minions coexisting (row 43); distinct from the Necromancer's undead.

| Today | |
|---|---|
| Weapon affinity | Tome |
| Signature | Call Companions: drawn (spark), 10 s, 35; two minions of the type the weapon selects (tome of small spirits → wisp: 40 HP, ranged power 0.38; warden's grimoire → fox) |
| Fox Pack | 12 s, 30; two spirit foxes (70 HP, power 0.4, cost 1 each) |
| Crab Bulwark | 16 s, 35; a bulwark crab (400 HP, draws enemies, power 0.45, cost 2) |
| Passive | Pack Bond: each other companion adds 5% to a companion's damage |
| Mods | +1 capacity (capacity 2 + Spirit/5 + 1), +25% max HP |
| Balance | Normal 36.8, 34/min; sanctum 24.3, 52/min, 88% |

### 2.14 Shaman (Warden)
*Design: pending.* Ledger: several active totems with different roles; placement and overlapping areas create bonuses (rows 44, G3). The cedar totem (`totem-cedar`, tier 1) is in the weapons table with no carried model; one totem prop model with tinted eyes and rings serves all three roles in combat.

| Today | |
|---|---|
| Weapon affinity | Totem |
| Signature | Totem Circle: 6 s, 25; an ember totem (90 HP, r3.4) burning power 0.55 per second |
| Mending Totem | 8 s, 25; heals 2.5% max HP per second inside |
| Warding Totem | 8 s, 25; slows 35% inside, shields 1.5% per second while your shield is under 25% |
| Caps | One totem per role, three at most |
| Passive | Resonance: where two circles overlap, both work 35% harder |
| Mods | +25% max HP |
| Balance | Normal 30.3, 11/min; sanctum 19.2, 27/min, 94% |

### 2.15 Druid (Warden)
*Design: pending.* Ledger: vines, roots and lifesteal (G3).

| Today | |
|---|---|
| Weapon affinity | Staff, totem |
| Signature | Rootbind: 7 s, 30; area r2.5 at the aim, power 1.9, hold 2.5 s |
| Thorn Lash | 3 s, 15; cone 1.4 rad, r3, power 1.5, slow 30% 2 s |
| Wild Growth | 12 s, 25; heal 15%, shield 8% for 6 s |
| Passive | Verdant Thirst: 6% lifesteal, doubled against held enemies |
| Mods | +25% max HP |
| Balance | Normal 26.8, 41/min; sanctum 18.7, 38/min, 91% |

### 2.16 Priest (Warden)
*Design: pending.* Ledger: holy attack spells such as a beam, plus very strong shields and healing, with an active solo damage loop (rows 45, G3).

| Today | |
|---|---|
| Weapon affinity | Staff, tome |
| Signature | Holy Beam: 4 s, 20; a 9 u beam 1.6 u wide, power 2.9 |
| Radiant Shield | 10 s, 30; shield 45% for 8 s |
| Mend | 10 s, 25; heal 30% |
| Passive | Sanctuary: healing past full becomes a shield (50% of the excess, up to 30% max HP) |
| Mods | +25% max HP |
| Balance | Normal 27.1, 65/min; sanctum 19.7, 54/min, 83% |

---

## 3. Balance targets

**The band** (combat polish 11), restated for unique kits and ults. Measured at level 10 with the family stat preset, the **tier-1 signature weapon**, mastery 1 (the 4 starters), the ult used whenever the meter is full:

| Target | Measure |
|---|---|
| Normal-mission DPS | Every subclass within ±25% of the median ("Hold the rune circle") |
| Sanctum damage taken per minute | Spread at most 3× ("Sanctum watch") |
| No outlier clears | No median clear under 0.7× the median, either run |
| The guardian | 4–6 minutes, in a **scripted boss run** (new, below) as well as the formula measure (`bossMinutes`) |
| Ult cadence | Median time to fill 60–90 s on the sanctum run for every subclass (45–90 s on the normal run) |
| Ult weight | A damage-dealing ult is 8–15% of a run's damage; it hits 12–18 power on a single target, or 6–10 per target in an area, or the equivalent over a sustained window |
| Roles | Inside the band, each role sits in its own range (§1.12): Damage 1.00–1.20×, Support 0.90–1.05×, Tank and Healer 0.80–0.95× the median DPS; tanks take the least on the sanctum |
| G2 | Warden stays the most reliable family on the sanctum (the highest average lowest-HP), and not the fastest |
| Mastery 20 | With each subclass's recommended mastery-20 loadout (its §2 section names it) and ult rank III: DPS within ±25% of the mastery-20 median; that median at most 1.2× the mastery-1 median; the guardian 3.5–5 min with tier 1 |
| Loadout spread | Across a sample of 10 random legal mastery-20 loadouts per subclass, none below 0.7× that subclass's recommended loadout on the normal run (no trap loadouts) |

**Authoring budgets** (guides for the §2 sections; the harness has the last word):
- **Basic attack:** about 2 power per second.
- **Single-target damage:** power ≈ 0.6 + 0.3 × cooldown (a 4 s ability ≈ 1.8, an 8 s ≈ 3.0). Area or pierce ×0.7. Each second of hold costs about 0.4 power.
- **Energy:** 5–8 per second of cooldown, 15 minimum, 45 maximum. Four equipped abilities at full cadence spend at most 18 energy/s, so energy matters.
- **Heal:** about 0.025 max HP per second of cooldown. **Shield:** about 0.04.
- **Control:** a hold of at most 2.5 s on normal enemies (resistances apply).
- **Mobility:** at most one i-frame ability per pool, with a cooldown of 8 s or more.
- **Heavy:** at most 2 heavy abilities per pool.

**How the harness changes** (`lib/game/combat/balance.ts`, `balance.test.ts`):
- **The bot:**
  - fires the ult at a full meter when 2 or more enemies are inside its area, or at the boss;
  - holds the tier-1 signature weapon;
  - uses the mastery-1 starters, or the mastery-20 recommended loadout;
  - meets movement riders on 30% of casts (a typical player's share of slide, dash and air casts).

  Unchanged: 60% dodges, about 80% runes, no kiting, 20 seeds, 240 s limit.
- **New measures:** ult fill time, ult share of damage, role, mastery-1 vs mastery-20 ratio.
- **A scripted guardian fight** on the same tick: bot rules plus the stagger window. Its time to kill sits beside `bossMinutes`.
- **Output:** `specs/evidence/combat-b/balance.md` gains the new columns. The band test pins the mastery-1 targets, the mastery-20 targets and ult cadence.
- **Process:** each family wave tunes data only (kit numbers, `ult.charge`), never systems, the polish 11 rule. The final pass in wave 5 checks all 16 together.

---

## 4. Build plan

All waves merge to `main` behind a `classes_v2` flag that stays off in production until wave 5. Today's kits stay live until then.

| Wave | Delivers | Depends on |
|---|---|---|
| **0. Shared systems** | Everything in §1, exercised by a dev-only test kit (8 placeholder abilities from today's primitives and one placeholder ult, under `?combat=demo`, never shown to members) | §1, §3, §4 approved |
| **1–4. One family each**, in the order David finishes designing them | Its four subclasses complete: kit data, weapons, clips, VFX, icons, auras, cosmetics, Oracle lines, balance rows, evidence | That family's four §2 sections and its MBTI rows |
| **5. Launch** | Backfill for existing members, the full balance pass, performance on reference hardware, the flag on | Waves 0–4 |

### Wave 0, in order (a commit each)
1. **Migration** `<timestamp>_classes_v2.sql` (after the latest on `main` at build time; never edit an applied one):
   - `member_subclass_mastery` and `combat_mastery_for_xp`;
   - `combat_xp_ledger.subclass`, and mastery credit in the kill, mission and boss functions;
   - `member_progression.repick_source`; `combat_choose_subclass` with the token rule, the signature grant and tier carry-over;
   - `weapons.subclass` and the `weapon_type` check widened to a pattern;
   - `shop_items` categories `weapon_skin`, `aura`, `frame`; loadout and cosmetic-equip functions per subclass;
   - `subclass_respec_fee` retired; the `classes_v2` setting;
   - smoke tests in the SQL chain.
2. **Rules:** `lib/combat/mastery.ts` (curve, unlock engine, derived cosmetics); the new kit shape in `kits.ts`; the signature gate; the ult meter rules; tests.
3. **Runtime:** the meter in the tick; the ult as an ability with i-frames; movement hooks and the `allies` field (no-op solo); the in-combat flag; the FX event queue.
4. **Impact:** the four tiers, the ult sequence, the flash limiter, Reduce flashing and Screen shake settings.
5. **VFX framework:** the combat pack builder and base rows, `FxMaterial`, weapon ribbon trails, decals, the overlay pass, the FX registry, the combat particle pool.
6. **Animation:** the upper-body layer in the character mixer, the verb library for the grip families today's weapons use, the combat transition row.
7. **UI:** the ult slot, the mastery XP bar and banner, the Loadout sheet, the Path sheet changes (no subclass fee, the repick token, the suggestion card), keys (F, P, the Z X C V preset).
8. **Identity:** the subclass aura renderer, nameplate icon, title and frame, profile fields, the shop categories with equip.
9. **Oracle:** `SUBCLASS_FOR_TYPE` with its test (the map stays empty until filled), the low-clarity pair, the choice ceremony with the weapon reveal.
10. **Harness:** the §3 changes.
11. **Evidence** `specs/evidence/classes/K0-*`.

### Waves 1–4 (per family)
- **Data:** the 4 kits in `kits.ts`; any new shared primitive the kits need, with tests; the recommended mastery-20 loadouts.
- **Migration:** `<timestamp>_classes_v2_<family>_seed.sql`, with the 4 signature types × 5 tier weapon rows and the family's shop cosmetic rows.
- **Weapons:** 4 base meshes, each with a glow part, carry and hold poses, grips, and the shared trim kit applied. Built headless.
- **Clips:** grip-family sets for any new grip, up to 3 unique ability clips per subclass, 4 ult clips.
- **VFX:** combat pack rows, meshes and decals for 32 abilities and 4 ults, within the §1.7 budgets.
- **Icons:** 32 ability, 4 ult, 4 passive and 4 class icons.
- **Identity:** 4 aura motes and ramps; mastery trims; 8–12 shop cosmetics.
- **Oracle:** 4 MBTI rows with keeper lines.
- **Balance:** the family's harness rows inside the band.
- **Evidence:** `K<n>-*`.

### Wave 5 (launch)
- **Migration** `<timestamp>_classes_v2_launch.sql`:
  - mastery rows for every member with a subclass, loadouts reset to the starters;
  - signature weapons at the highest owned tier;
  - `repick_source = 'launch'`;
  - the launch letter;
  - `classes_v2` on.
- **Balance and performance:** the all-16 balance pass and band test; the performance pass on integrated graphics (worst-case pack fight with an ult at 30 FPS or better).
- **Records:** `STATE.md` and ledger notes.
- **Cleanup:** the legacy family abilities and `gear.without` code deleted.

### Art list (totals for 16, when all sections are filled)

| Item | Count | Note |
|---|---|---|
| Signature weapon base meshes | 16 | Including whichever types need the shield, the carried totem or the fist wraps (no model today); one trim kit for tiers 1–5 |
| Carry and hold poses | 16 + 16 | |
| Ult clips | 16 | Unique |
| Unique ability clips | ≤ 48 | Up to 3 per subclass |
| Verb library | About 16 verbs × the grip families in use | Shared |
| Ability effects / ult effects | 128 / 16 | Built from the combat pack, `FxMaterial` meshes, trails, decals |
| Combat pack rows | 28–32 | 12 base in wave 0 |
| Icons | 128 ability + 16 ult + 16 passive + 16 class | Generated in one prompt family through the Higgsfield pipeline, cleaned to 128 px; David approves the style on the first family's set before the rest |
| Aura motes | 16 | Combat pack rows |
| Mastery trims | 16 (with glow states) | Material variants |
| Shop cosmetics | About 40 | Weapon skins need art; aura colours are hex; frames are 9-slice images |

### Sound list (source still David's decision)
- **Shared** (10): ult ready, ult press, impact boom layer, slow-motion in, slow-motion out, flash crack, mastery level-up, ability unlock, loadout equip, weapon reveal.
- **Per subclass** (about 14): basic attack (2 variants) and its hit, 8 ability casts (some shared by element), 3 ability impacts, ult wind-up, ult impact, ult tail.
- **Total:** about 230, fewer with sharing by element or weapon. Until a source is chosen, cues re-pitch the CC0 set as combat polish did, and the list goes to `public/audio/sfx/MANIFEST.md` as to-generate.

### Evidence per wave (`specs/evidence/classes/`)
- **Every ability:** a frame strip (anticipation, release, impact, follow-through).
- **Every ult:** a beat-by-beat strip matching §1.6, and a clip with Reduce flashing off and on.
- **Screens:** the Loadout sheet; the Oracle choice; nameplates and auras in the village; the HUD with the meter filling and ready.
- **Numbers:** balance table rows; FPS in the worst case (reference hardware named).
- **Tests:** per ability (effect, cooldown, energy, caps), the meter, the mastery curve, migration smoke, the repick token.

### Risks
| Risk | Mitigation |
|---|---|
| Art volume (16 weapons, about 176 icons, about 144 effects, about 64 unique clips) | Verb library, one trim kit, shared combat pack rows, one icon prompt family, a style gate on the first family |
| Integrated-GPU performance with ults in a full pack | §1.7 budgets, pooled particles, Lite tier halves, FPS measured each wave |
| Photosensitivity | The flash limiter, Reduce flashing, no brightness spike in the reduced frame, WCAG 2.3.1 check on the flash frame |
| Balance combinatorics (8 choose 4 = 70 loadouts × 16) | Recommended loadouts plus a 10-loadout sample per subclass; data-only tuning |
| Multiplayer later | Freeze and slow motion are local presentation; ults never depend on the freeze for gameplay; effects are event-driven and seeded |
| Rig limits (two-handed, shield plus weapon, off-hand sockets) | New sockets in wave 0 for the grip families in use; poses solved from the rig's frames as the revolver's were |
| Blender window contention | Everything headless |
| Key conflicts (F, Z X C V, C on Windows) | §1.13 rules; the binder enforces them |
| Two kit shapes during the build | The `classes_v2` flag; legacy code deleted in wave 5 |
| Existing members lose their loadout and start at mastery 1 | The free launch repick, gear carried at the highest tier, the launch letter |
| The mastery pace is a guess | Measured at the playtest, one curve to retune |

---

## 5. Open questions for David (shared parts only)

1. **Sound source.** The list is in §4. Options: the CC0 set re-pitched (today), Higgsfield Seed Audio (available), ElevenLabs (needs the Pro plan). *Until you pick:* re-pitched CC0 and a to-generate list.
2. **The flash frame's look.** Wave 0 shows three variants in the encounter: ink silhouettes on the ult's colour (default), inverted monochrome, and a white flash. You pick one for every ult.
3. **Start wave 0 early?** Wave 0 depends only on §1, §3 and §4. It can start as soon as you approve those, while the 16 kits are designed, or wait for the whole sheet (the brief's "one build"). *Default:* start on approval of §1, §3 and §4.

## Elementalist (LOCKED, David 2026-10-02)
- **Family:** Arcane (purple).
- **Role:** ranged AoE damage.
- **MBTI:** mapped at the end.
- **Weapon:** a staff whose crystal shifts to your last element; carried on the back.
- **Input:** keys 1–4 are elements. A single press casts that element's solo spell. Two quick presses (≤0.4 s, either order) cast that pair's combo.
- **Costs:** no cooldowns, energy only. Combos cost more than solos, and the pool and regen are tuned so you rotate instead of spamming the biggest spell.
- **Skills: 10, all on the keys.** No loadout for this class.

| Input | Spell | Type | Effect |
|---|---|---|---|
| 1 Fire | Fireball | AoE | Explodes at the aim; burns |
| 2 Water | Tidal Wave | Control | A wave that pushes back and soaks |
| 3 Earth | Stone Javelin | Single target | A heavy thrown boulder; big hit and stagger |
| 4 Wind | Gale Step | Movement | A wind dash that launches you and keeps momentum |
| Fire + Water | Steam Veil | Defense | A steam cloud around you; enemies inside miss |
| Fire + Earth | Molten Pillars | AoE / terrain | Lava pillars erupt in a line and leave lava behind |
| Fire + Wind | Fire Tornado | AoE | A burning tornado that wanders through the pack |
| Water + Earth | Spring Grove | Heal | A ring of flowers that heals you while you stand in it |
| Water + Wind | Riptide | Single target / movement | Pull one enemy to you, or hold to pull yourself to it |
| Earth + Wind | Rampart | Terrain | A stone wall that blocks shots; climbable, usable as a jump ramp |

- **Passive, Attunement:** alternating elements builds the ult meter faster. There are no reaction marks; the combos are the reactions.
- **Movement passive, Air Step (David, 2026-10-02):** in the air, press jump to blast wind beneath you and jump again. It costs mana and keeps your momentum, so it links into dash, slide-jump and glide chains (row 292). Tap Space in the air for Air Step; hold Space for the glider. Ruins only (class movement needs mana, which exists only in combat).
- **Resource:** every Elementalist attack costs mana, shown as Mana (the combat energy pool), so you have to save up.
- **Stat direction: max mana.** Like a Megabonk character, the Elementalist is built to want a bigger mana pool (and its regen), the "storage" for bigger rotations. Mastery raises it; areas and combo costs improve alongside.
- **Ultimate, Cataclysm (F, meter):**
  - **Charge:** 5 s, rooted, taking 50% less damage. A pop-up mash shows 3 numbers (1–4) at a time; press the front one fast, and the next slides in. Hits pulse that element into the sky; misses crack it.
  - **Telegraph:** while it charges, black storm clouds gather overhead and the area of effect glows on the terrain, warning the enemies.
  - **Release:** the sky darkens and time slows. A meteor impact with a flash frame, radial lines and a heavy shake. An earth shockwave launches the survivors, then a fire cyclone gathers them and slams them down.
  - **Damage:** scales with accuracy, from 50% with no hits to 150% for a perfect run.
- **Mastery:**
  - At 1: the 4 solos and 2 combos (Steam Veil, Fire Tornado).
  - The other 4 combos unlock at 3, 5, 7 and 9.
  - Upgrades from 10 to 20: bigger areas, cheaper combos, more mash notes and a higher ceiling.
- **Identity:**
  - A purple aura with motes of the four elements.
  - A staff icon on the nameplate.
  - Shop: staff skins and element-colour auras.

## Illusionist (LOCKED, David 2026-10-02)
- **Family:** Arcane (purple).
- **Role:** control / support trickster.
- **MBTI:** mapped at the end.
- **Weapon:** enchanted cards that float and fan around the hand. Basic attack (left click): thrown cards, a plain long-range mage attack. Most of the appeal is the tricking and swapping.
- **Skills:** 5 on keys 1–5, all equipped. David: "too many skills", so no pick-4 loadout.

| Key | Skill | Effect |
|---|---|---|
| 1 | Mirror Clone | A clone with real AI: it dashes around, strafes, throws cards, copies your animations and uses skills too. Max 2 (3 with mastery). Each has 30% of your HP, deals 40% damage and lasts 10 s. Enemies can't tell which is real. |
| 2 | Swap | Teleport into the clone under the crosshair; it takes your spot. Heals you 5% per swap. For coordinated attacks. |
| 3 | Mirror Ward | A 0.4 s timed parry against long-range attacks (anti-mage and anti-ranger). It reflects the shot back to its shooter. Look at a clone while parrying and the shot bounces through the clone, which amplifies it (×2 damage, faster, bigger) and sends it at the caster as a sure hit and crit. Missing the timing wastes the cooldown. |
| 4 | Trick Card | Throw a card; press again to teleport to it. Unlocks at mastery 3. |
| 5 | Vanish | Throw cards into the air and disappear. Getting close to an enemy, or attacking, reveals you. The first hit out of Vanish gets bonus damage. |

- **Momentum (row 292):** Swap and Trick Card keep your speed and direction, so you come out of a clone still sliding and a mid-air Trick Card keeps your arc.
- **Passive, "Who's Real?":** while clones are alive, 30% of enemy attacks go after a clone instead of you.
- **Ultimate, The Joker (F, meter):** pull out a Joker card and throw it. It becomes a huge mirror that sweeps across the field. Its path turns inverted colour, every entity in the path is scooped into the glass as a flat 2D image, and then the mirror shatters: flash frame, glass burst, heavy damage.
- **Mastery (clone mastery):**
  - At 1: Clone, Swap, Mirror Ward and Vanish; 2 clones, 10 s, basic AI. Trick Card at 3.
  - At 10: 3 clones, 14 s; clones also use skill 1.
  - At 20: 4 clones, 18 s; clones use skills 1–3; Swap heals 10% (from 5%).
- **Stat direction: duration.** Clones, Vanish and the Joker's trap last longer.
- **Identity:**
  - A purple aura of floating cards.
  - A card icon on the nameplate.
  - Shop: card-deck skins and mirror-shard aura colours.

## Necromancer (LOCKED, David 2026-10-02)
- **Family:** Arcane (purple).
- **Role:** summoner damage (army raiser).
- **MBTI:** mapped at the end.
- **Weapon:** a bone tome. Basic attack (left click): bone shards from the tome.

| Key | Skill | Effect |
|---|---|---|
| 1 | Raise Dead | Corpses near the aim rise as skeleton warriors: weak, many, 20 s each, cap 4 (more with mastery). With no corpse, a bone wisp answers. |
| 2 | Command | Tap: all minions charge the enemy under the crosshair. Tap again: they recall to guard you. |
| 3 | Corpse Explosion | Detonate a minion or corpse at the aim: AoE damage that chains through nearby corpses. |
| 4 | Dark Pact | Consume a minion: heal and a bone shield for you. |
| 5 | Bone Surf | Movement (row 292). Mid-slide, press it: skeletal hands rise under you and carry the slide for 1.5 s with no friction loss, steerable, plowing enemies aside. You slide and surf on the bones. Jump out for a slide-jump with extra momentum; minions follow. Unlocks at mastery 3. |

- **Passive, Grave Tithe:** kills near you heal you and leave a corpse that lasts longer, so there's more to raise.
- **Ultimate, Army of the Dead (F, meter):** the ground cracks with green light. Every corpse and about 30 skeletons claw up, march on the pack and explode together: flash frame, bone rain.
- **Mastery:**
  - At 1: Raise, Command, Explosion and Dark Pact.
  - Bone Surf at 3.
  - Up to 20: the minion cap rises, explosions chain further, surfing lasts longer, and cosmetics.
- **Identity:**
  - A purple-green aura of drifting bone dust.
  - A skull-and-tome icon on the nameplate.
  - Shop: tome bindings and soul-fire colours.

## Transmuter (DRAFT: David wants to talk about the mobs first, 2026-10-02)
- **Family:** Arcane (purple).
- **Role:** form-shifting bruiser.
- **MBTI:** mapped at the end.
- **Weapon:** a monster-tooth charm (a necklace of claws and teeth that glows with each known form). Fists fight bare in human form.

| Key | Skill | Effect |
|---|---|---|
| 1 | Fox Form | Shift in with a lunging bite. Fast and light; click = bite combo. |
| 2 | Crab Form | Shift in with a shell block. Armoured; click = pinch; blocks. |
| 3 | Golem Form | Shift in with a ground slam. Heavy and slow; click = big punches. |
| 4 | Wisp Form | Shift in by floating up. Ranged; click = spirit bolts. |
| 5 | Form Skill | The current form's move. Fox Pounce is movement: it chains off dash, slide and jump and keeps momentum. Crab Shell Spin spins and deflects. Golem throws a boulder. Wisp fires a spirit barrage. |

- **Shifting:**
  - Quick, about 0.15 s, with the shift-in move as you change.
  - Costs less mana than other classes' skills.
  - One short shared form cooldown: 3 s at mastery 1.
  - Forms carry your momentum (row 292).
- **Skill when attacked, Perfect Shift:** shift within 0.25 s before a hit lands and the form counters it.
  - Crab blocks it and pinches back.
  - Fox slips it (a dodge).
  - Golem takes it without flinching and counter-slams.
  - Wisp phases through it.
  - Picking the right form for the incoming attack is the skill.
- **Learning forms:** Fox is known from the start. Your first kill of a crab, golem or wisp teaches that form, so there's a reason to hunt.
- **Passive, Shed Skin:** each shift gives a small barrier.
- **Ultimate, Chimera (F, meter):** a timed transformation (10 s). Circles flare on the ground and your body warps into a chimera three times your size: fox legs, crab claws, golem body, wisp wings. Stats are hugely buffed, and skills 1–5 have no cooldown, so you spam them freely. It ends in a giant pounce: flash frame.
- **Stat direction: cooldown reduction.** The Transmuter is built to want shorter cooldowns: the form cooldown (3 s down to about 0.75 s at 20) and skill cooldowns, so you change forms faster. Form skills upgrade alongside; cosmetics.
- **Perfect Shift and the forms** wait for the mobs discussion.
- **Identity:**
  - A purple aura with flickering monster silhouettes.
  - A fang icon on the nameplate.
  - Shop: charm skins and form-colour variants.

## Stat direction per class (David, 2026-10-02)
"like in the game megabonk each character has a direction to go towards." Every class has one base stat it is built to stack, which mastery raises and its kit rewards:

| Class | Stat direction |
|---|---|
| Elementalist | Max mana (pool and regen) |
| Transmuter | Cooldown reduction |
| Illusionist | Duration |
| Marksman | Attack speed |
| Sniper | Crit damage |
| Hunter | Duration |
| Gunslinger | Reload speed |
| Guardian | Armor |
| Juggernaut | Max HP |
| Martial Artist (was Monk) | Attack speed |
| Summoner | Summon power |
| Shaman | Area size |
| Druid | Max HP (heals scale off max HP) |
| Priest | Healing power |
| Assassin | Crit chance |

Class movement passives and skills (Air Step, Bone Surf, Fox Pounce) work in the ruins only; the village movement kit stays the same for everyone.

Play style (David, 2026-10-02): "some character should be skill based and some should be basic attack based." Each class is tagged basic-attack or skill.

## Marksman (LOCKED, David 2026-10-02)
- **Family:** Ranger (blue).
- **Role:** mobile ranged damage.
- **Style:** basic attacks. You hold the mouse button and move around without breaking Focus; the skills are movement or buffs.
- **Weapon:** a recurve bow, slung on the back. Arrows drop with distance.
- **Focus (passive):** hold fire. Shooting starts at 1.5 shots/s and ramps to 8/s over about 4 s while you keep shooting and moving. Stopping fire for 0.5 s, or taking a hit, drops Focus by half.

| Key | Skill | Effect |
|---|---|---|
| 1 | Homing Arrows | 6 s: arrows curve to the nearest enemy |
| 2 | Flame Arrows | 6 s: arrows ignite and leave burning ground |
| 3 | Swift Arrows | 6 s: ×2 arrow speed, flat flight, pierce 1 |
| 4 | Back Hop | Leap back while still firing; keeps Focus and momentum and lands into a slide (movement, row 292) |

- **Ultimate, Thousand Arrows:** instant max Focus with all three buffs on, 20 shots/s for 6 s, ending in a final volley: flash frame, shake.
- **Stat direction:** attack speed.

## Sniper (LOCKED, David 2026-10-02)
- **Family:** Ranger (blue).
- **Role:** long-range burst damage, a glass cannon. Weak in groups, so it carries an AoE round and piercing.
- **Style:** skills.
- **Weapon:** a long brass-and-wood rifle with a scope, slung on the back.
- **Basic:** a slow, heavy shot (1/s). Weak points (heads, cores) always crit.
- **Killstreak (passive):** each kill adds +15% damage (max 5). Lost when you take a hit or go 8 s without a kill.

| Key | Skill | Effect |
|---|---|---|
| 1 | Scope | Zoom in, +40% crit chance, steadier aim |
| 2 | Piercing Round | Goes through the whole line |
| 3 | Cluster Round | Explodes on impact and splits into 4 bomblets (for groups) |
| 4 | Smoke Roll | Roll back in smoke; keeps momentum, enemies lose you (movement) |
| 5 | Tripwire | A mine that blasts what comes close |

- **Ultimate, Final Shot:** time freezes and the scope locks. One rail round pierces the whole field, and every hit is a crit: flash frame, heavy shake.
- **Stat direction:** crit damage.

## Hunter (LOCKED, David 2026-10-02)
- **Family:** Ranger (blue).
- **Role:** trapper / control. The field fills with traps.
- **Style:** skills.
- **Weapon:** a harpoon crossbow that fires harpoons on a chain; it's both the weapon and the movement.
- **Prey (passive):** marked enemies take +30% from traps.
- **Traps:** cap 3 at the start; more of them, lasting longer, as duration grows.

| Key | Skill | Effect |
|---|---|---|
| 1 | Camouflage | Blend in: standing still you're invisible, a slow walk stays hidden, and the first shot out deals bonus damage |
| 2 | Snare Trap | Roots for 2 s |
| 3 | Spike Trap | Burst damage plus bleed |
| 4 | Mark Prey | The mark shows through walls; your traps lunge toward it |
| 5 | Harpoon | Hit an enemy: drag it into your traps. Hit terrain: zip there, keeping momentum (movement) |

- **Ultimate, The Great Hunt:** every trap on the field arms and chains at once, and spectral hounds run down each mark: flash frame.
- **Stat direction:** duration.

## Gunslinger (LOCKED, David 2026-10-02)
- **Family:** Ranger (blue).
- **Role:** rhythm damage.
- **Style:** basic attacks, with a reload skill check.
- **Weapon:** a revolver: 6 bullets, then a reload animation.
- **Reload:** automatic when empty, or R (Gunslingers move "previous weapon" off R). It takes 1.2 s. Press R in the gold zone of the reload bar for an instant reload and +25% damage on the next 6 shots; a miss makes the reload slower.
- **Last Round (passive):** the 6th bullet always crits.

| Key | Skill | Effect |
|---|---|---|
| 1 | Fan the Hammer | Empty the cylinder in a fast cone |
| 2 | Trick Shot | Ricochets between up to 4 enemies |
| 3 | Special Rounds | Load 3 explosive bullets into the next chambers |
| 4 | Roll Reload | A dash or slide that reloads 2 bullets (movement) |
| 5 | Quickdraw | Right after a reload, the first shot deals ×2 and staggers |

- **Ultimate, Russian Roulette (David's design):**
  - A warhead is loaded into the cylinder and spun. The six chambers hold 1 Warhead and 5 golden rounds, and you can't see which is where.
  - Every shot needs the hammer cocked (about 0.6 s), so each one is deliberate, and any one might be the Warhead. You have to aim every shot instead of spamming all six.
  - Golden rounds hit hard. The Warhead hits like a nuke: the biggest flash frame in the game, a mushroom cloud, and a huge blast.
  - You get 10 s to fire all six.
- **Stat direction:** reload speed.

## Guardian (LOCKED, David 2026-10-02)
- **Family:** Vanguard (yellow).
- **Role:** parry tank.
- **Style:** skills.
- **Weapon:** a shield and sword; the shield is worn on the arm.
- **Basic:** a 3-hit sword combo.
- **Bulwark (passive):** a perfect parry restores energy and grants armor for 3 s.

| Key | Skill | Effect |
|---|---|---|
| 1 | Block / Parry | Hold to block attacks from the front (−70% damage). Tap as a hit lands (0.25 s window) to parry: negate it, counter-slash, stagger |
| 2 | Challenge | Enemies around you target you for 4 s; armor rises while it lasts |
| 3 | Shield Rush | A shield-first dash that chains off a slide, keeps momentum and knocks enemies down (movement) |
| 4 | Aegis Dome | Plant the shield: a dome that blocks projectiles for 5 s |
| 5 | Shield Throw | Bounces between up to 3 enemies and returns |

- **Ultimate, Unbreakable:** for 6 s you take no damage. Everything absorbed is stored, then you slam the shield down and release it ×2 as a shockwave: flash frame, heavy shake.
- **Stat direction:** armor.

## Juggernaut (LOCKED, David 2026-10-02)
- **Family:** Vanguard (yellow).
- **Role:** unstoppable bruiser.
- **Style:** basic attacks.
- **Weapon:** a huge war hammer, carried on the back.
- **Basic:** slow, heavy swings; each hit adds 2% of your max HP as damage.
- **Unstoppable (passive):** can't be knocked back or interrupted while attacking.

| Key | Skill | Effect |
|---|---|---|
| 1 | Charge | A bull rush that plows through enemies; slide into it to go further (movement) |
| 2 | Ground Slam | Cracks the ground; AoE stun |
| 3 | War Cry | Enemies target you; gain +20% temporary HP |
| 4 | Seismic Drop | In the air, crash down; damage grows with the fall height (a combo extender off any jump) |

- **Ultimate, Titan:** grow to 2.5× size for 10 s. Every step shakes the ground and swings send shockwaves. It ends with the hammer splitting the earth: flash frame.
- **Stat direction:** max HP.

## Martial Artist (was Monk; LOCKED, David 2026-10-02)
- **Family:** Vanguard (yellow).
- **Role:** close-combat damage.
- **Style:** basic attacks with skills woven in. Muay Thai: realistic, human strikes and impressive chained animation.
- **Rename:** "Monk" → "Martial Artist" (key `monk` can stay in data; the display name changes).
- **Weapon:** Muay Thai hand wraps.
- **Basic chain:** jab → cross → hook → body kick, looping.
- **Rhythm (passive):** each hit in a chain adds attack speed (up to +40%); a 1 s gap resets it.
- **Skills are combo techniques.** Press one right after a hit and it slots into the chain without breaking it. It's stronger mid-chain than as an opener; nothing is a standalone skill.

| Key | Technique | Effect |
|---|---|---|
| 1 | Teep | Push kick: knockback, makes space |
| 2 | Elbow | Slashing elbow: a big hit and a cut |
| 3 | Clinch Knees | Grab and knee up to 3×. The target is stunned and can't move for the whole technique |
| 4 | Roundhouse | A shin kick across an arc |
| 5 | Flying Knee | From a run, slide or dash: a leaping knee that keeps momentum and starts a chain (movement) |

- **Ultimate, Art of Eight Limbs:** lock onto one target for a cinematic 8-strike sequence (fists, elbows, knees, shins), each strike a mini impact frame. The final roundhouse: flash frame and a shockwave.
- **Stat direction:** attack speed.

## Assassin (LOCKED, David 2026-10-02)
- **Family:** Vanguard (yellow).
- **Role:** burst damage, squishy (−15% HP).
- **Style:** skills. The most fun movement class: "the whole point of assassin is to get to your back or get up towards you."
- **Look:** Asian-inspired, with black ink and red for every effect.
- **Weapon:** twin tanto and throwing kunai. Basic: slash up close, throw kunai at range (the crosshair decides).
- **Backstab (passive):** attacks from behind always crit and deal +50% damage.
- **Vault (movement passive):** dash into an enemy to flip over it and land at its back, momentum kept.
- **PvP and PvE:** in PvP the class lives on backstabs; in PvE mob fights, Ink Lotus and the kunai handle crowds.

| Key | Skill | Effect |
|---|---|---|
| 1 | Shadow Step | Blink behind the target under the crosshair; 2 charges; a backstab kill refunds one |
| 2 | Kunai Blink | Throw a kunai anywhere; press again to blink to it (keeps momentum). If it stuck in an enemy, you land at its back |
| 3 | Ink Lotus | Spin through the crowd in a red-ink whirl, cutting everything around you (for mob fights) |
| 4 | Smoke Bomb | Ink smoke: you're invisible inside and enemies lose you (escape) |
| 5 | Execute | From behind, under 30% HP: instant kill (bosses take a huge hit) |

- **Ultimate, Death Lotus:** time stops and the world turns to black-and-white ink. You blink between every enemy in range; time resumes and every cut lands at once: red flash frame.
- **Stat direction:** crit chance.

## Summoner (LOCKED, David 2026-10-02)
- **Family:** Warden (green).
- **Role:** shadow tamer (Megumi from JJK: between the Necromancer and the Transmuter).
- **Style:** skills.
- **Weapon:** ink-black seal gloves; every summon is a hand sign.
- **Taming:** each beast must be tamed before use, by beating its untamed form in a ritual fight. Wolves are known at the start.
- **Basic:** a shadow lash from your hand.
- **Beasts are toggles.** Press a key to summon, press again to dismiss. Every beast enters with its signature move, then stays: it fights, or keeps doing its job, until dismissed or killed. A killed beast has a cooldown before you can summon it again.
- **Out at once:** 2 at mastery 1, 3 at 10, 4 at 20.

| Key | Beast | On entering | Then |
|---|---|---|---|
| 1 | Wolves | Pounce the target | Hunt as a pair |
| 2 | Owl | Swoop, grab you and glide you forward with momentum (movement) | Circle above and dive at enemies |
| 3 | Toad | Tongue-pull the target to you | Guard you, pulling in anything that rushes you |
| 4 | Serpent | Burst from the ground under the target and **stun** it | Coil and bite |
| 5 | Escape Rabbits | A flood of rabbits pours out; you turn translucent, gain move speed and run (escape) | The rabbits don't stay; they scurry away and fade |

- **Rabbit performance:** the flood is one lightweight instanced effect, not single rabbit entities.
- **Shadow Bond (passive):** a killed beast's strength passes to the others until it returns.
- **Ultimate, Shadow Garden:** shadow floods the ground in a wide circle and every beast rises at once. You warp between any shadows while enemies sink; the shadows close over them: flash frame.
- **Stat direction:** summon power.

## Shaman (LOCKED, David 2026-10-02)
- **Family:** Warden (green).
- **Role:** setup damage. Like the Hunter, you set the map up, then deal big damage. Gameplay should be skillful and fun.
- **Style:** skills.
- **Weapon:** a carved totem staff.
- **Basic:** a spirit bolt.
- **Totems:**
  - You throw them like grenades; they plant where they land, and landing on an enemy staggers it.
  - They fire on their own.
  - Linked totems draw lightning beams between them, and enemies crossing a beam take damage. Placing totems so packs are enclosed inside the links is the skill.
  - Hunter traps trigger on contact; totems are turrets and beams.

| Key | Skill | Effect |
|---|---|---|
| 1 | Storm Totem | Zaps enemies nearby |
| 2 | Fire Totem | Flame bursts |
| 3 | Earthbind Totem | Slows and roots, holding enemies inside the kill zone |
| 4 | Overcharge | Every linked totem unloads at once. The burst grows with each enemy inside your link shapes (the payoff) |
| 5 | Spirit Hop | Mid-jump, plant a totem under you and jump off it (movement) |

- **Resonance (passive):** each linked totem raises the others' damage.
- **Ultimate, Spirit Awakening:** the totems' actual spirits manifest. The storm totem's thunderbird, the fire totem's salamander and the earth totem's bear rise and rampage across the area: flash frame.
- **Stat direction:** area size.

## Druid (LOCKED, David 2026-10-02)
- **Family:** Warden (green).
- **Role:** sustain. The gameplay is maxing out your HP, and every heal is a % of max HP.
- **Style:** skills.
- **Weapon:** a living staff that sprouts leaves.
- **Basic:** thorn seeds.
- **Overgrowth (passive):** regen doubles while you stand in your own growth.

| Key | Skill | Effect |
|---|---|---|
| 1 | Vine Snare | Vines root an area |
| 2 | Thorn Wall | A wall of thorns that blocks and cuts (terrain) |
| 3 | Healing Bloom | A flower that heals 4% of max HP per second while you stand in it |
| 4 | Vine Swing | Shoot a vine to a point, swing on it keeping momentum, release to fly (movement) |
| 5 | Wild Ground | The floor erupts in grass and roots: enemies slow, you regen |

- **Ultimate, World Tree:** a giant tree grows around you and roots you in place. Health regen becomes very fast (a large % of max HP per second), and you deal lifesteal damage to everyone hostile around you. Very hard to kill; only a one-shot works. Ends in a bloom: flash frame.
- **Stat direction:** max HP.

## Priest (LOCKED, David 2026-10-02)
- **Family:** Warden (green).
- **Role:** healer who is fully playable solo ("make priest very playable"). Heals and supports others, but every fight is also healing yourself.
- **Style:** skills.
- **Weapon:** a sunstone staff.
- **Basic, Lightbolt:** on an enemy, it deals damage and heals you. On an ally, it heals them.
- **Blessed (passive):** strong health regen; healing past full health becomes a shield.

| Key | Skill | Effect |
|---|---|---|
| 1 | Mend | A big heal on you or the ally under the crosshair |
| 2 | Radiant Shield | A shield on you or an ally |
| 3 | Holy Beam | Channelled: burns enemies, heals you and the allies it passes |
| 4 | Sanctify | A holy circle that heals allies and burns enemies |
| 5 | Light Step | A holy dash that leaves a healing trail and keeps momentum (movement) |

- **Ultimate, Divine Descent:** wings of light, and a pillar slams down. Allies are fully healed, the downed revived, enemies burned: flash frame.
- **Stat direction:** healing power.
