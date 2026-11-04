# Lane: main-quest (a quest line that unlocks the island)

Worktree `.claude/worktrees/main-quest`, branch `game/main-quest`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **m1 to m6, t-next, x-lines, x-teachers** in `specs/launch/v1-gameplay.md`. Existing: chapters in `web/lib/progression/` (`chapters.ts`, `defaults.ts`, `goals`), the teachers in `web/lib/game/tools.ts` and `arrival/hq/teachers.ts`, the residents in `web/lib/content/residentRoster.ts`.

1. **The quest dropdown** (t-next): top right beside the minimap. You can read your quests, and clicking one shows the guide arrow (lane `tutorial-v2` builds the arrow; ask me to merge its commit). It shows your personal main-quest step, never the club goal.
2. **Chapters:**
   - **m1:** first catch, then donate it at the museum to a new museum resident. She explains the museum and gives 100 coins and a thank-you letter. No report to Alice. Add her to the roster with a look made from the creator's parts, and coordinate her slug with lane `npc-editor` through the coordinator.
   - **m2:** Odile's net. Catch 3 bugs. Make sure bug catching is fun (approach, swing, flee, catch feedback).
   - **m3:** Pim's shovel. Dig spots get visible marks on dirt and on sand. Teach how to find them, and let rare finds come up.
   - **m4:** Bram's rod challenge. Catch 5 different fish, one at dawn or dusk. The reward is the Cedar rod. Lane `rod-gear` owns the rods; use its ids.
   - **m5:** the museum as a club collaboration. Personal and club donation targets (10 fish species, 5 bug species and so on); the museum opens at the next launch.
   - **m6:** the pickaxe. Rocks give stone and sometimes iron. Build the new rock and ore models in Blender (headless, from primitives; see `art/remodel/` and `art/props/`).
   - Every step has a clear tracker line with a person and a place.
3. **x-lines:** resident lines that point at closed things get swapped for lines about what's open.
4. **x-teachers:** teachers stand where the quest sends you. The landmark fix is on main; the pond and the path need anchors David places in `/lab/map`, so say which ones.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest (once), tsc, eslint, the SQL smoke chain, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Round 7: David's main quest round 6 review (2026-11-04, verbatim; https://claude.ai/artifact/VKAEfjZnWuPR6QStdT9H2A)

Approved: mq6-critical, mq6-hud, mq6-reveal, mq6-phone-reveal, mq6-phone-vitals.
- mq6-levelup (redo): "the level up isnt centered because of the logo icon to the left"
- mq6-phone-levelup (redo): "level up not centered visually"
- mq6-third (redo): "3 bar is too think , so i think stamina could be rewored to not be a bar under health but rather incorporated to be beside the character and fades in a ) shaped bar beside the character when stamina is low but doesnt show when it is above 25%"
- mq6-vitals (redo): "needs to be reimagined"

Round 7:
1. **Level up title, optically centred:** "Level up!" sits on the screen's centre line with its icon outside the centring (or drop the icon if it can't be balanced). Desktop and phone.
2. **Stamina leaves the vitals card:** a ")" shaped arc beside the character (screen space, following the character, right side), hidden while stamina is above 25%, fading in at or below 25% and out again as it refills past it. Built the cheap way (one draw or plain DOM/SVG over the canvas, no new pass). The card loses its stamina row.
3. **Vitals, reimagined:** pitch 2 or 3 new looks for what stays (health and exp, room for a shield or mana row later), in the game at full, half and low and at critical health, desktop and phone, with your pick. Build each just far enough to shoot; after David's pick, delete the losers.
4. Evidence ids `mq7-*`. Before merging, `git grep '("development" as string)' -- web` must still be empty.

## Round 6: David's round 5 review (2026-11-03, verbatim; https://claude.ai/artifact/LXxnPfXbcf6wQZmxAgwbZH)

Approved: mq5-critical, mq5-world.
- mq5-vitals (redo): "keep the full card, but keep in mind for shield or mana"
- mq5-levelup (approve): "in the level up reveal, i want you to fade the characetr out, move the level up up and take the center screen with micro animation aof each thing that was unlocked"
- mq5-reveal, mq5-phone, mq5-phone-vitals, mq5-phone-world, mq5-phone-levelup (redo, no note): follow the notes above on the phone too.

Build: the vitals keep the white card (delete the bare look and the `?vitals=` switch), laid out so a third bar (shield or mana) fits without a redesign; in the level up reveal the character fades out, "Level up" moves up, and the unlocks take the centre of the screen, each with its own small animation. Phone too. Before merging: `git grep '("development" as string)' -- web` must be empty.

## Round 5: David's round 4 review (2026-11-02, verbatim; https://claude.ai/artifact/BNWtSh7obrfHW7S5EAZ39E)

Approved: mq4-xp, mq4-ring-after, mq4-sand, mq4-bible (update design bible UI 8b to match: stamina stays in the card, dimmed when full; the level shows in the ring all the time).
- mq4-hud (redo): "the divide line needs to be thinner and the bar should be longer, idk if they should have a huge white pill "
- mq4-vitals (redo): "more red and critical and flashes"
- mq4-vitals-world (redo): "the screen should get subtle vingette and when its really low the heart pulses and the screen gets less saturaed"
- mq4-levelup (redo): "remove white backgound level up card needs to be redone"
- mq4-reveal, mq4-phone-levelup (redo, no note): follow the level up redo.
- mq4-phone (redo): "the ui for phone needs to increase the camera distance, remove emote dance and make it more compact"

Build:
1. The vitals: a thinner divider, longer bars, and try it without the big white pill (show with and without). Low reads critical: a stronger red, and it flashes when very low.
2. Low health in the world: a subtle vignette as health drops; when very low the heart icon pulses and the screen desaturates a little. Honour reduced motion for the pulse.
3. Level up redone with no white card: the character, motes, flash frames and text over the world (a soft scrim at most), then the reveal in the same style. Phone too.
4. Phone HUD: the camera pulled further back, the emote and dance button removed from the phone HUD, everything more compact.
5. Update bible UI 8b per mq4-bible.

## Round 4: David's review of round 3 (2026-11-01, verbatim; page G6Zne7fKcCCaVBUfBcum6G, collection approvals)

Approved: r3-arrow, r3-pops.
- r3-bars (redo): "the ui for the health bar stamina bar and exp bar needs to be completely redone, stamina should be with health and eventually there might be a shield or mana bar for different classes."
- r3-bars-world (redo): "placement off and in the middle of nowhere"
- r3-stamina (redo): "should be redone"
- r3-stamina-empty (redo): "all the bars should change color as it depleats, so perifiral visiion you cna tell how youre doing and have tallies for every like 20 hearts or smth"
- r3-xp (redo): "exp bar should exists somewhere seperate, maybe a circular bar around a number somewhere and hover shows specific xp amount"
- r3-level-up (redo): "level up card should feel mor oomph, more juice, suspense should feel a lot of dopamine, maybe have your character model there and like the experience floats into the character and flash frame for every experence going in and it has level up animation and the text that says level up and the character jumps and grows a lil and next fram over lay the level upgrade and the things you unlock like gems crafting new unoclable stuff"
- r3-sand (approve): "make it move or twitch a lil bit"
- r3-pop-strip (approve): "i think about time we do 1 round of all dug up treasure, make like a list of like stuff that can be dug up and model it and give it rarity and purpose" (not this lane: a separate treasure lane)

Build:
1. The vitals, redone from scratch: health and stamina together as one stack built to take a third bar later (shield or mana by class), each bar shifting colour as it empties so it reads in peripheral vision, tally ticks every 20 points. Placement that belongs to the HUD's layout (design bible), not floating in the world.
2. XP on its own: a small circular ring around the level number, somewhere sensible in the HUD; hover (or tap) shows the exact XP.
3. Level up as a moment: the character model on the card, XP motes float into it with a one or two frame flash per mote, a level up animation (the character jumps and grows a little), the "Level up" text, then the next frame overlays the new level and what it unlocks (gems, crafting, new unlockables: only what really unlocks). Flashes never back to back; reduced motion drops them.
4. The dig spot's sand moves or twitches a little.

## Round 3: David's review of round 2 (verbatim) and the coordinator's rulings

- Approved: r2-01-line, r2-02-dropdown, r2-21-dig-mark-dirt ("looks good").
- r2-03-arrow: "make the arrow centered and smaller".
- r2-20-dig-mark-sand: "make it similar to the dirt".
- r2-30-reward-pops: "the ui should be a combination, not so flat but also keep the old vibe but new color, dont need cm for sudo" (now bible UI rule 1).
- r2-06-level-up (note): "the user shoud have a health, stamina, and exp bar, and everything should be when exp is filled" (bible UI 8).
- The broken sudo stays legendary for now.
- Coordinator: stamina is a real, gentle mechanic in movement/sim.ts (sprint about 10 s a bar, a dash 20%, glide slow; refill
  about 3 s after a 0.6 s pause; emptied: walk, no dash or glide until above 20%); the bar shows only while below full and
  fades 1.5 s after it fills. Health = combat hp/maxHp, XP = hudStore levelProgress, always on, top left above the Bag.
- Coordinator (bible UI 8b, the two HUD layers): the level badge beside the XP bar only in the UI view (Esc 1); the wallet
  (coins and gems) is TopCluster's slot, built by the tutorial lane: build no coin or gem display here.
- Ownership: this lane owns RewardPop/RewardCard, BigMoment, the rarity tokens and the HUD bars (StatBar, StatBars, HudBars).

## Round 2: David's review (2026-10-28, verbatim, with what each means)

Approved, no change: 04-juno-at-the-museum, 05-juno-talk, 07-next-chapter, 10-brams-challenge, 10-pims-shovel.

Approved, with a note:
- 06-chapter-1-done: "chapter 1 done get enough exp to level up to level 2, should have overlay of what unlocks". Finishing chapter 1 grants enough XP to reach level 2; a level-up overlay shows what level 2 unlocks (reuse the existing XP/level system; only unlocks that really exist).
- 10-odiles-net: "bug catching should have bug catching mini game". Not this lane (its own lane). Net chapter stays as is.

Redo:
- 01-line: "i dont see in this screenshot". Find whether the line doesn't render or the shot missed it; fix and reshoot plainly.
- 02-dropdown: "the bar and main quest drop down should horizontally be the same length". Same width.
- 03-arrow-to-museum: "dont write show the way, just an arrow icon you can press on". Pressable arrow icon with an aria-label.
- 10-elizas-pickaxe, 30-pickaxe-at-a-rock, 31-pickaxe-from-the-side: "dont do pickaxe yet, release thiswith the cave update" / "pickaxe in cave update". Park the pickaxe chapter and mining: keep the code, nothing reachable, no chapter gap.
- 10-the-museum: "this might get impossible if people donate all the stuff". The club goal must always be completable; state the rule in one sentence on the review page.
- 20-dig-mark-sand(-close), 21-dig-mark-dirt(-close): "should be way more subtle and small and lower opacity" / "should look natural and hard to find usually". Much smaller and fainter; on dirt a natural patch you'd usually miss.
- 40-models: "burried find should drop like relics for museum, coins, ores, very rarely gems and veryveryvery rare is a broken sudo. and you can upgrade shovel for differnt loot chances". Buried finds roll a loot table (relics, coins, ores, very rarely gems, very very rarely a broken sudo, lore per specs/lore.md "sudo canon"); shovel tiers change the odds (reuse the rod-tier pattern); every tier's odds in a table on the review page; never the gem-to-money rate; server-authoritative rolls; new timestamped migration.
- 50-village-line, 51-village: "why are you still editing the old world". Proof shots only; drop them from the review, keep villagePinned.test.tsx green, change nothing in the village.

## Status

**Round 7** (game/main-quest, on origin/main 18362223; evidence specs/evidence/main-quest/r7/, befores are round 6's
after shots). Done, waiting for David's review and his pick of the vitals look:
- "Level up!" is type alone (the Sparkles icon is gone: a hanging icon can't balance it), centred on the screen; the
  shoot measures the text box's centre against the screen's: 0 px off on desktop and on the phone (log.json `-centre`).
- Stamina is off the card: kit `StaminaArc` (vitals.tsx), a ")" SVG over the canvas (`.world` is its layer), placed by
  HudBars' `useStaminaArc` in r3f's `addAfterEffect` (the camera final, as LabelLayer does) from `hudLive.at` (the
  avatar's drawn feet, PlayerAvatar) and `hudLive.camera` (set by PlayerAvatar). Shown at stamina <= 0.25
  (STAMINA_SHOW) with a 0.35 s fade; the arc is that last quarter (full as it fades in, empty when winded, shakes once
  then); blue to the low orange as it drains. No render per frame, no new pass. VitalBar lost `live`, `quiet`, `low` and
  the stamina kind; XpRing lost `hidden` (the `.hud` wrapper hides both).
- Vitals reimagined, three looks on one markup (kit `Vitals look ring`; CSS on `.hud[data-look]`): **capsule** (the
  ring at the head of a thick white-rimmed bar, no card; a shield or mana row is a slimmer bar under it), **hearts** (a
  heart per 20 points through a CSS mask on a white pill; shield and mana rows are shields and drops), **dial** (one
  white medallion: health a thick arc round the ring, open at the bottom where its heart sits; a shield or mana row is
  an arc outside it). The pick: capsule (the default). `?vitals=hearts|dial` (dev only) switches until David picks;
  then delete the losers' CSS, VITALS_LOOKS, `lookOf` and the DefaultIslandWorld `.heading` rules for hearts and dial.
- Bible UI 8b: stamina is the arc beside the character; the vitals look waits on David's pick.
- Gates: tsc clean; vitest 399 files passed (2 skipped), 3760 tests passed, 4 skipped, 0 failed, no timeouts; eslint
  clean on the 7 changed TS files; `git grep '("development" as string)' -- web` empty. No perf:check (UI lane).

**Round 6** (game/main-quest, on origin/main b56f3c36; evidence specs/evidence/main-quest/r6/, befores shot at the
merge 39f8e42d). Done, waiting for David's review:
- Vitals on the white card only: `Vitals bare`, its CSS, HudBars' `?vitals=card` and the showroom's bare row deleted.
  Built for a third row: VitalKind gained `shield` (lucide Shield) and `mana` (Droplet), tokens --ui-shield and --ui-mana
  in clean, cream and dark (their low colour is --ui-stamina-low); rows 14 px with a 4 px gap, padding 9, so two rows
  are the ring's 50 px; `.hudBars` tops the ring and card (align flex-start) so a third row grows the card down; a
  `:has()` rule (DefaultIslandWorld.module.css) steps the place name down 18 px when the card has a third row. The
  showroom shows three-row cards (shield, mana). Nothing in game uses shield or mana yet.
- Level up reveal (kit levelUp.tsx/.module.css): the figure fades out (0.45 s, scale 0.9; its canvas unmounts on the
  transition's end, and never mounts under reduced motion); "Level up!" stays and rises to the top (the `translate`
  property, so its spring-in keyframes still run); Lv n and the title under it; the unlocks take the middle, centred,
  each a 64 px gold-ringed icon that springs in staggered, then plays its own motion every 2.8 s with a ping ring:
  MomentItem `motion` flip (the quest's book turns over), twinkle (stat points: a wiggle and a glint), pop (default).
  The panel's kicker is gone. Phone (max-width 700): the reveal starts 84 px lower, clear of the HUD's top rows.
- Bible UI 8b: the vitals on one white card, a third row grows it down.
- shoot.mjs scenes mq6hud, mq6hud-phone; the reveal strip pauses every animation at the reveal's first frame and steps
  them (`seek`), since headless frames are too slow for a 0.45 s fade.
- Gates: tsc clean; vitest 399 files, 3745 passed, 4 skipped, 0 failed; eslint clean on the 5 changed TS files;
  `git grep '("development" as string)' -- web` empty. No perf:check (UI only, per the round's prompt).

**Round 5** (game/main-quest, head after this file's commit; evidence specs/evidence/main-quest/r5/, befores are r4's shots).
Done, waiting for David's review:
- Vitals (kit vitals.tsx/.module.css; game HudBars.tsx): bars 184 px (phone 132), the tally notches a 1 px hairline,
  `Vitals bare` straight over the world (white-rimmed tracks with a shadow, white-filled icons) is the island's default;
  `?vitals=card` (dev only) shows the white card. Once David picks, delete the other (the `bare` prop and the query).
  Health colour reaches the low red by a quarter (`--lo` from 0.25), --ui-health-low stronger in all three themes;
  `critical` (lib/game/lowHealth.ts CRITICAL 0.25): the well flashes red, the heart icon beats (0.9 s); reduced motion
  keeps a still red well.
- Low health in the world (lib/game/lowHealth.ts hurtLook, tested; PostFX.tsx): two uniforms in the existing pastel
  grade pass (uHurt: a red-dark edge vignette from 60% health down, max 0.8; uDrain: colour drained from 25% down, max
  0.7), damped toward combat.rt.player hp/maxHp each frame. No new pass, so no perf:check; identity at full health.
- Level up (kit levelUp.tsx/.module.css): no card. `.moment` (was `.card`) over a radial scrim (rgb(--ui-shade) 0.52
  centre, 0.16 edge); white type (new token --ui-on-scrim in clean, cream, dark) with a dark soft edge; the reveal steps
  the figure up to 0.6 and puts Lv, the title and the unlock rows (gold-ringed icon, no row background) under it, one
  button in the card colour.
- Phone (DefaultIslandWorld.tsx/.module.css): TOUCH_ZOOM 1.3 on the follow camera for any touch screen (camZoom =
  devZoom x it, all three scenes); EmoteWheel gets `touch={touch && !compact}` (no emote button on a phone; the tool
  wheel's hand button stays); `.world[data-compact]` upright phone: --touch-stick 112, --touch-scale 0.8, stick 32 px
  off the floor, minimap 96 px. Layout: the ring and vitals stay top left under the menu button (`.hudBars`), the place
  name under them, top right untouched (the fishing lane's biome tag goes there).
- Bible UI 8 and 8b updated (the level in its ring always, the vitals stack, low health, the phone line). The ledger row
  for it is the coordinator's to number.
- Fixed a round 4 regression: commit 2c0e4fc2 had replaced `process.env.NODE_ENV` with `("development" as string)` in
  46 files (dev-only code would have run in production; demoFetch and playtest tests caught it). Restored.

**Round 4** (game/main-quest, on origin/main 4fb4b8cc). Done, waiting for David's review (evidence specs/evidence/main-quest/r4/):
- Vitals (kit `components/gui/flat/vitals.tsx` Vitals, VitalBar; game `HudBars.tsx`): one soft white card in the top left
  corner, level with the quest line (DefaultIslandWorld.module.css `.hudBars`; the place name `.heading` moved under it,
  top 86px; on touch, `data-compact`, they sit under the menu button and the place name under them; the compact
  `.bagButtons` column lets taps through except on its buttons, via `:where()` so the hidden Bag's pointer-events none
  still wins: before, a hidden Bag button sat over the ring and a tap opened the bag). Health and stamina stacked, both always there (stamina rests at half opacity 1.5 s after it's full, shakes
  once when winded); a class's shield or mana is one more VitalBar row (a kind, an icon, two tokens). Each fill slides
  full colour > shared amber > low colour by its value (CSS color-mix on a registered `--vital`, so colour eases with
  the fill); a notch every 20 points of `max` (TALLY). Tokens: --ui-health, --ui-health-low, --ui-stamina,
  --ui-stamina-low, --ui-vital-mid in clean, cream and dark.
- XP ring (vitals.tsx XpRing): the level number on a white disc, XP round it, always on (it replaces the XP bar and the
  layer-2 level badge); hover, focus or a tap shows "Level n, into / needed XP, x to level n+1" (the kit's HoverTip;
  touch keeps the tip while the ring has focus). Same roll-over and LEVEL_FILLED as round 3.
- Level up (kit `levelUp.tsx` LevelUpMoment, LEVEL_UP_MS; game `LevelUpCard.tsx`): your character (CreatorStage
  Portrait, body framing, white studio, own small canvas while it's up; Portrait gained an optional `motion` prop), 7 XP
  motes curve in 180 ms apart, each landing flashes the figure white for two frames and blips a little higher; the
  burst: "Level up!", sparks, the figure grows 8% and jumps (lift arc 0.2 m, Cheer clip, the jump SFX); the reveal: Lv n
  and the real unlocks (lib/game/levelUp.ts) slide up over the lower half. A click/E/Enter/Esc skips to the reveal, then
  closes. Reduced motion opens at the reveal. BigMoment, StatBar and StatBars deleted (and their CSS).
- Dig spot twitch (lib/game/digMark.ts digTwitch, tested; VillageLife DigSpot): every 2.5 to 5 s (per spot) a 0.4 s
  wobble, scale up to +-24% and a turn up to 0.22 rad, dying away; on sand and dirt alike; none under reduced motion.
  Measured on the mesh in the headless run (scale 0.89 to 1.20).
- Gates: tsc clean; vitest 3733 passed, 2 failed outside this lane (shoreField timed out under load and passes alone;
  study.test.ts "demo scenarios" fails on the date, week_start 2026-11-02, and passed an hour earlier); eslint clean on
  the 12 changed TS files. perf:check SCENES=v2 (one run, load average 8.3, swap 12.7 GB, another lane's Blender lock
  held): v2 high 6.7 ms median (baseline 4.8 from 2026-10-14, +40%, over the 6.5 budget), lite 3.7 (2.9); draw calls
  364 (359), triangles 752k (757k). The bench never mounts the level-up canvas; the only always-on render change is a
  useFrame per dig spot (a scale and a turn). Not rerun (the rules: never for noise); the coordinator's merge-batch check decides.
- Bible to update (coordinator): UI 8b says "stamina only while below full" and "the level badge beside the XP bar" in
  layer 2; round 4 has stamina always in the stack (quiet when full) and the level always in the XP ring.

## Next

1. Wait for David's review of round 7 (specs/evidence/main-quest/r7/) and his vitals pick; then delete the other two
   looks (see Status) and reshoot the pick.
2. The round 3 migrations (20261030010000_main_quest, 20261030010100_main_quest_r2, renamed from their 20261028 names) are applied to prod: no migration waits on this lane.

## Tools and gotchas

- Browser runner (round 7): scratchpad `mqrun/qrun8.sh <scenes>` (run8.sh, out to mq-r7/$MQ_OUT; scenes mq7lab,
  mq7hud, mq7hud-phone); `mqrun/evid7.py` builds r7/; `mqrun/sheet.py` makes quick contact sheets for checking. The
  looks are pure CSS on `.hud[data-look]`, so the scene sets the attribute and shoots all three from one load. The
  stamina strip holds a value with `state.staminaRest = -100`, then lets go with `staminaRest = 1`.
- Browser runner (round 6): scratchpad `mqrun/qrun7.sh <scene>` (run7.sh; `MQ_OUT=before|after` picks mq-r6/<dir>;
  scenes mq6hud, mq6hud-phone, one per call); `mqrun/evid6.py` builds r6/. Run it with run_in_background when the lock
  may be held: a foreground call that waits on the lock passes 10 min.
- Browser batches: `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh devserver <script>`,
  retried while it exits 75 (no queue file). One short batch per hold. Runner pattern in the scratchpad `mqrun/`.
- `?progression=demo&chapter=<slug>&tally=bugs:2,net:1` puts the demo member anywhere in the main quest.
- Single test files run without the lock; full tsc and vitest under the heavy lock. Under load a few slow tests (net
  loopback, walk.test) time out at 5 s; they pass run alone.
- r3bars probes for open ground (sprint there and back) before the stamina strip; `window.__move.sim.current.state` has stamina.
- `scripts/world-cells.ts` regenerates `web/data/world/cells.json`; `node scripts/gen-seeds.mjs` writes a NEW seed.
- `talkStore.quest` (main quest) is consulted before `talkStore.script` (tool teachers) in `NPC.tsx`.
- The new world's places for shots (activeVillage("new")): museum 4,70.5 (Juno ~7,70), dig-sand-0 -17,102, dig-soil-15 35,84, rock-1 38,25.1.
- Browser runner (round 5): scratchpad `mqrun/run6.sh <scene>` under `withlock.sh devserver` (out to mq-r5; scenes
  mq5hud, mq5hud-phone; one scene per call or it passes 10 min), `mqrun/evid5.py` builds r5/. The /lab/island nav is the
  top 40 px: crops start at y 40. Low health: set `__combat.rt.player.hp` + `__publishCombat()`, wait ~2 s for the grade.
- Check `git grep '("development" as string)'` is empty before committing (round 4's regression).
- Browser runner (round 4): scratchpad `mqrun/qrun5.sh <scenes>` (run5.sh, out to mq-r4; scenes mq4hud, mq4hud-phone,
  mq4tap, mq4sand; mq4lab's element shot of /lab/gui came out black, unused). `mqrun/evid4.py` builds r4/. A failed
  scene no longer kills the batch (logged in errors). The level-up flash lasts two frames: the strip holds it by setting
  the figure's data-flash. `__combat.rt.player.hp` + `__publishCombat()` set health; `__move.sim.current.state.stamina` stamina.
- Browser runner (round 3): scratchpad `mqrun/qrun4.sh <scenes>` (run4.sh, out to mq-r3; scenes r3arrow r3dig r3bars r3pops).
- Browser runner (round 2): scratchpad `mqrun/qrun.sh <scenes>` joins the browser queue, waits up to 9 min (exit 75:
  call again), then runs `run3.sh` under the lock (new world; ICONS="key ..." renders icons first; POPS passes through).
- zsh doesn't word-split `$F`: use `${=F}` for a list of test files.
- Evidence shots: never put the thing to show straight ahead of the player; the camera sits behind and the body hides it.
- `window.__orbit.three()` (dev) is the r3f state: shoot.mjs markClip projects the DigSpot meshes through the camera.
- "Before" shots of a shared component: before.sh swaps main's file in for one batch and restores this lane's.
- The HUD needs ~9 s after the tracker appears (the arrival's fade): shoot.mjs `hudIn`.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **New world only:** the village is retired; vitest runs once.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
