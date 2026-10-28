# Lane: fish-tiers (epic is the old legendary; legendary fights; divine needs a team; the hook "!" and the bite sound)

Worktree `.claude/worktrees/fish-tiers`, branch `game/fish-tiers`, cut from main at c26cf77b. Agent type `uwotsi-lane`.

Read `specs/launch/v1-gameplay.md`, section "Fish tiers and fights" (David's note verbatim), first.

**Existing:**
- the reel: `web/lib/game/fishing.ts`, `fishingReel.ts`, `fishingCast.ts`, `FishingOverlay.tsx`, `FishingBobber.tsx`, `FishReveal.tsx`;
- rarity weights and the roster: `web/lib/collections/roster.ts`. Lane `catalogue-editor` made fishing read rarity, size and hours from the roster; it's on game/catalogue-editor, not on main yet, so ask the coordinator to merge it before you touch fish data;
- audio: `web/lib/game/audio.ts`, `art/audio/`;
- multiplayer: `web/lib/net/`, `realtime/src/rooms/`.

**Order:**
1. **The hook "!" and the bite sound,** for every tier.
   - The common "!" pops over the player when a fish bites.
   - Legendary: a golden "!" with effects (a glow, sparks, a little screen shake).
   - Divine: bigger still (a beam or burst, colour, a stronger shake).
   - A distinct bite sound for each, synthesized by our own script under `art/audio/` (never fetch sounds), louder and richer per tier.
   - Ship this first, on its own.
2. **Re-tier:** today's legendary fish become epic: rarity data, rare-catch drops, sell prices by rarity, the "legendaries need tier 4" rod rule (it now applies to epic). Keep players' collections and saved catches valid.
3. **The legendary fight:** a boss reel. Phases with telegraphed moves (runs, jumps, dives, sudden slack), a stamina bar, more tension, a real chance to lose it, and a big landing moment. Reuse the reel minigame and extend it. Don't build a second one.
4. **The divine team fight:**
   - A divine bite opens a shared fight: nearby players join by pressing E near you and reel together.
   - The fish's stamina only drops fast enough with a few players, and everyone who helped gets the catch credit.
   - It's server-authoritative over the realtime room. Keep the wire protocol backward compatible, write tests, and say clearly that realtime needs a Fly deploy (the coordinator does it).
5. **Which fish are legendary and divine:** David sets rarities in the Catalogue editor. It needs the Divine tier from lane `rod-gear`'s rarity ladder; ask the coordinator to merge it when it lands. Until then, propose a short list (a few legendary, one or two divine: big, iconic fish like the whale shark, coelacanth or oarfish) for David to confirm.

**Evidence:** short frame strips of each "!" and the fights, the sound files, and a two-client run of a divine fight. They go on David's review page; visual work doesn't merge before he approves.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, realtime `npm test` and `typecheck`, tsc, eslint, and one `perf:check` at the end (effects). Report after step 1 and at the end.

## Status

Branch head: see `git log -1` (this file is committed with it). Main has not merged any of it yet.

**Coordinator changes since the lane file was written (verbatim summaries in `specs/launch/v1-gameplay.md`, "Addition"):**
- Step 2 (today's legendaries re-tiered to epic) moved to lane catalogue-editor round 2. Don't re-tier data here; merge its SHA when the coordinator sends it (it includes rod-gear's rarity ladder cb7bed43: Sea King renamed Divine, `web/lib/rarity.ts`).
- The legendary boss fight, the divine raid and the surfacing cutscene are for a later launch: all behind `NEXT_PUBLIC_FISH_BOSSES=1` (`lib/game/fishing.ts` fishBosses/bossOf), off by default. David's creature list is drafts: don't model, block out or name any creature; placeholders stay generic shapes. No fish is legendary or divine in the live catalogue.
- Only step 1 ships at launch.

**Done:**
1. Step 1, commit 7e82ecb8: the hook "!" per tier (`components/game/character/hookBang.ts` popBang: common paper bubble; legendary golden with glow and gold sparks; divine bigger, holographic, beam, turning rays, bursting rings; reduced motion keeps the look, drops the effects), drawn by FishingRig (member island label) and FishingBobber (applicant island). Bite sounds synthesized by `art/audio/synth_bite.py` into `web/public/audio/sfx/bite{,-legendary,-divine}.ogg` (WAVs in `specs/evidence/fish-tiers/sounds/`), table `HOOK` in `lib/game/fishing.ts` (sound, shake, punch, surfaceMs). The overlay now rolls the fish as it bites (the cast's server roll or a local one) so the tier is known at the "!". `/lab/fishing` has "! common / legendary / divine" preview buttons.
2. Step 3 (behind the flag): boss reel in `lib/game/fishingReel.ts` (BOSS, BossReel, stamina, the line, phases by stamina, telegraphed run/jump/dive/slack), its UI in ReelMinigame (stamina bar with phase notches, the move call), tuned by `lib/game/fishingBoss.test.ts` (a bot that heeds warnings lands it about half the time in about 40 s; one that ignores them mostly loses). Surfacing cutscene: overlay phase "surfacing" (HOOK.surfaceMs), `lib/game/bossCam.ts` blended in IslandAtmosphere useFollowCamera, `components/game/fishing/BossCreature.tsx` (generic placeholder shapes, parked below the world so LoadGate's warm-up compiles them). Creature data model `lib/game/bossCreatures.ts` (id, name, tier, scale, phases; two placeholders).
3. Step 4 (behind the flag): the divine raid. Protocol note 11 in `web/lib/net/protocol.ts` (`raid` both ways, no PROTOCOL bump: the server sends every joiner a view and the client sends only after hearing one), RAID constants. Server `realtime/src/rooms/raid.ts` + IslandRoom (one raid per shard, capped wear, regen, 180 s, signed helper credits with REALTIME_INTERNAL_SECRET), tests `realtime/test/raid.test.ts` (rules + 4 real clients). Client `lib/net/raid.ts` (fed by netStore), `components/game/fishing/RaidCall.tsx` (join from anywhere), overlay opener/helper flow, reel shared stamina. Web credit: catch route action `raid` (`lib/collections/raidCredit.ts`, store.rolled checks the opener's roll is that divine; recorded once per member per roll through harvest with node `raid:<roll>`: no migration). Realtime needs a Fly deploy before the flag is turned on (the coordinator).

4. Merged catalogue-editor f5186814 (958f958c): HOOK_TIER maps `divine` (contraband gets the common hook); the divine "!" reads `--gui-holo` (the same gradient). No real fish is legendary or divine now, so the gold and holo "!" never show in play until David sets some; he's asked on the review page whether epic should get the gold one: keep HOOK_TIER until he answers.
5. SQL cap fix (0dd36b28): migration `20261028150000_catch_caps_divine.sql` (divine and contraband capped at 3 an hour like the code; they fell to 60), smoke `web/supabase/tests/catch_caps_divine_smoke.sql` in `specs/evidence/launch-fixes/sql-smoke.sh` (it re-applies the migration, since backpack_smoke re-runs the old definition). Not applied to prod: the coordinator applies it.
6. Evidence: `specs/evidence/fish-tiers/hook-strips.png` (+ per tier), sounds in `sounds/`, `boss-reel-flagged.png`. Review page up for David (hook-common, hook-legendary, hook-divine): don't change the "!" or the sounds until he decides.

**Gates at 0dd36b28:** tsc clean; vitest 3509 passed with and without NEXT_PUBLIC_GAME_WORLD=new; eslint clean on changed files; realtime npm test 233 passed and typecheck (at dccf8035, unchanged since); SQL smoke chain green with the new smoke. Two-client raid run done (evidence `raid-alice-strip.png`, `raid-bob-strip.png`).

**perf:check (SCENES=v2, new world, at 80395fe4): FAILED against the 2026-10-14 baseline (8809c517).** v2 high: 6.90 ms median (baseline 5.40), 413 draws (254), 1.38M triangles (0.91M). v2 lite: 4.50 ms (3.00), 348 draws (172), 1.17M triangles (0.63M). These numbers are from the world content main has added since the baseline (the grass, the remodels, the 81 fish, and so on), not from this lane. With the boss flag off, this lane adds nothing to the bench scene: no fishing happens in it, the "!" is a DOM label, and the creature isn't mounted. Priced in `specs/perf/effects-cost.md`. The baseline needs a refresh from main (the coordinator's combined check).

**Merged to main:** up to e6ab258e (the "!" tiers, the sounds, the divine cap migration, now applied to prod; the boss fights and the raid behind the flag). Main is now de87c07f, and that isn't merged into this branch yet.

**Fishing UI redo (after e6ab258e; visual, not merged, for David's review):**
- Design bible UI chapter (`git show feat/game-default-island:specs/design-bible.md`): flat, `--ui-*` tokens only, kit pieces first. The applicant island is a hard no-touch.
- Merged main 0a8a9514 for the kit (e71f0a3b).
- 6fb627f5: the rules moved out of `components/game/FishingOverlay.tsx` into lib: `useFishingSession`, `useReelLoop` and `useCastMeter`, plus `BOSS_CALL` in fishingReel.ts. FishingOverlay keeps its look and is now used only by ApplicantIsland.
- cb18d5cc: the kit pieces in `components/gui/flat/reel.tsx` (ReelPanel, ReelTrack, LineGauge, PowerMeter, StatusChip, CatchCard, CatchTag, sparkBurst). New tokens `--ui-water` and `--ui-water-line` in every theme. The pieces are shown in the `/lab/gui#fishing` section.
- 67248e35: `components/game/fishing/MemberFishing.tsx` is the member island's overlay (DefaultIslandWorld mounts it). It's calm while you fish, with the juice at the hook (the black chip springs in and tugs), the catch (the fish leaps out of the track in a burst, the card lands on a spring) and a rare fish (the card's rarity edge flares and throws sparks). The catch card's beats are in `lib/game/useCatchCard.ts`, which FishReveal uses too. `/lab/fishing?look=member` runs the member loop; no `look` param runs the applicant overlay.
- Evidence: `specs/evidence/fish-tiers/ui/` (before-after, hook-strip, slip-strip, landing-strip, card-strip, rare-card-strip, showroom-fishing). The shots were taken in the lab, on its dark page, not in the world.
- Gates: tsc clean; vitest with NEXT_PUBLIC_GAME_WORLD=new 3535 passed; eslint clean on changed files; no hex in the new CSS.
- First attempt (cream, hex colours): side branch game/fish-tiers-ui-r1. Reference only.

**In-world evidence round (after the main merge f26f7763):** merged origin/main de87c07f (two trivial conflicts, .gitignore and a comment in fishing.ts, both taken from main). tsc clean; vitest with NEXT_PUBLIC_GAME_WORLD=new 3535 passed. Shots of the flat fishing UI on the new world's wharf jetty (88,46 from /lab/island?fixture=v2, daylight 12:30, the normal game camera), main vs branch, and the applicant island check, are in `specs/evidence/fish-tiers/ui-world/` (scripts: shoot.mjs, run.sh, cut.py, compose.py, applicant.mjs, compare-applicant.py). The cast meter panel sits over the character in the world (lane at bottom 120px): open question for David.

## David's decisions

- 2026-10-28, tutorial review of the catch beat, verbatim: "looks good and like i think its time we update the ui for fishing to look nicer and also do ! with sound effect when fish hooked, and add small micro animation and juice to make it more dopamine while keeping the aestetic, and redo the fishing bar a little bit to make it look nicer". The "!" and sound are the approved step 1; the rest is this lane's: restyle the fishing bar a little, make the fishing UI nicer, micro-animations and juice (catch progress, the fish slipping, the landing), both worlds, keeping the aesthetic. Visual: before/after shots and frame strips to the coordinator; don't merge.
- 2026-10-28: approved all three bite tiers (common, legendary, divine) with no notes. Keep HOOK_TIER as it is (epic keeps the common "!").

- 2026-10-27 (via the coordinator): creature list is drafts for a later launch ("dont model any of these yet, later launch in game"); keep the fights behind a flag. Full record in `specs/launch/v1-gameplay.md` (8fd228bf).
- 2026-10-27: the "Addition" (cutscene, building-size legendaries, server-wide divine raid), verbatim in `specs/launch/v1-gameplay.md`.

## Next

0. David's review of the flat fishing UI; then merge main (de87c07f) if the coordinator asks.
1. (Done) Two-client run of a divine raid in the browser (needs a divine species: none exists until David picks; a dev-only stand-in or `/lab`), then the propose-list for David (step 5).
2. One perf:check at the end.

## Tools and gotchas

- Locks: `withlock.sh devserver|heavy`, retried in a background loop while it exits 75; no queue file.
- Headless shots: playwright is global (`createRequire("/opt/homebrew/lib/node_modules/")("playwright")`, `channel: "chromium"`). The site's loading screen covers /lab pages for about 3 s after load (components/ui/LoadingScreen.tsx): wait before shooting. A fresh dev player on /student/dashboard lands in "Make your character" first: press Skip.
- The fish is rolled at the bite now (FishingOverlay `bite`), not at the hook.
- `fishBosses()` reads `process.env.NEXT_PUBLIC_FISH_BOSSES` at call time (tests stub it with `vi.stubEnv`).
- The placeholders are parked at y = -1000, not hidden: three's compile skips invisible objects.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fish-tiers /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
