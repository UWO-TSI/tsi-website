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

## Previous Sprint — World-Building Polish + Content Pipeline Architecture ✅ CLOSED

All 13 deliverables shipped, QA Wave 14 PASS (commit `001eea8`), zero lint regressions. Sprint log preserved in the table below.

## Current Sprint — Admin Tooling CRUD (started 2026-05-27)

Spec: `specs/sprint-2026-06-admin-tooling.md`. Builds CRUD forms on top of the content pipeline (B3 API routes + B4 listing pages). 6 deliverables (C1-C6), ~4 week window.

| # | Deliverable | Owner | Status |
|---|-------------|-------|--------|
| C1 | NPC editor (slug/name/spawn_zone/persona_prompt/canned_dialogue/etc + draft/preview/publish/discard) | build | ✅ done — `NPCEditor.tsx` (480 lines in `components/portal/`), 2 routes (new + edit), inline validation, slug uniqueness check, new GET `/api/content/drafts/[id]` |
| C2 | Shop item editor (with rarity/stock/sprite_url) | build | pending |
| C3 | Palette editor (7 color pickers + live preview + set-active) | build | pending |
| C4 | Event editor (+ QR code + printable view + IRL/XP toggle) | build | pending |
| C5 | Version history + rollback + activity log | build | pending |
| C6 | (Optional) Image upload to Supabase Storage | build | pending |
| QA-C | End-of-sprint Wave 15 verification | qa | pending |

---

## Previous Sprint — World-Building Polish + Content Pipeline Architecture

**Goal:** Make the world feel like a real place AND set up data-driven content architecture so admins can drop monthly content without code pushes. Full spec: `specs/sprint-2026-05-game-look-feel.md`.

**Why this, not NPCs:** David (2026-05-25) wants world-building focus first, NPC sprites + LLM-NPC logic deferred to a dedicated sprint after admin tooling. World needs to feel alive on its own merits before adding character life on top.

| # | Deliverable | Owner | Status |
|---|-------------|-------|--------|
| A1 | Terrain undulation (rolling hills, building footprints flat) | build | ✅ done — value-noise reused, amplitude 3.5→0.6, building flatten zones with smoothstep blend, path corridors stay flat, player y-damped 0.05s |
| A2 | Path softening (alpha-blended edges, curved splines) | build | ✅ done — new `Path.tsx` (Catmull-Rom, 48 segs, vec4 vertex-alpha via onBeforeCompile patch on MeshBasicMaterial), 3 curved paths replacing 6 straight quads |
| A3 | River curve + flow animation + fake sky reflection | build | ✅ done — new `River.tsx` (Catmull-Rom 96 segs × 5 rows, procedural water shader with 2 sin-wave flow + foam, bridge auto-aligned to spline); skipped fresnel reflection + terrain valley dip (follow-ups) |
| A4 | Building silhouette variety (HQ vs Shop vs Oracle Temple) | build | ✅ done — procedural composites for hq/shop/oracle/temple; HQ banner pole+flag, Shop awning+sign, Oracle Temple taller-than-wide with dome+spire+2 brazier flames (flicker animation, point-light at each); house+boards untouched |
| A5 | Ambient props (signposts, stepping stones, fences, lanterns) | build | ✅ done — `AmbientProps.tsx` (196 lines, 18 props): 4 signposts (arrow planks rotated via atan2 toward target), 6 stepping stones at river bend (perpendicular to spline tangent), 4 picket fences, 4 lanterns with emissive panes + pointLight |
| A6 | Ambient life particles (butterflies/leaves/birds/fireflies) | build | ✅ done — new `AmbientLife.tsx` (5 butterflies w/ flapping wing-quads day, 10 fireflies w/ pulsing emissive night, 40-instance leaf+pollen drift always, 2 background birds day); replaced inline points-based Butterflies; phase derived from wall-clock at 60s interval |
| A7 | Ambient audio (4 time-of-day loops + footstep/click SFX) | build | ✅ done (infra only — audio files defer to content drop) — `audio.ts` singleton w/ 800ms RAF crossfade + missing-file graceful fallback, `useAmbientAudio`/`useSFX` hooks, `AudioController` corner widget (top-right enable prompt → bottom-right mixer popover with 3 sliders, persist localStorage), footstep SFX synced to PlayerAvatar movement |
| A8 | Player movement polish (easing, bob, target indicator) | build | ✅ done — walk bob sin(t*π*8)*0.05, idle breathing sin(t*π)*0.02, blended via breathBlendRef (0.3s lerp), speed-scaled frame rate, new `MoveTargetIndicator.tsx` (expanding ring 0→1.5, 400ms self-destruct, terrain-aware) |
| A9 | Transition + loading polish (fade, Suspense fallback) | build | ✅ done — TransitionOverlay timings retuned (300/200/500), GameLoadingScreen extracted with ASCII banner + 1Hz blinking cursor, Suspense wrap on GameWorld + reused as next/dynamic loading. Sprite placeholder skipped (PlayerAvatar uses non-Suspense TextureLoader — refactor out of budget) |
| B1 | Migration `014_content_pipeline.sql` (npc_personas, shop_items, seasonal_palettes, content_drafts) | build | ✅ done (1ce7281, reviewed + fixed + merged) |
| B2 | Game world reads from Supabase tables (SWR + JSON fallback) | build | ✅ done (bdd301e, palette-aware TOD = follow-up) |
| B3 | Content draft + preview URL system | build | ✅ done — migration `015_content_versions.sql` (snapshot table, immutable), 3 API routes (drafts CRUD + publish + discard), PreviewBanner.tsx (yellow fixed-top with Publish/Exit), contentLoader hooks auto-detect `?preview=draft-{id}` and merge draft into live data |
| B4 | Stub admin pages at `/student/dashboard/admin/content/{npcs,shop,palettes,events}` (read-only this sprint) | build | ✅ done — 4 read-only listing pages w/ T1/T2 gate, back link, "read-only" banner, palette swatches, events fetched via existing `/api/events`. Admin hub card added |
| QA-baseline | Run `npm run build` + `npm run lint` on current main, log to `specs/qa.md` Wave 12 | qa | ✅ done (507bcb1) |
| QA-sprint | Wave 14 end-of-sprint verification (build/lint/types/runtime smoke/all 13 deliverables/audio hotfix) | qa | ✅ done (001eea8) — PASS, zero regressions. Visual WebGL test still pending |

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

### 2026-05-21 — Sprint A6: Ambient life

New `web/components/game/AmbientLife.tsx`. Procedural-only, no asset loads:

- **Butterflies (day, 5):** group per insect with two `planeGeometry` wing-quads hinged off-center, 12Hz flap via `useFrame`, opposing phase. Body is dark box between wings. Pastel color random per butterfly. Sine-wave path around a per-instance home, `atan2` heading. Clamped to ±30 map bounds, terrain-aware y.
- **Fireflies (night, 10):** small emissive sphere, `emissiveIntensity` pulses 0.7-2.1. Wander pattern via offset sinusoids. Skipped per-firefly point lights for perf (10 dynamic lights stack with existing lamp lights).
- **Leaf/pollen drift (always, 40):** `InstancedMesh` of 0.06 planes with per-instance vertex colors (50/50 pollen `#E0D090` / leaf `#A8D080`). Falls at delta * 0.5, swayed by `sin(t*0.5+offset)`, respawns at y=8 when below 0.3. Per-instance position state lives in refs (compiler immutability) seeded from useMemo via useEffect.
- **Birds (day, 2):** V of two angled box-mesh lines, circling at radius 16-20 / y=12, facing heading, wing-flap via `rotation.z = sin(t*8)*0.3`.

TOD phase derived from `new Date().getHours()` mapped via `hourToPhase` (dawn 5-7, day 7-17, dusk 17-20, night otherwise) — refreshes via 60s interval `setInterval`. Did not refactor `TimeOfDayCycle`; it still reads wall-clock independently per the spec.

Removed the old inline points-based `Butterflies` in `GameWorld.tsx` (and orphaned `seededRandom`) since the new component supersedes it.

Verification: `tsc --noEmit` clean, `npm run lint` 74 errors / 56 warnings (= Wave 12 baseline), `npm run build` ✓ 11.1s. One file added, GameWorld lost ~40 lines net.

---

## qa

*(append your entries below — log waves continue from Wave 11 in `specs/qa.md`)*

### 2026-05-25 — Wave 12 baseline

- Build PASS on `6393d48`: 84 routes (+23 vs Wave 11), 72 static pages, compiled in 11.4s. Only pre-existing warnings (middleware deprecation, workspace-root inference).
- Lint: 74 errors / 56 warnings (Wave 11 was 39/53 — **+35 errors**). Mostly recruitment-side `no-explicit-any` + newly-active `react-hooks/set-state-in-effect` and `react-hooks/immutability` rules. Portal-scope files not the dominant offender. Full breakdown in `specs/qa.md` Wave 12.
- Dev server smoke: `/student/dashboard` returns 307→200 (login redirect via middleware — expected without session); `/` and `/student/login` 200. Pre-existing :3000 dev process belonged to user, not QA.
- Heads-up to build: new hook rules will fire on any added React effects; re-baseline planned at sprint end.

### 2026-05-25 — Wave 13: B1+B2 verification — **PASS**

- HEAD `dbc571f`. Verified deltas from `1ce7281` (migration 014) and `bdd301e` (content loader + palette wiring).
- Build: 84 routes, 72 static, compiled clean. `tsc --noEmit` exit 0.
- Lint: **130 problems (74/56)** — exact Wave 12 match, zero regressions.
- Migration 014: 4 tables, RLS on all 4, 8 SELECT policies (4 active + 4 T1/T2-all), `(select auth.…)` wrapping throughout, partial unique index for single-active palette, seeds (2 NPCs / 3 shop items / 2 palettes) match `content-defaults.ts` exactly.
- Hooks exist (`useNPCPersonas`/`useShopItems`/`useActivePalette`); `swr ^2.4.1` in package.json; GameWorld imports + uses `activePalette.palette.sky`/`.fog` (other palette keys still unused → reviewer-flagged follow-up).
- Runtime smoke on `:3050`: `/student/dashboard` 307, `/student/dashboard/shop` 307, `/api/shop` 401. With `.env.local` renamed: 200/200/200 with `{"products":[]}` — fallback path works. Restored env. No new runtime warnings.
- B3 and A1 unblocked from QA side. Full report: `specs/qa.md` Wave 13.

### 2026-05-27 — Wave 14: End-of-sprint verification (13 deliverables + audio hotfix) — **PASS**

- HEAD `791aa39`. End-of-sprint gate for World-Building + Content Pipeline sprint.
- Build: **91 routes, 77 static, 10.1s**. `tsc --noEmit` exit 0.
- Lint: **74 errors / 56 warnings** — exact Wave 13 match, **zero regressions** from a 13-deliverable sprint.
- All 13 deliverables structurally verified: A1 (terrain amp 0.6 + footprints), A2 (Catmull-Rom Path with vec4 pathColor), A3 (River 2 sin-wave shader), A4 (4 procedural building variants + brazier flicker), A5 (18 ambient props), A6 (butterflies/fireflies/leaves/birds), A7 (audio singleton + AudioController DOM overlay), A8 (MoveTargetIndicator + walk bob + idle breath lerp), A9 (Suspense + GameLoadingScreen), B1 (migration 014 = 4 tables + partial unique index), B2 (3 content hooks), B3 (migration 015 + 3 draft API routes + PreviewBanner), B4 (4 admin stub pages).
- **Audio hotfix verified**: `cachedSnapshot` field, `computeSnapshot()` method, `getState()` returns cached reference (no infinite loop), `notify()` recomputes before broadcast.
- Runtime smoke (port 3000, existing server): `/` 200, `/student/dashboard` 307, all 4 admin content stubs 307 (middleware auth gate), `/api/content/drafts` 401. All match spec.
- Not visually tested (no Playwright session — would conflict with David's interactive dev server). Recommend a visual pass before next sprint if desired.
- Notes: build dropped 23.7s → 10.1s (likely turbopack cache warm); palette wiring still consumes only sky+fog (Wave 13 carryover). Full report: `specs/qa.md` Wave 14.

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
