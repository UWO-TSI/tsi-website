# UX Spec — Member Directory & Profiles

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-27
> **Implements from:** CLAUDE.md (Student Portal Vision), DESIGN_SYSTEM.md, tokens.css
> **Frontend reads this to build:** `web/components/portal/MemberDirectory.tsx`, `web/components/portal/MemberCard.tsx`, `web/components/portal/ProfileView.tsx`

---

## 1. Overview

The Member Directory is a searchable, filterable list of all chapter members. It uses a **list view** layout with horizontal rows showing avatar, name, class/role, tier badge, level, and XP bar. Accessed via the sidebar nav item "Directory" or the Bulletin Board station inside HQ.

**Route:** `/student/dashboard/directory`
**Data source:** `GET /api/directory` (returns members scoped to chapter, T1/T2 see all)

---

## 2. Directory Page Layout

```
+-------------------------------------------+
|  [Search bar]            [Filter dropdown] |
+-------------------------------------------+
|  Showing 47 members                       |
+-------------------------------------------+
|  [Av] Jane Smith   Warrior [T3]  Lv.8 ===|
|-------------------------------------------|
|  [Av] Alex Lee     Mage   [T4]  Lv.3 =   |
|-------------------------------------------|
|  [Av] Maria Chen   Healer [T2]  Lv.15 ===|
|-------------------------------------------|
|  ...                                      |
+-------------------------------------------+
```

### 2.1 Page Container

| Property | Value |
|----------|-------|
| Padding | `var(--space-6)` (24px) all sides |
| Max-width | `960px` |
| Margin | `0 auto` (centered) |
| Background | `var(--color-bg-main)` (#0f0f10) |

---

## 3. Search & Filter Bar

### 3.1 Layout

```
+--------------------------------------+-----------+
|  🔍 Search members...                | [Filters] |
+--------------------------------------+-----------+
```

| Property | Value |
|----------|-------|
| Display | `flex`, `gap: var(--space-3)` (12px) |
| Margin-bottom | `var(--space-4)` (16px) |

### 3.2 Search Input

| Property | Value |
|----------|-------|
| Width | `flex: 1` |
| Height | `40px` |
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid var(--glass-border-soft)` (rgba(241,255,255,0.12)) |
| Border-radius | `var(--radius-sm)` (8px) |
| Padding | `0 var(--space-3)` (0 12px), `var(--space-8)` (32px) left for icon |
| Font | `var(--font-size-body-sm)` (14px), Test Söhne |
| Text color | `var(--color-text-main)` (#f1ffff) |
| Placeholder color | `var(--color-text-subtle)` (#6b7280) |
| Placeholder text | "Search by name, class, or skill..." |
| Icon | Lucide `Search` (16px), `var(--color-text-subtle)`, positioned absolute left `var(--space-3)` |
| Focus border | `1px solid var(--color-brand-blue)` (#002fa7) |
| Focus shadow | `0 0 0 2px rgba(0, 47, 167, 0.2)` |
| Debounce | `300ms` before filtering |

### 3.3 Filter Dropdown

| Property | Value |
|----------|-------|
| Trigger | Button with Lucide `SlidersHorizontal` icon + "Filters" text |
| Button style | Ghost button: `transparent` bg, `1px solid var(--gray-700)`, `var(--radius-sm)` |
| Button height | `40px` |
| Button hover | `border-color: var(--color-brand-blue)` |
| Dropdown | Appears below button, `position: absolute` |
| Dropdown bg | `var(--color-surface)` (#111827) |
| Dropdown border | `1px solid var(--glass-border-soft)` |
| Dropdown shadow | `var(--shadow-soft)` |
| Dropdown radius | `var(--radius-sm)` (8px) |
| Dropdown padding | `var(--space-3)` (12px) |
| Dropdown z-index | `20` |

### 3.4 Filter Options

| Filter | Type | Options |
|--------|------|---------|
| Tier | Multi-select pills | T1, T2, T3, T4, T5 |
| Role/Class | Dropdown select | All, Warrior, Mage, Healer, Rogue, ... (from DB) |
| Year | Dropdown select | All, 1st, 2nd, 3rd, 4th, 5th+ |
| Status | Toggle | Active / All |

**Filter pill style:**

| Property | Value |
|----------|-------|
| Height | `28px` |
| Padding | `0 var(--space-3)` (0 12px) |
| Font | `var(--font-size-label)` (12px) |
| Unselected | `var(--color-text-muted)`, `transparent` bg, `1px solid var(--gray-700)` |
| Selected | `var(--color-text-main)`, `rgba(0, 47, 167, 0.15)` bg, `1px solid var(--color-brand-blue)` |
| Border-radius | `var(--radius-pill)` |

### 3.5 Results Count

| Property | Value |
|----------|-------|
| Text | "Showing {n} members" |
| Font | `var(--font-size-body-sm)` (14px), `var(--color-text-muted)` |
| Margin | `var(--space-3)` (12px) bottom |

---

## 4. Member List — Row Layout

### 4.1 Row Structure

```
+--[Avatar]--[Name + Class]--[Tier Badge]--[Level]--[XP Bar]--[Arrow]--+
|                                                                        |
|  [40px]   Jane Smith         [T3]         Lv.8    ████████░░   >      |
|           Warrior                                                      |
|                                                                        |
+------------------------------------------------------------------------+
```

### 4.2 Row Container

| Property | Value |
|----------|-------|
| Height | `64px` |
| Display | `flex`, `align-items: center` |
| Padding | `0 var(--space-4)` (0 16px) |
| Gap | `var(--space-3)` (12px) |
| Background | `transparent` |
| Border-bottom | `1px solid rgba(255, 255, 255, 0.06)` |
| Border-radius | `var(--radius-sm)` (8px) |
| Cursor | `pointer` |
| Transition | `background 0.15s ease` |

### 4.3 Row Hover State

| Property | Value |
|----------|-------|
| Background | `rgba(255, 255, 255, 0.04)` |
| Border-bottom-color | `rgba(0, 47, 167, 0.2)` |

### 4.4 Row Elements

#### Avatar

| Property | Value |
|----------|-------|
| Size | `40px × 40px` |
| Border-radius | `50%` |
| Border | `2px solid` (tier-coded, see Section 5) |
| Fallback | Initials on `var(--color-surface)` background |
| Flex-shrink | `0` |

#### Name + Class (stacked)

| Property | Value |
|----------|-------|
| Container | `flex-direction: column`, `gap: 2px` |
| Flex | `1` (takes remaining space) |
| Name | `var(--font-size-body-sm)` (14px), `var(--color-text-main)` (#f1ffff), weight 600 |
| Class | `var(--font-size-label)` (12px), `var(--color-text-muted)` (#9ca3af), weight 400 |

#### Tier Badge

| Property | Value |
|----------|-------|
| Shape | Pill |
| Height | `22px` |
| Padding | `0 8px` |
| Font | `var(--font-size-label)` (12px), IBM Plex Mono, weight 600 |
| Border-radius | `var(--radius-pill)` |
| Colors | See Section 5 (Tier Color System) |
| Flex-shrink | `0` |

#### Level

| Property | Value |
|----------|-------|
| Text | "Lv.{n}" |
| Font | `var(--font-size-body-sm)` (14px), IBM Plex Mono, weight 500 |
| Color | `var(--color-text-soft)` (#e5e7eb) |
| Width | `48px` fixed (right-aligned text) |
| Flex-shrink | `0` |

#### XP Bar

| Property | Value |
|----------|-------|
| Width | `80px` fixed |
| Height | `6px` |
| Background (track) | `var(--gray-800)` (#27272a) |
| Background (fill) | `var(--color-brand-blue)` (#002fa7) |
| Border-radius | `3px` |
| Fill width | `(current_xp / xp_for_next_level) * 100%` |
| Flex-shrink | `0` |

#### Arrow

| Property | Value |
|----------|-------|
| Icon | Lucide `ChevronRight` (16px) |
| Color | `var(--color-text-subtle)` (#6b7280) |
| Hover color | `var(--color-text-muted)` (#9ca3af) |
| Flex-shrink | `0` |

---

## 5. Tier Color System

Each tier has a distinct color used for badges, avatar borders, and accents.

| Tier | Label | Badge BG | Badge Text | Avatar Border | Description |
|------|-------|----------|------------|---------------|-------------|
| T1 | "T1" | `rgba(255, 209, 102, 0.2)` | `var(--color-brand-yellow)` (#ffd166) | `var(--color-brand-yellow)` | Super Admin (David) |
| T2 | "T2" | `rgba(0, 47, 167, 0.2)` | `#4A7AFF` (lighter blue) | `var(--color-brand-blue)` (#002fa7) | Chapter Presidents |
| T3 | "T3" | `rgba(34, 211, 238, 0.2)` | `var(--color-accent-cyan)` (#22d3ee) | `var(--color-accent-cyan)` | PMs & VPs |
| T4 | "T4" | `rgba(34, 197, 94, 0.2)` | `var(--color-success)` (#22c55e) | `var(--color-success)` | Directors & Devs |
| T5 | "T5" | `rgba(161, 161, 170, 0.15)` | `var(--gray-400)` (#a1a1aa) | `var(--gray-600)` (#52525b) | Volunteers |

---

## 6. Empty & Loading States

### 6.1 Loading State

| Property | Value |
|----------|-------|
| Skeleton rows | 8 placeholder rows |
| Skeleton avatar | `40px` circle, `var(--gray-800)` |
| Skeleton text | Bars at 60% / 40% width, `var(--gray-800)` |
| Animation | Shimmer pulse (opacity 0.5 ↔ 1.0, `1.5s` ease) |

### 6.2 Empty State (No Results)

```
+-------------------------------------------+
|                                           |
|         [Lucide Search icon, 32px]        |
|                                           |
|       No members found                    |
|       Try adjusting your filters          |
|                                           |
+-------------------------------------------+
```

| Property | Value |
|----------|-------|
| Container | `flex`, centered, `padding: var(--space-12)` (48px) |
| Icon | Lucide `SearchX` (32px), `var(--color-text-subtle)` |
| Title | `var(--font-size-body)` (16px), `var(--color-text-muted)`, weight 500 |
| Subtitle | `var(--font-size-body-sm)` (14px), `var(--color-text-subtle)` |

---

## 7. Profile Page — Full View

When clicking a member row, navigate to `/student/dashboard/directory/{id}`.

### 7.1 Layout

```
+-------------------------------------------+
|  [< Back to Directory]                    |
+-------------------------------------------+
|                                           |
|  [96px Avatar]                            |
|  Jane Smith                               |
|  Warrior · Tier 3 · PM & VP              |
|  "Building things that matter."           |
|                                           |
|  [Level 8]  [1,200 XP]  [450 Coins]      |
|  ████████████░░░░░░░ XP to Lv.9          |
|                                           |
+-------------------------------------------+
|  SKILLS                                   |
|  [React] [TypeScript] [Node.js] [Figma]  |
+-------------------------------------------+
|  SOCIAL LINKS                             |
|  [GitHub] [LinkedIn] [Portfolio]          |
+-------------------------------------------+
|  ABOUT                                    |
|  3rd year CS student at Western.          |
|  Joined January 2026.                     |
+-------------------------------------------+
```

### 7.2 Profile Header

| Element | Style |
|---------|-------|
| Back link | Lucide `ArrowLeft` + "Back to Directory", `var(--font-size-body-sm)`, `var(--color-text-muted)`, hover: `var(--color-text-main)` |
| Back margin-bottom | `var(--space-6)` (24px) |
| Avatar | `96px × 96px`, `border-radius: 50%`, `4px` tier-colored border |
| Name | `var(--font-size-h3)` (30px), `var(--color-text-main)`, weight 700 |
| Subtitle | `var(--font-size-body)` (16px), `var(--color-text-muted)`, "Class · Tier Label · Role" |
| Bio | `var(--font-size-body)` (16px), `var(--color-text-soft)`, `max-width: 600px` |
| Header gap | `var(--space-2)` (8px) between name/subtitle/bio |

### 7.3 Stats Row

| Element | Style |
|---------|-------|
| Container | `flex`, `gap: var(--space-6)` (24px), `margin: var(--space-6)` (24px) vertical |
| Stat label | `var(--font-size-label)` (12px), `var(--color-text-subtle)`, IBM Plex Mono, uppercase |
| Stat value | `var(--font-size-h4)` (24px), `var(--color-text-main)`, weight 700 |
| XP bar | Full width below stats, `8px` height, same colors as directory list XP bar |
| XP text | "1,200 / 2,000 XP to Level 9", `var(--font-size-label)`, `var(--color-text-muted)`, right-aligned |

### 7.4 Sections (Skills, Social, About)

| Property | Value |
|----------|-------|
| Section label | `var(--font-size-label)` (12px), `var(--color-text-subtle)`, uppercase, `letter-spacing: 0.05em`, IBM Plex Mono |
| Section gap | `var(--space-6)` (24px) between sections |
| Section padding-top | `var(--space-4)` (16px) |
| Section border-top | `1px solid rgba(255, 255, 255, 0.06)` |

#### Skill Tags

| Property | Value |
|----------|-------|
| Display | `flex`, `flex-wrap: wrap`, `gap: var(--space-2)` (8px) |
| Tag height | `28px` |
| Tag padding | `0 var(--space-3)` (0 12px) |
| Tag bg | `rgba(0, 47, 167, 0.1)` |
| Tag border | `1px solid rgba(0, 47, 167, 0.2)` |
| Tag text | `var(--font-size-body-sm)` (14px), `var(--color-text-soft)` |
| Tag radius | `var(--radius-pill)` |

#### Social Links

| Property | Value |
|----------|-------|
| Display | `flex`, `gap: var(--space-3)` (12px) |
| Link style | Icon (20px) + text, `var(--color-text-muted)`, hover: `var(--color-accent-cyan)` |
| Icons | Lucide: `Github`, `Linkedin`, `Globe` (portfolio), `Twitter` |

### 7.5 Own Profile — Edit Mode

When viewing your own profile (`/student/dashboard/profile`), add an "Edit Profile" button.

| Property | Value |
|----------|-------|
| Button | Primary style, top-right of header area |
| Edit mode | Inline — fields become editable inputs |
| Editable fields | Display name, bio, skills (add/remove), social links |
| Save button | Primary style, replaces Edit button |
| Cancel button | Ghost style, next to Save |
| Non-editable | Avatar (Phase 2 avatar creator), tier, level, XP, coins |

---

## 8. Accessibility

| Concern | Implementation |
|---------|---------------|
| Keyboard nav | Tab through rows, Enter to select |
| Focus ring | `outline: 2px solid var(--color-brand-blue)`, `outline-offset: 2px` |
| Screen reader | `role="listbox"` on list, `role="option"` on rows |
| Search | `aria-label="Search members"` |
| Tier badges | `aria-label="Tier {n} - {description}"` |
| XP bar | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |

---

## 9. Visual Reference Summary

**Design decisions (confirmed by David):**
- Directory layout: List view with horizontal rows, 64px row height
- Stats shown: Name, class, tier badge (color-coded), level, XP bar
- Tier colors: T1=gold, T2=blue, T3=cyan, T4=green, T5=gray
- Profile page: full stat display with skills, social links, bio
- Search + filter bar at top with tier/role/year/status filters
