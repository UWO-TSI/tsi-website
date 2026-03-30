# UX Spec — Student Dashboard Layout

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-27
> **Implements from:** CLAUDE.md (Student Portal Vision), DESIGN_SYSTEM.md, tokens.css
> **Frontend reads this to build:** `web/app/student/dashboard/layout.tsx`, `web/components/portal/Sidebar.tsx`

---

## 1. Dashboard Shell — Overall Layout

```
+----------+-------------------------------------------+
|          |                                           |
| Sidebar  |              Main Content                 |
|  240px   |              (flex: 1)                     |
|  fixed   |                                           |
|          |                                           |
|          |                                           |
|          |                                           |
|          |                                           |
+----------+-------------------------------------------+

Full viewport height (100vh), no scroll on shell itself.
Main content area scrolls independently.
```

### Layout Rules

| Property | Value |
|----------|-------|
| Display | `flex` row |
| Sidebar width | `240px` fixed |
| Main area | `flex: 1`, `overflow-y: auto` |
| Shell height | `100vh` |
| Shell background | `var(--color-bg-main)` (#0f0f10) |

---

## 2. Sidebar — Narrow Minimal (240px)

### 2.1 Dimensions & Background

| Property | Value |
|----------|-------|
| Width | `240px` fixed |
| Height | `100vh` |
| Position | `fixed`, left 0, top 0 |
| Background | `var(--color-surface)` (#111827) |
| Border-right | `1px solid var(--glass-border-soft)` (rgba(241,255,255,0.12)) |
| Padding | `var(--space-4)` (16px) top, `var(--space-2)` (8px) horizontal |
| z-index | `40` |
| Overflow-y | `auto` (hidden scrollbar) |

### 2.2 Player Status — Top Section

Compact player status at the top of the sidebar.

```
+-------------------------------+
|  [32px Avatar]  Player Name   |
|                 Lv. 12        |
+-------------------------------+
```

| Element | Style |
|---------|-------|
| Container | `padding: var(--space-3)` (12px), `margin-bottom: var(--space-4)` (16px) |
| Container border-bottom | `1px solid var(--glass-border-soft)` |
| Avatar | `32px` round, `border-radius: 50%` |
| Player name | `var(--font-size-body-sm)` (14px), `var(--color-text-main)` (#f1ffff), weight 700 |
| Level text | `var(--font-size-label)` (12px), `var(--color-text-muted)` (#9ca3af), IBM Plex Mono |

### 2.3 Navigation Items

Flat list, no section dividers, no grouping.

```
  > Home            ← active (left accent bar)
    Directory
    Bounty Board
    Shop
    Job Board
    Leaderboard
    Profile
    Settings
```

**Nav items ordered:** Home, Directory, Bounty Board, Shop, Job Board, Leaderboard, Profile, Settings

| Element | Style |
|---------|-------|
| Item height | `40px` |
| Item padding | `0 var(--space-3)` (0 12px), with `var(--space-2)` (8px) left for accent bar space |
| Item gap | `var(--space-1)` (4px) between items |
| Item border-radius | `var(--radius-sm)` (8px) |
| Text | `var(--font-size-body-sm)` (14px), Test Söhne, weight 400 |
| Icon | `18px` Lucide icon, `var(--space-3)` (12px) gap to text |
| Cursor | `pointer` |

### 2.4 Nav Item States

| State | Text Color | Background | Left Accent | Icon Color |
|-------|-----------|------------|-------------|------------|
| Default | `var(--color-text-muted)` (#9ca3af) | `transparent` | none | `var(--color-text-muted)` |
| Hover | `var(--color-text-soft)` (#e5e7eb) | `rgba(255,255,255,0.04)` | none | `var(--color-text-soft)` |
| Active | `var(--color-text-main)` (#f1ffff) | `rgba(255,255,255,0.06)` | `2px solid var(--color-brand-blue)` (#002fa7) | `var(--color-text-main)` |
| Disabled | `var(--color-text-subtle)` (#6b7280) | `transparent` | none | `var(--color-text-subtle)` |

**Active indicator:** 2px left border in `var(--color-brand-blue)` (#002fa7), full height of the nav item. Applied via `border-left`.

**Hover transition:** `background 0.15s ease, color 0.15s ease`

### 2.5 Nav Icons (Lucide React)

| Item | Lucide Icon |
|------|-------------|
| Home | `Home` |
| Directory | `Users` |
| Bounty Board | `Scroll` |
| Shop | `ShoppingBag` |
| Job Board | `Briefcase` |
| Leaderboard | `Trophy` |
| Profile | `User` |
| Settings | `Settings` |

### 2.6 "Coming Soon" Badge

For Phase 2+ items (Bounty Board, Shop, Job Board, Leaderboard), show a small pill badge.

| Property | Value |
|----------|-------|
| Text | "Soon" |
| Font | `var(--font-size-label)` (12px), IBM Plex Mono |
| Color | `var(--color-text-subtle)` (#6b7280) |
| Background | `rgba(255,255,255,0.06)` |
| Border-radius | `var(--radius-pill)` |
| Padding | `1px 6px` |
| Position | right-aligned within nav item |

These items are still clickable and navigate to a "Coming Soon" placeholder page.

---

## 3. Responsive Behavior — Hamburger at 768px

### 3.1 Breakpoint: `md` (768px)

| Viewport | Sidebar Behavior |
|----------|-----------------|
| `≥ 768px` | Full 240px sidebar visible |
| `< 768px` | Sidebar hidden, hamburger menu button shown |

### 3.2 Hamburger Button

| Property | Value |
|----------|-------|
| Position | `fixed`, top `var(--space-3)` (12px), left `var(--space-3)` (12px) |
| Size | `40px × 40px` |
| Icon | Lucide `Menu` (24px) |
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid var(--glass-border-soft)` |
| Border-radius | `var(--radius-sm)` (8px) |
| z-index | `50` |
| Color | `var(--color-text-main)` (#f1ffff) |

### 3.3 Mobile Sidebar Overlay

When hamburger is tapped, sidebar slides in from the left.

| Property | Value |
|----------|-------|
| Animation | `transform: translateX(-100%) → translateX(0)`, `0.25s ease-out` |
| Backdrop | `rgba(0, 0, 0, 0.5)`, covers main content |
| Sidebar | Same 240px design, now overlaying content |
| Close | Tap backdrop or tap X button (top-right of sidebar) |
| Close animation | `translateX(0) → translateX(-100%)`, `0.2s ease-in` |
| z-index sidebar | `50` |
| z-index backdrop | `45` |

---

## 4. Main Content Area

### 4.1 Layout

| Property | Value |
|----------|-------|
| Margin-left | `240px` (desktop), `0` (mobile) |
| Min-height | `100vh` |
| Background | `var(--color-bg-main)` (#0f0f10) |
| Overflow-y | `auto` |
| Padding | `0` (individual pages handle their own padding) |

### 4.2 Page Structure

The main content area renders the active page based on the current route.

| Route | Page | Content |
|-------|------|---------|
| `/student/dashboard` | Home | Game world canvas (full bleed, no padding) |
| `/student/dashboard/directory` | Directory | List view (padded) |
| `/student/dashboard/bounty` | Bounty Board | "Coming Soon" placeholder |
| `/student/dashboard/shop` | Shop | "Coming Soon" placeholder |
| `/student/dashboard/jobs` | Job Board | "Coming Soon" placeholder |
| `/student/dashboard/leaderboard` | Leaderboard | "Coming Soon" placeholder |
| `/student/dashboard/profile` | Profile | Own profile view/edit (padded) |
| `/student/dashboard/settings` | Settings | "Coming Soon" placeholder |

### 4.3 "Coming Soon" Placeholder Template

For Phase 2+ pages:

```
+---------------------------------------------+
|                                             |
|           [Lucide icon, 48px]               |
|                                             |
|          {Page Name}                        |
|          Coming Soon                        |
|                                             |
|     "This feature is under construction."   |
|                                             |
+---------------------------------------------+
```

| Element | Style |
|---------|-------|
| Container | `flex`, centered both axes, `min-height: 60vh` |
| Icon | `48px`, `var(--color-text-subtle)` (#6b7280) |
| Title | `var(--font-size-h3)` (30px), `var(--color-text-main)`, weight 700 |
| Subtitle | `var(--font-size-body)` (16px), `var(--color-text-muted)` (#9ca3af) |
| Gap | `var(--space-4)` (16px) between elements |

---

## 5. Navigation Flow

### 5.1 Auth Guard

All `/student/dashboard/*` routes require authentication.

| Condition | Action |
|-----------|--------|
| Not logged in | Redirect to `/student/login` |
| Logged in, `onboarding_completed !== true` | Redirect to `/student/onboarding` |
| Logged in, onboarding done | Render dashboard |
| Already logged in, visits `/student/login` | Redirect to `/student/dashboard` |

### 5.2 Sidebar Navigation

- Clicking a nav item navigates to the corresponding route via Next.js `<Link>`
- Active item is determined by matching `pathname` against route
- Partial matching: `/student/dashboard/directory/[id]` still highlights "Directory"
- No page reload — client-side navigation via App Router

### 5.3 Loading State

While 3D assets load on the Home page, show the existing ASCII loading screen component (`<LoadingScreen>`). Other pages show a simple skeleton/spinner.

| Page Type | Loading State |
|-----------|--------------|
| Home (game world) | ASCII loading screen with progress bar |
| Data pages (directory, profile) | Skeleton placeholders (gray bars) |
| Placeholder pages | Instant render, no loading needed |

---

## 6. Onboarding Flow (Pre-Dashboard)

> Spec now, build alongside avatar creator in Phase 2.

### 6.1 Steps

1. **Welcome** — "Welcome to Tethos" + brief intro
2. **Profile Setup** — Display name, bio, skills (multi-select), social links
3. **Avatar Creator** — Tabbed panel UI (see below)
4. **Tutorial** — Brief walkthrough of dashboard features
5. **First Quests** — Suggested starter tasks

### 6.2 Avatar Creator — Tabbed Panel (2D Sprite Preview)

> **Updated 2026-03-29:** Avatars are 2D sprites (Dave the Diver style), not 3D models. Preview shows layered sprite composition instead of 3D bust.

```
+----------------------------+
|    [2D Sprite Preview]     |
|     layered composition:   |
|     body + outfit + hair   |
|     + accessories          |
|     (pixel-crisp, large)   |
+----------------------------+
| Body | Face | Hair | Outfit|
+----------------------------+
|  [o1] [o2] [o3] [o4]      |
|  [o5] [o6] [o7] [o8]      |
|           ...              |
+----------------------------+
| [Randomize]    [Confirm]   |
+----------------------------+
```

| Property | Value |
|----------|-------|
| Modal width | `min(560px, 90vw)` |
| Preview area height | `280px` |
| Preview background | `var(--color-bg-alt)` (#111113) with subtle checkerboard pattern (transparency indicator) |
| Preview border-radius | `var(--radius-md)` (16px) top corners |
| Preview rendering | 2D layered sprite at 4× scale (pixel-crisp), centered, `image-rendering: pixelated` |
| Preview layers | Stacked: body → outfit → hair → accessories (matches in-game z-offset order) |
| Preview animation | Idle animation loop at 8 FPS (same as in-game) |
| Tab bar | `40px` height, `var(--color-surface)` background |
| Active tab | `var(--color-text-main)`, `border-bottom: 2px solid var(--color-brand-blue)` |
| Inactive tab | `var(--color-text-muted)` |
| Tab font | `var(--font-size-body-sm)` (14px), weight 500 |
| Options grid | `4 columns`, `var(--space-2)` (8px) gap |
| Option tile | `64px × 64px`, `var(--radius-sm)` (8px) radius, `image-rendering: pixelated` |
| Option tile selected | `border: 2px solid var(--color-brand-blue)`, `glow-blue-sm` |
| Option tile hover | `border: 1px solid var(--glass-border-strong)` |
| Color picker | For Body tab: skin tone palette (6-8 presets). For Hair tab: hair color palette (8-10 presets) |
| Randomize button | Ghost button style, left-aligned |
| Confirm button | Primary button style, right-aligned |
| Options area | `max-height: 240px`, `overflow-y: auto` |
| Total categories | Body (skin tone + body type), Face (eyes + expression), Hair (style + color), Outfit (clothing set) |

---

## 7. Visual Reference Summary

**Design decisions (confirmed by David + Management):**
- Sidebar: Narrow minimal, 240px, flat dark, left accent bar active indicator
- No section grouping in sidebar
- Responsive: hamburger slide-over at 768px breakpoint
- Avatar creator: tabbed panel with 2D layered sprite preview (updated from 3D bust — Management directive 2026-03-29)
- Overlay panels (game interactions): solid dark (#0d1b2a), blue border glow
- Transitions: quick fade to black (0.3s/0.3s)
