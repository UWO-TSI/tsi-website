# UX Spec — Bounty Board

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/components/portal/BountyBoard.tsx`, `web/components/portal/BountyCard.tsx`

---

## 1. Overview

The Bounty Board displays real commission work that members can claim. Accessed via the Bounty Billboard object in the game world (opens as an overlay panel) or via the sidebar nav item (navigates to `/student/dashboard/bounty`).

**Entry points:**
- Game world: interact with Bounty Billboard → overlay panel
- Sidebar: click "Bounty Board" → full page at `/student/dashboard/bounty`

Both use the same content; the overlay is the panel version, the page version has more space.

---

## 2. Overlay Panel Layout (from game world)

Uses the solid dark overlay panel (see `ux-game-world.md` Section 8).

```
+--[Bounty Board]----------------------------+
| Bounty Board                    [X] Close  |
|---------------------------------------------|
| [All] [Available] [My Claims] [Completed]  |
|---------------------------------------------|
| +-----------+ +-----------+                 |
| | Fix Auth  | | Build NPO |                |
| | 200 coin  | | 500 coin  |                |
| | [!] Solo  | | [!!] Team |                |
| | Due: 3d   | | Due: 1w   |                |
| +-----------+ +-----------+                 |
| +-----------+ +-----------+                 |
| | Design    | | Update    |                 |
| | Logo      | | Docs      |                |
| | 100 coin  | | 150 coin  |                |
| +-----------+ +-----------+                 |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Panel max-width | `800px` |
| Panel max-height | `80vh` |
| Panel bg | `var(--color-bg-navy)` (#0d1b2a) |
| Panel border | `1px solid rgba(0, 47, 167, 0.3)` |
| Panel radius | `var(--radius-md)` (16px) |
| Panel shadow | `var(--shadow-strong)` |
| Panel padding | `var(--space-6)` (24px) |

---

## 3. Filter Tabs

```
[All] [Available] [My Claims] [Completed]
```

| Property | Value |
|----------|-------|
| Style | Same as Shop category tabs (see `ux-shop.md` Section 3) |
| Margin-bottom | `var(--space-4)` (16px) |
| "All" | Default active tab |
| "Available" | Bounties not yet claimed |
| "My Claims" | Bounties claimed by current user |
| "Completed" | Bounties completed/reviewed |

---

## 4. Bounty Card Grid

| Property | Value |
|----------|-------|
| Display | CSS Grid |
| Columns | `repeat(2, 1fr)` (2-column) |
| Gap | `var(--space-4)` (16px) |
| Mobile (`< 640px`) | `1fr` (single column) |

---

## 5. Bounty Card

```
+---------------------------+
| Fix Auth Bug         [!]  |
| [Frontend] [Solo]         |
|                           |
| 200 TSI coins             |
| Due in 3 days             |
|                           |
| [Claim Bounty]            |
+---------------------------+
```

### 5.1 Card Container

| Property | Value |
|----------|-------|
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid rgba(255, 255, 255, 0.06)` |
| Border-radius | `var(--radius-sm)` (8px) |
| Padding | `var(--space-4)` (16px) |
| Hover border | `rgba(0, 47, 167, 0.2)` |
| Cursor | `pointer` |

### 5.2 Card Elements

#### Title Row

| Element | Style |
|---------|-------|
| Title | `var(--font-size-body)` (16px), `var(--color-text-main)`, weight 600 |
| Difficulty icon | Right-aligned |

#### Difficulty Indicator

| Level | Display | Color |
|-------|---------|-------|
| Easy | `[!]` | `var(--color-success)` (#22c55e) |
| Medium | `[!!]` | `var(--color-warning)` (#facc15) |
| Hard | `[!!!]` | `var(--color-error)` (#ef4444) |

#### Tags Row

| Property | Value |
|----------|-------|
| Layout | `flex`, `gap: var(--space-2)` (8px) |
| Tag style | Same as skill tags: `var(--font-size-label)` (12px), pill shape |
| Category tag | `rgba(0, 47, 167, 0.1)` bg, `var(--color-text-soft)` text |
| Solo/Team badge | Solo: `var(--color-accent-cyan)` tint, Team: `var(--color-brand-yellow)` tint |

#### Reward

| Property | Value |
|----------|-------|
| Text | "{n} TSI coins" |
| Font | `var(--font-size-body-sm)` (14px), IBM Plex Mono, `var(--color-brand-yellow)` (#ffd166) |
| Coin icon | Small `16px` icon before amount |

#### Deadline

| Property | Value |
|----------|-------|
| Text | "Due in {n} days" or "Due {date}" |
| Font | `var(--font-size-body-sm)` (14px), `var(--color-text-muted)` |
| Overdue | `var(--color-error)` text |

#### Action Button

| State | Button |
|-------|--------|
| Available | "Claim Bounty" — Primary button, full width |
| Claimed (by you) | "View Submission" — Ghost button |
| Claimed (by other) | "Claimed" — Disabled, `var(--color-text-subtle)` |
| Completed | "Completed" — `var(--color-success)` text, no button |

---

## 6. Bounty Detail View

Clicking a bounty card opens a detail view (modal overlay or slide panel).

```
+--[Bounty Detail]---------------------------+
| [< Back]                        [X] Close  |
|---------------------------------------------|
| Fix Auth Bug in Login Flow                  |
| [Frontend] [Solo] [!!]                      |
|                                             |
| REWARD: 200 TSI coins                      |
| DEADLINE: April 2, 2026                    |
| POSTED BY: David Liu (T1)                  |
|---------------------------------------------|
| DESCRIPTION                                 |
| The login flow currently redirects to a     |
| blank page when session expires. Fix the    |
| middleware to properly handle...            |
|---------------------------------------------|
| REQUIREMENTS                                |
| - Fix middleware redirect logic             |
| - Add proper error state UI                 |
| - Write tests for the fix                  |
|---------------------------------------------|
| [Claim This Bounty]                         |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Panel style | Same solid dark overlay |
| Title | `var(--font-size-h4)` (24px), weight 700 |
| Labels | Section label style (uppercase, `var(--font-size-label)`, `var(--color-text-subtle)`) |
| Description | `var(--font-size-body)` (16px), `var(--color-text-soft)` |
| Requirements | Bulleted list, same body style |

---

## 7. Claim Flow

| Step | UI |
|------|-----|
| 1. Click "Claim Bounty" | Confirmation modal: "Claim this bounty? You'll have {n} days to complete it." |
| 2. Confirm | Bounty moves to "My Claims", card shows "In Progress" state |
| 3. Submit work | "Submit" button on claimed bounty opens submission form (text area + optional link) |
| 4. Review | T1-T3 admin reviews in Admin Room. Status shows "Under Review" |
| 5. Approved | Coins awarded, bounty moves to "Completed" |
| 6. Rejected | Feedback shown, bounty returns to "My Claims" for resubmission |

### Submission Form

| Property | Value |
|----------|-------|
| Container | Modal overlay |
| Text area | `min-height: 120px`, placeholder "Describe your work and link to deliverables..." |
| Link field | Optional URL input |
| Submit button | Primary button |
| Cancel button | Ghost button |

---

## 8. Bounty Hunter Application

Members need "Bounty Hunter" title to claim bounties. First-time visitors see:

```
+--[Become a Bounty Hunter]--+
| Want to earn TSI coins by   |
| completing real tasks?      |
|                             |
| [Apply to become a          |
|  Bounty Hunter]             |
+-----------------------------+
```

| Property | Value |
|----------|-------|
| Banner | Top of bounty board, `var(--color-bg-navy)` bg, `1px solid var(--color-brand-yellow)` border |
| Text | `var(--font-size-body)`, `var(--color-text-soft)` |
| Button | Primary button |
| Application | Simple form: why you want to join (text area). T1-T3 approves. |
| After approval | Banner disappears, "Claim" buttons become active |

---

## 9. Empty States

| State | Display |
|-------|---------|
| No bounties | Lucide `Scroll` (32px), "No bounties available right now. Check back soon!" |
| No claims | "You haven't claimed any bounties yet. Browse available bounties to get started." |
| No completions | "No completed bounties yet. Claim and finish a bounty to see it here." |
