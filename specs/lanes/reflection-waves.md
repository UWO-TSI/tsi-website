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

## Status

Built 2026-10-27, awaiting David's review (visual work: not merged before he approves). Head: see the last commit on `game/reflection-waves`.

- **Rolling wave:** `ReflectionScene.tsx` WATER_FRAG `waves()`: a bowed crest rolling along `SET.wave.heading`, steep front, long back, a scalloped white foam cap, a shade under the lip, foam blobs left lying behind that melt. It runs past where the camera's ray to your face's reflection crosses the sea (computed per frame), sets off `SET.wave.lead` before it, crosses your face after `waveReach()` (0.61 s), and the look is rewritten then (`ReflectionCreator` effect). The ring ripple (`Ripple`, `uRip`, `REWRITE_MS`, `faceOverWater`) is deleted.
- **No stacking:** a change while a wave is still on its way to your face rides that wave; once it has passed, the next change sets a new one off behind it. At most `WAVE_MAX` (3) in the shader.
- **Small waves always:** the old swell plus the game's `WATER_CHOP` (reused from `waterShader.ts`) as the reflection's wobble, soft light and shade bands, and thin drifting `glints()` on the wavelets.
- **No colour wheel:** `CreatorOptions` takes `wheel={false}` from the arrival only; the wardrobe and fitting room keep it.
- **"That's me":** `YES_LABEL`; the pill has `white-space: nowrap`. The code's `yes`/`onYes` names are unchanged (net-identity edits the naming code in `ReflectionCreator`: don't restructure it).
- **Gates:** tsc clean; eslint clean on changed files; vitest 361 files / 3450 tests passed, with and without `NEXT_PUBLIC_GAME_WORLD=new`.
- **Evidence:** `specs/evidence/reflection-waves/01-desktop.webp`, `02-phone.webp`, `03-wave-sequence.webp`, `04-wave-sequence-clearer.webp`, `05-small-waves.webp`, `06-hair-colours-no-wheel.webp` (scripts `shoot.mjs`, `sheets.py` there).
- **Not run:** `perf:check` (the scene is the creator's own canvas; the cost is one fragment pass with up to 3 short loops and three value-noise taps, no new draw calls).

## Next

1. David reviews the evidence; apply his notes (the look is all in `WATER_FRAG` and `SET.wave`).

## Tools and gotchas

- `?arrival=1` on `/lab/island` now opens straight on the reflection (phase `creator`): don't wait for `underwater`.
- Shots: hold the browser lock, dev server on 3171 (Supabase env blanked), then `node specs/evidence/reflection-waves/shoot.mjs <dir> desktop phone [clear] [colours]` (`MID_MS=620` times the crest-at-face shot), then `python3 specs/evidence/reflection-waves/sheets.py <dir> <clear_dir> <colours_dir> specs/evidence/reflection-waves`.
- Tune the wave live in dev: `window.__reflect.wave` (heading, speed, lead, exit, height).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/reflection-waves /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
