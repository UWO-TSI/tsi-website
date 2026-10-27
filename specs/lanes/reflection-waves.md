# Lane: reflection-waves (the arrival's character screen: water, waves, simpler panel)

Worktree `.claude/worktrees/reflection-waves`, branch `game/reflection-waves`, cut from main at 5d848445. Agent type `uwotsi-lane`.

David, 2026-10-26, verbatim: "the ripple i want a wave with foam that rolls past instead of ripple, and i want natural small water waves in the character model screen, in teh first character model screen remove the custom color wheel and keep it simple, instead of yes say like confirm or thats me"

"The character model screen" is the arrival's reflection creator (`web/components/game/arrival/ReflectionCreator.tsx`, `ReflectionScene.tsx`): you lean over the boat's edge and see your reflection.

1. **A rolling wave, not a ripple.** Each change now sends a ring ripple across the water (`ripples`, `REWRITE_MS`). Replace it with a small wave whose crest carries white foam, rolling past across the water; your reflection's look is rewritten as the crest passes your face (keep that beat). Cartoony and soft (ACNH), not realistic spray. Rapid changes must not stack into a mess: a new change can start a new wave behind the last, a few at most.
2. **Natural small waves all the time.** The water has a gentle living swell and small chop, so the reflection wobbles a little the way water does, without making the face unreadable.
3. **No colour wheel in the first creator.** Remove the custom hair colour wheel from the arrival's creator only; the hair swatches stay. The wardrobe and fitting room keep it (it's a shop unlock there).
4. **"That's me" instead of "Yes".** `YES_LABEL` in `web/lib/game/arrival/lines.ts`, plus any other "Yes" the player sees on this screen. Rename the code's `yes` names only if it's cheap; the label is what matters.

Reuse what exists before writing new water: `web/lib/game/waterShader.ts` (swell, waves, foam), `web/lib/game/foamRings.ts`, `waves.ts`. Keep the scene cheap on a MacBook Air (Lite tier).

**Evidence:** headless shots of the screen at rest, mid-wave (crest at the face) and just after, on desktop and phone sizes, plus a short frame sequence of a wave passing, in `specs/evidence/reflection-waves/`. The coordinator puts them on a review page for David; visual work isn't merged before he approves.

**Read first:** `CODEMAP.md` rows "Arrival", "Water", "Character"; the two files above; `web/components/game/character/CreatorControls.tsx` (where the `ColourWheel` renders); `specs/v1-drop.md` §1.3.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint on changed files. Message "main" with the head SHA, gates and evidence paths, then stop.

## David's decisions

Round 1 review (2026-10-27, relayed by the coordinator): approved desktop, phone, small waves.
- wave, APPROVE with a note: "make the wave change hair and stuff look natural so when its like mid wave the top of the wave change but bottom hasnt and isntead of a frame change it changes with the wave path if it makes sense". Coordinator's reading: no single-frame swap; the new look sweeps across the reflection along the crest, the seam under the foam; the second look only exists while a wave is crossing; rapid changes still ride the same wave.
- wave-first: REDO, no note (coordinator asking). Until then: the first wave must read clearly through the mist and use the sweep.
- no-wheel: REDO: "change hair color options, the black brow looks good but blond sound be less skin color, and a ginger color too". Wheel stays removed; blond clearly golden, not skin; add a free ginger; never shift palette indices (dyes `hair:6`..`hair:11` are shop rows); a shop row change means a new migration and a stop for the coordinator.

## Round 3 (David's round 2 review, 2026-10-27; https://claude.ai/artifact/Sc2JrcPsEPotE4VA2zHizU, items r2-*)

Approved: the sweep (r2-sweep), the first wave in the mist (r2-first-wave), the swatches (r2-swatches), the panel (r2-panel). Notes and redos, verbatim:

1. **r2-sweep-mid (approved, with a note):** "looks good but why is there white cross squiglgy lines in the water it looks like if it were a pool"
   - Take the crossing white light lines (the caustic-like pattern) off the water. Keep the gentle swell, the chop and the reflection's wobble; the water should read as sea, not a pool.
2. **r2-lightness (APPROVED: lift the lightness), note:** "make it so that when changing to blond all the hair takes that hue of blond. also change the head under hair to be a slightly darker version of blond or ginger instead of black"
   - This reverses the keep-lightness rule from 2026-10-17 (`web/lib/game/character/hairColour.ts`, the hair shader in `Character.tsx`) for the whole game, not just the creator.
   - A picked hair colour sets the hair's colour fully (hue and lightness), so blond is blond on every hairstyle. Keep the texture's own shading and strand detail as relative light and dark around that colour.
   - Two-tone styles keep their second colour working the same way.
   - "Natural" (no colour picked) still draws each style's own colours.
   - The dark under-hair layer (the under-cap or inner shell under the hair) takes a slightly darker shade of the hair colour instead of black.
3. **r2-on-skins (REDO), note:** "yeah we need the hair to show its proper color, also the eyes dissapear if skin is too dark"
   - The hair part is item 2.
   - The eyes: on the darkest skins the dark eyes vanish. Make every face's eyes readable on all 12 skin tones. The game draws the face (`faceMaterial.ts`), so keep each face's design; it's a contrast fix, not a redraw. For example, a light rim or catchlight that shows on dark skin, or a minimum contrast against the skin. Check every face, David's batch 3 faces included once they're on main.

**Merge first:** main has moved (collision, hair-shelf, Alice, net-identity, loading). Merge `feat/game-default-island` before you start. Lane `wardrobe-b3` (not on main yet) rebuilt every hair with a 7-row atlas; lane `fit-editor` (not on main yet) adds a `fit` map in `Character.tsx`, `rig.ts` and `face.ts`. Keep your hair change in `hairColour.ts` and the hair shader, as small as you can, so they merge cleanly.

**Evidence:** the water before and after (no lines); every free colour plus two dyes on 4 hairstyles (the default bob, a mid-brown style, the white style, a two-tone style) on 3 skins, today and after; the under-hair close up; every face's eyes on all 12 skins, before and after. Run the full gates, and one `perf:check` (SCENES=cafe, characters changed). Then message "main".

## Round 4 (David's round 3 review, 2026-10-27): everything approved, one change

Every round 3 item is approved: the water, the hair colour on all four styles, the under-hair, and the eyes. His note on the eye sheets, verbatim: "skin color dont include the last 2 shade" / "remove last 2 shade".
1. **The two darkest skin tones go:** palette skins 10 and 11 are no longer offered anywhere a player picks skin (the first creator, the wardrobe, random looks, residents' generated looks). Keep the palette indices; don't shift them. A saved look with skin 10 or 11 loads as skin 9 (one prod look uses 10). Test it. Residents authored with 10 or 11 move to 9. The eye glow still works on 9.
2. **Settle the perf question:** round 3's one perf:check failed on cafe frame time (7.7 ms against 2.1) on a loaded machine. Run an interleaved A/B (specs/perf/ab.sh or perf-bench, 3 rounds, cafe and v2, High and Lite), main against this branch. Report the numbers. If the branch is slower, find what costs it (the eye glow taps, the hair shader) and fix it.
Merge main first. Gates as before. Then message "main" with the head SHA and the A/B table; the coordinator merges and ships.

## Status

Round 4 built 2026-10-27 on `game/reflection-waves` (main merged at 406ac13e). Rounds 1, 2 and 3 approved; round 4 is David's one change plus the perf answer, ready for the coordinator to merge.

- **Two darkest skins gone (round 4):** `look.ts` `SKIN_PICKS = 10`: the creator and wardrobe skin swatches (`CreatorControls.tsx`) offer skins 0 to 9, `randomLook` (surprise me, skip, bots, cafe patrons, residents without an authored look) picks from 0 to 9, and `parseLook` loads a saved skin 10 or 11 as 9 (every saved look, the profile API and resident looks route through it). Palette indices unchanged (12 skins in `palette.json`). Authored skin 10 moved to 9: the oracle keeper (`residentRoster.ts`) and the sushi chef (`sushiBar.ts`). The lab sheet `?sheet=eyeskins` shows the 10 pickable skins. The eye glow still works on 9 (linear luminance 0.096 inside the 0.03 to 0.2 fade: about two thirds strength). Seeded random looks now spread over 10 skins, so some generated characters' skins changed; nothing else in them did (same random draws). Test: `look.test.ts` "the two darkest skins". Evidence: `17-skins-creator.png` (the creator's 10 swatches, from the branch build).
- **Perf settled (round 4):** interleaved A/B, main (406ac13e) against this branch, measurement builds, headless, cafe and v2. High 5 rounds (3, then 2 re-runs as the README asks for a scene that looks regressed), Lite 3. Means, main then branch: High cafe median 2.8 / 2.9 ms, frame CPU 1.9 / 2.2, draws 134 / 135; High v2 median 7.7 / 8.1 (one round at load 8.1 gave the branch 9.5; the other four 7.75 / 7.73), draws 407 / 407; Lite cafe 1.5 / 1.5, CPU 1.0 / 1.1; Lite v2 4.9 / 5.0, CPU 4.4 / 4.4. In rounds 4 and 5 both builds drew the identical cafe (64751 triangles) and measured the same (2.9/2.8, 3.0/3.0 ms); the round 1 to 3 CPU gaps track which bots were LOD'd (triangles, skeletons differed). Verdict: no real cost; nothing to fix. Round 3's 7.7 ms failure was the loaded machine against a quiet baseline. Runs: `specs/perf/runs/ab-rw4-{high,lite}-{before,after}.jsonl`, table `node specs/perf/ab-table.mjs specs/perf/runs/ab-rw4-high`.
- **Gates (round 4):** tsc clean; eslint clean on changed files; vitest 364 files / 3477 tests passed, with and without `NEXT_PUBLIC_GAME_WORLD=new`.

Round 3 (approved 2026-10-27):

- **No pool lines (r2-sweep-mid):** the crossing light lines on the small waves (`glints` in `ReflectionScene.tsx` `WATER_FRAG`) are gone; swell, chop, the reflection's wobble, the crest light and the clearing-world sparkles stay.
- **Hair colour sets lightness too (r2-lightness, whole game):** `hairColour.ts` `hairShift` now lands the texture's median exactly on the picked colour (OKLab L, hue, chroma). Texels keep their light and dark around it: `L' = s L + d`, s the range squeezed only as far as it must to fit in [0, 1], never below 0.5. The chroma cap of 3 is gone, so a near-grey source also reaches the full picked chroma. `tent` now centres on the picked lightness. New `shiftTexel` (the shader's maths in TS; tests use it), `HairShift.L`. `rig.ts` carries a 4th hair attribute `hairL` (sA, dA, sB, dB); `Character.tsx` `shiftHair` takes it (program key v8). "Own" (NO_SHIFT) still draws each style as drawn. Two-tone channel b shifts the same way.
- **Under-hair:** no new code. The under-cap is COLOR_0 (0.55) times `shiftedMedian`, which is now the picked colour itself, so it is a darker shade of blond or ginger instead of black.
- **Eyes on dark skins (r2-on-skins):** `faceMaterial.ts` `EYE_RIM`: on skins darker than mid tan (linear luminance 0.03 to 0.2 fade), the two eye slots sit on a soft glow of the same skin lit up 3.2x (plus 15% cream), the eye's shape grown by 0.012 of the face (16 taps). Lighter skins draw exactly as before. Covers all 29 eye styles (David's faces #20-25 included). David's batch 3 faces are not on main yet (wardrobe-b3), so they are unchecked. Mouths are unchanged.
- **Gates:** tsc clean; eslint clean on changed files; vitest 363 files / 3473 tests passed, with and without `NEXT_PUBLIC_GAME_WORLD=new`.
- **perf:check (SCENES=cafe, once):** FAILED on frame time: high 7.7 ms (baseline 2.1), lite 3.7 ms (1.5). The run was noisy: load 10.8, the Blender lock held by another lane, spread 56-65%. Frame CPU rose 5x, but this change adds no per-frame CPU work. Draw calls (132 vs 140) and triangles went down. Not rerun (rules). Ask the coordinator's combined check to confirm.
- **Evidence (round 3):** `13-water-no-lines.webp` (rest and a wave at the face, before and after); `14-hair-{bob_pigtail,anime_spikes,swept_fringe,ribbon_bob}.webp` (own, free 0-5 and 12, dyes 10 and 11, on skins 1, 6 and 11, before and after); `15-under-hair.webp`; `16-eyes-{1,2,3}.webp` (all 29 eye styles on all 12 skins, before and after). Scripts: `shoot3.mjs`, `sheets3.py`. New lab sheets: `/lab/avatar?sheet=haircolours` and `?sheet=eyeskins`.

## Next

1. The coordinator merges round 4 (no review needed: David asked for the change).
2. Once wardrobe-b3 lands (David's batch 3 faces, the 7-row hair atlas), reshoot `?sheet=eyeskins` and `?sheet=haircolours` on it.

## Tools and gotchas

- `?arrival=1` on `/lab/island` now opens straight on the reflection (phase `creator`): don't wait for `underwater`.
- Shots: hold the browser lock, dev server on 3171 (Supabase env blanked), then `node specs/evidence/reflection-waves/shoot.mjs <dir> desktop phone [clear] [colours]` (`MID_MS=620` times the crest-at-face shot), then `python3 specs/evidence/reflection-waves/sheets.py <dir> <clear_dir> <colours_dir> specs/evidence/reflection-waves`.
- Tune the wave live in dev: `window.__reflect.wave` (heading, speed, lead, exit, height, ahead, behind).
- Round 3: hair colour sets lightness too, so any style shows a colour. Lab sheets (dev server, browser lock): `node specs/evidence/reflection-waves/shoot3.mjs <dir> sheet <name> "sheet=haircolours&ids=hair_bob_pigtail&face=512"` (W= viewport width; it grows the viewport to the grid, since drei Views draw into one fixed canvas), `shoot3.mjs <dir> water`, then `python3 specs/evidence/reflection-waves/sheets3.py <before> <after> specs/evidence/reflection-waves`. Eyes framing: `sheet=eyeskins&zoom=1.7&look=0.73&face=512`.
- A/B without `ab.sh`'s broad `pkill`: build each side with `measure-build.sh` under the heavy lock (main by `git checkout --detach feat/game-default-island` in this worktree, then back), keep them in `.perf-builds/.next-{before,after}` at the worktree root, then per round serve with `node node_modules/next/dist/bin/next start -p 3149 &` and kill that PID and its children only. One round (both builds, cafe and v2) is about 4 minutes. Playwright resolves from `/opt/homebrew/lib/node_modules/`.
- zsh does not word-split `$VAR` in `for x in $VAR`: loop over an array, or pass one comma list (round 3 lost two id pairs that way).
- Hairstyle tiles by index in `section[aria-label="Hairstyles"]` (12 mid-brown spiky, 13 white, 15 the default bob). Swatch buttons in `[aria-label="hair colours"]`: 0 is "Own", then FREE_HAIR in order.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/reflection-waves /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
