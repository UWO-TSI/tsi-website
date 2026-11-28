# Lane: old-cleanup (find and remove superseded game elements)

Worktree `.claude/worktrees/old-cleanup`, branch `game/old-cleanup`, cut from origin/main `5221df56a`. Ponytail mode (full): deletion over addition, no replacements built.

Read first: `specs/game-world-development-plan.md` rows 334, 341, 343, 345 to 347; `specs/progression.md`; `specs/INDEX.md` (the superseded marks and the "Superseded (to archive)" list).

## Status

Round 1 (commits 1 to 3b) merged to main. Round 2, David's marks, done on main 1c242418e (commits 4 to 10b, head see `git log`), waiting for the coordinator's merge and the prod migration:
- 4 Oracle quiz and path sheet (cards 1, 2) and the Transmuter scaffolding (8), recruit Countdown.tsx (11). The temple, auras and chooseSubclass stay for the vision.
- 5 NPC AI chat structure (card 5); the idea is at the top of specs/llm-npc-system.md.
- 6 the six unlinked portal pages (card 6). 7 three look presets and preview-variants.mjs (card 7).
- 8 settle-in gone; migration `20261128200412_old_chapters_inactive.sql` sets settle-in, reopen-cafe, fund-museum, ruins-gate active = false (cards 3, 4, 12); smoke `supabase/tests/old_chapters_inactive_smoke.sql`, runner and output in `specs/evidence/old-cleanup/`. The three club chapters stay in defaults.ts, inactive, noted "to be remade against specs/progression.md".
- 9 old character builds (card 9), the public v7_clips.glb, skull.ts.
- 10 fenced unused exports un-exported, v1-drop.md archived (card 11).
- Gates: tsc clean, full vitest 3915 passed / 4 skipped, eslint clean on changed files (KeyPeek warning in /lab/gui is main's), `npm run build` ok, SQL smoke chain ok.
- Not done from card 11, reported: the village test fixture (81 tests of live grid code read it), the phone presence (protocol + realtime deploy). Card 10 (unplaced assets) kept.

## David's decisions

- 2026-11-28 (review page marks): remove character-old, database, oracle-quiz, path-sheet, portal-pages, settle-in, sky-variants, small-leftovers, transmuter, npc-chat ("idea may be implimented much later, keep the idea not the structure"); keep old-chapters ("keep but needs to be remade") and unplaced-assets.
- 2026-11-28: "i want you to identify old game elements and use /ponytail to remove them"

## Next

1. Coordinator merges and applies `20261128200412_old_chapters_inactive.sql` to prod.
2. If asked: re-point the seven cell tests off the village fixture, or strip the phone presence with a realtime deploy.

## Fences

Don't edit `web/components/game/character/Character.tsx`, `ModelBody.tsx`, `Puppet`, `web/components/game/arrival/*`, `CharacterCreator*`, `CreatorControls` (other lanes). Dead code there goes on the page. No migrations that remove anything, no DB drops. Recruitment, marketing, `references/`, `art/**/source/` untouched.

## Tools and gotchas

- Import graph: `scratchpad/oc/graph.mjs <web>` (regex resolver; entries = Next convention files, `scripts/`, root files). It can't see `path.join`-built loads, so `rg` every candidate before deleting.
- `node_modules` was missing; `cd web && npm install --legacy-peer-deps`.
