# CLAUDE.md — uwotsi Project Bible

> **Read-only for all agents. Only Management edits this file.**

## Project Overview

**uwotsi** is a Next.js web application featuring:
- Multiple stakeholder pages: Companies, Students, Sponsors, NPOs
- 3D globe/visual experiences (React Three Fiber, Three.js, Drei)
- Smooth animations (Framer Motion, GSAP, Lenis scroll)
- AI-powered agent chat (@an-sdk, ai SDK)
- Tailwind CSS v4 for styling

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

### Rules
- **Never overwrite another agent's section** in AGENT_LOG.md — append only
- **Never work outside your lane** — if you find yourself doing another agent's job, write a spec/request instead
- **If blocked, log it** and work on something else
- **Commit frequently** with clear messages prefixed by your role: `[UXUI]`, `[FE]`, `[BE]`, `[QA]`, `[MGMT]`

## Commands

```bash
cd web && npm run dev    # Start dev server
cd web && npm run build  # Production build
cd web && npm run lint   # Run linter
```

## Current Sprint Priority

> Updated by Management. Check AGENT_LOG.md for latest.

1. Audit current state of all pages
2. Define design system tokens
3. Ensure all pages build without errors
4. Improve landing page experience
