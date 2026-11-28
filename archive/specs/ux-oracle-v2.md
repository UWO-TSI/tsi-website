# UX Spec — Oracle Quiz v2: Card-Game NPC Encounter

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-05
> **Replaces:** `specs/ux-oracle.md` Sections 2-5 (quiz layout). Sections 6-10 (scoring, classes, reveal, post-quiz) remain unchanged.
> **Inspiration:** Card-game NPC encounter — over-the-shoulder angle, monk NPC asks questions via speech bubble, answer options as playable cards fanned at bottom.
> **Frontend reads this to build:** `web/app/student/dashboard/oracle/page.tsx`, `web/components/portal/OracleQuiz.tsx`

---

## 1. Overview — Art Direction Change

The Oracle quiz is no longer a flat centered page with floating cards. It's now a **card-game encounter** with a temple monk NPC:

- **2D styled backdrop** of the Oracle Temple interior (dark, mystical, atmospheric)
- **Player character** sprite visible bottom-left (over-the-shoulder)
- **Monk NPC** sprite top-right, facing the player, asking questions
- **Speech bubble** from the monk contains the question text
- **Answer cards** fanned at the bottom like a card game hand
- **Progress bar** and **exit button** at top corners

**Reference:** Think Inscryption, Slay the Spire, or the provided card-battle screenshot — an intimate NPC dialogue scene where you "play" your answer.

---

## 2. Scene Layout

```
+--------------------------------------------------------------------+
| [X Exit]                              Stage 4 / 12  [████████░░░░] |
|                                                                      |
|                           +------------------+                       |
|                           | "When working on |                       |
|                           |  a group project,|      +-----------+    |
|                           |  you tend to..." |      |           |    |
|                           +--------v---------+      |  MONK     |    |
|                                                     |  SPRITE   |    |
|   +---------+                                       |  (NPC)    |    |
|   | PLAYER  |                                       |           |    |
|   | SPRITE  |                                       +-----------+    |
|   +---------+                                                        |
|                                                                      |
|   +--------+  +--------+  +--------+  +--------+                   |
|   | Take   |  | Focus  |  | Keep   |  | Let    |                   |
|   | charge |  | on the |  | team   |  | others |                   |
|   | and    |  | data   |  | united |  | lead   |                   |
|   | lead   |  |        |  |        |  |        |                   |
|   +--------+  +--------+  +--------+  +--------+                   |
+--------------------------------------------------------------------+
```

### 2.1 Full Scene Container

| Property | Value |
|----------|-------|
| Position | `fixed`, `inset: 0` (full viewport, overlays everything) |
| z-index | `50` |
| Background | Layered (see Section 3) |
| Overflow | `hidden` |

---

## 3. Backdrop — Oracle Temple Interior (2D)

A static or subtly animated 2D illustration/gradient that evokes the Oracle Temple's mystical interior.

### 3.1 Background Layers (CSS only, no image assets needed)

```css
/* Layer 1: Base dark */
background-color: #0A0A1A;

/* Layer 2: Mystical purple radial */
background-image:
  radial-gradient(ellipse at 70% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
  radial-gradient(ellipse at 30% 70%, rgba(123, 94, 167, 0.06) 0%, transparent 40%),
  radial-gradient(ellipse at 50% 100%, rgba(255, 209, 102, 0.04) 0%, transparent 30%);

/* Layer 3: Floor gradient (darker at bottom) */
linear-gradient(to bottom, transparent 60%, rgba(0, 0, 0, 0.3) 100%);
```

### 3.2 Atmospheric Elements (optional CSS animations)

| Element | Implementation | Animation |
|---------|---------------|-----------|
| Floating particles | 20-30 tiny `div` elements, `2px`, white, `opacity: 0.1-0.3` | Slow upward drift (`translateY`, 8-15s, random start positions) |
| Soft vignette | `box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.5)` | Static |
| Floor line | `1px` horizontal gradient across bottom 40% | Static — `rgba(255,255,255,0.03)` |

### 3.3 Ambient Glow Behind Monk

| Property | Value |
|----------|-------|
| Shape | `radial-gradient` centered on monk position (~70% from left, ~35% from top) |
| Color | `rgba(123, 94, 167, 0.15)` (Oracle purple) |
| Size | `300px` radius |
| Animation | Slow pulse: opacity `0.1 ↔ 0.2`, `4s ease-in-out infinite` |

---

## 4. Characters

### 4.1 Player Character (bottom-left)

| Property | Value |
|----------|-------|
| Position | `absolute`, `bottom: 200px`, `left: 8%` |
| Size | `120px` wide (auto height, maintain aspect) |
| Content | Player's current avatar sprite (2D billboard sprite from game world) |
| Fallback | Generic hooded figure silhouette if no avatar |
| Facing | Right (toward monk) |
| Shadow | `drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))` |
| Animation | Subtle idle bob: `translateY(0 → -3px → 0)`, `3s ease-in-out infinite` |
| Z-index | `5` (above background, below cards) |

### 4.2 Monk NPC (top-right)

| Property | Value |
|----------|-------|
| Position | `absolute`, `top: 15%`, `right: 8%` |
| Size | `180px` wide (larger than player — authority figure) |
| Content | Monk character illustration or sprite |
| Fallback | Hooded figure with staff, purple robes, glowing eyes |
| Facing | Left (toward player) |
| Style | AC-style 2D character: soft outlines, pastel purple robe, warm expression |
| Shadow | `drop-shadow(0 4px 16px rgba(123, 94, 167, 0.4))` |
| Animation | Subtle idle bob: `translateY(0 → -4px → 0)`, `3.5s ease-in-out infinite` (offset from player) |
| Z-index | `5` |

**Monk sprite placeholder:** Until a real sprite is created, use a simple CSS illustration:
- `140px x 200px` container
- Hooded robe shape (rounded trapezoid) in `#7B5EA7` (Oracle purple)
- Face area: `#FFF5E1` (warm cream)
- Eyes: two dots, `#FFD166` (gold glow)
- Staff: `2px` line, `#8B6B4A`, slight angle

---

## 5. Speech Bubble (Question Text)

The monk "speaks" the question through a styled speech bubble.

### 5.1 Bubble Position & Layout

| Property | Value |
|----------|-------|
| Position | `absolute`, anchored near monk (above or to the left) |
| Typical position | `top: 18%`, `right: 25%` (to the left of the monk, pointing right) |
| Max-width | `420px` |
| Min-width | `280px` |
| Padding | `20px 24px` |

### 5.2 Bubble Style

| Property | Value |
|----------|-------|
| Background | `rgba(20, 15, 35, 0.92)` (very dark purple, nearly opaque) |
| Border | `1px solid rgba(123, 94, 167, 0.3)` (purple glow edge) |
| Border-radius | `16px` |
| Box-shadow | `0 4px 24px rgba(0, 0, 0, 0.4), 0 0 40px rgba(123, 94, 167, 0.1)` |
| Backdrop-filter | `blur(8px)` |
| Tail | CSS triangle pointing toward monk (right side) |

### 5.3 Bubble Tail (CSS triangle)

```css
&::after {
  content: '';
  position: absolute;
  right: -12px;
  top: 40%;
  width: 0;
  height: 0;
  border-left: 12px solid rgba(20, 15, 35, 0.92);
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
}
```

### 5.4 Question Text Inside Bubble

| Property | Value |
|----------|-------|
| Font | `18px`, weight 500, `var(--color-text-main)` (#f1ffff) |
| Line-height | `1.5` |
| Text-align | `left` |
| Animation (new question) | Typewriter effect: characters appear one at a time, `30ms` per character |
| Typewriter skip | Click/tap anywhere to show full text instantly |

---

## 6. Answer Cards — Hand Layout

Cards are fanned at the bottom of the screen like a card game hand.

### 6.1 Hand Container

| Property | Value |
|----------|-------|
| Position | `absolute`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)` |
| Display | `flex`, `justify-content: center`, `gap: 12px` |
| Z-index | `10` (above characters) |

### 6.2 Card Dimensions

| Property | Value |
|----------|-------|
| Width | `160px` |
| Min-height | `180px` |
| Border-radius | `12px` |
| Background | `rgba(20, 15, 35, 0.95)` (dark card stock) |
| Border | `2px solid rgba(123, 94, 167, 0.25)` (purple edge) |
| Box-shadow | `0 4px 16px rgba(0, 0, 0, 0.4)` |
| Padding | `16px` |

### 6.3 Card Fan Effect

Each card has a slight rotation and vertical offset to create a "hand" feel.

| Card Index | Rotation | TranslateY | Notes |
|------------|----------|------------|-------|
| 0 (leftmost) | `-4deg` | `8px` | Tilted left |
| 1 | `-1.5deg` | `2px` | Slight tilt |
| 2 | `1.5deg` | `2px` | Slight tilt |
| 3 (rightmost) | `4deg` | `8px` | Tilted right |

For 2 cards: `-3deg`/`3deg`, `4px` each.
For 3 cards: `-3deg`/`0deg`/`3deg`, `4px`/`0px`/`4px`.

Apply via `transform: rotate(Xdeg) translateY(Ypx)`.

### 6.4 Card Content

```
+------------------+
|                  |
|  "Take charge    |
|   and delegate   |
|   tasks to the   |
|   team"          |
|                  |
|                  |
|   ─── ⚔ ───     |
+------------------+
```

| Element | Style |
|---------|-------|
| Text | `14px`, weight 500, `var(--color-text-soft)`, centered, `line-height: 1.5` |
| Divider | `1px` horizontal rule, `rgba(123, 94, 167, 0.2)`, `margin-top: auto` |
| Symbol | Small icon hint below divider (class-colored dot or symbol), `10px`, `opacity: 0.4` |

### 6.5 Card States

| State | Style |
|-------|-------|
| Default | As above, `cursor: pointer` |
| Hover | `transform: translateY(-16px) rotate(0deg) scale(1.05)`, `border-color: rgba(123, 94, 167, 0.6)`, `box-shadow: 0 8px 32px rgba(123, 94, 167, 0.3)`, z-index bumped above siblings |
| Hover transition | `0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` (springy pop-up) |
| Selected | `border: 2px solid #FFD166` (gold), `box-shadow: 0 0 20px rgba(255, 209, 102, 0.3)`, scale `1.08` for `0.15s`, then card "plays" — slides upward and fades out |
| Disabled (after pick) | All cards slide down off-screen (`translateY(300px)`, `0.4s ease-in`), then next question loads |

### 6.6 Card "Play" Animation (selected card)

```
Timeline:
0.0s   Click — card gets gold border + glow
0.15s  Card scales to 1.08
0.3s   Card slides up and forward: translateY(-100px), opacity(1→0), scale(1.1)
0.3s   Other cards slide down: translateY(300px), opacity(1→0)
0.6s   All cards gone — next question speech bubble starts typing
```

---

## 7. Progress Bar & Controls

### 7.1 Top Bar Layout

```
+--------------------------------------------------------------------+
| [X Exit]                              Stage 4 / 12  [████████░░░░] |
+--------------------------------------------------------------------+
```

| Property | Value |
|----------|-------|
| Position | `absolute`, `top: 0`, `left: 0`, `right: 0` |
| Height | `48px` |
| Background | `rgba(10, 10, 26, 0.8)` with `backdrop-filter: blur(8px)` |
| Padding | `0 24px` |
| Display | `flex`, `align-items: center`, `justify-content: space-between` |
| Z-index | `15` (above everything) |

### 7.2 Exit Button (left side)

| Property | Value |
|----------|-------|
| Icon | Lucide `X` (20px) |
| Text | "Exit" (14px) |
| Style | Ghost: transparent bg, `1px solid rgba(255, 255, 255, 0.15)`, `28px` height, `8px` radius |
| Color | `var(--color-text-muted)` |
| Hover | `border-color: var(--color-text-soft)` |
| Action | Show confirmation: "Leave quiz? Your progress will be saved." [Leave] [Stay] |

### 7.3 Progress Indicator (right side)

| Property | Value |
|----------|-------|
| Label | "Stage {n} / 12", `14px`, `font-mono`, `var(--color-text-muted)` |
| Bar width | `120px` |
| Bar height | `4px` |
| Bar track | `rgba(255, 255, 255, 0.08)` |
| Bar fill | `#7B5EA7` (Oracle purple) |
| Bar radius | `2px` |
| Fill transition | `width 0.4s ease-out` |
| Layout | Label left of bar, `8px` gap |

---

## 8. Question Transitions

| Phase | Duration | Description |
|-------|----------|-------------|
| Card selected | `0.15s` | Gold border flash |
| Card plays | `0.3s` | Selected card floats up, fades. Others slide down. |
| Pause | `0.3s` | Brief beat — scene empty |
| New bubble | `0.5s` | Speech bubble text starts typing (typewriter, 30ms/char) |
| New cards | `0.4s` | Cards fan in from below: `translateY(200px) → 0`, staggered `0.08s` each |
| Total | ~2.0s | Full transition between questions |

---

## 9. Mobile Adaptations (landscape)

| Property | Desktop | Mobile Landscape |
|----------|---------|-----------------|
| Player sprite | `120px`, bottom-left | `80px`, bottom-left |
| Monk sprite | `180px`, top-right | `120px`, top-right |
| Speech bubble max-width | `420px` | `min(320px, 50vw)` |
| Speech bubble font | `18px` | `15px` |
| Card width | `160px` | `130px` |
| Card min-height | `180px` | `140px` |
| Card text | `14px` | `13px` |
| Card gap | `12px` | `8px` |
| Fan rotation | `±4°` | `±3°` |
| Top bar height | `48px` | `36px` |
| Cards position | `bottom: 24px` | `bottom: 12px` |

---

## 10. Unchanged from Original Spec

The following sections from `ux-oracle.md` are NOT changed:
- **Section 6** — Question design (12 questions, 2-4 answers, MBTI scoring)
- **Section 7** — Class reveal animation (now enhanced in `ux-classes.md`)
- **Section 8** — RPG class system (4 classes, 16 subclasses)
- **Section 9** — Post-quiz class info page
- **Scoring** — See `specs/oracle-questions.md` for question bank

**`ux-oracle.md` Sections 2-5 are REPLACED by this spec.** Use v2 for the quiz layout.
