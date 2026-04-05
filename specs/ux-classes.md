# Class Visual Identity Sheet — 4 Classes + 16 Subclasses

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-05
> **Extends:** `specs/ux-oracle.md` (quiz flow), `specs/oracle-questions.md` (question bank)
> **Icons:** Lucide React (simple line icons, consistent with portal UI)
> **Animation:** Text + glow only (no particles)

---

## 1. Four Main Classes

### 1.1 Warrior

| Property | Value |
|----------|-------|
| Color accent | `#EF4444` (red-500) |
| Color bg | `rgba(239, 68, 68, 0.12)` |
| Color glow | `0 0 40px rgba(239, 68, 68, 0.4), 0 0 80px rgba(239, 68, 68, 0.15)` |
| Lucide icon | `Sword` |
| Icon fallback | `Swords` (if Sword unavailable) |
| Title | "Warrior" |
| Tagline | "Lead the Charge" |
| Description | "Warriors are the leaders and doers of Tethos. You thrive on action, strategy, and turning plans into results. Where others hesitate, you advance. Your strength is rallying people behind a goal and executing with precision." |
| Personality | Action-oriented, strategic, decisive, competitive, bold |
| MBTI types | ENTJ, ESTJ, ESTP, ENTP |
| Symbol emoji | `⚔` (for fallback/alt text) |

### 1.2 Mage

| Property | Value |
|----------|-------|
| Color accent | `#6366F1` (indigo-500) |
| Color bg | `rgba(99, 102, 241, 0.12)` |
| Color glow | `0 0 40px rgba(99, 102, 241, 0.4), 0 0 80px rgba(99, 102, 241, 0.15)` |
| Lucide icon | `Sparkles` |
| Title | "Mage" |
| Tagline | "See Beyond the Code" |
| Description | "Mages are the thinkers and visionaries. You see patterns others miss, build systems that last, and approach problems with analytical precision. Your mind is your greatest weapon — creative, deep, and endlessly curious." |
| Personality | Analytical, creative, visionary, independent, curious |
| MBTI types | INTJ, INTP, INFJ, INFP |
| Symbol emoji | `🔮` (for fallback/alt text) |

### 1.3 Healer

| Property | Value |
|----------|-------|
| Color accent | `#22C55E` (green-500) |
| Color bg | `rgba(34, 197, 94, 0.12)` |
| Color glow | `0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(34, 197, 94, 0.15)` |
| Lucide icon | `Heart` |
| Title | "Healer" |
| Tagline | "Strengthen the Team" |
| Description | "Healers are the connectors and supporters who hold teams together. You understand people, nurture potential, and create environments where everyone thrives. Your empathy and warmth make you the glue of every project." |
| Personality | Empathetic, team-focused, nurturing, diplomatic, inspiring |
| MBTI types | ENFJ, ENFP, ESFJ, ISFJ |
| Symbol emoji | `💚` (for fallback/alt text) |

### 1.4 Rogue

| Property | Value |
|----------|-------|
| Color accent | `#F59E0B` (amber-500) |
| Color bg | `rgba(245, 158, 11, 0.12)` |
| Color glow | `0 0 40px rgba(245, 158, 11, 0.4), 0 0 80px rgba(245, 158, 11, 0.15)` |
| Lucide icon | `Wrench` |
| Icon fallback | `Hammer` (alternative) |
| Title | "Rogue" |
| Tagline | "Craft Your Own Path" |
| Description | "Rogues are the craftspeople and adapters. You're resourceful, independent, and thrive when given freedom to tinker and create. You find elegant solutions to messy problems and trust your hands more than meetings." |
| Personality | Resourceful, independent, practical, adaptable, hands-on |
| MBTI types | ISTP, ISFP, ISTJ, ESFP |
| Symbol emoji | `🗡` (for fallback/alt text) |

---

## 2. Sixteen Subclasses

Each subclass gets a name, short description (1 sentence), and inherits its parent class color.

### 2.1 Warrior Subclasses

| MBTI | Subclass | Description |
|------|----------|-------------|
| ENTJ | Tactical Commander | You see the whole battlefield and position your team for victory. Born to lead large-scale initiatives. |
| ESTJ | Iron Marshal | You enforce structure and accountability. Projects run on time because you make it so. |
| ESTP | Vanguard Striker | You're first into the fray, making decisions on the fly. Speed and adaptability are your weapons. |
| ENTP | Battle Strategist | You see angles nobody else does. Your unconventional tactics turn impossible odds into wins. |

### 2.2 Mage Subclasses

| MBTI | Subclass | Description |
|------|----------|-------------|
| INTJ | Arcane Architect | You design systems so elegant they feel inevitable. Long-range planning is your art form. |
| INTP | Lore Seeker | You dive deep into problems until you understand them at the atomic level. Knowledge is your power. |
| INFJ | Oracle Sage | You see the bigger picture — not just what the code does, but what it means. Quiet wisdom guides your work. |
| INFP | Dream Weaver | You build with purpose and heart. Every project you touch carries a piece of your vision for a better world. |

### 2.3 Healer Subclasses

| MBTI | Subclass | Description |
|------|----------|-------------|
| ENFJ | Beacon Guide | You light the way for others. Your natural mentorship makes everyone around you level up. |
| ENFP | Spirit Catalyst | You bring infectious energy and ideas. Your enthusiasm turns tired teams into creative forces. |
| ESFJ | Shield Warden | You protect team morale and ensure nobody falls through the cracks. The reliable backbone of any project. |
| ISFJ | Sanctuary Keeper | You create order from chaos and remember the details everyone else forgets. Quiet, essential, irreplaceable. |

### 2.4 Rogue Subclasses

| MBTI | Subclass | Description |
|------|----------|-------------|
| ISTP | Shadow Tinker | You take things apart to understand them, then build something better. Your workshop is your temple. |
| ISFP | Wandering Artisan | You blend aesthetics with function. Everything you create has an understated beauty to it. |
| ISTJ | Silent Sentinel | You do the work nobody notices — until it's not done. Reliable, thorough, the foundation under the castle. |
| ESFP | Blaze Performer | You bring showmanship and energy to every demo. When you present, people pay attention. |

---

## 3. Class Color Tokens

Add to `game-tokens.css`:

```css
/* ─── Class Identity Colors ─── */

/* Warrior (Red) */
--class-warrior-color: #EF4444;
--class-warrior-bg: rgba(239, 68, 68, 0.12);
--class-warrior-glow: 0 0 40px rgba(239, 68, 68, 0.4), 0 0 80px rgba(239, 68, 68, 0.15);
--class-warrior-border: rgba(239, 68, 68, 0.3);

/* Mage (Indigo) */
--class-mage-color: #6366F1;
--class-mage-bg: rgba(99, 102, 241, 0.12);
--class-mage-glow: 0 0 40px rgba(99, 102, 241, 0.4), 0 0 80px rgba(99, 102, 241, 0.15);
--class-mage-border: rgba(99, 102, 241, 0.3);

/* Healer (Green) */
--class-healer-color: #22C55E;
--class-healer-bg: rgba(34, 197, 94, 0.12);
--class-healer-glow: 0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(34, 197, 94, 0.15);
--class-healer-border: rgba(34, 197, 94, 0.3);

/* Rogue (Amber) */
--class-rogue-color: #F59E0B;
--class-rogue-bg: rgba(245, 158, 11, 0.12);
--class-rogue-glow: 0 0 40px rgba(245, 158, 11, 0.4), 0 0 80px rgba(245, 158, 11, 0.15);
--class-rogue-border: rgba(245, 158, 11, 0.3);
```

---

## 4. Where Classes Appear in the UI

### 4.1 Sidebar — Player Status

```
+-------------------------------+
|  [32px Avatar]  Jane Smith    |
|                 Lv. 12        |
|  ⚔ Warrior                   |
+-------------------------------+
```

| Property | Value |
|----------|-------|
| Class icon | Lucide icon (14px), class-colored |
| Class name | `12px`, `font-mono`, class-colored |
| Position | Below level text in player status section |

### 4.2 Directory — Member Row

| Element | Style |
|---------|-------|
| Class text | Already shown as subtitle (12px, `var(--color-text-muted)`) |
| Enhancement | Prefix with Lucide icon (12px), class-colored: `⚔ Warrior` |

### 4.3 Profile Page — Subtitle

| Element | Style |
|---------|-------|
| Current | "Warrior · Tier 3 · PM & VP" |
| Enhancement | Add Lucide icon before class name, colored in class accent |

### 4.4 Leaderboard — Optional Class Column

| Element | Style |
|---------|-------|
| Column | After Name, before Level |
| Content | Lucide icon (14px) + class name (12px, class-colored) |
| Responsive | Hidden below `md` (768px) |

### 4.5 Game World — Player Nameplate

```
     Jane · Lv.12
       ⚔ Warrior
```

| Property | Value |
|----------|-------|
| Class line | Below name/level, `10px`, class-colored |
| Icon | Displayed as unicode fallback in `<Html>` element |

---

## 5. Class Reveal Animation (text + glow)

### 5.1 Timeline

```
0.0s   Final answer selected — card flashes with selection glow
0.3s   All cards fade out (opacity 1→0, 0.3s ease)
0.6s   Background dims: radial gradient expands (class-colored, 0.08 opacity)
0.8s   "The Oracle has spoken..." fades in (center)
       Font: 16px, italic, var(--color-text-muted)
       Animation: opacity 0→1, translateY(10px→0), 0.5s ease-out
2.0s   Oracle text fades out (opacity 1→0, 0.4s)
2.3s   Class icon appears (Lucide, 48px, class-colored)
       Animation: scale(0.5→1), opacity(0→1), 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)
2.5s   Class name appears below icon
       Font: 64px, weight 700, uppercase, letter-spacing 0.1em, var(--color-text-main)
       Text-shadow: class glow (from Section 3 tokens)
       Animation: opacity(0→1), translateY(20px→0), 0.5s ease-out
3.0s   Subclass name appears
       Font: 30px, weight 400, italic, var(--color-text-soft)
       Animation: opacity(0→1), translateY(15px→0), 0.4s ease-out
3.5s   Description text appears
       Font: 18px, var(--color-text-muted), max-width 500px, centered
       Animation: opacity(0→1), 0.5s ease-out
3.8s   MBTI label appears
       Font: 14px, font-mono, var(--color-text-subtle)
       Content: "Class: Warrior (ENTJ)"
4.5s   "Enter the Campus" button appears
       Primary button, class-colored background (not brand-blue)
       Animation: opacity(0→1), translateY(10px→0), 0.3s ease-out
```

### 5.2 Reveal Screen Layout

```
+---------------------------------------------+
|                                             |
|              [Lucide Icon 48px]              |
|                                             |
|              ⚔  WARRIOR  ⚔                  |
|           The Tactical Commander            |
|                                             |
|    "You lead with strategy and action.      |
|     Your strength lies in turning plans     |
|     into reality."                          |
|                                             |
|    Class: Warrior (ENTJ)                    |
|                                             |
|           [Enter the Campus]                |
|                                             |
+---------------------------------------------+
```

### 5.3 Reveal Background

| Property | Value |
|----------|-------|
| Base | `var(--color-bg-main)` (#0f0f10) |
| Gradient | `radial-gradient(ellipse at center, {class-bg} 0%, transparent 60%)` |
| Gradient animation | Expands from 0% to 60% radius over 0.8s at t=0.6s |
| Full coverage | `position: fixed; inset: 0` — overlays entire viewport |

### 5.4 Button — "Enter the Campus"

| Property | Value |
|----------|-------|
| Background | Class accent color (not brand-blue) |
| Color | `#FFFFFF` (white text) |
| Height | `48px` |
| Padding | `0 32px` |
| Font | `16px`, weight 600 |
| Border-radius | `12px` |
| Hover | Lighten 10% (`filter: brightness(1.1)`) |
| Action | Navigate to `/student/dashboard` |

---

## 6. Class Data Object (for Frontend)

Frontend should create a `CLASS_DATA` constant:

```typescript
import { Sword, Sparkles, Heart, Wrench } from "lucide-react";

export const CLASS_DATA = {
  Warrior: {
    icon: Sword,
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.12)",
    glow: "0 0 40px rgba(239, 68, 68, 0.4), 0 0 80px rgba(239, 68, 68, 0.15)",
    tagline: "Lead the Charge",
    description: "Warriors are the leaders and doers...",
    subclasses: {
      ENTJ: { name: "Tactical Commander", desc: "You see the whole battlefield..." },
      ESTJ: { name: "Iron Marshal", desc: "You enforce structure..." },
      ESTP: { name: "Vanguard Striker", desc: "You're first into the fray..." },
      ENTP: { name: "Battle Strategist", desc: "You see angles nobody else does..." },
    },
  },
  // ... Mage, Healer, Rogue
};
```

---

## 7. Accessibility

| Concern | Implementation |
|---------|---------------|
| Color + icon | Class identity uses both color AND icon — never color alone |
| Icon aria-label | Each Lucide icon has `aria-label="Warrior class"` (etc.) |
| Reveal animation | `prefers-reduced-motion: reduce` → skip animation, show final state immediately |
| Screen reader | Announce class result: `aria-live="polite"` region with "Your class is Warrior — Tactical Commander" |
| Contrast | All class colors meet WCAG AA on dark backgrounds (tested against #0f0f10) |
