# Admin tooling pass spec (T1–T2 content control)

Owner: one agent in its own worktree after the feature areas land. Decisions: rows 8 (monthly cadence), 33, 215, 221, 217. Load `ponytail` first.

## Fixed decisions
- Only T1 and T2 can edit and publish game content (row 215). No T3 drafts.
- Editable without code: residents (bios, tone, dialogue, schedules, gifts, quest chains), club goals, chapters, shop catalogue and specials pool, merch stock, seasonal palettes, seasonal events, recipes, the species roster's display text.
- Moderation: reports queue for names, letters, notes and table chat; mute/remove/name reset (row 221).

## Deliverables
1. Audit every admin editor and route added since 2026-09-16 and enforce the T1–T2 gate server-side in one shared helper (reuse, do not duplicate per route).
2. Missing editors: residents (roster + dialogue lines + schedule anchors), recipes, seasonal events; built on the existing ContentEditor/versioning/activity-log pattern.
3. Moderation queue page reading the existing report tables.
4. One admin index listing every game content area with last-published info.
5. Evidence prefix A- under `evidence/admin/`; tsc, focused lint, vitest (gate helper denies T3–T5 and public).
