# UX Spec — Mobile & Responsive (Landscape-First)

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-04
> **Extends:** All existing desktop specs (`ux-dashboard.md`, `ux-game-world-v2.md`, `ux-directory.md`, `ux-interiors.md`, `ux-shop.md`, `ux-bounty.md`, `ux-leaderboard.md`, `ux-jobs.md`, `ux-oracle.md`, `ux-onboarding.md`)
> **Key decision:** Mobile is **landscape-only**. The portal locks to landscape orientation.

---

## 1. Orientation Lock — Landscape Only

The student portal is a 3D game world. Portrait orientation wastes most of the viewport on sky/ground. **Lock to landscape on mobile.**

### 1.1 Implementation

| Property | Value |
|----------|-------|
| CSS | `@media (orientation: portrait) { body { transform: rotate(90deg); ... } }` — or use the Screen Orientation API |
| Preferred method | Web App Manifest `"orientation": "landscape"` + Screen Orientation API `screen.orientation.lock("landscape")` |
| Fallback | If orientation lock fails (Safari limitations), show a full-screen prompt: "Please rotate your device to landscape mode" with a rotating phone icon |

### 1.2 Landscape Prompt (fallback)

```
+-----------------------------+
|                             |
|     [Rotating phone icon]   |
|                             |
|  Please rotate your device  |
|  for the best experience    |
|                             |
+-----------------------------+
```

| Property | Value |
|----------|-------|
| Background | `var(--color-bg-main)` (#0f0f10) |
| Icon | Lucide `RotateCcw` or custom SVG, `48px`, `var(--color-text-muted)` |
| Text | 16px, `var(--color-text-soft)`, centered |
| z-index | `9999` — above everything |
| Condition | Show when `window.innerWidth < window.innerHeight` and `window.innerWidth < 768px` |

---

## 2. Breakpoints

| Name | Width | Description |
|------|-------|-------------|
| `desktop` | `>= 1024px` | Full sidebar + game world + all columns |
| `tablet-landscape` | `768px – 1023px` | Sidebar visible, some columns hidden |
| `mobile-landscape` | `< 768px` | Hamburger nav, landscape-optimized layouts |
| `mobile-small` | `< 568px` (height < 320px) | Ultra-compact — older phones in landscape |

**Key viewport sizes in landscape:**
- iPhone 14: `844 × 390`
- iPhone 15 Pro Max: `932 × 430`
- Samsung Galaxy S24: `891 × 411`
- iPad Mini: `1024 × 768` (hits tablet breakpoint)

---

## 3. Navigation — Hamburger Only

No bottom tab bar. Hamburger menu at top-left opens the full sidebar overlay.

### 3.1 Hamburger Button (unchanged from desktop spec)

| Property | Value |
|----------|-------|
| Position | `fixed`, top `12px`, left `12px` |
| Size | `40px x 40px` |
| Icon | Lucide `Menu` (24px) |
| Background | `var(--color-surface)` with `0.85` opacity (semi-transparent over game) |
| Border | `1px solid var(--glass-border-soft)` |
| Border-radius | `8px` |
| z-index | `50` |
| Backdrop blur | `backdrop-filter: blur(8px)` — so game world shows through slightly |

### 3.2 Mobile Sidebar Overlay (unchanged)

Same slide-in from left, backdrop dimming, X close. Full 240px sidebar width. On landscape phones this takes ~28-30% of screen width — acceptable since it overlays temporarily.

### 3.3 Game World HUD (mobile-only)

When the game world is active (Home page), show a minimal HUD strip at the top of the screen for quick context.

```
+------+---------------------------------------------------+--------+
| [=]  |  Lv.5  Jane  ████░░  125 coins                   | [Map]  |
+------+---------------------------------------------------+--------+
|                                                                    |
|                        GAME WORLD                                  |
|                                                                    |
+--------------------------------------------------------------------+
```

| Property | Value |
|----------|-------|
| Position | `fixed`, top `0`, left `0`, right `0` |
| Height | `36px` |
| Background | `rgba(15, 15, 16, 0.7)` with `backdrop-filter: blur(8px)` |
| z-index | `40` |
| Content | Hamburger (left) · Level + name + mini XP bar + coin count (center) · Map toggle (right) |
| Font | `12px`, `var(--color-text-main)` |
| XP bar | `60px` wide, `4px` tall, inline, `var(--color-brand-blue)` fill |
| Coin icon | Small `$` or coin glyph, `#ffd166` |
| Map button | Lucide `Map` icon (20px), toggles minimap overlay |
| Padding | `0 12px` |
| Touch targets | All interactive elements minimum `36px` tap area |

---

## 4. Game World — Touch Controls

### 4.1 Tap-to-Move (primary control)

| Property | Value |
|----------|-------|
| Input | Single tap on ground |
| Behavior | Raycaster hit on ground plane → player walks to that point (same pathfinding as click-to-move on desktop) |
| Speed | Same `5 units/sec` as desktop |
| Visual feedback | Subtle white circle pulse at tap point (0.3s, fade out) — confirms the tap registered |
| Cancel | Tap elsewhere to change destination. Tap player to stop. |

### 4.2 Tap Target Sizes

All interactive elements must meet minimum touch target sizes.

| Element | Minimum tap area | Notes |
|---------|-----------------|-------|
| Building interaction | `48px x 48px` | The "Press E to enter" prompt becomes a tap button |
| Ground tap-to-move | Full viewport | Raycaster covers entire game area |
| HUD buttons | `36px x 36px` | Hamburger, map toggle |
| Overlay close | `44px x 44px` | X button in panels |

### 4.3 Building Interaction on Mobile

Desktop uses "Press E to enter" proximity prompt. Mobile replaces this with a **tap button**.

| Property | Value |
|----------|-------|
| Trigger | Player walks within `3` units of a building (same range as desktop) |
| Prompt | Rounded pill button appears above building: "Enter [Building Name]" |
| Button style | `height: 36px`, `padding: 0 16px`, `border-radius: 18px` |
| Button bg | `rgba(0, 47, 167, 0.9)` (brand blue, high opacity for readability) |
| Button text | `14px`, white, weight 600 |
| Button shadow | `0 2px 8px rgba(0, 0, 0, 0.4)` |
| Position | `<Html>` billboard positioned at building top + 2 units Y offset |
| Dismiss | Walks away (> 3 units) or tap elsewhere |

### 4.4 Camera (mobile adjustments)

| Property | Desktop | Mobile |
|----------|---------|--------|
| FOV | `50°` | `55°` (wider to see more in landscape) |
| Distance | `15` | `18` (slightly further for overview) |
| Polar angle | `55-60°` | `55-60°` (same) |
| Follow smoothing | `0.08` | `0.06` (slightly smoother, less jarring on small screen) |

### 4.5 Gestures

| Gesture | Action |
|---------|--------|
| Single tap | Move player to point / interact with building |
| Long press (500ms) | Show tooltip for nearest object (building name, prop description) |
| Pinch | **Disabled for MVP** — camera zoom is locked |
| Two-finger drag | **Disabled for MVP** — camera rotation is locked |
| Swipe from left edge | Open hamburger sidebar |

---

## 5. Building Interiors — Mobile

Same 3D interior scenes. Touch controls carry over.

| Property | Desktop | Mobile |
|----------|---------|--------|
| Movement | WASD + click-to-move | Tap-to-move only |
| Interaction | "Press E" proximity prompt | Tap button prompt (same as exterior) |
| Station range | `2 units` | `2.5 units` (slightly more forgiving on touch) |
| Camera distance | `10` | `12` (slightly further for room overview) |
| Camera polar | `65°` | `65°` (same) |
| Exit | Walk to door + press E, or Escape | Walk to door + tap "Exit" button, or back gesture |
| Exit button | None (Escape key) | Persistent `32px` exit icon, top-right corner, `var(--color-text-muted)` |

### 5.1 Exit Button (mobile-only)

```
                                          [X Exit]
+--------------------------------------------+
|                                            |
|              Interior Scene                |
|                                            |
+--------------------------------------------+
```

| Property | Value |
|----------|-------|
| Position | `fixed`, top `12px`, right `12px` |
| Style | Pill button: Lucide `DoorOpen` icon (16px) + "Exit" text |
| Size | `height: 32px`, `padding: 0 12px` |
| Background | `rgba(15, 15, 16, 0.7)`, `backdrop-filter: blur(8px)` |
| Border | `1px solid var(--glass-border-soft)` |
| Border-radius | `16px` |
| z-index | `40` |

---

## 6. Directory — Compact List Rows (48px)

### 6.1 Mobile Row Layout (< 768px)

```
+--[32px Av]--[Name]--[T3]--[>]--+
|  JD  Jane Smith    [T3]    >    |  48px
+---------------------------------+
```

| Property | Desktop (64px) | Mobile (48px) |
|----------|---------------|---------------|
| Row height | `64px` | `48px` |
| Avatar | `40px` | `32px` |
| Avatar border | `2px` tier-coded | `2px` tier-coded |
| Name | 14px, weight 600 | 14px, weight 600 |
| Class subtitle | 12px, shown | **Hidden** |
| Tier badge | 22px pill | `18px` pill, `6px` padding, `11px` font |
| Level | "Lv.N", 48px fixed | **Hidden** |
| XP bar | 80px | **Hidden** |
| Arrow | ChevronRight 16px | ChevronRight 14px |
| Padding | `0 16px` | `0 12px` |
| Gap | `12px` | `8px` |

### 6.2 Mobile Search Bar

| Property | Desktop | Mobile |
|----------|---------|--------|
| Search input height | `40px` | `36px` |
| Search font | `14px` | `14px` |
| Filter button | Text "Filters" + icon | Icon only (`SlidersHorizontal`, no text) |
| Filter button width | Auto | `36px x 36px` square |
| Container padding | `24px` | `12px` |
| Max-width | `960px` | `100%` (no max-width) |

### 6.3 Mobile Filter Panel

Same content (tier pills, status toggle) but:

| Property | Value |
|----------|-------|
| Layout | Full width, stacked vertically |
| Tier pills | Wrap to 2 rows if needed |
| Touch targets | Each pill minimum `36px` tap height (add vertical padding) |

---

## 7. Profile Page — Mobile

### 7.1 Mobile Layout (< 768px)

```
+----------------------------------+
|  [< Back]                        |
+----------------------------------+
|  [64px Avatar]                   |
|  Jane Smith                      |
|  Warrior · T3 · PM & VP         |
+----------------------------------+
|  Level   XP      Coins          |
|   8      1,200   450            |
|  ████████████░░░░ to Lv.9       |
+----------------------------------+
|  SKILLS                          |
|  [React] [TypeScript] [Node.js]  |
+----------------------------------+
```

| Property | Desktop | Mobile |
|----------|---------|--------|
| Container max-width | `960px` | `100%` |
| Container padding | `24px` | `16px` |
| Avatar size | `96px` | `64px` |
| Avatar border | `4px` | `3px` |
| Name font | `30px` | `24px` |
| Subtitle font | `16px` | `14px` |
| Bio font | `16px` | `14px` |
| Bio max-width | `600px` | `100%` |
| Stats layout | Flex row | Flex row (same, values shrink) |
| Stat value font | `24px` | `20px` |
| XP bar height | `8px` | `6px` |
| Skill tag height | `28px` | `28px` (keep — touch target) |
| Section label | `12px` | `12px` |
| Edit button | Top-right | Below header, full-width |

### 7.2 Mobile Edit Button

On mobile, the edit button moves below the header instead of top-right (avoids cramped layout).

| Property | Value |
|----------|-------|
| Width | `100%` |
| Height | `40px` |
| Margin-top | `16px` |
| Style | Same primary button (brand-blue bg), centered text + pencil icon |

---

## 8. Overlay Panels — Full-Screen Bottom Sheet

On mobile, overlay panels (Bounty Board, Leaderboard, Job Board) use a full-screen bottom sheet instead of the centered dialog.

### 8.1 Sheet Animation

| Phase | Duration | Easing | Description |
|-------|----------|--------|-------------|
| Open | `0.3s` | `cubic-bezier(0.32, 0.72, 0, 1)` | Slides up from bottom edge |
| Close | `0.25s` | `ease-in` | Slides down off-screen |

### 8.2 Sheet Layout

```
+--------------------------------------------+
|  [Sheet title]                    [X]      |  Header (48px)
|============================================|
|                                            |
|  Scrollable content                        |
|                                            |
|                                            |
+--------------------------------------------+
```

| Property | Value |
|----------|-------|
| Position | `fixed`, `bottom: 0`, `left: 0`, `right: 0` |
| Height | `100vh` (full screen) |
| Background | `var(--color-bg-main)` (#0f0f10) — NOT the overlay `#0d1b2a` (full-screen sheets use page bg for consistency) |
| Border-radius | `16px 16px 0 0` (top corners rounded) |
| z-index | `60` |
| Header | `48px` height, sticky top, border-bottom `1px solid rgba(255, 255, 255, 0.06)` |
| Title | `18px`, weight 700, `var(--color-text-main)` |
| Close button | `X` icon, `44px x 44px` tap area, right side |
| Content | `overflow-y: auto`, `padding: 16px` |
| Swipe to dismiss | Swipe down on header area → close sheet (velocity threshold: `0.5px/ms`) |

### 8.3 Sheet Handle

| Property | Value |
|----------|-------|
| Visible | Small drag handle bar at top center of header |
| Width | `32px` |
| Height | `4px` |
| Background | `var(--gray-600)` (#52525b) |
| Border-radius | `2px` |
| Margin | `8px auto 0` |

### 8.4 Content Adaptations Inside Sheets

#### Bounty Board (from `ux-bounty.md`)

| Property | Desktop | Mobile sheet |
|----------|---------|-------------|
| Grid | 2-column cards | **1-column** full-width cards |
| Card padding | `20px` | `16px` |
| Filter tabs | Horizontal row | Horizontal scroll (overflow-x: auto, no wrap) |
| Tab height | `36px` | `40px` (bigger touch targets) |

#### Leaderboard (from `ux-leaderboard.md`)

| Property | Desktop | Mobile sheet |
|----------|---------|-------------|
| Table columns | Rank, Name, Level, XP, Coins, Class | Rank, Name, Level, XP only |
| Time period tabs | Full-width row | Horizontal scroll |
| Row height | `48px` | `44px` |
| Your-row highlight | Sticky bottom | Sticky bottom (same) |

#### Job Board (from `ux-jobs.md`)

| Property | Desktop | Mobile sheet |
|----------|---------|-------------|
| Layout | Search bar + cards | Search bar (36px) + full-width cards |
| Card layout | Horizontal (logo + info + badges) | **Stacked** (info top, badges below) |
| Filter bar | Inline | Collapsible (tap "Filters" to expand) |

---

## 9. Oracle Quiz — Mobile

The card-based quiz works well on mobile in landscape. Minor adjustments:

| Property | Desktop | Mobile |
|----------|---------|--------|
| Answer cards | 2-4 per row | 2 per row max (cards stack if > 2) |
| Card size | `180px x 120px` | `min(45vw, 180px) x auto` |
| Card text | `14px` | `14px` |
| Question text | `24px` | `20px` |
| Progress bar | Bottom, `4px` | Bottom, `4px` (same) |
| Class reveal | Full-screen animation | Same animation, scaled to viewport |

---

## 10. Onboarding Flow — Mobile

The 3-step flow (welcome → profile → avatar) adapts for landscape mobile.

| Property | Desktop | Mobile |
|----------|---------|--------|
| Welcome card | Centered, `480px` max-width | `90vw` max-width |
| Profile form | Single column, `600px` max-width | Single column, `90vw` |
| Avatar creator | Tabbed panel, centered modal | **Full-screen** — tabs at bottom (horizontal scroll) |
| Quest checklist | Side widget, `280px` | Full-screen bottom sheet (collapses to floating pill) |

### 10.1 Quest Checklist — Mobile

| State | Description |
|-------|-------------|
| Collapsed | Floating pill at bottom-right: "3/6 quests" with mini progress arc |
| Expanded | Full-screen bottom sheet with quest list |
| Pill size | `height: 32px`, `padding: 0 12px`, `border-radius: 16px` |
| Pill bg | `var(--color-brand-blue)` with `0.9` opacity |
| Pill text | `12px`, white |

---

## 11. Shop — Mobile

| Property | Desktop | Mobile |
|----------|---------|--------|
| Page layout | Full-page, max-width `1200px` | Full width, `padding: 12px` |
| Product grid | 3-4 columns | **2 columns** |
| Product card | `min-width: 240px` | `min-width: 0`, `flex: 1` |
| Card image | `200px` height | `140px` height |
| Category tabs | Horizontal row | Horizontal scroll, `overflow-x: auto` |
| Product detail | Centered modal `800px` | Full-screen bottom sheet |
| Cart button | Fixed bottom bar | Fixed bottom bar (same) |

---

## 12. Tokens — Mobile Additions

Add these to `web/styles/game-tokens.css`:

```css
/* ─── Mobile / Responsive Tokens ─── */

/* Orientation */
--mobile-orientation: landscape;

/* Touch Targets */
--touch-target-min: 36px;
--touch-target-comfortable: 44px;
--touch-target-large: 48px;

/* Mobile HUD */
--hud-height: 36px;
--hud-bg: rgba(15, 15, 16, 0.7);
--hud-blur: blur(8px);
--hud-z: 40;

/* Mobile Game Camera */
--game-camera-fov-mobile: 55;
--game-camera-distance-mobile: 18;
--game-camera-follow-mobile: 0.06;

/* Tap-to-Move Feedback */
--tap-indicator-size: 24px;
--tap-indicator-color: rgba(255, 255, 255, 0.6);
--tap-indicator-duration: 0.3s;

/* Bottom Sheet */
--sheet-z: 60;
--sheet-radius: 16px;
--sheet-header-height: 48px;
--sheet-handle-width: 32px;
--sheet-handle-height: 4px;
--sheet-handle-color: var(--gray-600);
--sheet-open-duration: 0.3s;
--sheet-open-ease: cubic-bezier(0.32, 0.72, 0, 1);
--sheet-close-duration: 0.25s;
--sheet-close-ease: ease-in;
--sheet-swipe-velocity: 0.5; /* px/ms threshold */

/* Mobile Directory */
--directory-row-height-mobile: 48px;
--directory-avatar-size-mobile: 32px;
--directory-tier-badge-height-mobile: 18px;

/* Mobile Profile */
--profile-avatar-size-mobile: 64px;
--profile-avatar-border-mobile: 3px;
--profile-name-size-mobile: 24px;
--profile-stat-value-size-mobile: 20px;

/* Mobile Interior */
--game-interact-range-mobile: 2.5;
--game-camera-distance-interior-mobile: 12;

/* Mobile Building Interaction Prompt */
--building-prompt-height-mobile: 36px;
--building-prompt-radius-mobile: 18px;
--building-prompt-bg-mobile: rgba(0, 47, 167, 0.9);
```

---

## 13. Accessibility — Mobile Specific

| Concern | Implementation |
|---------|---------------|
| Touch targets | All interactive elements minimum `36px`, preferred `44px` |
| Double-tap zoom | Disabled via `<meta name="viewport" content="..., user-scalable=no">` (game needs to own all gestures) |
| Safe areas | Use `env(safe-area-inset-*)` for notched devices — HUD and sheet handle must avoid notch |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` — disable tap indicator pulse, sheet slide (instant show/hide), tree sway, cloud movement |
| Screen reader | All tap targets have `aria-label`. Building interaction buttons are focusable. Bottom sheets announce via `role="dialog"` + `aria-modal="true"` |
| Haptic feedback | Optional `navigator.vibrate(10)` on building interaction and quest completion (short buzz, not annoying) |

---

## 14. Implementation Priority

| Step | Task | Effort |
|------|------|--------|
| 1 | Orientation lock + landscape prompt fallback | Small |
| 2 | Mobile HUD strip for game world | Medium |
| 3 | Tap-to-move (extend existing click-to-move with touch events) | Medium |
| 4 | Building interaction prompt → tap button | Small |
| 5 | Directory compact rows (48px) + responsive hiding | Small |
| 6 | Bottom sheet component (reusable) | Medium |
| 7 | Profile page responsive | Small |
| 8 | Overlay panels → bottom sheets on mobile | Medium |
| 9 | Interior exit button + touch range adjustment | Small |
| 10 | Mobile camera adjustments (FOV, distance) | Small |
| 11 | Shop 2-column grid + product detail sheet | Small |
| 12 | Oracle quiz card stacking | Small |
| 13 | Onboarding quest pill + expanded sheet | Small |
| 14 | Safe areas + accessibility polish | Small |
