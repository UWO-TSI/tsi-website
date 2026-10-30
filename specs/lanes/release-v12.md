# Lane: release-v12

Worktree `.claude/worktrees/release-v12`, branch `game/release-v12`, from origin/main 82a3c70b.

## Status

Started 2026-10-30. Merged 1 to 3 (main-quest, tutorial-v2, daily-social) with fixes; tsc clean after merge 2.

## David's decisions

- 2026-10-30: "i want you to push all currents update and make sure everything works, v1.2, also i want you to make sure the performance to enter the game is good". Every pending lane branch ships in v1.2 as it stands now, redo items included. The coordinator applies the prod migrations, pushes main and tags `v1.2`. This lane builds and proves the release candidate.
- Entry performance is its own lane (game/entry-perf). The music overlap fix is its own lane (game/music-one). The coordinator merges both into this branch once they're done. Don't do their work here.

## The job

Merge these branches into `game/release-v12` in this order, one merge commit each (`[build] v1.2: merge <lane> ...`). Resolve every conflict by keeping both sides' intent; never drop a feature to make a merge go through.

| # | Branch | Head | Notes |
|---|---|---|---|
| 1 | game/main-quest | 0bf9fa66 | r3: arrow, sand mark, reward pops, HudBars top left, stamina in MOVE_TUNING (movement/sim.ts), `--ui-rarity-*` tokens |
| 2 | game/tutorial-v2 | d0346e6e | r5: WalletSlot under the time in TopCluster, keyword icon dictionary, keyboard card. Conflicts with main-quest in TopCluster.tsx and its module.css, hudStore.ts, hudPrefs.ts (the FLASH_MS line) and themes: keep both. Main-quest removes the level and XP chip, the tutorial removes the coin chip; both removals stand |
| 3 | game/daily-social | f1db3589 | r3: full-chat half heart, day-7 rare-gear icon, rope poles removed |
| 4 | game/volleyball | 71b13c9c | r2, includes vb-anim (vb_clips.glb). It moved Bram's arrival beach stop off the court, so expect a conflict with the tutorial in the arrival routes (routes/new.ts): keep the tutorial's flow with volleyball's stop position |
| 5 | game/creator-polish | 3aa33c58 | 1 commit, 118 behind main |
| 6 | game/rod-gear | 10f7cdd4 | rods r2, 118 behind |
| 7 | game/fishing-depth | bc1c7750 | r3: tasks, sushi menu, tackle rolls (gacha, RNG server side), 118 behind. Likely overlaps rod-gear (tackle) and main's MemberFishing UI |
| 8 | game/wardrobe-b3 | d9e8298c | 3 commits (under-cap cut, monocle re-import), 280 behind. Its before and after webp evidence stays out of web/public |
| 9 | game/npc-editor | 2a67bfb0 | Added by the coordinator 2026-10-30: the Residents editor page, scripts/apply-residents.mjs and residentSources.ts, plus the new-world places fix |

### Migrations

The newest applied migration on prod and on main is `20261029062423_catalogue_seed.sql`. Every unapplied migration below must end up timestamped after it, in merge order, so rename them (`git mv`) to a `20261030HHMMSS_` sequence after merging. They're unapplied, so renaming is allowed.

- main-quest: `20261028144337_main_quest`, `20261028153805_main_quest_r2`
- daily-social: `20261029062500_welcome_week`, `20261029062600_resident_friendship`
- volleyball: `20261030120000_volleyball_casual` (rename it into the sequence too)
- rod-gear: `20261028155000_rod_tackle_slots`
- fishing-depth: `20261028160000_fishing_tasks_sushi`, `20261028161000_tackle_rolls`

**David's resident look edits (coordinator, 2026-10-30):** before the final gen-seeds, apply the Residents editor export (marlo, mayor, sushi-chef, wren) at `/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/residents-export/residents-export.json` (shaped `{slug: {look: {...}}}`; reshape if apply-residents.mjs expects otherwise): from web/, `node scripts/apply-residents.mjs <export.json>`. It writes the TS, runs gen-seeds and lists old-name strings to reword. Still ONE final catalogue seed. `resident_lines_smoke.sql` includes a catalogue seed by name: update that line to the final seed's name.

Catalogue seeds: delete each branch's own seed migration (`20261029064914_catalogue_seed` from main-quest, `20261029062659_catalogue_seed` from daily-social, `20261029020457_catalogue_seed` from rod-gear) and generate ONE fresh seed at the end with `cd web && node scripts/gen-seeds.mjs`, timestamped last.

**Applied migration edit:** rod-gear modifies `20261027140000_rarity_ladder.sql`, which is applied on prod. Restore that file byte for byte to origin/main and move its change (shop_items_rarity_check without 'contraband') into a new migration in the sequence. Note in your report that the coordinator must check prod has no contraband shop rows before applying it.

Every migration must be idempotent and safe to run on prod as is. Read each one and flag anything destructive (DROP TABLE, DELETE, a constraint that existing rows could break).

### After the merges

- Switch the member fishing UI's `--gui-rarity-*` and `--gui-holo` to `--ui-rarity-*` and `--ui-holo` (fish-tiers left them for main-quest's tokens). Delete any token that's then unused.
- MemberFishing dispatches `tsi:fish-hooked`, `tsi:fish-caught`, `tsi:fish-escaped`, `tsi:fish-end` for the tutorial's FirstCatchTeach, labels its reel panel `[aria-label="Fishing reel"]` and uses createFishingReel with reelAssist.floor. Confirm that's true after the merges.
- One TopCluster, one HUD owner (bible rule 8b).

### Gates (all on the final tree)

1. `npx tsc --noEmit` and the full `vitest --maxWorkers=2`, once, under the heavy lock.
2. eslint on every changed file.
3. Seeds up to date (gen-seeds writes nothing new).
4. `npm run build` under the heavy lock. It must pass with zero errors.
5. A headless smoke on a dev server (your own port, Supabase blanked, under the devserver lock): the title, arrival with the tutorial from `/lab/island?arrival=1` through the first catch and the sell, the HUD layers (Esc), fishing on the member UI, the rod shelf and tackle, the sushi menu and the tasks board, volleyball from E at the net through a point, the creator and the wardrobe. Note any console error. Screenshots go in your scratch folder, not git.
6. `perf:check` once at the end, with nothing else heavy running (volleyball's r2 run failed under load: high 5.40 ms, lite 3.40 ms). If it still fails on a quiet machine, find the cost and fix it, or report the numbers.

Fix whatever the gates find. Commit each fix on this branch.

## Report

Message the coordinator ("main") at two milestones: when all eight merges and the migration renames are done, and when the gates are green. Then report the final head, the ordered migration list with one line each on what it does, the gate results, the smoke results, the deletions, and anything left broken.

## Next

1. Read lane-rules, then the merge table above. Merge 1 to 8.
2. Renames, the rarity_ladder restore, the seed regeneration.
3. Token switch, fishing event check.
4. Gates, smoke, perf:check. Fix and repeat.

## Tools and gotchas

- withlock: `LANE=game/release-v12 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`. It exits 75 after 20 minutes of waiting: retry in a loop and check the exit code. Never create a queue file.
- Swap is nearly full on this machine (14.6 of 15.3 GB). Run one heavy thing at a time, close every headless browser and dev server you start, and kill only PIDs you started.
- Ports: never 3000, 3300 or 3301 (David's test servers). Use 3320.
- Don't push. Don't touch prod.
