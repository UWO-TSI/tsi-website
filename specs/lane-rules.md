# Lane rules (every coordinator lane on the Mac mini)

Every lane has a handoff file in `specs/lanes/` (how it works: `specs/lanes/README.md`). Keep yours current at every milestone: lanes are restarted fresh from it.

These rules are hard. The coordinator merges and pushes; lanes never push.

## Worktree and git
- Work only in your own worktree and branch, `game/<lane>`, which comes from `feat/game-default-island` (== `origin/main`).
  - node_modules are copied in, and `web/.env.local` is symlinked to the prod env.
  - Run dev servers with the Supabase env blanked, on your own port (never 3000, which is David's): `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p <port>`.
- Commit messages:
  - prefix `[build]`, `[qa]` or `[review]`;
  - end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never bare `git stash`. Never edit applied migrations. Never print keys or secrets.
- Merging main:
  - merge `origin/main` (after `git fetch`) when the coordinator says it moved. Never merge the local `main` ref: it is far behind;
  - never pick a side of a binary conflict: regenerate the file from the merged scripts.
- Files you don't own:
  - other sessions own `next.config.ts`, `middleware.ts` and `web/lib/supabase/*`;
  - recruitment and applicant-island code stays untouched.

## Locks (shared machine)
- **Heavy lock:** full tsc and vitest run under `/private/tmp/claude-501/uwotsi-heavy.lock`, via `/Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh (set LANE=game/<lane> for the owner file) heavy <cmd>`. Use `vitest --maxWorkers=2`.
- **Browser lock:** dev servers, browsers and benches run only under `withlock.sh devserver <cmd>`. There is no queue file: never create one. The script exits 75 after 20 minutes of waiting, so retry and check the exit code (a `| tail` hides it).
- **Memory:** no second browser. Don't build while a browser is open. Swap runs high on this machine.
  - **Blender lock:** only one Blender at a time, machine-wide: `withlock.sh blender <cmd>`. Blender runs headless only (`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`), never through the blender MCP. Close it after each export batch.
  - **High swap:** while `sysctl -n vm.swapusage` shows more than 9 GB used, the heavy, browser and Blender locks are mutually exclusive. Hold at most one of them, and wait for the others to be free before taking yours.

## Commands
- Run every long step as its own foreground Bash call with a timeout of at most 600000 ms.
- Never start a background job and then wait on it, and never chain build, bench and browser into one call: agents have frozen for hours that way. Split anything that could run past 10 minutes.
- Use headless browsers only, launched with `--mute-audio` (mute the game).
- Kill only the PIDs you started. Never pkill broadly.

## Content
- **One world:** the new world (`web/data/world/`) is the only member world. The old village is retired (David, 2026-10-28: "it should not be used or archived"). Shots, runs and gates are new world only, and vitest runs once.
- **How it looks:** UI, art and models follow `specs/design-bible.md`. It wins over any older spec, and over this file if they disagree.
- Never fetch or use art references or textures you found yourself. David supplies or approves every reference (design bible, Models).
- No asset libraries or generators, except Meshy, which is part of the modelling pipeline (design bible, Models, rule 3).
- **Sound effects** (David, 2026-10-30: "make fitting sound effect or go online t ofind sound effect libraries"): synthesise them (like art/audio/synth_bite.py) or take them from online libraries, but **CC0 only** (public domain, e.g. Freesound's CC0 filter, Kenney, OpenGameArt CC0), because the repo is public. Search headless. Log every file's source URL, author and licence in web/public/audio/sfx/SOURCES.md. Music and voice still need David.
  - The exception is official technical templates David has OK'd, such as Roblox's creator reference avatar and head for fitting.
- Real names never show in game (world names only). Never reveal the TC to CAD rate.
- **Performance checks (David, 2026-10-14: stop the pop-ups and the wasted runs):**
  - Every bench and screenshot script is headless by default, so no window ever opens on David's screen. Never pass `HEADED=1`.
  - Run `perf:check` only if your lane changes what renders, and only once, at the end. Never rerun it for noise.
  - Bench only the scenes your change touches: the new world's scene for world and look work (the village scenes are gone). Add `cafe` or `ruins-summoner` only if you change characters or combat.
  - UI-only and data-only lanes don't run `perf:check` at all.
  - The coordinator runs one combined check after each merge batch.
  - Price new effects in `specs/perf/effects-cost.md` from that one run.
- **Textures only where they show (David, 2026-10-17).** This governs the world (low-poly) copy of a model. High-def close-up copies follow the design bible.
  - Small, far-away or background objects get plain colour (vertex colour or flat materials) and share materials, so they can merge into fewer draw calls.
  - Textures are for things seen up close: the ground, big walls and floors, hero props, interiors, characters, hair and clothes.
  - The pixel finish hides fine texture anyway. Keep textures small (256 px or less unless it's seen up close).
  - **Plain colour must still read as its material (David).** Instead of a texture, give each part a flat colour plus the light response of what it's made of. Use the material look classes in `lib/game/modelMaterials.ts` (`lookClassFor`), and extend them if needed:
    - wood: rough, no metal;
    - stone and concrete: rough, slightly varied;
    - metal: metallic with a soft sheen;
    - painted wood and plastic: a soft gloss;
    - glass: clear and reflective;
    - cloth: fully matte;
    - foliage keeps its leaf texture.
  - Share these presets so parts merge.

## Code: ponytail (David, 2026-10-22)
- Write code the ponytail way (the skill at `~/.claude/skills/ponytail/SKILL.md`, level full). Climb the ladder and stop at the first rung that holds:
  1. Does it need to exist at all?
  2. Is it already in this codebase? Search before writing.
  3. Does the standard library do it?
  4. Does a native platform feature cover it?
  5. Does an installed dependency solve it? Never add a dependency for a few lines.
  6. Can it be one line?
  7. Only then, write the minimum code that works.
- Deletion over addition. No unrequested abstractions, scaffolding or config for values that never change.
- A bug fix goes at the root cause, where every caller routes through.
- Never simplify away validation at trust boundaries, data-loss guards, security or accessibility.
- When you replace something, delete the old one in the same lane: dead code, unused exports and the old copy of a component. Mention the deletions in your report.

## Reporting
- Write tests first where there's logic. Gates are tsc, vitest and eslint on changed files.
- Put evidence screenshots in `specs/evidence/<lane>/`.
- Send the coordinator a short status at the milestones your prompt names. At the end, report:
  - the head SHA;
  - gates and perf numbers;
  - evidence paths;
  - what you couldn't verify.
- Then release locks and delete `web/.next`.
