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

## Status

Round 2 built 2026-10-27, awaiting David's review. Head: the last commit on `game/reflection-waves`. Round 1 (the wave, small waves, "That's me", no wheel) is approved for desktop, phone and small waves.

- **The sweep (round 2.1):** a change no longer swaps the look in one frame. The new look's reflection shows behind the latest wave's crest and the old one's ahead of it, the seam along the middle of the foam cap (`WATER_FRAG` `swept`, `uSweepT`, `tReflOld`). While a wave sweeps, a second Character in the old look is mounted (`before`) and drawn into its own mirror target (`reflectionPasses.ts` `renderReflection(..., { now, old })`, made the first time it is needed); over the side you keep the old look until the crest has crossed you. `ReflectionCreator` `edit()` wraps the panel's setLook: a change before the crest reaches you rides that wave (`waveBeats().ride`); one crossing you finishes first and the next wave sets off at `done` with the latest look; the old layer is dropped at `done`. `SET.wave.ahead/behind` tune those beats.
- **The first wave in the mist (round 2.2):** the water writes its waves (foam and crest) into the frame's alpha and the composite keeps them sharp and unwashed through the blur, so the crest and the sweep read clearly while the world is still hazy.
- **Hair colours (round 2.3):** wheel still removed. Blond changed in place to golden `#E8BE48` (was `#D6A866`), ginger `#DA6E2A` appended as index 12; `FREE_HAIR = [0..5, 12]` and `DYE_HAIR = [6..11]` replace `FREE_HAIR_COLOURS` (`look.ts`, `catalogue.ts`, `CreatorControls`, tests). No palette index moved, no shop row changed, no migration. `art/characters/palette.json` and its web copy both changed.
- **Open for David:** hair colour keeps each style's lightness (his 2026-10-17 ruling, `hairColour.ts`, unchanged), so blond and ginger barely show on dark or white styles in the reflection. `12-hair-lightness-choice.webp` shows today against a thrown-away lightness-lift experiment; the coordinator puts it to him as a choice.
- **Gates:** tsc clean, eslint clean on changed files, vitest 361 files / 3451 tests passed with and without `NEXT_PUBLIC_GAME_WORLD=new`.
- **Evidence (round 2):** `specs/evidence/reflection-waves/07-sweep.webp`, `08-sweep-mid.webp`, `09-first-wave-mist.webp`, `10-hair-swatches-on-skin.webp`, `11-hair-on-skins-style12.webp`, `11-hair-on-skins-style13.webp`, `12-hair-lightness-choice.webp`, `06-hair-colours-no-wheel.webp` (redone). Scripts: `shoot.mjs` (`sweep mist skins`), `sheets2.py`.

## Next

1. David reviews round 2, and decides on the hair lightness (`12-hair-lightness-choice.webp`); apply his notes.

## Tools and gotchas

- `?arrival=1` on `/lab/island` now opens straight on the reflection (phase `creator`): don't wait for `underwater`.
- Shots: hold the browser lock, dev server on 3171 (Supabase env blanked), then `node specs/evidence/reflection-waves/shoot.mjs <dir> desktop phone [clear] [colours]` (`MID_MS=620` times the crest-at-face shot), then `python3 specs/evidence/reflection-waves/sheets.py <dir> <clear_dir> <colours_dir> specs/evidence/reflection-waves`.
- Tune the wave live in dev: `window.__reflect.wave` (heading, speed, lead, exit, height, ahead, behind).
- Hair colour only turns hue (lightness kept), so colour evidence needs a mid-lightness style; hairstyle tiles by index in `section[aria-label="Hairstyles"]` (12 mid-brown spiky, 13 white, 15 the default bob). Swatch buttons in `[aria-label="hair colours"]`: 0 is "Own", then FREE_HAIR in order.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/reflection-waves /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
