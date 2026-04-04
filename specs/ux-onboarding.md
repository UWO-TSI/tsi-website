# UX Spec — Onboarding Flow

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/app/student/onboarding/page.tsx`, `web/components/portal/OnboardingSteps.tsx`, `web/components/portal/StarterQuests.tsx`

---

## 1. Overview

New members go through onboarding before accessing the dashboard. The flow is: Welcome → Profile Setup → Avatar Creator → enter game world with a quest checklist. The tutorial is **self-directed** — a starter quest checklist gives XP rewards for exploring the campus.

**Route:** `/student/onboarding` (redirected here if `onboarding_completed !== true`)
**On completion:** Sets `onboarding_completed = true`, redirects to `/student/dashboard`

---

## 2. Onboarding Steps

### Step 1 — Welcome Screen

```
+---------------------------------------------+
|                                             |
|        Welcome to Tethos                    |
|                                             |
|   "Technology That Moves People Forward"    |
|                                             |
|   You're about to enter the Tethos          |
|   Campus — a place where students build     |
|   real software for real impact.            |
|                                             |
|   Let's get you set up.                     |
|                                             |
|           [Let's Go]                        |
|                                             |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Layout | `flex`, centered, `min-height: 100vh` |
| Background | `var(--color-bg-main)` with `radial-gradient(ellipse at center, rgba(0, 47, 167, 0.06) 0%, transparent 60%)` |
| Title | `var(--font-size-h1)` (48px), `var(--color-text-main)`, weight 700 |
| Tagline | `var(--font-size-body-lg)` (18px), `var(--color-text-muted)`, IBM Plex Mono, italic |
| Body | `var(--font-size-body)` (16px), `var(--color-text-soft)`, `max-width: 480px`, centered |
| Button | Primary button, "Let's Go" |
| Animation | Staggered fade-up: title → tagline → body → button, `0.6s` stagger `0.15s` |

### Step 2 — Profile Setup

```
+---------------------------------------------+
| Set Up Your Profile               Step 2/3  |
|---------------------------------------------|
|                                             |
| Display Name  [________________]            |
|                                             |
| Bio           [________________]            |
|               [________________]            |
|                                             |
| Year          [1st v]                       |
|                                             |
| Skills        [React] [TypeScript] [+]      |
|               (click to add)                |
|                                             |
| Social Links                                |
|  GitHub    [________________]               |
|  LinkedIn  [________________]               |
|  Portfolio [________________]               |
|                                             |
|  [Back]                    [Continue]       |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Container | `max-width: 560px`, centered, `padding: var(--space-8)` (32px) |
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid var(--glass-border-soft)` |
| Border-radius | `var(--radius-lg)` (24px) |
| Step indicator | "Step 2/3" top-right, `var(--font-size-label)`, `var(--color-text-subtle)` |

#### Form Fields

| Field | Type | Required | Details |
|-------|------|----------|---------|
| Display Name | Text input | Yes | Max 30 chars |
| Bio | Textarea | No | Max 200 chars, `min-height: 80px` |
| Year | Dropdown | Yes | 1st, 2nd, 3rd, 4th, 5th+ |
| Skills | Multi-select tags | No | Click to add from preset list + custom input |
| GitHub | URL input | No | Placeholder: "github.com/username" |
| LinkedIn | URL input | No | Placeholder: "linkedin.com/in/username" |
| Portfolio | URL input | No | Placeholder: "yoursite.com" |

#### Input Style

Same as Job Board form inputs (see `ux-jobs.md` Section 7).

#### Skills Multi-Select

| Property | Value |
|----------|-------|
| Preset list | React, TypeScript, Python, Node.js, Figma, UI/UX, Data Science, ML, Java, Go, Swift, Flutter, etc. |
| Display | Selected skills as pills (same as profile skill tags) |
| Add | Click "+" opens dropdown with search |
| Remove | Click "x" on pill |
| Max | 10 skills |

### Step 3 — Avatar Creator

Uses the tabbed panel avatar creator (see `ux-dashboard.md` Section 6.2 — updated for 2D sprites).

```
+---------------------------------------------+
| Create Your Avatar              Step 3/3    |
|---------------------------------------------|
|                                             |
|      [2D Sprite Preview]                    |
|       layered composition                   |
|       body + outfit + hair                  |
|                                             |
| [Body] [Face] [Hair] [Outfit]              |
|                                             |
| [opt] [opt] [opt] [opt]                    |
| [opt] [opt] [opt] [opt]                    |
|                                             |
| [Randomize]           [Enter Campus]       |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Same spec as `ux-dashboard.md` Section 6.2 |
| Final button text | "Enter Campus" (instead of "Confirm") |
| On submit | Saves avatar config to profile, sets `onboarding_completed = true`, redirects to `/student/dashboard` |

---

## 3. Progress Indicator

A minimal step indicator shown during onboarding.

```
  ●——○——○   Step 1 of 3
```

| Property | Value |
|----------|-------|
| Position | Top of each step |
| Dots | 3 dots connected by lines |
| Active dot | `var(--color-brand-blue)`, filled |
| Completed dot | `var(--color-brand-blue)`, filled + checkmark |
| Upcoming dot | `var(--gray-600)`, hollow |
| Line | `2px`, `var(--gray-700)` (inactive), `var(--color-brand-blue)` (completed) |
| Step label | "Step {n} of 3", `var(--font-size-label)`, `var(--color-text-muted)` |

---

## 4. Starter Quest Checklist (Post-Onboarding Tutorial)

After entering the campus for the first time, a quest checklist widget appears in the UI. Self-directed exploration with XP rewards.

### 4.1 Quest Widget

```
+--[Starter Quests]---------------------+
| Welcome to Tethos Campus!        [—]  |
|                                       |
| [x] Visit the HQ                +50xp|
| [ ] Check the Directory         +25xp|
| [ ] View the Bounty Board       +25xp|
| [ ] Visit the Shop              +25xp|
| [ ] Edit your profile           +50xp|
| [ ] Take the Oracle Quiz       +100xp|
|                                       |
| Progress: 1/6         Total: +275xp  |
| [==================---------]         |
+---------------------------------------+
```

### 4.2 Widget Position & Style

| Property | Value |
|----------|-------|
| Position | `fixed`, bottom-right of main content area |
| Offset | `var(--space-4)` (16px) from bottom and right |
| Width | `320px` |
| Background | `var(--color-bg-navy)` (#0d1b2a) |
| Border | `1px solid rgba(0, 47, 167, 0.3)` |
| Border-radius | `var(--radius-md)` (16px) |
| Shadow | `var(--shadow-soft)` |
| Padding | `var(--space-4)` (16px) |
| z-index | `30` (below overlays, above game labels) |

### 4.3 Widget Header

| Property | Value |
|----------|-------|
| Title | "Starter Quests", `var(--font-size-body)` (16px), weight 600, `var(--color-text-main)` |
| Collapse button | `[—]` icon button, top-right, collapses to just the header bar |
| Collapsed state | Just header with "1/6" progress badge |

### 4.4 Quest Item

| Property | Value |
|----------|-------|
| Height | `36px` |
| Layout | `flex`, `align-items: center`, `gap: var(--space-3)` (12px) |
| Checkbox | `16px`, `var(--gray-700)` border, unchecked. Checked: `var(--color-brand-blue)` fill + white check |
| Quest text | `var(--font-size-body-sm)` (14px), `var(--color-text-soft)` |
| XP reward | Right-aligned, `var(--font-size-label)` (12px), IBM Plex Mono, `var(--color-success)` (#22c55e) |
| Completed | Text gets `var(--color-text-subtle)` + strikethrough, XP shows "Done" |

### 4.5 Quest Definitions

| Quest | Trigger | XP Reward |
|-------|---------|-----------|
| Visit the HQ | Enter HQ building | +50 XP |
| Check the Directory | Open directory page | +25 XP |
| View the Bounty Board | Open bounty board | +25 XP |
| Visit the Shop | Open shop page | +25 XP |
| Edit your profile | Save a profile edit | +50 XP |
| Take the Oracle Quiz | Complete MBTI quiz | +100 XP |

**Total:** 275 XP from starter quests.

### 4.6 Quest Completion

| Event | Behavior |
|-------|----------|
| Quest completed | Checkbox animates to checked, brief green flash on XP text, "+{n} XP" toast notification |
| All quests done | Widget shows "All quests complete! Welcome to Tethos." with confetti/sparkle animation, then auto-collapses after 5s |
| Dismiss | User can close widget entirely after all quests done. Widget doesn't reappear. |

### 4.7 XP Toast Notification

| Property | Value |
|----------|-------|
| Position | Top-center of viewport, below any navbar |
| Text | "+50 XP — Visit the HQ" |
| Font | `var(--font-size-body-sm)` (14px), IBM Plex Mono, `var(--color-success)` |
| Background | `var(--color-surface)` with `1px solid var(--color-success)` border |
| Border-radius | `var(--radius-pill)` |
| Padding | `var(--space-2) var(--space-4)` (8px 16px) |
| Animation | Slide down + fade in (0.3s), hold 2s, slide up + fade out (0.3s) |
| z-index | `70` |

---

## 5. Responsive Behavior

| Viewport | Behavior |
|----------|----------|
| `≥ 768px` | Onboarding forms centered, quest widget bottom-right |
| `< 768px` | Onboarding forms full-width with padding. Quest widget becomes a collapsible bar at the bottom (full width, shorter). |

---

## 6. Edge Cases

| Case | Behavior |
|------|----------|
| Refresh during onboarding | Resume from last completed step (save step progress to profile) |
| Skip avatar | Allow "Skip for now" link below avatar creator — uses default avatar |
| Already onboarded | Redirect to `/student/dashboard` |
| Quest already done before widget loads | Pre-check completed quests on mount |
