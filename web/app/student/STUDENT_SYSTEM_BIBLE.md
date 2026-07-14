# STUDENT SYSTEM BIBLE

> Comprehensive specification for the TSI Student Dashboard, Auth, and Gamification System.
> Originally captured during the spec Q&A session. Updated 2026-05-21 to reflect the post-pivot vision.

---

## 🟡 CURRENT VISION DELTAS (updated 2026-07-13)

This bible was written before the 2026-03-29 product pivot to a **2.5D MMO RPG game world**. Most feature specs below (Bounty mechanics, Calendar, Kanban, Marketplace, Job Board, Directory) are still authoritative. The following sections have **drifted** and the corrections live in the sections themselves:

| Section | Original | Current |
|---------|----------|---------|
| §1 System Overview | 2D sidebar dashboard | **3D RPG game world** as primary nav; dashboard pages now open as overlays from buildings |
| §2 Architecture | Next.js + Supabase | + **React Three Fiber + Drei + PS1 shader**; Colyseus deferred for multiplayer |
| §4 RBAC | 4-tier (T1-T4) | **5-tier (T1-T5)** — T1 David / T2 chapter presidents / T3 PMs+VPs / T4 directors+devs / T5 volunteers+general |
| §6 Class System | Position-based (`ARCHITECT`, `ORACLE`, etc.) | **MBTI-based** — 4 main classes (Analyst/Diplomat/Sentinel/Explorer) + 16 subclasses, determined via Oracle Temple quiz |
| §7 Coin Economy | Explicit `100 TC ≈ $1 CAD` reveal | **Internal-only** — never expose conversion rate in user-facing content |
| §5 Onboarding | Terminal hacker theme | Theme retained; **adds Oracle Temple MBTI step + game-world tutorial** |

**Additions since 2026-05-21 (shipped, not yet reflected in sections below):**

| Area | Current state |
|------|---------------|
| Overlays | Shop / Bounty / Jobs / Leaderboard / Oracle open as **sheets over the running world** (Canvas never unmounts); other dashboard routes unchanged |
| Interiors | **HQ Resident Services room is live** (interiors-lite): enter via E at the door, six furnished stations wired to sheets, exit at the door. Shop/Oracle rooms are Phase 2 |
| Weather | Seeded daily **sunny / cloudy / rain** (58/24/18%), client-side; admin weather calendar is the Phase-2 swap-in |
| Collections | Fruit + 8 flower species + **10 fish + 13 bugs**, all with rendered ACNH item icons; zero TC/XP (principle #3) |
| World assets | `~/Downloads/GLB` dump is the **primary asset source** (David ruling 2026-07-13): ACNH road tiles, water caustics, furniture, landmarks, seasonal garlands wired to the admin palette |
| Lighting | PMREM environment (IBL) from the TOD palette — the "ACNH cozy reflections" pass |

**Canonical sources for current state:**
- `specs/asset-stack.md` — confirmed tech architecture (R3F + Drei + PS1 + Colyseus deferred + 2D sprite chars via Nano Banana)
- `specs/ux-status.md` — current sprint punch list (Tier-1 design debt, Tier-2 next sprint, Tier-3 future)
- `specs/ux-game-world-v2.md` — game world spec (AC overhaul)
- `specs/ux-oracle-v2.md` — MBTI quiz card-game encounter (stretch goal)
- `specs/ux-classes.md` — 4 main classes + 16 subclasses visual identity
- Memory file: `project_student_portal_vision.md` (in `~/.claude/projects/-Users-DavidLiu-Documents-GitHub-uwotsi/memory/`)

**Onboarding new agents:** Read `CLAUDE.md` (entry point) → `AGENT_LOG.md` (current sprint + your role) → role-specific specs in `specs/`. Use this bible for feature mechanics; trust the canonical sources above for architecture and class/tier system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Infrastructure](#2-architecture--infrastructure)
3. [Authentication & Signup](#3-authentication--signup)
4. [Permission System (RBAC)](#4-permission-system-rbac)
5. [Onboarding — Hacker Initiation](#5-onboarding--hacker-initiation)
6. [Gamification — Classes, XP, Levels](#6-gamification--classes-xp-levels)
7. [Tethos Coin Economy](#7-tethos-coin-economy)
8. [Dashboard Shell & Navigation](#8-dashboard-shell--navigation)
9. [Feature: Announcements](#9-feature-announcements)
10. [Feature: Bounty Board](#10-feature-bounty-board)
11. [Feature: Calendar](#11-feature-calendar)
12. [Feature: Kanban Boards](#12-feature-kanban-boards)
13. [Feature: Marketplace](#13-feature-marketplace)
14. [Feature: Job Board](#14-feature-job-board)
15. [Feature: Member Directory](#15-feature-member-directory)
16. [Feature: Tools Section](#16-feature-tools-section)
17. [Feature: Quest System](#17-feature-quest-system)
18. [Feature: Leaderboard](#18-feature-leaderboard)
19. [Feature: Portfolio Builder](#19-feature-portfolio-builder)
20. [Feature: Mentorship](#20-feature-mentorship)
21. [Feature: Time Capsule (Easter Egg)](#21-feature-time-capsule-easter-egg)
22. [Admin Panel](#22-admin-panel)
23. [Easter Eggs & Secret Features](#23-easter-eggs--secret-features)
24. [Database Schema](#24-database-schema)
25. [Term Lifecycle & Data Management](#25-term-lifecycle--data-management)
26. [Visual Design & Theming](#26-visual-design--theming)
27. [Implementation Priority](#27-implementation-priority)

---

## 1. System Overview

### What This Is
A full student portal for Tethos (UWO-TSI) — a student-run tech collective at Western University. The portal combines:
- **Auth & RBAC** — Supabase-powered login with 4-tier permissions
- **Dashboard** — Sidebar-driven app shell with widgets, notifications, announcements
- **Gamification** — XP, class-based ranks, achievements, virtual currency
- **Productivity** — Bounty board, calendar, kanban, directory
- **Economy** — Tethos Coin marketplace for merch redemption
- **Fun** — Easter eggs, unlockable themes, time capsule, hacker-themed onboarding

### Vibe
**Hybrid terminal + RPG.** Fun, creative, silly, weird. The dashboard should feel like a secret hacker guild crossed with an RPG character menu. Every interaction should have personality. Easter eggs everywhere.

### Who Uses It
- **~50–150 active members** per term
- Two organizational sides: **Operations** (External, Internal, Marketing portfolios) and **Projects** (7 NPO client teams this year)
- Desktop-primary (mobile should be functional but not the focus)

### Org Structure
```
Operations Side:                    Projects Side:
├── External Portfolio              ├── World Vision
│   ├── VP → Directors              │   ├── PM → Developers
├── Internal Portfolio              ├── International Rescue Committee
│   ├── VP → Directors              ├── Plan International
├── Marketing Portfolio             ├── Plan Catalyst
│   ├── VP → Directors              ├── London Children Museum
                                    ├── Childcan
                                    └── Canadian Red Cross
```

---

## 2. Architecture & Infrastructure

### Routing Strategy
- **Same Next.js codebase** — no separate app
- Dashboard lives at subdomain (e.g., `dashboard.tethos.org`)
- Middleware intercepts subdomain requests and routes to `/app/student/dashboard/` internally
- Public student landing page remains at `/student`

### Supabase Setup
- **New Supabase project** (to be created)
- Auth: email/password only (no OAuth, no magic link)
- Database: PostgreSQL with Row Level Security (RLS)
- Realtime: for notifications and live updates
- Storage: for profile avatars and marketplace item images

### Environment Variables (to add to `.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Tech Stack Additions
```
@supabase/supabase-js    — Supabase client
@supabase/ssr            — Server-side auth helpers for Next.js
three                    — 3D rendering (already in repo)
@react-three/fiber       — React renderer for Three.js (already in repo)
@react-three/drei        — R3F helpers: Billboard, Html, CameraControls, useFBO (already in repo)
```

### Game World Architecture (added 2026-05-21)

The primary student-facing surface is a **2.5D MMO RPG game world** (Dave the Diver / Octopath Traveler aesthetic) rendered via React Three Fiber. The traditional sidebar dashboard is now a **fallback navigation** — members primarily walk their avatar to buildings to access features.

**Rendering pipeline:**
- 3D buildings/terrain/props (Quaternius + Kenney CC0 packs)
- 2D sprite characters on billboarded quads (generated via Nano Banana 2/Pro API)
- PS1-style shader: `PS1Material.ts` (vertex snapping, affine textures, 8x8 Bayer dither, color depth reduction)
- ACNH-style curved-world shader: `y = -curvature * z²` applied via `onBeforeCompile` (visual only; raycasting on flat plane)
- Hemisphere lighting + atmospheric fog

**Multiplayer status:** DEFERRED. Phase 1 MVP is **single-player only**. Multiplayer (Colyseus, MIT, ~$15/mo) added in Phase 2. Supabase Realtime is NOT suitable for position sync (cost-prohibitive at 200 CCU).

**Map structure:**
- 2-3 screens wide, small campus with walking distance between buildings
- Fixed-follow camera, narrow FOV (30-45°)
- WASD/Arrow keys + click-to-move
- Buildings (enter → interior scene): HQ, Shop, Oracle Temple
- Objects (interact → overlay opens): Bounty Board, Job Board

Canonical spec: `specs/ux-game-world-v2.md` + `specs/asset-stack.md`.

### File Structure
```
web/app/student/
├── page.tsx                    # Public landing page (existing)
├── layout.tsx                  # Public layout (existing)
├── BIBLE.md                    # Landing page design spec (existing)
├── STUDENT_SYSTEM_BIBLE.md     # This document
├── login/
│   └── page.tsx                # Login page
├── signup/
│   └── page.tsx                # Signup page
├── onboarding/
│   └── page.tsx                # Onboarding flow
├── dashboard/
│   ├── layout.tsx              # Dashboard shell (sidebar + topbar)
│   ├── page.tsx                # Dashboard home (widgets)
│   ├── bounty/
│   │   └── page.tsx            # Bounty Board
│   ├── calendar/
│   │   └── page.tsx            # Calendar
│   ├── kanban/
│   │   └── page.tsx            # Kanban boards
│   ├── marketplace/
│   │   └── page.tsx            # Marketplace
│   ├── jobs/
│   │   └── page.tsx            # Job Board
│   ├── directory/
│   │   └── page.tsx            # Member Directory
│   ├── tools/
│   │   ├── page.tsx            # Tools hub
│   │   ├── ascii/
│   │   │   └── page.tsx        # ASCII converter
│   │   └── rag/
│   │       └── page.tsx        # RAG chatbot
│   ├── quests/
│   │   └── page.tsx            # Quest system
│   ├── leaderboard/
│   │   └── page.tsx            # Leaderboard
│   ├── portfolio/
│   │   └── page.tsx            # Portfolio builder
│   ├── mentorship/
│   │   └── page.tsx            # Mentorship matching
│   ├── profile/
│   │   └── page.tsx            # User profile/settings
│   └── admin/
│       ├── page.tsx            # Admin panel home
│       ├── members/
│       │   └── page.tsx        # Member management
│       ├── announcements/
│       │   └── page.tsx        # Announcement management
│       ├── quests/
│       │   └── page.tsx        # Quest CRUD
│       ├── bounties/
│       │   └── page.tsx        # Bounty approval
│       ├── marketplace/
│       │   └── page.tsx        # Item/price management
│       └── analytics/
│           └── page.tsx        # Dashboard analytics
│
web/lib/
├── supabase/
│   ├── client.ts               # Browser Supabase client
│   ├── server.ts               # Server Supabase client
│   ├── middleware.ts            # Auth middleware helper
│   └── types.ts                # Generated DB types
│
web/components/dashboard/
├── DashboardSidebar.tsx         # Main sidebar nav
├── DashboardTopbar.tsx          # Top bar with notifications
├── WidgetGrid.tsx               # Widget layout system
├── NotificationBell.tsx         # Notification dropdown
├── AnnouncementBanner.tsx       # Dismissible announcement bar
└── widgets/
    ├── XPWidget.tsx             # XP/level progress
    ├── CoinWidget.tsx           # Tethos Coin balance
    ├── QuestWidget.tsx          # Active quests
    ├── CalendarWidget.tsx       # Upcoming events
    ├── TeamWidget.tsx           # Team status
    └── AnnouncementWidget.tsx   # Recent announcements
```

---

## 3. Authentication & Signup

### Signup Flow
1. Student visits signup page
2. Enters: email (any email, not restricted to @uwo.ca), password, display name
3. Enters **invite code** (simple general code that all accepted members receive)
4. If valid code → account created, directed to onboarding
5. If no code → account created in "pending" state, requires admin approval (T1/T2)

**Invite Code System:**
- One active code at a time (e.g., `TETHOS-W26`)
- Generated by T1 admin
- Rotates per term
- Simple string match — no complex token system

### Login Flow
1. Email + password
2. Supabase handles session (JWT)
3. Middleware checks auth on all `/dashboard/*` routes
4. Unauthenticated → redirect to login
5. Authenticated but onboarding incomplete → redirect to onboarding
6. Authenticated + onboarded → dashboard

### Login Page Design
- Full page (not modal)
- Terminal-themed — blinking cursor, monospace font
- ASCII art header
- Minimal fields: email, password, submit
- Easter egg: typing specific passwords shows fun error messages

---

## 4. Permission System (RBAC)

### Tier Structure (5-tier, updated 2026-05-21)

| Tier | Roles | Access Level |
|------|-------|-------------|
| **T1** | David Liu only (President) | Full admin + economy god mode. Create/destroy coins, global settings, all features, all data. |
| **T2** | Chapter Presidents | Member management, bounty CRUD, analytics, all admin tools **except** economy god mode. |
| **T3** | Project Managers (PM), Vice Presidents (VP), PM Officer (PMO), Senior Advisors (SA) | Bounty management, submission review, event creation, team-level admin. |
| **T4** | Directors, Developers | Standard member features. May have special project access. Can claim bounties (if qualified as Bounty Hunter), complete quests, earn coins. |
| **T5** | Volunteers, General Members | Basic member features. View directory, attend events, basic profile. |

**DB note:** `001_initial_schema.sql` had `CHECK (tier BETWEEN 1 AND 4)`. Confirm migration `004_cleanup_and_extend.sql` updated this to `BETWEEN 1 AND 5`.

### Permission Matrix

| Feature | T1 | T2 | T3 | T4 |
|---------|----|----|----|----|
| Dashboard Home | ✅ | ✅ | ✅ | ✅ (limited widgets) |
| Bounty Board | ✅ CRUD + approve | ✅ CRUD + approve | ✅ view + claim | ❌ |
| Calendar | ✅ full | ✅ create events | ✅ view + export | ✅ view only |
| Kanban | ✅ all boards | ✅ all boards | ✅ own team | ❌ |
| Marketplace | ✅ manage items | ✅ manage items | ✅ browse + buy | ❌ |
| Job Board | ✅ moderate | ✅ moderate | ✅ post + browse | ✅ browse only |
| Directory | ✅ full + edit | ✅ full | ✅ full | ✅ view only |
| Tools (ASCII/RAG) | ✅ | ✅ | ✅ | ❌ |
| Quests | ✅ create + manage | ✅ create + manage | ✅ accept + complete | ❌ |
| Leaderboard | ✅ | ✅ | ✅ | ✅ view only |
| Portfolio Builder | ✅ | ✅ | ✅ | ❌ |
| Mentorship | ✅ | ✅ | ✅ | ❌ |
| Profile | ✅ | ✅ | ✅ | ✅ (basic) |
| Announcements | ✅ create/delete | ✅ create/delete | ✅ view | ✅ view |
| Admin Panel | ✅ full | ✅ full | ❌ | ❌ |
| Member Management | ✅ promote/demote | ✅ promote/demote | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ |

### Tier Assignment
- On signup with invite code → T4 by default
- T1/T2 admins manually promote members to appropriate tier
- Promotion/demotion only by T1 and T2
- T2 cannot promote to T1 (only existing T1 can)

---

## 5. Onboarding — Hacker Initiation

### Theme
A "hacker initiation" experience. The new member is being "inducted" into the system. Terminal-style prompts, glitchy animations, progressive unlocks. Makes joining the club feel like entering a secret guild.

### Flow
1. **Welcome Screen** — Terminal boot sequence, ASCII art, "INITIATING NEW AGENT..."
2. **Profile Setup** — Collect directory info progressively (not a big form):
   - Name, year, program
   - Phone, preferred email, UWO email, Google Drive email
   - GitHub username (for devs)
   - Instagram, LinkedIn, Discord tag
   - Birthday
   - Hometown
   - Favourite music, dream retirement location, spirit animal, fun fact
3. **Class Assignment** — Auto-assigned based on position (explained in gamification section)
4. **Subclass Selection** — Choose specialty within their role
5. **First Quest** — A simple task to learn the dashboard (e.g., "Visit the Bounty Board", "Check the Calendar")
6. **Completion** — "AGENT INITIALIZED. WELCOME TO TETHOS." + Tethos Coin reward

### Rules
- **Required but pausable** — Cannot access dashboard until Step 2 (profile) is complete
- Progress saved between sessions
- Steps 3–5 can be completed at the member's pace
- Completing all onboarding steps awards bonus XP + Tethos Coins

---

## 6. Gamification — Classes, XP, Levels

### Class System (MBTI-based, updated 2026-05-21)

Class is determined via the **Oracle Temple MBTI quiz** taken during onboarding (12 questions). Cosmetic only — visual theme + title on profile. Will expand to gameplay impact later. Canonical spec: `specs/ux-classes.md` + `specs/ux-oracle-v2.md`.

**4 Main Classes** (mapped to MBTI temperament groups):

| Class | MBTI Group | Vibe |
|-------|-----------|------|
| **Analyst** | NT (INTJ, INTP, ENTJ, ENTP) | Strategic, logical, system-builders |
| **Diplomat** | NF (INFJ, INFP, ENFJ, ENFP) | Empathetic, idealistic, connectors |
| **Sentinel** | SJ (ISTJ, ISFJ, ESTJ, ESFJ) | Reliable, organized, executors |
| **Explorer** | SP (ISTP, ISFP, ESTP, ESFP) | Adaptable, hands-on, makers |

**16 Subclasses** — one per MBTI type, each with a unique name. See `specs/ux-classes.md` for the full naming table and visual identity (color, icon, lore).

### Legacy Position-Based Classes (DEPRECATED — kept for historical reference)

The original 2026-03 design assigned classes by position (`ARCHITECT`, `ORACLE`, `ENGINEER`, etc.). This was replaced by the MBTI system at the Oracle Temple pivot. Position info still drives **role tags** on profiles (PM, VP, Director, Developer) but is independent from class.

### XP System
Experience points earned through platform activity.

| Action | XP Reward |
|--------|-----------|
| Complete onboarding | 500 XP |
| Complete a quest (daily) | 50–100 XP |
| Complete a quest (weekly) | 200–500 XP |
| Complete a quest (seasonal) | 1000–2500 XP |
| Claim + complete a bounty | 100–1000 XP (scales with difficulty) |
| Attend an event | 100 XP |
| Post a job listing | 25 XP |
| Help a team member (peer endorsement) | 50 XP |
| First login of the day | 10 XP |
| Weekly streak (7 consecutive days) | 200 XP bonus |

### Level Progression
Levels use a curve: each level requires more XP than the last.

```
Level 1:    0 XP       (INITIATE)
Level 2:    500 XP
Level 3:    1,200 XP
Level 4:    2,100 XP
Level 5:    3,500 XP   (ADEPT)
Level 10:   15,000 XP  (VETERAN)
Level 15:   35,000 XP  (ELITE)
Level 20:   60,000 XP  (LEGEND)
Level 25:   100,000 XP (MYTHIC)
```

Formula: `xp_required = floor(100 * level^1.8)`

### Rank Titles (based on level brackets)
| Level Range | Rank |
|-------------|------|
| 1–4 | Initiate |
| 5–9 | Adept |
| 10–14 | Veteran |
| 15–19 | Elite |
| 20–24 | Legend |
| 25+ | Mythic |

### Achievements
Collaborative achievements that encourage teamwork and engagement.

**Examples:**
| Achievement | Condition | Reward |
|-------------|-----------|--------|
| `FIRST_BLOOD` | Complete first bounty | 100 TC + badge |
| `TEAM_PLAYER` | Complete 5 team tasks | 200 TC + badge |
| `QUEST_MASTER` | Complete 50 quests | 500 TC + badge |
| `SOCIAL_BUTTERFLY` | Attend 10 events | 300 TC + badge |
| `COIN_COLLECTOR` | Earn 5000 TC total | Badge |
| `STREAK_WARRIOR` | 30-day login streak | 1000 TC + badge |
| `BOUNTY_HUNTER` | Complete 10 bounties | 500 TC + badge |
| `MENTOR` | Help 5 mentees | 400 TC + badge |
| `NIGHT_OWL` | Log in after midnight 10 times | Badge |
| `EARLY_BIRD` | Log in before 7am 10 times | Badge |
| `FULL_HOUSE` | Fill out every profile field | 100 TC + badge |
| `TIME_TRAVELER` | Find the Time Capsule | Badge (secret) |
| `KONAMI_MASTER` | Enter the Konami code | Badge (secret) |

---

## 7. Tethos Coin Economy

### Currency
- **Name:** Tethos Coin (TC)
- **Symbol:** Custom designed (to be created — stylized T with circuit/node motif)
- **Exchange rate:** Internal-only reference for admin pricing. **NEVER reveal the conversion rate in user-facing content.** Members see only TC values, never CAD equivalents.

### Earning Tethos Coins

| Action | TC Reward |
|--------|-----------|
| Complete onboarding | 500 TC |
| Birthday | 200 TC (auto-awarded) |
| Attend club event | 50–100 TC |
| Win competition/hackathon | 500–2000 TC |
| Attend social | 50 TC |
| Complete daily quest | 10–25 TC |
| Complete weekly quest | 50–150 TC |
| Complete seasonal quest | 200–500 TC |
| Bounty completion bonus | Varies (bounty-specific) |
| Achievement unlock | Varies per achievement |
| Login streak bonus (weekly) | 50 TC |

### Spending
- **Marketplace items** — Real merch (candles, keychains, stickers, etc.)
- **Theme unlocks** — Dashboard themes purchasable with TC
- Future: mystery boxes, lucky draws (deferred — add later)

### Admin Controls
- T1/T2 can set prices for all marketplace items
- T1/T2 can award TC manually (event prizes, corrections)
- T1/T2 can view TC economy analytics (total in circulation, spending patterns)
- No TC removal from members (only spending)

---

## 8. Dashboard Shell & Navigation

### Layout
```
┌──────────────────────────────────────────────────────┐
│ [Announcement Banner — dismissible, urgency-colored] │
├──────────┬───────────────────────────────────────────┤
│          │  [Topbar: Search | Notifications | Profile]│
│          ├───────────────────────────────────────────┤
│ Sidebar  │                                           │
│          │         Main Content Area                 │
│ - Home   │                                           │
│ - Bounty │         (Widgets on home,                 │
│ - Cal    │          or feature pages)                │
│ - Kanban │                                           │
│ - Market │                                           │
│ - Jobs   │                                           │
│ - Dir    │                                           │
│ - Tools  │                                           │
│ - Quests │                                           │
│ - Board  │                                           │
│ ─────    │                                           │
│ - Admin  │                                           │
│ - Profile│                                           │
└──────────┴───────────────────────────────────────────┘
```

### Sidebar Items
**Core:**
- 🏠 Home (Dashboard)
- ⚔️ Bounty Board
- 📅 Calendar
- 📋 Kanban
- 🛒 Marketplace
- 💼 Job Board
- 👥 Directory
- 🔧 Tools
- 🎯 Quests
- 🏆 Leaderboard

**Personal:**
- 🎨 Portfolio
- 🤝 Mentorship
- 👤 Profile

**Admin (T1/T2 only):**
- ⚙️ Admin Panel

### Sidebar Style
Hybrid terminal + game aesthetic:
- Dark background matching `--color-bg-main`
- Monospace labels (IBM Plex Mono)
- Active item: blue glow highlight (`--color-brand-blue`)
- Hover: subtle cyan accent
- Icons: custom or Lucide, styled to feel like terminal/RPG menu items
- Collapsed mode: icons only (expandable)

### Widget System (Home Page)
Fixed widget set, customizable layout (drag to reorder, saved per user).

**Available Widgets:**
1. **XP & Level** — Progress bar, current level, rank title, XP to next level
2. **Tethos Coin Balance** — Current TC, recent transactions, mini spending chart
3. **Active Quests** — List of in-progress quests with deadlines
4. **Upcoming Events** — Next 3–5 calendar events
5. **Team Status** — Team name, current sprint, kanban summary
6. **Recent Announcements** — Latest 3 announcements
7. **Bounty Spotlight** — Highest-paying available bounty
8. **Achievement Progress** — Next closest achievement

### Notification System
- **In-app only** (no email, no push)
- Bell icon in topbar with unread count badge
- Dropdown shows recent notifications
- Types: bounty assigned, quest completed, coin earned, achievement unlocked, team update, event reminder
- Mark as read / mark all as read

---

## 9. Feature: Announcements

### Two Layers

**1. Banner Announcements (top of dashboard)**
- Created by T1/T2
- Appears as a bar above the main content
- Dismissible per user (click X to hide)
- Supports urgency levels:
  - `info` — Blue background, general updates
  - `warning` — Yellow background, important notices
  - `critical` — Red background, urgent action required
- Auto-expire: admin sets expiration date
- Only one active banner at a time (latest takes priority)

**2. Announcement Feed (sidebar page)**
- Scrollable log of all past + current announcements
- Pinned/active announcements at top
- Searchable
- Rich text support (markdown)
- T1/T2 can edit/delete
- Each announcement shows: author, timestamp, urgency, title, body

---

## 10. Feature: Bounty Board

### Concept
RPG-style bounty board. Real commission work — software gigs that pay real money (CAD) and/or Tethos Coins. Feels like a quest board in a tavern.

### Access
- T3+ can view and claim bounties
- Anyone can submit a bounty (goes to approval queue)
- T1/T2 approve/reject submitted bounties

### Bounty Card Display
Styled like RPG quest cards / wanted posters:

```
┌─────────────────────────────────┐
│  ☠☠☠☠☆  DIFFICULTY: HARD       │
│                                 │
│  E-Commerce Dashboard           │
│  for Local Bakery               │
│                                 │
│  💰 $500 CAD + 2000 TC          │
│  ⏰ Due: Apr 15, 2026            │
│  🔧 React, Supabase, Stripe     │
│  📊 Status: OPEN                │
│                                 │
│  [ CLAIM BOUNTY ]               │
└─────────────────────────────────┘
```

### Bounty Fields
- Title
- Description (full brief, expanded on click)
- Client/requester name
- Pay: CAD amount and/or TC reward
- Difficulty: skull rating (1–5 skulls: ☠)
- Deadline
- Tech stack tags
- Status: `OPEN` | `CLAIMED` | `IN_PROGRESS` | `REVIEW` | `COMPLETED` | `EXPIRED`
- Assigned member(s)
- Deliverables checklist

### Bounty Lifecycle
1. Anyone submits bounty → enters approval queue
2. T1/T2 reviews → approve (set difficulty + reward) or reject
3. Approved bounty appears on board as `OPEN`
4. T3+ member claims bounty → status becomes `CLAIMED`
5. Work begins → `IN_PROGRESS` (auto-adds to member's calendar)
6. Deliverables submitted → `REVIEW`
7. Admin/client confirms → `COMPLETED` → payout triggered
8. Past deadline with no completion → `EXPIRED`

---

## 11. Feature: Calendar

### Concept
Central calendar showing all TSI events. Not a full Google Calendar replacement — focused on club activity.

### Event Types
- **Club Events** — General meetings, socials, workshops
- **Team Deadlines** — Sprint ends, deliverable dates
- **Bounty Deadlines** — Auto-added when bounty is claimed
- **Volunteer Opportunities** — Open to T4
- **Personal** — User-added items (only visible to them)

### Event Creation
- Anyone can propose an event → requires T1/T2 approval
- T1/T2 can create events directly (no approval needed)
- Team leads (T2/T3 with PM/VP role) can create team events directly

### Google Calendar Integration
- **One-way export only** — TSI events can be exported as `.ics` feed
- Members add the feed URL to their Google Calendar
- Feed updates in real-time as events are added/modified
- No Google OAuth needed — just a public/authenticated calendar feed URL

### Calendar UI
- Month/week/day views
- Color-coded by event type
- Click event → detail modal
- Responsive (works on mobile, optimized for desktop)

---

## 12. Feature: Kanban Boards

### Concept
Custom-built kanban boards for team project management. Each team has their own board.

### Structure
- One board per team (auto-created when team is formed)
- Teams are term-based (reset each term — see Term Lifecycle)
- Both project teams (PM → Devs) and operations teams (VP → Directors) get boards

### Columns
**Standard set (every board starts with):**
- `Backlog` → `To Do` → `In Progress` → `Review` → `Done`

**Custom columns:** Team leads can add/rename/reorder columns.

### Cards
- Title
- Description (markdown)
- Assigned member(s)
- Due date (syncs to calendar)
- Priority: Low / Medium / High / Urgent
- Labels/tags
- Checklist (subtasks)
- Comments thread

### Permissions
- T1/T2: Access all boards
- T3: Access own team's board only
- T4: No access

### Calendar Integration
- Cards with due dates automatically appear in the member's calendar
- Drag-to-reschedule updates both kanban and calendar

---

## 13. Feature: Marketplace

### Concept
Spend Tethos Coins on real merch. Simple inventory system — students browse, "purchase" with TC, pick up in person.

### Item Display
```
┌─────────────────────┐
│  [Item Photo]        │
│                      │
│  Tethos Keychain     │
│  ₮ 300               │
│  Stock: 12 left      │
│                      │
│  [ BUY ]             │
└─────────────────────┘
```

### Item Fields
- Name
- Description
- Photo
- Price (in TC)
- Stock count
- Category (merch, accessories, themes, etc.)
- Status: available / sold out / coming soon

### Purchase Flow
1. Student browses marketplace
2. Clicks "Buy" on item
3. Confirmation modal: "Spend ₮300 on Tethos Keychain?"
4. TC deducted from balance
5. Order created with status `PENDING_PICKUP`
6. Student picks up item in person
7. Admin marks order as `FULFILLED`

### Fulfillment
- In-person pickup only (no shipping)
- Admin manages fulfillment status
- Order history visible to student

### Theme Purchases
- Dashboard themes are marketplace items
- Once purchased, theme appears in profile settings
- Theme applies to the entire dashboard UI
- Default theme: dark (included free)

### Future (deferred)
- Mystery boxes
- Lucky draws
- Haggling mini-game
- Limited-time drops

---

## 14. Feature: Job Board

### Concept
Open, community-driven job board. Members share job/internship postings they find online. Light moderation.

### Access
- T3+: Post and browse
- T4: Browse only
- T1/T2: Moderate (approve/flag/remove)

### Listing Fields
- Job title
- Company
- Location (remote/on-site/hybrid)
- Type (internship, full-time, part-time, contract)
- Link to original posting
- Categories/tags (engineering, design, PM, data, etc.)
- Posted by (member name)
- Discussion thread (comments)

### Moderation
- Light approval: posts from T3 go live immediately but can be flagged
- T1/T2 can remove inappropriate posts
- Community flagging system

---

## 15. Feature: Member Directory

### Concept
Searchable directory of all current members and past alumni.

### Profile Fields (collected during onboarding)
| Field | Visibility |
|-------|-----------|
| Name | All |
| Position/Title | All |
| Team/Portfolio | All |
| Class + Subclass | All |
| Level + Rank | All |
| Year | All |
| Program | All |
| Hometown | All |
| Birthday | Members only (not public) |
| Phone | Self + Admin only |
| Preferred Email | All |
| UWO Email | Members only |
| Google Drive Email | Self + Admin only |
| GitHub Username | All (devs) |
| Instagram | All |
| LinkedIn | All |
| Discord Tag | All |
| Favourite Music | All |
| Dream Retirement Location | All |
| Spirit Animal | All |
| Fun Fact | All |

### Directory UI
- Card grid layout (like a yearbook)
- Search by name, team, position, program
- Filter by: team, portfolio, tier, class, year
- Click card → expanded profile view
- Alumni tab: past members with "Alumni" badge
- Current members vs alumni toggle

### Data Migration
- Existing Google Sheet data will be migrated manually by admin
- Future members provide data through onboarding

---

## 16. Feature: Tools Section

### Concept
Embedded club tools accessible from the dashboard. Two tools at launch.

### Tool 1: ASCII Converter
- Existing tool (embed via iframe or integrate directly)
- Converts images/text to ASCII art
- Used by marketing team for social media content

### Tool 2: RAG Chatbot
- Backend exists in separate repo (to be connected later)
- Dashboard provides placeholder UI
- Interface: ChatGPT-style chat interface
- Theme: terminal/hacker aesthetic matching dashboard
- Input: monospace text field with blinking cursor
- Messages: styled as terminal output
- "Thinking" state: ASCII loading animation
- Context: TSI internal knowledge base

### UI Layout
- Tools hub page lists available tools as cards
- Click card → opens tool in full dashboard content area
- Each tool is a sub-route (`/dashboard/tools/ascii`, `/dashboard/tools/rag`)

---

## 17. Feature: Quest System

### Concept
Admin-created challenges that members can accept and complete for XP + TC rewards. Separate from onboarding.

### Quest Types
- **Daily** — Small tasks, refresh every 24h. (e.g., "Log in today", "Check the bounty board")
- **Weekly** — Medium challenges, refresh every 7 days. (e.g., "Complete 3 daily quests", "Attend an event this week")
- **Seasonal** — Large goals spanning weeks/months. (e.g., "Complete 5 bounties this term", "Reach Level 10")

### Quest Fields
- Title
- Description
- Type: daily / weekly / seasonal
- XP reward
- TC reward
- Completion criteria (manual check-in or auto-tracked)
- Start date / end date
- Max completions (per member)

### Quest Management
- T1/T2 create and manage quests via Admin Panel
- Can create recurring quests (auto-generate daily/weekly)
- Can create one-time special quests
- Analytics: completion rates, popular quests

### Quest UI
- Quest list with filter by type
- Accept quest → added to "Active Quests" widget
- Progress tracking (if multi-step)
- Completion animation: XP + TC award flyout

---

## 18. Feature: Leaderboard

### Concept
Team-based leaderboard. Combined XP of all team members determines team ranking.

### Display
```
🏆 LEADERBOARD — WINTER 2026

 #1  World Vision Team          │ 45,200 XP
 #2  Marketing Portfolio        │ 38,900 XP
 #3  Canadian Red Cross Team    │ 35,100 XP
 #4  External Portfolio         │ 31,400 XP
 ...
```

### Scoring
- Team XP = sum of all member XP within that team
- Both project teams and operations portfolios compete
- Resets each term

### Views
- Team ranking (default)
- Individual ranking (opt-in, optional — not everyone wants to be ranked)
- Historical: past term winners

### Access
- All tiers can view
- T4: view only (can see rankings but can't earn team XP)

---

## 19. Feature: Portfolio Builder

### Concept
Members build a public portfolio showcasing their TSI work. Shareable outside the platform.

### Portfolio Contents
- Auto-populated: completed bounties, projects, team contributions
- Manual additions: personal projects, case studies, skills
- Profile info: name, class, subclass, level
- Social links
- Custom bio/about section

### Public Access
- Portfolio URL: `tethos.org/portfolio/[username]`
- No login required to view
- Clean, professional presentation (separate from the gamified dashboard aesthetic)
- Subtle Tethos branding

### Building UI
- Drag-and-drop section ordering
- Toggle which items to show/hide
- Live preview
- Custom color accent (within Tethos palette)

---

## 20. Feature: Mentorship

### Concept
Self-service mentorship matching. Browse available mentors, request mentorship.

### How It Works
1. Members opt-in as mentors (set skills, availability)
2. Members browse mentor directory
3. Request mentorship → mentor accepts/declines
4. Matched pairs can communicate externally (Discord, in-person)
5. No in-app messaging

### Mentor Profile
- Skills offered
- Experience level
- Availability (hours per week)
- Short bio
- Max mentees
- Current mentee count

### Access
- T3+: Can be mentor or mentee
- T4: No access

---

## 21. Feature: Time Capsule (Easter Egg)

### Concept
Hidden, optional feature. Members who discover it can write a message to their future self.

### How It Works
- Hidden somewhere in the dashboard (no sidebar link)
- Found through an easter egg (e.g., specific click pattern, hidden link in ASCII art, konami code variant)
- Once found: member writes a message + selects open date (1 term, 1 year, custom)
- Message is encrypted/sealed
- On open date: notification appears with the sealed message
- Achievement unlocked: `TIME_TRAVELER`

### Rules
- Optional
- One active capsule per member
- Cannot edit after sealing
- Admin cannot read capsules (client-side encryption or at minimum, no admin UI for it)

---

## 22. Admin Panel

### Access
T1 and T2 only.

### Sections

**1. Member Management**
- View all members
- Promote/demote tiers
- Deactivate accounts
- View member activity (XP, quests, bounties, TC balance)
- Bulk actions (promote cohort, reset term)

**2. Announcement Management**
- Create/edit/delete announcements
- Set urgency level
- Set expiration date
- View dismissal analytics

**3. Quest Management**
- Create/edit/delete quests
- Set rewards
- View completion analytics
- Create recurring quest templates

**4. Bounty Management**
- Approve/reject submitted bounties
- Set difficulty ratings
- Track bounty lifecycle
- View completion stats

**5. Marketplace Management**
- Add/edit/remove items
- Set prices
- Track inventory
- View purchase analytics
- Manage fulfillment queue

**6. Event Management**
- Create events directly
- Approve/reject proposed events
- View attendance

**7. Analytics Dashboard**
- Active members (daily/weekly/monthly)
- XP distribution
- TC economy (total in circulation, spending patterns, top earners)
- Quest completion rates
- Bounty completion rates
- Feature usage stats
- Engagement trends over time

---

## 23. Easter Eggs & Secret Features

### Konami Code
- `↑ ↑ ↓ ↓ ← → ← → B A` anywhere in dashboard
- Effect: screen glitches, ASCII art explosion, secret achievement unlocked
- One-time reveal per member

### Secret Login Messages
- Typing specific strings as password shows fun error messages
- e.g., "password" → "Really? That's your hacker password?"
- e.g., "admin" → "Nice try. The council is watching."
- Doesn't affect actual auth — just fun UI responses

### Hidden Pages
- Secret route(s) accessible only if you know the URL
- Content: ASCII art gallery, credits page, dev team easter eggs

### Profile Secrets
- Certain spirit animal + retirement location combinations trigger special badge
- e.g., Spirit Animal: "Capybara" + Retirement: "Mars" → `COSMIC_CAPYBARA` badge

### Dashboard Secrets
- Click the Tethos logo 10 times → temporary theme flip (everything inverts)
- Scroll to the very bottom of the leaderboard → "You've reached the void" message
- Type "sudo" in any search field → fun ASCII response

### Achievement: `EXPLORER`
- Visit every single page in the dashboard → unlocks `EXPLORER` achievement

---

## 24. Database Schema

### Core Tables

#### `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 4 CHECK (tier BETWEEN 1 AND 4),
  position TEXT,           -- 'president', 'senior_advisor', 'pmo', 'pm', 'vp', 'developer', 'director', 'general', 'volunteer'
  class TEXT,              -- 'ARCHITECT', 'ORACLE', 'STRATEGIST', etc.
  subclass TEXT,
  team_id UUID REFERENCES teams(id),
  portfolio TEXT,          -- 'external', 'internal', 'marketing', null
  side TEXT,               -- 'operations', 'projects', null

  -- Gamification
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  rank TEXT NOT NULL DEFAULT 'Initiate',
  tethos_coins INTEGER NOT NULL DEFAULT 0,

  -- Onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0,

  -- Profile fields
  year TEXT,
  program TEXT,
  hometown TEXT,
  birthday DATE,
  phone TEXT,
  preferred_email TEXT,
  uwo_email TEXT,
  gdrive_email TEXT,
  github_username TEXT,
  instagram TEXT,
  linkedin TEXT,
  discord_tag TEXT,
  favourite_music TEXT,
  dream_retirement TEXT,
  spirit_animal TEXT,
  fun_fact TEXT,
  avatar_url TEXT,
  bio TEXT,

  -- Theme
  active_theme TEXT NOT NULL DEFAULT 'dark',

  -- Meta
  is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  login_streak INTEGER NOT NULL DEFAULT 0
);
```

#### `teams`
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  side TEXT NOT NULL,          -- 'operations' or 'projects'
  portfolio TEXT,              -- 'external', 'internal', 'marketing' (ops only)
  npo_partner TEXT,            -- Client name (projects only)
  term TEXT NOT NULL,          -- 'W2026', 'F2026', etc.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `invite_codes`
```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  term TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `announcements`
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,          -- Markdown
  urgency TEXT NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'critical')),
  is_banner BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `announcement_dismissals`
```sql
CREATE TABLE announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);
```

### Bounty Tables

#### `bounties`
```sql
CREATE TABLE bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,   -- Markdown
  client_name TEXT,
  pay_cad DECIMAL(10,2),
  pay_tc INTEGER,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),  -- Skull rating
  deadline TIMESTAMPTZ,
  tech_stack TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'claimed', 'in_progress', 'review', 'completed', 'expired')),
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `bounty_claims`
```sql
CREATE TABLE bounty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID REFERENCES bounties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(bounty_id, user_id)
);
```

#### `bounty_deliverables`
```sql
CREATE TABLE bounty_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID REFERENCES bounties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ
);
```

### Calendar Tables

#### `events`
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('club', 'team', 'bounty', 'volunteer', 'social', 'workshop', 'meeting')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  team_id UUID REFERENCES teams(id),
  bounty_id UUID REFERENCES bounties(id),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'cancelled')),
  tc_reward INTEGER DEFAULT 0,     -- TC for attending
  xp_reward INTEGER DEFAULT 0,     -- XP for attending
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `event_attendance`
```sql
CREATE TABLE event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'absent')),
  UNIQUE(event_id, user_id)
);
```

### Kanban Tables

#### `kanban_boards`
```sql
CREATE TABLE kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `kanban_columns`
```sql
CREATE TABLE kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,       -- Sort order
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `kanban_cards`
```sql
CREATE TABLE kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `kanban_card_assignees`
```sql
CREATE TABLE kanban_card_assignees (
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, user_id)
);
```

#### `kanban_card_labels`
```sql
CREATE TABLE kanban_card_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT
);
```

#### `kanban_card_comments`
```sql
CREATE TABLE kanban_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `kanban_card_checklist`
```sql
CREATE TABLE kanban_card_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL
);
```

### Marketplace Tables

#### `marketplace_items`
```sql
CREATE TABLE marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_tc INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'merch' CHECK (category IN ('merch', 'theme', 'accessory', 'special')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold_out', 'coming_soon', 'hidden')),
  theme_id TEXT,               -- For theme items: the theme identifier
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `marketplace_orders`
```sql
CREATE TABLE marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  item_id UUID REFERENCES marketplace_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_tc INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_pickup' CHECK (status IN ('pending_pickup', 'fulfilled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);
```

### Job Board Tables

#### `job_listings`
```sql
CREATE TABLE job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  job_type TEXT NOT NULL CHECK (job_type IN ('internship', 'full_time', 'part_time', 'contract')),
  url TEXT NOT NULL,
  categories TEXT[],
  tags TEXT[],
  posted_by UUID REFERENCES profiles(id),
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `job_comments`
```sql
CREATE TABLE job_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES job_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Quest Tables

#### `quests`
```sql
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'seasonal')),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  tc_reward INTEGER NOT NULL DEFAULT 0,
  criteria TEXT,                    -- JSON: completion criteria description
  is_auto_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  auto_track_type TEXT,             -- 'login', 'bounty_complete', 'event_attend', etc.
  auto_track_count INTEGER,         -- How many times needed
  max_completions INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval TEXT,         -- 'daily', 'weekly'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `quest_progress`
```sql
CREATE TABLE quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'in_progress', 'completed', 'expired')),
  progress INTEGER NOT NULL DEFAULT 0,     -- For multi-step: current count
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(quest_id, user_id)
);
```

### Gamification Tables

#### `achievements`
```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,                       -- Emoji or icon identifier
  tc_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  criteria_type TEXT,              -- 'bounty_count', 'quest_count', 'login_streak', etc.
  criteria_value INTEGER,          -- Threshold
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `user_achievements`
```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);
```

#### `tc_transactions`
```sql
CREATE TABLE tc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,           -- Positive = earn, negative = spend
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn_quest', 'earn_bounty', 'earn_event', 'earn_achievement', 'earn_birthday', 'earn_streak', 'earn_admin', 'spend_marketplace', 'spend_theme')),
  reference_id UUID,                 -- Quest/bounty/item ID
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `xp_transactions`
```sql
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,                -- Same types as tc_transactions
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Notification Tables

#### `notifications`
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                -- 'bounty_assigned', 'quest_complete', 'coin_earned', 'achievement', 'team_update', 'event_reminder'
  title TEXT NOT NULL,
  body TEXT,
  reference_type TEXT,               -- 'bounty', 'quest', 'event', etc.
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Mentorship Tables

#### `mentorship_profiles`
```sql
CREATE TABLE mentorship_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  is_mentor BOOLEAN NOT NULL DEFAULT FALSE,
  skills TEXT[],
  availability TEXT,                 -- 'low', 'medium', 'high'
  max_mentees INTEGER DEFAULT 3,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `mentorship_matches`
```sql
CREATE TABLE mentorship_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES profiles(id),
  mentee_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Portfolio Tables

#### `portfolios`
```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  slug TEXT NOT NULL UNIQUE,         -- URL slug
  bio TEXT,
  accent_color TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sections JSONB NOT NULL DEFAULT '[]',  -- Ordered list of section configs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `portfolio_items`
```sql
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bounty', 'project', 'personal', 'case_study')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  tech_stack TEXT[],
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  reference_id UUID,                 -- Bounty/project ID if auto-populated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Time Capsule Table

#### `time_capsules`
```sql
CREATE TABLE time_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,             -- Encrypted or plain
  open_date TIMESTAMPTZ NOT NULL,
  is_opened BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Themes Table

#### `themes`
```sql
CREATE TABLE themes (
  id TEXT PRIMARY KEY,               -- 'dark', 'cyberpunk', 'forest', etc.
  name TEXT NOT NULL,
  description TEXT,
  css_variables JSONB NOT NULL,      -- Override CSS custom properties
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  preview_url TEXT
);
```

#### `user_themes`
```sql
CREATE TABLE user_themes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  theme_id TEXT REFERENCES themes(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, theme_id)
);
```

### RLS Policies (Key Examples)

```sql
-- Profiles: users can read all, update only own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Bounties: all authenticated can read approved, only submitter/admin can update
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read approved bounties" ON bounties FOR SELECT USING (status != 'pending' OR submitted_by = auth.uid());
CREATE POLICY "Submit bounties" ON bounties FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Notifications: only own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());

-- TC transactions: only own
ALTER TABLE tc_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own transactions" ON tc_transactions FOR SELECT USING (user_id = auth.uid());

-- Kanban: team members only (enforced via application layer for complex team checks)
-- Admin override: T1/T2 bypass via service role key on server
```

---

## 25. Term Lifecycle & Data Management

### Term Structure
- TSI operates on university terms: Fall (F), Winter (W), Summer (S)
- Term format: `W2026`, `F2026`, `S2027`

### What Resets Each Term
- **Teams** — New teams formed each term. Old teams archived (not deleted).
- **Kanban boards** — New boards for new teams. Old boards become read-only.
- **Leaderboard** — Resets to zero. Previous term's results archived.
- **Quests** — Seasonal quests expire. Daily/weekly continue if re-activated.

### What Persists
- **User accounts** — Never deleted, even after graduation (become alumni)
- **XP & Level** — Cumulative across terms (never resets)
- **Tethos Coins** — Balance carries over
- **Achievements** — Permanent
- **Bounty history** — Archived, not deleted
- **Portfolio** — Permanent
- **Profile** — Persistent (position/team may change)

### Term Transition Process (Admin)
1. T1 generates new invite code for new term
2. T1/T2 create new teams
3. T1/T2 assign returning members to new teams
4. Old teams marked as archived
5. Leaderboard snapshot saved, board reset
6. Graduating members marked as alumni

---

## 26. Visual Design & Theming

### Base Theme (Dark — Default)
Inherits from the main Tethos design system:
- Background: `--color-bg-main` (#0F0F10)
- Text: `--color-text-primary` (#F1FFFF)
- Accent: `--color-brand-blue` (#002FA7) — glows, active states
- Secondary accent: `--color-brand-yellow` (#FFD166) — highlights, rewards
- Tertiary: `--color-accent-cyan` (#22D3EE) — hover states, links
- Glass: `--glass-bg`, `--glass-border` — cards, panels

### Dashboard Evolution
The dashboard should be an "evolved version" of the main site aesthetic:
- Same color tokens
- More dense layout (sidebar + content vs full-page sections)
- Terminal influences: monospace labels, blinking cursors, ASCII borders on some elements
- RPG influences: XP bars, level badges, skull ratings, achievement badges
- Glass morphism on sidebar and cards
- Blue glow on active/focused elements

### Typography in Dashboard
- **Headings:** Test Söhne (same as main site)
- **Body/content:** Space Grotesk
- **Labels, stats, code, terminal elements:** IBM Plex Mono
- **XP/level numbers:** IBM Plex Mono, slightly larger, bold

### Unlockable Themes (Marketplace)
Themes override CSS custom properties. Examples:

| Theme | Vibe | Price |
|-------|------|-------|
| `dark` | Default Tethos dark | Free |
| `cyberpunk` | Neon pink/purple, scanlines | 500 TC |
| `forest` | Dark green, organic shapes | 500 TC |
| `retro` | Amber monochrome, CRT effect | 750 TC |
| `light` | Clean white, blue accents | 300 TC |
| `ocean` | Deep blue, wave patterns | 500 TC |
| `sunset` | Warm gradient, orange accents | 500 TC |

### Tethos Coin Symbol
Custom symbol: `₮` (or custom SVG). Design direction:
- Stylized "T" with circuit/node motif
- Should work at small sizes (16px)
- Monochrome (adapts to theme)
- Used throughout: marketplace, widgets, transactions, quest rewards

---

## 27. Implementation Priority

Build in this order. Commit after each completed feature.

| # | Feature | Depends On | Estimated Complexity |
|---|---------|-----------|---------------------|
| 1 | Supabase setup + auth (signup/login/invite codes) | Nothing | Medium |
| 2 | Dashboard shell (sidebar, topbar, layout) | Auth | Medium |
| 3 | Announcements (banners + feed) | Dashboard shell | Low |
| 4 | Member directory + profiles | Auth + DB | Medium |
| 5 | Onboarding flow | Auth + profiles | High |
| 6 | Quest system + XP/leveling | Profiles + DB | High |
| 7 | Tethos Coin economy | Profiles + DB | Medium |
| 8 | Marketplace | TC economy | Medium |
| 9 | Bounty Board | Auth + calendar | High |
| 10 | Calendar + Google export | Auth + events DB | Medium |
| 11 | Kanban boards | Teams + calendar | High |
| 12 | Job Board | Auth | Low |
| 13 | Tools section (ASCII embed + RAG placeholder) | Dashboard shell | Low |
| 14 | Leaderboard | XP system + teams | Low |
| 15 | Portfolio builder | Profiles | Medium |
| 16 | Mentorship | Profiles | Low |
| 17 | Admin panel + analytics | All features | High |
| 18 | Easter eggs + unlockable themes | Marketplace | Medium |
| 19 | Time Capsule | Easter eggs | Low |

---

## Appendix A: Q&A Decision Log

All decisions confirmed during the specification Q&A session:

| # | Question | Decision |
|---|----------|----------|
| 1 | Email restriction? | Any email (not restricted to @uwo.ca) |
| 2 | Who can promote/demote? | T1 and T2 only |
| 3 | Login methods? | Email/password only |
| 4 | Supabase project? | Create new |
| 5 | Sidebar vibe? | Hybrid terminal + game |
| 6 | Coin pricing? | Admin-set prices |
| 7 | Onboarding tasks? | In-app interactive |
| 8 | Member count? | 50–150 per term |
| 9 | Who posts bounties? | Anyone posts, admin approves |
| 10 | Bounty payment? | Both CAD and TC options |
| 11 | Team structure? | Both project and ops teams, term-based. $1 ≈ 100 TC |
| 12 | Calendar sync? | TSI events only, export to Google Calendar as feed |
| 13 | Marketplace fulfillment? | In-person pickup |
| 14 | Job Board moderation? | Light approval |
| 15 | Easter eggs? | All of the above (konami, secrets, hidden pages) |
| 16 | RAG chatbot? | Placeholder UI, ChatGPT-style in dashboard theme |
| 17 | Directory fields? | Full list from Google Sheet (name through fun fact) |
| 18 | Announcement urgency? | Rich announcements (info/warning/critical) |
| 19 | Profile customization? | Gamified profiles with themes |
| 20 | Tool embedding? | Embed existing tools |
| 21 | Login page? | Full page (not modal) |
| 22 | Dashboard URL? | Subdomain |
| 23 | Notifications? | In-app only |
| 24 | Onboarding theme? | Hacker initiation |
| 25 | Onboarding structure? | Progressive unlock |
| 26 | Rank system? | Class-based ranks |
| 27 | Sidebar items? | Core + social + admin |
| 28 | Class assignment? | Based on position, can't change. Subclass is chosen. |
| 29 | Bounty Board UI? | RPG bounty board, skull ratings |
| 30 | Kanban? | Custom built |
| 31 | Marketplace stock? | Simple inventory |
| 32 | TSI structure? | Ops (3 portfolios) + Projects (7 NPO teams) |
| 33 | Leaderboard? | Team-based, combined XP |
| 34 | Admin panel? | Full CMS + analytics |
| 35 | Achievements? | Collaborative focus |
| 36 | Calendar events? | Multiple types, anyone proposes, T1/T2 approve |
| 37 | Tools at launch? | ASCII converter + RAG chatbot |
| 38 | In-app chat? | No chat needed |
| 39 | Same codebase? | Yes, middleware routing for subdomain |
| 40 | Data migration? | Manual by admin |
| 41 | Signup approval? | Hybrid (invite code or admin approval) |
| 42 | Onboarding skip? | Required but pausable |
| 43 | Mobile? | Desktop-primary |
| 44 | Tethos Coin symbol? | Design one (custom) |
| 45 | Bounty difficulty? | Skull rating (1–5) |
| 46 | Dashboard home? | Customizable widgets |
| 47 | Dark/light mode? | Unlockable themes via marketplace |
| 48 | Widget customization? | Fixed widget set, customizable layout |
| 49 | Term reset? | Partial reset (teams/boards/leaderboard reset; XP/coins/achievements persist) |
| 50 | Event creation? | Anyone proposes + approval |
| 51 | Job Board features? | Categorized + tagged with discussion threads |
| 52 | Ops dashboard access? | Everyone uses it |
| 53 | Invite code system? | Simple general code, everyone gets same code |
| 54 | Kanban columns? | Standard + custom |
| 55 | Quest system? | Full quest system, admin-created |
| 56 | Tier mapping? | T2: SA/PMO/PM/VP. T3: Dev/Director. T4: General/Volunteer (limited access) |
| 57 | Announcement feed? | Feed + banners |
| 58 | Leaderboard scoring? | Combined team XP |
| 59 | Dashboard aesthetic? | Evolved version of main site |
| 60 | Mentorship? | Self-service browse |
| 61 | Portfolio? | Public shareable |
| 62 | T4 volunteer opps? | Events-based |
| 63 | Marketplace gamification? | Add later (mystery boxes, etc.) |
| 64 | Time capsule? | Optional easter egg |
| 65 | GitHub integration? | Decide later |

---

## Appendix B: Tethos Coin Symbol Design

The Tethos Coin symbol should be:
- A stylized uppercase **T** integrated with circuit board / node patterns
- Works as both SVG icon (sidebar, widgets) and inline text symbol
- Monochrome (inherits text color for theme compatibility)
- Recognizable at 16px
- Fallback: Unicode `₮` (Mongolian Tugrik symbol) as text stand-in

---

*This document is the single source of truth for the Student System. All implementation decisions should reference this spec. Update this document when decisions change.*
