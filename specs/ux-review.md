# UXUI Design Review — Backend's Dashboard Implementation

> **Reviewer:** UXUI Agent · **Date:** 2026-03-30
> **Reviewed branch:** `davidliu/backend`
> **Compared against:** `specs/ux-dashboard.md`, `specs/ux-directory.md`, `specs/tokens.md`

---

## Summary

Backend built a functional dashboard with auth, sidebar, topbar, 24 page routes, and real Supabase queries. Solid engineering work. However, there are **significant deviations from the UXUI specs** that Frontend should address when integrating.

**Severity levels:** 🔴 Major (spec violation) · 🟡 Minor (style drift) · 🟢 Fine (acceptable deviation)

---

## 1. Sidebar — DashboardSidebar.tsx

### 🔴 Width: `w-56` (224px) instead of spec'd `240px`
- **Spec:** `--sidebar-width: 240px` (ux-dashboard.md Section 2.1)
- **Built:** `w-56` = 224px
- **Fix:** Change to `w-[240px]`

### 🔴 Background: `--color-bg-alt` (#111113) instead of `--color-surface` (#111827)
- **Spec:** `--sidebar-bg: var(--color-surface)` (#111827) — darker, more contrast
- **Built:** `bg-[var(--color-bg-alt)]` (#111113)
- **Fix:** Change to `bg-[var(--color-surface)]`

### 🔴 Active indicator: blue background glow instead of 2px left accent bar
- **Spec:** Active item has `border-left: 2px solid var(--color-brand-blue)`, subtle bg `rgba(255,255,255,0.06)` (ux-dashboard.md Section 2.4)
- **Built:** `bg-[var(--color-brand-blue)]/10` + `shadow-[0_0_8px]` glow effect — no left accent bar
- **Fix:** Replace active style with `border-l-2 border-[var(--color-brand-blue)] bg-white/[0.06]`

### 🔴 Section grouping exists — spec says NO grouping
- **Spec:** "Flat list, no section dividers, no grouping" (ux-dashboard.md Section 2.3)
- **Built:** Has "Personal" and "Admin" section labels with dividers
- **Fix:** Remove section labels and dividers. Flat list only.

### 🔴 Font: `font-mono` on all nav items — spec says Test Söhne
- **Spec:** Nav item text uses Test Söhne (default font), `var(--font-size-body-sm)` (14px), weight 400
- **Built:** `font-mono` everywhere (IBM Plex Mono) — gives a terminal aesthetic, but spec called for the cleaner default font
- **Fix:** Remove `font-mono` from nav item text. Keep monospace only for version number and section labels if kept.

### 🟡 Collapse: chevron toggle instead of hamburger at 768px
- **Spec:** Full sidebar above 768px, hamburger slide-over below 768px (ux-dashboard.md Section 3)
- **Built:** Manual collapse toggle (chevron button) — collapses to `w-16` icon-only mode at any width
- **Note:** The chevron toggle is actually nice UX. Frontend could keep it AND add the 768px hamburger behavior. Not a hard deviation — more of an enhancement.

### 🟡 Missing: Player status card at top
- **Spec:** Top section shows avatar (32px) + player name + level (ux-dashboard.md Section 2.2)
- **Built:** Shows "TETHOS" logo instead
- **Fix:** Add mini player status below logo. Backend already has `profile` in layout — pass it to sidebar.

### 🟡 Extra nav items not in spec
- **Spec:** 8 items: Home, Directory, Bounty Board, Shop, Job Board, Leaderboard, Profile, Settings
- **Built:** 13+ items: adds Calendar, Kanban, Marketplace, Tools, Quests, Portfolio, Mentorship
- **Note:** Many are Phase 2+ features. Consider marking extras with "Soon" badge per spec, or keep as is if David wants them live.

### 🟢 Feature gating via `canAccessFeature(tier)` — great addition not in spec

---

## 2. Dashboard Layout — layout.tsx

### 🔴 Added Topbar — not in spec
- **Spec:** Sidebar (left) + Main content (right). No topbar. (ux-dashboard.md Section 1)
- **Built:** Has `DashboardTopbar` with notifications bell, search, profile dropdown
- **Note:** The topbar is functional and useful, but wasn't spec'd. David should decide: keep or remove. If kept, it eats vertical space from the game world canvas.

### 🟡 Main content margin: `ml-56` (224px) — should match sidebar width
- Should be `ml-[240px]` to match corrected sidebar width

### 🟢 Auth guard and onboarding redirect — matches spec perfectly

---

## 3. Directory — directory/page.tsx

### 🔴 Grid cards instead of list view
- **Spec:** "List view with horizontal rows, 64px row height" (ux-directory.md Section 4)
- **Built:** 4-column card grid (`grid-cols-4`) with 10×10 avatar, name, position, class/level
- **Fix:** Rebuild as list view per spec. Each row: avatar (40px) + name/class stacked + tier badge + level + XP bar + chevron.

### 🔴 No tier badge colors
- **Spec:** Color-coded tier badges: T1=gold, T2=blue, T3=cyan, T4=green, T5=gray (ux-directory.md Section 5)
- **Built:** No tier badges at all. Shows `position` and `rank` instead.
- **Fix:** Add tier badge pill with spec colors. Backend has `tier` field on profiles.

### 🔴 No XP bar on members
- **Spec:** Inline 80px × 6px XP bar per row (ux-directory.md Section 4.4)
- **Built:** Shows level number but no XP progress bar
- **Fix:** Add XP bar. Requires `xp` and XP-to-next-level data from API.

### 🟡 Filter: current/alumni/all instead of tier/role/year/status
- **Spec:** Filter by Tier, Role/Class, Year, Active status (ux-directory.md Section 3.4)
- **Built:** Only current/alumni/all toggle
- **Fix:** Expand filter options per spec

### 🟡 Profile modal instead of profile page route
- **Spec:** Click member → navigate to `/student/dashboard/directory/{id}` (ux-directory.md Section 7)
- **Built:** Opens inline modal overlay
- **Note:** Modal is faster UX. Could be acceptable if David prefers it. Consider keeping modal for quick view, link to full profile for detailed view.

### 🟢 Search works — matches spec intent
### 🟢 Real Supabase queries — great, no mocks needed

---

## 4. Home Page — page.tsx

### 🟡 Widget dashboard instead of game world
- **Spec:** Home page renders the R3F game world canvas, full bleed (ux-dashboard.md Section 4.2, ux-game-world.md)
- **Built:** Widget grid dashboard (XP, Coins, Quests, Calendar, Team, Announcements)
- **Note:** This is expected — game world is Frontend's job. But the widgets are useful. Consider: game world on home page (spec), widgets on a separate `/student/dashboard/overview` page or integrated into the sidebar/topbar.

---

## 5. Token Usage

### 🟡 Inconsistent CSS variable names
- Backend uses `--glass-border` while tokens.css defines `--glass-border-soft` and `--glass-border-strong`
- Backend uses `--color-text-primary` and `--color-text-secondary` — tokens.css uses `--color-text-main` and `--color-text-soft`
- **Fix:** Align to tokens.css variable names throughout

---

## 6. Pages Beyond Spec (Backend built extras)

Backend created pages not yet spec'd by UXUI:

| Page | Status | Notes |
|------|--------|-------|
| `/dashboard/calendar` | Not spec'd | Calendar widget + page — useful for events |
| `/dashboard/kanban` | Explicitly excluded from MVP (CLAUDE.md) | Remove or hide behind feature flag |
| `/dashboard/marketplace` | Backend calls it "marketplace", spec calls it "shop" | Rename to "shop" for consistency |
| `/dashboard/tools` | Not spec'd | ASCII art + RAG tools — could be Phase 3 |
| `/dashboard/tools/ascii` | Not spec'd | Fun but out of scope for MVP |
| `/dashboard/tools/rag` | Not spec'd | AI tool — could be Phase 3 |
| `/dashboard/quests` | Partially spec'd | Spec has quest widget in onboarding, not a full quests page |
| `/dashboard/portfolio` | Not spec'd | Member portfolio page — Phase 3 |
| `/dashboard/mentorship` | Not spec'd | Mentorship matching — Phase 3 |
| `/dashboard/admin/*` (7 pages) | Not spec'd | Admin panel — useful, needs review |

**Recommendation:** Keep pages but mark unspec'd ones as "Coming Soon" or gate behind feature flags. Don't remove working code.

---

## Priority Fix List for Frontend

1. **Sidebar width** → `240px` _(easy)_
2. **Sidebar bg** → `var(--color-surface)` _(easy)_
3. **Active indicator** → 2px left accent bar, remove glow _(medium)_
4. **Remove section grouping** from sidebar _(easy)_
5. **Remove `font-mono`** from nav items _(easy)_
6. **Directory** → rebuild as list view with tier badges + XP bars _(major)_
7. **Add hamburger** collapse at 768px _(medium)_
8. **Align CSS variable names** to tokens.css _(grep + replace)_
9. **Add player status** card to sidebar top _(medium)_
10. **Home page** → embed game world canvas _(Frontend's main task)_
