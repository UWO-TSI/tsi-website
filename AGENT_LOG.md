# AGENT_LOG.md — Sprint Communication Board

> **Read on session start:** `CLAUDE.md` (1-page entry) → this file (your role + sprint state) → `specs/ux-status.md` (current backlog).
> **Append only to your role section.** Do not edit other agents' entries.

---

## Team — 3 Agents (set 2026-05-21)

| Agent | Owns | Reads First |
|-------|------|-------------|
| **build** | All code: design + implementation + schema. UI tweaks, new features, migrations, API routes. | `CLAUDE.md`, `specs/ux-status.md`, `specs/asset-stack.md`, role-specific specs (`specs/ux-*.md`) |
| **qa** | `npm run build`, `npm run lint`, runtime + visual tests, Playwright if available, bug reports → `specs/qa.md` | `CLAUDE.md`, `specs/qa.md` (your bible — historical waves), this file |
| **reviewer** | Sprint planning, design/code critique on `build`'s work, scope decisions, escalation to David. NOT an implementer. | Everything. Reviewer needs context across the whole project. |

**Why 3 agents and not 5:** the original claude-squad setup (mgmt/uxui/frontend/backend/qa) was right for greenfield + 60 parallel pages. Current scope is a defined punch list (Tier-1) + targeted Phase-2 features. Combined `build` avoids the cross-agent merge conflicts that plagued Waves 4.1 / 6. See `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md` for the prior log.

---

## Current Sprint — World-Building Polish + Content Pipeline Architecture

**Goal:** Make the world feel like a real place AND set up data-driven content architecture so admins can drop monthly content without code pushes. Full spec: `specs/sprint-2026-05-game-look-feel.md`.

**Why this, not NPCs:** David (2026-05-25) wants world-building focus first, NPC sprites + LLM-NPC logic deferred to a dedicated sprint after admin tooling. World needs to feel alive on its own merits before adding character life on top.

| # | Deliverable | Owner | Status |
|---|-------------|-------|--------|
| A1 | Terrain undulation (rolling hills, building footprints flat) | build | pending |
| A2 | Path softening (alpha-blended edges, curved splines) | build | pending |
| A3 | River curve + flow animation + fake sky reflection | build | pending |
| A4 | Building silhouette variety (HQ vs Shop vs Oracle Temple) | build | pending |
| A5 | Ambient props (signposts, stepping stones, fences, lanterns) | build | pending |
| A6 | Ambient life particles (butterflies/leaves/birds/fireflies) | build | pending |
| A7 | Ambient audio (4 time-of-day loops + footstep/click SFX) | build | pending |
| A8 | Player movement polish (easing, bob, target indicator) | build | pending |
| A9 | Transition + loading polish (fade, Suspense fallback) | build | pending |
| B1 | Migration `014_content_pipeline.sql` (npc_personas, shop_items, seasonal_palettes, content_drafts) | build | ✅ done (1ce7281, reviewed + fixed + merged) |
| B2 | Game world reads from Supabase tables (React Query, JSON fallback) | build | in_progress |
| B3 | Content draft + preview URL system | build | pending |
| B4 | Stub admin pages at `/student/dashboard/admin/content/{npcs,shop,palettes,events}` (read-only this sprint) | build | pending |
| QA-baseline | Run `npm run build` + `npm run lint` on current main, log to `specs/qa.md` Wave 12 | qa | ✅ done (507bcb1) |
| QA-sprint | Visual verify 30-second test, FPS ≥ 50 desktop, mobile no-crash, migration apply test | qa | pending |

**Definition of Done:** see sprint spec §"Definition of Done" — visitor feels in-a-place / in-a-world / in-control / in-quality + admin can insert shop_items row via Supabase dashboard and see it appear in-world.

**Migration filename note:** working tree has `013_recruitment_status_v2.sql` (recruitment scope, not mine). Build agent uses **`014_content_pipeline.sql`** to avoid collision.

---

## File Ownership

- `web/app/student/dashboard/**` → build
- `web/components/game/**` → build
- `web/components/portal/**` → build
- `web/supabase/migrations/**` → build (new migrations only — never edit applied ones)
- `specs/qa.md` → qa
- `specs/ux-status.md` → reviewer (sprint planning) + build (status updates)
- `AGENT_LOG.md` → all agents append to own section
- `CLAUDE.md`, `web/app/student/STUDENT_SYSTEM_BIBLE.md` → reviewer only

**Off-limits for portal work:** anything under `web/app/(site)/`, `web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`, `web/components/sections/`, migrations 001_recruitment / 009 / 010 / 011 / 012. That's the recruitment system — separate scope.

---

## Commit Prefixes

- `[build]` — code changes
- `[qa]` — test results, lint fixes, bug reports
- `[review]` — spec edits, sprint planning, scope decisions

Example: `[build] settings: split into 4 tabs (Profile/Social/Appearance/Account)`

---

## Blocked / Needs Attention

*(empty)*

---

## build

### 2026-05-21 — Sprint B1: Content pipeline migration

Wrote `web/supabase/migrations/014_content_pipeline.sql` (worktree branch `build/sprint-b1-content-pipeline`). Adds the four content-pipeline tables: `npc_personas`, `shop_items`, `seasonal_palettes`, `content_drafts`. Defines `update_updated_at_column()` (no prior migration ships it) and wires it to `npc_personas` only — `shop_items`, `seasonal_palettes`, and `content_drafts` have no `updated_at` column per spec.

**Decisions / judgment calls:**

- Palette JSONB shape: object with keys `sky / grass / accent / fog / water / building_primary / building_accent` as specified. Not validated by Postgres — game world is the consumer.
- Single-active palette: enforced via partial unique index `idx_seasonal_palettes_single_active ON (active) WHERE active = TRUE`. Cleaner than a CHECK + trigger, but you can only have one row at all where `active = TRUE`, which is the intent.
- RLS tier-gating pattern: `(SELECT tier FROM profiles WHERE id = auth.uid()) IN (1, 2)`. `001_initial_schema.sql` doesn't have tier-gated policies — it uses `auth.role() = 'authenticated'` only. I used the subquery pattern because the spec explicitly asked for T1/T2 gating. If you want the bouncer at the API layer instead, easy revert (drop the 12 tier-gated INSERT/UPDATE/DELETE policies, replace with `auth.role() = 'authenticated'`).
- `content_drafts.author` — `ON DELETE SET NULL` (drafts outlive the author leaving the org). Status check constraint covers `draft / published / discarded`.
- `content_drafts` SELECT is author-only. T1/T2 can UPDATE/DELETE any draft (review queue). T3+ INSERT works via the generic `authenticated` INSERT policy (spec said "T3+ can INSERT on `content_drafts` only" — covered, since the only INSERT they have privilege for among the four tables is this one).
- `shop_items.sprite_url` left nullable. Sprite drop is a later sprint; making it NOT NULL would break the workflow where an admin drafts an item before art lands.
- Seed: 2 NPCs, 3 shop items, 2 palettes. NPC persona prompts written in-line. Halloween palette colors are my own picks within the spec's "orange/purple/black tones" guideline — feel free to recolor.
- `ON CONFLICT (slug) DO NOTHING` on all seeds, so re-running the migration is safe.

**Did not seed `content_drafts`** — would need a real `profiles.id` UUID, which we can't hardcode.

**Questions for reviewer:**

1. Tier-gated RLS via subquery on every write — OK, or move to API-layer enforcement? Subquery executes per row; if shop_items grows to thousands of rows and writes are common (they won't be — admin-only), worth knowing.
2. `npc_personas.canned_dialogue` defaulted to `'{}'` not NULL. Spec said `text[]` without nullability — I picked empty-array-as-default because consuming code is simpler.
3. Should `seasonal_palettes` SELECT policy let authenticated members read inactive ones too (for preview / admin list)? Currently filtered to `active = TRUE` per spec. The admin stub page in B4 will hit this — flagging.

No DROP statements. No code touched. Branch ready for review.



---

## qa

*(append your entries below — log waves continue from Wave 11 in `specs/qa.md`)*

### 2026-05-25 — Wave 12 baseline

- Build PASS on `6393d48`: 84 routes (+23 vs Wave 11), 72 static pages, compiled in 11.4s. Only pre-existing warnings (middleware deprecation, workspace-root inference).
- Lint: 74 errors / 56 warnings (Wave 11 was 39/53 — **+35 errors**). Mostly recruitment-side `no-explicit-any` + newly-active `react-hooks/set-state-in-effect` and `react-hooks/immutability` rules. Portal-scope files not the dominant offender. Full breakdown in `specs/qa.md` Wave 12.
- Dev server smoke: `/student/dashboard` returns 307→200 (login redirect via middleware — expected without session); `/` and `/student/login` 200. Pre-existing :3000 dev process belonged to user, not QA.
- Heads-up to build: new hook rules will fire on any added React effects; re-baseline planned at sprint end.

---

## reviewer

### 2026-05-21 — Setup

- Pulled main (b395e09). Portal code untouched since 2026-04-06 (Wave 11 verdict: READY to merge).
- Stashed 4 dirty recruitment files to `stash@{0}` for safety.
- Moved deprecated specs to `archive/specs/`: `ux-game-world-v1.md`, `ux-oracle-v1.md`, `ux-review-v1.md` through `v5.md`.
- Moved old `AGENT_LOG.md` (5-agent setup, waves 1-11) to `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md`.
- Updated `web/app/student/STUDENT_SYSTEM_BIBLE.md` with current-vision deltas banner + surgical edits.
- Wrote new `CLAUDE.md` as the agent entry point.

### 2026-05-25 — Strategic Reframe + Sprint Pivot

After deep strategic analysis with David, the project frame was clarified: **community-first hangout, not productivity tool**. Bounties/jobs are features inside the hangout, not the engagement engine. Key decisions locked in:

1. Portal = 3D group chat / club hangout
2. AI NPCs scale inversely with real-player count (start with α: scripted)
3. Monthly content drops, admins need easy tooling
4. Rich cosmetic + class system is late-game (Phase 3+)
5. Mobile-aware everywhere
6. Leaderboard top-half public, bottom-half anonymized
7. Senior members can mute game-feel
8. XP = IRL events only, TC = monetary-value contributions only — **no online activity rewards**

Actions taken:
- Wrote 8 design principles into `CLAUDE.md`
- Pivoted sprint from Tier-1 punch list to **Game World Look & Feel**
- Created sprint spec at `specs/sprint-2026-05-game-look-feel.md`
- Reprioritized Phase 2 backlog (NPCs + presence + mobile ahead of Avatar Creator + Interiors) — see `specs/ux-status.md` (pending update)

**Decisions locked in (2026-05-25):**
- NPC tech tier: **γ (LLM-driven, Claude Haiku + Memory tool)**. Spec: `specs/llm-npc-system.md`. Lands after admin tooling sprint.
- NPC sprites: deferred — world-building first.
- NPC population mix: **few permanent named + dynamic filler based on real-player density**. Defaults documented in `specs/llm-npc-system.md`.
- Monthly content drop tooling: confirmed for next sprint after this one.
- **This sprint** lays the data-driven content pipeline foundation that admin tooling sprint builds on top of.

**Open items still pending:**
- Stale: tier CHECK constraint migration (`004_cleanup_and_extend.sql`) — verify on first migration touch.
- LLM-NPC sprint spec has 5 open Qs (proactive vs click-only, NPC cross-references, XP for chats, persona moderation, memory wipe policy) — answer before that sprint kicks off, not blocking this one.
- Working tree has unrelated recruitment changes (`013_recruitment_status_v2.sql`, `admin/preview/`, etc.) from another session/working dir. David handles separately.

---

## Cross-Team Notes

*(any agent may append — for messages that don't fit a single section)*
