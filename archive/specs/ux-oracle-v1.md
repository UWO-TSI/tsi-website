# UX Spec — Oracle Temple (MBTI → RPG Class)

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/app/student/dashboard/oracle/page.tsx`, `web/components/portal/OracleQuiz.tsx`, `web/components/portal/ClassReveal.tsx`

---

## 1. Overview

The Oracle Temple is where players discover their RPG class through an MBTI-inspired personality quiz. The quiz presents questions with 2–4 answer cards laid out in front of the player. The user clicks the most accurate card. A progress bar tracks completion at the bottom. After the quiz, an animated class reveal assigns their main class and subclass.

**Route:** `/student/dashboard/oracle`
**Entry:** Entering the Oracle Temple building in the game world (fade-to-black → navigates to page)
**One-time:** Players take the quiz once. Afterward, visiting Oracle shows their class info + option to retake.

---

## 2. Quiz Page Layout

```
+--[Oracle Temple]-----------------------------------+
|                                                     |
|        "When working on a group project,            |
|         you naturally tend to..."                   |
|                                                     |
|  +----------+  +----------+  +----------+           |
|  | Take     |  | Focus on |  | Keep the |           |
|  | charge   |  | the      |  | team     |           |
|  | and      |  | details  |  | motivated|           |
|  | delegate |  | and data |  | and      |           |
|  |          |  |          |  | united   |           |
|  +----------+  +----------+  +----------+           |
|                                                     |
|  [==========-----------------] 4 of 12              |
+-----------------------------------------------------+
```

### 2.1 Page Container

| Property | Value |
|----------|-------|
| Display | `flex`, `flex-direction: column`, `align-items: center`, `justify-content: center` |
| Min-height | `calc(100vh - sidebar-height)` or `100%` of main content area |
| Padding | `var(--space-8)` (32px) |
| Background | `var(--color-bg-main)` (#0f0f10) with subtle radial gradient: `radial-gradient(ellipse at center, rgba(0, 47, 167, 0.04) 0%, transparent 60%)` |

---

## 3. Question Display

| Property | Value |
|----------|-------|
| Max-width | `720px` |
| Text-align | `center` |
| Font | `var(--font-size-h4)` (24px), weight 500, `var(--color-text-main)` |
| Line-height | `var(--lh-snug)` (1.25) |
| Margin-bottom | `var(--space-8)` (32px) |
| Animation | Fade in from below: `opacity: 0, y: 20 → opacity: 1, y: 0`, `0.4s ease-out` |

---

## 4. Answer Cards

2–4 cards displayed horizontally. Player clicks the most accurate one.

### 4.1 Card Layout

| Property | Value |
|----------|-------|
| Container | `flex`, `justify-content: center`, `gap: var(--space-4)` (16px) |
| Card count | 2–4 per question |
| Card width | `180px` (fixed) |
| Card min-height | `160px` |
| Responsive | `flex-wrap: wrap` on mobile, cards stack 2×2 |

### 4.2 Answer Card Style

| Property | Value |
|----------|-------|
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid rgba(255, 255, 255, 0.08)` |
| Border-radius | `var(--radius-md)` (16px) |
| Padding | `var(--space-6)` (24px) |
| Text-align | `center` |
| Font | `var(--font-size-body)` (16px), weight 500, `var(--color-text-soft)` |
| Line-height | `var(--lh-normal)` (1.5) |
| Cursor | `pointer` |
| Transition | `border-color 0.2s, transform 0.2s, background 0.2s` |
| Animation (enter) | Staggered fade-up: `opacity: 0, y: 30 → opacity: 1, y: 0`, `0.3s`, stagger `0.08s` |

### 4.3 Answer Card States

| State | Style |
|-------|-------|
| Default | As above |
| Hover | `border-color: rgba(0, 47, 167, 0.4)`, `transform: translateY(-4px)`, `background: rgba(255, 255, 255, 0.04)` |
| Selected (click) | `border: 2px solid var(--color-brand-blue)`, `glow-blue-sm`, `scale(1.02)` for `0.15s`, then auto-advance to next question |
| Disabled (after selection) | Brief `0.3s` hold showing selected state, then all cards fade out, next question fades in |

---

## 5. Progress Bar

Pinned at the bottom of the quiz area.

| Property | Value |
|----------|-------|
| Position | Below answer cards, `margin-top: var(--space-8)` (32px) |
| Width | `min(400px, 80vw)` |
| Height | `6px` |
| Track bg | `var(--gray-800)` (#27272a) |
| Fill bg | `var(--color-brand-blue)` (#002fa7) |
| Fill transition | `width 0.4s ease-out` |
| Border-radius | `3px` |
| Label | "{n} of {total}" right-aligned below bar, `var(--font-size-label)` (12px), `var(--color-text-muted)`, IBM Plex Mono |

---

## 6. Question Design

| Property | Value |
|----------|-------|
| Total questions | 12 (covers all 4 MBTI dichotomies: E/I, S/N, T/F, J/P — 3 questions each) |
| Answers per question | 2–4 cards (varies by question) |
| Scoring | Each answer maps to one side of a dichotomy. Majority wins per dichotomy. |
| Result | 4-letter MBTI type → maps to RPG class + subclass |

---

## 7. Class Reveal Animation

After the final question, a dramatic reveal sequence plays.

### 7.1 Sequence

```
Timeline:
0.0s  Final answer selected
0.3s  Cards fade out
0.5s  Screen dims slightly
0.8s  "The Oracle has spoken..." text fades in (center)
2.0s  Text fades out
2.3s  Class name appears large with glow effect
2.8s  Subclass name appears below
3.3s  Class description fades in
4.5s  "Continue" button appears
```

### 7.2 Reveal Screen

```
+---------------------------------------------+
|                                             |
|              ⚔  WARRIOR  ⚔                  |
|           The Tactical Commander            |
|                                             |
|    "You lead with strategy and action.      |
|     Your strength lies in turning plans     |
|     into reality."                          |
|                                             |
|    Class: Warrior (ENTJ)                    |
|    Subclass: Tactical Commander             |
|                                             |
|           [Enter the Campus]                |
|                                             |
+---------------------------------------------+
```

| Element | Style |
|---------|-------|
| Background | `var(--color-bg-main)` with `radial-gradient(ellipse at center, rgba(0, 47, 167, 0.1) 0%, transparent 50%)` |
| Class name | `var(--font-size-hero)` (64px), `var(--color-text-main)`, weight 700, `letter-spacing: 0.1em`, `text-transform: uppercase` |
| Class glow | `text-shadow: 0 0 40px rgba(0, 47, 167, 0.5), 0 0 80px rgba(0, 47, 167, 0.2)` |
| Subclass | `var(--font-size-h3)` (30px), `var(--color-text-soft)`, weight 400, italic |
| Description | `var(--font-size-body-lg)` (18px), `var(--color-text-muted)`, `max-width: 500px`, centered |
| MBTI label | `var(--font-size-body-sm)` (14px), IBM Plex Mono, `var(--color-text-subtle)` |
| Button | Primary button, "Enter the Campus" → redirects to `/student/dashboard` |
| Animation | Each element staggered fade-in with `translateY(20px)` entrance |

---

## 8. RPG Class System

### 8.1 Four Main Classes (mapped from MBTI dichotomies)

| Class | MBTI Types | Color Accent | Description |
|-------|-----------|-------------|-------------|
| Warrior | ENTJ, ESTJ, ESTP, ENTP | `var(--color-error)` (#ef4444) tint | Leaders and doers — action-oriented, strategic |
| Mage | INTJ, INTP, INFJ, INFP | `var(--color-brand-blue)` (#002fa7) tint | Thinkers and visionaries — analytical, creative |
| Healer | ENFJ, ENFP, ESFJ, ISFJ | `var(--color-success)` (#22c55e) tint | Connectors and supporters — empathetic, team-focused |
| Rogue | ISTP, ISFP, ISTJ, ESFP | `var(--color-brand-yellow)` (#ffd166) tint | Craftspeople and adapters — resourceful, independent |

### 8.2 Sixteen Subclasses (one per MBTI type)

| MBTI | Class | Subclass Name |
|------|-------|---------------|
| ENTJ | Warrior | Tactical Commander |
| ESTJ | Warrior | Iron Marshal |
| ESTP | Warrior | Vanguard Striker |
| ENTP | Warrior | Battle Strategist |
| INTJ | Mage | Arcane Architect |
| INTP | Mage | Lore Seeker |
| INFJ | Mage | Oracle Sage |
| INFP | Mage | Dream Weaver |
| ENFJ | Healer | Beacon Guide |
| ENFP | Healer | Spirit Catalyst |
| ESFJ | Healer | Shield Warden |
| ISFJ | Healer | Sanctuary Keeper |
| ISTP | Rogue | Shadow Tinker |
| ISFP | Rogue | Wandering Artisan |
| ISTJ | Rogue | Silent Sentinel |
| ESFP | Rogue | Blaze Performer |

---

## 9. Post-Quiz — Class Info Page

After taking the quiz, visiting `/student/dashboard/oracle` shows:

```
+---------------------------------------------+
| Your Class                                  |
|                                             |
| [Class Icon]  WARRIOR                       |
|               Tactical Commander (ENTJ)     |
|                                             |
| "You lead with strategy and action..."     |
|                                             |
| [Retake Quiz]                              |
+---------------------------------------------+
```

| Property | Value |
|----------|-------|
| Class icon | Large (64px), color-coded per class |
| Retake button | Ghost button, "Retake Quiz" |
| Retake confirmation | "This will replace your current class. Continue?" |

---

## 10. Responsive

| Viewport | Behavior |
|----------|----------|
| `≥ 768px` | Cards in horizontal row, 180px each |
| `< 768px` | Cards wrap to 2×2 grid, `min-width: 140px` |
| `< 480px` | Cards stack vertically, full width |
