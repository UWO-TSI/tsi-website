# UX Spec — Leaderboard

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/components/portal/Leaderboard.tsx`

---

## 1. Overview

The Leaderboard shows ranked members by XP. Accessed via the Leaderboard Statue in the game world (overlay) or sidebar nav (page). Ranked table format with time period tabs and your-row highlighting.

**Entry points:**
- Game world: interact with Leaderboard Statue → overlay panel
- Sidebar: click "Leaderboard" → `/student/dashboard/leaderboard`

---

## 2. Layout

```
+--[Leaderboard]----------------------------+
| Leaderboard                     [X] Close |
|--------------------------------------------|
| [Weekly] [Monthly] [All-Time]             |
|--------------------------------------------|
| #  Avatar  Name           Level  XP  Tier |
|--------------------------------------------|
| 1  [Av]   David Liu       20   4800  T1  |
| 2  [Av]   Jane Smith      15   3200  T3  |
| 3  [Av]   Alex Lee        12   2400  T4  |
| 4  [Av]   Maria Chen      10   1800  T2  |
| 5  [Av]   Sam Park         9   1500  T4  |
| ...                                       |
|--------------------------------------------|
| 23 [Av]   YOU (Your Name)  8   1200  T4  | ← highlighted
+--------------------------------------------+
```

---

## 3. Time Period Tabs

```
[Weekly] [Monthly] [All-Time]
```

| Property | Value |
|----------|-------|
| Style | Same pill tabs as Shop/Bounty (see `ux-shop.md` Section 3) |
| Default | "All-Time" active |
| Weekly | XP earned in the past 7 days |
| Monthly | XP earned in the past 30 days |
| All-Time | Total lifetime XP |
| Margin-bottom | `var(--space-4)` (16px) |

---

## 4. Table Header

| Property | Value |
|----------|-------|
| Height | `36px` |
| Font | `var(--font-size-label)` (12px), `var(--color-text-subtle)` (#6b7280), uppercase, `letter-spacing: 0.05em` |
| Font family | IBM Plex Mono |
| Border-bottom | `1px solid rgba(255, 255, 255, 0.08)` |
| Columns | `#` (40px), Avatar (40px), Name (flex), Level (60px), XP (80px), Tier (50px) |

---

## 5. Leaderboard Row

| Property | Value |
|----------|-------|
| Height | `56px` |
| Display | `flex`, `align-items: center` |
| Padding | `0 var(--space-4)` (0 16px) |
| Gap | `var(--space-3)` (12px) |
| Border-bottom | `1px solid rgba(255, 255, 255, 0.04)` |
| Hover bg | `rgba(255, 255, 255, 0.03)` |

### 5.1 Row Elements

#### Rank Number

| Property | Value |
|----------|-------|
| Width | `40px`, right-aligned |
| Font | `var(--font-size-body)` (16px), IBM Plex Mono, weight 700 |
| #1 color | `var(--color-brand-yellow)` (#ffd166) — gold |
| #2 color | `var(--gray-300)` (#d4d4d8) — silver |
| #3 color | `#cd7f32` — bronze |
| #4+ color | `var(--color-text-muted)` (#9ca3af) |

#### Avatar

| Property | Value |
|----------|-------|
| Size | `36px × 36px` |
| Border-radius | `50%` |
| Border | `2px solid` tier-colored (see `ux-directory.md` Section 5) |

#### Name

| Property | Value |
|----------|-------|
| Flex | `1` |
| Font | `var(--font-size-body-sm)` (14px), weight 600 |
| Color | `var(--color-text-main)` (#f1ffff) |

#### Level

| Property | Value |
|----------|-------|
| Width | `60px` |
| Text | "Lv.{n}" |
| Font | `var(--font-size-body-sm)` (14px), IBM Plex Mono |
| Color | `var(--color-text-soft)` (#e5e7eb) |

#### XP

| Property | Value |
|----------|-------|
| Width | `80px`, right-aligned |
| Text | `{n}` (formatted with commas) |
| Font | `var(--font-size-body-sm)` (14px), IBM Plex Mono, weight 500 |
| Color | `var(--color-text-main)` |

#### Tier Badge

| Property | Value |
|----------|-------|
| Width | `50px` |
| Style | Same as directory tier badge (see `ux-directory.md` Section 5) |

---

## 6. Your Row — Highlighted

If your rank is not visible in the current scroll position, your row is pinned at the bottom of the table.

| Property | Value |
|----------|-------|
| Background | `rgba(0, 47, 167, 0.08)` |
| Border-left | `3px solid var(--color-brand-blue)` (#002fa7) |
| Name display | "{Your Name}" with "(You)" suffix in `var(--color-text-muted)` |
| Position | If rank > visible rows: sticky at bottom with divider above |
| Divider | `1px dashed var(--glass-border-soft)` above sticky row |

---

## 7. Empty & Loading States

### Loading

| Property | Value |
|----------|-------|
| Skeleton rows | 10 placeholder rows |
| Animation | Shimmer pulse |

### Empty

| Property | Value |
|----------|-------|
| Icon | Lucide `Trophy` (32px), `var(--color-text-subtle)` |
| Text | "No rankings yet for this period." |

---

## 8. Responsive

| Viewport | Behavior |
|----------|----------|
| `≥ 768px` | Full table with all columns |
| `< 768px` | Hide Tier column, compress XP column. Rank + Avatar + Name + Level visible. |
| `< 480px` | Hide Level column too. Rank + Avatar + Name + XP only. |
