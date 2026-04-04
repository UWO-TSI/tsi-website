# UXUI Design Review v3 — API-Wired Portal Components

> **Reviewer:** UXUI Agent · **Date:** 2026-04-04
> **Reviewed:** `davidliu/frontend` commit `2009cf2` (Wire Backend APIs into portal components)
> **Compared against:** `specs/ux-directory.md`, `specs/ux-dashboard.md`
> **Scope:** MemberDirectory, MemberCard, ProfileView, Sidebar, OverlayPanel, TransitionOverlay, DashboardLayout

---

## Summary

**Frontend cleanly migrated from mock data to real Backend APIs.** The refactored portal components are leaner, properly typed against `@/lib/supabase/types`, and retain strong spec fidelity. No regressions from the API wiring — all visual properties that were correct before are still correct. A few spec gaps (some inherited from pre-wiring, some new) are documented below.

**Severity:** 🟢 Matches spec · 🟡 Minor deviation · 🔴 Major deviation

---

## 1. MemberDirectory.tsx

### 🟢 Page container — exact match
- Max-width `960px`, padding `24px`, centered — matches Section 2.1.

### 🟢 Search input — exact match
- Height `40px`, `var(--color-surface)` bg, `var(--glass-border-soft)` border, `8px` radius.
- Lucide `Search` icon (16px) positioned absolute at `left: 12px`.
- Placeholder: "Search by name, class, or skill..." — exact match.
- Focus: `border-color: var(--color-brand-blue)`, `box-shadow: 0 0 0 2px rgba(0,47,167,0.2)` — exact match.
- Debounce: `300ms` — exact match.

### 🟢 Filter toggle button — matches
- Ghost style, transparent bg, `1px solid var(--gray-700)`, `40px` height.
- `SlidersHorizontal` icon + "Filters" text.
- Active state switches border to `var(--color-brand-blue)`.

### 🟢 Tier filter pills — exact match
- All 5 tiers as multi-select pills, `28px` height, `12px` font, pill radius.
- Selected state: tier-colored bg + border. Unselected: transparent + gray-700 border.

### 🟢 Status filter — matches
- Active / All toggle pills, brand-blue selected state.

### 🟡 Missing filters: Role/Class and Year
- **Spec Section 3.4:** Four filters — Tier (✅), Role/Class (❌), Year (❌), Status (✅)
- **Built:** Only Tier and Status.
- **Impact:** Low — Backend API supports `?role=` and `?year=` params but Frontend doesn't expose them yet.
- **Fix:** Add Role/Class dropdown (values from DB) and Year dropdown (1st–5th+) below the tier pills.

### 🟡 Loading state: spinner instead of skeleton rows
- **Spec Section 6.1:** 8 skeleton rows with shimmer pulse animation (opacity 0.5↔1.0, 1.5s ease).
- **Built:** Single centered `Loader2` spinner.
- **Impact:** Skeleton loading is more polished and prevents layout shift when data arrives.
- **Fix:** Replace spinner with 8 skeleton rows: 40px circle + 60%/40% width bars, `var(--gray-800)` bg, shimmer animation.

### 🟢 Empty state — exact match
- `SearchX` icon (32px), "No members found" (16px, weight 500), "Try adjusting your filters" (14px), padding 48px.

### 🟢 Error state — good addition
- Not in spec but handles network/API failures with retry button. Keep it.

### 🟢 Results count — matches
- "Showing N members", 14px, `var(--color-text-muted)`.

### 🟢 API integration — clean
- `fetch('/api/directory')` with search + status params. Error handling. Debounced. Tier filtering done client-side (correct — avoids extra API call).

---

## 2. MemberCard.tsx

### 🟢 Row structure — near-perfect match
- Height `64px`, flex, align-items center, padding `0 16px`, gap `12px`.
- Border-bottom `1px solid rgba(255, 255, 255, 0.06)`, radius `8px`, cursor pointer.
- Hover bg `rgba(255, 255, 255, 0.04)`.

### 🟡 Hover border-bottom-color missing
- **Spec Section 4.3:** Hover should also change `border-bottom-color` to `rgba(0, 47, 167, 0.2)`.
- **Built:** Only background changes on hover.
- **Fix:** Add `e.currentTarget.style.borderBottomColor = "rgba(0, 47, 167, 0.2)"` in `onMouseEnter`, reset in `onMouseLeave`.

### 🟢 Avatar — exact match
- 40px, round, `2px solid` tier-coded border, initials fallback on `var(--color-surface)`.

### 🟢 Name + Class — matches
- Name: 14px, weight 600, `var(--color-text-main)`.
- Class: 12px, `var(--color-text-muted)`. Falls back to position or "Unclassed".
- Inactive members get `var(--color-text-subtle)` — good addition.

### 🟢 Tier badge — exact match
- All 5 tier colors match spec Section 5 exactly (gold/blue/cyan/green/gray).
- Pill shape, 22px height, 8px padding, 12px font, font-mono, weight 600.

### 🟢 Level — matches
- "Lv.{n}", 14px, font-mono, weight 500, 48px fixed width, `var(--color-text-soft)`.

### 🟢 XP bar — exact match
- 80px width, 6px height, 3px radius, `var(--gray-800)` track, `var(--color-brand-blue)` fill, 0.3s transition.

### 🟢 Arrow — matches
- ChevronRight 16px, `var(--color-text-subtle)`.

### 🟢 Accessibility — matches
- `role="option"`, `tabIndex={0}`, Enter key navigation, focus outline with `var(--color-brand-blue)`.

### 🟢 XP progressbar ARIA — matches
- `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

---

## 3. ProfileView.tsx

### 🟢 Container — matches
- Max-width `960px`, padding `24px`.

### 🟢 Back link — matches
- `ArrowLeft` + "Back to Directory", 14px, `var(--color-text-muted)`, hover → `var(--color-text-main)`, 24px margin-bottom.

### 🟢 Profile header — matches
- Avatar: 96px, round, 4px tier-colored border, initials fallback.
- Name: 30px, weight 700, `var(--color-text-main)`.
- Subtitle: 16px, `var(--color-text-muted)`, shows class + tier + tier label + rank.
- Bio: 16px, `var(--color-text-soft)`, max-width 600px.

### 🟢 Stats row — matches
- Flex, gap 24px, border-top separator.
- Labels: 12px, font-mono, uppercase, letter-spacing 0.05em, `var(--color-text-subtle)`.
- Values: 24px, weight 700, `var(--color-text-main)`.
- Coins: `#ffd166` gold, own profile only.

### 🟢 XP bar — matches
- Full width, 8px height, brand-blue fill, gray-800 track.
- Text: right-aligned, 12px, "X / Y XP to Level N+1".

### 🟢 Skill tags — exact match
- 28px height, 12px padding, `rgba(0, 47, 167, 0.1)` bg, `rgba(0, 47, 167, 0.2)` border, 14px text, pill radius.

### 🟢 Social links — matches
- Flex gap-3, 20px icons, capitalize text, `var(--color-text-muted)`, hover → `var(--color-accent-cyan)`.
- Icons: Github, Linkedin, Globe, Twitter — correct mapping.

### 🟡 Social links not editable in edit mode
- **Spec Section 7.5:** Editable fields include "social links."
- **Built:** Edit mode covers display_name, bio, skills — but social links are read-only.
- **Impact:** Users can't update their GitHub/LinkedIn/portfolio from the profile page.
- **Fix:** Add social link inputs in edit mode (key-value pairs or individual fields per platform).

### 🟡 Section spacing slightly tighter than spec
- **Spec Section 7.4:** `var(--space-6)` (24px) between sections.
- **Built:** `py-4` (16px top + 16px bottom = 32px total, but visually 16px gap after border).
- **Impact:** Minor — the visual rhythm is slightly more compact. Acceptable.

### 🟢 Edit mode UI — matches
- Edit button: primary style (brand-blue bg), top-right of header.
- Save/Cancel buttons: Save primary, Cancel ghost with gray-700 border.
- Inline editing: name input, bio textarea, skills comma-separated input.

### 🟢 API integration — clean
- Fetches from `/api/profile` (own) or `/api/profile/[id]` (other).
- PATCH `/api/profile` for saves with JSON body.
- Loading/error states handled.

---

## 4. Sidebar.tsx

### 🟢 Dimensions & background — exact match
- 240px width, `var(--color-surface)` bg, `1px solid var(--glass-border-soft)` border-right.

### 🟢 Player status section — matches layout
- 32px avatar circle, name 14px weight 700, level 12px font-mono.
- Border-bottom separator, 16px margin-bottom.

### 🟡 Player status uses hardcoded placeholder data
- **Built:** Shows "Player" and "Lv. 1" for all users.
- **Spec:** Should show the actual player's display name and level.
- **Impact:** Medium — this is the most visible non-functional element in the sidebar.
- **Fix:** Fetch own profile (or accept props from layout) and display real `display_name` and `level`. This should have been wired when the portal went to real APIs.

### 🟢 Navigation items — exact match
- Flat list, no grouping. Correct order: Home, Directory, Bounty Board, Shop, Job Board, Leaderboard, Profile, Settings.
- 40px height, 12px padding, 8px radius, 4px gap.
- Icons: 18px Lucide, correct icons for each item.
- Text: 14px, weight 400.

### 🟢 Active indicator — exact match
- 2px left accent bar `var(--color-brand-blue)`, bg `rgba(255, 255, 255, 0.06)`.
- Active text: `var(--color-text-main)`. Inactive: `var(--color-text-muted)`.

### 🟢 Hover states — match
- Background `rgba(255, 255, 255, 0.04)`, color `var(--color-text-soft)`.

### 🟢 "Soon" badges — good addition
- Subtle pill on Phase 2 items. Not in spec but helpful UX.

---

## 5. DashboardLayout.tsx

### 🟢 Shell structure — matches
- Fixed full viewport, flex row, sidebar + main content.
- Main area: `flex-1`, `overflow-y: auto`.
- Background: `var(--color-bg-main)`.

### 🟢 Responsive — matches
- Desktop: sidebar visible (`hidden md:flex`). Tailwind `md` = 768px — matches spec.
- Mobile: hamburger button (40px, top-left), overlay backdrop, slide-in animation.

### 🟢 TransitionProvider — properly wraps
- All dashboard children wrapped in `TransitionProvider` for building entrance transitions.

---

## 6. OverlayPanel.tsx

### 🟢 Panel styling — exact match
- Background: `#0d1b2a` (bg-navy).
- Border: `1px solid rgba(0, 47, 167, 0.3)` (blue glow).
- Border-radius: `16px`.
- Max-width: `min(800px, 90vw)`.
- Max-height: `80vh`.

### 🟢 Interactions — all correct
- Escape to close, backdrop click to close.
- Scrollable content area.
- Entrance animation (scale 0.95→1.0, fade in).

### 🟢 Backdrop — correct
- `rgba(0, 0, 0, 0.6)` + `backdrop-filter: blur(4px)`.

---

## 7. TransitionOverlay.tsx

### 🟢 Timeline — exact match
- 0.3s fade in → execute callback → 0.2s hold → 0.3s fade out.
- Total ~0.8s — matches spec.

### 🟢 State machine — clean
- idle → fading-in → black → fading-out → idle.
- Prevents double-triggering (`if (state !== "idle") return`).
- Pointer events blocked during transition.

---

## 8. types.ts (Portal UI Constants)

### 🟢 Type re-exports — clean migration
- All type imports come from `@/lib/supabase/types` (Backend canonical source).
- UI-specific constants (TIER_COLORS, getXpProgress) remain local.

### 🟢 Tier colors — exact match to spec
- All 5 tiers with color, bg, border — all values match `ux-directory.md` Section 5.

### 🟢 XP progress helper — correct math
- Uses `xpForLevel()` from Backend types. Calculates current/needed/percent correctly, clamped 0-100.

---

## Overall Assessment

| Component | Score | Notes |
|-----------|-------|-------|
| MemberDirectory | 🟢 9/10 | Clean API integration, missing 2 filters + skeleton loading |
| MemberCard | 🟢 9/10 | Near-perfect row layout, tiny hover detail missing |
| ProfileView | 🟢 8/10 | Solid profile page, social link editing missing |
| Sidebar | 🟢 8/10 | Layout perfect, player status hardcoded |
| DashboardLayout | 🟢 10/10 | Shell + responsive + transitions — all correct |
| OverlayPanel | 🟢 10/10 | Exact spec match |
| TransitionOverlay | 🟢 10/10 | Exact spec match |
| types.ts | 🟢 10/10 | Clean Backend type migration |

**Overall: 9/10.** The API wiring was done cleanly with no visual regressions. Portal components properly use Backend types and fetch from real endpoints. The few gaps are polish items that were present before the migration.

---

## Priority Fix List (for Frontend)

### P1 — Should fix now
1. **Sidebar player status** — wire to real profile data (display_name + level). This is the most visible placeholder.
2. **Social links editing** — add input fields for social link URLs in profile edit mode (spec requires it).

### P2 — Fix when building Phase 2
3. **Role/Class + Year filters** — add dropdown selects to directory filter panel. Backend API already supports these params.
4. **Skeleton loading** — replace spinner with 8 shimmer rows (40px circle + text bars).

### P3 — Polish
5. **Hover border-bottom** on member rows — add `border-bottom-color: rgba(0, 47, 167, 0.2)` on hover.
6. **Section spacing** in profile — increase from `py-4` to `py-6` for 24px gap between sections.
