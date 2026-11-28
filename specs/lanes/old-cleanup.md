# Lane: old-cleanup (find and remove superseded game elements)

Worktree `.claude/worktrees/old-cleanup`, branch `game/old-cleanup`, cut from origin/main `5221df56a`. Ponytail mode (full): deletion over addition, no replacements built.

Read first: `specs/game-world-development-plan.md` rows 334, 341, 343, 345 to 347; `specs/progression.md`; `specs/INDEX.md` (the superseded marks and the "Superseded (to archive)" list).

## Status

- Started 2026-11-28. Identify, sort (a) remove now / (b) wired into live flows / (c) unsure, remove (a), put (b) and (c) on a review page for David.

## David's decisions

- 2026-11-28: "i want you to identify old game elements and use /ponytail to remove them"

## Next

1. Identify candidates (import graph, specs, assets, lab and dev pages).
2. Remove (a) in small commits by area; gates tsc, eslint on changed files, vitest.
3. Review page for (b) and (c), then stop for David's marks.

## Fences

Don't edit `web/components/game/character/Character.tsx`, `ModelBody.tsx`, `Puppet`, `web/components/game/arrival/*`, `CharacterCreator*`, `CreatorControls` (other lanes). Dead code there goes on the page. No migrations that remove anything, no DB drops. Recruitment, marketing, `references/`, `art/**/source/` untouched.

## Tools and gotchas

- Import graph: `scratchpad/oc/graph.mjs <web>` (regex resolver; entries = Next convention files, `scripts/`, root files). It can't see `path.join`-built loads, so `rg` every candidate before deleting.
- `node_modules` was missing; `cd web && npm install --legacy-peer-deps`.
