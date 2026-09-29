# Progression systems spec (main quest, club goals, journal, letters)

Owner: systems agent (data + API + UI sheets) and island agent (world objects). Decisions: `game-world-development-plan.md` rows 87, 90, 93, 96, 101, 102, 120, 177–184, 95, 180, 33, 48. Ledger wins over older specs and this worktree's CLAUDE.md.

## What it is

Two quest layers and the social plumbing around them:

1. **Personal main quest** (per account): chapter 1 *Settle in* → chapter 2 *Reopen the cafe* → chapter 3 *Fund the museum* → chapter 4 *Reach the ruins gate*. Chapters 2 and 3 are pointers at club-wide goals; chapters 1 and 4 are personal. Chapter completion opens regions per account (village core → cafe/study tables → museum + woods → cliffs/ruins gate). Skippable in one click for senior members (design principle 7).
2. **Club-wide goals** (server-wide): story goals are one-time (cafe, museum), seasonal goals repeat yearly. Progress counts in-game deliveries (coins, materials, specimens at the monument) and real club activity (QR event check-ins, completed bounties, admin-logged contributions) with admin-set weights, real activity weighted higher. Default size: reachable in ~2 weeks by 20–30 active members. Progress is shown by a plaza monument that visibly builds up; completion triggers a short in-world ceremony (confetti, building unboards, residents gather) and a letter to every member.
3. **Journal**: quest list with chapter state, club-goal progress, discoveries (species journal hooks for later), study stats. HUD: one current-objective line under the minimap with a marker on the minimap.
4. **Letters**: mailbox at each home (homes come later; for now a mailbox at HQ) and a village notice board. Letters and notes only, no item transfer. System letters (goal completed, chapter completed) plus member-to-member notes, length-limited, reportable. Visible on phones later.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Chapter 1 | Claim starter island (stub until homes exist: "claim your plot" at HQ), make a first catch and donate it (museum shell accepts one donation before opening), report to HQ | 101 |
| Chapters 2, 3 | Club-wide goals; personal chapter shows the goal, credits contributions | 177, 178 |
| Chapter 4 | Oracle quiz done + level-10 family trial done → gate opens | 179 |
| Contributions | In-game deliveries + real activity, weights admin-set, real weighted higher; per-member caps | 102 |
| Goal size | ~30 event check-ins or ~15,000 coin-equivalent; admin retunes | 181 |
| Progress display | Plaza monument builds up in stages (e.g. 0/25/50/75/100%) | 182 |
| Completion | In-world ceremony + letter to all members; story goals one-time, seasonal repeat | 183, 184 |
| HUD | Journal tab + one objective line under the minimap, marker on minimap | 180 |
| Social | Letters/notes only; no trading | 95, 46 |
| Admin | Goals, weights, targets, chapter copy editable without code | 33 |
| Data policy | Prototype gameplay resets at launch; real club records preserved | 48 |

## Deliverables

**Systems agent (worktree `web/`, no game-world rendering):**
1. Schema draft `web/supabase/migrations/20260926150200_progression.sql` (DO NOT APPLY; next free slot per STATE.md is 029): `quest_chapters` (authored), `member_quest_progress`, `club_goals` (type story/seasonal, target, weights, window), `club_goal_contributions` (member, source: delivery|event|bounty|admin, amount, weight, created_at, cap accounting), `letters` (from, to or broadcast, body, read_at, reported), with RLS mirroring existing tables. Reuse existing tables for events (QR check-ins) and bounties; do not duplicate trackers.
2. Server routes under `web/app/api/progression/*`: chapter state, advance chapter (server-validated conditions), contribute (idempotent, retry-safe, capped), goal progress, letters (send/list/read, rate-limited). Tests for idempotency, caps, weights, chapter gating.
3. Admin editor pages under the existing admin content tools (`web/components/portal/*Editor.tsx` pattern): chapters copy, goals (target, weights, window, type), with the existing versioning/activity log.
4. UI sheets (overlay pattern used by the dashboard pages): Journal (quests, goals, letters), Contribute sheet, Letter composer/reader; HUD objective line + minimap marker hook (coordinate with the island agent's MiniMap).
5. Seed: the four chapters and the two story goals with default targets; a `?goal=` dev override to set progress for screenshots.

**Island agent (world side, after the systems agent's contracts exist):**
6. Plaza monument prop with 5 build stages driven by goal progress; ceremony (confetti particles, residents gather, boards come off) on completion; HQ mailbox prop and notice board wired to the letters sheet; catch board stays a placeholder; objective marker on the minimap.

Each deliverable: tsc, focused lint, tests, screenshots read by the agent. No commits, no pushes, no production or migration application.

## Out of scope

Homes (chapter 1 uses a stub), museum donation logic beyond one placeholder donation, combat, Oracle quiz changes, phone UI, economy shop.

## Questions

`specs/progression-questions.md` (date, question, assumption). Keep going.
