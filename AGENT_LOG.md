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
- [ ] **READ `specs/asset-stack.md` FIRST** — confirmed tech stack and shader pipeline
- [ ] Run `cd web && npm run build` + `npm run lint` — fix all errors
- [ ] Install: `@mesmotronic/three-retropass` (PS1 post-processing)
- [ ] Create dashboard layout: `web/app/student/dashboard/layout.tsx` (sidebar + main content)
- [ ] Create `web/components/portal/Sidebar.tsx` — RPG menu panel style sidebar
- [ ] Create 8 dashboard page stubs (home, directory, bounty, shop, jobs, leaderboard, profile, settings)
- [ ] Create `web/components/game/GameWorld.tsx` — R3F scene with:
  - PS1Material shader (bandinopla's approach — vertex snapping, affine textures, dithering)
  - Low-res FBO render (320x240) via `useFBO` from drei, upscaled with NearestFilter
  - `<CameraControls>` from drei locked at 45° polar angle, FOV 30-45°
  - Load Quaternius/Kenney GLB models via `useGLTF`
- [ ] Create `web/components/game/PlayerAvatar.tsx` — load modular character, skeleton sharing, animations via `useAnimations`
- [ ] Create directory components: `MemberDirectory.tsx`, `MemberCard.tsx` (RPG stat card), `ProfileView.tsx` in `web/components/portal/`
- [ ] Update AGENT_LOG.md with progress

### Backend
- [ ] **READ `specs/asset-stack.md` FIRST** — critical architecture changes
- [ ] Migration `004_extend_tiers.sql` — extend tier CHECK to 1-5, add avatar_url, social_links, skills fields
- [ ] Migration `005_bounty_system.sql` — bounties + bounty_submissions tables with RLS
- [ ] Migration `006_economy.sql` — coin_balance on profiles, coin_transactions table with RLS
- [ ] Migration `007_avatar_inventory.sql` — avatar_items, player_inventory tables (NO player_positions — that's Colyseus)
- [ ] Set up **Colyseus** server for real-time multiplayer (player positions, animation state, presence)
- [ ] Update `web/lib/supabase/types.ts` with all new table types
- [ ] Create API routes: `/api/directory`, `/api/profile`, `/api/bounties` (stub)
- [ ] Update middleware: remove election redirects, add dashboard protection, 5-tier permissions
- [ ] Document everything in `specs/api.md`
- [ ] Update AGENT_LOG.md with schema + API docs

**⚠️ ARCHITECTURE NOTE:** Supabase Realtime is TOO EXPENSIVE for position sync ($3,600/hr at 200 CCU). Use **Colyseus** (MIT, $0-15/mo) for all real-time game state. Supabase keeps: auth, profiles, inventory, persistent data. See `specs/asset-stack.md` for details.

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

### 2026-03-28/29 — Student Portal Deep Vision (confirmed with David)

**GAME WORLD:**
- 2.5D isometric, generic RPG style (themeable later)
- Map: 2-3 screens wide, small campus feel
- Camera: fixed follow (centers on player, classic RPG)
- Movement: WASD/Arrows + click-to-move pathfinding
- Characters: Low-poly 3D chibi models (~200-500 polys), PS1 aesthetic — NOT 2D pixel sprites
- Rendering: React Three Fiber + Three.js + Drei (ALREADY in the project) — NOT PixiJS
- PS1 shader pipeline: vertex snapping, affine texture mapping, low-res render target scaled up with nearest-neighbor filtering
- Art reference: PS1 indie games — low-poly but clean enough to look intentional, warm point lighting, textured environments
- Nameplate: Name + Level only (no class shown in-world)
- NPCs: Full population, ambient NPCs fill in when few players online
- Social: See other players, click for profile, emotes, proximity chat

**MAP LAYOUT:**
- **Buildings (interior scene loads):** HQ, Shop, Oracle Temple
- **Objects (overlay):** Bounty Board, Job Board
- **HQ interior:** Member directory, announcements, leaderboard, admin office (T1-T3), alumni network, events board
- **Shop interior:** Grid catalog — avatar outfits, effects, club merch, profile customization
- **Oracle Temple:** MBTI test → 4 main RPG classes, 16 subclasses (cosmetic only for now)

**SIDEBAR:** RPG menu panel style. Minimal player status at top (avatar + name + level). Items: Home, Directory, Bounty Board, Projects, Shop, Job Board, Leaderboard, Profile/Settings

**DIRECTORY:** Chapter-scoped (admins see all). RPG stat cards. Filters: role/tier, year, active/inactive. Full profile: avatar+bio+socials, XP/level/badges, project history. Lives in HQ + sidebar shortcut.

**BOUNTY BOARD:** Admin-posted (T1-T3). Bounty Hunter title required (apply + admin review). Solo or team. Lifecycle: Claim → Timer → Submit → Admin review → Approved/Rejected. Card: title, description, reward, deadline, difficulty+category tags.

**SHOP/ECONOMY:** TSI coins (internal currency, never expose rates). Earn from events/bounties/tasks/community. Spend on avatar items, merch, profile customization. T1 only: economy god mode.

**GAMIFICATION:** XP from events/bounties/projects/community. Levels 1-100 (numeric). Badges: milestone, rare/achievement, seasonal. RPG classes via MBTI at Oracle Temple.

**JOB BOARD:** Curated listings (admin) + member submissions. Card: company, title, link, tags, deadline, status.

**EVENTS:** T1-T3 create. RSVP system. Google Calendar sync. QR check-in (RFID later).

**ONBOARDING (mandatory):** Welcome → Profile setup → Avatar creator (body, skin, hair, face, outfit) → Tutorial → Onboarding quests (visit buildings, complete profile, view directory, interact with player, MBTI test at Oracle Temple)

**TIERS:** T1=David (everything + economy god mode), T2=chapter presidents (admin except economy), T3=PMs/VPs (bounty mgmt + submissions + events), T4=directors/devs, T5=volunteers

**ADMIN OFFICE (HQ, T1-T3):** Member mgmt, bounty mgmt, economy controls, analytics dashboard

**NOTIFICATIONS (deferred):** In-game popups, bell icon, email

**MVP:** Game world + Directory/Profiles
**Phase 2:** Bounty board, shop, Oracle Temple, job board, leaderboard, onboarding quests, admin tools, events, NPCs, social features, alumni
**Deferred:** Kanban, chapters, notifications, mobile

---

### UXUI Agent: Questions to Ask David

**The big-picture vision is DECIDED (above). Do NOT re-ask those questions. Your job is to ask David about VISUAL DETAILS, INTERACTION MICRO-DETAILS, and WIREFRAME SPECIFICS. Use AskUserQuestion with multi-choice format.**

**Ask David these design-detail questions:**

**Q1 — RPG sidebar panel: visual details**
- What width? Fixed 240px, 280px, 320px?
- Dividers between nav items? Grouped sections?
- Active item indicator style: glow, left bar, icon swap, color change?

**Q2 — Member RPG stat card: layout specifics**
- Card dimensions and grid layout (2-col, 3-col, list view?)
- What stat bars to show and in what order?
- Color coding for tier/role badges?

**Q3 — Game world tile/building art: reference images**
- Ask David for reference game screenshots or pixel art styles he likes
- What tile size? 32x32, 64x64, 128x128?
- Ground texture style — grass+dirt paths? cobblestone? paved?

**Q4 — Avatar creator UI: layout and flow**
- How many options per category (hair, skin, face, outfit)?
- Preview window style: full-body render, bust, rotating?
- Randomize button?

**Q5 — HQ interior layout: room arrangement**
- Single large room with stations? Or multiple rooms with hallways?
- How are the 6 sections (directory, announcements, leaderboard, admin, alumni, events) arranged spatially?

**Q6 — Building entry/exit animation specifics**
- Fade duration? Transition style for entering a building?
- How do overlays (bounty board, job board) appear? Slide up? Fade in? Scale from interaction point?

**Q7 — Overlay panels: visual style**
- Glassmorphic? Solid dark? RPG wooden frame? Terminal-styled?
- Size: full-screen modal, centered panel, side panel?

**Q8 — Responsive behavior: sidebar collapse**
- At what width does sidebar collapse?
- Collapsed state: icons only? Hidden with hamburger? Overlay?

---

## UXUI

> UXUI agent writes here. Others: read only.

*(awaiting first entry — start by asking David the design-detail questions above)*

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
