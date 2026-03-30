# CLAUDE.md — Tethos (TSI) Project Bible

> **Read-only for all agents. Only Management edits this file.**

## Project Overview

**Tethos (TSI)** — "Technology That Moves People Forward"
A Next.js 16 multi-audience marketing website deployed on Vercel.

**Audiences:** NPOs, Companies, Sponsors, Students (each has a dedicated page)
**Repo:** UWO-TSI/tsi-website (web/ folder)
**Deploy:** Vercel auto-deploy on main push

**Key features:**
- 5 audience-specific pages with custom navbars and layouts
- 3D interactive globe (React Three Fiber, three-globe) on homepage
- Glassmorphism design system with dark theme
- Sophisticated animations (GSAP ScrollTrigger, Framer Motion, Lenis)
- ASCII art aesthetic (loading screen, dividers, reveals)
- AI-powered agent chat (@an-sdk)
- Custom cursor, smooth scroll, parallax effects

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Framer Motion, GSAP |
| 3D | React Three Fiber, Drei, Three.js, three-globe |
| AI | AI SDK, @an-sdk/agent, @an-sdk/nextjs |
| Language | TypeScript 5 |
| Scroll | Lenis |
| Icons | Lucide React, Heroicons |

## Directory Structure

```
web/
├── app/              # Next.js App Router pages
│   ├── (site)/       # Main site group
│   ├── api/          # API routes
│   ├── Companies/    # Companies page
│   ├── student/      # Student page
│   ├── sponsor/      # Sponsor page
│   ├── npo/          # NPO page
│   ├── company/      # Individual company page
│   └── layout.tsx    # Root layout
├── components/       # Shared React components
├── data/             # Static data/content
├── lib/              # Utilities and helpers
├── styles/           # Global styles
├── public/           # Static assets
└── DESIGN_SYSTEM.md  # Design system reference
```

## Team Roles & Responsibilities

| Agent | Role | Owns |
|-------|------|------|
| **Management** | Coordination, priorities, blockers, releases | CLAUDE.md, AGENT_LOG.md structure |
| **UXUI** | Design specs, tokens, user flows, wireframes | specs/ux.md, specs/tokens.md |
| **Frontend** | Implements UI from specs, components, pages | web/components/, web/app/ pages |
| **Backend** | API routes, data layer, AI integrations | web/app/api/, web/lib/, specs/api.md |
| **QA** | Testing, bug reports, regression checks | specs/qa.md, test files |

## Communication Protocol

All agents communicate via **AGENT_LOG.md** in the project root.

### Every Session Start
1. Read this file (CLAUDE.md) fully
2. Read AGENT_LOG.md fully
3. Check **Active Tasks** — look for anything blocking you or that you're blocking
4. Check if any agent has left notes for you specifically

### After Completing Work
1. Update Active Tasks in AGENT_LOG.md (check off done items, add new ones)
2. Write a dated entry in your section with:
   - What you completed
   - Files written/changed
   - What other agents need to know
   - Any blockers

### Permissions
- **Full autonomy.** All agents have full permissions on all tools. Do NOT ask for permission to run commands, edit files, install packages, or make commits. Just do it.
- **No confirmation prompts.** If your task says to do something, do it. Don't ask "should I proceed?" — proceed.

### Quality Gate
- **95% confidence rule.** Before committing any code change, self-review your work. Read back what you changed. Ask yourself: "Am I 95% confident this is correct and won't break anything?" If yes, commit. If no, either fix it until you are, or ask David a clarifying question. Do NOT commit uncertain work.
- **Run build after code changes.** If you changed code, run `cd web && npm run build` before committing. If it fails, fix it. Don't commit broken builds.

### Reporting
- **After EVERY completed task**, you MUST:
  1. Check off the task in Active Tasks section of AGENT_LOG.md
  2. Write a dated entry in your section of AGENT_LOG.md with:
     - What you completed
     - Files written/changed
     - What other agents need to know
     - Any blockers
  3. Write a **short report back to Management** at the end of your log entry — 2-3 sentences summarizing: what's done, what's next, any decisions you made independently
  4. Commit with prefix `[UXUI]`, `[FE]`, `[BE]`, `[QA]`, or `[MGMT]`

### Other Rules
- **Never overwrite another agent's section** in AGENT_LOG.md — append only
- **Never work outside your lane** — if you find yourself doing another agent's job, write a spec/request instead
- **If blocked, log it** and work on something else
- **If unsure about product intent**, ask David a clarifying question using AskUserQuestion with multi-choice options. Don't guess on product decisions.

## Commands

```bash
cd web && npm run dev    # Start dev server
cd web && npm run build  # Production build
cd web && npm run lint   # Run linter
```

## Current State (as of 2026-03-28)

**Marketing site:** ~75% production ready (5 audience pages built)
**Student portal:** Supabase auth exists (signup, login, election), dashboard is under-construction

| Area | Status |
|------|--------|
| Marketing pages | Complete (home, student, sponsor, npo, company) |
| Supabase Auth | Working — email/password + invite codes |
| Profiles table | Exists — ~30 fields, tier 1-4, gamification fields |
| Election system | Live, one-time event — archiving |
| Student dashboard | **NOT BUILT — this is the current sprint** |
| API | Minimal — only /api/an-token exists |

## Student Portal Vision

The student dashboard is a **2.5D isometric MMO game world** (Animal Crossing / Habbo Hotel):

- **Main area**: Isometric game world (PixiJS) — avatar, buildings, other players
- **Left sidebar**: Navigation to tools
- **Sidebar items**: Home, Directory, Bounty Board, Projects, Shop, Job Board, Leaderboard, Profile

**Features (full scope):**
- MMO game world with walk, explore, visit buildings, see other players
- Member directory (chapter-scoped, admins see all)
- Bounty board (real commission work, "Bounty Hunter" title required)
- Kanban board (per-project, shared with team)
- Shop (TSI coin currency — avatar cosmetics + merch)
- Job board (curated + member submissions)
- Leaderboard (XP, badges, levels)
- Profile/settings (name, bio, skills, avatar, social links)

**MVP**: Game world + Directory/Profiles
**Phase 2+**: Bounty board, kanban, shop, jobs, leaderboard

**Tier system (5 tiers):**
T1 = David (super admin), T2 = chapter presidents, T3 = PMs & VPs, T4 = directors & devs, T5 = volunteers

**Aesthetic:** Mix of terminal (admin/settings) + game UI (player-facing)
**Onboarding:** Mandatory profile setup before dashboard access
**Mobile:** Desktop first, mobile later

## Current Sprint Priority

> Updated by Management 2026-03-28. Check AGENT_LOG.md for detailed tasks.

**Phase 1 — Foundation (all agents parallel):**
1. UXUI: Ask David 8 design questions, then write specs
2. Frontend: Dashboard shell, routing, sidebar, page stubs, directory components
3. Backend: DB migrations (tiers, bounty, economy, game state), API routes, middleware update
4. QA: Build/lint report, auth flow testing, test plan

**Merge order:** Backend → Frontend → UXUI specs → QA
**Dependency chain:** Backend types → Frontend uses them → QA tests both
