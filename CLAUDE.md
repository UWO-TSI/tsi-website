# CLAUDE.md — Agent Entry Point

> First file every agent reads. 1-page index. Last updated 2026-05-21.

## What this repo is

UWO-TSI (Tethos) website + student portal. Two product surfaces:

1. **Marketing site** (`web/app/(site)/`, `web/app/student/page.tsx`) — public landing pages. Stable.
2. **Recruitment system** (`web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`) — 2026-27 exec hiring portal. Live in production. Do not touch unless explicitly tasked.
3. **Student game portal** (`web/app/student/dashboard/`, `web/components/game/`, `web/components/portal/`) — **THIS is what agents are building.** A 2.5D MMO RPG game world for active TSI members. Single-player MVP, multiplayer (Colyseus) deferred to Phase 2.

## Your role

The team has 3 agents: `build`, `qa`, `reviewer`. See `AGENT_LOG.md` Team section for ownership boundaries. Append entries only to your section.

## Read in this order

1. **This file** — you're here
2. **`AGENT_LOG.md`** — current sprint, your role, file ownership, commit prefixes
3. **`web/app/student/STUDENT_SYSTEM_BIBLE.md`** — feature mechanics (Bounty, Calendar, Kanban, Marketplace, Job Board, Directory). Read the "CURRENT VISION DELTAS" banner at the top first — it lists what's drifted.
4. **`specs/ux-status.md`** — current design-debt backlog, prioritized into Tier-1/2/3. The sprint pulls from Tier-1.
5. **`specs/asset-stack.md`** — confirmed tech architecture: R3F + Drei + PS1 shader, Quaternius/Kenney assets, 2D sprite chars via Nano Banana, Colyseus deferred.
6. **Role-specific specs** in `specs/` — `ux-game-world-v2.md`, `ux-oracle-v2.md`, `ux-classes.md`, `ux-dashboard.md`, `ux-directory.md`, etc. Use the index in `specs/ux-status.md` §1 to find the right one.

## Project vision (TL;DR)

- **Style:** 2D sprite characters in a 3D world (Dave the Diver, Octopath Traveler). PS1 shader + ACNH curved-world shader.
- **Map:** 2-3 screens wide. Buildings (HQ, Shop, Oracle Temple) you enter; objects (Bounty Board, Job Board) open overlays.
- **5-tier RBAC:** T1 David / T2 chapter presidents / T3 PMs+VPs / T4 directors+devs / T5 volunteers+general.
- **MBTI class system:** 4 main classes (Analyst/Diplomat/Sentinel/Explorer) + 16 subclasses, assigned via Oracle Temple quiz during onboarding.
- **Economy:** TSI Coins, never reveal conversion rate.
- **Phase 1 (current):** single-player game world, directory, all feature pages as overlays. Close Tier-1 punch list to merge to main.
- **Phase 2 (deferred):** multiplayer (Colyseus), Avatar creator (Nano Banana sprites), building interiors, Oracle v2 card-game, mobile.

## Where to find things

| Topic | Location |
|-------|----------|
| Current sprint goal | `AGENT_LOG.md` → "Current Sprint" |
| Build/lint baseline + bug list | `specs/qa.md` |
| 3D game world component | `web/components/game/GameWorld.tsx` |
| Player avatar + sprite sheet | `web/components/game/PlayerAvatar.tsx` |
| Dashboard pages (overlays) | `web/app/student/dashboard/*/page.tsx` |
| Supabase clients | `web/lib/supabase/{client,server,admin}.ts` |
| DB types | `web/lib/supabase/types.ts` |
| Migrations | `web/supabase/migrations/` (portal: 001_initial, 002-008; recruitment: 001_recruitment, 009-012 — separate trees) |
| Design tokens | `web/styles/game-tokens.css` |
| Historical 5-agent log | `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md` |
| Deprecated specs | `archive/specs/` |

## Design principles (set 2026-05-25)

These guide every scope and design decision. When trade-offs arise, choose the option that satisfies these. Confirmed by David.

1. **Community over productivity.** The portal is a 3D hangout, not a productivity tool. Bounties, jobs, leaderboards are features inside the hangout, not the engagement engine. When you have to pick: more social presence, less task throughput.
2. **The world must never feel empty.** AI NPCs always populate the world, scaling inversely with real-player count. Ghost-replay of recent member positions if multiplayer isn't on. No empty-world states ever ship.
3. **XP rewards IRL, TC rewards money-equivalent value.** XP comes only from in-person event attendance (QR check-in) and special admin grants. TC comes only from delivering monetary-value work (bounties, paid projects). **Never reward online activity** — no login streaks, no "visited a building" XP, no Habitica grinding.
4. **Cosmetic > functional class system.** MBTI classes and avatar customization are flair, not mechanics. Don't gate features behind class. Rich cosmetic + class identity is a late-game build (Phase 3+).
5. **Mobile-aware, always.** No feature ships that's fundamentally desktop-only. Mobile members may get a stripped "view + emote + chat" mode, but they must be able to *appear online* on their phone.
6. **Leaderboard: top half public, bottom half private.** Bottom-half members see only their own rank and anonymized neighbors. Privacy default.
7. **Senior members can mute the game-feel.** No mandatory quests for T1-T3. Onboarding quests are opt-in for everyone, skippable in one click.
8. **The world has a monthly content cadence.** Admins drop new NPCs, new shop items, seasonal palettes, new events monthly. The build must include admin tooling that makes this easy — never code-only content updates.

---

## Working rules

- `cd web && npm install` requires `--legacy-peer-deps` (`.npmrc` is configured).
- `npm run dev` may fall back to port 3001 if 3000 is taken.
- Game world uses `next/dynamic` with `ssr: false` — `BAILOUT_TO_CLIENT_SIDE_RENDERING` in SSR output is expected, not an error.
- Middleware gracefully handles missing Supabase env vars — dev works without `.env.local`.
- **Never** edit applied migrations. Add new ones (next slot: `013_*`).
- **Never** reveal the TC ≈ CAD conversion rate in user-facing strings.
- Build agents: when scope is unclear, ask reviewer (David) before guessing. Don't add features the spec doesn't list.

## Commit prefixes

`[build]` / `[qa]` / `[review]` — see `AGENT_LOG.md` Commit Prefixes.

## Out of scope (do not touch unless tasked)

- `web/app/(site)/**` — marketing site
- `web/app/student/apply/**`, `web/components/recruit/**`, `web/components/admin/**` — recruitment system (live in prod)
- `web/components/sections/**` — marketing homepage sections
- Migrations `001_recruitment.sql`, `009_*`, `010_*`, `011_*`, `012_*` — recruitment schema
