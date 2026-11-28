# Lane: old-cleanup (find and remove superseded game elements)

Worktree `.claude/worktrees/old-cleanup`, branch `game/old-cleanup`, cut from origin/main `5221df56a`. Ponytail mode (full): deletion over addition, no replacements built.

Read first: `specs/game-world-development-plan.md` rows 334, 341, 343, 345 to 347; `specs/progression.md`; `specs/INDEX.md` (the superseded marks and the "Superseded (to archive)" list).

## Status

Head: see `git log` (commits old-cleanup 1 to 3b on 5221df56a). Done, waiting on David's marks:
- 1 dead code (-473 lines): /lab/icon, _render-icons.mjs, FishPreview buildFishStage, WharfShackInterior (+ its lab room, keeper post, backdrop tint), lib/npc/chatClient, lib/game/mobilePresence, isTreat, SHOP_FLOORS, swellFade.
- 2 assets (163 files, 4.1 MB): acnh/river, acnh/fall, acnh/road GLBs, assets/buildings + 3 fbx converters, 8 sky_*.webp + extract-fantasy-sky.mjs, assets/nature except grass-tufts and rock_smallA, prototype and npc pngs.
- 3 specs: the 45 INDEX "Superseded (to archive)" + development-roadmap, launch/v1-launch, terrain-v2, polish/gui-sheet moved to archive/specs/ (INDEX, CODEMAP, README, design bible, archive/README updated). Kept: v1-drop.md (cited by ~100 comments), oracle-identity.md and ux-oracle-v2.md (go with card 1).
- Review page (b and c, 12 cards, Remove/Keep, `approvals` collection): https://claude.ai/artifact/3P5t2XtSZ6ZosGA67cD9m5 (source and spec in the session scratchpad `oc/page/`, built with ~/Developer/claudebrain-tools/review-page/mkpage.py, buttons relabelled Remove/Keep; d=approve means remove, d=redo means keep).
- Gates: full tsc clean; full vitest 3995 passed, 3 failed (RodAura.test.ts, pre-existing on 5221df56a: expects rod-titanium to have no effect); eslint clean on changed files.

## David's decisions

- 2026-11-28: "i want you to identify old game elements and use /ponytail to remove them"

## Next

1. Read David's marks (`approvals`: approve = remove, redo = keep, plus notes). Remove what he marks, by card. Card 3 needs a new migration setting active = false (an update); never a delete.
2. Card 1 (Oracle quiz): archive oracle-identity.md and ux-oracle-v2.md with the code.

## Fences

Don't edit `web/components/game/character/Character.tsx`, `ModelBody.tsx`, `Puppet`, `web/components/game/arrival/*`, `CharacterCreator*`, `CreatorControls` (other lanes). Dead code there goes on the page. No migrations that remove anything, no DB drops. Recruitment, marketing, `references/`, `art/**/source/` untouched.

## Tools and gotchas

- Import graph: `scratchpad/oc/graph.mjs <web>` (regex resolver; entries = Next convention files, `scripts/`, root files). It can't see `path.join`-built loads, so `rg` every candidate before deleting.
- `node_modules` was missing; `cd web && npm install --legacy-peer-deps`.
