# AGENT_LOG.md — Team Communication Board

> Every agent reads this at session start. Append to your section only.

---

## Active Tasks — Phase 1: Student Portal Foundation

> Management updates this section. Agents check off items when done.

### UXUI
- [ ] Read `web/DESIGN_SYSTEM.md` and `web/styles/tokens.css` thoroughly
- [ ] **Ask David 8 design questions** (multi-choice format — see Management section below for the exact questions)
- [ ] Write `specs/ux.md` — full dashboard layout spec, sidebar spec, game world map spec, building interaction spec
- [ ] Write `specs/tokens.md` — game world color tokens, avatar size tokens, sidebar dimensions
- [ ] Write `specs/ux-directory.md` — directory page wireframe, profile card spec, search/filter spec
- [ ] Write `specs/ux-game-world.md` — isometric world layout, building placement, avatar movement, multiplayer indicators
- [ ] Update AGENT_LOG.md with completed specs

### Frontend
- [ ] Run `cd web && npm run build` + `npm run lint` — fix all errors
- [ ] Create dashboard layout: `web/app/student/dashboard/layout.tsx` (sidebar + main content)
- [ ] Create `web/components/portal/Sidebar.tsx` — left sidebar navigation
- [ ] Create 8 dashboard page stubs (home, directory, bounty, projects, shop, jobs, leaderboard, profile)
- [ ] Create `web/components/game/IsometricWorld.tsx` — canvas placeholder for PixiJS
- [ ] Create directory components: `MemberDirectory.tsx`, `MemberCard.tsx`, `ProfileView.tsx` in `web/components/portal/`
- [ ] Update AGENT_LOG.md with progress

### Backend
- [ ] Migration `004_extend_tiers.sql` — extend tier CHECK to 1-5, add avatar_url, social_links, skills fields
- [ ] Migration `005_bounty_system.sql` — bounties + bounty_submissions tables with RLS
- [ ] Migration `006_economy.sql` — coin_balance on profiles, coin_transactions table with RLS
- [ ] Migration `007_game_state.sql` — player_positions, avatar_items, player_inventory tables
- [ ] Update `web/lib/supabase/types.ts` with all new table types
- [ ] Create API routes: `/api/directory`, `/api/profile`, `/api/bounties` (stub)
- [ ] Update middleware: remove election redirects, add dashboard protection, 5-tier permissions
- [ ] Document everything in `specs/api.md`
- [ ] Update AGENT_LOG.md with schema + API docs

### QA
- [ ] Run `cd web && npm run build` + `npm run lint` — log ALL errors to `specs/qa.md`
- [ ] Test existing auth flow (signup → login → redirect)
- [ ] Test all 5 marketing pages still load
- [ ] Document test plan for new dashboard features in `specs/qa.md`
- [ ] Update AGENT_LOG.md with findings

---

## File Ownership (STRICT — do not touch other agent's files)

| Directory/File | Owner | Others |
|---------------|-------|--------|
| `specs/ux*.md`, `specs/tokens.md` | UXUI | read only |
| `specs/api.md` | Backend | read only |
| `specs/qa.md` | QA | read only |
| `web/components/portal/` | Frontend | — |
| `web/components/game/` | Frontend | — |
| `web/app/student/dashboard/` | Frontend | — |
| `web/app/api/` (new routes) | Backend | — |
| `web/lib/supabase/` | Backend | Frontend reads types |
| `web/supabase/migrations/` | Backend | — |
| `CLAUDE.md`, `AGENT_LOG.md` | Management | all append to AGENT_LOG |

## Merge Order
1. **Backend first** (DB schema + types must exist before frontend uses them)
2. **Frontend second** (uses backend types/API)
3. **UXUI specs** merge anytime (reference docs)
4. **QA last** (after testing frontend + backend together)

---

## Blocked / Needs Attention

| Agent | Blocked On | Waiting For | Date |
|-------|-----------|-------------|------|
| Frontend | Game world visuals | UXUI game world spec | 2026-03-28 |
| Frontend | Directory card design | UXUI directory spec | 2026-03-28 |
| Frontend | Supabase types for directory | Backend types.ts update | 2026-03-28 |

---

## Management

### 2026-03-27 — Sprint Kickoff
Created shared communication system (CLAUDE.md, AGENT_LOG.md, specs/).

### 2026-03-27 — Full Project Audit
Project is ~75% production ready for marketing pages. See CLAUDE.md for details.

### 2026-03-28 — Student Portal Sprint Launched

**Product vision confirmed with David (T1):**

The student dashboard is a **2.5D isometric MMO game world** (Animal Crossing / Habbo Hotel style):
- Main area = isometric game world with avatar, buildings, other players
- Left sidebar = navigation to tools (directory, bounty board, projects, shop, jobs, leaderboard, profile)
- Dashboard landing = overview hub with game world

**Key features (full scope):**
1. **MMO Game World** — 2.5D isometric, PixiJS rendering, walk around, visit buildings, see other players
2. **Member Directory** — chapter-scoped (admins see all), search/filter, full profiles
3. **Bounty Board** — real commission work from external clients, admin-posted, "Bounty Hunter" title required to claim
4. **Kanban Board** — per-project, shared with team, task assignment
5. **Online Shop** — TSI coin currency, avatar cosmetics + club merch
6. **Job Board** — curated listings + member submissions
7. **Leaderboard** — XP, badges, levels/ranks
8. **Profile/Settings** — edit name, bio, skills, avatar, social links

**MVP (day one): Game world + Directory/Profiles**
**Phase 2+: Bounty board, kanban, shop, jobs, leaderboard**

**Tier system (5 tiers):**
- T1: David only (super admin)
- T2: Chapter presidents
- T3: PMs & VPs
- T4: Directors & developers
- T5: Volunteers & general members
*(Note: DB schema currently has CHECK 1-4, needs migration to 1-5)*

**TSI Coin Economy:**
- Internal currency, earned from events/tasks/work, spent on merch + avatar items
- Economy details are internal — don't expose conversion rates

**Technical decisions:**
- 2.5D isometric (PixiJS/Canvas2D for game, React for UI overlays)
- Supabase Auth + DB + Realtime (already set up)
- Desktop first, mobile later
- Aesthetic: mix of terminal (admin/settings) + game UI (player-facing)
- Election system: archive, one-time event
- Chapters: deferred for MVP
- Onboarding: mandatory profile setup before dashboard access

---

### UXUI Agent: Questions to Ask David

**You MUST ask David these 8 questions in multi-choice format before writing any specs. Use AskUserQuestion tool with options so David can scroll and select.**

**Q1 — Dashboard sidebar style:**
- A) Minimal icon-only sidebar (expandable on hover)
- B) Full sidebar with icons + labels always visible
- C) Game-themed sidebar (looks like an RPG inventory/menu)
- D) Collapsible — full on desktop, icons on smaller screens

**Q2 — Game world map layout:**
- A) Small village/campus — compact, all buildings visible on screen
- B) Larger world — need to scroll/pan to see everything
- C) Island — surrounded by water, Animal Crossing style
- D) Floating platforms — futuristic tech aesthetic

**Q3 — Avatar style:**
- A) Pixel art characters (16-32px, retro game style)
- B) Chibi/cute style (like MapleStory or Habbo)
- C) Minimalist geometric (circles/shapes with accessories)
- D) Terminal/ASCII characters (fits existing aesthetic)

**Q4 — Game world color palette:**
- A) Same dark theme — isometric world is dark/cyberpunk
- B) Lighter/colorful — game world is vibrant, contrasts with dark UI
- C) Seasonal — changes with real-world seasons
- D) Day/night cycle — shifts between light and dark

**Q5 — Sidebar nav items (confirm order):**
Home, Directory, Bounty Board, Projects, Shop, Job Board, Leaderboard, Profile/Settings

**Q6 — Profile card: what info shows, what's most prominent?**
Name, avatar, role/tier, skills, XP level, bio preview

**Q7 — Building interaction in game world:**
- A) Click/Enter — opens tool as modal/overlay
- B) Walk inside — transitions to interior scene
- C) Sidebar auto-switches — proximity highlights sidebar item
- D) Portal/door animation — zooms into building, loads tool page

**Q8 — Transitions between game world and tool views:**
- A) Instant switch (sidebar click swaps main content)
- B) ASCII dissolve animation (like existing loading screen)
- C) Game-style transition (fade to black, screen wipe)
- D) Slide animation (tool slides in from sidebar)

---

## UXUI

> UXUI agent writes here. Others: read only.

*(awaiting first entry — start by asking David the 8 questions above)*

---

## Frontend

> Frontend agent writes here. Others: read only.

*(awaiting first entry)*

---

## Backend

> Backend agent writes here. Others: read only.

*(awaiting first entry)*

---

## QA

> QA agent writes here. Others: read only.

*(awaiting first entry)*

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
