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

## Commands
- Run every long step as its own foreground Bash call with a timeout of at most 600000 ms.
- Never start a background job and then wait on it, and never chain build, bench and browser into one call: agents have frozen for hours that way. Split anything that could run past 10 minutes.
- Use headless browsers only, launched with `--mute-audio` (mute the game).
- Kill only the PIDs you started. Never pkill broadly.

## Content
- Never fetch or use art references or textures you found yourself. David supplies all references.
  - The exception is official technical templates David has OK'd, such as Roblox's creator reference avatar and head for fitting.
- Real names never show in game (world names only). Never reveal the TC to CAD rate.
- `npm run perf:check` and the budgets apply to every visual change. Report the cost of every new effect in `specs/perf/effects-cost.md`.

## Reporting
- Write tests first where there's logic. Gates are tsc, vitest and eslint on changed files.
- Put evidence screenshots in `specs/evidence/<lane>/`.
- Send the coordinator a short status at the milestones your prompt names. At the end, report:
  - the head SHA;
  - gates and perf numbers;
  - evidence paths;
  - what you couldn't verify.
- Then release locks, leave the queue and delete `web/.next`.
