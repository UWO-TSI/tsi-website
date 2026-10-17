# Lane rules (every coordinator lane on the Mac mini)

These rules are hard. The coordinator merges and pushes; lanes never push.

## Worktree and git
- Work only in your own worktree and branch, `game/<lane>`, which comes from `feat/game-default-island` (== main).
  - node_modules are copied in, and `web/.env.local` is symlinked to the prod env.
  - Run dev servers with the Supabase env blanked, on your own port (never 3000, which is David's): `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p <port>`.
- Commit messages:
  - prefix `[build]`, `[qa]` or `[review]`;
  - end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never bare `git stash`. Never edit applied migrations. Never print keys or secrets.
- Merging main:
  - merge main when the coordinator says it moved;
  - never pick a side of a binary conflict: regenerate the file from the merged scripts.
- Files you don't own:
  - other sessions own `next.config.ts`, `middleware.ts` and `web/lib/supabase/*`;
  - recruitment and applicant-island code stays untouched.

## Locks (shared machine)
- **Heavy lock:** full tsc and vitest run under `/private/tmp/claude-501/uwotsi-heavy.lock`, via `/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/withlock.sh heavy <cmd>`. Use `vitest --maxWorkers=2`.
- **Browser lock:** dev servers, browsers and benches run only while you hold `/private/tmp/claude-501/uwotsi-devserver.lock`.
  - To queue, append your branch name to `/private/tmp/claude-501/uwotsi-devserver.queue`.
  - To take the lock, mkdir it and write the owner file as `game/<lane> <time>`. Take it only when it's free and you're the first line.
  - To release, rmdir the lock and delete your queue line. Never force-create the lock.
- **Memory:** no second browser. Don't build while a browser is open. Swap runs high on this machine.
  - **Blender lock:** only one Blender at a time, machine-wide. Use `/private/tmp/claude-501/uwotsi-blender.lock`: mkdir it, write the owner file as `game/<lane> <time>`, and rmdir it when Blender exits. Close Blender after each export batch.
  - **High swap:** while `sysctl -n vm.swapusage` shows more than 9 GB used, the heavy, browser and Blender locks are mutually exclusive. Hold at most one of them, and wait for the others to be free before taking yours.

## Commands
- Run every long step as its own foreground Bash call with a timeout of at most 600000 ms.
- Never start a background job and then wait on it, and never chain build, bench and browser into one call: agents have frozen for hours that way. Split anything that could run past 10 minutes.
- Use headless browsers only, launched with `--mute-audio` (mute the game).
- Kill only the PIDs you started. Never pkill broadly.

## Content
- Never fetch or use art references or textures you found yourself. David supplies all references.
  - The exception is official technical templates David has OK'd, such as Roblox's creator reference avatar and head for fitting.
- Real names never show in game (world names only). Never reveal the TC to CAD rate.
- **Performance checks (David, 2026-10-14: stop the pop-ups and the wasted runs):**
  - Every bench and screenshot script is headless by default, so no window ever opens on David's screen. Never pass `HEADED=1`.
  - Run `perf:check` only if your lane changes what renders, and only once, at the end. Never rerun it for noise.
  - Bench only the scenes your change touches (`SCENES=village,v2` for world and look work). Add `cafe` or `ruins-summoner` only if you change characters or combat.
  - UI-only and data-only lanes don't run `perf:check` at all.
  - The coordinator runs one combined check after each merge batch.
  - Price new effects in `specs/perf/effects-cost.md` from that one run.
- **Textures only where they show (David, 2026-10-17).**
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

## Reporting
- Write tests first where there's logic. Gates are tsc, vitest and eslint on changed files.
- Put evidence screenshots in `specs/evidence/<lane>/`.
- Send the coordinator a short status at the milestones your prompt names. At the end, report:
  - the head SHA;
  - gates and perf numbers;
  - evidence paths;
  - what you couldn't verify.
- Then release locks, leave the queue and delete `web/.next`.
