# UX Spec — Game World Overlay System

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-08
> **Replaces:** Current `router.push()` behavior for board objects
> **Key change:** Bounty Board, Job Board, Leaderboard open as overlays ON TOP of the game world — not page navigation.
> **Existing component:** `web/components/game/OverlayPanel.tsx` (already built, reuse it)

---

## 1. Interaction Model — Overlays vs Page Navigation

### 1.1 Which Objects Get Overlays (stay on game world)

These are **board/sign objects** in the world. Interacting opens a panel that floats over the game canvas. The game world is still visible (dimmed) behind the overlay. Player movement is paused.

| Object | ID | Overlay Content | Reason |
|--------|----|----|--------|
| Bounty Board | `bounty` | BountyBoard component (card grid + filters + detail modal) | Board — quick browse, claim, return to exploring |
| Job Board | `jobs` | JobBoard component (listings + search + submit) | Board — quick browse, return to exploring |
| Leaderboard | `leaderboard` | LeaderboardTable component (ranked table + time tabs) | Pedestal — quick glance, return to exploring |

### 1.2 Which Objects Get Page Navigation (leave game world)

These are **full buildings** that the player "enters." Fade-to-black transition → navigate to dedicated page. Full-screen content replaces the game canvas.

| Object | ID | Navigation Target | Reason |
|--------|----|----|--------|
| HQ | `hq` | `/student/dashboard` (or future interior scene) | Main building — interiors spec'd |
| Shop | `shop` | `/student/dashboard/shop` | Full e-commerce catalog needs page space |
| Oracle Temple | `oracle` | `/student/dashboard/oracle` | MBTI quiz needs full attention (no game distractions) |
| House | `house` | None (decorative) | No interaction |

### 1.3 Sidebar Navigation — Always Full Page

When users click Bounty Board / Job Board / Leaderboard in the **sidebar**, they navigate to the full page version (`/student/dashboard/bounty`, etc.) as before. The overlay behavior is ONLY for game world object interactions.

**Both paths coexist:**
- Game world board → overlay (quick browse while exploring)
- Sidebar nav → full page (dedicated view with more space)

---

## 2. Overlay Dimensions & Styling

Reuse the existing `OverlayPanel.tsx` component. These are the definitive values:

### 2.1 Backdrop (dimmed game world)

| Property | Value |
|----------|-------|
| Position | `fixed`, `inset: 0` |
| Background | `rgba(0, 0, 0, 0.65)` — slightly darker than current 0.6 for better readability |
| Backdrop-filter | `blur(4px)` — subtly blurs the 3D scene behind |
| z-index | `55` |
| Click | Close overlay (return to game) |
| Transition in | `opacity 0→1`, `0.2s ease-out` |
| Transition out | `opacity 1→0`, `0.15s ease-in` |

### 2.2 Panel

| Property | Value |
|----------|-------|
| Position | `fixed`, centered (`top: 50%`, `left: 50%`, `transform: translate(-50%, -50%)`) |
| Width | `min(900px, 92vw)` — wider than current 800px for table/grid content |
| Max-height | `85vh` |
| Background | `#0d1b2a` (bg-navy, same as current) |
| Border | `1px solid rgba(0, 47, 167, 0.3)` (blue glow) |
| Border-radius | `16px` |
| Box-shadow | `0 24px 60px rgba(0, 0, 0, 0.6)` |
| Padding | `0` — content components handle their own padding |
| z-index | `60` |
| Overflow | `hidden` (content scrolls inside) |

### 2.3 Panel Header

| Property | Value |
|----------|-------|
| Height | `56px` |
| Display | `flex`, `align-items: center`, `justify-content: space-between` |
| Padding | `0 24px` |
| Border-bottom | `1px solid rgba(255, 255, 255, 0.06)` |
| Background | `rgba(0, 0, 0, 0.2)` (slightly darker for visual separation) |
| Position | `sticky`, `top: 0` |
| z-index | `5` (within panel) |

#### Title

| Property | Value |
|----------|-------|
| Font | `18px`, weight 700, `var(--color-text-main)` (#f1ffff) |
| Icon | Building-specific Lucide icon (16px) to the left, `12px` gap |
| Icons | Bounty: `Scroll`, Jobs: `Briefcase`, Leaderboard: `Trophy` |

#### Close Button

| Property | Value |
|----------|-------|
| Icon | Lucide `X` (20px) |
| Size | `36px x 36px` tap target |
| Color | `var(--color-text-muted)`, hover → `var(--color-text-main)` |
| Border-radius | `8px` |
| Hover bg | `rgba(255, 255, 255, 0.06)` |

### 2.4 Panel Content Area

| Property | Value |
|----------|-------|
| Overflow-y | `auto` |
| Max-height | `calc(85vh - 56px)` (viewport minus header) |
| Padding | `24px` |
| Scrollbar | Thin, dark track, subtle thumb (`scrollbar-width: thin`) |

---

## 3. Open/Close Animations

### 3.1 Opening (object interaction → overlay appears)

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Backdrop | `opacity: 0 → 1` | `0.2s` | `ease-out` |
| Panel | `opacity: 0 → 1`, `scale(0.95) → scale(1)`, `translateY(20px) → translateY(0)` | `0.25s` | `cubic-bezier(0.34, 1.56, 0.64, 1)` (springy) |

### 3.2 Closing (X, Escape, backdrop click)

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Panel | `opacity: 1 → 0`, `scale(1) → scale(0.97)` | `0.15s` | `ease-in` |
| Backdrop | `opacity: 1 → 0` | `0.15s` | `ease-in` |
| After close | Resume player input, re-enable WASD movement | Immediate | — |

---

## 4. Close Behaviors

| Trigger | Behavior |
|---------|----------|
| `Escape` key | Close overlay, return to game |
| Backdrop click | Close overlay, return to game |
| `X` button | Close overlay, return to game |
| Walk away | NOT auto-close — overlay stays open even if player somehow moves (input is paused anyway) |

### 4.1 Input Pausing

When an overlay is open:

| Input | State |
|-------|-------|
| WASD / Arrow keys | **Disabled** — player cannot move |
| Click-to-move (ground) | **Disabled** — raycaster blocked |
| E key (interact) | **Disabled** — prevent re-triggering |
| Escape | **Active** — closes overlay |
| Mouse/scroll inside panel | **Active** — panel content is interactive |

---

## 5. Building.tsx Changes

### 5.1 Current Behavior (to change)

```
Board object (bounty/jobs/leaderboard):
  Player near → "Press E" prompt → router.push(href)
```

### 5.2 New Behavior

```
Board object (bounty/jobs/leaderboard):
  Player near → "Press E" prompt → onInteract(buildingId) callback

Full building (shop/oracle):
  Player near → "Press E" prompt → fade-to-black → router.push(href)  [unchanged]
```

### 5.3 Interaction Callback

Building.tsx needs a new prop:

```typescript
interface BuildingProps {
  // ... existing props ...
  href?: string;           // For page-nav buildings (shop, oracle)
  onInteract?: () => void; // For overlay buildings (bounty, jobs, leaderboard)
}
```

Logic:
- If `onInteract` is provided → call it (for overlays)
- Else if `href` is provided → `router.push(href)` (for page nav)
- Else → no interaction (decorative)

---

## 6. Dashboard Home Page State

The dashboard home page (`/student/dashboard/page.tsx`) manages overlay state:

```typescript
type OverlayType = "bounty" | "jobs" | "leaderboard" | null;

const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
```

### 6.1 Building Config Update

```typescript
const BUILDINGS = [
  { id: "hq",          ..., href: undefined, overlay: undefined },
  { id: "shop",        ..., href: "/student/dashboard/shop", overlay: undefined },
  { id: "oracle",      ..., href: undefined, overlay: undefined },
  { id: "bounty",      ..., href: undefined, overlay: "bounty" as OverlayType },
  { id: "jobs",        ..., href: undefined, overlay: "jobs" as OverlayType },
  { id: "leaderboard", ..., href: undefined, overlay: "leaderboard" as OverlayType },
];
```

### 6.2 Rendering

```jsx
{/* Game canvas */}
<Canvas ...>
  <Scene />
</Canvas>

{/* Overlays rendered ABOVE canvas, outside R3F */}
<OverlayPanel open={activeOverlay === "bounty"} title="Bounty Board" onClose={() => setActiveOverlay(null)}>
  <BountyBoard />
</OverlayPanel>

<OverlayPanel open={activeOverlay === "jobs"} title="Job Board" onClose={() => setActiveOverlay(null)}>
  <JobBoard />
</OverlayPanel>

<OverlayPanel open={activeOverlay === "leaderboard"} title="Leaderboard" onClose={() => setActiveOverlay(null)}>
  <LeaderboardTable />
</OverlayPanel>
```

---

## 7. Content Component Extraction

Frontend must extract the page content into reusable components:

| Source Page | Extract To | What to Remove |
|-------------|-----------|----------------|
| `bounty/page.tsx` | `components/portal/BountyBoard.tsx` | Page wrapper padding, header icon |
| `jobs/page.tsx` | `components/portal/JobBoard.tsx` | Page wrapper padding, header icon |
| `leaderboard/page.tsx` | `components/portal/LeaderboardTable.tsx` | Page wrapper padding, header icon |

Each extracted component should:
- Accept no layout props (the OverlayPanel provides the container)
- Handle its own data fetching
- Handle its own internal state (filters, modals, etc.)
- Work in both contexts: overlay (no padding) and full page (with padding wrapper)

### 7.1 Page Files After Extraction

```tsx
// bounty/page.tsx — full page route (sidebar nav)
export default function BountyPage() {
  return (
    <div style={{ padding: 24 }}>
      <BountyBoard />
    </div>
  );
}
```

---

## 8. Overlay-Specific Content Adjustments

When content renders inside the overlay panel (narrower, constrained height), some layout tweaks apply:

### 8.1 Bounty Board (in overlay)

| Property | Full Page | Overlay |
|----------|-----------|---------|
| Max-width | `800px` | `100%` (panel is max 900px) |
| Grid columns | `2` | `2` (same — 900px fits 2 columns) |
| Header | Icon + "Bounty Board" h1 | **Hidden** — OverlayPanel header shows title |
| Detail modal | Fixed overlay | **Inline** — replace card grid with detail view (back button returns to grid) |

### 8.2 Job Board (in overlay)

| Property | Full Page | Overlay |
|----------|-----------|---------|
| Max-width | `960px` | `100%` |
| "Submit a Job" button | Top-right | Top-right (same) |
| Header | Icon + "Job Board" h1 | **Hidden** |
| Submit modal | Fixed overlay | **Inline** within panel |

### 8.3 Leaderboard (in overlay)

| Property | Full Page | Overlay |
|----------|-----------|---------|
| Max-width | `800px` | `100%` |
| Header | Icon + "Leaderboard" h1 | **Hidden** |
| Table columns | All | Same (900px is wide enough) |
| Row height | `56px` | `48px` (tighter for more visible rows) |

### 8.4 Context Prop

Each component should accept an optional `context` prop:

```typescript
interface BountyBoardProps {
  context?: "page" | "overlay";
}
```

- `"page"` (default): shows own header, uses own max-width
- `"overlay"`: hides header, fills container, uses inline sub-views

---

## 9. Mobile Adaptations (landscape)

On mobile (< 768px), overlays become **full-screen bottom sheets** per `ux-mobile.md`:

| Property | Desktop Overlay | Mobile Sheet |
|----------|----------------|-------------|
| Position | Centered, 900px max | Full screen, slides up from bottom |
| Height | `85vh` max | `100vh` |
| Border-radius | `16px` | `16px 16px 0 0` (top corners only) |
| Close | X + Escape + backdrop | X + swipe down + back gesture |
| Header height | `56px` | `48px` |
| Content padding | `24px` | `16px` |
| Bounty grid | 2 columns | 1 column |
| Leaderboard cols | All | Rank + Name + XP only |

---

## 10. Accessibility

| Concern | Implementation |
|---------|---------------|
| Focus trap | When overlay opens, focus moves to panel. Tab cycles within panel only. |
| Focus restore | When overlay closes, focus returns to the game canvas / last focused element. |
| ARIA | `role="dialog"`, `aria-modal="true"`, `aria-label="{title}"` on panel |
| Escape | Always closes (already implemented in OverlayPanel.tsx) |
| Screen reader | Announce overlay open: `aria-live="polite"` on state change |
| Reduced motion | `prefers-reduced-motion: reduce` → skip scale/translate animations, instant show/hide |

---

## 11. Tokens

Add to `game-tokens.css`:

```css
/* ─── Overlay System ─── */
--overlay-backdrop-bg: rgba(0, 0, 0, 0.65);
--overlay-backdrop-blur: 4px;
--overlay-backdrop-z: 55;

--overlay-panel-width: min(900px, 92vw);
--overlay-panel-max-height: 85vh;
--overlay-panel-bg: #0d1b2a;
--overlay-panel-border: 1px solid rgba(0, 47, 167, 0.3);
--overlay-panel-radius: 16px;
--overlay-panel-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
--overlay-panel-z: 60;

--overlay-header-height: 56px;
--overlay-header-bg: rgba(0, 0, 0, 0.2);
--overlay-close-size: 36px;

--overlay-open-duration: 0.25s;
--overlay-open-ease: cubic-bezier(0.34, 1.56, 0.64, 1);
--overlay-close-duration: 0.15s;
--overlay-close-ease: ease-in;
```
